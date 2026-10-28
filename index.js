/**
 * ComfyUI text-to-image for DeepSeek Harness.
 *
 * Host half: probes or starts the local ComfyUI, discovers the installed FLUX
 * models, optimizes the prompt (rules or the configured model), queues the
 * workflow, waits for the result, and stores it in the plugin gallery plus — for
 * chat generations — under `<workspace>/generated/`.
 *
 * @module dsh-comfyui
 */

import { randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  DEFAULT_ROOT,
  DEFAULT_URL,
  buildPixelWorkflow,
  buildReferenceWorkflow,
  buildWorkflow,
  cancelPrompt,
  capabilities,
  fetchImage,
  promptState,
  firstImage,
  PIXEL_SPRITE_NODE,
  PIXEL_PREVIEW_NODE,
  getJson,
  postJson,
  probe,
  startServer,
  waitForPrompt,
} from './lib/comfy.js'
import * as gallery from './lib/gallery.js'
import { ARTISTS, STYLES, artistOf, optimize } from './lib/prompt.js'

/** Cordis plugin name used by Loader diagnostics. */
export const name = 'comfyui'

/** Required services. */
export const inject = ['tools', 'systemPrompt', 'llm']

/** Size presets the panel offers. */
const SIZES = [
  // drafts — fast on Apple Silicon
  '512x512', '768x768',
  // the official Krea 2 1K tiers, one megapixel per aspect ratio
  '1024x1024',
  '928x1152',   // 4:5
  '832x1248',   // 2:3 anime portrait
  '768x1376',   // 9:16
  '1184x896',   // 4:3
  '1248x832',   // 3:2
  '1376x768',   // 16:9
  '1568x672',   // 2.35:1
  // 2K tier: what the model is trained for, but slow here (~10x a 1K render)
  '1440x1440', '2048x1152',
]


/** Every model set this panel can drive, with the files each one needs. */
export const MODEL_PRESETS = [
  {
    id: 'krea2-turbo',
    label: 'Krea 2 Turbo · Q4',
    arch: 'krea2',
    unetLoader: 'UnetLoaderGGUF',
    unet: 'krea2_turbo-Q4_K_M.gguf',
    clipLoader: 'CLIPLoaderGGUF',
    clipType: 'krea2',
    clipFiles: ['qwen3vl_4b_bf16.safetensors'],
    vae: 'qwen_image_vae.safetensors',
    steps: 8,
    guidance: 0,
    guidanceSupported: false,
    referenceLoras: {
      identity: 'krea2_identity_edit_v1_1_r64.safetensors',
      style: 'krea2_style_reference.safetensors',
    },
    // Krea 2 style LoRAs: official trigger words and strengths from
    // Comfy-Org/Krea-2. The trigger rides along in the positive prompt (the
    // official template concatenates it), the strength patches the model.
    styleLoras: [
      // Community (fal style-LoRA series, Krea 2 Community License). Trained on
      // Krea 2 Turbo itself, so 8 steps is the documented recipe.
      {
        id: 'celanime',
        file: 'cel-shaded-daytime-anime-comfy.safetensors',
        zh: '赛璐璐日间动漫',
        en: 'Cel-shaded anime',
        trigger: 'cel shaded daytime anime style',
        strength: 1,
        community: 'ilkerzgi/krea-2-cel-shaded-daytime-anime-lora',
      },
      { id: 'retroanime', file: 'krea2_retroanime.safetensors', zh: '复古动漫', en: 'Retro anime', trigger: 'purple retro anime style', strength: 1 },
      { id: 'softwatercolor', file: 'krea2_softwatercolor.safetensors', zh: '艺术水彩', en: 'Art-deco watercolour', trigger: 'art deco watercolor style', strength: 1 },
      { id: 'darkbrush', file: 'krea2_darkbrush.safetensors', zh: '水墨笔触', en: 'Ink wash', trigger: 'monochrome ink wash style', strength: 1 },
      { id: 'dotmatrix', file: 'krea2_dotmatrix.safetensors', zh: '点阵网点', en: 'Stippling', trigger: 'monochrome stippling style', strength: 1 },
      { id: 'neondrip', file: 'krea2_neondrip.safetensors', zh: '霓彩流挂', en: 'Neon drip', trigger: 'textured abstract style', strength: 1 },
      { id: 'rainywindow', file: 'krea2_rainywindow.safetensors', zh: '雨窗', en: 'Rainy window', trigger: 'rainy window style', strength: 1 },
      { id: 'sunsetblur', file: 'krea2_sunsetblur.safetensors', zh: '暮色残影', en: 'Sunset blur', trigger: 'ethereal motion blur style', strength: 1 },
      { id: 'vintagetarot', file: 'krea2_vintagetarot.safetensors', zh: '复古塔罗', en: 'Vintage tarot', trigger: 'vintage tarot style', strength: 1 },
      { id: 'kidsdrawing', file: 'krea2_kidsdrawing.safetensors', zh: '童趣速写', en: 'Kids drawing', trigger: 'naive expressive sketch style', strength: 1 },
    ],
    referenceSteps: 8,
    pixelLoras: {
      32: 'k2-pixel32.safetensors',
      64: 'k2-pixel64.safetensors',
      128: 'k2-pixel128.safetensors',
    },
  },
]

