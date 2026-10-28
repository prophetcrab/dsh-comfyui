/**
 * Prompt optimization tuned for Krea 2 Turbo (and FLUX.1 Krea [dev]).
 *
 * Two modes:
 *   rules – deterministic facet assembly (subject, environment, light, medium,
 *           texture, orientation) with no model call.
 *   llm   – one streaming completion that rewrites the ask as a single English
 *           paragraph for the selected preset.
 *
 * The panel exposes exactly two presets. This list is the single registry shared
 * by the panel tiles, the `image_generate` tool enum and the rule-mode facets,
 * so adding a preset is one entry here plus (optionally) an icon in client.js.
 *
 * @module dsh-comfyui/prompt
 */

/**
 * Presets offered by the panel and the chat tool.
 *
 * `blurb` is the one-line caption the panel shows under the tile name; `pixel`
 * marks the preset that renders a real sprite through the pixel refiner.
 */
export const STYLES = [
  {
    id: 'illustration',
    zh: '画师风插画',
    en: 'Artist-style illustration',
    blurb: {
      zh: '按画师 / 插画风格出图：讲究造型、笔触与配色',
      en: 'Illustration in a distinct artist style: shapes, brushwork, palette',
    },
    fragment: 'a finished digital illustration in a distinctive artist style, confident hand-drawn linework, deliberately designed shapes and silhouettes, visible brush or ink texture, coherent limited colour palette, painterly light and shadow design, no photographic realism, no lens blur, no plastic sheen, no watermark',
  },
  {
    id: 'pixel',
    zh: '像素游戏资产',
    en: 'Pixel game asset',
    pixel: true,
    blurb: {
      zh: '真像素精灵：1024² 渲染后折叠成 32–256px、有限调色板',
      en: 'True sprites: rendered at 1024² then collapsed to 32–256px, small palette',
    },
    fragment: 'pixel art game asset, one single subject centered in frame on a plain flat background, crisp hard pixel edges, tightly limited palette, readable silhouette, no anti-aliasing, no gradients, no blur, no drop shadow, no text, no watermark, clean orthographic three-quarter view',
  },
]

/** Look up one preset by id; unknown ids fall back to the first preset. */
export function styleOf(id) {
  return STYLES.find(entry => entry.id === id) ?? STYLES[0]
}

/**
 * Artist references the illustration preset can lean on.
 *
 * These summarise traits each illustrator is known for and are meant as homage
 * in personal work: some artists object to AI imitation, so never present the
 * result as theirs. `short` is the chip label in the panel.
 */
