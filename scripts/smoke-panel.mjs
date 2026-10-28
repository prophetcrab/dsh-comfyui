/**
 * Headless smoke test for the ComfyUI panel client bundle.
 *
 * Loads ../client.js with a tiny React stand-in, renders the panel against a fake
 * host status, and asserts the preset card behaves: two tiles in one card, the
 * old look <select> gone, sprite options only for the pixel preset, reference
 * card hidden for sprites. Run from the package root:
 *
 *   node scripts/smoke-panel.mjs
 *   LEGACY_HOST=1 node scripts/smoke-panel.mjs   # against a pre-0.5 host payload
 */
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const target = process.env.CLIENT_JS ?? '../client.js'
const source = readFileSync(new URL(target, import.meta.url), 'utf8')

// ---- minimal React stand-in -------------------------------------------------
let hookIndex = 0
const hookState = []
const effectSlots = []
let pendingEffects = []
let rerender = false
const sameDeps = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => v === b[i])
const React = {
  createElement(type, props, ...children) {
    const merged = { ...(props ?? {}) }
    const flat = children.length === 0 ? undefined : children.length === 1 ? children[0] : children
    if (flat !== undefined) merged.children = flat
    return { $$el: { type, props: merged } }
  },
  useState(initial) {
    const i = hookIndex++
    if (!(i in hookState)) hookState[i] = typeof initial === 'function' ? initial() : initial
    return [hookState[i], (next) => {
      hookState[i] = typeof next === 'function' ? next(hookState[i]) : next
      rerender = true
    }]
  },
  useEffect(fn, deps) {
    const i = hookIndex++
    const previous = effectSlots[i]
    const changed = previous === undefined || deps === undefined || !sameDeps(previous.deps, deps)
    effectSlots[i] = { deps: deps ?? [] }
    if (changed) pendingEffects.push(fn)
  },
  useMemo(fn) { hookIndex++; return fn() },
  useCallback(fn) { hookIndex++; return fn },
  useRef(value) { hookIndex++; return { current: value ?? null } },
  useLayoutEffect() { hookIndex++ },
}

// ---- fake browser -----------------------------------------------------------
const store = new Map()
globalThis.document = {
  createElement: () => ({ dataset: {}, remove() {}, set textContent(value) { this._css = value }, get textContent() { return this._css } }),
  head: { appendChild() {} },
}
globalThis.window = {
  __ModuleLoader__: { load(definition) { globalThis.__definition = definition } },
  localStorage: {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, value),
  },
  setTimeout,
  clearTimeout,
}
const fakeRequire = (id) => {
  if (id === 'react') return React
  throw new Error(`unexpected require(${JSON.stringify(id)})`)
}

await import(new URL(target, import.meta.url))
const definition = globalThis.__definition
if (!definition || definition.id !== 'dsh-comfyui') throw new Error('module loader registration missing')
const api = definition.factory(fakeRequire)

