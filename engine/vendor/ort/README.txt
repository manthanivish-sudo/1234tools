ONNX Runtime Web 1.30.0, WebAssembly-only build (MIT, see LICENSE-onnxruntime.txt).
Files are byte-for-byte as published on npm (onnxruntime-web@1.30.0/dist):
  ort.wasm.min.mjs            the loader (the wasm-only bundle, no WebGPU/JSEP)
  ort-wasm-simd-threaded.mjs  Emscripten glue the loader fetches from env.wasm.wasmPaths
  ort-wasm-simd-threaded.wasm the runtime itself
Used by engine/aiimg-core.js to run engine/models/efficientvit-seg-b1-ade20k.onnx
on the device. Single-threaded: the site is not cross-origin isolated.
