#!/usr/bin/env python3
"""Pre-compute a depth map for every pool poster (scripts/depth-posters.json).

Runs Depth Anything V2 (small, quantized ONNX) on CPU over each TMDB poster and
writes a small grayscale JPEG to /depth/<basename> (white = near, black = far).
The card detail view loads /depth/<basename> as the displacement texture for the
WebGL parallax; a 404 simply falls back to the procedural pseudo-depth.

Usage:
  node scripts/collect-depth-posters.js          # refresh the poster list
  PYTHONPATH=~/.local/lib/python3.11/site-packages python3.11 scripts/build-depth-maps.py

Incremental: existing depth/<basename> files are skipped, so re-runs only touch
new pool entries. Model auto-downloads to ~/.cache/cinelinks-depth/ (~27 MB).
"""
import io, json, os, sys, urllib.request

import numpy as np
import onnxruntime as ort
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'depth')
MODEL = os.path.expanduser('~/.cache/cinelinks-depth/da2-small-q.onnx')
MODEL_URL = 'https://huggingface.co/onnx-community/depth-anything-v2-small/resolve/main/onnx/model_quantized.onnx'
TMDB = 'https://image.tmdb.org/t/p/w342'
SIZE = 518           # model input
OUT_W = 240          # depth map width (JPEG, grayscale) — ~6 KB each
MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)


def ensure_model():
    if os.path.exists(MODEL):
        return
    os.makedirs(os.path.dirname(MODEL), exist_ok=True)
    print('downloading model…')
    urllib.request.urlretrieve(MODEL_URL, MODEL)


def fetch(path):
    with urllib.request.urlopen(TMDB + path, timeout=30) as r:
        return Image.open(io.BytesIO(r.read())).convert('RGB')


def main():
    ensure_model()
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(ROOT, 'scripts', 'depth-posters.json')) as f:
        posters = json.load(f)
    sess = ort.InferenceSession(MODEL, providers=['CPUExecutionProvider'])
    inp = sess.get_inputs()[0].name
    done = skipped = failed = 0
    for i, p in enumerate(posters):
        base = p['img'].lstrip('/')
        dst = os.path.join(OUT, base)
        if os.path.exists(dst):
            skipped += 1
            continue
        try:
            im = fetch(p['img'])
            x = np.asarray(im.resize((SIZE, SIZE), Image.BILINEAR), dtype=np.float32) / 255.0
            x = ((x - MEAN) / STD).transpose(2, 0, 1)[None]
            depth = sess.run(None, {inp: x})[0][0]
            lo, hi = np.percentile(depth, 2), np.percentile(depth, 98)
            d = np.clip((depth - lo) / max(hi - lo, 1e-6), 0, 1)   # 1 = near, 0 = far
            g = Image.fromarray((d * 255).astype(np.uint8), 'L')
            h = round(OUT_W * im.height / im.width)
            g = g.resize((OUT_W, h), Image.BILINEAR)
            # Anti-ghosting: ERODE the near (bright) regions a couple of pixels so the
            # colour silhouette slightly overhangs its depth — background pixels at the
            # edge then displace with BACKGROUND depth and stop grabbing foreground
            # colours ("duplicated edge"). The mild blur removes the remaining depth
            # cliff so the transition warps smoothly instead of tearing.
            g = g.filter(ImageFilter.MinFilter(5))
            g = g.filter(ImageFilter.GaussianBlur(1.5))
            g.save(dst, 'JPEG', quality=60)
            done += 1
        except Exception as e:
            failed += 1
            print('FAIL', p['img'], e, file=sys.stderr)
        if (i + 1) % 50 == 0:
            print(f'{i + 1}/{len(posters)} (new {done}, skip {skipped}, fail {failed})')
    print(f'done: new {done}, skipped {skipped}, failed {failed} → depth/')


if __name__ == '__main__':
    main()
