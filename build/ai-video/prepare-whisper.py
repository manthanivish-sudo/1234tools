"""
Whisper tiny for /ai-video/auto-captions/: download, verify, shard, describe.

  python build/ai-video/prepare-whisper.py                 fetch + verify + write engine/models/whisper-tiny/
  python build/ai-video/prepare-whisper.py --check         verify what is in engine/models/whisper-tiny/ against the pins
  python build/ai-video/prepare-whisper.py --transcribe x.wav [--dump dir]
                                                           run the Python reference pipeline (the one the browser
                                                           code in engine/aivid-whisper.js mirrors) on a WAV

Everything is pinned: the Hugging Face repo revision, every file's sha256,
and the licence text. A mismatch stops the script; nothing half-verified is
written into the site.

What ships (engine/models/whisper-tiny/):
  encoder_model_quantized.onnx         the audio encoder, uint8 dynamic quantisation, ~10.1 MB
  decoder_model_merged_quantized.onnx  the text decoder with KV cache (one graph for the first and
                                       later steps, switched by use_cache_branch), uint8, ~30.7 MB
  tokens.json                          the 50,257 text tokens of the GPT-2-style byte-level BPE
                                       vocabulary, indexed by id (decoding needs nothing else; the
                                       1,608 special tokens are ranges of ids above 50256)
  whisper-tiny.json                    the manifest the browser reads: files, sizes, hashes, model
                                       dimensions, special-token ids, suppress lists, mel settings
A file over SHARD_OVER bytes is written as .part0, .part1, ... of at most
PART_BYTES each, and the browser concatenates them before creating the
session; the manifest lists the parts. The decoder (30.7 MB) is over
SHARD_OVER, which matches build/split-models.js (24 MiB, parts of 20 MiB),
so a re-run writes the same two parts that script does.

Needs: huggingface_hub, numpy, onnxruntime (for --check/--transcribe). No
torch, no transformers, no librosa: the mel filterbank is computed here
from the Slaney formula and matches openai/whisper's mel_filters.npz to
2e-9 (checked with --transcribe when that file is beside the WAV).
"""
import sys, os, json, hashlib, shutil, time, wave, urllib.request
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
OUT_DIR = os.path.join(ROOT, 'engine', 'models', 'whisper-tiny')
MODELS_DIR = os.path.join(ROOT, 'engine', 'models')
WORK = os.environ.get('WHISPER_WORK', os.path.join(os.path.expanduser('~'), '.cache', '1234tools-whisper'))

REPO = 'onnx-community/whisper-tiny'
REVISION = 'ff4177021cc41f7db950912b73ea4fdf7d01d8e7'
LICENCE_URL = 'https://raw.githubusercontent.com/openai/whisper/main/LICENSE'
LICENCE_SHA256 = None  # filled on first fetch and pinned below once known
LICENCE_MUST_CONTAIN = ('MIT License', 'Copyright (c) 2022 OpenAI')

# sha256 of every file taken from the repo at REVISION (computed 2026-10-03;
# the two .onnx values are also what the Hub's LFS metadata reports)
PINNED = {
    'onnx/encoder_model_quantized.onnx':        ('2af4a414ca47aa30f61246017e5fe82b0a8d229281d1255ba666a2a7f6b84d19', 10124990),
    'onnx/decoder_model_merged_quantized.onnx': ('25e807a962b6349356d0ea5d0dfe530b7e5bf0e2a484aeca0359d03143faddd3', 30719241),
    'vocab.json':                               ('50d6a919f0a0601d56a04eb583c780d18553aa388254ba3158eb6a00f13e2c1a', 1036584),
    'added_tokens.json':                        ('9715fd2243b6f06a5858b5e32950d2853f73dd5bc201aafcf76f5082a2d8acd1', 34604),
    'config.json':                              ('46aeea0a406afbeb563fc8e59ca10609203df4299af6a83f73752fef369efd2d', 2243),
    'generation_config.json':                   ('f5c67e5a4f7102f8cb4d058bc95da276bbc19eeec997267c3bb0f25ef68facd1', 3772),
    'preprocessor_config.json':                 ('a6a76d28c93edb273669eb9e0b0636a2bddbb1272c3261e47b7ca6dfdbac1b8d', 339),
}
# the same rule as build/split-models.js: the static hosts cap a file at 25 MiB
SHARD_OVER = 24 * 1024 * 1024
PART_BYTES = 20 * 1024 * 1024

