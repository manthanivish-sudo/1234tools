"""
Prepare the face detector for the browser.

  python build/ai-image/export-face.py [--source <file-or-url>] [--out engine/models/ultraface-rfb-640.onnx] [--photo <jpg>]

The detector is version-RFB-640.onnx from Ultra-Light-Fast-Generic-Face-
Detector-1MB (Linzaer, MIT). The published file is IR version 4 with every
weight listed as a graph input as well as an initializer, which ONNX Runtime
accepts but warns about (one line per weight, 200 of them, on every page
load) and which stops it folding constants. This script:

  1. reads the published file and checks its sha256 against the known value;
  2. drops the initializers from the graph inputs, and any initializer no
     node uses (BatchNorm's num_batches_tracked counters);
  3. runs onnx.checker, then onnxruntime on both files with a real photo and
     a random tensor and insists the outputs agree to 1e-5 (they differ in
     the seventh decimal place: with constant weights the runtime folds
     each BatchNorm into its Conv, which changes the order of the sums);
  4. writes the result, and prints its size, sha256 and the detections on
     the photo, for engine/models/README-ultraface.txt.

Nothing is re-trained or re-quantised: the weights are the author's, byte
for byte.
"""
import argparse, hashlib, io, os, sys, time, urllib.request
import numpy as np
import onnx
import onnxruntime as ort

SOURCE_URL = 'https://raw.githubusercontent.com/Linzaer/Ultra-Light-Fast-Generic-Face-Detector-1MB/master/models/onnx/version-RFB-640.onnx'
SOURCE_SHA256 = '8f4c659275977e7a3bfbfa339a9c769ad793df50f9c0baa8c14b11baa1646430'
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))

ap = argparse.ArgumentParser()
ap.add_argument('--source', default=SOURCE_URL, help='the published version-RFB-640.onnx, a path or a URL')
ap.add_argument('--out', default=os.path.join(ROOT, 'engine', 'models', 'ultraface-rfb-640.onnx'))
ap.add_argument('--photo', default=None, help='a JPEG with a face, for the equality check and a printed detection')
args = ap.parse_args()

ort.set_default_logger_severity(3)
sha = lambda b: hashlib.sha256(b).hexdigest()

if args.source.startswith('http'):
    print('downloading', args.source)
    raw = urllib.request.urlopen(args.source, timeout=120).read()
else:
    raw = open(args.source, 'rb').read()
print('source: %d bytes, sha256 %s' % (len(raw), sha(raw)))
if sha(raw) != SOURCE_SHA256:
    sys.exit('the source file is not the published version-RFB-640.onnx (sha256 mismatch)')

m = onnx.load_from_string(raw)
print('ir_version', m.ir_version, 'opset', [(o.domain or 'ai.onnx', o.version) for o in m.opset_import])

# 2. initializers out of the inputs; unused initializers out altogether
init_names = {t.name for t in m.graph.initializer}
used = set()
for n in m.graph.node:
    used.update(n.input)
kept_inputs = [i for i in m.graph.input if i.name not in init_names]
dropped_inputs = len(m.graph.input) - len(kept_inputs)
del m.graph.input[:]
m.graph.input.extend(kept_inputs)
unused = [t for t in m.graph.initializer if t.name not in used]
for t in unused:
    m.graph.initializer.remove(t)
print('graph inputs: %d weight entries removed, %d real input(s) left: %s' % (dropped_inputs, len(m.graph.input), [i.name for i in m.graph.input]))
print('initializers: %d unused removed (%s...)' % (len(unused), ', '.join(t.name for t in unused[:3])))
onnx.checker.check_model(m)
out_bytes = m.SerializeToString()

# 3. the two must agree
sess_a = ort.InferenceSession(raw, providers=['CPUExecutionProvider'])
sess_b = ort.InferenceSession(out_bytes, providers=['CPUExecutionProvider'])
inp = sess_b.get_inputs()[0]
print('input', inp.name, inp.shape, '| outputs', [(o.name, o.shape) for o in sess_b.get_outputs()])
H, W = inp.shape[2], inp.shape[3]

def feed(arr):
    return {inp.name: ((arr.astype(np.float32) - 127.0) / 128.0).transpose(2, 0, 1)[None]}

tests = [('random', np.random.RandomState(0).randint(0, 256, (H, W, 3)).astype(np.float32))]
if args.photo:
    from PIL import Image
    im = Image.open(args.photo).convert('RGB')
    tests.append(('photo', np.asarray(im.resize((W, H), Image.BILINEAR), dtype=np.float32)))
for label, arr in tests:
    a = sess_a.run(None, feed(arr)); b = sess_b.run(None, feed(arr))
    diff = max(float(np.abs(x - y).max()) for x, y in zip(a, b))
    print('  %s: max |diff| %g' % (label, diff))
    if diff > 1e-5:
        sys.exit('the cleaned model does not match the original')
    if label == 'photo':
        scores, boxes = b
        sc = scores[0, :, 1]
        order = np.argsort(-sc)[:5]
        iw, ih = im.size
        print('  top candidates:', ', '.join('%.3f [%d,%d %dx%d]' % (sc[i], boxes[0, i, 0] * iw, boxes[0, i, 1] * ih, (boxes[0, i, 2] - boxes[0, i, 0]) * iw, (boxes[0, i, 3] - boxes[0, i, 1]) * ih) for i in order))
        t = time.perf_counter()
        for _ in range(5):
            sess_b.run(None, feed(arr))
        print('  onnxruntime cpu: %.1f ms per run' % ((time.perf_counter() - t) / 5 * 1000))

# 4. write
os.makedirs(os.path.dirname(args.out), exist_ok=True)
with open(args.out, 'wb') as f:
    f.write(out_bytes)
print('wrote', args.out, '%d bytes (%.2f MB), sha256 %s' % (len(out_bytes), len(out_bytes) / 1048576, sha(out_bytes)))
