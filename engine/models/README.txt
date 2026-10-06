efficientvit-seg-b1-ade20k.onnx
  EfficientViT-Seg B1, ADE20K (150 classes), 4.8M parameters, fp32.
  Source: MIT HAN Lab, https://github.com/mit-han-lab/efficientvit (Apache-2.0,
  see LICENSE-efficientvit.txt); checkpoint efficientvit_seg_b1_ade20k.pt from
  https://huggingface.co/han-cai/efficientvit-seg. Exported 2026-10-03 with
  build/ai-image/export-seg-model.py (opset 17, dynamic height/width, both
  multiples of 32; input "pixel_values" 1x3xHxW normalised with ImageNet
  mean/std; output "logits" 1x150xH/8xW/8). ONNX and PyTorch agree to 1e-4.
  Chosen over SegFormer because NVIDIA's SegFormer weights are licensed for
  non-commercial use only.

tessdata/
  eng.traineddata.gz and hin.traineddata.gz from tessdata_fast (Apache-2.0, see
  tessdata/LICENSE and tessdata/README.md), gzipped; read by Tesseract.js for
  OCR PDF and Image to Text, fetched only when one of them is used.