// ---- fake preview / status payload -----------------------------------------
const PRESETS = [
  { id: 'illustration', zh: '画师风插画', en: 'Artist-style illustration', blurb: { zh: '插画说明', en: 'illustration blurb' }, fragment: 'x' },
  { id: 'pixel', zh: '像素游戏资产', en: 'Pixel game asset', pixel: true, blurb: { zh: '像素说明', en: 'pixel blurb' }, fragment: 'y' },
  // a stale entry from the old 32-look host: no tile caption, must be dropped
  { id: 'shinkai', zh: '新海诚 · 清透天空', en: 'Makoto Shinkai', group: 'artist', fragment: 'z' },
]
const fetchLog = []
globalThis.fetch = async (url, init) => {
  fetchLog.push([String(url), init?.method ?? 'GET', init?.body ?? null])
  const json = (body) => ({ ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) })
  if (String(url).startsWith('/comfyui/status')) {
    return json({
      online: true,
      sizes: ['512x512', '1024x1024'],
      styles: process.env.LEGACY_HOST === '1'
        ? Array.from({ length: 31 }, (unused, index) => ({
          id: index === 9 ? 'illustration' : index === 15 ? 'pixel' : `old-${index}`,
          zh: `旧预设 ${index}`,
          en: `Old preset ${index}`,
          group: index < 9 ? 'photo' : 'art',
          fragment: 'old',
        }))
        : PRESETS,
      defaults: { size: '1024x1024', steps: 8, guidance: 0, optimize: 'auto' },
      artists: [
        { id: 'anime', zh: '动漫（通用 · 赛璐璐）', en: 'Anime (generic cel look)', short: { zh: '动漫', en: 'Anime' }, fragment: 'a' },
        { id: 'shinkai', zh: '新海诚 · 清透天空', en: 'Makoto Shinkai', short: { zh: '新海诚', en: 'Shinkai' }, fragment: 'a' },
        { id: 'ghibli', zh: '吉卜力 · 手绘治愈', en: 'Studio Ghibli', short: { zh: '吉卜力', en: 'Ghibli' }, fragment: 'b' },
      ],
      models: [{
        id: 'krea2-turbo',
        label: 'Krea 2 Turbo · Q4',
        available: true,
        steps: 8,
        guidance: 0,
        guidanceSupported: false,
        styleLoras: [
          { id: 'retroanime', file: 'krea2_retroanime.safetensors', zh: '复古动漫', en: 'Retro anime', trigger: 'purple retro anime style', strength: 1, available: true },
          { id: 'darkbrush', file: 'krea2_darkbrush.safetensors', zh: '水墨笔触', en: 'Ink wash', trigger: 'monochrome ink wash style', strength: 1, available: false },
        ],
      }],
      activeModel: 'krea2-turbo',
    })
  }
  if (String(url).startsWith('/comfyui/gallery')) {
    return json({
      entries: [
        { name: 'comfy-pixel.png', prompt: 'slime', pixel: { target: 64, colors: 24 }, preview: 'comfy-pixel.preview.png' },
        { name: 'comfy-plain.png', prompt: 'portrait' },
      ],
    })
  }
  return json({})
}

// ---- mount ------------------------------------------------------------------
let Home = null
const ctx = {
  effect(fn) { fn(); return () => {} },
  locale: {
    register(ns, dictionaries) { ctx.locale.dictionaries[ns] = dictionaries },
    dictionaries: {},
    bind(ns) {
      const dictionaries = ctx.locale.dictionaries[ns]
      return (key) => dictionaries[currentLang][key] ?? String(key)
    },
  },
  slots: { inject(seat, fn) { fn(); }, register(seat, component) { if (seat.name === 'main') Home = component } },
}
let currentLang = 'zh'
api.apply(ctx)
if (Home === null) throw new Error('main slot was not registered')

// ---- renderer ---------------------------------------------------------------
function walk(node, out = []) {
  if (node === null || node === undefined || node === false || node === true) return out
  if (Array.isArray(node)) { for (const item of node) walk(item, out); return out }
  if (typeof node === 'string' || typeof node === 'number') { out.push({ text: String(node) }); return out }
  if (!node.$$el) return out
  const { type, props } = node.$$el
  if (typeof type === 'function') { walk(type(props), out); return out }
  const entry = { type, props, children: [] }
  out.push(entry)
  const kids = props.children === undefined ? [] : Array.isArray(props.children) ? props.children : [props.children]
  for (const kid of kids) walk(kid, entry.children)
  return out
}

function render() {
  hookIndex = 0
  rerender = false
  pendingEffects = []
  const tree = walk(React.createElement(Home))
  return tree
}

/** Render, run the effects that changed, let their promises settle, repeat. */
async function settle() {
  let tree = render()
  for (let round = 0; round < 8; round += 1) {
    const effects = pendingEffects
    pendingEffects = []
    for (const fn of effects) fn()
    await new Promise(resolve => setTimeout(resolve, 0))
    if (!rerender && effects.length === 0) break
    tree = render()
  }
  return tree
}

function findAll(tree, predicate, acc = []) {
  for (const node of tree) {
    if (node.type !== undefined && predicate(node)) acc.push(node)
    if (node.children) findAll(node.children, predicate, acc)
  }
  return acc
}

