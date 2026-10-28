#!/usr/bin/env bash
# Fetch the ComfyUI models the plugin needs for Krea 2 Turbo.
#
#   ./scripts/download-models.sh            # the three required files
#   ./scripts/download-models.sh --check    # only report what is missing
#
# Files land in $COMFY_ROOT/models (default ~/tools/ComfyUI) and are skipped when
# already present. Downloads go through hf-mirror.com by default; override with
# HF_HOST=https://huggingface.co.
#
# LoRAs (edit / style reference / pixel art) live in scripts/download-loras.sh.
set -euo pipefail

HOST="${HF_HOST:-https://hf-mirror.com}"
ROOT="${COMFY_ROOT:-$HOME/tools/ComfyUI}"
MODELS="$ROOT/models"
CHECK_ONLY=0
[ "${1:-}" = "--check" ] && CHECK_ONLY=1

# repo | path inside repo | destination under models/
FILES=(
  "vantagewithai/Krea-2-Turbo-GGUF|krea2_turbo-Q4_K_M.gguf|unet/krea2_turbo-Q4_K_M.gguf"
  "Comfy-Org/Krea-2|text_encoders/qwen3vl_4b_bf16.safetensors|text_encoders/qwen3vl_4b_bf16.safetensors"
  "Comfy-Org/Krea-2|vae/qwen_image_vae.safetensors|vae/qwen_image_vae.safetensors"
)

missing=0
for row in "${FILES[@]}"; do
  IFS='|' read -r repo path dest <<<"$row"
  target="$MODELS/$dest"
  if [ -s "$target" ]; then
    printf 'ok       %-52s %s\n' "$dest" "$(du -h "$target" | cut -f1)"
  else
    missing=$((missing + 1))
    printf 'MISSING  %-52s <- %s/%s\n' "$dest" "$repo" "$path"
  fi
done

if [ "$missing" -eq 0 ]; then
  echo "all required models present in $MODELS"
  exit 0
fi
if [ "$CHECK_ONLY" -eq 1 ]; then
  echo "$missing file(s) missing" >&2
  exit 1
fi

for row in "${FILES[@]}"; do
  IFS='|' read -r repo path dest <<<"$row"
  target="$MODELS/$dest"
  [ -s "$target" ] && continue
  mkdir -p "$(dirname "$target")"
  echo "downloading $dest"
  curl -fL --retry 3 --retry-delay 2 -o "$target.part" "$HOST/$repo/resolve/main/$path"
  mv "$target.part" "$target"
  echo "done $(du -h "$target" | cut -f1)"
done

echo "all required models present in $MODELS"
