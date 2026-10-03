"""
Export a Real-ESRGAN "general x4v3" checkpoint to ONNX for the browser.

  python export-realesrgan.py --weights realesr-general-x4v3.pth --out ../../engine/models/realesr-general-x4v3.onnx
  python export-realesrgan.py --weights realesr-general-wdn-x4v3.pth --out ../../engine/models/realesr-general-x4v3-wdn.onnx

The weights come from the Real-ESRGAN release v0.2.5.0
(https://github.com/xinntao/Real-ESRGAN/releases/tag/v0.2.5.0), published
by Xintao Wang under the BSD-3-Clause licence (engine/models/LICENSE-realesrgan.txt).
The network definition below is SRVGGNetCompact, copied from
realesrgan/archs/srvgg_arch.py of that repository with the basicsr registry
decorator removed, so that this script needs only torch.

Exported graph: fp32, opset 17, dynamic height and width.
  input  "image"     1x3xHxW  RGB in 0..1
  output "upscaled"  1x3x4Hx4W RGB, clamped to 0..1
Afterwards the ONNX output is checked against PyTorch (max abs diff) on
random inputs of several sizes and, with --photo, on a real picture that is
written beside the model as a PNG for a look.
"""
import argparse, hashlib, json, os, sys, time
import numpy as np
import torch
from torch import nn
from torch.nn import functional as F


class SRVGGNetCompact(nn.Module):
    """A compact VGG-style network structure for super-resolution.

    Copied from Real-ESRGAN, realesrgan/archs/srvgg_arch.py (Xintao Wang,
    BSD-3-Clause). It performs upsampling in the last layer and no
    convolution is conducted on the HR feature space.

    Args:
        num_in_ch (int): Channel number of inputs. Default: 3.
        num_out_ch (int): Channel number of outputs. Default: 3.
        num_feat (int): Channel number of intermediate features. Default: 64.
        num_conv (int): Number of convolution layers in the body network. Default: 16.
        upscale (int): Upsampling factor. Default: 4.
        act_type (str): Activation type, options: 'relu', 'prelu', 'leakyrelu'. Default: prelu.
    """

    def __init__(self, num_in_ch=3, num_out_ch=3, num_feat=64, num_conv=16, upscale=4, act_type='prelu'):
        super(SRVGGNetCompact, self).__init__()
        self.num_in_ch = num_in_ch
        self.num_out_ch = num_out_ch
        self.num_feat = num_feat
        self.num_conv = num_conv
        self.upscale = upscale
        self.act_type = act_type

        self.body = nn.ModuleList()
        # the first conv
        self.body.append(nn.Conv2d(num_in_ch, num_feat, 3, 1, 1))
        # the first activation
        if act_type == 'relu':
            activation = nn.ReLU(inplace=True)
        elif act_type == 'prelu':
            activation = nn.PReLU(num_parameters=num_feat)
        elif act_type == 'leakyrelu':
            activation = nn.LeakyReLU(negative_slope=0.1, inplace=True)
        self.body.append(activation)

        # the body structure
        for _ in range(num_conv):
            self.body.append(nn.Conv2d(num_feat, num_feat, 3, 1, 1))
            # activation
            if act_type == 'relu':
                activation = nn.ReLU(inplace=True)
            elif act_type == 'prelu':
                activation = nn.PReLU(num_parameters=num_feat)
            elif act_type == 'leakyrelu':
                activation = nn.LeakyReLU(negative_slope=0.1, inplace=True)
            self.body.append(activation)

        # the last conv
        self.body.append(nn.Conv2d(num_feat, num_out_ch * upscale * upscale, 3, 1, 1))
        # upsample
        self.upsampler = nn.PixelShuffle(upscale)

    def forward(self, x):
        out = x
        for i in range(0, len(self.body)):
            out = self.body[i](out)

        out = self.upsampler(out)
        # add the nearest upsampled image, so that the network learns the residual
        base = F.interpolate(x, scale_factor=self.upscale, mode='nearest')
        out += base
        return out


class Clamped(nn.Module):
    """The network with its output held to 0..1, so the browser can write pixels straight out."""

    def __init__(self, net):
        super().__init__()
        self.net = net

    def forward(self, image):
        return torch.clamp(self.net(image), 0.0, 1.0)


