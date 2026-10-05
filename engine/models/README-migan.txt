migan-512-places2.onnx
  (shipped as .part0 and .part1, at most 20 MiB each, joined by the loader:
  the static hosts cap a file at 25 MiB; see build/split-models.js and
  engine/models/parts.json, which records each part's sha256)
  MI-GAN, 512×512, trained on Places2 (Sargsyan et al., "MI-GAN: A Simple
  Baseline for Image Inpainting on Mobile Devices", ICCV 2023). 5.97M
  parameters plus 1.40M constant buffers (the upsamplers' filters and the
  per-layer noise), fp32, 28,037,335 bytes,
  sha256 35b6f906df44019abcbb375cad5dbc85d31e1b10f90c03d3153e3c713b88d3fc.
  Source: Picsart AI Research, https://github.com/Picsart-AI-Research/MI-GAN
  (MIT; the repo's LICENSE and LICENSE-WEIGHTS are the same text, copied to
  LICENSE-migan.txt). Checkpoint migan_512_places2.pt, 29,553,256 bytes,
  sha256 1d6087eee0aac8923ad2606be5d8caeb4824d3e4de331995e420c74e124a466a,
  from the Google Drive folder the README links
  (https://drive.google.com/drive/folders/1xNtvN2lto0p5yFKOEEg9RioMjGrYM74w,
  file id 1D_YCuCgo20S2256sqpedsmENNm2WMtVY).
  Exported 2026-10-03 with build/ai-image/export-migan.py (torch 2.14 CPU,
  TorchScript exporter, opset 17, constant folding) at a fixed 1×3×512×512:
  the generator is resolution-specific, so there are no dynamic axes.
    input  "image"  1×3×512×512 float32, RGB in [-1, 1]   (pixel * 2 / 255 - 1)
    input  "mask"   1×1×512×512 float32, 1 = keep, 0 = hole
    output "output" 1×3×512×512 float32 in [-1, 1]        (pixel = (v * 0.5 + 0.5) * 255)
  The graph concatenates [mask - 0.5, image * mask] itself — the repo's
  convention (scripts/demo.py, scripts/create_onnx_pipeline.py), where
  white = known by default and the bundled example masks are inverted.
  ONNX and PyTorch agree to 2e-5 on random input and to 4e-6 on the repo's
  places2_512_object examples, whose fills match the published
  results/migan samples. Only the hole is taken from the output: the page
  pastes it back within the soft mask (engine/aiimg-object-remover.js),
  after cutting a square window around the hole — its bounding box plus
  half as much again, at least 512 px — and scaling that to 512, as the
  authors' pipeline does; larger windows run coarse-then-tiled.
  Not used: the author's own ONNX exports at
  https://huggingface.co/andraniksargsyan/migan (MIT; the same weights in
  a dynamic-shape pipeline with uint8 I/O, 28–30 MB) — the crop and paste
  are done in JS and a fixed shape is simpler for ONNX Runtime's WASM
  build — and lxfater/inpaint-web's copy, which sits under GPL-3.0.
