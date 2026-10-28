# dsh-comfyui

Local ComfyUI text-to-image for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).

- **Generation panel** (sidebar entry + main panel): prompt box, Krea-tuned prompt optimizer, size/steps/guidance/seed,
  live progress, last result, and an on-disk gallery.
- **Auto-start**: probes `127.0.0.1:8188` and starts `~/tools/ComfyUI/run.sh` when nothing answers.
- **Chat tool** `image_generate`: the agent generates images into the conversation and copies them into the
  workspace `generated/` folder.
- **Model discovery**: reads ComfyUI's `/object_info`, so GGUF (`UnetLoaderGGUF` + `CLIPLoaderGGUF`) and
  regular `UNETLoader`/`CLIPLoader` installs both work. The bundled preset is **Krea 2 Turbo** (GGUF Q4 +
  Qwen3-VL text encoder + Qwen-Image VAE).

## Environment

The plugin drives a **local ComfyUI**; nothing is bundled. A full checklist — ComfyUI install, the three
custom nodes, the Krea 2 model files, the LoRAs each feature needs, verification commands and known
traps (FP8 on Apple Silicon, missing OpenCV, slow Hugging Face downloads) — lives in
[SETUP.md](SETUP.md). Short version:

```sh
./scripts/download-models.sh   # 7.0 GB GGUF + 8.3 GB text encoder + VAE
./scripts/download-loras.sh    # optional style LoRAs
```

### Install into a DSH profile

```sh
cd ~/.dsh/profiles/<profile>
# 1. install the package (verified form: pnpm add "<name>@file:<absolute path>")
pnpm add "dsh-comfyui@file:$HOME/project/dsh-comfyui"
# 2. append the row below to cordis.patch.yml
# 3. reload it (touch cordis.patch.yml, or restart the app), then refresh the page
```

The row in `cordis.patch.yml`:

```yaml
- insert:
    - id: comfyui
      name: dsh-comfyui
```

First start may take a while: the plugin probes `127.0.0.1:8188`, starts
`<comfyRoot>/run.sh` when nothing answers, then loads ~15 GB of weights on the first job.

### Panel quick tour

Sidebar → **ComfyUI 生图**. Write an idea, optionally press **优化提示词** (rules or model rewrite), pick a
preset and size, then **生成**. While it renders you get step progress, elapsed time and a **停止** button;
the panel keeps its draft and in-flight job if you switch pages. Finished images land in the gallery below
(hover a thumbnail → **删除** removes the file, second click confirms). Chat generations additionally copy
into `<workspace>/generated/`.

## Pixel game assets

Pick the **像素游戏资产** preset in the panel (or pass `style: "pixel"` / `pixel_asset: true`) to produce true pixel-art sprites:

1. a Krea 2 pixel LoRA (`e-n-v-y/Krea-2-Pixel-Art`, 32/64/128 variants) renders a 1024² sheet,
2. `Krea2PixelArtRefiner` collapses it onto the requested logical grid and reduces the palette
   (needs `envy-ai/ComfyUI-Krea2-Pixel-Art-Refiner` plus `opencv-python-headless`),
3. the **gallery asset really is 32/64/128/256 px** — not a downscaled illustration. The raw 1024²
   render is never saved anywhere,
4. a second refiner expands that same collapsed grid back to 1024² with hard blocks
   (`scale_to_original: true`). This block PNG is the *preview*: the gallery and the chat show it
   (larger than 64 px, still crisp pixel art), while the small sprite stays the downloadable asset.
   It lands next to the sprite as `<name>.preview.png` and `gallery.json` links it as `preview`.

The host also refuses to store a "pixel" job whose image is larger than the requested sprite size, so a
graph change can never quietly put a smooth 1024² render in the pixel slot.

Panel options: sprite size (32/64/128/256) and palette size (2–256, default 24). Tool:
`image_generate({ prompt: "a wooden treasure chest", pixel_asset: true, asset_size: 64, palette_colors: 24 })`.

## Reference images (image + text)

`krea2-turbo` can take a reference image, wired through the Krea 2 edit path:

| mode | LoRA | use |
|---|---|---|
| `identity` | `krea2_identity_edit_v1_1_r64.safetensors` | keep a character / persona consistent |
| `style` | `krea2_style_reference.safetensors` | copy the look of a picture |

Install requirements once:

```sh
cd ~/tools/ComfyUI
git clone https://github.com/ostris/ComfyUI-Krea2-Ostris-Edit.git custom_nodes/ComfyUI-Krea2-Ostris-Edit
# LoRA files land in models/loras/
```