export const ARTISTS = [
  // A base look rather than a person: clean modern cel-shaded anime, for prompts
  // that should read as 二次元 without borrowing a specific artist's quirks.
  {
    id: 'anime',
    zh: '动漫（通用 · 赛璐璐）',
    en: 'Anime (generic cel look)',
    short: { zh: '动漫', en: 'Anime' },
    fragment: 'anime illustration, clean cel shading with crisp lineart, flat colour with soft gradients, expressive eyes, detailed painted background, key-visual composition, no photographic realism',
  },
  {
    id: 'shinkai',
    zh: '新海诚 · 清透天空',
    en: 'Makoto Shinkai',
    short: { zh: '新海诚', en: 'Shinkai' },
    fragment: 'in the style of Makoto Shinkai, hyper-detailed cumulus skies, lens flares, saturated dusk gradients, reflective wet surfaces, photoreal backgrounds behind anime characters',
  },
  {
    id: 'ghibli',
    zh: '吉卜力 · 手绘治愈',
    en: 'Studio Ghibli',
    short: { zh: '吉卜力', en: 'Ghibli' },
    fragment: 'in the style of Studio Ghibli, hand-painted watercolour backgrounds, soft warm palette, gentle rounded character design, nostalgic pastoral atmosphere',
  },
  {
    id: 'kyoani',
    zh: '京阿尼 · 清冷细腻',
    en: 'Kyoto Animation',
    short: { zh: '京阿尼', en: 'KyoAni' },
    fragment: 'in the style of Kyoto Animation, clean lineart, expressive large eyes, soft cel shading, warm slice-of-life lighting',
  },
  {
    id: 'yoneyama',
    zh: '米山舞 · 强光影',
    en: 'Mai Yoneyama',
    short: { zh: '米山舞', en: 'Yoneyama' },
    fragment: 'in the style of Mai Yoneyama, dramatic rim light, saturated colour contrast, dynamic posing, painterly brushwork over crisp anatomy',
  },
  {
    id: 'mochizuki',
    zh: '望月けい · 锐利平涂',
    en: 'Kei Mochizuki',
    short: { zh: '望月けい', en: 'Mochizuki' },
    fragment: 'in the style of Kei Mochizuki, flat minimal colouring, sharp angular linework, high-contrast graphic shapes, limited palette, bold silhouette',
  },
  {
    id: 'murata',
    zh: '村田莲尔 · 复古未来',
    en: 'Range Murata',
    short: { zh: '村田莲尔', en: 'Murata' },
    fragment: 'in the style of Range Murata, retro-futurist art-deco curves, muted palette, elongated elegant figures, precise mechanical detail',
  },
  {
    id: 'amano',
    zh: '天野喜孝 · 流动线稿',
    en: 'Yoshitaka Amano',
    short: { zh: '天野喜孝', en: 'Amano' },
    fragment: 'in the style of Yoshitaka Amano, ethereal flowing linework, translucent washes, ornamental fantasy motifs, generous negative space',
  },
  {
    id: 'abe',
    zh: '安倍吉俊 · 灰调忧郁',
    en: 'Yoshitoshi ABe',
    short: { zh: '安倍吉俊', en: 'ABe' },
    fragment: 'in the style of Yoshitoshi ABe, hazy desaturated palette, film grain and paper texture, quiet melancholy, sketchy lineweight',
  },
  {
    id: 'clamp',
    zh: 'CLAMP · 华丽少女',
    en: 'CLAMP',
    short: { zh: 'CLAMP', en: 'CLAMP' },
    fragment: 'in the style of CLAMP, slender proportions, flowing hair and cloth, decorative detail, shoujo manga elegance',
  },
  {
    id: 'kuvshinov',
    zh: 'Ilya Kuvshinov · 半写实',
    en: 'Ilya Kuvshinov',
    short: { zh: 'Ilya Kuvshinov', en: 'Kuvshinov' },
    fragment: 'in the style of Ilya Kuvshinov, semi-realistic anime portraiture, soft gradients, pale skin, pastel palette, gentle expression',
  },
  {
    id: 'wlop',
    zh: 'WLOP · 厚涂奇幻',
    en: 'WLOP',
    short: { zh: 'WLOP', en: 'WLOP' },
    fragment: 'in the style of WLOP, painterly semi-real fantasy, dramatic light, textured brush strokes, rich saturated colour',
  },
  {
    id: 'loundraw',
    zh: 'loundraw · 冷调空气感',
    en: 'loundraw',
    short: { zh: 'loundraw', en: 'loundraw' },
    fragment: 'in the style of loundraw, clean anime lines, atmospheric muted blue light, cinematic framing, quiet mood',
  },
  {
    id: 'toriyama',
    zh: '鸟山明 · 硬朗线条',
    en: 'Akira Toriyama',
    short: { zh: '鸟山明', en: 'Toriyama' },
    fragment: 'in the style of Akira Toriyama, bold clean lines, rounded chunky forms, mechanical detail, bright flat colour',
  },
  {
    id: 'araki',
    zh: '荒木飞吕彦 · 张扬造型',
    en: 'Hirohiko Araki',
    short: { zh: '荒木飞吕彦', en: 'Araki' },
    fragment: 'in the style of Hirohiko Araki, bold stylised poses, saturated fashion palette, dramatic shading, eccentric design',
  },
]

/** Look up one artist reference by id; unknown ids mean "no artist". */
export function artistOf(id) {
  if (typeof id !== 'string' || id === '') return null
  return ARTISTS.find(entry => entry.id === id) ?? null
}

