// Stores (or removes) a browser push subscription. Subscriptions live in a Redis
// set; the daily sender (api/push-send) reads them. Safe no-op if Redis is unset.
const { redisCommand } = require('./_redis');

function applyCors(req, res) {
  const origin = req.headers.origin;
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (!origin) return;
  let host; try { host = new URL(origin).host; } catch (_) { return; }
  if (host === req.headers.host || /(^|\.)vercel\.app$/.test(host) || /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
}

module.exports = async function handler(req, res) {
  applyCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST' && req.method !== 'DELETE') return res.status(405).json({ error: 'method' });

  const sub = req.body && (req.body.subscription || req.body);
  if (!sub || !sub.endpoint) return res.status(400).json({ error: 'bad subscription' });

  try {
    const cmd = req.method === 'DELETE'
      ? [['SREM', 'push:subs', JSON.stringify(sub)]]
      : [['SADD', 'push:subs', JSON.stringify(sub)]];
    await redisCommand(cmd);
    return res.status(200).json({ ok: true });
  } catch (_) {
    return res.status(200).json({ ok: false });   // Redis not configured — silent
  }
};