/** Target sprite sizes the pixel-asset mode offers. */
export const PIXEL_TARGETS = [32, 64, 128, 256]

/**
 * Decide which presets the running ComfyUI can serve.
 * @param caps - capability snapshot.
 * @returns the presets annotated with availability and missing files.
 */
export function availableModels(caps) {
  return MODEL_PRESETS.map((preset) => {
    const missing = []
    if (!caps.gguf && preset.unet.endsWith('.gguf')) missing.push('UnetLoaderGGUF node')
    if (preset.unet.endsWith('.gguf')) {
      if (!caps.ggufUnets.includes(preset.unet)) missing.push(preset.unet)
    } else if (!caps.unets.includes(preset.unet)) {
      missing.push(preset.unet)
    }
    const clipList = preset.clipLoader === 'CLIPLoaderGGUF'
      ? caps.ggufClips
      : preset.clipLoader === 'DualCLIPLoaderGGUF' ? caps.dualGgufClips : caps.clips
    for (const file of preset.clipFiles) {
      if (!clipList.includes(file)) missing.push(file)
    }
    if (!caps.vaes.includes(preset.vae)) missing.push(preset.vae)
    const typeOk = !preset.clipType || caps.ggufClipTypes.includes(preset.clipType) || preset.arch === 'flux'
    if (!typeOk) missing.push(`CLIPLoader type ${preset.clipType}`)
    const referenceLoras = preset.referenceLoras === undefined ? null : Object.entries(preset.referenceLoras)
      .filter(([, file]) => caps.loras.includes(file))
      .map(([mode, file]) => ({ mode, file }))
    const referenceAvailable = referenceLoras !== null && referenceLoras.length > 0 && caps.reference
    const pixelAvailable = preset.pixelLoras !== undefined && caps.pixelRefiner
      && Object.values(preset.pixelLoras).every(file => caps.loras.includes(file))
    const styleLoras = (preset.styleLoras ?? []).map((entry) => ({
      ...entry,
      available: caps.loras.includes(entry.file),
    }))
    return {
      ...preset,
      styleLoras,
      available: missing.length === 0,
      missing,
      referenceLoras,
      referenceAvailable,
      pixelAvailable,
      pixelTargets: preset.pixelLoras === undefined ? [] : PIXEL_TARGETS,
    }
  })
}

/**
 * Pick the preset to use, honouring an explicit request.
 * @param caps - capability snapshot.
 * @param wanted - requested preset id.
 * @param fallback - configured preset id.
 * @returns the chosen preset.
 */
export function pickModel(caps, wanted, fallback) {
  const presets = availableModels(caps)
  const usable = presets.filter(preset => preset.available)
  const byId = id => usable.find(preset => preset.id === id)
  const chosen = byId(wanted) ?? byId(fallback) ?? usable[0]
  if (chosen === undefined) {
    const detail = presets.map(preset => `${preset.id}: missing ${preset.missing.join(', ')}`).join('; ')
    throw new Error(`no usable model set in ComfyUI (${detail})`)
  }
  return chosen
}

/**
 * Resolve a requested style LoRA against the chosen model preset.
 * @param models - chosen model preset.
 * @param id - requested LoRA id ('' or undefined means none).
 * @param strength - optional override for the preset strength.
 * @returns the LoRA record with an effective strength, or null.
 */
function pickStyleLora(models, id, strength) {
  if (typeof id !== 'string' || id === '') return null
  const entry = (models.styleLoras ?? []).find(lora => lora.id === id)
  if (entry === undefined) throw new Error(`未知的 LoRA 预设：${id}`)
  if (!entry.available) {
    throw new Error(`LoRA 文件未安装：${entry.file}，把它放进 models/loras 后重试`)
  }
  const wanted = Number(strength)
  const value = Number.isFinite(wanted) ? Math.min(1.5, Math.max(0, wanted)) : entry.strength
  return { ...entry, strength: value }
}

/** Read the pixel size out of a PNG buffer (the reference mode sizes follow the input image). */
function pngSize(bytes) {
  if (bytes.length < 24 || bytes.toString('ascii', 1, 4) !== 'PNG') return null
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
}

/** In-memory job table for panel generations. */
const jobs = new Map()

/** Persist jobs so a restarted Host can still answer a polling panel. */
let jobsFilePath = null
let jobsDirty = false

/**
 * Write the job table to disk (debounced through the caller).
 * @returns a promise that settles when the table is written.
 */
async function flushJobs() {
  if (jobsFilePath === null || !jobsDirty) return
  jobsDirty = false
  const rows = [...jobs.values()].map(job => ({
    id: job.id,
    status: job.status,
    progress: job.progress,
    promptId: job.promptId,
    startedAt: job.startedAt,
    result: job.result,
    error: job.error,
    meta: job.meta,
    reconciled: job.reconciled === true,
  }))
  try {
    await writeFile(jobsFilePath, JSON.stringify(rows.slice(-100)))
  } catch {
    // a missing gallery directory must not break generation
  }
}

/**
 * Restore the job table from disk.
 * @param path - jobs file.
 * @returns the restored records.
 */
