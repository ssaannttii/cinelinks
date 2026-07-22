// Shared Upstash Redis REST helper.
// Files in /api prefixed with "_" are not exposed as routes by Vercel.
async function redisCommand(commands) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) throw new Error('Redis not configured');

  const res = await fetch(url + '/pipeline', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands)
  });
  if (!res.ok) throw new Error('Redis error: ' + res.status);
  return res.json();
}

// Fixed-window rate limiter. Returns { ok, count }.
//
// FAILS OPEN on purpose: if Redis is unconfigured or unreachable we must not take
// the games down to enforce a quota guard. Callers that need hard denial should
// check `configured` themselves.
//
// Cheap where it's used: the TMDB proxy sets s-maxage=86400, so the CDN answers
// repeat queries without ever invoking the function. This only sees cache misses
// — which is also exactly the traffic that burns real TMDB quota.
async function rateLimit(bucket, limit, windowSec) {
  try {
    const win = Math.floor(Date.now() / 1000 / windowSec);
    const key = 'rl:' + bucket + ':' + win;
    const out = await redisCommand([['INCR', key], ['EXPIRE', key, windowSec]]);
    const count = Number((out && out[0] && out[0].result) || 0);
    return { ok: count <= limit, count: count };
  } catch (_) {
    return { ok: true, count: 0 };
  }
}

function clientIp(req) {
  const fwd = (req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return fwd || (req.socket && req.socket.remoteAddress) || 'unknown';
}

module.exports = { redisCommand, rateLimit, clientIp };