Panel: upload a reference in the **参考图** card, pick 人设 / 风格, then generate. Chat tool:
`image_generate({ prompt, reference: "/path/to/portrait.png", reference_mode: "identity" })`.

Output size defaults to **跟随参考图** (Kontext scale to ~1MP); pick a concrete size in the size dropdown to
override it. Each generation costs more: the edit LoRA plus vision encoding make a step noticeably slower
than plain text-to-image on Apple Silicon (~50-60 s per step here).

## Presets

The panel offers exactly two presets, shown side by side in one **预设** card:

| preset | id | what it does |
|---|---|---|
| 画师风插画 | `illustration` | finished digital illustration in a distinctive artist style — linework, brushwork, deliberate palette |
| 像素游戏资产 | `pixel` | true sprites: rendered at 1024² through the pixel LoRA, then collapsed to 32–256 px with a small palette |

The list is a single registry (`STYLES` in `lib/prompt.js`): the panel tiles, the `image_generate`
`style` enum and the rule-mode facets all read it, so adding a preset is one entry there (plus, if you
want a custom mark, one branch in `PresetGlyph` in `client.js`). Tile captions come from the `blurb`
field, localised through `{ zh, en }`.

### 画师风格（illustration 的子选项）

Picking **画师风插画** reveals a chip row under the two tiles: **通用** plus 14 artist references
(新海诚、吉卜力、京阿尼、米山舞、望月けい、村田莲尔、天野喜孝、安倍吉俊、CLAMP、Ilya Kuvshinov、WLOP、
loundraw、鸟山明、荒木飞吕彦). An artist is one record in `ARTISTS` (same file): its `fragment` replaces
the generic illustration style sentence, `short` is the chip label, `zh`/`en` the tooltip. 通用 means no
artist. The pixel preset ignores the artist row entirely.

These are style hommages, not attribution: some artists object to AI imitation, so treat them as
references for personal work and never present the output as theirs.

Chat tool: `image_generate({ prompt, style: "illustration", artist: "shinkai" })`, or `artist: "ghibli"`
and so on; omit `artist` for a generic illustration.

### 画风 LoRA（二次元向）

Under the look row there is a **画风 LoRA** row listing the official Krea 2 style LoRAs that are actually
installed in `models/loras`. Picking one patches the UNET (`LoraLoaderModelOnly`) and appends that LoRA's
official trigger word to the prompt — the same recipe as the ComfyUI Krea 2 template.

| chip | file | trigger word | look | strength |
|---|---|---|---|---|
| 赛璐璐日间动漫 | `cel-shaded-daytime-anime-comfy` | `cel shaded daytime anime style` | 现代 TV 动画赛璐璐（社区，fal 系列） | 1.0 (1.0-1.25) |
| 复古动漫 | `krea2_retroanime` | `purple retro anime style` | 90s cel anime, purple palette | 1.0 |
| 艺术水彩 | `krea2_softwatercolor` | `art deco watercolor style` | art-deco watercolour | 1.0 |
| 水墨笔触 | `krea2_darkbrush` | `monochrome ink wash style` | sumi ink wash | 1.0 |
| 点阵网点 | `krea2_dotmatrix` | `monochrome stippling style` | halftone stippling | 1.0 |
| 霓彩流挂 | `krea2_neondrip` | `textured abstract style` | neon drips | 1.0 |
| 雨窗 | `krea2_rainywindow` | `rainy window style` | rain on glass | 1.0 |
| 暮色残影 | `krea2_sunsetblur` | `ethereal motion blur style` | long-exposure blur | 1.0 |
| 复古塔罗 | `krea2_vintagetarot` | `vintage tarot style` | tarot illustration | 1.0 |
| 童趣速写 | `krea2_kidsdrawing` | `naive expressive sketch style` | crayon sketch | 1.0 |