async function loadJobs(path) {
  try {
    const parsed = JSON.parse(await readFile(path, 'utf8'))
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/**
 * Resolve the row config.
 * @param config - row config.
 * @returns resolved options.
 */
function resolveOptions(config) {
  const root = typeof config?.comfyRoot === 'string' && config.comfyRoot !== '' ? config.comfyRoot : DEFAULT_ROOT
  const url = typeof config?.comfyUrl === 'string' && config.comfyUrl !== '' ? config.comfyUrl : DEFAULT_URL
  return {
    url: url.replace(/\/+$/, ''),
    root,
    autoStart: config?.autoStart !== false,
    timeoutMs: Math.max(60_000, Number(config?.timeoutMs ?? 900_000)),
    provider: typeof config?.provider === 'string' && config.provider !== '' ? config.provider : 'deepseek-account',
    model: typeof config?.model === 'string' && config.model !== '' ? config.model : 'deepseek-flash',
    llmOptimize: config?.llmOptimize !== false,
    optimize: ['auto', 'llm', 'rules', 'off'].includes(config?.optimize) ? config.optimize : 'auto',
    model: typeof config?.defaultModel === 'string' && config.defaultModel !== '' ? config.defaultModel : 'krea2-turbo',
    steps: Math.min(60, Math.max(1, Number(config?.steps ?? 20))),
    guidance: Math.min(10, Math.max(0, Number(config?.guidance ?? 3.5))),
    width: Number(config?.width ?? 1024),
    height: Number(config?.height ?? 1024),
    saveToWorkspace: config?.saveToWorkspace !== false,
    workspaceSubdir: typeof config?.workspaceSubdir === 'string' && config.workspaceSubdir !== '' ? config.workspaceSubdir : 'generated',
    galleryDir: typeof config?.galleryDir === 'string' && config.galleryDir !== ''
      ? config.galleryDir
      : join(root, 'dsh-gallery'),
    models: {
      unet: config?.unetName,
      clip: config?.clipName,
      clipL: config?.clipLName,
      vae: config?.vaeName,
    },
  }
}

/**
 * Read a JSON request body.
 * @param req - node request.
 * @param limit - byte limit.
 * @returns parsed body.
 */
function readJson(req, limit = 8 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    let tooLarge = false
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > limit) {
        // Keep draining so the client receives a response instead of a reset
        // connection (which surfaces as an opaque "Failed to fetch").
        tooLarge = true
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (tooLarge) {
        const error = new Error(`请求体超过 ${Math.round(limit / 1024 / 1024)}MB 限制`)
        error.statusCode = 413
        reject(error)
        return
      }
      const text = Buffer.concat(chunks).toString('utf8')
      if (text.trim() === '') {
        resolve({})
        return
      }
      try {
        resolve(JSON.parse(text))
      } catch (error) {
        reject(new Error(`invalid JSON body: ${error instanceof Error ? error.message : String(error)}`))
      }
    })
    req.on('error', reject)
  })
}

/**
 * Write one JSON response.
 * @param res - node response.
 * @param status - HTTP status.
 * @param body - JSON body.
 */
function sendJson(res, status, body) {
  const payload = Buffer.from(JSON.stringify(body), 'utf8')
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': String(payload.length),
    'cache-control': 'no-store',
  })
  res.end(payload)
}

/**
 * Copy one reference image into ComfyUI's input folder.
 * @param options - resolved options.
 * @param bytes - image bytes.
 * @param extension - file extension without the dot.
 * @returns the file name LoadImage should open.
 */
async function stageReference(options, bytes, extension) {
  const dir = join(options.root, 'input')
  await mkdir(dir, { recursive: true })
  const name = `dsh-ref-${randomUUID()}.${extension}`
  await writeFile(join(dir, name), bytes)
  return name
}

/**
 * Decode a `data:image/...;base64,...` payload and stage it.
 * @param options - resolved options.
 * @param dataUrl - the data URL.
 * @returns the staged file name.
 */
async function stageReferenceDataUrl(options, dataUrl) {
  const match = /^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/s.exec(String(dataUrl ?? ''))
  if (match === null) throw new Error('reference must be a base64 PNG, JPEG or WebP image')
  const extension = match[1] === 'jpeg' || match[1] === 'jpg' ? 'jpg' : match[1]
  return stageReference(options, Buffer.from(match[2], 'base64'), extension)
}

/**
 * Ensure ComfyUI is answering, starting it when configured to.
 * @param options - resolved options.
 * @returns the capabilities snapshot.
 */
async function ensureServer(options) {
  let stats = await probe(options.url)
  if (stats === null) {
    if (!options.autoStart) throw new Error(`ComfyUI is not running at ${options.url}`)
    await startServer(options.root, options.url)
    stats = await probe(options.url)
    if (stats === null) throw new Error(`ComfyUI did not come up at ${options.url}`)
  }
  return capabilities(options.url)
}

/**
 * Run one generation end to end.
 * @param ctx - plugin context.
 * @param options - resolved options.
 * @param request - a validated request.
 * @param onProgress - optional progress callback.
 * @returns the result record.
 */