def sha256(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


ap = argparse.ArgumentParser()
ap.add_argument('--weights', required=True)
ap.add_argument('--out', required=True)
ap.add_argument('--opset', type=int, default=17)
ap.add_argument('--photo', default=None, help='a picture to upscale with the ONNX model, written as <out>.<photo>.png')
args = ap.parse_args()

print('weights', args.weights, os.path.getsize(args.weights), 'bytes, sha256', sha256(args.weights))
state = torch.load(args.weights, map_location='cpu', weights_only=True)
key = 'params_ema' if 'params_ema' in state else 'params' if 'params' in state else None
sd = state[key] if key else state
print('state dict key:', key or '(flat)', '|', len(sd), 'tensors')

net = SRVGGNetCompact(num_in_ch=3, num_out_ch=3, num_feat=64, num_conv=32, upscale=4, act_type='prelu')
missing, unexpected = net.load_state_dict(sd, strict=True), None
net.eval()
model = Clamped(net).eval()
n_params = sum(p.numel() for p in net.parameters())
print('params', n_params, '=', round(n_params * 4 / 1048576, 2), 'MB fp32')

x = torch.rand(1, 3, 128, 128)
with torch.no_grad():
    y = model(x)
print('torch output', tuple(y.shape), 'range', float(y.min()), float(y.max()))

dyn = {'image': {2: 'height', 3: 'width'}, 'upscaled': {2: 'height_x4', 3: 'width_x4'}}
t0 = time.time()
torch.onnx.export(model, x, args.out, input_names=['image'], output_names=['upscaled'],
                  opset_version=args.opset, dynamic_axes=dyn, do_constant_folding=True, dynamo=False)
print('exported in', round(time.time() - t0, 1), 's ->', args.out, os.path.getsize(args.out), 'bytes =', round(os.path.getsize(args.out) / 1048576, 2), 'MB')

import onnx
m = onnx.load(args.out)
onnx.checker.check_model(m)
ops = {}
for n in m.graph.node:
    ops[n.op_type] = ops.get(n.op_type, 0) + 1
print('opset', [(o.domain or 'ai.onnx', o.version) for o in m.opset_import], 'ops:', json.dumps(dict(sorted(ops.items(), key=lambda kv: -kv[1]))))

import onnxruntime as ort
sess = ort.InferenceSession(args.out, providers=['CPUExecutionProvider'])
inp = sess.get_inputs()[0]
print('input', inp.name, inp.shape, inp.type, '| output', sess.get_outputs()[0].name, sess.get_outputs()[0].shape)

worst = 0.0
def check(h, w):
    global worst
    xx = torch.rand(1, 3, h, w)
    with torch.no_grad():
        ref = model(xx).numpy()
    t = time.time()
    got = sess.run(None, {'image': xx.numpy()})[0]
    dt = time.time() - t
    d = float(np.abs(got - ref).max())
    worst = max(worst, d)
    print(f'  {h}x{w}: out {got.shape}, max|diff| {d:.6f}, ort cpu {dt*1000:.0f} ms')

for (h, w) in [(64, 64), (128, 128), (160, 160), (192, 192), (100, 150), (37, 211)]:
    check(h, w)
print('worst max|diff| over all checks:', worst)

if args.photo:
    from PIL import Image
    im = Image.open(args.photo).convert('RGB')
    a = (np.asarray(im).astype(np.float32) / 255.0).transpose(2, 0, 1)[None]
    t = time.time()
    out = sess.run(None, {'image': a})[0][0]
    print(f'  photo {im.size[0]}x{im.size[1]} -> {out.shape[2]}x{out.shape[1]} in {(time.time()-t)*1000:.0f} ms')
    png = np.clip(out.transpose(1, 2, 0) * 255.0 + 0.5, 0, 255).astype(np.uint8)
    dst = args.out + '.' + os.path.splitext(os.path.basename(args.photo))[0] + '.png'
    Image.fromarray(png).save(dst)
    print('  wrote', dst)

print('onnx sha256', sha256(args.out))
