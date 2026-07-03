// On-demand depth maps for the long tail — cards collected outside the curated
// pools (CineLinks path nodes, CineChain additions, CineGrid guesses…) whose
// depth wasn't pre-computed by scripts/build-depth-maps.py.
//
//   GET /api/depth?im=<posterBasename.jpg>  → grayscale JPEG (white = near)
//
// Same model + post-processing as the offline pipeline (Depth Anything V2 small,
// quantized ONNX; near-region erosion + gaussian so silhouettes don't ghost).
// The response is immutable and CDN-cached for a year, so each poster is
// computed ONCE globally per region; the model itself is fetched to /tmp on
// cold start (~27 MB) and reused across invocations.
const path = require('path');
const fs = require('fs');

const MODEL_URL = 'https://huggingface.co/onnx-community/depth-anything-v2-small/resolve/main/onnx/model_quantized.onnx';
const MODEL_TMP = path.join('/tmp', 'da2-small-q.onnx');
const SIZE = 518;            // model input
const OUT_W = 240;           // output map width
const MEAN = [0.485, 0.456, 0.406], STD = [0.229, 0.224, 0.225];

let _session = null;
async function getSession() {
  if (_session) return _session;
  const ort = require('onnxruntime-node');
  if (!fs.existsSync(MODEL_TMP)) {
    const r = await fetch(MODEL_URL);
    if (!r.ok) throw new Error('model fetch ' + r.status);
    fs.writeFileSync(MODEL_TMP, Buffer.from(await r.arrayBuffer()));
  }
  _session = await ort.InferenceSession.create(MODEL_TMP, { executionProviders: ['cpu'] });
  return _session;
}

// 5×5 min-filter (erodes the bright/near regions ~2px) on a raw grayscale buffer —
// sharp has no morphological ops, but at 240px wide this is microseconds.
function erode5(src, w, h) {
  const out = Buffer.alloc(src.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let m = 255;
      for (let dy = -2; dy <= 2; dy++) {
        const yy = y + dy; if (yy < 0 || yy >= h) continue;
        for (let dx = -2; dx <= 2; dx++) {
          const xx = x + dx; if (xx < 0 || xx >= w) continue;
          const v = src[yy * w + xx]; if (v < m) m = v;
        }
      }
      out[y * w + x] = m;
    }
  }
  return out;
}

module.exports = async function handler(req, res) {
  try {
    const im = String((req.query && req.query.im) || '');
    // strict basename allow-list — the only remote we ever touch is TMDB's CDN
    if (!/^[\w-]{5,64}\.(jpg|jpeg|png)$/i.test(im)) return res.status(400).json({ error: 'bad im' });

    const sharp = require('sharp');
    const ort = require('onnxruntime-node');

    const imgRes = await fetch('https://image.tmdb.org/t/p/w342/' + im);
    if (!imgRes.ok) return res.status(404).json({ error: 'poster not found' });
    const imgBuf = Buffer.from(await imgRes.arrayBuffer());
    const meta = await sharp(imgBuf).metadata();
    const outH = Math.round(OUT_W * (meta.height || 513) / (meta.width || 342));

    // preprocess: 518×518 RGB → normalized CHW float32
    const raw = await sharp(imgBuf).resize(SIZE, SIZE, { fit: 'fill' }).removeAlpha().raw().toBuffer();
    const chw = new Float32Array(3 * SIZE * SIZE);
    const px = SIZE * SIZE;
    for (let i = 0; i < px; i++) {
      chw[i] = (raw[i * 3] / 255 - MEAN[0]) / STD[0];
      chw[px + i] = (raw[i * 3 + 1] / 255 - MEAN[1]) / STD[1];
      chw[2 * px + i] = (raw[i * 3 + 2] / 255 - MEAN[2]) / STD[2];
    }
    const session = await getSession();
    const feeds = {}; feeds[session.inputNames[0]] = new ort.Tensor('float32', chw, [1, 3, SIZE, SIZE]);
    const out = await session.run(feeds);
    const depth = out[session.outputNames[0]].data;   // [1, H, W] relative depth, larger = nearer

    // percentile 2–98 normalisation (sampled) → uint8 grayscale
    const sample = [];
    for (let i = 0; i < depth.length; i += 37) sample.push(depth[i]);
    sample.sort((a, b) => a - b);
    const lo = sample[Math.floor(sample.length * 0.02)], hi = sample[Math.floor(sample.length * 0.98)];
    const span = Math.max(hi - lo, 1e-6);
    const gray = Buffer.alloc(depth.length);
    for (let i = 0; i < depth.length; i++) {
      let v = (depth[i] - lo) / span; if (v < 0) v = 0; else if (v > 1) v = 1;
      gray[i] = (v * 255) | 0;
    }
    const side = Math.sqrt(depth.length) | 0;         // model output is square (518)

    // resize to poster aspect, erode near regions, soften the depth cliff, encode
    // toColourspace('b-w') keeps the plane single-channel — sharp otherwise
    // promotes raw grayscale to RGB on resize and the erosion reads garbage
    const small = await sharp(gray, { raw: { width: side, height: side, channels: 1 } })
      .resize(OUT_W, outH, { fit: 'fill' }).toColourspace('b-w').raw().toBuffer();
    const eroded = erode5(small, OUT_W, outH);
    const jpeg = await sharp(eroded, { raw: { width: OUT_W, height: outH, channels: 1 } })
      .blur(1.5).jpeg({ quality: 60 }).toBuffer();

    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=31536000, s-maxage=31536000, immutable');
    return res.status(200).send(jpeg);
  } catch (e) {
    // fail soft: the client falls back to procedural depth on any non-200
    return res.status(500).json({ error: 'depth failed' });
  }
};