Trigger words and the 1.0 strength come from the official Comfy-Org/Krea-2 card; 赛璐璐日间动漫 is a
community LoRA ([ilkerzgi/krea-2-cel-shaded-daytime-anime-lora](https://huggingface.co/ilkerzgi/krea-2-cel-shaded-daytime-anime-lora),
trained on Krea 2 Turbo, Krea 2 Community License — commercial use needs your own check). Only installed
files show up as chips (`/object_info` decides), so the row stays honest.

```sh
./scripts/download-loras.sh            # 二次元四件套: celanime + retroanime + softwatercolor + darkbrush
./scripts/download-loras.sh all        # all ten (5.3 GB); the chips row then shows every one
```

Trigger words and the 1.0 strength below are checked against the official `Comfy-Org/Krea-2` model card;
only files that exist in `models/loras` become chips, so an un-downloaded row simply stays hidden.

**Do not** put `krea2_turbo_lora_rank_64_bf16.safetensors` on the Turbo checkpoint: it is the
Raw→Turbo distillation delta, meant for `krea2_raw` (it rewrites the same capability that Turbo already
has). It is deliberately absent from the panel's LoRA list.

Strength is editable next to the row (0-1.5). Official guidance is 1.0; drop to ~0.6-0.8 when a named
artist prompt should dominate over the LoRA's own look.

Chat tool: `image_generate({ prompt, style: "illustration", artist: "anime", lora: "retroanime" })`.

Sampling defaults follow the installed model, not the plugin config: Krea 2 Turbo is 8 steps at CFG 1
(euler / simple, straight from the official ComfyUI Krea 2 template), and the panel locks the guidance
field because CFG 1 means it cannot have any effect. LoRAs do not need extra steps — the official LoRA
cards say their previews were rendered on Turbo at 8 steps, weight 1.0.

### 二次元尺寸与提示词

- Sizes are the official Krea 2 1K tiers: 1024², 4:5 `928×1152`, 2:3 `832×1248`, 9:16 `768×1376`,
  4:3 `1184×896`, 3:2 `1248×832`, 16:9 `1376×768`, 2.35:1 `1568×672`, plus 512/768 drafts and a 2K
  tier (`1440×1440`, `2048×1152`). Anime portraits work best from `832×1248` / `928×1152`.
- The model is trained for 1K-2K and the official guidance is to render **natively at the target size** —
  there is no hires-fix stage here. On this Mac a 1K render is minutes and a 2K render is roughly ten
  times that, so 2K is a "final render" switch, not a default.
- Write the medium explicitly, because Krea 2 leans photographic otherwise: `anime illustration`,
  `crisp cel-shading`, `flat shading`, `1990s cel animation`, `detailed digital painting`.
- No negative prompt: at CFG 1 the negative branch is skipped. `(word:1.2)` weighting also does not
  apply (the Qwen3-VL encoder reads whole sentences); move the important phrase earlier instead.
- LoRA trigger words are appended at the **end** of the prompt, which is exactly where the official and
  community cards say to put them.

Prompt modes (`rules` / `llm` / `auto` / `off`) are unchanged; `rules` assembles subject + medium +
lighting + perspective + texture + orientation, `llm` rewrites the idea as one English paragraph aimed at
the selected preset (no photographic-realism cues for `pixel`).

| mode | what happens |
|---|---|
| `rules` | deterministic facet assembly, no model call |
| `llm` | one completion rewrites the idea as one English paragraph for the preset |
| `auto` | `llm` when the configured model is available, otherwise `rules` |
| `off` | the prompt is sent as written |

## Configuration

```yaml
- insert:
    - id: comfyui
      name: dsh-comfyui
      config:
        comfyRoot: ~/tools/ComfyUI
        comfyUrl: http://127.0.0.1:8188
        autoStart: true
        provider: deepseek-account  # LLM used ONLY for prompt rewriting
        model: deepseek-flash       # that LLM's model id (not the image model)
        optimize: auto              # auto | llm | rules | off
        defaultModel: krea2-turbo   # image preset; auto-detected, rarely needs setting
        steps: 8                    # fallback only: the model preset wins
        guidance: 0                 # fallback only: locked at CFG 1 for Krea 2
        width: 1024                 # fallback when the request has no valid size
        height: 1024
        saveToWorkspace: true
        workspaceSubdir: generated
        timeoutMs: 900000           # per-image deadline
```

`provider` / `model` configure the prompt-rewrite LLM; `defaultModel` picks the image preset. Model files are
auto-detected from `/object_info`; override with `unetName`, `clipName`, `clipLName`, `vaeName` if needed.

## Notes

- Krea 2 Turbo renders 8 steps at CFG 1 (euler / simple). Measured here, 24 GB M5: ~20 s per step for plain
  text-to-image (~3 min per 1024² image), ~50-60 s per step with a reference image, ~3 min for a pixel sprite.
- Krea 2 weights are under the Krea 2 Community License (commercial conditions and a revenue threshold);
  third-party LoRAs carry their own licenses.
- The gallery lives in `<comfyRoot>/dsh-gallery/` (plus `gallery.json` and `jobs.json`); chat generations are
  also copied to `<workspace>/generated/`.

## Verification

`node scripts/smoke-panel.mjs` renders the panel headlessly against a fake host (tiny React stand-in)
and checks the preset card: two tiles in one card, no leftover look dropdown, sprite options only for
the pixel preset, reference card hidden for sprites. `LEGACY_HOST=1` runs it against a pre-0.5 status
payload to exercise the fallback path.

## License

MIT
