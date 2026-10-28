# 本地 ComfyUI 与模型环境清单

这份文档记录 `dsh-comfyui` 在本机跑起来需要的**全部外部依赖**：ComfyUI 本体、自定义节点、模型与 LoRA 文件、插件配置，以及验收命令。按顺序做完即可从零复现当前环境。

- 实测环境：macOS（Apple Silicon，24 GB 统一内存）、Python 3.13.17、ComfyUI **0.43.0**、PyTorch **2.14.1**（MPS）
- 磁盘占用：ComfyUI + venv 约 **2 GB**，模型与 LoRA 约 **15 GB**（最低可用配置约 15.5 GB，含一个 LoRA）
- 显卡：Apple Silicon 走 MPS；FP8 权重在 MPS 上**不可用**（见「已知坑」）

```
~/tools/ComfyUI/                    COMFY_ROOT
├── models/
│   ├── unet/                       Krea 2 扩散模型（GGUF）
│   ├── text_encoders/              Qwen3-VL 文本编码器
│   ├── vae/                        Qwen-Image VAE
│   └── loras/                      edit / style / pixel LoRA
├── custom_nodes/                   GGUF + Krea2 edit + pixel refiner
├── input/                          插件上传的参考图（dsh-ref-*.png）
└── run.sh                          插件自动启动用的启动脚本
```

---

## 一、ComfyUI 本体

```sh
mkdir -p ~/tools && cd ~/tools
git clone https://github.com/comfyanonymous/ComfyUI.git
cd ComfyUI

# Python 3.10–3.13 均可；这里用 3.13
python3.13 -m venv venv
./venv/bin/pip install --upgrade pip

# 依赖里有两个包在 PyPI 上缺版本（见「已知坑」），先过滤掉再装
grep -vE "^(comfyui-workflow-templates|comfyui-embedded-docs)" requirements.txt > /tmp/comfy-req.txt
./venv/bin/pip install -r /tmp/comfy-req.txt
```

启动脚本（插件会调用它自动拉起服务）：

```sh
cat > ~/tools/ComfyUI/run.sh <<'EOF'
#!/bin/sh
set -eu
cd "$(dirname "$0")"
exec ./venv/bin/python main.py --listen 127.0.0.1 --port 8188 "$@"
EOF
chmod +x ~/tools/ComfyUI/run.sh
```

手动启动一次确认能开：

```sh
~/tools/ComfyUI/run.sh
# 另开终端：curl -s http://127.0.0.1:8188/system_stats
```

---

## 二、自定义节点（三个，缺一不可）

| 节点包 | 用途 | 缺了会怎样 |
|---|---|---|
| `city96/ComfyUI-GGUF` | 加载 Krea 2 的 GGUF 量化模型 | 面板提示“未检测到模型” |
| `ostris/ComfyUI-Krea2-Ostris-Edit` | 参考图 / 人设图生图 | 「参考图」功能不可用 |
| `envy-ai/ComfyUI-Krea2-Pixel-Art-Refiner` | 像素资产的网格折叠与调色板压缩 | 「像素游戏资产」不可用 |

```sh
cd ~/tools/ComfyUI/custom_nodes
git clone https://github.com/city96/ComfyUI-GGUF.git
git clone https://github.com/ostris/ComfyUI-Krea2-Ostris-Edit.git
git clone https://github.com/envy-ai/ComfyUI-Krea2-Pixel-Art-Refiner.git

# 像素节点依赖 OpenCV，不装会 IMPORT FAILED
cd ~/tools/ComfyUI
./venv/bin/pip install opencv-python-headless
```

装完必须**重启 ComfyUI** 让节点注册。验证：

```sh
curl -s http://127.0.0.1:8188/object_info/UnetLoaderGGUF        | head -c 60
curl -s http://127.0.0.1:8188/object_info/Krea2OstrisEditModelPatch | head -c 60
curl -s http://127.0.0.1:8188/object_info/Krea2PixelArtRefiner  | head -c 60
# 三个都应返回 JSON；空对象 {} 表示节点没加载成功
```

---

## 三、必需模型（3 个文件）

| 文件 | 大小 | 放置目录 | 来源 |
|---|---|---|---|
| `krea2_turbo-Q4_K_M.gguf` | 7.0 GB | `models/unet/` | `vantagewithai/Krea-2-Turbo-GGUF` |
| `qwen3vl_4b_bf16.safetensors` | 8.3 GB | `models/text_encoders/` | `Comfy-Org/Krea-2` |
| `qwen_image_vae.safetensors` | 242 MB | `models/vae/` | `Comfy-Org/Krea-2` |

一键下载（跳过已存在的文件，默认走 hf-mirror）：

```sh
cd ~/tools/ComfyUI          # 或在任意目录用 COMFY_ROOT=/path/to/ComfyUI
./scripts/download-models.sh          # 本仓库的脚本
./scripts/download-models.sh --check  # 只检查缺什么
```

手动下载等价的命令：

```sh
M=https://hf-mirror.com
curl -fL -o models/unet/krea2_turbo-Q4_K_M.gguf \
  "$M/vantagewithai/Krea-2-Turbo-GGUF/resolve/main/krea2_turbo-Q4_K_M.gguf"
curl -fL -o models/text_encoders/qwen3vl_4b_bf16.safetensors \
  "$M/Comfy-Org/Krea-2/resolve/main/text_encoders/qwen3vl_4b_bf16.safetensors"
curl -fL -o models/vae/qwen_image_vae.safetensors \
  "$M/Comfy-Org/Krea-2/resolve/main/vae/qwen_image_vae.safetensors"
```

