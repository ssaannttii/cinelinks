// Optional cross-device stats sync, gated behind Google sign-in.
//
//   GET  /api/sync   (Authorization: Bearer <google_id_token>)  -> { stats }
//   POST /api/sync   { idToken, stats }                         -> { stats }  (merged)
//
// Storage: one JSON blob per Google account in Upstash KV at sync:<sub>.
// POST merges the pushed blob into what's stored (server-side, authoritative),
// so concurrent devices reconcile cleanly. Disabled unless GOOGLE_CLIENT_ID is
// set — the games work fully without it (local-first); login only *syncs*.
const { redisCommand } = require('./_redis');
const MergeStats = require('../lib/merge-stats');

function applyCors(req, res) {
  const origin = req.headers.origin;
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (!origin) return;
  let host;
  try { host = new URL(origin).host; } catch (_) { return; }
  const ok = host === req.headers.host ||
             /(^|\.)vercel\.app$/.test(host) ||
             /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
  if (ok) res.setHeader('Access-Control-Allow-Origin', origin);
}

// Verify the Google ID token via Google's tokeninfo endpoint and confirm it was
// minted for THIS app (aud) by Google (iss) and hasn't expired. Returns the
// stable user id (sub) or null. (For higher scale, swap to local JWKS verify.)
async function verifyGoogleToken(idToken) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId || !idToken) return null;
  let info;
  try {
    const r = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken));
    if (!r.ok) return null;
    info = await r.json();
  } catch (_) { return null; }
  if (!info || info.aud !== clientId) return null;
  if (info.iss !== 'accounts.google.com' && info.iss !== 'https://accounts.google.com') return null;
  if (info.exp && Math.floor(Date.now() / 1000) > Number(info.exp)) return null;
  return info.sub || null;
}

async function readBlob(key) {
  const r = await redisCommand([['GET', key]]);
  const raw = r && r[0] && r[0].result;
  try { return raw ? JSON.parse(raw) : {}; } catch (_) { return {}; }
}

module.exports = async function handler(req, res) {
  applyCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!process.env.GOOGLE_CLIENT_ID) return res.status(501).json({ error: 'sync_disabled' });

  const auth = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const idToken = auth || (req.body && req.body.idToken) || '';
  const sub = await verifyGoogleToken(idToken);
  if (!sub) return res.status(401).json({ error: 'unauthorized' });

  const key = 'sync:' + sub;
  res.setHeader('Cache-Control', 'no-store');

  try {
    if (req.method === 'GET') {
      return res.status(200).json({ stats: await readBlob(key) });
    }
    if (req.method === 'POST') {
      const incoming = (req.body && req.body.stats) || {};
      const merged = MergeStats.merge(await readBlob(key), incoming);
      await redisCommand([['SET', key, JSON.stringify(merged)]]);
      return res.status(200).json({ stats: merged });
    }
    return res.status(405).json({ error: 'method_not_allowed' });
  } catch (e) {
    return res.status(500).json({ error: 'sync_failed' });
  }
};
