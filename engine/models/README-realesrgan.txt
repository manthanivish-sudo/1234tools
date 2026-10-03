realesr-general-x4v3.onnx          4,868,039 bytes  sha256 2eb15a1d965c7adeb07d498777fb8becfb51fd24dda88c9f6e744a9c1fdf6b68
realesr-general-x4v3-wdn.onnx      4,868,039 bytes  sha256 3c4bc20521e3686f38abf00a06c3e56835e96172b80c27da20b8619e7b6cadd6

  Real-ESRGAN "general x4v3": SRVGGNetCompact(num_in_ch=3, num_out_ch=3,
  num_feat=64, num_conv=32, upscale=4, act_type='prelu'), 1,213,296
  parameters, fp32. The first file is the standard model; the second is
  the "wdn" (with denoise) variant trained on the same architecture, which
  the AI Image Upscaler blends in for its denoise strength control.

  Source: Xintao Wang, https://github.com/xinntao/Real-ESRGAN, published
  under the BSD-3-Clause licence (see LICENSE-realesrgan.txt; the licence
  text was read from https://github.com/xinntao/Real-ESRGAN/blob/master/LICENSE).
  Weights from the GitHub release v0.2.5.0:
    https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesr-general-x4v3.pth
      4,885,111 bytes, sha256 8dc7edb9ac80ccdc30c3a5dca6616509367f05fbc184ad95b731f05bece96292
    https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesr-general-wdn-x4v3.pth
      4,885,111 bytes, sha256 1641f8c4464b9f097c9fdda5589273713f67cf59f3d909e0bd688f0cee269dca
  Both checkpoints carry their weights under the "params" key.

  Converted 2026-10-03 with build/ai-image/export-realesrgan.py (torch 2.14.1
  CPU, onnx 1.23.1, onnxruntime 1.30.0; TorchScript exporter, opset 17,
  constant folding on). The network definition in that script is copied from
  realesrgan/archs/srvgg_arch.py of the repository above. A Clip(0, 1) is
  appended to the network output.

  Graph: 34 Conv, 33 PRelu, 1 DepthToSpace (the PixelShuffle), 1 Resize
  (nearest x4 of the input, added as the residual), 1 Add, 1 Clip.
    input  "image"     float32 [1, 3, height, width]       RGB, 0..1, no mean/std normalisation
    output "upscaled"  float32 [1, 3, 4*height, 4*width]   RGB, 0..1
  Any height and width work (the network is fully convolutional); the
  upscaler feeds it tiles of up to 192 px with 16 px of overlap.

  Checked against PyTorch on random inputs of 64x64, 128x128, 160x160,
  192x192, 100x150 and 37x211: max |diff| 5.5e-6 (general) and 2.7e-5 (wdn).
