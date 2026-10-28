#!/usr/bin/env bash
# Fetch the Krea 2 style LoRAs the illustration preset offers.
#
#   ./scripts/download-loras.sh                 # the 二次元 four: celanime + retroanime + softwatercolor + darkbrush
#   ./scripts/download-loras.sh celanime        # just one
#   ./scripts/download-loras.sh all             # every LoRA in the catalog
#
# Files land in $COMFY_ROOT/models/loras (default ~/tools/ComfyUI) and show up as
# chips in the panel right after the next Refresh. Downloads go through
# hf-mirror.com by default; override with HF_HOST=https://huggingface.co.
set -euo pipefail

HOST="${HF_HOST:-https://hf-mirror.com}"
DEST="${COMFY_ROOT:-$HOME/tools/ComfyUI}/models/loras"
mkdir -p "$DEST"

# id | repo | path inside repo | trigger word | look
CATALOG=(
  "celanime|ilkerzgi/krea-2-cel-shaded-daytime-anime-lora|cel-shaded-daytime-anime-comfy.safetensors|cel shaded daytime anime style|现代赛璐璐日间动漫（fal 社区，推荐 1.0-1.25）"
  "retroanime|Comfy-Org/Krea-2|loras/krea2_retroanime.safetensors|purple retro anime style|90s 紫调赛璐珞动画（官方）"
  "softwatercolor|Comfy-Org/Krea-2|loras/krea2_softwatercolor.safetensors|art deco watercolor style|装饰艺术水彩（官方）"
  "darkbrush|Comfy-Org/Krea-2|loras/krea2_darkbrush.safetensors|monochrome ink wash style|水墨墨绘 / 漫画分镜（官方）"
  "dotmatrix|Comfy-Org/Krea-2|loras/krea2_dotmatrix.safetensors|monochrome stippling style|单色点刻版画（官方）"
  "neondrip|Comfy-Org/Krea-2|loras/krea2_neondrip.safetensors|textured abstract style|霓彩流挂抽象（官方）"
  "rainywindow|Comfy-Org/Krea-2|loras/krea2_rainywindow.safetensors|rainy window style|雨窗、玻璃水痕（官方）"
  "sunsetblur|Comfy-Org/Krea-2|loras/krea2_sunsetblur.safetensors|ethereal motion blur style|暮色长曝残影（官方）"
  "vintagetarot|Comfy-Org/Krea-2|loras/krea2_vintagetarot.safetensors|vintage tarot style|复古塔罗插画（官方）"
  "kidsdrawing|Comfy-Org/Krea-2|loras/krea2_kidsdrawing.safetensors|naive expressive sketch style|稚拙蜡笔速写（官方）"
)

if [ "$#" -eq 0 ]; then
  WANT=(celanime retroanime softwatercolor darkbrush)
elif [ "$1" = "all" ]; then
  WANT=()
  for row in "${CATALOG[@]}"; do WANT+=("${row%%|*}"); done
else
  WANT=("$@")
fi

for id in "${WANT[@]}"; do
  row=""
  for candidate in "${CATALOG[@]}"; do
    [ "${candidate%%|*}" = "$id" ] && row="$candidate"
  done
  if [ -z "$row" ]; then
    ids=""
    for candidate in "${CATALOG[@]}"; do ids="$ids ${candidate%%|*}"; done
    echo "unknown LoRA id: $id (known:$ids)" >&2
    exit 2
  fi
  IFS='|' read -r _ repo path _ _ <<<"$row"
  file="$(basename "$path")"
  target="$DEST/$file"
  if [ -s "$target" ]; then
    echo "have   $file"
    continue
  fi
  echo "fetch  $file  <- $repo"
  curl -fL --retry 3 --progress-bar -o "$target.part" "$HOST/$repo/resolve/main/$path"
  mv "$target.part" "$target"
done

echo
printf '%-12s %-34s %s\n' "chip (id)" "trigger word (appended to the prompt)" "look"
for row in "${CATALOG[@]}"; do
  IFS='|' read -r id _ _ trigger look <<<"$row"
  for want in "${WANT[@]}"; do
    [ "$id" = "$want" ] && printf '%-12s %-34s %s\n' "$id" "$trigger" "$look"
  done
done
