modnet-photographic-portrait-matting.onnx
  MODNet (Ke et al., "MODNet: Real-Time Trimap-Free Portrait Matting via
  Objective Decomposition", AAAI 2022), the photographic portrait matting
  checkpoint, 6.5M parameters, fp32, 25,888,640 bytes.
  Licence: Apache-2.0 (see LICENSE-modnet.txt, copied from
  https://raw.githubusercontent.com/ZHKKKe/MODNet/master/LICENSE on
  2026-10-03; the repository README's "License" section says the code,
  models and demos are released under Apache License 2.0).
  Source repo: https://github.com/ZHKKKe/MODNet
  File shipped: the ONNX export published by Xenova on the Hugging Face Hub,
    https://huggingface.co/Xenova/modnet (model card licence: apache-2.0),
    file https://huggingface.co/Xenova/modnet/resolve/main/onnx/model.onnx
    sha256 07c308cf0fc7e6e8b2065a12ed7fc07e1de8febb7dc7839d7b7f15dd66584df9
    (matches the Hub's X-Linked-ETag for that file). Downloaded 2026-10-03,
    not re-exported: it is byte-for-byte the Hub file. Its input/output
    names and dynamic axes are those of the official onnx/export_onnx.py in
    the MODNet repo (input "input", output "output", dynamic batch_size,
    height, width), opset 11, IR 6. Ops: Conv 69, Clip 35, Slice 32,
    Concat 24, Relu 17, BatchNormalization 16, InstanceNormalization 16,
    Add 10, Resize 9, MatMul 2, Sigmoid 2, GlobalAveragePool 1 (+ shape ops).
  Chosen over onnx/model_quantized.onnx (6.6 MB, dynamic uint8, sha256
    92e49898c3e05a6d7a944fc67a8cb87c4aad754ffb6ebd949528c7d1105fee3a):
    on one CPU thread in onnxruntime 1.30 the quantised file is slower
    (620 ms vs 470 ms on a 512x640 input, DynamicQuantizeLinear/Cast
    overhead) and noisier (2.4% of binarised pixels disagree with fp32 on
    the portrait test photo, 40% more semi-transparent pixels). The fp32
    file is under the 30 MB budget, so it ships.
  Input:  "input"  1x3xHxW float32, RGB, (x/255 - 0.5) / 0.5 = x/127.5 - 1,
          range [-1, 1]; H and W multiples of 32. The reference inference
          (onnx/inference_onnx.py) resizes so the SHORT edge is 512;
          Xenova's preprocessor_config.json says the same (shortest_edge 512,
          size_divisibility 32, mean/std 0.5). engine/aiimg-matte.js uses
          short edge 512 with the long edge capped at 1024.
  Output: "output" 1x1xHxW float32, the alpha matte in 0..1 (sigmoid), same
          H and W as the input.
  Verified 2026-10-03 with onnxruntime 1.30.0 (CPU): onnx.checker passes;
    portrait-of-woman_small.jpg at 512x640 -> matte 512x640, range 0..1,
    6.3% of pixels semi-transparent (hair), 470 ms single-threaded.
  Used by engine/aiimg-matte.js for the People layer of
    /ai-image/background-remover/ and /ai-image/sticker-maker/: the
    EfficientViT class mask says where people are; MODNet draws the hair.
