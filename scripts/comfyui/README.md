# ComfyUI → sprite pipeline (SDXL + Pixel Art XL LoRA)

Generate pixel-art pet sprites with a local ComfyUI (NVIDIA GPU), driven from
Claude via an MCP server, then palette-lock + wire them with this repo's
converter. Covers **Windows and Linux**.

The split that keeps things robust:
- **ComfyUI** = generation only (SDXL + Pixel Art XL LoRA) → a 1024×1024
  pixel-art-styled image on a plain background.
- **`scripts/make-sprite.mjs`** = the deterministic finishing: fit to 64×64,
  snap to `src/sprites/palette.ts`, key out the background, wire into the app.

This avoids depending on brittle ComfyUI custom-node packs for the palette/size.
If you'd rather do palette + background *inside* ComfyUI, see "Self-contained
ComfyUI variant" at the bottom.

---

## 1. Install ComfyUI (NVIDIA)

### Windows
1. Install a recent **NVIDIA driver** + **Python 3.11/3.12** (tick "Add to PATH").
2. Easiest: download the **ComfyUI portable (Windows, NVIDIA)** package, unzip,
   and run `run_nvidia_gpu.bat`. (Manual venv install also works — see step Linux.)
3. ComfyUI serves its UI/API at `http://127.0.0.1:8188`.

### Linux
```sh
git clone https://github.com/comfyanonymous/ComfyUI
cd ComfyUI
python3 -m venv venv && source venv/bin/activate
# CUDA 12.x PyTorch (match your driver; see pytorch.org if unsure):
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu124
pip install -r requirements.txt
python main.py --port 8188
```

Verify: open `http://127.0.0.1:8188` and you get the ComfyUI canvas.

## 2. Download the models

Put files in these folders under your ComfyUI install:

| File | Folder | Source |
|------|--------|--------|
| `sd_xl_base_1.0.safetensors` | `models/checkpoints/` | SDXL base 1.0 (Hugging Face: stabilityai/stable-diffusion-xl-base-1.0) |
| `pixel-art-xl.safetensors` | `models/loras/` | Pixel Art XL LoRA (Hugging Face: nerijs/pixel-art-xl) |

(SDXL ships its own VAE, so no separate VAE is required.) Restart ComfyUI after
adding files, or click **Refresh** in the UI so they appear in the loaders.

## 3. Load the workflow

`scripts/comfyui/pixelpet-sdxl-lora.json` is an **API-format** workflow using
only built-in nodes. Two ways to use it:
- **UI**: drag the file onto the ComfyUI canvas, tweak the prompt, hit *Queue*.
- **API / MCP**: it's already in the shape ComfyUI's `/prompt` endpoint expects.

Key settings baked in (the documented Pixel Art XL starting recipe): **8 steps**,
**CFG 1.5**, `euler_ancestral`, **LoRA strength 1.2**, 1024×1024. Edit node `4`
`ckpt_name` and node `10` `lora_name` if your filenames differ. If 8-step output
looks weak/unstable, fall back to standard SDXL settings — **~25 steps at
CFG 6–7** (the few-step recipe assumes an LCM-style setup).

## 4. Install the ComfyUI MCP server

This bridges Claude ↔ your local ComfyUI (`localhost:8188`). Example using
`joenorton/comfyui-mcp-server`:

```sh
git clone https://github.com/joenorton/comfyui-mcp-server
cd comfyui-mcp-server
pip install -r requirements.txt
# keep ComfyUI running in another terminal on :8188, then:
python server.py
```

`server.py` talks to ComfyUI's REST API on `:8188` and serves MCP over
**streamable HTTP at `http://127.0.0.1:9000/mcp`**. Point your client at that URL
via a `.mcp.json` in your project root (Claude Code) or your client's MCP config:

```json
{
  "mcpServers": {
    "comfyui": {
      "type": "streamable-http",
      "url": "http://127.0.0.1:9000/mcp"
    }
  }
}
```
(Some clients want `"type": "http"` — both work.) Restart/reload the client and
the tools appear: `generate_image` (`prompt`, `width`, `height`, `steps`,
`model`), plus `regenerate`, `view_image`, `list_assets`, `get_job`,
`cancel_job`.

> Local-only: the server listens on `127.0.0.1:9000`, so it pairs with **Claude
> Code / Desktop on this same machine** — a web session can't reach your
> localhost. (For web sessions, use Comfy Cloud's hosted MCP instead.) Vet any
> third-party MCP server before running it.

### Running *this* SDXL+LoRA workflow vs. the server's `generate_image`

`generate_image` on this server drives its own built-in workflow with simple
params — it won't automatically use the SDXL + Pixel Art XL graph in
`pixelpet-sdxl-lora.json`. Two ways to get the exact recipe:

- **Most reliable:** load `pixelpet-sdxl-lora.json` in the **ComfyUI UI**
  (drag onto the canvas), set the prompt, and **Queue** it. Use the MCP server
  for quick prompt-driven generations / automation.
- **MCP-driven custom workflow:** use a server that supports executing a
  supplied workflow file (e.g. `nikolaibibo/claude-comfyui-mcp` or
  `artokun/comfyui-mcp`, which add template/custom-workflow execution). Then
  Claude can trigger this exact SDXL+LoRA workflow. Configs for those differ —
  tell me which you pick and I'll write the exact block.

## 5. Generate → finish → wire

Once the MCP server is connected, ask Claude to generate (or queue the workflow
in the ComfyUI UI). You'll get a PNG, e.g. `ComfyUI/output/pixelpet_00001_.png`.
Then finish it with this repo's converter:

```sh
npm run sprite -- --in /path/to/ComfyUI/output/pixelpet_00001_.png \
  --slug fox --stage baby --bg '#ffffff'
```

That writes `assets/sprites/fox-baby.png` (64×64, palette-locked) and wires it
into `src/sprites/images.ts`. Repeat for `child`/`teen`/`adult` — for
stage-to-stage consistency, reuse the seed and only change the age words in the
prompt (or use an img2img workflow from the previous stage).

The 14 species still needing art: fox, bat, penguin, sloth, owl, eagle,
kangaroo, giraffe, tiger, elephant, crocodile, octopus, trex, merperson.

---

## Self-contained ComfyUI variant (palette + bg inside the graph)

If you want ComfyUI to output a finished palette sprite directly, add these
custom nodes via **ComfyUI-Manager** and insert them after `VAEDecode`:
- **Background removal**: `ComfyUI-rembg` (or Inspire-Pack's remove-background)
  — knocks out the backdrop to transparency.
- **Pixelize + palette**: `ComfyUI-PixelArt-Detector` — downscale to a pixel
  grid and reduce to a fixed palette; load `src/sprites/palette.ts` colours as a
  custom palette.

Caveat: custom-node **class names vary by pack/version**, so the exact wiring has
to be done against your installed versions — share a screenshot or the node list
and I'll adapt the workflow JSON. Even with this, `make-sprite.mjs` is still
worth running last to guarantee the exact 64×64 size and the canonical palette.

## Troubleshooting
- **Loader can't find the model** → check the `models/checkpoints` /
  `models/loras` filenames match nodes `4`/`10`; click Refresh.
- **Output looks soft/anti-aliased** → that's expected pre-finish; the converter
  snaps it to clean pixels. Or raise LoRA strength / lower CFG.
- **MCP tool can't reach ComfyUI** → ensure ComfyUI is running on `:8188` and the
  `COMFYUI_HOST/PORT` env match.
- **CUDA/torch errors on Linux** → install the torch build matching your CUDA
  (see pytorch.org); on Windows prefer the portable NVIDIA package.