const text = (node) => {
  const parts = []
  const visit = (n) => {
    if (n.text !== undefined) parts.push(n.text)
    if (n.children) n.children.forEach(visit)
  }
  visit(node)
  return parts.join(' ').replace(/\s+/g, ' ').trim()
}

let tree = await settle()

// 1. exactly two preset tiles, in the same card, in registry order
const tiles = findAll(tree, node => node.type === 'button' && node.props.className === 'cfy-preset')
console.log('preset tiles:', tiles.length, tiles.map(text))
if (tiles.length !== 2) throw new Error(`expected 2 preset tiles, got ${tiles.length}`)
const expectZh = ['画师风插画', '像素游戏资产']
const legacy = process.env.LEGACY_HOST === '1'
if (!legacy && (!text(tiles[0]).includes(expectZh[0]) || !text(tiles[1]).includes(expectZh[1]))) throw new Error('zh preset copy wrong')

// tiles switch copy with the UI language, still from one registry
if (legacy) {
  console.log('\nLEGACY OK (stale host collapsed to the two core tiles)')
  process.exit(0)
}
currentLang = 'en'
const tilesEn = findAll(render(), node => node.type === 'button' && node.props.className === 'cfy-preset')
console.log('en tiles:', tilesEn.map(text))
if (!text(tilesEn[0]).includes('Artist-style illustration')) throw new Error('en preset copy wrong')
currentLang = 'zh'

// 2. the old 32-style <select> is gone; only inline selects remain (mode/size/...)
const selects = findAll(tree, node => node.type === 'select')
console.log('selects:', selects.map(node => node.props.value))
if (findAll(tree, node => node.type === 'optgroup').length !== 0) throw new Error('style optgroups still rendered')
const gone = ['photo', 'portrait', 'cinematic', 'shinkai', 'ghibli', 'araki']
if (selects.some(node => gone.includes(node.props.value))) throw new Error('a removed look is still selectable')

// 3. preset card is the first section
const sections = findAll(tree, node => node.type === 'section')
console.log('first card label:', text(sections[0]).slice(0, 24))
if (!text(sections[0]).includes('预设')) throw new Error('preset card is not first')

// 3b. artist chips sit in the same card, only while illustration is the active preset
const allChips = kind => findAll(tree, node => node.type === 'button' && node.props.className === 'cfy-chip' && node.props['data-kind'] === kind)
const chips = allChips('look')
console.log('look chips:', chips.map(text))
if (chips.length !== 4) throw new Error(`expected 通用 + 动漫 + 2 artist chips, got ${chips.length}`)
if (chips[0].props['data-active'] !== 'true') throw new Error('generic look should be the default')
chips[3].props.onClick()
tree = await settle()
const chipsAfter = allChips('look')
console.log('chips after picking ghibli:', chipsAfter.map(node => node.props['data-active']))
if (chipsAfter.map(node => node.props['data-active']).join(',') !== 'false,false,false,true') throw new Error('look chip did not activate')

// style LoRA row: only installed LoRAs, picked strength defaults to the preset value
const loraChips = allChips('lora')
console.log('lora chips:', loraChips.map(text))
if (loraChips.length !== 2) throw new Error(`expected 不用 + 1 installed LoRA, got ${loraChips.length}`)
loraChips[1].props.onClick()
tree = await settle()
const strength = findAll(tree, node => node.type === 'input' && node.props.className === 'cfy-input')
  .map(node => String(node.props.value))
console.log('inputs after picking LoRA:', strength.join(' | '))
if (!strength.includes('1')) throw new Error('LoRA strength was not set from the preset')

// 4. no pixel controls while illustration is active
const sizeRow = () => findAll(tree, node => node.type === 'div' && node.props.className === 'cfy-row')
                       .filter(node => text(node).includes('精灵尺寸') || text(node).includes('assetSize'))
console.log('pixel options rows (illustration):', sizeRow().length)
if (sizeRow().length !== 0) throw new Error('pixel options leaked into illustration mode')