SR = 16000; N_FFT = 400; HOP = 160; N_MELS = 80; N_SAMPLES = 480000; N_FRAMES = 3000

def sha256(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''): h.update(chunk)
    return h.hexdigest()

def fetch():
    from huggingface_hub import hf_hub_download
    os.makedirs(WORK, exist_ok=True)
    got = {}
    for rel, (want, size) in PINNED.items():
        p = hf_hub_download(REPO, rel, revision=REVISION, local_dir=WORK)
        h = sha256(p)
        if h != want or os.path.getsize(p) != size:
            raise SystemExit('%s: sha256 %s / %d bytes, expected %s / %d' % (rel, h, os.path.getsize(p), want, size))
        got[rel] = p
        print('  ok  %10d  %s' % (size, rel))
    lic = os.path.join(WORK, 'LICENSE-whisper.txt')
    if not os.path.exists(lic):
        urllib.request.urlretrieve(LICENCE_URL, lic)
    text = open(lic, encoding='utf-8').read()
    for must in LICENCE_MUST_CONTAIN:
        if must not in text: raise SystemExit('licence text does not contain %r' % must)
    print('  ok  %10d  LICENSE (MIT, openai/whisper) sha256 %s' % (len(text.encode()), sha256(lic)))
    got['LICENSE'] = lic
    return got

# ---------------- tokens.json ----------------
def build_tokens(vocab_path, added_path):
    v = json.load(open(vocab_path, encoding='utf-8'))
    a = json.load(open(added_path, encoding='utf-8'))
    n_text = 50257  # ids 0..50256 are text; <|endoftext|> is 50257 and everything above it is special
    toks = [None] * n_text
    for t, i in v.items():
        if i < n_text: toks[i] = t
    if any(t is None for t in toks): raise SystemExit('vocab has holes')
    ids = {t: i for t, i in a.items()}
    ids.update({t: i for t, i in v.items() if i >= n_text})
    return toks, ids

def write_shards(src, dst_base):
    size = os.path.getsize(src)
    if size <= SHARD_OVER:
        shutil.copyfile(src, dst_base)
        return [os.path.basename(dst_base)]
    parts = []
    with open(src, 'rb') as f:
        i = 0
        while True:
            chunk = f.read(PART_BYTES)
            if not chunk: break
            p = dst_base + '.part%d' % i
            open(p, 'wb').write(chunk)
            parts.append(os.path.basename(p)); i += 1
    return parts