export async function generateImage(ctx, options, request, onProgress, onQueued) {
  const caps = await ensureServer(options)
  const chosen = pickModel(caps, request.model, options.model)
  const size = SIZES.includes(request.size) ? request.size : `${options.width}x${options.height}`
  const [width, height] = size.split('x').map(Number)
  const seed = Number.isInteger(request.seed) && request.seed >= 0 ? request.seed : Math.floor(Math.random() * 2 ** 31)
  // The panel may already have an edited, optimized prompt; use it verbatim.
  const preset = typeof request.optimized === 'string' ? request.optimized.trim() : ''
  const optimized = preset !== ''
    ? { prompt: preset, mode: 'preset', style: request.style ?? STYLES[0].id }
    : await optimize(ctx, options, request.prompt, {
        mode: request.optimizeMode ?? options.optimize,
        style: request.style,
        artist: request.artist,
        width,
        height,
      })
  // A style LoRA also contributes its official trigger phrase to the positive prompt.
  const styleLora = pickStyleLora(chosen, request.lora, request.loraStrength)
  const basePrompt = request.optimize === false ? String(request.prompt).trim() : optimized.prompt
  const finalPrompt = styleLora === null ? basePrompt : `${basePrompt}, ${styleLora.trigger}`
  const steps = Math.min(60, Math.max(1, Number(request.steps ?? chosen.steps)))
  const guidance = Math.min(10, Math.max(0, Number(request.guidance ?? chosen.guidance)))
  // Pixel-asset mode: 1024px LoRA render, then a true small sprite out of the refiner.
  let pixelInfo = null
  if (request.pixel !== undefined && request.pixel !== null) {
    const target = PIXEL_TARGETS.includes(Number(request.pixel.target)) ? Number(request.pixel.target) : 64
    if (!chosen.pixelAvailable) throw new Error('像素资产模式需要 k2-pixel LoRA 和 Krea2PixelArtRefiner 节点')
    const loraKey = target >= 128 ? 128 : target >= 64 ? 64 : 32
    pixelInfo = {
      target,
      colors: Math.min(256, Math.max(2, Number(request.pixel.colors ?? 24))),
      lora: chosen.pixelLoras[loraKey],
    }
  }

  // A reference image switches the graph to the Krea 2 edit path; the output
  // size then follows the (Kontext-scaled) reference instead of the size picker.
  let referenceName = null
  let referenceLora = null
  if (request.reference !== undefined && request.reference !== null) {
    if (!chosen.referenceAvailable) {
      throw new Error('reference images need the Krea 2 edit nodes and an edit LoRA in models/loras')
    }
    const mode = request.reference.mode === 'style' ? 'style' : 'identity'
    const entry = chosen.referenceLoras.find(lora => lora.mode === mode) ?? chosen.referenceLoras[0]
    referenceLora = entry.file
    if (typeof request.reference.dataUrl === 'string') {
      referenceName = await stageReferenceDataUrl(options, request.reference.dataUrl)
    } else if (typeof request.reference.path === 'string') {
      const bytes = await readFile(request.reference.path)
      const extension = /\.(png|jpg|jpeg|webp)$/i.exec(request.reference.path)?.[1]?.toLowerCase() ?? 'png'
      referenceName = await stageReference(options, bytes, extension === 'jpeg' ? 'jpg' : extension)
    } else {
      throw new Error('reference needs either an uploaded image or a local path')
    }
  }

  const graph = pixelInfo !== null
    ? buildPixelWorkflow(chosen, {
        prompt: finalPrompt,
        seed,
        steps,
        pixelLora: pixelInfo.lora,
        target: pixelInfo.target,
        colors: pixelInfo.colors,
      })
    : referenceName === null
    ? buildWorkflow(chosen, {
        prompt: finalPrompt,
        width,
        height,
        steps,
        guidance,
        seed,
        styleLora: styleLora === null ? undefined : styleLora.file,
        styleLoraStrength: styleLora === null ? undefined : styleLora.strength,
      })
    : buildReferenceWorkflow(chosen, {
        prompt: finalPrompt,
        seed,
        steps: request.steps === undefined ? (chosen.referenceSteps ?? steps) : steps,
        referenceFile: referenceName,
        referenceLora,
        referenceStrength: request.reference?.strength ?? 1,
        // `followReference: false` means the user picked an explicit size.
        followReference: request.reference?.follow !== false,
        width,
        height,
      })

  onProgress?.({ state: 'queued' })
  const queued = await postJson(`${options.url}/prompt`, { prompt: graph }, 60_000)
  const promptId = queued.prompt_id
  if (typeof promptId !== 'string') throw new Error('ComfyUI did not return a prompt id')
  const jobMeta = {
    prompt: String(request.prompt).trim(),
    optimized: finalPrompt,
    optimizeMode: request.optimize === false ? 'off' : optimized.mode,
    style: optimized.style,
    artist: optimized.artist ?? null,
    lora: styleLora === null
      ? null
      : { id: styleLora.id, file: styleLora.file, label: styleLora.zh, trigger: styleLora.trigger, strength: styleLora.strength },
    seed,
    steps,
    guidance,
    width,
    height,
    model: chosen.unet,
    modelId: chosen.id,
    modelLabel: chosen.label,
  }
  onQueued?.(promptId, jobMeta)
  const entry = await waitForPrompt(options.url, promptId, onProgress, options.timeoutMs)
  const image = pixelInfo === null ? firstImage(entry) : firstImage(entry, PIXEL_SPRITE_NODE)
  const bytes = await fetchImage(options.url, image)

  // Pixel jobs additionally carry a block-expanded preview of the same collapsed
  // grid; it is what the gallery/chat display, while `bytes` stays the real asset.
  let previewBytes = null
  if (pixelInfo !== null) {
    const measured = pngSize(bytes)
    const width = measured === null ? pixelInfo.target : measured.width
    const height = measured === null ? pixelInfo.target : measured.height
    // The whole point of this mode is a true sprite: refuse to store anything else.
    if (width > pixelInfo.target || height > pixelInfo.target) {
      throw new Error(`像素折叠未生效：收到 ${width}×${height}，期望不超过 ${pixelInfo.target}×${pixelInfo.target}`)
    }
    jobMeta.width = width
    jobMeta.height = height
    jobMeta.pixel = { target: pixelInfo.target, colors: pixelInfo.colors, lora: pixelInfo.lora }
    const preview = entry.outputs?.[PIXEL_PREVIEW_NODE]?.images?.[0]
    if (preview !== undefined) {
      previewBytes = await fetchImage(options.url, preview).catch(() => null)
      if (previewBytes !== null) jobMeta.pixel.preview = true
    }
  }
  if (referenceName !== null) {
    const measured = pngSize(bytes)
    jobMeta.width = measured === null ? jobMeta.width : measured.width
    jobMeta.height = measured === null ? jobMeta.height : measured.height
    jobMeta.referenceMode = request.reference?.mode === 'style' ? 'style' : 'identity'
    jobMeta.referenceFile = referenceName
    jobMeta.referenceLora = referenceLora
  }
  const meta = jobMeta
  if (typeof promptId === 'string') meta.promptId = promptId
  const stored = await gallery.add(options.galleryDir, bytes, {
    ...meta,
    previewBytes: previewBytes === null ? undefined : previewBytes,
  })

  // Pixel sprites are tiny: hand the chat the block-expanded preview, keep the
  // sprite itself as the gallery/workspace asset.
  const shown = previewBytes === null ? bytes : previewBytes
  let attachment
  const store = ctx.get('attachments')
  if (store !== undefined) {
    try {
      attachment = await store.saveImage({ data: new Uint8Array(shown), mediaType: 'image/png', name: 'comfyui' })
    } catch {
      attachment = undefined
    }
  }

  let workspacePath = null
  if (options.saveToWorkspace && request.agent !== undefined) {
    const working = ctx.get('workingDirectory')
    if (working !== undefined) {
      try {
        const cwd = await working.ensure(request.agent, request.signal)
        if (typeof cwd === 'string' && cwd !== '') {
          const dir = join(cwd, options.workspaceSubdir)
          await mkdir(dir, { recursive: true })
          const file = join(dir, stored.name)
          await writeFile(file, bytes)
          await writeFile(join(dir, '.gitignore'), '*\n', { flag: 'wx' }).catch(() => {})
          workspacePath = file
        }
      } catch {
        workspacePath = null
      }
    }
  }

  return { stored, attachment, workspacePath, bytes, promptId, meta, model: chosen }
}


