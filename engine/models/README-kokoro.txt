kokoro-82m/  (used by engine/aivid-tts-worker.js for the Reel Maker's "Generate voice")

  Kokoro-82M v1.0 by hexgrad: an 82-million-parameter text-to-speech model
  (StyleTTS 2 architecture with an iSTFTNet decoder) that reads phonemes and
  outputs 24 kHz mono speech in a chosen voice.

  Licences (all checked 2026-10-05)
    Model weights and voices: Apache-2.0 (see LICENSE-kokoro.txt).
      https://huggingface.co/hexgrad/Kokoro-82M  (model card: "license: apache-2.0";
      revision f3ff3571791e39611d31c381e3a41a3af07b4987). The voice .bin files are
      in the same repository under the same licence. The card lists CC BY training
      audio (Koniwa tnc, CC BY 3.0; SIWIS, CC BY 4.0) used for the Japanese and
      French voices, which are not shipped here.
    ONNX export: https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX
      (licence apache-2.0), pinned revision 1939ad2a8e416c0acfeecc08a694d14ef25f2231.
    Pronunciation dictionaries: misaki by hexgrad, Apache-2.0 (see LICENSE-misaki.txt),
      https://github.com/hexgrad/misaki at fba1236595f2d2bf21d414ba6e57d25256afada3,
      files misaki/data/{us,gb}_{gold,silver}.json.
    Letter-to-sound rules for words in no dictionary (engine/aivid-tts-g2p.js):
      NRL Report 7948 (Elovitz, Johnson, McHugh, Shore, US Naval Research
      Laboratory, 1976; https://apps.dtic.mil/sti/pdfs/ADA021929.pdf), a US
      Government work, as transcribed in HeadTTS
      (https://github.com/met4citizen/HeadTTS, MIT, see LICENSE-headtts.txt).
    Not used: kokoro-js and its "phonemizer" package. phonemizer is eSpeak NG
      compiled to WebAssembly, and eSpeak NG is GPL-3.0
      (https://github.com/espeak-ng/espeak-ng/blob/master/COPYING). No eSpeak NG
      code or data is shipped or was used to make any file here.

  Files (written by build/ai-video/prepare-kokoro.js, which pins and checks them)
    model_quantized.onnx    92,361,116 bytes  sha256 fbae9257e1e05ffc727e951ef9b9c98418e6d79f1c9b6b13bd59f5c9028a1478
      = onnx/model_quantized.onnx of the ONNX export (8-bit weights, "q8"), byte for
      byte; the sha256 is the Hub's LFS object id. Shipped as model_quantized.onnx.part0
      to .part4 (20 MiB each, the last 8,475,036 bytes; build/split-models.js), as the
      static hosts cap a file at 25 MiB; the worker joins them and checks the length
      and the sha256 above. The other exports: fp32 325.5 MB, fp16 163.2 MB,
      q4 305.2 MB, q4f16 154.6 MB, uint8 177.5 MB, uint8f16 114.2 MB (over the
      limit), q8f16 86.0 MB (needs fp16 kernels the WebAssembly runtime handles
      slowly). q8 is what kokoro-js itself uses on WebAssembly.
    voices/<id>.bin         522,240 bytes each, 28 files: float32 [510, 1, 256]
      style vectors; row n is the style for an input of n phoneme tokens.
      American English: af_heart af_bella af_nicole af_aoede af_kore af_sarah
      af_alloy af_nova af_sky af_jessica af_river (women), am_fenrir am_michael
      am_puck am_echo am_eric am_liam am_onyx am_santa am_adam (men).
      British English: bf_emma bf_isabella bf_alice bf_lily (women), bm_fable
      bm_george bm_lewis bm_daniel (men). Names, genders and grades from
      https://huggingface.co/hexgrad/Kokoro-82M/blob/main/VOICES.md; the other
      26 voices (Japanese, Mandarin, Spanish, French, Hindi, Italian, Brazilian
      Portuguese) need phonemizers this site does not ship yet.
    lexicon-us.json         misaki us_gold (90,201 words) + us_silver entries gold lacks
    lexicon-gb.json         misaki gb_gold (87,352 words) + gb_silver entries gold lacks
      as {"g": gold, "s": silver}, re-serialised without indentation; values are
      misaki phonemes, or {part of speech: phonemes} for words like "record".
      Sent gzip-compressed by the server: about 1.4 MB and 1.5 MB.
    kokoro-82m.json         the manifest: Kokoro's tokenizer vocabulary (from
      tokenizer.json), the voices, the dictionaries, sizes and sha256 of every file.

  Inputs and outputs (model_quantized.onnx)
    in  input_ids  int64   [1, n+2]  0, the phoneme token ids, 0 (n <= 510)
    in  style      float32 [1, 256]  row n of the voice's .bin
    in  speed      float32 [1]       0.8 to 1.2 on the page
    out waveform   float32 [samples] 24 kHz mono

  Text to phonemes: engine/aivid-tts-g2p.js, a JavaScript port of misaki's English
  lexicon path (dictionary lookup, stress rules, -s/-ed/-ing stems, the special
  cases for a/an/the/to/in/I/by/am/used), with numbers, money (lakh and crore for
  rupees), years, times, acronyms and a small table of this site's own words
  written out before lookup. American output has misaki's v1.0 substitutions
  (ɾ → T, ʔ → t). No part-of-speech tagger: the word before decides the few
  dictionary entries that change with it.
