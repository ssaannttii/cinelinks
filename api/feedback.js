// Tiny beta feedback collector.
//
// POST /api/feedback { value, page, beta }
//
// Redis keys:
//   feedback:day:YYYY-MM-DD       hash totals by value/source
//   feedback:page:YYYY-MM-DD      hash page -> count
//   feedback:recent               list of latest compact JSON entries
//   feedback:rl:YYYY-MM-DD:IP     per-IP submission counter
const crypto = require('crypto');
const { applyCors } = require('./_cors');
const { redisCommand } = require('./_redis');

const VALUES = new Set(['fun', 'confusing', 'hard', 'bug']);
const TTL = 90 * 24 * 3600;
const RECENT_MAX = 120;
const SUBMIT_LIMIT_PER_IP = 80;

function madridDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
}

function clientIpHash(req) {
  const fwd = (req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const ip = fwd || req.socket?.remoteAddress || 'unknown';
  return crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16);
}

function cleanPage(value) {
  const raw = String(value || 'home').trim().slice(0, 80);
  const safe = raw.replace(/[^a-z0-9/_-]/gi, '');
  return safe || 'home';
}


module.exports = async function handler(req, res) {
  applyCors(req, res, { methods: 'POST, OPTIONS' });
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body || {};
  const value = String(body.value || '').toLowerCase();
  if (!VALUES.has(value)) return res.status(400).json({ error: 'Invalid feedback value' });

  const date = madridDateKey();
  const page = cleanPage(body.page);
  const source = body.beta ? 'beta' : 'public';
  const entry = JSON.stringify({ t: Date.now(), d: date, v: value, p: page, b: source === 'beta' ? 1 : 0 });
  const dayKey = 'feedback:day:' + date;
  const pageKey = 'feedback:page:' + date;
  const rlKey = 'feedback:rl:' + date + ':' + clientIpHash(req);

  try {
    const rl = await redisCommand([['INCR', rlKey], ['EXPIRE', rlKey, 86400]]);
    const count = parseInt(rl && rl[0] && rl[0].result, 10) || 0;
    if (count > SUBMIT_LIMIT_PER_IP) return res.status(429).json({ error: 'Too many submissions' });

    await redisCommand([
      ['HINCRBY', dayKey, 'total', 1],
      ['HINCRBY', dayKey, value, 1],
      ['HINCRBY', dayKey, source, 1],
      ['HINCRBY', pageKey, page, 1],
      ['LPUSH', 'feedback:recent', entry],
      ['LTRIM', 'feedback:recent', 0, RECENT_MAX - 1],
      ['EXPIRE', dayKey, TTL],
      ['EXPIRE', pageKey, TTL],
      ['EXPIRE', 'feedback:recent', TTL]
    ]);

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Feedback API error:', error);
    return res.status(500).json({ error: 'Internal error' });
  }
};
