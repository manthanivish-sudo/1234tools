"""
Export MI-GAN (Picsart AI Research, MIT) to ONNX for the browser.

  python export-migan.py --repo <MI-GAN clone> --weights migan_512_places2.pt --out <file.onnx>
                         [--resolution 512] [--opset 17] [--examples <dir with images/ masks/ results/>]
                         [--photo <jpg> --hole x,y,w,h] [--look <dir>]

The generator is resolution-specific (its upsamplers carry constant filters
of that size), so the graph is exported at a fixed 512×512 — the page cuts
a square window around the hole and scales it, exactly as the authors' own
demo does. Inputs:

  image  1×3×512×512 float32, RGB in [-1, 1]     (pixel * 2 / 255 - 1)
  mask   1×1×512×512 float32, 1 = keep, 0 = hole  (the repo's convention:
                                                  x = cat([mask - 0.5, image * mask]))
  output 1×3×512×512 float32 in [-1, 1]          (pixel = (out * 0.5 + 0.5) * 255)

The concatenation happens inside the graph, so the page feeds the picture
and the mask separately. Afterwards the script checks the ONNX output
against PyTorch (max abs diff) on a random input and on real photos, and
writes side-by-side PNGs to --look so the fill can be looked at.
"""
import argparse, os, sys, time, json, hashlib
import numpy as np
import torch
import torch.nn as nn

ap = argparse.ArgumentParser()
ap.add_argument('--repo', required=True, help='path to a clone of https://github.com/Picsart-AI-Research/MI-GAN')
ap.add_argument('--weights', required=True, help='migan_512_places2.pt from the repo\'s Google Drive folder')
ap.add_argument('--out', required=True)
ap.add_argument('--resolution', type=int, default=512)
ap.add_argument('--opset', type=int, default=17)
ap.add_argument('--examples', default=None, help='the repo\'s examples/places2_512_object directory')
ap.add_argument('--photo', default=None, help='any photo; --hole x,y,w,h (fractions of the frame) is filled')
ap.add_argument('--hole', default='0.35,0.3,0.3,0.45')
ap.add_argument('--look', default=None, help='directory for the side-by-side PNGs')
ap.add_argument('--count', type=int, default=4)
args = ap.parse_args()

# The repo's package __init__ drags in the training stack (dnnlib, requests);
# the inference generator is one self-contained file, so load just that.
import importlib.util  # noqa: E402
_spec = importlib.util.spec_from_file_location('migan_inference', os.path.join(args.repo, 'lib', 'model_zoo', 'migan_inference.py'))
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)
Generator = _mod.Generator

R = args.resolution
g = Generator(resolution=R)
sd = torch.load(args.weights, map_location='cpu', weights_only=True)
missing, unexpected = g.load_state_dict(sd, strict=True), None
g.eval()
n_params = sum(p.numel() for p in g.parameters())
n_buf = sum(b.numel() for b in g.buffers())
print('params', n_params, '+ buffers', n_buf, '=', round((n_params + n_buf) * 4 / 1048576, 1), 'MB fp32')
print('weights sha256', hashlib.sha256(open(args.weights, 'rb').read()).hexdigest(), os.path.getsize(args.weights), 'bytes')


class Inpaint(nn.Module):
    """image in [-1,1] and mask (1 keep / 0 hole) in, the generator's picture out."""
    def __init__(self, gen):
        super().__init__()
        self.gen = gen

    def forward(self, image, mask):
        x = torch.cat([mask - 0.5, image * mask], dim=1)
        return self.gen(x)


model = Inpaint(g).eval()


def random_mask(seed=0):
    rng = np.random.default_rng(seed)
    m = np.ones((R, R), np.float32)
    for _ in range(3):
        x, y = rng.integers(40, R - 140, 2)
        w, h = rng.integers(60, 140, 2)
        m[y:y + h, x:x + w] = 0
    return torch.from_numpy(m)[None, None]


with torch.no_grad():
    img = torch.rand(1, 3, R, R) * 2 - 1
    msk = random_mask(1)
    ref = model(img, msk)
print('torch output', tuple(ref.shape), 'range', float(ref.min()), float(ref.max()))

t0 = time.time()
torch.onnx.export(model, (img, msk), args.out, input_names=['image', 'mask'], output_names=['output'],
                  opset_version=args.opset, do_constant_folding=True, dynamo=False)
print('exported in', round(time.time() - t0, 1), 's ->', args.out, round(os.path.getsize(args.out) / 1048576, 2), 'MB')

import onnx  # noqa: E402
m = onnx.load(args.out)
onnx.checker.check_model(m)
ops = {}
for n in m.graph.node:
    ops[n.op_type] = ops.get(n.op_type, 0) + 1