// 5. click the pixel tile -> active state flips and sprite options appear
tiles[1].props.onClick()
if (!rerender) throw new Error('clicking a preset did not update state')
tree = await settle()
const tilesAfter = findAll(tree, node => node.type === 'button' && node.props.className === 'cfy-preset')
const active = tilesAfter.map(node => node.props['data-active'])
console.log('active flags:', active)
if (active.join(',') !== 'false,true') throw new Error('pixel preset did not become active')
const pixelRow = findAll(tree, node => node.type === 'div' && node.props.className === 'cfy-row')
                        .filter(node => text(node).includes('精灵尺寸'))
console.log('pixel options rows (pixel):', pixelRow.length, pixelRow.length > 0 ? text(pixelRow[0]) : '')
if (pixelRow.length !== 1) throw new Error('sprite size / palette controls missing in pixel mode')

// 5b. artist chips disappear for the pixel preset
const chipsInPixel = findAll(tree, node => node.type === 'button' && node.props.className === 'cfy-chip')
console.log('look/lora chips in pixel mode:', chipsInPixel.length)
if (chipsInPixel.length !== 0) throw new Error('look and LoRA chips should hide for pixel assets')

// 6. reference card hides in pixel mode
const refCards = findAll(tree, node => node.type === 'section').filter(node => text(node).includes('参考图'))
console.log('reference cards in pixel mode:', refCards.length)
if (refCards.length !== 0) throw new Error('reference card should hide for pixel assets')

// 7. back to illustration: reference card returns
tilesAfter[0].props.onClick()
tree = await settle()
const refBack = findAll(tree, node => node.type === 'section').filter(node => text(node).includes('参考图'))
console.log('reference cards back in illustration mode:', refBack.length)
if (refBack.length !== 1) throw new Error('reference card did not come back')

// 7b. back in illustration mode the previous artist is still selected
const chipsBack = allChips('look')
console.log('look chips back:', chipsBack.map(node => node.props['data-active']).join(','))
if (chipsBack.map(node => node.props['data-active']).join(',') !== 'false,false,false,true') throw new Error('look choice was lost across preset switches')

// 8. status fetch happened once on mount
console.log('requests:', fetchLog.map(pair => pair[0]).join(', '))
if (!fetchLog.some(([url]) => url.startsWith('/comfyui/status'))) throw new Error('status was never fetched')

// 8b. pixel assets display their block preview with crisp rendering; normal ones do not
const images = findAll(tree, node => node.type === 'img')
const pixelImg = images.find(node => String(node.props.src).includes('comfy-pixel.preview.png'))
const plainImg = images.find(node => String(node.props.src).includes('comfy-plain.png'))
console.log('pixel thumb src:', pixelImg?.props.src, '| pixelated:', pixelImg?.props.style?.imageRendering)
console.log('plain thumb src:', plainImg?.props.src, '| pixelated:', plainImg?.props.style?.imageRendering)
if (pixelImg === undefined) throw new Error('pixel asset did not use its block preview')
if (pixelImg.props.style?.imageRendering !== 'pixelated') throw new Error('pixel asset is not rendered crisp')
if (plainImg === undefined) throw new Error('normal gallery entry missing')
if (plainImg.props.style?.imageRendering !== undefined) throw new Error('plain image should not be pixelated')

// 9. the generate request carries the picked preset + artist
const textareas = findAll(tree, node => node.type === 'textarea')
textareas[0].props.onChange({ currentTarget: { value: 'a knight under a cherry tree' } })
tree = await settle()
const generate = findAll(tree, node => node.type === 'button' && String(node.props.className).includes('cfy-btn-primary'))[0]
generate.props.onClick()
await new Promise(resolve => setTimeout(resolve, 0))
const post = fetchLog.filter(entry => entry[0] === '/comfyui/generate').pop()
const payload = JSON.parse(post[2])
console.log('generate payload:', { style: payload.style, artist: payload.artist, lora: payload.lora, strength: payload.loraStrength })
if (payload.style !== 'illustration' || payload.artist !== 'ghibli' || payload.pixel !== undefined) throw new Error('generate payload lost preset/artist')
if (payload.lora !== 'retroanime' || payload.loraStrength !== 1) throw new Error('generate payload lost the style LoRA')

console.log('\nSMOKE OK')
process.exit(0)