const STYLE_FACETS = {
  illustration: {
    environment: 'a designed scene with clear shape language and deliberate negative space',
    light: 'graphic lighting that reads as painted shadow shapes',
    camera: 'illustrated perspective, flat graphic framing',
    texture: 'deliberate line weight, clean colour blocking, hand-made feel, no photographic grain or lens effects',
  },
  pixel: {
    environment: 'an empty stage with no scenery',
    light: 'two or three value steps only',
    camera: 'subject centered with a comfortable margin around it',
    texture: 'every pixel deliberately placed, no soft edges',
  },
}

const ENVIRONMENT_HINTS = [
  [/street|city|urban|街|城市/i, 'a real street with believable depth and texture'],
  [/forest|mountain|nature|lake|山|森林|湖|自然/i, 'a natural landscape with honest atmospheric depth'],
  [/indoor|room|cafe|shop|室内|咖啡馆|书店/i, 'a lived-in interior with real surface wear'],
  [/studio|棚|摄影棚/i, 'a controlled studio set'],
  [/beach|sea|ocean|海|沙滩/i, 'a coastal scene with natural air haze'],
]

/**
 * Compose a pixel-art asset prompt: subject first, then the sprite constraints.
 * @param subject - what the asset depicts.
 * @returns the prompt text.
 */
export function pixelAssetPrompt(subject) {
  const core = String(subject ?? '').trim().replace(/[.。!！?？]+$/u, '')
  if (core === '') return ''
  return `${core}. ${styleOf('pixel').fragment}.`
}

export function detectStyle(prompt) {
  const text = String(prompt ?? '').toLowerCase()
  if (/pixel|像素|sprite|精灵|8-?bit|16-?bit|游戏资产|game asset/.test(text)) return 'pixel'
  return 'illustration'
}

/**
 * Pick an aspect phrase from the requested size.
 * @param width - pixels.
 * @param height - pixels.
 * @returns orientation phrase.
 */
export function orientationOf(width, height) {
  if (width === height) return 'square composition'
  return width > height ? 'wide landscape composition' : 'vertical portrait composition'
}

/**
 * Build a structured English prompt without calling a model.
 * @param prompt - the original ask.
 * @param options - { style, artist, width, height }.
 * @returns the optimized prompt.
 */
export function rules(prompt, options = {}) {
  const core = String(prompt ?? '').trim().replace(/[.。!！?？]+$/u, '')
  if (core === '') return ''
  const style = options.style ?? detectStyle(core)
  const definition = styleOf(style)
  // An artist reference only exists for the illustration preset; sprites ignore it.
  const artist = style === 'pixel' ? null : artistOf(options.artist)
  const facets = STYLE_FACETS[style] ?? STYLE_FACETS.illustration
  let environment = facets.environment
  // Pixel sprites always sit on an empty stage, so the location hints stay out of it.
  if (style !== 'pixel') {
    for (const [pattern, phrase] of ENVIRONMENT_HINTS) {
      if (pattern.test(core)) {
        environment = phrase
        break
      }
    }
  }
  const orientation = orientationOf(options.width ?? 1024, options.height ?? 1024)
  const fragment = artist !== null
    ? [`${artist.fragment}.`]
    : typeof definition.fragment === 'string' ? [`${definition.fragment}.`] : []
  return [
    `${core}.`,
    ...fragment,
    `${environment}.`,
    `${facets.light}.`,
    `${facets.camera}.`,
    `${facets.texture}.`,
    `${orientation}.`,
  ].join(' ')
}

