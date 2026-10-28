/**
 * ComfyUI HTTP client and lifecycle.
 *
 * The plugin talks to a local ComfyUI over its HTTP API: `/system_stats` for
 * health, `/object_info` to discover which loaders and models exist, `/prompt`
 * to queue, `/history/<id>` to poll, and `/view` to fetch the result bytes.
 * When nothing answers and `autoStart` is on, it spawns the configured launcher
 * and waits for the server to come up.
 *
 * @module dsh-comfyui/comfy
 */

import { execFile, spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

/** Default ComfyUI location used by this machine's setup. */
export const DEFAULT_ROOT = join(process.env.HOME ?? '/tmp', 'tools', 'ComfyUI')
export const DEFAULT_URL = 'http://127.0.0.1:8188'

/**
 * GET a JSON endpoint with a deadline.
 * @param url - absolute URL.
 * @param timeoutMs - deadline.
 * @returns parsed JSON.
 */
export async function getJson(url, timeoutMs = 5000) {
  const controller = new AbortController()
  const timer = setTimeout(() => { controller.abort() }, timeoutMs)
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { accept: 'application/json' } })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return await response.json()
  } finally {
    clearTimeout(timer)
  }
}

/**
 * POST a JSON body with a deadline.
 * @param url - absolute URL.
 * @param body - JSON body.
 * @param timeoutMs - deadline.
 * @returns parsed JSON.
 */