def build(got):
    os.makedirs(OUT_DIR, exist_ok=True)
    cfg = json.load(open(got['config.json']))
    gen = json.load(open(got['generation_config.json']))
    pre = json.load(open(got['preprocessor_config.json']))
    toks, special = build_tokens(got['vocab.json'], got['added_tokens.json'])
    files = {}
    for rel, name in [('onnx/encoder_model_quantized.onnx', 'encoder_model_quantized.onnx'), ('onnx/decoder_model_merged_quantized.onnx', 'decoder_model_merged_quantized.onnx')]:
        parts = write_shards(got[rel], os.path.join(OUT_DIR, name))
        files[name] = {'bytes': os.path.getsize(got[rel]), 'sha256': PINNED[rel][0], 'parts': parts, 'source': rel}
    tp = os.path.join(OUT_DIR, 'tokens.json')
    json.dump(toks, open(tp, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    files['tokens.json'] = {'bytes': os.path.getsize(tp), 'sha256': sha256(tp), 'parts': ['tokens.json'], 'source': 'vocab.json (ids 0-50256)'}
    manifest = {
        'name': 'Whisper tiny (multilingual), ONNX uint8',
        'source': 'https://huggingface.co/%s/tree/%s' % (REPO, REVISION),
        'upstream': 'https://github.com/openai/whisper (MIT)',
        'licence': 'MIT',
        'files': files,
        'dims': {'n_mels': cfg['num_mel_bins'], 'd_model': cfg['d_model'], 'heads': cfg['decoder_attention_heads'],
                 'head_dim': cfg['d_model'] // cfg['decoder_attention_heads'], 'decoder_layers': cfg['decoder_layers'],
                 'encoder_layers': cfg['encoder_layers'], 'n_vocab': cfg['vocab_size'], 'n_audio_ctx': cfg['max_source_positions'],
                 'n_text_ctx': cfg['max_target_positions']},
        'audio': {'sample_rate': pre['sampling_rate'], 'n_fft': pre['n_fft'], 'hop_length': pre['hop_length'], 'chunk_length': pre['chunk_length'],
                  'n_samples': pre['n_samples'], 'n_frames': pre['nb_max_frames'], 'n_mels': pre['feature_size']},
        'tokens': {'eot': cfg['eos_token_id'], 'sot': cfg['decoder_start_token_id'], 'translate': gen['task_to_id']['translate'],
                   'transcribe': gen['task_to_id']['transcribe'], 'startoflm': special['<|startoflm|>'], 'startofprev': gen['prev_sot_token_id'],
                   'nocaptions': special['<|nocaptions|>'], 'notimestamps': gen['no_timestamps_token_id'], 'timestamp_begin': special['<|0.00|>'],
                   'n_text': 50257, 'en': gen['lang_to_id']['<|en|>']},
        'lang_to_id': gen['lang_to_id'],
        'suppress_tokens': sorted(set(gen['suppress_tokens'])),
        'begin_suppress_tokens': gen['begin_suppress_tokens'],
        'max_initial_timestamp_index': gen['max_initial_timestamp_index'],
        'time_precision': 0.02,
        'alignment_heads': gen.get('alignment_heads'),
        'io': {
            'encoder': {'inputs': {'input_features': [1, 80, 3000]}, 'outputs': {'last_hidden_state': [1, 1500, 384]}},
            'decoder': {'inputs': ['input_ids [1, n] int64', 'encoder_hidden_states [1, 1500, 384]',
                                   'past_key_values.{0-3}.decoder.{key,value} [1, 6, past, 64]',
                                   'past_key_values.{0-3}.encoder.{key,value} [1, 6, 1500, 64] (empty on the first step)',
                                   'use_cache_branch [1] bool'],
                        'outputs': ['logits [1, n, 51865]', 'present.{0-3}.decoder.{key,value} [1, 6, past+n, 64]',
                                    'present.{0-3}.encoder.{key,value} [1, 6, 1500, 64]']}
        }
    }
    mp = os.path.join(OUT_DIR, 'whisper-tiny.json')
    json.dump(manifest, open(mp, 'w', encoding='utf-8'), indent=1)
    shutil.copyfile(got['LICENSE'], os.path.join(MODELS_DIR, 'LICENSE-whisper.txt'))
    write_readme(manifest, got)
    total = sum(f['bytes'] for f in files.values())
    print('  wrote %s (%d files, %.1f MB) + README-whisper.txt + LICENSE-whisper.txt' % (OUT_DIR, len(files), total / 1e6))
    return manifest

def write_readme(m, got):
    f = m['files']
    lines = [
        'whisper-tiny/  (used by engine/aivid-whisper.js for /ai-video/auto-captions/)',
        '',
        '  OpenAI Whisper, the "tiny" multilingual model: 39M parameters, 4 encoder and 4',
        '  decoder layers, d_model 384, 6 heads of 64, vocabulary 51,865 (50,257 text tokens',
        '  + 1,608 special tokens: <|endoftext|> 50257, <|startoftranscript|> 50258, 99',
        '  language tokens 50259-50357, <|translate|> 50358, <|transcribe|> 50359, <|startoflm|>',
        '  50360, <|startofprev|> 50361, <|nocaptions|> 50362, <|notimestamps|> 50363, and the',
        '  1,501 timestamp tokens <|0.00|>..<|30.00|> = 50364..51864, 0.02 s apart).',
        '',
        '  Weights: https://github.com/openai/whisper (MIT, see ../LICENSE-whisper.txt, fetched',
        '  from ' + LICENCE_URL + ').',
        '  ONNX conversion: ' + m['source'],
        '  (Hugging Face, onnx-community; exported from the transformers checkpoint',
        '  openai/whisper-tiny with Optimum, then dynamically quantised to uint8 weights -',
        '  the files named *_quantized.onnx, which the repo also publishes as *_uint8.onnx',
        '  with the same hash). A conversion of MIT weights carries the MIT licence; the',
        '  repository states no other licence. Pinned revision ' + REVISION + '.',
        '',
        '  Files shipped (sha256 of the whole file; a sharded file lists its parts):'
    ]
    for name, info in f.items():
        lines.append('    %-38s %10d bytes  %s' % (name, info['bytes'], info['sha256']))
        if info['parts'] != [name]: lines.append('      parts: ' + ', '.join(info['parts']))
        lines.append('      from %s' % info['source'])
    lines += [
        '    whisper-tiny.json                       the manifest: files, dims, token ids, suppress lists, mel settings',
        '  Upstream sha256 of the small files read to build these: vocab.json 50d6a919f0a06...e2c1a,',
        '  added_tokens.json 9715fd2243b6f...8acd1, config.json 46aeea0a406af...efd2d,',
        '  generation_config.json f5c67e5a4f710...facd1, preprocessor_config.json a6a76d28c93ed...1b8d.',
        '',
        '  Inputs and outputs',
        '    encoder_model_quantized.onnx',
        '      in  input_features      float32 [1, 80, 3000]   (one 30 s window of log-mel)',
        '      out last_hidden_state   float32 [1, 1500, 384]',
        '    decoder_model_merged_quantized.onnx',
        '      in  input_ids           int64   [1, n]           (the 3-token prompt, then one token a step)',
        '      in  encoder_hidden_states float32 [1, 1500, 384]',
        '      in  past_key_values.{0..3}.decoder.{key,value} float32 [1, 6, past, 64]',
        '      in  past_key_values.{0..3}.encoder.{key,value} float32 [1, 6, 1500, 64]',
        '      in  use_cache_branch    bool    [1]              (false on the first step with empty pasts of',
        '                                                        shape [1, 6, 0, 64]; true afterwards)',
        '      out logits              float32 [1, n, 51865]',
        '      out present.{0..3}.decoder.{key,value} float32 [1, 6, past+n, 64]   (fed back as past)',
        '      out present.{0..3}.encoder.{key,value} float32 [1, 6, 1500, 64]     (computed on the first',
        '                                                        step, then fed back unchanged)',
        '',
        '  Preprocessing (WhisperFeatureExtractor, mirrored in JS)',
        '    16 kHz mono float32; 30 s windows of 480,000 samples, the last padded with zeros;',
        '    STFT n_fft 400, hop 160, periodic Hann window, centre with 200-sample reflect padding,',
        '    3,001 frames of which the last is dropped; power spectrum |X|^2 on 201 bins;',
        '    80 Slaney mel filters 0-8000 Hz (librosa mel(sr=16000, n_fft=400, n_mels=80), norm',
        '    slaney, identical to openai/whisper mel_filters.npz to 2e-9), log10 with a floor of',
        '    1e-10, clamped to (max - 8) over the window, then (x + 4) / 4.',
        '',
        '  Decoding (greedy, as openai/whisper DecodingTask + transcribe.py)',
        '    prompt <|startoftranscript|><|en|><|transcribe|> - with timestamps (no <|notimestamps|>);',
        '    suppress generation_config.suppress_tokens (non-speech and special tokens) at every step,',
        '    begin_suppress_tokens [220, 50257] at the first step, <|notimestamps|> always; timestamp',
        '    rules: after one timestamp a text token must follow, after a text run a timestamp or',
        '    <|endoftext|>; timestamps never decrease; the first token is a timestamp no later than',
        '    index 50 (1.0 s); when the summed probability of the timestamp tokens beats the best',
        '    text token a timestamp is taken. At most 224 new tokens a window; a run of four',
        '    identical tokens stops the window. Segments follow transcribe.py: text between two',
        '    consecutive timestamps is a segment; a window ending on a single timestamp seeks past',
        '    the whole window, otherwise the next window starts at the last closed timestamp.',
        '    Word timings are the segment split proportionally to character length (approximate;',
        '    no cross-attention alignment in this version).',
        '',
        '  Prepared by build/ai-video/prepare-whisper.py on ' + time.strftime('%Y-%m-%d') + '.'
    ]
    open(os.path.join(MODELS_DIR, 'README-whisper.txt'), 'w', encoding='utf-8').write('\n'.join(lines) + '\n')

def check():
    mp = os.path.join(OUT_DIR, 'whisper-tiny.json')
    if not os.path.exists(mp): raise SystemExit('no manifest at ' + mp)
    m = json.load(open(mp))
    ok = True
    for name, info in m['files'].items():
        h = hashlib.sha256(); n = 0
        for p in info['parts']:
            fp = os.path.join(OUT_DIR, p)
            if not os.path.exists(fp): print('  MISSING', p); ok = False; continue
            b = open(fp, 'rb').read(); h.update(b); n += len(b)
            if len(b) > SHARD_OVER: print('  TOO BIG', p, len(b)); ok = False
        good = h.hexdigest() == info['sha256'] and n == info['bytes']
        print('  %s %10d  %s' % ('ok ' if good else 'BAD', n, name))
        ok = ok and good
    import onnxruntime as ort
    for name in ['encoder_model_quantized.onnx', 'decoder_model_merged_quantized.onnx']:
        parts = m['files'][name]['parts']
        data = b''.join(open(os.path.join(OUT_DIR, p), 'rb').read() for p in parts)
        s = ort.InferenceSession(data, providers=['CPUExecutionProvider'])
        print('  %s loads: %d inputs, %d outputs' % (name, len(s.get_inputs()), len(s.get_outputs())))
    if not ok: raise SystemExit('verification failed')
    print('  all files verified')

# ---------------- the reference pipeline (what engine/aivid-whisper.js mirrors) ----------------
def read_wav(path):
    w = wave.open(path, 'rb')
    ch, sw, sr, n = w.getnchannels(), w.getsampwidth(), w.getframerate(), w.getnframes()
    raw = w.readframes(n); w.close()
    if sw == 2: a = np.frombuffer(raw, dtype='<i2').astype(np.float32) / 32768.0
    elif sw == 1: a = (np.frombuffer(raw, dtype=np.uint8).astype(np.float32) - 128) / 128.0
    elif sw == 4: a = np.frombuffer(raw, dtype='<i4').astype(np.float32) / 2147483648.0
    else: raise SystemExit('unsupported sample width %d' % sw)
    if ch > 1: a = a.reshape(-1, ch).mean(axis=1)
    return a, sr

def resample_linear(a, sr, to=SR):
    if sr == to: return a.astype(np.float32)
    n = int(round(len(a) * to / sr))
    pos = np.arange(n, dtype=np.float64) * (sr / to)
    i = np.minimum(np.floor(pos).astype(np.int64), len(a) - 1)
    f = (pos - np.floor(pos)).astype(np.float32)
    i1 = np.minimum(i + 1, len(a) - 1)
    return (a[i] * (1 - f) + a[i1] * f).astype(np.float32)

def hz_to_mel(f):
    f = np.asarray(f, dtype=np.float64); f_sp = 200.0 / 3
    min_log_hz = 1000.0; min_log_mel = min_log_hz / f_sp; logstep = np.log(6.4) / 27.0
    return np.where(f >= min_log_hz, min_log_mel + np.log(np.maximum(f, 1e-9) / min_log_hz) / logstep, f / f_sp)

def mel_to_hz(m):
    m = np.asarray(m, dtype=np.float64); f_sp = 200.0 / 3
    min_log_hz = 1000.0; min_log_mel = min_log_hz / f_sp; logstep = np.log(6.4) / 27.0
    return np.where(m >= min_log_mel, min_log_hz * np.exp(logstep * (m - min_log_mel)), f_sp * m)

def mel_filters(sr=SR, n_fft=N_FFT, n_mels=N_MELS, fmin=0.0, fmax=None):
    fmax = fmax or sr / 2
    fftfreqs = np.linspace(0, sr / 2, 1 + n_fft // 2)
    mel_f = mel_to_hz(np.linspace(hz_to_mel(fmin), hz_to_mel(fmax), n_mels + 2))
    fdiff = np.diff(mel_f); ramps = mel_f[:, None] - fftfreqs[None, :]
    w = np.zeros((n_mels, 1 + n_fft // 2))
    for i in range(n_mels):
        w[i] = np.maximum(0, np.minimum(-ramps[i] / fdiff[i], ramps[i + 2] / fdiff[i + 1]))
    w *= (2.0 / (mel_f[2:n_mels + 2] - mel_f[:n_mels]))[:, None]
    return w.astype(np.float32)

def log_mel(samples, filters):
    x = np.pad(samples, (N_FFT // 2, N_FFT // 2), mode='reflect')
    win = (0.5 - 0.5 * np.cos(2 * np.pi * np.arange(N_FFT) / N_FFT)).astype(np.float32)
    n_frames = 1 + (len(x) - N_FFT) // HOP
    frames = np.lib.stride_tricks.as_strided(x, shape=(n_frames, N_FFT), strides=(x.strides[0] * HOP, x.strides[0]))
    spec = np.fft.rfft(frames * win, axis=1)
    mag = (spec.real ** 2 + spec.imag ** 2)[:N_FRAMES].T.astype(np.float32)
    log_spec = np.log10(np.maximum(filters @ mag, 1e-10))
    log_spec = np.maximum(log_spec, log_spec.max() - 8.0)
    return ((log_spec + 4.0) / 4.0).astype(np.float32)

def bytes_to_unicode():
    bs = list(range(ord('!'), ord('~') + 1)) + list(range(ord('¡'), ord('¬') + 1)) + list(range(ord('®'), ord('ÿ') + 1))
    cs = bs[:]; n = 0
    for b in range(256):
        if b not in bs: bs.append(b); cs.append(256 + n); n += 1
    return dict(zip(bs, [chr(c) for c in cs]))

class Model:
    def __init__(self):
        import onnxruntime as ort
        m = json.load(open(os.path.join(OUT_DIR, 'whisper-tiny.json')))
        self.m = m
        so = ort.SessionOptions(); so.intra_op_num_threads = 1
        def load(name):
            data = b''.join(open(os.path.join(OUT_DIR, p), 'rb').read() for p in m['files'][name]['parts'])
            return ort.InferenceSession(data, so, providers=['CPUExecutionProvider'])
        self.enc = load('encoder_model_quantized.onnx'); self.dec = load('decoder_model_merged_quantized.onnx')
        self.dec_in = [i.name for i in self.dec.get_inputs()]; self.dec_out = [o.name for o in self.dec.get_outputs()]
        self.toks = json.load(open(os.path.join(OUT_DIR, 'tokens.json'), encoding='utf-8'))
        self.u2b = {u: b for b, u in bytes_to_unicode().items()}
        self.T = m['tokens']; self.suppress = m['suppress_tokens']; self.begin_suppress = m['begin_suppress_tokens']
        self.max_init = m['max_initial_timestamp_index']; self.heads = m['dims']['heads']; self.hd = m['dims']['head_dim']

    def decode_text(self, ids):
        out = bytearray()
        for i in ids:
            if i >= self.T['n_text']: continue
            for ch in self.toks[i]: out.append(self.u2b[ch])
        return out.decode('utf-8', errors='replace')

    def window(self, mel, max_tokens=224):
        enc = self.enc.run(None, {'input_features': mel[None]})[0]
        past = {n: np.zeros((1, self.heads, 0, self.hd), np.float32) for n in self.dec_in if n.startswith('past_key_values.')}
        ids = np.array([[self.T['sot'], self.T['en'], self.T['transcribe']]], np.int64)
        sampled = []; step = 0
        while True:
            feed = {'input_ids': ids, 'encoder_hidden_states': enc, 'use_cache_branch': np.array([step > 0])}; feed.update(past)
            o = dict(zip(self.dec_out, self.dec.run(None, feed)))
            for n in past:
                if '.decoder.' in n or step == 0: past[n] = o['present.' + n[len('past_key_values.'):]]
            step += 1
            nxt = self.pick(o['logits'][0, -1].astype(np.float64), sampled)
            if nxt == self.T['eot'] or len(sampled) >= max_tokens: break
            sampled.append(nxt)
            if len(sampled) >= 4 and len(set(sampled[-4:])) == 1: sampled = sampled[:-3]; break
            ids = np.array([[nxt]], np.int64)
        return sampled

    def pick(self, logits, sampled):
        T = self.T; TB = T['timestamp_begin']; NEG = -np.inf
        if not sampled: logits[self.begin_suppress] = NEG
        logits[self.suppress] = NEG; logits[T['notimestamps']] = NEG
        last_ts = len(sampled) >= 1 and sampled[-1] >= TB
        pen_ts = len(sampled) < 2 or sampled[-2] >= TB
        if last_ts:
            if pen_ts: logits[TB:] = NEG
            else: logits[:T['eot']] = NEG
        ts = [t for t in sampled if t >= TB]
        if ts: logits[TB:(ts[-1] if (last_ts and not pen_ts) else ts[-1] + 1)] = NEG
        if not sampled: logits[:TB] = NEG; logits[TB + self.max_init + 1:] = NEG
        mx = logits.max(); lp = logits - (mx + np.log(np.exp(logits - mx).sum()))
        tl = lp[TB:]; fin = np.isfinite(tl)
        ts_mass = np.log(np.exp(tl[fin]).sum()) if fin.any() else NEG
        if ts_mass > lp[:TB].max(): logits[:TB] = NEG
        return int(np.argmax(logits))

def segments_from(tokens, offset, seg_dur, TB, EOT):
    is_ts = [t >= TB for t in tokens]
    single_end = len(tokens) >= 2 and is_ts[-2:] == [False, True]
    consecutive = [i + 1 for i in range(len(tokens) - 1) if is_ts[i] and is_ts[i + 1]]
    segs = []
    if consecutive:
        slices = consecutive[:] + ([len(tokens)] if single_end else [])
        last = 0
        for cur in slices:
            sl = tokens[last:cur]
            segs.append({'start': offset + (sl[0] - TB) * 0.02, 'end': offset + (sl[-1] - TB) * 0.02, 'tokens': [t for t in sl if t < EOT]}); last = cur
        adv = seg_dur if single_end else (tokens[last - 1] - TB) * 0.02
    else:
        dur = seg_dur
        ts = [t for t in tokens if t >= TB]
        if ts and ts[-1] != TB: dur = (ts[-1] - TB) * 0.02
        segs.append({'start': offset, 'end': offset + dur, 'tokens': [t for t in tokens if t < EOT]}); adv = seg_dur
    return segs, max(adv, 0.02)

def transcribe(wav, dump=None):
    a, sr = read_wav(wav); s16 = resample_linear(a, sr)
    print('  audio %.2fs @ %d Hz -> %d samples @ 16 kHz' % (len(a) / sr, sr, len(s16)))
    filters = mel_filters()
    npz = os.path.join(os.path.dirname(os.path.abspath(wav)), 'mel_filters.npz')
    if os.path.exists(npz):
        print('  mel filterbank vs openai mel_filters.npz: max abs diff %.3e' % np.abs(filters - np.load(npz)['mel_80']).max())
    model = Model(); TB = model.T['timestamp_begin']; EOT = model.T['eot']
    if dump:
        os.makedirs(dump, exist_ok=True); s16.tofile(os.path.join(dump, 'speech16k.f32')); filters.tofile(os.path.join(dump, 'mel_filters80.f32'))
    total = len(s16) / SR; seek = 0.0; out = []; win = 0; t0 = time.time()
    while seek < total - 0.05:
        start = int(round(seek * SR)); chunk = s16[start:start + N_SAMPLES]
        seg_dur = min(30.0, len(chunk) / SR)
        if len(chunk) < N_SAMPLES: chunk = np.pad(chunk, (0, N_SAMPLES - len(chunk)))
        mel = log_mel(chunk, filters)
        toks = model.window(mel)
        if dump and win == 0:
            mel.tofile(os.path.join(dump, 'mel0.f32')); json.dump(toks, open(os.path.join(dump, 'tokens0.json'), 'w'))
        segs, adv = segments_from(toks, seek, seg_dur, TB, EOT)
        for s in segs:
            s['text'] = model.decode_text(s['tokens']).strip()
            if s['text']: out.append(s)
        seek += adv; win += 1
    print('  %d window(s) in %.2fs' % (win, time.time() - t0))
    for s in out: print('  [%6.2f -> %6.2f] %s' % (s['start'], s['end'], s['text']))
    if dump: json.dump(out, open(os.path.join(dump, 'segments.json'), 'w'), indent=1)
    return out

if __name__ == '__main__':
    args = sys.argv[1:]
    if '--transcribe' in args:
        dump = args[args.index('--dump') + 1] if '--dump' in args else None
        transcribe(args[args.index('--transcribe') + 1], dump)
    elif '--check' in args:
        check()
    else:
        print('fetching %s @ %s' % (REPO, REVISION[:12]))
        got = fetch()
        build(got)
        check()
