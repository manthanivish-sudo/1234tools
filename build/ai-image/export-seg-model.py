"""
Export an EfficientViT-Seg ADE20K checkpoint to ONNX for the browser.

  python export_seg.py --model efficientvit-seg-b1-ade20k --weights <file.pt> --out <file.onnx> [--size 512] [--dynamic]

Then checks the ONNX output against PyTorch on a random input and on a
real photo, and prints the top classes.
"""
import argparse, os, sys, time, json
import numpy as np
import torch

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'efficientvit')
sys.path.insert(0, ROOT)
from efficientvit.seg_model_zoo import create_efficientvit_seg_model  # noqa: E402

ap = argparse.ArgumentParser()
ap.add_argument('--model', default='efficientvit-seg-b1-ade20k')
ap.add_argument('--weights', required=True)
ap.add_argument('--out', required=True)
ap.add_argument('--size', type=int, default=512)
ap.add_argument('--dynamic', action='store_true')
ap.add_argument('--opset', type=int, default=17)
ap.add_argument('--photo', default=None)
args = ap.parse_args()

model = create_efficientvit_seg_model(args.model, pretrained=True, weight_url=args.weights)
model.eval()
n_params = sum(p.numel() for p in model.parameters())
print('params', n_params, '=', round(n_params * 4 / 1048576, 1), 'MB fp32')

x = torch.rand(1, 3, args.size, args.size)
with torch.no_grad():
    y = model(x)
print('torch output', tuple(y.shape))

dyn = {'pixel_values': {0: 'batch', 2: 'height', 3: 'width'}, 'logits': {0: 'batch', 2: 'h', 3: 'w'}} if args.dynamic else None
t0 = time.time()
torch.onnx.export(model, x, args.out, input_names=['pixel_values'], output_names=['logits'],
                  opset_version=args.opset, dynamic_axes=dyn, do_constant_folding=True, dynamo=False)
print('exported in', round(time.time() - t0, 1), 's ->', args.out, round(os.path.getsize(args.out) / 1048576, 1), 'MB')

import onnx
m = onnx.load(args.out)
onnx.checker.check_model(m)
ops = {}
for n in m.graph.node:
    ops[n.op_type] = ops.get(n.op_type, 0) + 1
print('ops:', json.dumps(dict(sorted(ops.items(), key=lambda kv: -kv[1]))))

import onnxruntime as ort
sess = ort.InferenceSession(args.out, providers=['CPUExecutionProvider'])
inp = sess.get_inputs()[0]
print('input', inp.name, inp.shape, '| output', sess.get_outputs()[0].name, sess.get_outputs()[0].shape)

def check(size):
    xx = torch.rand(1, 3, size, size)
    with torch.no_grad():
        ref = model(xx).numpy()
    t = time.time()
    got = sess.run(None, {'pixel_values': xx.numpy()})[0]
    dt = time.time() - t
    print(f'  {size}x{size}: out {got.shape}, max|diff| {np.abs(got - ref).max():.5f}, argmax agree {(got.argmax(1) == ref.argmax(1)).mean()*100:.2f}%, ort cpu {dt*1000:.0f} ms')

check(args.size)
if args.dynamic:
    check(384); check(768)

if args.photo:
    from PIL import Image
    im = Image.open(args.photo).convert('RGB').resize((args.size, args.size), Image.BICUBIC)
    a = np.asarray(im).astype(np.float32) / 255.0
    a = (a - np.array([0.485, 0.456, 0.406], dtype=np.float32)) / np.array([0.229, 0.224, 0.225], dtype=np.float32)
    a = a.transpose(2, 0, 1)[None]
    logits = sess.run(None, {'pixel_values': a})[0][0]
    pred = logits.argmax(0)
    ids, counts = np.unique(pred, return_counts=True)
    order = np.argsort(-counts)
    names = ['wall','building','sky','floor','tree','ceiling','road','bed','windowpane','grass','cabinet','sidewalk','person','earth','door','table','mountain','plant','curtain','chair','car','water','painting','sofa','shelf','house','sea','mirror','rug','field','armchair','seat','fence','desk','rock','wardrobe','lamp','bathtub','railing','cushion','base','box','column','signboard','chest of drawers','counter','sand','sink','skyscraper','fireplace','refrigerator','grandstand','path','stairs','runway','case','pool table','pillow','screen door','stairway','river','bridge','bookcase','blind','coffee table','toilet','flower','book','hill','bench','countertop','stove','palm','kitchen island','computer','swivel chair','boat','bar','arcade machine','hovel','bus','towel','light','truck','tower','chandelier','awning','streetlight','booth','television receiver','airplane','dirt track','apparel','pole','land','bannister','escalator','ottoman','bottle','buffet','poster','stage','van','ship','fountain','conveyer belt','canopy','washer','plaything','swimming pool','stool','barrel','basket','waterfall','tent','bag','minibike','cradle','oven','ball','food','step','tank','trade name','microwave','pot','animal','bicycle','lake','dishwasher','screen','blanket','sculpture','hood','sconce','vase','traffic light','tray','ashcan','fan','pier','crt screen','plate','monitor','bulletin board','shower','radiator','glass','clock','flag']
    print('  photo classes:', ', '.join(f'{names[i]} {c/pred.size*100:.1f}%' for i, c in zip(ids[order][:10], counts[order][:10])))
