/**
 * On-disk gallery: generated images plus a JSON index beside them.
 *
 * Files live in `<workspace>/<saveDir>/` (default `generated/`) so they are easy
 * to find and easy to back up; `gallery.json` keeps the prompt and sampling
 * metadata the panel shows.
 *
 * @module dsh-comfyui/gallery
 */

import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

/** How many entries the index keeps. */
const MAX_ENTRIES = 300

/** Only files this module wrote can be served back. */
const SAFE_NAME = /^[A-Za-z0-9._-]+\.(?:png|jpg|jpeg|webp)$/

/**
 * Ensure the gallery directory exists.
 * @param dir - absolute directory.
 */
async function ensure(dir) {
  await mkdir(dir, { recursive: true })
}

/**
 * Read the index, tolerating a missing or corrupt file.
 * @param dir - gallery directory.
 * @returns entries, newest first.
 */
export async function list(dir) {
  const file = join(dir, 'gallery.json')
  if (!existsSync(file)) return []
  try {
    const parsed = JSON.parse(await readFile(file, 'utf8'))
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/**
 * Write one image and prepend its index entry.
 * @param dir - gallery directory.
 * @param data - image bytes.
 * @param meta - prompt and sampling metadata. `previewBytes` is optional: a
 *   derived, view-only companion (pixel assets keep the true 64 px sprite as the
 *   asset and a block-expanded PNG for display).
 * @returns the created entry.
 */
export async function add(dir, data, meta) {
  await ensure(dir)
  // Two code paths can finish the same job (the generation promise and the job
  // poll's reconcile); a prompt id makes the second one a no-op.
  if (typeof meta?.promptId === 'string' && meta.promptId !== '') {
    const existing = (await list(dir)).find(entry => entry?.promptId === meta.promptId)
    if (existing !== undefined) return existing
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const name = `comfy-${stamp}.png`
  await writeFile(join(dir, name), data)
  const { previewBytes, ...rest } = meta ?? {}
  const entry = {
    name,
    createdAt: new Date().toISOString(),
    bytes: data.length,
    ...rest,
  }
  if (previewBytes !== undefined && previewBytes !== null) {
    const preview = `${name.slice(0, -'.png'.length)}.preview.png`
    await writeFile(join(dir, preview), previewBytes)
    entry.preview = preview
  }
  const entries = await list(dir)
  entries.unshift(entry)
  await writeFile(join(dir, 'gallery.json'), JSON.stringify(entries.slice(0, MAX_ENTRIES), null, 2))
  await writeFile(join(dir, '.gitignore'), '*\n', { flag: 'wx' }).catch(() => {})
  return entry
}

/**
 * Resolve one gallery file for serving.
 * @param dir - gallery directory.
 * @param name - requested file name.
 * @returns bytes, or null when the name is not one of ours.
 */
export async function read(dir, name) {
  if (typeof name !== 'string' || !SAFE_NAME.test(name)) return null
  const file = join(dir, name)
  if (!existsSync(file)) return null
  return readFile(file)
}

/**
 * Delete one image and drop it from the index.
 * @param dir - gallery directory.
 * @param name - the file to remove.
 * @returns true when a file was actually deleted.
 */
export async function remove(dir, name) {
  if (typeof name !== 'string' || !SAFE_NAME.test(name)) return false
  let deleted = false
  try {
    await rm(join(dir, name))
    deleted = true
  } catch {
    deleted = false
  }
  // A pixel asset has a derived preview beside it; drop it with the asset.
  await rm(join(dir, name.replace(/\.png$/, '.preview.png')), { force: true }).catch(() => {})
  const entries = await list(dir)
  const kept = entries.filter(entry => entry?.name !== name)
  if (kept.length !== entries.length) {
    await writeFile(join(dir, 'gallery.json'), JSON.stringify(kept, null, 2))
  }
  return deleted
}