/**
 * Finish a job whose panel went away, by asking ComfyUI for its history.
 * @param ctx - plugin context.
 * @param options - resolved options.
 * @param job - the stored job record.
 */
async function reconcile(ctx, options, job) {
  if (job.reconciled === true || job.status === 'done') return
  const history = await getJson(`${options.url}/history/${job.promptId}`, 10_000).catch(() => null)
  const entry = history?.[job.promptId]
  if (entry === undefined) return
  const pixel = job.meta?.pixel ?? undefined
  const image = pixel === undefined ? firstImage(entry) : firstImage(entry, PIXEL_SPRITE_NODE)
  const bytes = await fetchImage(options.url, image)
  let previewBytes = null
  if (pixel !== undefined) {
    const preview = entry.outputs?.[PIXEL_PREVIEW_NODE]?.images?.[0]
    if (preview !== undefined) previewBytes = await fetchImage(options.url, preview).catch(() => null)
  }
  const meta = { ...(job.meta ?? {}), promptId: job.promptId }
  job.reconciled = true
  const stored = await gallery.add(options.galleryDir, bytes, {
    ...meta,
    previewBytes: previewBytes === null ? undefined : previewBytes,
  })
  job.status = 'done'
  job.progress = { value: job.progress?.max ?? 1, max: job.progress?.max ?? 1, percent: 100 }
  job.result = {
    name: stored.name,
    url: `/comfyui/image?name=${encodeURIComponent(stored.name)}`,
    previewUrl: stored.preview === undefined ? null : `/comfyui/image?name=${encodeURIComponent(stored.preview)}`,
    ...meta,
  }
  jobsDirty = true
  void flushJobs()
}