export async function postJson(url, body, timeoutMs = 30_000) {
  const controller = new AbortController()
  const timer = setTimeout(() => { controller.abort() }, timeoutMs)
  try {
    const response = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    const text = await response.text()
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${text.slice(0, 300)}`)
    return text === '' ? {} : JSON.parse(text)
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Fetch raw bytes (an image from /view).
 * @param url - absolute URL.
 * @param timeoutMs - deadline.
 * @returns the bytes.
 */
export async function getBytes(url, timeoutMs = 30_000) {
  const controller = new AbortController()
  const timer = setTimeout(() => { controller.abort() }, timeoutMs)
  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return Buffer.from(await response.arrayBuffer())
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Probe the server.
 * @param baseUrl - ComfyUI base URL.
 * @param timeoutMs - deadline.
 * @returns the system stats, or null when offline.
 */
export async function probe(baseUrl, timeoutMs = 3000) {
  try {
    const stats = await getJson(`${baseUrl}/system_stats`, timeoutMs)
    return stats
  } catch {
    return null
  }
}

/** One owned server process, shared by every call in this plugin instance. */
let serverProcess = null
let startPromise = null

/**
 * Start ComfyUI with its launcher and wait for it to answer.
 * @param root - ComfyUI directory.
 * @param baseUrl - expected base URL.
 * @param timeoutMs - how long to wait for readiness.
 * @returns true when the server answers.
 */
export function startServer(root, baseUrl, timeoutMs = 180_000) {
  if (startPromise !== null) return startPromise
  startPromise = (async () => {
    if (await probe(baseUrl, 2000) !== null) return true
    const launcher = join(root, 'run.sh')
    if (!existsSync(launcher)) throw new Error(`no launcher at ${launcher}`)
    serverProcess = spawn('/bin/sh', [launcher], {
      cwd: root,
      detached: true,
      stdio: 'ignore',
      env: { ...process.env },
    })
    serverProcess.unref()
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 3000))
      if (await probe(baseUrl, 3000) !== null) return true
    }
    throw new Error(`ComfyUI did not answer within ${Math.round(timeoutMs / 1000)}s`)
  })().finally(() => { startPromise = null })
  return startPromise
}

/**
 * Follow ComfyUI's websocket progress events for one prompt.
 *
 * ComfyUI reports step progress only over `/ws`; the HTTP API has no progress
 * field, so the panel would otherwise show an indeterminate bar.
 *
 * @param baseUrl - ComfyUI base URL.
 * @param promptId - the queued prompt id.
 * @param onProgress - called with { state, value, max, percent }.
 * @returns a disposer that closes the socket.
 */
export function watchProgress(baseUrl, promptId, onProgress) {
  if (typeof WebSocket === 'undefined') return () => {}
  const clientId = randomUUID()
  const url = `${baseUrl.replace(/^http/, 'ws')}/ws?clientId=${clientId}`
  let socket
  try {
    socket = new WebSocket(url)
  } catch {
    return () => {}
  }
  const handle = (event) => {
    // A throwing listener must never take the Host process down: the socket
    // callback runs outside any request scope, so an uncaught error is fatal.
    try {
      dispatch(event)
    } catch {
      // ignore: progress reporting is best-effort
    }
  }
  const dispatch = (event) => {
    if (typeof event.data !== 'string') return
    let message
    try {
      message = JSON.parse(event.data)
    } catch {
      return
    }
    // ComfyUI announces execution before the first step; without this the panel
    // would say "queued" for the whole model-load period.
    if (message?.type === 'execution_start' && message.data?.prompt_id === promptId) {
      onProgress?.({ state: 'running' })
      return
    }
    if (message?.type !== 'progress') return
    const data = message.data
    if (data?.prompt_id !== promptId || typeof data.value !== 'number' || typeof data.max !== 'number' || data.max <= 0) return
    onProgress?.({
      state: 'running',
      value: data.value,
      max: data.max,
      percent: Math.min(99, Math.round((data.value / data.max) * 100)),
    })
  }
  socket.addEventListener('message', handle)
  socket.addEventListener('error', () => {})
  return () => {
    try {
      socket.removeEventListener('message', handle)
      socket.close()
    } catch {
      // already closed
    }
  }
}

/**
 * Wait for a prompt to finish.
 * @param baseUrl - ComfyUI base URL.
 * @param promptId - the queued prompt id.
 * @param onProgress - called with {value, max} on each poll.
 * @param timeoutMs - deadline.
 * @returns the history entry.
 */
export async function waitForPrompt(baseUrl, promptId, onProgress, timeoutMs) {
  const report = typeof onProgress === 'function' ? onProgress : () => {}
  const stopWatching = watchProgress(baseUrl, promptId, report)
  try {
    return await pollHistory(baseUrl, promptId, report, timeoutMs)
  } finally {
    stopWatching()
  }
}

/**
 * Poll the history until the prompt finishes.
 * @param baseUrl - ComfyUI base URL.
 * @param promptId - the queued prompt id.
 * @param onProgress - progress callback.
 * @param timeoutMs - deadline.
 * @returns the history entry.
 */
async function pollHistory(baseUrl, promptId, onProgress, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  let unreachable = 0
  let missing = 0
  while (Date.now() < deadline) {
    const history = await getJson(`${baseUrl}/history/${promptId}`, 10_000).catch(() => null)
    if (history === null) {
      unreachable += 1
      if (unreachable >= 3) throw new Error('ComfyUI stopped responding; check that the server is still running')
    } else {
      unreachable = 0
    }
    const entry = history?.[promptId]
    if (entry !== undefined) {
      const status = entry.status ?? {}
      if (status.status_str === 'error') {
        const failure = (status.messages ?? []).find(message => message[0] === 'execution_error')
        const detail = failure?.[1]
        throw new Error(`${detail?.node_type ?? 'node'} failed: ${detail?.exception_message ?? 'unknown error'}`)
      }
      return entry
    }
    const queue = await getJson(`${baseUrl}/queue`, 5000).catch(() => null)
    if (queue !== null) {
      const running = (queue.queue_running ?? [])[0]
      const pending = (queue.queue_pending ?? []).find(job => job[1] === promptId)
      if (running !== undefined && running[1] === promptId) onProgress?.({ state: 'running' })
      if (pending !== undefined) onProgress?.({ state: 'queued' })
      // Neither queued nor finished and the server is up: the instance that
      // accepted this prompt was restarted, so stop waiting for it.
      if (running === undefined && pending === undefined) {
        missing += 1
        if (missing >= 4) {
          throw new Error('ComfyUI 丢失了这个任务（服务重启过），请重新生成 / ComfyUI lost this job after a restart')
        }
      } else {
        missing = 0
      }
    }
    await new Promise(resolve => setTimeout(resolve, 2000))
  }
  throw new Error('generation timed out')
}

/**
 * Ask ComfyUI whether it still tracks one prompt.
 *
 * A queued prompt disappears from both the queue and the history when the
 * server restarts, which is the fastest way to tell a lost job from a slow one.
 *
 * @param baseUrl - ComfyUI base URL.
 * @param promptId - the prompt id to look for.
 * @returns { inQueue, inHistory } or null when the server is unreachable.
 */
export async function promptState(baseUrl, promptId) {
  const queue = await getJson(`${baseUrl}/queue`, 8000).catch(() => null)
  if (queue === null) return null
  const inQueue = [...(queue.queue_running ?? []), ...(queue.queue_pending ?? [])]
    .some(item => Array.isArray(item) && item[1] === promptId)
  const history = await getJson(`${baseUrl}/history/${promptId}`, 8000).catch(() => null)
  return { inQueue, inHistory: history?.[promptId] !== undefined }
}

/**
 * Cancel one prompt: drop it from the queue and interrupt it if running.
 * @param baseUrl - ComfyUI base URL.
 * @param promptId - the prompt to cancel.
 */
export async function cancelPrompt(baseUrl, promptId) {
  await postJson(`${baseUrl}/queue`, { delete: [promptId] }, 10_000).catch(() => {})
  // A scoped interrupt only stops this prompt; a bodyless one would kill whatever
  // else ComfyUI happens to be rendering at the moment.
  await postJson(`${baseUrl}/interrupt`, { prompt_id: promptId }, 10_000).catch(() => {})
}

/**
 * Read which loader classes and model files exist.
 * @param baseUrl - ComfyUI base URL.
 * @returns a capability snapshot.
 */
export async function capabilities(baseUrl) {
  const info = await getJson(`${baseUrl}/object_info`, 20_000)
  const has = name => info[name] !== undefined
  const listOf = (node, field) => info[node]?.input?.required?.[field]?.[0] ?? []
  const ggufClips = has('CLIPLoaderGGUF') ? listOf('CLIPLoaderGGUF', 'clip_name') : []
  return {
    gguf: has('UnetLoaderGGUF'),
    unets: has('UNETLoader') ? listOf('UNETLoader', 'unet_name') : [],
    ggufUnets: has('UnetLoaderGGUF') ? listOf('UnetLoaderGGUF', 'unet_name') : [],
    clips: has('DualCLIPLoader') ? listOf('DualCLIPLoader', 'clip_name1') : [],
    ggufClips,
    dualGgufClips: has('DualCLIPLoaderGGUF') ? listOf('DualCLIPLoaderGGUF', 'clip_name1') : [],
    ggufClipTypes: has('CLIPLoaderGGUF') ? listOf('CLIPLoaderGGUF', 'type') : [],
    vaes: has('VAELoader') ? listOf('VAELoader', 'vae_name') : [],
    loras: has('LoraLoaderModelOnly') ? listOf('LoraLoaderModelOnly', 'lora_name') : [],
    reference: has('Krea2OstrisEditModelPatch')
      && has('TextEncodeKrea2OstrisEdit')
      && has('FluxKontextImageScale')
      && has('FluxKontextMultiReferenceLatentMethod')
      && has('GetImageSize'),
    pixelRefiner: has('Krea2PixelArtRefiner'),
    samplers: has('KSampler') ? listOf('KSampler', 'sampler_name') : [],
    schedulers: has('KSampler') ? listOf('KSampler', 'scheduler') : [],
  }
}

/**
 * Build the API-format workflow for one architecture.
 *
 * `flux` follows the official FLUX.1 Krea template: DualCLIPLoader(flux) with
 * T5 + CLIP-L, FluxGuidance, Euler/simple at CFG 1. `krea2` follows the Krea 2
 * architecture: a Qwen3-VL text encoder through CLIPLoader(type=krea2) and the
 * Qwen-Image VAE, sampled at CFG 1.
 *
 * @param models - { arch, unetLoader, unet, clipLoader, clipType, clipFiles, vae }.
 * @param request - prompt and sampling settings.
 * @returns the prompt graph.
 */
export function buildWorkflow(models, request) {
  // A style LoRA rides between the UNET loader and the sampler; the sampler then
  // reads the patched model. Node 11 stays unused otherwise.
  const loraNode = typeof request.styleLora === 'string' && request.styleLora !== ''
    ? {
        11: {
          class_type: 'LoraLoaderModelOnly',
          inputs: {
            model: ['1', 0],
            lora_name: request.styleLora,
            strength_model: Number.isFinite(request.styleLoraStrength) ? request.styleLoraStrength : 1,
          },
        },
      }
    : {}
  const modelRef = typeof request.styleLora === 'string' && request.styleLora !== '' ? ['11', 0] : ['1', 0]

  const sampler = (positive, negative) => ({
    class_type: 'KSampler',
    inputs: {
      model: modelRef,
      positive,
      negative,
      latent_image: ['7', 0],
      seed: request.seed,
      steps: request.steps,
      cfg: 1,
      sampler_name: 'euler',
      scheduler: 'simple',
      denoise: 1,
    },
  })

  if (models.arch === 'krea2') {
    return {
      1: { class_type: models.unetLoader, inputs: { unet_name: models.unet } },
      2: { class_type: models.clipLoader, inputs: { clip_name: models.clipFiles[0], type: models.clipType } },
      3: { class_type: 'VAELoader', inputs: { vae_name: models.vae } },
      4: { class_type: 'CLIPTextEncode', inputs: { text: request.prompt, clip: ['2', 0] } },
      6: { class_type: 'ConditioningZeroOut', inputs: { conditioning: ['4', 0] } },
      7: {
        class_type: 'EmptySD3LatentImage',
        inputs: { width: request.width, height: request.height, batch_size: 1 },
      },
      8: sampler(['4', 0], ['6', 0]),
      9: { class_type: 'VAEDecode', inputs: { samples: ['8', 0], vae: ['3', 0] } },
      10: { class_type: 'SaveImage', inputs: { images: ['9', 0], filename_prefix: 'dsh' } },
      ...loraNode,
    }
  }

  return {
    1: { class_type: models.unetLoader, inputs: { unet_name: models.unet } },
    2: {
      class_type: models.clipLoader,
      inputs: { clip_name1: models.clipFiles[0], clip_name2: models.clipFiles[1], type: models.clipType },
    },
    3: { class_type: 'VAELoader', inputs: { vae_name: models.vae } },
    4: { class_type: 'CLIPTextEncode', inputs: { text: request.prompt, clip: ['2', 0] } },
    5: { class_type: 'FluxGuidance', inputs: { conditioning: ['4', 0], guidance: request.guidance } },
    6: { class_type: 'ConditioningZeroOut', inputs: { conditioning: ['4', 0] } },
    7: {
      class_type: 'EmptySD3LatentImage',
      inputs: { width: request.width, height: request.height, batch_size: 1 },
    },
    8: sampler(['5', 0], ['6', 0]),
    9: { class_type: 'VAEDecode', inputs: { samples: ['8', 0], vae: ['3', 0] } },
    10: { class_type: 'SaveImage', inputs: { images: ['9', 0], filename_prefix: 'dsh' } },
    ...loraNode,
  }
}

/**
 * Build the reference-image (character/persona or style) workflow.
 *
 * Krea 2 edit LoRAs are wired through the Ostris edit nodes: the prompt and up
 * to three reference images are encoded together by the Qwen3-VL text encoder,
 * the encoded images also ride along as reference latents, and the output size
 * follows the (Kontext-scaled) reference image.
 *
 * @param models - chosen model preset (needs referenceLoras and edit nodes).
 * @param request - prompt, steps, seed, referenceFile, referenceLora, referenceStrength.
 * @returns the prompt graph.
 */
export function buildReferenceWorkflow(models, request) {
  return {
    1: { class_type: models.unetLoader, inputs: { unet_name: models.unet } },
    2: { class_type: 'Krea2OstrisEditModelPatch', inputs: { model: ['1', 0], kv_cache: false } },
    3: {
      class_type: 'LoraLoaderModelOnly',
      inputs: { model: ['2', 0], lora_name: request.referenceLora, strength_model: request.referenceStrength ?? 1 },
    },
    4: { class_type: 'VAELoader', inputs: { vae_name: models.vae } },
    5: { class_type: models.clipLoader, inputs: { clip_name: models.clipFiles[0], type: models.clipType } },
    6: { class_type: 'LoadImage', inputs: { image: request.referenceFile } },
    7: { class_type: 'FluxKontextImageScale', inputs: { image: ['6', 0] } },
    8: { class_type: 'GetImageSize', inputs: { image: ['7', 0] } },
    9: request.followReference === false && request.width > 0 && request.height > 0
      ? {
          class_type: 'EmptyLatentImage',
          inputs: { width: request.width, height: request.height, batch_size: 1 },
        }
      : {
          class_type: 'EmptyLatentImage',
          inputs: { width: ['8', 0], height: ['8', 1], batch_size: 1 },
        },
    10: {
      class_type: 'TextEncodeKrea2OstrisEdit',
      inputs: { clip: ['5', 0], prompt: request.prompt, vae: ['4', 0], image1: ['7', 0] },
    },
    11: {
      class_type: 'FluxKontextMultiReferenceLatentMethod',
      inputs: { conditioning: ['10', 0], reference_latents_method: 'index_timestep_zero' },
    },
    12: {
      class_type: 'TextEncodeKrea2OstrisEdit',
      inputs: { clip: ['5', 0], prompt: '', vae: ['4', 0], image1: ['7', 0] },
    },
    13: {
      class_type: 'FluxKontextMultiReferenceLatentMethod',
      inputs: { conditioning: ['12', 0], reference_latents_method: 'index_timestep_zero' },
    },
    14: {
      class_type: 'KSampler',
      inputs: {
        model: ['3', 0],
        positive: ['11', 0],
        negative: ['13', 0],
        latent_image: ['9', 0],
        seed: request.seed,
        steps: request.steps,
        cfg: 1,
        sampler_name: 'euler',
        scheduler: 'simple',
        denoise: 1,
      },
    },
    15: { class_type: 'VAEDecode', inputs: { samples: ['14', 0], vae: ['4', 0] } },
    16: { class_type: 'SaveImage', inputs: { images: ['15', 0], filename_prefix: 'dsh-ref' } },
  }
}

/**
 * Build the pixel-art asset workflow.
 *
 * The LoRA renders a 1024px sheet that already looks like pixel art; the
 * refiner then collapses it onto a small logical grid and reduces the palette,
 * so the saved PNG is a true 32/64/128/256 pixel sprite rather than a downscaled
 * illustration.
 *
 * @param models - chosen model preset (needs pixelLoras).
 * @param request - prompt, seed, steps, pixelLora, target, colors.
 * @returns the prompt graph.
 */
export function buildPixelWorkflow(models, request) {
  return {
    1: { class_type: models.unetLoader, inputs: { unet_name: models.unet } },
    2: { class_type: 'LoraLoaderModelOnly', inputs: { model: ['1', 0], lora_name: request.pixelLora, strength_model: 1 } },
    3: { class_type: 'VAELoader', inputs: { vae_name: models.vae } },
    4: { class_type: models.clipLoader, inputs: { clip_name: models.clipFiles[0], type: models.clipType } },
    5: { class_type: 'CLIPTextEncode', inputs: { text: request.prompt, clip: ['4', 0] } },
    6: { class_type: 'ConditioningZeroOut', inputs: { conditioning: ['5', 0] } },
    7: { class_type: 'EmptySD3LatentImage', inputs: { width: 1024, height: 1024, batch_size: 1 } },
    8: {
      class_type: 'KSampler',
      inputs: {
        model: ['2', 0],
        positive: ['5', 0],
        negative: ['6', 0],
        latent_image: ['7', 0],
        seed: request.seed,
        steps: request.steps,
        cfg: 1,
        sampler_name: 'euler',
        scheduler: 'simple',
        denoise: 1,
      },
    },
    9: { class_type: 'VAEDecode', inputs: { samples: ['8', 0], vae: ['3', 0] } },
    // The saved asset: the logical grid at its true size (32/64/128/256 px).
    10: {
      class_type: 'Krea2PixelArtRefiner',
      inputs: {
        image: ['9', 0],
        width: request.target,
        height: request.target,
        colors: request.colors,
        color_reduction_first: true,
        scale_to_original: false,
      },
    },
    11: { class_type: 'SaveImage', inputs: { images: ['10', 0], filename_prefix: 'dsh-pixel' } },
    // The same collapsed grid expanded back to the render size with hard blocks, so
    // the gallery and the chat can show something larger than 64 px. Derived from the
    // grid, NOT the sampler output — the raw 1024² render is never saved.
    12: {
      class_type: 'Krea2PixelArtRefiner',
      inputs: {
        image: ['9', 0],
        width: request.target,
        height: request.target,
        colors: request.colors,
        color_reduction_first: true,
        scale_to_original: true,
      },
    },
    13: { class_type: 'SaveImage', inputs: { images: ['12', 0], filename_prefix: 'dsh-pixel-preview' } },
  }
}

/**
 * Extract the first output image reference from a history entry.
 * @param entry - history entry.
 * @returns {filename, subfolder, type}.
 */
export function firstImage(entry, preferredNode) {
  const outputs = entry.outputs ?? {}
  if (preferredNode !== undefined && Array.isArray(outputs[preferredNode]?.images) && outputs[preferredNode].images.length > 0) {
    return outputs[preferredNode].images[0]
  }
  for (const output of Object.values(outputs)) {
    const images = output?.images
    if (Array.isArray(images) && images.length > 0) return images[0]
  }
  throw new Error('ComfyUI finished without producing an image')
}

/** Node ids the pixel-asset graph writes: the true sprite and its block preview. */
export const PIXEL_SPRITE_NODE = '11'
export const PIXEL_PREVIEW_NODE = '13'

/**
 * Download one output image.
 * @param baseUrl - ComfyUI base URL.
 * @param image - {filename, subfolder, type}.
 * @returns PNG bytes.
 */
export async function fetchImage(baseUrl, image) {
  const params = new URLSearchParams({
    filename: image.filename,
    subfolder: image.subfolder ?? '',
    type: image.type ?? 'output',
  })
  return getBytes(`${baseUrl}/view?${params.toString()}`, 60_000)
}

/** Expose the child-process handle for diagnostics. */
export function serverHandle() {
  return serverProcess
}

/** Kill a server this plugin started itself, when it is still ours. */
export async function stopOwnedServer() {
  if (serverProcess === null) return
  try {
    serverProcess.kill('SIGTERM')
  } catch {
    // already gone
  }
  serverProcess = null
}
