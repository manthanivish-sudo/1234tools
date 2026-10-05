depth-anything-v2-small-uint8.onnx
  (shipped as .part0 and .part1, at most 20 MiB each, joined by the loader:
  the static hosts cap a file at 25 MiB; see build/split-models.js and
  engine/models/parts.json, which records each part's sha256)
  Depth Anything V2 Small (DINOv2-S encoder, DPT head), 24.8M parameters,
  weights dynamically quantised to 8-bit unsigned; 27,258,801 bytes.
  Source: the Depth Anything authors, https://github.com/DepthAnything/Depth-Anything-V2
  whose LICENSE file (copied here as LICENSE-depth-anything-v2-small.txt) is the
  Apache License 2.0 and whose README states: "Depth-Anything-V2-Small model is
  under the Apache-2.0 license. Depth-Anything-V2-Base/Large/Giant models are
  under the CC-BY-NC-4.0 license." The Hugging Face card of the checkpoint,
  https://huggingface.co/depth-anything/Depth-Anything-V2-Small, carries
  "license: apache-2.0". Only the Small model may ever be shipped here: Base,
  Large and Giant are non-commercial.
  File: https://huggingface.co/onnx-community/depth-anything-v2-small/resolve/main/onnx/model_quantized.onnx
  (byte-identical to onnx/model_uint8.onnx in that repo, whose card says
  license apache-2.0, base_model depth-anything/Depth-Anything-V2-Small),
  downloaded 2026-10-03 and not modified.
  sha256 fcf51f1b230362b28690bb9d1809bf0431f29cad20534e3f589bd7285547f20d
  Conversion: by onnx-community from the PyTorch checkpoint
  depth_anything_v2_vits.pth with Optimum (ONNX ir 9, opset 14), then
  onnxruntime quantize_dynamic with weight_type QUInt8, per_channel true,
  reduce_range true (its quantize_config.json). 1193 nodes: Mul 248, Add 177,
  DynamicQuantizeLinear 79, Cast 79, Gather 73, Reshape 57, ReduceMean 50,
  MatMulInteger 48, Concat 42, Transpose 42, Unsqueeze 41, Div 39,
  ConvInteger 31, Shape 26, Sub 25, Pow 25, Sqrt 25, MatMul 24, Relu 17,
  Softmax 12, Erf 12, Slice 9, Resize 6, ConvTranspose 2, Equal 1, Where 1,
  Expand 1, Squeeze 1.
  Input  "pixel_values" float32 1x3xHxW, H and W multiples of 14 (the tools
         use 518 on the long edge, the short edge following, so the picture
         is not squashed square); RGB scaled to 0..1 and normalised with the
         ImageNet mean [0.485, 0.456, 0.406] and std [0.229, 0.224, 0.225]
         (the repo's preprocessor_config.json: DPTImageProcessor,
         keep_aspect_ratio, ensure_multiple_of 14, bicubic resize).
  Output "predicted_depth" float32 1xHxW at the input resolution: relative
         inverse depth (disparity-like, affine-invariant). Larger means
         nearer; there is no metric scale. engine/aiimg-depth.js normalises
         it per picture between its 2nd and 98th percentiles to 0..1, with
         1 the nearest, and upsamples it bilinearly to the mask resolution
         the segmentation tools use (768 px on the long edge).
  Checked 2026-10-03 with onnxruntime 1.30 on CPU against the repo's fp32
  onnx/model.onnx on five photos at 518: Pearson correlation 0.9988-0.9998,
  mean absolute difference of the normalised maps 0.003-0.016, and the depth
  pictures were looked at. 341 ms per 518x518 run on the build machine's CPU
  (fp32: 342 ms). The sibling onnx/model_int8.onnx (signed weights) agrees
  equally but runs 3.5x slower (1180 ms), so the unsigned one was chosen.
  Used by engine/aiimg-depth.js for /ai-image/blur-background/ and
  /ai-image/3d-photo-parallax/, through the same ONNX Runtime WebAssembly
  build in engine/vendor/ort/ that runs the segmentation model.