/** Register the tool, the routes, and the prompt guidance. */
export function apply(ctx, config) {
  const options = resolveOptions(config)
  jobsFilePath = join(options.galleryDir, 'jobs.json')
  void loadJobs(jobsFilePath).then((rows) => {
    for (const row of rows) if (row?.id !== undefined && !jobs.has(row.id)) jobs.set(row.id, row)
  })

  ctx.systemPrompt.section({
    name: 'tool:comfyui',
    order: 2375,
    text: 'Images through ComfyUI: image_generate draws with the local ComfyUI (FLUX.1 Krea by default), '
      + 'optimizes the prompt for that model first, and returns the picture in the chat. Pass the user\'s idea, '
      + 'not a translated prompt; the optimizer handles wording. Generations also land in the plugin\'s gallery panel.',
  })

  ctx.tools.register({
    name: 'image_generate',
    description:
      'Generate an image with the local ComfyUI (FLUX.1 Krea). The prompt is optimized for that model unless '
      + 'optimize is false. The picture is returned in the chat, saved to the gallery, and copied into the '
      + 'workspace generated/ folder.',
    parameters: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'What to draw, in the user\'s own words (any language).' },
        size: { type: 'string', enum: SIZES, description: 'Composition size.' },
        steps: { type: 'number', description: 'Sampling steps, 1-60. Default 20.' },
        seed: { type: 'number', description: 'Fixed seed for reproduction; omit for random.' },
        guidance: { type: 'number', description: 'Flux guidance, default 3.5.' },
        style: { type: 'string', enum: STYLES.map(style => style.id), description: 'Preset: artist-style illustration, or pixel game asset.' },
        model: { type: 'string', enum: MODEL_PRESETS.map(preset => preset.id), description: 'Which installed model set to render with.' },
        artist: {
          type: 'string',
          enum: ARTISTS.map(artist => artist.id),
          description: 'Artist reference for the illustration preset (新海诚 / 吉卜力 / 米山舞 …). Omit for a generic illustration.',
        },
        lora: {
          type: 'string',
          enum: [...new Set(MODEL_PRESETS.flatMap(preset => (preset.styleLoras ?? []).map(lora => lora.id)))],
          description: 'Krea 2 style LoRA (retroanime / softwatercolor / darkbrush …). Its trigger word is added to the prompt automatically.',
        },
        lora_strength: { type: 'number', description: 'Style LoRA strength, 0-1.5 (default: the LoRA preset value, usually 1).' },
        pixel_asset: { type: 'boolean', description: 'Render a game-art pixel sprite instead of a regular image.' },
        asset_size: { type: 'number', enum: PIXEL_TARGETS, description: 'Sprite edge in pixels for pixel_asset mode (32/64/128/256).' },
        palette_colors: { type: 'number', description: 'Palette size for pixel_asset mode, 2-256 (default 24).' },
        reference: { type: 'string', description: 'Local path to a reference image: a character/persona sheet or a style reference.' },
        reference_mode: {
          type: 'string',
          enum: ['identity', 'style'],
          description: 'How the reference is used: identity keeps the character, style copies the look.',
        },
        optimize: { type: 'boolean', description: 'Optimize the prompt first; default true.' },
      },
      required: ['prompt'],
      additionalProperties: false,
    },
    output: {
      // Permissive like the CUA tool: the value carries attachment refs owned by
      // the attachment service, and render projects them into image blocks.
      schema: {},
      render: (_args, value) => {
        const blocks = [{ type: 'text', text: String(value?.text ?? '') }]
        for (const image of Array.isArray(value?.images) ? value.images : []) {
          if (image?.attachment !== undefined && image?.attachment !== null) {
            blocks.push({ type: 'image', attachment: image.attachment })
          }
        }
        return blocks
      },
    },
    execute: async (args, exec) => {
      const prompt = typeof args?.prompt === 'string' ? args.prompt.trim() : ''
      if (prompt === '') throw new Error('image_generate needs a prompt')
      const result = await generateImage(ctx, options, {
        prompt,
        size: args?.size,
        steps: args?.steps,
        seed: args?.seed,
        guidance: args?.guidance,
        style: args?.style,
        artist: args?.artist,
        lora: args?.lora,
        loraStrength: args?.lora_strength,
        model: args?.model,
        pixel: args?.pixel_asset === true
          ? { target: args?.asset_size ?? 64, colors: args?.palette_colors ?? 24 }
          : undefined,
        reference: typeof args?.reference === 'string' && args.reference !== ''
          ? { path: args.reference, mode: args?.reference_mode }
          : undefined,
        optimize: args?.optimize !== false,
        agent: exec?.agent,
        signal: exec?.signal,
      })
      const lines = [
        `Generated with ${result.meta.modelLabel ?? result.meta.model} — ${result.meta.width}×${result.meta.height}, ${result.meta.steps} steps, `
          + `seed ${result.meta.seed}, guidance ${result.meta.guidance}.`,
      ]
      if (result.meta.optimizeMode !== 'off') lines.push(`Prompt (${result.meta.optimizeMode}): ${result.meta.optimized}`)
      if (result.meta.artist !== undefined && result.meta.artist !== null) {
        const artist = artistOf(result.meta.artist)
        lines.push(`Artist reference: ${artist === null ? result.meta.artist : `${artist.zh} (${artist.en})`}`)
      }
      if (result.meta.lora !== undefined && result.meta.lora !== null) {
        lines.push(`Style LoRA: ${result.meta.lora.label} (${result.meta.lora.file}, strength ${result.meta.lora.strength}, trigger "${result.meta.lora.trigger}")`)
      }
      if (result.meta.pixel !== undefined) {
        lines.push(`Pixel asset: ${result.meta.pixel.target}×${result.meta.pixel.target}, ${result.meta.pixel.colors} colours (${result.meta.pixel.lora})`)
        lines.push(`The chat image is a block-expanded preview; the true sprite is ${result.stored.name}.`)
      }
      if (result.meta.referenceMode !== undefined) {
        lines.push(`Reference: ${result.meta.referenceMode} (${result.meta.referenceLora})`)
      }
      if (result.workspacePath !== null) lines.push(`Saved to ${result.workspacePath}`)
      lines.push(`Gallery entry: ${result.stored.name}`)
      return {
        text: lines.join('\n'),
        images: result.attachment === undefined ? [] : [{ attachment: result.attachment }],
      }
    },
  })

  ctx.inject(['webServer'], (child) => {
    const route = (path, handler) => child.effect(() => child.webServer.register({
      kind: 'exact',
      path,
      handler,
    }), `dsh-comfyui: ${path}`)

    route('/comfyui/status', (req, res) => {
      void (async () => {
        const stats = await probe(options.url)
        let models = []
        if (stats !== null) {
          try {
            models = availableModels(await capabilities(options.url))
          } catch {
            models = []
          }
        }
        const activeModel = models.find(preset => preset.available && preset.id === options.model)
          ?? models.find(preset => preset.available)
          ?? null
        const entries = await gallery.list(options.galleryDir)
        const body = {
          online: stats !== null,
          url: options.url,
          root: options.root,
          autoStart: options.autoStart,
          galleryDir: options.galleryDir,
          sizes: SIZES,
          styles: STYLES,
          artists: ARTISTS,
          defaults: {
            size: `${options.width}x${options.height}`,
            // Sampling defaults follow the installed model (Krea 2 Turbo: 8 steps, CFG 1),
            // because the generic config default (20 steps / 3.5) is wrong for a turbo model.
            steps: activeModel?.steps ?? options.steps,
            guidance: activeModel?.guidance ?? options.guidance,
            guidanceSupported: activeModel?.guidanceSupported !== false,
            optimize: options.optimize,
          },
          models,
          activeModel: activeModel?.id ?? null,
          galleryCount: entries.length,
        }
        const payload = Buffer.from(JSON.stringify(body), 'utf8')
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'content-length': String(payload.length), 'cache-control': 'no-store' })
        res.end(req.method === 'HEAD' ? undefined : payload)
      })().catch((error) => {
        if (!res.headersSent) sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) })
      })
    })

    route('/comfyui/start', (req, res) => {
      void (async () => {
        try {
          await startServer(options.root, options.url)
          sendJson(res, 200, { online: true })
        } catch (error) {
          sendJson(res, 502, { error: error instanceof Error ? error.message : String(error) })
        }
      })()
    })

    route('/comfyui/optimize', (req, res) => {
      void (async () => {
        try {
          const body = await readJson(req)
          const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : ''
          if (prompt === '') throw new Error('prompt is required')
          const [width, height] = (SIZES.includes(body.size) ? body.size : `${options.width}x${options.height}`).split('x').map(Number)
          const result = await optimize(ctx, options, prompt, {
            mode: body.mode ?? options.optimize,
            style: body.style,
            artist: body.artist,
            width,
            height,
          })
          sendJson(res, 200, { original: prompt, ...result, optimized: result.prompt })
        } catch (error) {
          sendJson(res, 400, { error: error instanceof Error ? error.message : String(error) })
        }
      })()
    })

    route('/comfyui/generate', (req, res) => {
      void (async () => {
        try {
          const body = await readJson(req, 40 * 1024 * 1024)
          const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : ''
          if (prompt === '') throw new Error('prompt is required')
          const jobId = randomUUID()
          const job = { id: jobId, status: 'queued', startedAt: Date.now(), progress: null }
          jobs.set(jobId, job)
          sendJson(res, 202, { jobId })
          void generateImage(ctx, options, {
            prompt,
            optimized: body.optimized,
            size: body.size,
            steps: body.steps,
            seed: body.seed,
            guidance: body.guidance,
            style: body.style,
            artist: body.artist,
            lora: body.lora,
            loraStrength: body.loraStrength,
            model: body.model,
            pixel: body.pixel,
            reference: body.reference,
            optimize: body.optimize !== false,
            optimizeMode: body.mode,
          }, (progress) => {
            if (progress.state !== undefined) job.status = progress.state
            if (typeof progress.percent === 'number') {
              job.progress = { value: progress.value, max: progress.max, percent: progress.percent }
              jobsDirty = true
            }
          }, (promptId, meta) => {
            job.promptId = promptId
            job.meta = meta
            jobsDirty = true
            void flushJobs()
          }).then(async (result) => {
            job.status = 'done'
            jobsDirty = true
            void flushJobs()
            job.result = {
              name: result.stored.name,
              url: `/comfyui/image?name=${encodeURIComponent(result.stored.name)}`,
              previewUrl: result.stored.preview === undefined
                ? null
                : `/comfyui/image?name=${encodeURIComponent(result.stored.preview)}`,
              prompt: result.meta.prompt,
              optimized: result.meta.optimized,
              optimizeMode: result.meta.optimizeMode,
              seed: result.meta.seed,
              steps: result.meta.steps,
              guidance: result.meta.guidance,
              width: result.meta.width,
              height: result.meta.height,
              model: result.meta.model,
              modelId: result.meta.modelId,
              modelLabel: result.meta.modelLabel,
              pixel: result.meta.pixel ?? null,
              artist: result.meta.artist ?? null,
              lora: result.meta.lora ?? null,
              referenceMode: result.meta.referenceMode ?? null,
              referenceLora: result.meta.referenceLora ?? null,
            }
          }).catch((error) => {
            job.status = 'error'
            job.error = error instanceof Error ? error.message : String(error)
            jobsDirty = true
            void flushJobs()
          })
        } catch (error) {
          sendJson(res, error.statusCode ?? 400, { error: error instanceof Error ? error.message : String(error) })
        }
      })()
    })

    route('/comfyui/job', (req, res) => {
      void (async () => {
        const url = new URL(req.url ?? '/comfyui/job', 'http://127.0.0.1')
        const id = url.searchParams.get('id') ?? ''
        let job = jobs.get(id)
        if (job === undefined) {
          const rows = await loadJobs(join(options.galleryDir, 'jobs.json'))
          const restored = rows.find(row => row.id === id)
          if (restored === undefined) {
            // The app was restarted and this job was never persisted: the panel
            // must stop waiting instead of spinning forever.
            sendJson(res, 404, { lost: true, error: 'job lost' })
            return
          }
          jobs.set(restored.id, restored)
          job = restored
        }
        if ((job.status === 'queued' || job.status === 'running') && job.promptId === undefined) {
          // Nothing queued with ComfyUI yet: fail fast when the server is gone.
          if (await probe(options.url) === null) {
            job.offlineChecks = (job.offlineChecks ?? 0) + 1
            if (job.offlineChecks >= 3) {
              job.status = 'error'
              job.error = 'ComfyUI is not reachable; start it and generate again'
              jobsDirty = true
              void flushJobs()
            }
          } else {
            job.offlineChecks = 0
          }
        }
        if ((job.status === 'queued' || job.status === 'running') && job.promptId !== undefined && job.promptId !== null) {
          try {
            await reconcile(ctx, options, job)
          } catch {
            // ComfyUI may still be offline; report the last known state.
          }
          if (job.status === 'queued' || job.status === 'running') {
            const state = await promptState(options.url, job.promptId).catch(() => null)
            if (state !== null && !state.inQueue && !state.inHistory) {
              job.missingChecks = (job.missingChecks ?? 0) + 1
              if (job.missingChecks >= 3) {
                job.status = 'error'
                job.error = 'ComfyUI 丢失了这个任务（服务重启过），请重新生成 / lost after a ComfyUI restart'
                jobsDirty = true
                void flushJobs()
              }
            } else {
              job.missingChecks = 0
            }
          }
        }
        sendJson(res, 200, {
          id: job.id,
          status: job.status,
          progress: job.progress ?? null,
          elapsedMs: job.startedAt !== undefined ? Date.now() - job.startedAt : null,
          result: job.result ?? null,
          error: job.error ?? null,
        })
      })()
    })

    route('/comfyui/cancel', (req, res) => {
      void (async () => {
        const url = new URL(req.url ?? '/comfyui/cancel', 'http://127.0.0.1')
        const job = jobs.get(url.searchParams.get('id') ?? '')
        if (job === undefined) {
          sendJson(res, 404, { error: 'unknown job' })
          return
        }
        if (typeof job.promptId === 'string' && job.promptId !== '') {
          await cancelPrompt(options.url, job.promptId).catch(() => {})
        }
        job.status = 'error'
        job.error = '已取消 / cancelled'
        jobsDirty = true
        void flushJobs()
        sendJson(res, 200, { cancelled: true })
      })()
    })

    route('/comfyui/gallery/delete', (req, res) => {
      void (async () => {
        try {
          const url = new URL(req.url ?? '/comfyui/gallery/delete', 'http://127.0.0.1')
          let name = url.searchParams.get('name')
          if (name === null && req.method === 'POST') {
            const body = await readJson(req)
            name = typeof body.name === 'string' ? body.name : null
          }
          const deleted = await gallery.remove(options.galleryDir, name ?? '')
          if (!deleted) {
            sendJson(res, 404, { error: 'image not found' })
            return
          }
          sendJson(res, 200, { deleted: true, name })
        } catch (error) {
          sendJson(res, 400, { error: error instanceof Error ? error.message : String(error) })
        }
      })()
    })

    route('/comfyui/gallery', (req, res) => {
      void (async () => {
        const entries = await gallery.list(options.galleryDir)
        sendJson(res, 200, { entries })
      })()
    })

    route('/comfyui/image', (req, res) => {
      void (async () => {
        const url = new URL(req.url ?? '/comfyui/image', 'http://127.0.0.1')
        const bytes = await gallery.read(options.galleryDir, url.searchParams.get('name') ?? '')
        if (bytes === null) {
          sendJson(res, 404, { error: 'not found' })
          return
        }
        res.writeHead(200, {
          'content-type': 'image/png',
          'content-length': String(bytes.length),
          'cache-control': 'public, max-age=31536000, immutable',
        })
        res.end(bytes)
      })()
    })
  })

  // Prune finished jobs once they are old enough that no panel can still poll.
  const sweeper = setInterval(() => {
    const cutoff = Date.now() - 3_600_000
    for (const [id, job] of jobs) if (job.startedAt < cutoff) jobs.delete(id)
  }, 600_000)
  sweeper.unref?.()
}

export { getJson }
