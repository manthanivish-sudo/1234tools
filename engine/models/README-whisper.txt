whisper-tiny/  (used by engine/aivid-whisper.js for /ai-video/auto-captions/)

  OpenAI Whisper, the "tiny" multilingual model: 39M parameters, 4 encoder and 4
  decoder layers, d_model 384, 6 heads of 64, vocabulary 51,865 (50,257 text tokens
  + 1,608 special tokens: <|endoftext|> 50257, <|startoftranscript|> 50258, 99
  language tokens 50259-50357, <|translate|> 50358, <|transcribe|> 50359, <|startoflm|>
  50360, <|startofprev|> 50361, <|nocaptions|> 50362, <|notimestamps|> 50363, and the
  1,501 timestamp tokens <|0.00|>..<|30.00|> = 50364..51864, 0.02 s apart).

  Weights: https://github.com/openai/whisper (MIT, see ../LICENSE-whisper.txt, fetched
  from https://raw.githubusercontent.com/openai/whisper/main/LICENSE).
  ONNX conversion: https://huggingface.co/onnx-community/whisper-tiny/tree/ff4177021cc41f7db950912b73ea4fdf7d01d8e7
  (Hugging Face, onnx-community; exported from the transformers checkpoint
  openai/whisper-tiny with Optimum, then dynamically quantised to uint8 weights -
  the files named *_quantized.onnx, which the repo also publishes as *_uint8.onnx
  with the same hash). A conversion of MIT weights carries the MIT licence; the
  repository states no other licence. Pinned revision ff4177021cc41f7db950912b73ea4fdf7d01d8e7.

  Files shipped (sha256 of the whole file; a sharded file lists its parts):
    encoder_model_quantized.onnx             10124990 bytes  2af4a414ca47aa30f61246017e5fe82b0a8d229281d1255ba666a2a7f6b84d19
      from onnx/encoder_model_quantized.onnx
    decoder_model_merged_quantized.onnx      30719241 bytes  25e807a962b6349356d0ea5d0dfe530b7e5bf0e2a484aeca0359d03143faddd3
      from onnx/decoder_model_merged_quantized.onnx
    tokens.json                                545096 bytes  c3793c6eeb9d72bb5908f0341af745e8dc2d462848ecbc1d97d2f3f6aa7a57a2
      from vocab.json (ids 0-50256)
    whisper-tiny.json                       the manifest: files, dims, token ids, suppress lists, mel settings
  Upstream sha256 of the small files read to build these: vocab.json 50d6a919f0a06...e2c1a,
  added_tokens.json 9715fd2243b6f...8acd1, config.json 46aeea0a406af...efd2d,
  generation_config.json f5c67e5a4f710...facd1, preprocessor_config.json a6a76d28c93ed...1b8d.

  Inputs and outputs
    encoder_model_quantized.onnx
      in  input_features      float32 [1, 80, 3000]   (one 30 s window of log-mel)
      out last_hidden_state   float32 [1, 1500, 384]
    decoder_model_merged_quantized.onnx
      in  input_ids           int64   [1, n]           (the 3-token prompt, then one token a step)
      in  encoder_hidden_states float32 [1, 1500, 384]
      in  past_key_values.{0..3}.decoder.{key,value} float32 [1, 6, past, 64]
      in  past_key_values.{0..3}.encoder.{key,value} float32 [1, 6, 1500, 64]
      in  use_cache_branch    bool    [1]              (false on the first step with empty pasts of
                                                        shape [1, 6, 0, 64]; true afterwards)
      out logits              float32 [1, n, 51865]
      out present.{0..3}.decoder.{key,value} float32 [1, 6, past+n, 64]   (fed back as past)
      out present.{0..3}.encoder.{key,value} float32 [1, 6, 1500, 64]     (computed on the first
                                                        step, then fed back unchanged)

  Preprocessing (WhisperFeatureExtractor, mirrored in JS)
    16 kHz mono float32; 30 s windows of 480,000 samples, the last padded with zeros;
    STFT n_fft 400, hop 160, periodic Hann window, centre with 200-sample reflect padding,
    3,001 frames of which the last is dropped; power spectrum |X|^2 on 201 bins;
    80 Slaney mel filters 0-8000 Hz (librosa mel(sr=16000, n_fft=400, n_mels=80), norm
    slaney, identical to openai/whisper mel_filters.npz to 2e-9), log10 with a floor of
    1e-10, clamped to (max - 8) over the window, then (x + 4) / 4.

  Decoding (greedy, as openai/whisper DecodingTask + transcribe.py)
    prompt <|startoftranscript|><|en|><|transcribe|> - with timestamps (no <|notimestamps|>);
    suppress generation_config.suppress_tokens (non-speech and special tokens) at every step,
    begin_suppress_tokens [220, 50257] at the first step, <|notimestamps|> always; timestamp
    rules: after one timestamp a text token must follow, after a text run a timestamp or
    <|endoftext|>; timestamps never decrease; the first token is a timestamp no later than
    index 50 (1.0 s); when the summed probability of the timestamp tokens beats the best
    text token a timestamp is taken. At most 224 new tokens a window; a run of four
    identical tokens stops the window. Segments follow transcribe.py: text between two
    consecutive timestamps is a segment; a window ending on a single timestamp seeks past
    the whole window, otherwise the next window starts at the last closed timestamp.
    Word timings are the segment split proportionally to character length (approximate;
    no cross-attention alignment in this version).

  Prepared by build/ai-video/prepare-whisper.py on 2026-10-03.
