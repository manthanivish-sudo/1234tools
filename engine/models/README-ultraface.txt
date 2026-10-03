ultraface-rfb-640.onnx
  Ultra-Light-Fast-Generic-Face-Detector-1MB, the "version-RFB-640" model
  (Linzaer, 2019; the RFB variant, trained on WIDER FACE at 640x480).
  1,575,192 bytes (1.50 MB), fp32, opset 9, IR version 4. Used by
  engine/aiimg-face-blur.js, the Face Blur tool, through ONNX Runtime Web.

  Licence: MIT, "Copyright (c) 2019 linzai", read from the repository's
  LICENSE file at
  https://github.com/Linzaer/Ultra-Light-Fast-Generic-Face-Detector-1MB/blob/master/LICENSE
  and saved beside this file as LICENSE-ultraface.txt.

  Source file:
    https://raw.githubusercontent.com/Linzaer/Ultra-Light-Fast-Generic-Face-Detector-1MB/master/models/onnx/version-RFB-640.onnx
    1,588,012 bytes, sha256 8f4c659275977e7a3bfbfa339a9c769ad793df50f9c0baa8c14b11baa1646430
  Shipped file (this one):
    1,575,192 bytes, sha256 90aa58545d305bf3832d31bb2ebfc5337ab471ed2408437563b6ffb33d5d526a
    Made by build/ai-image/export-face.py on 2026-10-03: the published file
    lists all 244 weights as graph inputs as well as initializers (an old
    exporter habit), which makes ONNX Runtime print a warning per weight
    and stops it folding constants. The script removes those input entries
    and the 35 unused num_batches_tracked counters; the weights themselves
    are untouched. Outputs agree with the original to 1.4e-6 on a photo
    (the runtime now fuses BatchNorm into Conv, which reorders the sums).

  Input:  "input"  float32 [1, 3, 480, 640], RGB, NCHW,
          each channel (value - 127) / 128. Any region of a picture is
          simply resized to 640x480 (the author's demo does the same; a
          mild squash does not hurt it).
  Output: "scores" float32 [1, 17640, 2]  — column 1 is the face probability
          "boxes"  float32 [1, 17640, 4]  — x1, y1, x2, y2 as fractions of
          the input width and height; the priors are already decoded in the
          graph, so no anchor arithmetic is needed. 17,640 = the priors on
          the four feature maps (strides 8, 16, 32, 64; 3 sizes each).
  Decoding, as implemented in aiimg-face-blur.js:
    keep candidates with scores[i][1] >= threshold (default 0.70; the
    page's "Detection threshold" slider spans 0.50-0.95);
    non-maximum suppression, hard, greedy by score, dropping a box whose
    IoU with a kept box exceeds 0.30 or whose intersection over the smaller
    of the two areas exceeds 0.50 (the second rule removes the half-face
    boxes that a tile boundary produces).
  Tiling: the whole picture squashed to 640x480, plus a 2x2 grid of
    overlapping tiles (20% overlap) for pictures over 480 px; "Small faces"
    adds 4:3 tiles of 320x240 source px (long edge / 5 on pictures over
    1600 px), 25% overlap, so each is enlarged 2x without squashing.
    Candidates that touch an inner tile edge are dropped before the merge.
    The smallest face it finds is about 10 px across at the input, so Small
    faces reaches faces of about 8 px in the picture.
  Verified 2026-10-03 with onnxruntime 1.30 on
    portrait-of-woman_small.jpg (360x450): one face, [87,128 178x231], 1.000
    city-streets.jpg (800x800, people seen from above): 1 face at 2x2
      (a cyclist, 11x19); 2 with the 4:3 Small-faces tiles (plus the
      walking man, 8x10); faces there are 8-20 px
    cats.jpg (640x480): nothing at the whole picture, 2x2 or the 4:3 tiles
      at 0.70; a square 3x3 grid gave two false positives (a remote, a
      cat's face), which is why the tiles keep the 4:3 shape.
  Speed: 5 ms per run on this PC's CPU in onnxruntime; about 60 ms per run
    in ONNX Runtime Web's single-threaded WebAssembly build in Chrome,
    session creation 240 ms.
  Chosen over YuNet (OpenCV Zoo, 230 KB) because its boxes come out of
    the graph decoded, so the browser code stays small, and over the
    320x240 variant, which mistook a cat's face for a person's at 0.72.
