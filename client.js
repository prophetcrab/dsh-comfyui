/**
 * ComfyUI generation panel (browser half).
 *
 * A sidebar entry plus a full-width main panel: prompt box with the Krea prompt
 * optimizer, size/steps/guidance/seed controls, live progress, the last result,
 * and the on-disk gallery.
 */
window.__ModuleLoader__.load({
  id: 'dsh-comfyui',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    const NS = 'comfyui'
    const PANEL_ID = 'comfyui'
    /** Presets the panel falls back to when the host has not registered tile copy yet. */
    const CORE_PRESET_IDS = ['illustration', 'pixel']

    const en = {
      __lang: 'en',
      title: 'ComfyUI image generation',
      eyebrow: 'Local FLUX',
      subtitle: 'Write an idea, let the optimizer shape it for FLUX.1 Krea, and render it on the local ComfyUI.',
      online: 'Connected',
      offline: 'Offline',
      starting: 'Starting…',
      start: 'Start ComfyUI',
      refresh: 'Refresh',
      idea: 'Your idea',
      ideaPlaceholder: 'e.g. a cozy bookshop on a rainy evening, warm window light',
      optimized: 'Prompt sent to the model',
      optimize: 'Optimize',
      optimizing: 'Optimizing…',
      mode: 'Prompt mode',
      modeAuto: 'Auto',
      modeLlm: 'Model rewrite',
      modeRules: 'Rules',
      modeOff: 'Off',
      presets: 'Preset',
      presetsHint: 'Pick a preset; the parameters below still apply.',
      artistStyle: 'Look / artist',
      artistGeneric: 'Generic',
      loraStyle: 'Style LoRA',
      loraNone: 'None',
      loraStrength: 'LoRA strength',
      downloadSprite: 'Download the true sprite',
      guidanceLocked: 'Krea 2 Turbo runs CFG 1, so guidance has no effect.',
      size: 'Size',
      steps: 'Steps',
      guidance: 'Guidance',
      seed: 'Seed',
      random: 'Random',
      generate: 'Generate',
      generating: 'Generating…',
      queued: 'Queued',
      running: 'Rendering',
      done: 'Done',
      failed: 'Generation failed',
      slow: 'Apple Silicon renders roughly 30-45 s per step; a 20-step 1024² image takes several minutes.',
      result: 'Latest result',
      gallery: 'Gallery',
      emptyGallery: 'Nothing generated yet.',
      models: 'Model',
      error: 'Error',
      reset: 'Reuse settings',
      lost: 'That job was lost (ComfyUI restarted); generate again.',
      cancel: 'Stop',
      pixelHint: 'Rendered at 1024² then collapsed to a true sprite: crisp pixels, small palette.',
      assetSize: 'Sprite size',
      palette: 'Palette',
      reference: 'Reference image',
      referenceHint: 'Add a character sheet or style reference (image + prompt).',
      referenceIdentity: 'Character / persona',
      referenceStyle: 'Style',
      referenceRemove: 'Remove',
      referenceSize: 'Output size follows the reference image unless you pick one.',
      followReference: 'Follow the reference',
      delete: 'Delete',
      confirmDelete: 'Confirm',
      deleting: 'Deleting…',
      cancelled: 'Cancelled.',
      noModels: 'No model detected — start ComfyUI first',
      offlineHint: 'ComfyUI is not running. Generating will start it, or press Start ComfyUI.',
      elapsed: 'elapsed',
    }

    const zh = {
      __lang: 'zh',
      title: 'ComfyUI 生图',
      eyebrow: '本地 FLUX',
      subtitle: '写下想法，优化器会按 FLUX.1 Krea 的偏好改写，然后交给本地 ComfyUI 渲染。',
      online: '已连接',
      offline: '未连接',
      starting: '启动中…',
      start: '启动 ComfyUI',
      refresh: '刷新',
      idea: '你的想法',
      ideaPlaceholder: '例如：雨夜的旧书店，暖色窗光，电影感',
      optimized: '实际发给模型的提示词',
      optimize: '优化提示词',
      optimizing: '优化中…',
      mode: '提示词模式',
      modeAuto: '自动',
      modeLlm: '模型改写',
      modeRules: '规则拼接',
      modeOff: '不优化',
      presets: '预设',
      presetsHint: '选一个预设，下面的参数照常生效。',
      artistStyle: '画风 / 画师',
      artistGeneric: '通用',
      loraStyle: '画风 LoRA',
      loraNone: '不用',
      loraStrength: 'LoRA 强度',
      downloadSprite: '下载真实尺寸 PNG',
      guidanceLocked: 'Krea 2 Turbo 固定 CFG 1，引导强度不生效。',
      size: '尺寸',
      steps: '步数',
      guidance: '引导强度',
      seed: '种子',
      random: '随机',
      generate: '生成',
      generating: '生成中…',
      queued: '排队中',
      running: '渲染中',
      done: '完成',
      failed: '生成失败',
      slow: 'Apple Silicon 上大约每步 30–45 秒，1024²/20 步要几分钟。',
      result: '最近一次结果',
      gallery: '画廊',
      emptyGallery: '还没有生成过图片。',
      models: '模型',
      error: '错误',
      reset: '沿用参数',
      lost: '任务已丢失（ComfyUI 重启过），请重新生成',
      cancel: '停止',
      pixelHint: '先在 1024² 生成，再折叠成真正的像素精灵：硬边缘、有限调色板。',
      assetSize: '精灵尺寸',
      palette: '调色板',
      reference: '参考图',
      referenceHint: '上传人设图或风格参考图（图 + 文字一起出图）。',
      referenceIdentity: '人设 / 角色',
      referenceStyle: '风格',
      referenceRemove: '移除',
      referenceSize: '默认跟随参考图尺寸，也可以手动选。',
      followReference: '跟随参考图',
      delete: '删除',
      confirmDelete: '确认删除',
      deleting: '删除中…',
      cancelled: '已取消。',
      noModels: '未检测到模型，请先启动 ComfyUI',
      offlineHint: 'ComfyUI 未运行：生成时会自动启动，也可以点右上角「启动 ComfyUI」。',
      elapsed: '已用',
    }

    const CSS = `
.cfy-page { box-sizing: border-box; width: 100%; height: 100%; overflow-y: auto; overflow-x: hidden;
  background: radial-gradient(80% 40% at 100% 0%, color-mix(in srgb, var(--dsw-alias-brand-primary) 7%, transparent), transparent 70%),
              var(--dsw-alias-bg-base);
  max-width: 1180px; margin: 0 auto; padding: 24px 28px 60px; display: flex; flex-direction: column; gap: 16px; }
.cfy-page > * { flex: 0 0 auto; min-height: 0; }
.cfy-hero { position: relative; overflow: hidden; border: 0.5px solid color-mix(in srgb, var(--dsw-alias-brand-primary) 22%, var(--dsw-alias-border-l1));
  border-radius: 20px; padding: 24px 26px; display: flex; align-items: flex-start; justify-content: space-between; gap: 18px;
  background: radial-gradient(120% 160% at 100% 0%, color-mix(in srgb, var(--dsw-alias-brand-primary) 22%, transparent), transparent 60%),
              var(--dsw-alias-bg-layer-1); }
.cfy-eyebrow { display: inline-flex; align-items: center; gap: 7px; font-size: 10.5px; letter-spacing: 0.12em;
  text-transform: uppercase; color: var(--dsw-alias-brand-primary); font-weight: 500; }
.cfy-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--dsw-alias-brand-primary);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--dsw-alias-brand-primary) 22%, transparent); }
.cfy-title { margin: 8px 0 0; font-size: 24px; line-height: 1.2; font-weight: 500; letter-spacing: -0.01em; color: var(--dsw-alias-label-primary); }
.cfy-sub { margin: 8px 0 0; font-size: 12.5px; line-height: 1.55; color: var(--dsw-alias-label-secondary); max-width: 64ch; }
.cfy-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
.cfy-pill { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; padding: 4px 10px; border-radius: 999px;
  border: 0.5px solid var(--dsw-alias-border-l1); color: var(--dsw-alias-label-secondary); }
.cfy-pill-on { color: var(--dsw-alias-state-success-primary); border-color: color-mix(in srgb, var(--dsw-alias-state-success-primary) 40%, var(--dsw-alias-border-l1)); }
.cfy-pill-off { color: var(--dsw-alias-state-warn-primary); border-color: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 40%, var(--dsw-alias-border-l1)); }
.cfy-btn { appearance: none; border: 0.5px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary);
  font: inherit; font-size: 12px; padding: 7px 13px; border-radius: 10px; cursor: pointer; white-space: nowrap;
  transition: transform .15s ease, border-color .15s ease, background .15s ease; }
.cfy-btn:hover:not(:disabled) { transform: translateY(-1px); border-color: var(--dsw-alias-brand-primary); }
.cfy-btn:disabled { opacity: .55; cursor: default; }
.cfy-btn-primary { border-color: transparent; background: var(--dsw-alias-brand-primary); color: var(--dsw-alias-label-primary-inverted, #fff); font-weight: 500; }
.cfy-presets { display: grid; grid-template-columns: repeat(auto-fit, minmax(232px, 1fr)); gap: 10px; }
.cfy-preset { appearance: none; font: inherit; text-align: left; display: flex; align-items: flex-start; gap: 12px;
  border: 0.5px solid var(--dsw-alias-border-l1); border-radius: 14px; padding: 14px 16px; cursor: pointer;
  background: var(--dsw-alias-bg-base); color: var(--dsw-alias-label-primary);
  transition: transform .15s ease, border-color .15s ease, background .15s ease; }
.cfy-preset:hover { transform: translateY(-1px); border-color: color-mix(in srgb, var(--dsw-alias-brand-primary) 45%, var(--dsw-alias-border-l1)); }
.cfy-preset[data-active="true"] { border-color: var(--dsw-alias-brand-primary);
  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 8%, var(--dsw-alias-bg-base)); }
.cfy-preset-mark { flex: 0 0 auto; width: 34px; height: 34px; border-radius: 10px; display: grid; place-items: center;
  border: 0.5px solid var(--dsw-alias-border-l1); color: var(--dsw-alias-brand-primary); background: var(--dsw-alias-bg-layer-1); }
.cfy-preset-body { display: flex; flex-direction: column; gap: 3px; min-width: 0; flex: 1 1 auto; }
.cfy-preset-name { font-size: 13.5px; font-weight: 500; line-height: 1.35; }
.cfy-preset-blurb { font-size: 11.5px; line-height: 1.5; color: var(--dsw-alias-label-tertiary); }
.cfy-preset-check { flex: 0 0 auto; font-size: 12px; color: var(--dsw-alias-brand-primary); }
.cfy-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.cfy-chip { appearance: none; font: inherit; font-size: 11.5px; line-height: 1; padding: 7px 11px; border-radius: 999px;
  border: 0.5px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-base); color: var(--dsw-alias-label-secondary);
  cursor: pointer; transition: color .15s ease, border-color .15s ease, background .15s ease; }
.cfy-chip:hover { color: var(--dsw-alias-label-primary); border-color: color-mix(in srgb, var(--dsw-alias-brand-primary) 45%, var(--dsw-alias-border-l1)); }
.cfy-chip[data-active="true"] { color: var(--dsw-alias-label-primary); border-color: var(--dsw-alias-brand-primary);
  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 14%, transparent); }
.cfy-card { border: 0.5px solid var(--dsw-alias-border-l1); border-radius: 16px; background: var(--dsw-alias-bg-layer-1); padding: 18px 20px; display: flex; flex-direction: column; gap: 12px; }
.cfy-label { font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--dsw-alias-label-tertiary); }
.cfy-area { width: 100%; box-sizing: border-box; resize: vertical; font: inherit; font-size: 13px; line-height: 1.6;
  color: var(--dsw-alias-label-primary); background: var(--dsw-alias-bg-base); border: 0.5px solid var(--dsw-alias-border-l1);
  border-radius: 12px; padding: 11px 13px; min-height: 76px; }
.cfy-area:focus { outline: none; border-color: var(--dsw-alias-brand-primary); }
.cfy-row { display: flex; flex-wrap: wrap; gap: 10px; align-items: flex-end; }
.cfy-field { display: flex; flex-direction: column; gap: 5px; }
.cfy-select, .cfy-input { font: inherit; font-size: 12px; color: var(--dsw-alias-label-primary); background: var(--dsw-alias-bg-base);
  border: 0.5px solid var(--dsw-alias-border-l1); border-radius: 9px; padding: 6px 8px; }
.cfy-input { width: 96px; }
.cfy-hint { font-size: 11.5px; color: var(--dsw-alias-label-tertiary); line-height: 1.5; }
.cfy-dl { align-self: flex-start; font-size: 11.5px; color: var(--dsw-alias-brand-primary); text-decoration: none;
  border-bottom: 0.5px solid color-mix(in srgb, var(--dsw-alias-brand-primary) 40%, transparent); padding-bottom: 1px; }
.cfy-dl:hover { opacity: .8; }
.cfy-ref { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.cfy-ref-add { position: relative; display: inline-flex; align-items: center; justify-content: center; width: 76px; height: 76px;
  border: 1px dashed var(--dsw-alias-border-l1); border-radius: 10px; color: var(--dsw-alias-label-tertiary);
  font-size: 22px; cursor: pointer; background: var(--dsw-alias-bg-base); }
.cfy-ref-add:hover { border-color: var(--dsw-alias-brand-primary); color: var(--dsw-alias-brand-primary); }
.cfy-ref-add input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
.cfy-ref-thumb { position: relative; width: 76px; height: 76px; border-radius: 10px; overflow: hidden; border: 0.5px solid var(--dsw-alias-border-l1); }
.cfy-ref-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.cfy-ref-thumb button { position: absolute; top: 3px; right: 3px; border: 0; border-radius: 6px; padding: 2px 6px;
  font: inherit; font-size: 10px; color: #fff; background: rgba(20,22,30,.75); cursor: pointer; }
.cfy-ref-meta { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.cfy-warn { font-size: 12px; color: var(--dsw-alias-state-warn-label, var(--dsw-alias-label-secondary)); line-height: 1.5; }
.cfy-error { font-size: 12px; color: var(--dsw-alias-state-error-primary); line-height: 1.5; }
.cfy-progress { height: 4px; border-radius: 2px; background: var(--dsw-alias-bg-layer-2); overflow: hidden; }
.cfy-progress { height: 6px; }
.cfy-progress > i { display: block; height: 100%; width: 38%; background: linear-gradient(90deg,
  color-mix(in srgb, var(--dsw-alias-brand-primary) 70%, transparent), var(--dsw-alias-brand-primary));
  animation: cfy-slide 1.4s ease-in-out infinite; transition: width .45s ease; }
.cfy-progress-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.cfy-percent { font-size: 12px; font-variant-numeric: tabular-nums; color: var(--dsw-alias-brand-primary); font-weight: 500; }
@keyframes cfy-slide { 0% { transform: translateX(-100%); } 100% { transform: translateX(360%); } }
.cfy-split { display: flex; flex-wrap: wrap; gap: 14px; align-items: flex-start; }
.cfy-preview { flex: 1 1 320px; min-width: 280px; border: 0.5px solid var(--dsw-alias-border-l1); border-radius: 14px; overflow: hidden; background: var(--dsw-alias-bg-base); }
.cfy-preview img { display: block; width: 100%; height: auto; }
.cfy-meta { display: flex; flex-wrap: wrap; gap: 12px; font-size: 11px; color: var(--dsw-alias-label-tertiary); padding: 9px 12px; }
.cfy-gallery { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 8px; }
.cfy-thumb { position: relative; border: 0.5px solid var(--dsw-alias-border-l1); border-radius: 10px; overflow: hidden;
  aspect-ratio: 1; background: var(--dsw-alias-bg-layer-2); cursor: pointer; padding: 0; }
.cfy-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform .2s ease; }
.cfy-thumb-del { position: absolute; top: 6px; right: 6px; z-index: 2; appearance: none; border: 0;
  border-radius: 7px; padding: 3px 7px; font: inherit; font-size: 10.5px; line-height: 1.4; cursor: pointer;
  color: #fff; background: rgba(20, 22, 30, .72); opacity: 0; transition: opacity .15s ease, background .15s ease; }
.cfy-thumb:hover .cfy-thumb-del, .cfy-thumb-del[data-armed="true"] { opacity: 1; }
.cfy-thumb-del:hover { background: rgba(200, 40, 40, .9); }
.cfy-thumb:hover img { transform: scale(1.04); }
.cfy-empty { font-size: 12px; color: var(--dsw-alias-label-tertiary); }
@media (max-width: 720px) { .cfy-page { padding: 16px 14px 40px; } .cfy-hero { flex-direction: column; } }
`

    /** Panel state that survives unmounting when the user switches pages. */
    const memory = { snapshot: null }
    const STORAGE_KEY = 'dsh.comfyui.panel'

    function loadSnapshot() {
      if (memory.snapshot !== null) return memory.snapshot
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY)
        if (raw !== null) {
          memory.snapshot = JSON.parse(raw)
          return memory.snapshot
        }
      } catch {
        // storage unavailable; fall through to a fresh panel
      }
      return null
    }

    function saveSnapshot(next) {
      memory.snapshot = next
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {
        // ignore quota or private-mode failures
      }
    }

    /**
     * URL to show for a result/gallery entry. Pixel assets carry a block-expanded
     * preview (`preview` file name or `previewUrl`); the true 64 px sprite stays
     * the asset that gets downloaded.
     */
    function displaySrc(entry) {
      if (entry === null || entry === undefined) return ''
      if (typeof entry.previewUrl === 'string' && entry.previewUrl !== '') return entry.previewUrl
      if (typeof entry.preview === 'string' && entry.preview !== '') {
        return `/comfyui/image?name=${encodeURIComponent(entry.preview)}`
      }
      return entry.url ?? `/comfyui/image?name=${encodeURIComponent(entry.name ?? '')}`
    }

    /** Human-readable aspect ratio for a pixel size. */
    function ratioOf(width, height) {
      const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b))
      const divisor = gcd(width, height)
      return `${width / divisor}:${height / divisor}`
    }

    function ComfyIcon(props) {
      const size = props && props.size ? props.size : 18
      return h('svg', { viewBox: '0 0 16 16', width: size, height: size, 'aria-hidden': true, fill: 'none' },
        h('rect', { x: 1.6, y: 2.2, width: 12.8, height: 11.6, rx: 2.2, stroke: 'currentColor', strokeWidth: 1.2 }),
        h('circle', { cx: 5.6, cy: 6.2, r: 1.3, fill: 'currentColor' }),
        h('path', { d: 'M3.2 12.4l3.4-3.8 2.3 2.4 1.7-1.8 2.2 3.2', stroke: 'currentColor', strokeWidth: 1.2, strokeLinecap: 'round', strokeLinejoin: 'round' }))
    }

    /** Small mark for a preset tile: a brush for illustration, a pixel grid for sprites. */
    function PresetGlyph(preset) {
      if (preset.pixel === true || preset.id === 'pixel') {
        return h('svg', { viewBox: '0 0 16 16', width: 17, height: 17, 'aria-hidden': true, fill: 'currentColor' },
          h('rect', { x: 2, y: 2, width: 5, height: 5 }),
          h('rect', { x: 9, y: 2, width: 5, height: 5 }),
          h('rect', { x: 2, y: 9, width: 5, height: 5 }),
          h('rect', { x: 9, y: 9, width: 5, height: 5, opacity: 0.35 }))
      }
      return h('svg', { viewBox: '0 0 16 16', width: 17, height: 17, 'aria-hidden': true, fill: 'none',
        stroke: 'currentColor', strokeWidth: 1.2, strokeLinecap: 'round', strokeLinejoin: 'round' },
        h('path', { d: 'M2.6 13.4c1.5.3 2.7-.3 3.3-1.5.5-1 .1-2-.6-2.7' }),
        h('path', { d: 'M5.6 8.7 11.3 3a1.7 1.7 0 0 1 2.4 2.4l-5.7 5.7' }),
        h('path', { d: 'M5.6 8.7l2.4 2.4' }))
    }

    function Panel(props) {
      const t = typeof props.t === 'function' ? props.t : (key) => key
      const saved = React.useMemo(() => loadSnapshot(), [])
      const [status, setStatus] = React.useState(null)
      const [starting, setStarting] = React.useState(false)
      const [idea, setIdea] = React.useState(saved?.idea ?? '')
      const [optimized, setOptimized] = React.useState(saved?.optimized ?? '')
      const [mode, setMode] = React.useState(saved?.mode ?? 'auto')
      const [artist, setArtist] = React.useState(saved?.artist ?? '')
      const [lora, setLora] = React.useState(saved?.lora ?? '')
      const [loraStrength, setLoraStrength] = React.useState(saved?.loraStrength ?? 1)
      const [style, setStyle] = React.useState(saved?.style ?? 'illustration')
      const [model, setModel] = React.useState(saved?.model ?? '')
      const [size, setSize] = React.useState(saved?.size ?? '1024x1024')
      const [steps, setSteps] = React.useState(saved?.steps ?? 20)
      const [guidance, setGuidance] = React.useState(saved?.guidance ?? 3.5)
      const [seed, setSeed] = React.useState(saved?.seed ?? '')
      const [jobId, setJobId] = React.useState(saved?.jobId ?? null)
      const [busy, setBusy] = React.useState(Boolean(saved?.jobId && (saved?.phase === 'queued' || saved?.phase === 'running')))
      const [phase, setPhase] = React.useState(saved?.phase ?? null)
      const [progress, setProgress] = React.useState(saved?.progress ?? null)
      const [elapsedMs, setElapsedMs] = React.useState(0)
      const [result, setResult] = React.useState(saved?.result ?? null)
      const [gallery, setGallery] = React.useState([])
      const [error, setError] = React.useState(null)
      const [pendingDelete, setPendingDelete] = React.useState(null)
      const [assetSize, setAssetSize] = React.useState(saved?.assetSize ?? 64)
      const [paletteColors, setPaletteColors] = React.useState(saved?.paletteColors ?? 24)
      const [reference, setReference] = React.useState(() => memory.reference ?? null)
      const [refMode, setRefMode] = React.useState('identity')
      const [optimizing, setOptimizing] = React.useState(false)

      const defaultsApplied = React.useRef(false)

      const loadStatus = React.useCallback(() => {
        fetch('/comfyui/status', { cache: 'no-store', headers: { accept: 'application/json' } })
          .then(response => (response.ok ? response.json() : null))
          .then((data) => {
            if (data !== null) {
              setStatus(data)
              if (data.activeModel !== undefined && data.activeModel !== null) {
                setModel(previous => (previous !== '' ? previous : data.activeModel))
              }
              if (data.defaults) {
                setSize(data.defaults.size)
                setMode(data.defaults.optimize ?? 'auto')
                // Only on the first successful probe: a Refresh must not clobber
                // whatever the user already tuned.
                if (!defaultsApplied.current) {
                  defaultsApplied.current = true
                  setSteps(data.defaults.steps)
                  setGuidance(data.defaults.guidance)
                }
              }
            }
          })
          .catch(() => setStatus(previous => previous ?? { online: false }))
      }, [])

      const loadGallery = React.useCallback(() => {
        fetch('/comfyui/gallery', { cache: 'no-store', headers: { accept: 'application/json' } })
          .then(response => (response.ok ? response.json() : null))
          .then((data) => { if (data !== null) setGallery(Array.isArray(data.entries) ? data.entries : []) })
          .catch(() => {})
      }, [])

      React.useEffect(() => { loadStatus(); loadGallery() }, [loadStatus, loadGallery])

      React.useEffect(() => {
        if (!busy) return undefined
        const timer = setInterval(() => setElapsedMs(previous => previous + 1000), 1000)
        return () => clearInterval(timer)
      }, [busy])

      // Keep the draft and any in-flight job across page switches and reloads.
      React.useEffect(() => {
        memory.reference = reference
      }, [reference])

      React.useEffect(() => {
        saveSnapshot({ jobId, phase, progress, idea, optimized, mode, style, artist, lora, loraStrength, size, steps, guidance, seed, model, result, assetSize, paletteColors })
      }, [jobId, phase, progress, idea, optimized, mode, style, artist, lora, loraStrength, size, steps, guidance, seed, model, result, assetSize, paletteColors])

      const timerRef = React.useRef(null)
      React.useEffect(() => () => {
        if (timerRef.current !== null) clearInterval(timerRef.current)
      }, [])

      const resumed = React.useRef(false)
      React.useEffect(() => {
        if (resumed.current) return
        resumed.current = true
        const snapshot = loadSnapshot()
        if (snapshot?.jobId && (snapshot.phase === 'queued' || snapshot.phase === 'running')) {
          pollJob(snapshot.jobId)
        }
      }, [])

      // "follow" only exists while a reference is attached.
      React.useEffect(() => {
        if (reference === null && size === 'follow') {
          setSize(status?.defaults?.size ?? '1024x1024')
        }
      }, [reference, size, status])

      // Keep the picker usable when the stored model is no longer installed.
      React.useEffect(() => {
        const list = status?.models ?? []
        if (list.length === 0) return
        if (list.some(entry => entry.id === model && entry.available)) return
        const next = list.find(entry => entry.available)
        if (next !== undefined) {
          setModel(next.id)
          setSteps(next.steps)
          setGuidance(next.guidance)
        }
      }, [status, model])

      // Presets come from the host registry, so the panel, the tool enum and the
      // optimizer all read the same list; a new preset shows up here on its own.
      // Only entries carrying a tile caption are presets. The filter also keeps a
      // panel talking to a not-yet-restarted host (still serving the 32 old looks)
      // down to the two core presets instead of 32 tiles.
      const registry = Array.isArray(status?.styles) ? status.styles : []
      const captioned = registry.filter(entry => entry.blurb !== undefined)
      const presets = captioned.length > 0 ? captioned : registry.filter(entry => CORE_PRESET_IDS.includes(entry.id))
      const activePreset = presets.find(entry => entry.id === style) ?? null
      const pixelMode = style === 'pixel' || (activePreset !== null && activePreset.pixel === true)
      const artists = Array.isArray(status?.artists) ? status.artists : []
      const activeModel = (status?.models ?? []).find(entry => entry.id === model)
        ?? (status?.models ?? []).find(entry => entry.available)
        ?? null
      const styleLoras = (activeModel?.styleLoras ?? []).filter(entry => entry.available)
      const activeLora = styleLoras.find(entry => entry.id === lora) ?? null
      const guidanceLocked = activeModel !== null && activeModel.guidanceSupported === false
      const activeArtist = artists.find(entry => entry.id === artist) ?? null
      const lang = t('__lang') === 'zh' ? 'zh' : 'en'

      // A saved artist reference that the host no longer offers means "generic".
      React.useEffect(() => {
        if (artist === '' || artists.length === 0) return
        if (artists.some(entry => entry.id === artist)) return
        setArtist('')
      }, [status, artist])

      // A saved size from the pre-0.6 list may no longer be offered.
      React.useEffect(() => {
        const list = status?.sizes
        if (!Array.isArray(list) || list.length === 0) return
        if (size === 'follow' && reference !== null) return
        if (list.includes(size)) return
        setSize(list[0])
      }, [status, size, reference])

      // Same for a style LoRA whose file is gone.
      React.useEffect(() => {
        if (lora === '') return
        if (status === null) return
        if (styleLoras.some(entry => entry.id === lora)) return
        setLora('')
      }, [status, lora])

      // A saved look from the old 32-preset panel no longer exists: fall back to the first tile.
      React.useEffect(() => {
        if (presets.length === 0) return
        if (presets.some(entry => entry.id === style)) return
        setStyle(presets[0].id)
      }, [status, style])

      const choosePreset = (preset) => {
        setStyle(preset.id)
        if (preset.pixel === true || preset.id === 'pixel') {
          setReference(null)
          setError(null)
        }
      }

      const chooseModel = (id) => {
        setModel(id)
        const preset = (status?.models ?? []).find(entry => entry.id === id)
        if (preset !== undefined) {
          setSteps(preset.steps)
          setGuidance(preset.guidance)
        }
      }

      const startServer = () => {
        setStarting(true)
        setError(null)
        fetch('/comfyui/start', { method: 'POST' })
          .then(async (response) => {
            const body = await response.json().catch(() => null)
            if (!response.ok) throw new Error(body?.error ?? `HTTP ${response.status}`)
            loadStatus()
          })
          .catch(err => setError(err instanceof Error ? err.message : String(err)))
          .finally(() => setStarting(false))
      }

      const optimizePrompt = () => {
        const text = idea.trim()
        if (text === '') return
        setOptimizing(true)
        setError(null)
        fetch('/comfyui/optimize', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ prompt: text, mode, style, artist: pixelMode ? undefined : artist, size }),
        })
          .then(async (response) => {
            const body = await response.json().catch(() => null)
            if (!response.ok) throw new Error(body?.error ?? `HTTP ${response.status}`)
            setOptimized(body.optimized ?? '')
          })
          .catch(err => setError(err instanceof Error ? err.message : String(err)))
          .finally(() => setOptimizing(false))
      }

      const pollJob = React.useCallback((id) => {
        const tick = () => {
          fetch(`/comfyui/job?id=${encodeURIComponent(id)}`, { cache: 'no-store' })
            .then((response) => {
              if (response.status === 404) {
                clearInterval(timer)
                setBusy(false)
                setPhase(null)
                setProgress(null)
                setJobId(null)
                setError(t('lost'))
                return null
              }
              return response.ok ? response.json() : null
            })
            .then((job) => {
              if (job === null) return
              if (job.status !== undefined) setPhase(job.status)
              if (job.progress) setProgress(job.progress)
              if (typeof job.elapsedMs === 'number') setElapsedMs(job.elapsedMs)
              if (job.status === 'done') {
                clearInterval(timer)
                setBusy(false)
                setPhase(null)
                setProgress(null)
                setJobId(null)
                setResult(job.result)
                loadGallery()
                if (job.result?.seed !== undefined) setSeed(String(job.result.seed))
              } else if (job.status === 'error') {
                clearInterval(timer)
                setBusy(false)
                setPhase(null)
                setProgress(null)
                setJobId(null)
                setError(job.error ?? t('failed'))
              }
            })
            .catch(() => {})
        }
        tick()
        const timer = setInterval(tick, 1500)
        timerRef.current = timer
        return timer
      }, [loadGallery, t])

      const stopGeneration = () => {
        const id = jobId
        if (timerRef.current !== null) clearInterval(timerRef.current)
        setBusy(false)
        setPhase(null)
        setProgress(null)
        setJobId(null)
        setError(t('cancelled'))
        if (id !== null) fetch(`/comfyui/cancel?id=${encodeURIComponent(id)}`, { method: 'POST' }).catch(() => {})
      }

      /** Shrink a picked image to at most 1536px and re-encode as JPEG. */
      const shrinkReference = (file) => new Promise((resolve, reject) => {
        const objectUrl = URL.createObjectURL(file)
        const image = new Image()
        image.onload = () => {
          const longest = Math.max(image.width, image.height)
          const scale = longest > 1536 ? 1536 / longest : 1
          const width = Math.max(1, Math.round(image.width * scale))
          const height = Math.max(1, Math.round(image.height * scale))
          const canvas = document.createElement('canvas')
          canvas.width = width
          canvas.height = height
          const context = canvas.getContext('2d')
          if (context === null) {
            URL.revokeObjectURL(objectUrl)
            reject(new Error('canvas unavailable'))
            return
          }
          context.drawImage(image, 0, 0, width, height)
          URL.revokeObjectURL(objectUrl)
          resolve(canvas.toDataURL('image/jpeg', 0.92))
        }
        image.onerror = () => {
          URL.revokeObjectURL(objectUrl)
          reject(new Error('无法读取参考图'))
        }
        image.src = objectUrl
      })

      const pickReference = (file) => {
        if (file === undefined || file === null) return
        if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
          setError('参考图需要 PNG / JPEG / WebP')
          return
        }
        if (file.size > 40 * 1024 * 1024) {
          setError('参考图太大（上限 40MB）')
          return
        }
        shrinkReference(file)
          .then((dataUrl) => {
            setReference({ dataUrl, name: file.name })
            setSize('follow')
          })
          .catch(() => setError('读取参考图失败'))
      }

      const deleteImage = (name) => {
        if (pendingDelete !== name) {
          setPendingDelete(name)
          return
        }
        setPendingDelete(null)
        fetch(`/comfyui/gallery/delete?name=${encodeURIComponent(name)}`, { method: 'POST' })
          .then(async (response) => {
            if (!response.ok) {
              const body = await response.json().catch(() => null)
              throw new Error(body?.error ?? `HTTP ${response.status}`)
            }
            setGallery(previous => previous.filter(entry => entry.name !== name))
            setResult(previous => (previous?.name === name ? null : previous))
          })
          .catch(err => setError(err instanceof Error ? err.message : String(err)))
      }

      const generate = () => {
        const text = optimized.trim() !== '' ? optimized.trim() : idea.trim()
        if (text === '') return
        setBusy(true)
        setError(null)
        setResult(null)
        setPhase('queued')
        setProgress(null)
        setElapsedMs(0)
        fetch('/comfyui/generate', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            prompt: idea.trim() !== '' ? idea.trim() : text,
            optimized: optimized.trim() !== '' ? optimized.trim() : undefined,
            size: pixelMode ? undefined : size === 'follow' ? undefined : size,
            steps: Number(steps),
            guidance: Number(guidance),
            seed: seed.trim() === '' ? undefined : Number(seed),
            style,
            artist: pixelMode ? undefined : artist === '' ? undefined : artist,
            lora: pixelMode || lora === '' ? undefined : lora,
            loraStrength: pixelMode || lora === '' ? undefined : Number(loraStrength),
            model,
            pixel: pixelMode ? { target: assetSize, colors: paletteColors } : undefined,
            reference: !pixelMode && reference !== null ? { dataUrl: reference.dataUrl, mode: refMode, follow: size === 'follow' } : undefined,
            optimize: mode !== 'off',
            mode,
          }),
        })
          .then(async (response) => {
            const body = await response.json().catch(() => null)
            if (!response.ok) throw new Error(body?.error ?? `HTTP ${response.status}`)
            setJobId(body.jobId)
            pollJob(body.jobId)
          })
          .catch(err => {
            setBusy(false)
            setPhase(null)
            const message = err instanceof Error ? err.message : String(err)
            setError(message === 'Failed to fetch' ? '请求失败：参考图可能过大，换一张或重试' : message)
          })
      }

      const latest = result ?? (gallery.length > 0 ? { url: `/comfyui/image?name=${encodeURIComponent(gallery[0].name)}`, ...gallery[0] } : null)
      const online = status?.online === true

      return h('div', { className: 'cfy-page' },
        h('header', { className: 'cfy-hero' },
          h('div', null,
            h('span', { className: 'cfy-eyebrow' }, h('i', { className: 'cfy-dot' }), t('eyebrow')),
            h('h1', { className: 'cfy-title' }, t('title')),
            h('p', { className: 'cfy-sub' }, t('subtitle')),
          ),
          h('div', { className: 'cfy-actions' },
            h('span', { className: `cfy-pill ${online ? 'cfy-pill-on' : 'cfy-pill-off'}` },
              online ? t('online') : starting ? t('starting') : t('offline')),
            status !== null && (status.models ?? []).length > 0 && h('span', { className: 'cfy-pill' },
              `${t('models')}: ${((status.models ?? []).find(entry => entry.id === model) ?? (status.models ?? []).find(entry => entry.available) ?? {}).label ?? '—'}`),
            !online && h('button', { type: 'button', className: 'cfy-btn', disabled: starting, onClick: startServer },
              starting ? t('starting') : t('start')),
            h('button', { type: 'button', className: 'cfy-btn', onClick: () => { loadStatus(); loadGallery() } }, t('refresh')),
          ),
        ),

        h('section', { className: 'cfy-card' },
          h('span', { className: 'cfy-label' }, t('presets')),
          presets.length > 0
            ? h('div', { className: 'cfy-presets' },
              ...presets.map((entry) => {
                const active = entry.id === style
                const blurb = entry.blurb === undefined ? undefined : entry.blurb[lang]
                return h('button', {
                  key: entry.id,
                  type: 'button',
                  className: 'cfy-preset',
                  'data-active': active ? 'true' : 'false',
                  'aria-pressed': active ? 'true' : 'false',
                  onClick: () => choosePreset(entry),
                },
                  h('span', { className: 'cfy-preset-mark' }, PresetGlyph(entry)),
                  h('span', { className: 'cfy-preset-body' },
                    h('span', { className: 'cfy-preset-name' }, entry[lang] ?? entry.en ?? entry.id),
                    blurb !== undefined ? h('span', { className: 'cfy-preset-blurb' }, blurb) : null,
                  ),
                  active ? h('span', { className: 'cfy-preset-check' }, '\u2713') : null,
                )
              }),
            )
            : h('span', { className: 'cfy-hint' }, t('presetsHint')),
          pixelMode && h('div', { className: 'cfy-row' },
            h('div', { className: 'cfy-field' },
              h('span', { className: 'cfy-label' }, t('assetSize')),
              h('select', {
                className: 'cfy-select',
                value: assetSize,
                onChange: (event) => setAssetSize(Number(event.currentTarget.value)),
              }, ...[32, 64, 128, 256].map(value => h('option', { key: value, value }, `${value}\u00d7${value}`))),
            ),
            h('div', { className: 'cfy-field' },
              h('span', { className: 'cfy-label' }, t('palette')),
              h('input', {
                className: 'cfy-input',
                type: 'number',
                min: 2,
                max: 256,
                value: paletteColors,
                onChange: (event) => setPaletteColors(Number(event.currentTarget.value)),
              }),
            ),
          ),
          pixelMode && h('span', { className: 'cfy-hint' }, t('pixelHint')),
          !pixelMode && artists.length > 0 && h('div', { className: 'cfy-field', style: { gap: '7px' } },
            h('span', { className: 'cfy-label' }, t('artistStyle')),
            h('div', { className: 'cfy-chips' },
              h('button', {
                key: 'generic',
                type: 'button',
                className: 'cfy-chip',
                'data-kind': 'look',
                'data-active': artist === '' ? 'true' : 'false',
                'aria-pressed': artist === '' ? 'true' : 'false',
                onClick: () => setArtist(''),
              }, t('artistGeneric')),
              ...artists.map(entry => h('button', {
                key: entry.id,
                type: 'button',
                className: 'cfy-chip',
                'data-kind': 'look',
                title: entry.zh,
                'data-active': entry.id === artist ? 'true' : 'false',
                'aria-pressed': entry.id === artist ? 'true' : 'false',
                onClick: () => setArtist(entry.id),
              }, (entry.short ?? {})[lang] ?? entry[lang] ?? entry.id)),
            ),
          ),
          !pixelMode && styleLoras.length > 0 && h('div', { className: 'cfy-field', style: { gap: '7px' } },
            h('span', { className: 'cfy-label' }, t('loraStyle')),
            h('div', { className: 'cfy-chips' },
              h('button', {
                key: 'none',
                type: 'button',
                className: 'cfy-chip',
                'data-kind': 'lora',
                'data-active': lora === '' ? 'true' : 'false',
                'aria-pressed': lora === '' ? 'true' : 'false',
                onClick: () => setLora(''),
              }, t('loraNone')),
              ...styleLoras.map(entry => h('button', {
                key: entry.id,
                type: 'button',
                className: 'cfy-chip',
                'data-kind': 'lora',
                title: `${entry[lang] ?? entry.id} · trigger: ${entry.trigger}`,
                'data-active': entry.id === lora ? 'true' : 'false',
                'aria-pressed': entry.id === lora ? 'true' : 'false',
                onClick: () => {
                  setLora(entry.id)
                  setLoraStrength(entry.strength)
                },
              }, entry[lang] ?? entry.id)),
            ),
            activeLora !== null && h('div', { className: 'cfy-row' },
              h('div', { className: 'cfy-field' },
                h('span', { className: 'cfy-label' }, t('loraStrength')),
                h('input', {
                  className: 'cfy-input',
                  type: 'number',
                  min: 0,
                  max: 1.5,
                  step: 0.05,
                  value: loraStrength,
                  onChange: (event) => setLoraStrength(Number(event.currentTarget.value)),
                }),
              ),
              h('span', { className: 'cfy-hint', style: { alignSelf: 'flex-end', paddingBottom: '6px' } },
                `trigger: “${activeLora.trigger}”`),
            ),
          ),
        ),

        h('section', { className: 'cfy-card' },
          h('span', { className: 'cfy-label' }, t('idea')),
          h('textarea', {
            className: 'cfy-area', value: idea, placeholder: t('ideaPlaceholder'),
            onChange: event => setIdea(event.currentTarget.value),
          }),
          h('div', { className: 'cfy-row' },
            h('div', { className: 'cfy-field' },
              h('span', { className: 'cfy-label' }, t('mode')),
              h('select', { className: 'cfy-select', value: mode, onChange: event => setMode(event.currentTarget.value) },
                h('option', { value: 'auto' }, t('modeAuto')),
                h('option', { value: 'llm' }, t('modeLlm')),
                h('option', { value: 'rules' }, t('modeRules')),
                h('option', { value: 'off' }, t('modeOff')),
              ),
            ),
            h('button', { type: 'button', className: 'cfy-btn', disabled: optimizing || idea.trim() === '', onClick: optimizePrompt },
              optimizing ? t('optimizing') : t('optimize')),
          ),
          h('span', { className: 'cfy-label' }, t('optimized')),
          h('textarea', {
            className: 'cfy-area', value: optimized, placeholder: t('optimized'),
            onChange: event => setOptimized(event.currentTarget.value),
            style: { minHeight: '86px' },
          }),
        ),

        !pixelMode && h('section', { className: 'cfy-card' },
          h('span', { className: 'cfy-label' }, t('reference')),
          h('div', { className: 'cfy-ref' },
            reference === null
              ? h('label', { className: 'cfy-ref-add', title: t('referenceHint') },
                h('span', null, '+'),
                h('input', {
                  type: 'file',
                  accept: 'image/png,image/jpeg,image/webp',
                  onChange: (event) => pickReference(event.currentTarget.files?.[0]),
                }),
              )
              : h('div', { className: 'cfy-ref-thumb' },
                h('img', { src: reference.dataUrl, alt: t('reference') }),
                h('button', { type: 'button', onClick: () => {
                  setReference(null)
                  setSize(previous => (previous === 'follow' ? (status?.defaults?.size ?? '1024x1024') : previous))
                } }, t('referenceRemove')),
              ),
            h('div', { className: 'cfy-ref-meta' },
              h('span', { className: 'cfy-hint' }, reference === null ? t('referenceHint') : (reference.name !== '' ? reference.name : t('reference'))),
              reference !== null && h('select', {
                className: 'cfy-select',
                value: refMode,
                onChange: (event) => setRefMode(event.currentTarget.value),
              },
                h('option', { value: 'identity' }, t('referenceIdentity')),
                h('option', { value: 'style' }, t('referenceStyle')),
              ),
              reference !== null && h('span', { className: 'cfy-hint' }, t('referenceSize')),
            ),
          ),
        ),

        h('section', { className: 'cfy-card' },
          h('div', { className: 'cfy-row' },
            h('div', { className: 'cfy-field' },
              h('span', { className: 'cfy-label' }, t('model')),
              h('select', { className: 'cfy-select', value: model, onChange: event => chooseModel(event.currentTarget.value) },
                (status?.models ?? []).length === 0
                  ? h('option', { value: '' }, t('noModels'))
                  : (status?.models ?? []).map(entry => h('option', {
                    key: entry.id,
                    value: entry.id,
                    disabled: !entry.available,
                  }, entry.available ? entry.label : `${entry.label} — 未安装`)),
              ),
            ),
            h('div', { className: 'cfy-field' },
              h('span', { className: 'cfy-label' }, t('size')),
              h('select', { className: 'cfy-select', value: size, disabled: pixelMode, onChange: event => setSize(event.currentTarget.value) },
                reference !== null && h('option', { value: 'follow' }, t('followReference')),
                ...(status?.sizes ?? ['1024x1024']).map((value) => {
                  const [w, hgt] = value.split('x').map(Number)
                  return h('option', { key: value, value }, `${w}×${hgt} · ${ratioOf(w, hgt)}`)
                }),
              ),
            ),
            h('div', { className: 'cfy-field' },
              h('span', { className: 'cfy-label' }, t('steps')),
              h('input', { className: 'cfy-input', type: 'number', min: 1, max: 60, value: steps, onChange: event => setSteps(event.currentTarget.value) }),
            ),
            h('div', { className: 'cfy-field' },
              h('span', { className: 'cfy-label' }, t('guidance')),
              h('input', {
                className: 'cfy-input',
                type: 'number',
                min: 0,
                max: 10,
                step: 0.5,
                value: guidance,
                disabled: guidanceLocked,
                title: guidanceLocked ? t('guidanceLocked') : undefined,
                onChange: event => setGuidance(event.currentTarget.value),
              }),
            ),
            h('div', { className: 'cfy-field' },
              h('span', { className: 'cfy-label' }, t('seed')),
              h('input', { className: 'cfy-input', type: 'number', placeholder: t('random'), value: seed, onChange: event => setSeed(event.currentTarget.value) }),
            ),
            h('button', { type: 'button', className: 'cfy-btn cfy-btn-primary', disabled: busy || model === '' || (idea.trim() === '' && optimized.trim() === ''), onClick: generate },
              busy ? t('generating') : t('generate')),
            busy && h('button', { type: 'button', className: 'cfy-btn', onClick: stopGeneration }, t('cancel')),
          ),
          busy && h('div', { className: 'cfy-progress', 'data-determinate': progress !== null ? 'true' : 'false' },
            h('i', { style: progress !== null ? { width: `${progress.percent}%`, animation: 'none' } : undefined })),
          busy && h('div', { className: 'cfy-progress-row' },
            h('span', { className: 'cfy-hint' },
              progress !== null
                ? `${t('running')} · ${progress.value}/${progress.max}`
                : phase === 'running' ? t('running') : t('queued')),
            h('span', { className: 'cfy-percent' },
              `${progress === null ? '' : `${progress.percent}% · `}${t('elapsed')} ${Math.floor(elapsedMs / 60000)}:${String(Math.floor(elapsedMs / 1000) % 60).padStart(2, '0')}`),
          ),
          status !== null && status.online === false && h('span', { className: 'cfy-warn' }, t('offlineHint')),
          h('span', { className: 'cfy-hint' }, t('slow')),
          guidanceLocked && h('span', { className: 'cfy-hint' }, t('guidanceLocked')),
          error !== null && h('span', { className: 'cfy-error' }, `${t('error')}: ${error}`),
        ),

        latest !== null && h('section', { className: 'cfy-card' },
          h('span', { className: 'cfy-label' }, t('result')),
          h('div', { className: 'cfy-split' },
            h('div', { className: 'cfy-preview' }, h('img', {
              src: displaySrc(latest),
              alt: t('result'),
              // A 64 px sprite stretched by the browser must stay crisp.
              style: latest.pixel ? { imageRendering: 'pixelated' } : undefined,
            })),
            h('div', { style: { flex: '1 1 260px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 } },
              h('span', { className: 'cfy-meta' },
                latest.modelLabel ? `${latest.modelLabel}` : latest.model ? `${latest.model}` : '',
                latest.width ? `${latest.width}×${latest.height}` : '',
                latest.steps ? `${latest.steps} steps` : '',
                latest.seed !== undefined ? `seed ${latest.seed}` : '',
                latest.guidance ? `guidance ${latest.guidance}` : '',
                latest.artist ? `artist: ${(artists.find(entry => entry.id === latest.artist) ?? {}).zh ?? latest.artist}` : '',
                latest.lora ? `LoRA: ${latest.lora.label} @${latest.lora.strength}` : '',
                latest.pixel ? `${latest.pixel.target}×${latest.pixel.target} px · ${latest.pixel.colors} colours` : '',
                latest.referenceMode ? `${t('reference')}: ${latest.referenceMode}` : '',
              ),
              latest.pixel ? h('a', {
                className: 'cfy-dl',
                href: `/comfyui/image?name=${encodeURIComponent(latest.name)}`,
                download: latest.name,
                title: `${latest.pixel.target}×${latest.pixel.target} PNG`,
              }, `${t('downloadSprite')} · ${latest.pixel.target}×${latest.pixel.target}`) : null,
              latest.optimized && h('p', { className: 'cfy-hint', style: { margin: 0 } }, latest.optimized),
            ),
          ),
        ),

        h('section', { className: 'cfy-card' },
          h('span', { className: 'cfy-label' }, `${t('gallery')} · ${gallery.length}`),
          gallery.length === 0
            ? h('span', { className: 'cfy-empty' }, t('emptyGallery'))
            : h('div', { className: 'cfy-gallery' },
              ...gallery.slice(0, 60).map(entry => h('div', {
                key: entry.name,
                className: 'cfy-thumb',
                title: entry.prompt,
                role: 'button',
                tabIndex: 0,
                onClick: () => setResult({ url: `/comfyui/image?name=${encodeURIComponent(entry.name)}`, ...entry }),
                onKeyDown: (event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    setResult({ url: `/comfyui/image?name=${encodeURIComponent(entry.name)}`, ...entry })
                  }
                },
              },
              h('img', {
                src: displaySrc({ ...entry, url: `/comfyui/image?name=${encodeURIComponent(entry.name)}` }),
                alt: entry.prompt,
                loading: 'lazy',
                style: entry.pixel ? { imageRendering: 'pixelated' } : undefined,
              }),
              h('button', {
                type: 'button',
                className: 'cfy-thumb-del',
                'data-armed': pendingDelete === entry.name ? 'true' : 'false',
                title: pendingDelete === entry.name ? t('confirmDelete') : t('delete'),
                onClick: (event) => {
                  event.stopPropagation()
                  deleteImage(entry.name)
                },
              }, pendingDelete === entry.name ? t('confirmDelete') : t('delete')),
              )),
            ),
        ),
      )
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { en, zh }), 'comfyui: copy dictionaries')
        ctx.effect(() => {
          const style = document.createElement('style')
          style.dataset.plugin = 'comfyui'
          style.textContent = CSS
          document.head.appendChild(style)
          return () => { style.remove() }
        }, 'comfyui: stylesheet')
        const t = ctx.locale.bind(NS)
        // The `main` seat passes no locale binding; hand the bound translator down.
        const Home = () => h(Panel, { t })
        ctx.effect(() => ctx.slots.inject('main', () => ctx.slots.register({
          name: 'main',
          key: PANEL_ID,
        }, Home)), 'comfyui: main panel')
        ctx.effect(() => ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist',
          id: PANEL_ID,
          order: 25,
          label: () => t('title'),
        }, ComfyIcon)), 'comfyui: sidebar row')
      },
    }
  },
})