print('ops:', json.dumps(dict(sorted(ops.items(), key=lambda kv: -kv[1]))))
print('onnx sha256', hashlib.sha256(open(args.out, 'rb').read()).hexdigest(), os.path.getsize(args.out), 'bytes')

import onnxruntime as ort  # noqa: E402
sess = ort.InferenceSession(args.out, providers=['CPUExecutionProvider'])
print('inputs', [(i.name, i.shape, i.type) for i in sess.get_inputs()], '| outputs', [(o.name, o.shape, o.type) for o in sess.get_outputs()])


def run_onnx(image, mask):
    t = time.time()
    out = sess.run(None, {'image': image.numpy(), 'mask': mask.numpy()})[0]
    return torch.from_numpy(out), (time.time() - t) * 1000


def compare(image, mask, label):
    with torch.no_grad():
        ref = model(image, mask)
    got, ms = run_onnx(image, mask)
    d = (got - ref).abs()
    print(f'  {label}: max|diff| {d.max():.6f}, mean|diff| {d.mean():.7f}, ort cpu {ms:.0f} ms')
    return got


compare(img, msk, 'random input')
compare(torch.rand(1, 3, R, R) * 2 - 1, random_mask(7), 'random input 2')

from PIL import Image  # noqa: E402


def to_tensor(im):
    a = np.asarray(im.convert('RGB').resize((R, R), Image.BICUBIC)).astype(np.float32)
    return torch.from_numpy(a * 2 / 255 - 1).permute(2, 0, 1)[None]


def to_image(t):
    a = ((t[0] * 0.5 + 0.5).clamp(0, 1) * 255).permute(1, 2, 0).numpy().astype(np.uint8)
    return Image.fromarray(a)


def compose(image, mask, out):
    """The authors' postprocess: keep the known pixels, take the fill in the hole."""
    return image * mask + out * (1 - mask)


def side_by_side(panels, path):
    w = sum(p.width for p in panels)
    h = max(p.height for p in panels)
    s = Image.new('RGB', (w, h), (20, 20, 20))
    x = 0
    for p in panels:
        s.paste(p, (x, 0))
        x += p.width
    s.save(path)


if args.look:
    os.makedirs(args.look, exist_ok=True)

if args.examples:
    import glob
    ims = sorted(glob.glob(os.path.join(args.examples, 'images', '*.png')))[:args.count]
    print('examples (the repo\'s masks are white where the object is, so they are inverted here: white -> hole):')
    for p in ims:
        name = os.path.basename(p)
        im = Image.open(p).convert('RGB')
        mk = Image.open(os.path.join(args.examples, 'masks', name)).convert('L').resize((R, R), Image.NEAREST)
        hole = (np.asarray(mk) >= 128).astype(np.float32)           # white = the object to remove
        keep = torch.from_numpy(1 - hole)[None, None]
        image = to_tensor(im)
        got = compare(image, keep, name)
        comp = compose(image, keep, got)
        if args.look:
            marked = image.clone()
            marked[0, 0] = torch.where(keep[0, 0] > 0.5, marked[0, 0], torch.tensor(1.0))
            marked[0, 1] = torch.where(keep[0, 0] > 0.5, marked[0, 1], torch.tensor(-0.6))
            marked[0, 2] = torch.where(keep[0, 0] > 0.5, marked[0, 2], torch.tensor(-0.6))
            panels = [to_image(marked).resize(im.size, Image.BICUBIC), to_image(comp).resize(im.size, Image.BICUBIC)]
            official = os.path.join(args.examples, 'results', 'migan', name)
            if os.path.exists(official):
                panels.append(Image.open(official).convert('RGB').resize(im.size, Image.BICUBIC))
            side_by_side(panels, os.path.join(args.look, 'example-' + name))

if args.photo:
    im = Image.open(args.photo).convert('RGB')
    fx, fy, fw, fh = [float(v) for v in args.hole.split(',')]
    keep = torch.ones(1, 1, R, R)
    x0, y0 = int(fx * R), int(fy * R)
    keep[:, :, y0:int((fy + fh) * R), x0:int((fx + fw) * R)] = 0
    image = to_tensor(im)
    got = compare(image, keep, os.path.basename(args.photo) + ' hole ' + args.hole)
    comp = compose(image, keep, got)
    if args.look:
        marked = image.clone()
        marked[0, 0] = torch.where(keep[0, 0] > 0.5, marked[0, 0], torch.tensor(1.0))
        marked[0, 1] = torch.where(keep[0, 0] > 0.5, marked[0, 1], torch.tensor(-0.6))
        marked[0, 2] = torch.where(keep[0, 0] > 0.5, marked[0, 2], torch.tensor(-0.6))
        side_by_side([to_image(marked), to_image(comp)], os.path.join(args.look, 'photo-' + os.path.splitext(os.path.basename(args.photo))[0] + '.png'))
print('done')
