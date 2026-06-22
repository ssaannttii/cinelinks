// Daily score aggregation + lightweight anti-cheat.
//
//   GET  /api/score?date=YYYY-MM-DD                -> { avg, count, total, record }
//   GET  /api/score?date=YYYY-MM-DD&action=token   -> { token }   (no-store)
//   POST /api/score  { date, clicks, token }       -> { avg, count, total, record }
//
// Redis keys (per date, all expire after 48h):
//   score:DATE:total   – sum of all clicks
//   score:DATE:count   – number of completions
//   score:DATE:records – sorted set of click scores (lowest = daily record)
//   score:nonce:NONCE  – one-time marker so a token can't be replayed
//   score:rl:DATE:IP   – per-IP submission counter (rate limit)
//
// Anti-cheat: when SCORE_SECRET is set, a POST must carry a valid HMAC token
// that was issued (GET action=token) for the same date, is recent, implies a
// plausible play time, and has not been used before. If SCORE_SECRET is unset
// the game keeps working (token checks skipped) — IP rate limiting still applies.
const crypto = require('crypto');
const { redisCommand } = require('./_redis');

const SUBMIT_LIMIT_PER_IP = 50;       // max POSTs per IP per date
const MIN_MS_PER_CLICK = 400;         // plausibility floor per click
const MIN_TOTAL_MS = 2000;            // a real game takes at least ~2s
const TOKEN_MAX_AGE_MS = 12 * 3600e3; // tokens valid for 12h
const TOKEN_SKEW_MS = 5 * 60e3;       // tolerate small clock skew

function parseNumber(value) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : 0;
}

function parseRecord(value) {
  if (!Array.isArray(value) || value.length === 0) return null;
  const flat = value.flat(Infinity);
  const score = parseNumber(flat[flat.length - 1]);
  return score > 0 ? score : null;
}

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function sign(payloadStr, secret) {
  return b64url(crypto.createHmac('sha256', secret).update(payloadStr).digest());
}

function issueToken(date, secret) {
  const payload = b64url(JSON.stringify({ d: date, i: Date.now(), n: crypto.randomBytes(9).toString('hex') }));
  return payload + '.' + sign(payload, secret);
}

// Returns { ok:true, payload } or { ok:false, reason }.
function verifyToken(token, date, clicks, secret) {
  if (typeof token !== 'string' || token.indexOf('.') < 0) return { ok: false, reason: 'missing token' };
  const [payload, mac] = token.split('.');
  const expected = sign(payload, secret);
  const a = Buffer.from(mac || '');
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return { ok: false, reason: 'bad signature' };

  let data;
  try { data = JSON.parse(Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString()); }
  catch (_) { return { ok: false, reason: 'bad payload' }; }

  if (data.d !== date) return { ok: false, reason: 'date mismatch' };
  const age = Date.now() - Number(data.i || 0);
  // Token must be recent (with small tolerance for cross-instance clock skew).
  if (!(age > -TOKEN_SKEW_MS && age < TOKEN_MAX_AGE_MS)) return { ok: false, reason: 'expired token' };
  // Play must have taken a plausible minimum time (small grace for clock skew).
  const required = Math.max(MIN_TOTAL_MS, clicks * MIN_MS_PER_CLICK);
  if (age < required - 500) return { ok: false, reason: 'too fast' };
  if (typeof data.n !== 'string' || data.n.length < 6) return { ok: false, reason: 'bad nonce' };
  return { ok: true, payload: data };
}

function clientIpHash(req) {
  const fwd = (req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const ip = fwd || req.socket?.remoteAddress || 'unknown';
  return crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16);
}

// Reflect Origin only for same-origin / *.vercel.app / localhost. Blocks
// browser-based cross-site POSTs (json bodies are preflighted) without
// hard-coding the production domain.
function applyCors(req, res) {
  const origin = req.headers.origin;
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (!origin) return;
  let host;
  try { host = new URL(origin).host; } catch (_) { return; }
  const ok = host === req.headers.host ||
             /(^|\.)vercel\.app$/.test(host) ||
             /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
  if (ok) res.setHeader('Access-Control-Allow-Origin', origin);
}

module.exports = async function handler(req, res) {
  applyCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const secret = process.env.SCORE_SECRET || '';

  const dateParam = req.method === 'GET' ? req.query.date : (req.body && req.body.date);
  if (!dateParam || !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    return res.status(400).json({ error: 'Missing or invalid date' });
  }

  const totalKey = 'score:' + dateParam + ':total';
  const countKey = 'score:' + dateParam + ':count';
  const recordsKey = 'score:' + dateParam + ':records';

  try {
    // --- token issuance ---
    if (req.method === 'GET' && req.query.action === 'token') {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({ token: secret ? issueToken(dateParam, secret) : null });
    }

    if (req.method === 'POST') {
      const clicks = parseInt(req.body && req.body.clicks, 10);
      if (!Number.isFinite(clicks) || clicks < 1 || clicks > 200) {
        return res.status(400).json({ error: 'Invalid clicks value' });
      }

      // Per-IP rate limit (always on; cheap).
      const rlKey = 'score:rl:' + dateParam + ':' + clientIpHash(req);
      const rl = await redisCommand([['INCR', rlKey], ['EXPIRE', rlKey, 172800]]);
      if (parseNumber(rl[0].result) > SUBMIT_LIMIT_PER_IP) {
        return res.status(429).json({ error: 'Too many submissions' });
      }

      // Token verification (only when a secret is configured).
      if (secret) {
        const v = verifyToken(req.body && req.body.token, dateParam, clicks, secret);
        if (!v.ok) return res.status(403).json({ error: 'Invalid token', reason: v.reason });
        const used = await redisCommand([['SET', 'score:nonce:' + v.payload.n, '1', 'NX', 'EX', 172800]]);
        if (!used[0] || used[0].result === null) {
          return res.status(409).json({ error: 'Token already used' });
        }
      }

      const recordMember = Date.now() + '-' + Math.random().toString(36).slice(2);
      const results = await redisCommand([
        ['INCRBY', totalKey, clicks],
        ['INCR', countKey],
        ['ZADD', recordsKey, clicks, recordMember],
        ['ZRANGE', recordsKey, 0, 0, 'WITHSCORES'],
        ['EXPIRE', totalKey, 172800],
        ['EXPIRE', countKey, 172800],
        ['EXPIRE', recordsKey, 172800]
      ]);

      const total = parseNumber(results[0].result);
      const count = parseNumber(results[1].result);
      const avg = Math.round(total / count);
      const record = parseRecord(results[3].result);
      return res.status(200).json({ avg, count, total, record });
    }

    if (req.method === 'GET') {
      const results = await redisCommand([
        ['GET', totalKey],
        ['GET', countKey],
        ['ZRANGE', recordsKey, 0, 0, 'WITHSCORES']
      ]);
      const total = parseNumber(results[0].result);
      const count = parseNumber(results[1].result);
      const avg = count > 0 ? Math.round(total / count) : null;
      const record = parseRecord(results[2].result);
      return res.status(200).json({ avg, count, total, record });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error('Score API error:', e);
    return res.status(500).json({ error: 'Internal error' });
  }
};

// Exported for unit tests.
module.exports.issueToken = issueToken;
module.exports.verifyToken = verifyToken;
// Test-only: mint a token with an explicit issued-at (ms) so the time-based
// branches (valid / expired / too-fast) can be exercised deterministically.
module.exports.__mintToken = function (date, secret, iatMs, nonce) {
  const payload = b64url(JSON.stringify({ d: date, i: iatMs, n: nonce || 'testnonce123' }));
  return payload + '.' + sign(payload, secret);
};