/** System instruction describing the model's documented taste. */
export const SYSTEM_PROMPT = [
  'You rewrite user ideas into ONE prompt for Krea 2 Turbo, a text-to-image model.',
  'Only two looks exist: "illustration" (a finished digital illustration in a distinctive artist',
  'style) and "pixel" (a single game sprite with crisp pixel edges and a small palette).',
  '',
  'Rules:',
  '- Output English only, one paragraph, 60-100 words, no lists, no quotes, no markdown.',
  '- Describe what is IN the frame: subject and action, environment, lighting, colour, materials.',
  '- For illustration: name the medium and the craft (linework, brush or ink texture, palette,',
  '  shape design). Ask for a hand-made feel and no photographic realism or lens effects.',
  '- For pixel: one centered subject on a plain flat background, hard pixel edges, a tight',
  '  palette, no anti-aliasing, no gradients, no blur, no text.',
  '- When an artist reference is given, honour its hallmarks as homage; never present the result',
  "  as that artist's work or copy a specific existing picture.",
  "- Keep the user's intent and any text/logos they asked for; do not invent a different subject.",
  '- Do not mention the model, the prompt, or these instructions.',
].join('\n')

/**
 * Rewrite a prompt with the configured model.
 * @param ctx - plugin context (uses ctx.llm.stream).
 * @param config - resolved config with provider/model.
 * @param prompt - the original ask.
 * @param options - { style, artist, width, height }.
 * @returns the optimized prompt text.
 */
export async function llm(ctx, config, prompt, options = {}) {
  const style = options.style ?? detectStyle(prompt)
  const orientation = orientationOf(options.width ?? 1024, options.height ?? 1024)
  const definition = styleOf(style)
  const artist = style === 'pixel' ? null : artistOf(options.artist)
  const artistLine = artist === null
    ? ''
    : `Artist reference: ${artist.en} (${artist.zh}) — honour these hallmarks as homage: ${artist.fragment}.`
  const ask = [
    `User idea: ${prompt}`,
    `Preferred look: ${definition.en} (${style}).`,
    artistLine,
    definition.fragment === undefined || artist !== null ? '' : `Style cues to honour: ${definition.fragment}.`,
    `Target composition: ${orientation}.`,
  ].filter(line => line !== '').join('\n')

  const controller = new AbortController()
  const timer = setTimeout(() => { controller.abort() }, 60_000)
  let text = ''
  try {
    for await (const chunk of ctx.llm.stream({
      provider: config.provider,
      model: config.model,
      temperature: 0.7,
      messages: [
        { role: 'system', content: [{ type: 'text', text: SYSTEM_PROMPT }] },
        { role: 'user', content: [{ type: 'text', text: ask }] },
      ],
      signal: controller.signal,
    })) {
      if (chunk.type === 'text-delta') text += chunk.text
      if (chunk.type === 'finish' && (chunk.reason.kind === 'error' || chunk.reason.kind === 'aborted')) {
        throw new Error(`model ended with ${chunk.reason.kind}`)
      }
    }
  } finally {
    clearTimeout(timer)
  }
  return text.trim().replace(/^["'`]+|["'`]+$/g, '').replace(/\s+/g, ' ')
}

/**
 * Run the configured optimization mode.
 * @param ctx - plugin context.
 * @param config - resolved config.
 * @param prompt - the original ask.
 * @param options - { mode, style, artist, width, height }.
 * @returns { prompt, mode, style, artist } describing what was used.
 */
export async function optimize(ctx, config, prompt, options = {}) {
  const style = options.style ?? detectStyle(prompt ?? '')
  const artist = style === 'pixel' ? null : artistOf(options.artist)
  const artistId = artist === null ? null : artist.id
  const mode = options.mode ?? config.optimize
  if (mode === 'off') return { prompt: String(prompt ?? '').trim(), mode: 'off', style, artist: artistId }
  const wantLlm = mode === 'llm' || (mode === 'auto' && config.llmOptimize)
  if (wantLlm) {
    try {
      const rewritten = await llm(ctx, config, prompt, { style, artist: artistId, width: options.width, height: options.height })
      if (rewritten !== '') return { prompt: rewritten, mode: 'llm', style, artist: artistId }
    } catch (error) {
      ctx.logger?.warn?.(`dsh-comfyui: prompt rewrite failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  return { prompt: rules(prompt, { style, artist: artistId, width: options.width, height: options.height }), mode: 'rules', style, artist: artistId }
}