> 文本编码器必须是**带视觉权重**的 `qwen3vl_4b_bf16`（内含 `model.visual.*` 张量）。参考图编码依赖它，换成纯文本版本会导致参考图功能报错。

## 四、LoRA（按需，对应插件的三个功能）

| 功能 | 文件 | 大小 | 来源 |
|---|---|---|---|
| 参考图 · 人设 | `krea2_identity_edit_v1_1_r64.safetensors` | 436 MB | `conradlocke/krea2-identity-edit` |
| 参考图 · 风格 | `krea2_style_reference.safetensors` | 436 MB | `ostris/krea2_turbo_style_reference` |
| 像素资产 32/64/128 | `k2-pixel32/64/128.safetensors` | 71 MB × 3 | `e-n-v-y/Krea-2-Pixel-Art` |
| 插画风格（预设里可选） | 见 `scripts/download-loras.sh` 目录 | 0.2–0.5 GB | 官方 / 社区 |

```sh
cd ~/tools/ComfyUI
./scripts/download-loras.sh            # 二次元四件套，插件「Presets」里直接可选
./scripts/download-loras.sh all        # 全部风格 LoRA
```

---

## 五、插件侧配置

profile 的 `cordis.patch.yml` 里加一行（或安装时由 `dsh.bundle.patch` 自动插入）：

```yaml
- insert:
    - id: comfyui
      name: dsh-comfyui
      config:
        comfyRoot: ~/tools/ComfyUI   # 自动启动用（run.sh 所在目录）
        comfyUrl: http://127.0.0.1:8188
        autoStart: true              # 服务没起来时自动拉起
        timeoutMs: 900000            # 单张图最长等待；Apple Silicon 建议保留
```

---

## 六、验收清单

从头检查一遍，全部通过就算环境就绪：

```sh
# 1. 服务在线，版本符合预期
curl -s http://127.0.0.1:8188/system_stats | python3 -c \
  "import json,sys;d=json.load(sys.stdin);print(d['system']['comfyui_version'], d['system'].get('pytorch_version'))"
# 期望：0.43.0 2.14.1（版本号不用完全一致，新版本更好）

# 2. 三个自定义节点都注册了
for n in UnetLoaderGGUF Krea2OstrisEditModelPatch Krea2PixelArtRefiner; do
  printf '%s: ' "$n"; curl -s "http://127.0.0.1:8188/object_info/$n" | head -c 40; echo
done

# 3. 模型文件就位
ls -lh models/unet models/text_encoders models/vae | grep -E "gguf|safetensors"

# 4. 插件识别到能力（端口以 DSH 实际监听为准，见应用启动日志或 lsof）
PORT=$(lsof -nP -iTCP -sTCP:LISTEN | awk '/DeepSeek/ {split($9, a, ":"); print a[2]; exit}')
curl -s "http://127.0.0.1:$PORT/comfyui/status" | python3 -m json.tool | head -30
# 期望：online=true；models 里 krea2-turbo 的 available / pixelAvailable / referenceAvailable 均为 true

# 5. 真的能出图（最小用例，约 3 分钟）
curl -s -X POST "http://127.0.0.1:$PORT/comfyui/generate" \
  -H 'content-type: application/json' \
  -d '{"prompt":"a small red potion bottle","optimize":false,"steps":4,"size":"512x512"}'
```

---

## 七、已知坑

| 现象 | 原因 | 处理 |
|---|---|---|
| `RuntimeError: Undefined type Float8_e4m3fn` | MPS 后端不支持 float8，`*_fp8_scaled` 权重无法加载 | 用本清单的 GGUF 方案；fp8 只在 CUDA 机器上用 |
| 像素节点 `IMPORT FAILED` | 缺 `cv2` | `./venv/bin/pip install opencv-python-headless` 后重启 |
| `pip install` 报 `comfyui-workflow-templates-media-assets-02` 找不到 | 该依赖版本在 PyPI 缺失 | 按上文过滤 requirements 再装，模板库不影响生图 |
| 参考图报 `RuntimeError: Undefined type Float8_e4m3fn`（编码器） | 文本编码器用了 fp8 版本 | 换成 `qwen3vl_4b_bf16.safetensors` |
| 生成到一半 ComfyUI 退出 | 24 GB 内存吃紧（7 GB 主模型 + 8.3 GB 编码器） | 降低草稿尺寸 / 关闭其它占内存程序；插件会自动重启服务并在 12 秒内判定任务丢失 |
| 下载只有 100–300 KB/s | 直连 Hugging Face 慢 | 用 `hf-mirror.com`（脚本默认）；`HF_HOST=https://huggingface.co` 可切回 |
| 首次出图特别慢 | 需要加载 15 GB 权重并预热 | 属正常，之后同模型连续出图会快很多 |

**参考耗时（本机 24 GB M5）**：8 步 1024² 约 4–5 分钟；像素资产（8 步 + 折叠）约 3 分钟；参考图模式每步约 50–60 秒。

---

## 八、可选扩展（当前未装，按需）

| 需求 | 方案 | 额外占用 |
|---|---|---|
| 图片放大 2–4K | SeedVR2 3B（ComfyUI 原生节点） | 约 3 GB |
| 换更快/中文文字更强的模型 | Z-Image Turbo（6B 蒸馏，8 步，16 GB 显存起） | 约 4–12 GB |
| 像素资产自动抠透明背景 | BiRefNet / RMBG | 约 1.7 GB |
| 指令式编辑（“把帽子改成红色”） | Qwen-Image-Edit（本地）或 Krea 3 API（闭源） | 20 GB+ 或按张付费 |

> 许可提醒：Krea 2 权重是 Krea 2 Community License（含商用条件与营收门槛）；第三方 LoRA 各自另有许可；画师风格预设仅供个人创作参考。
