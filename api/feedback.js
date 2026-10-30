// Tiny beta feedback collector — and the first-party telemetry counter.
//
// POST /api/feedback { value, page, beta }
// POST /api/feedback { track: [{ n, m, np, dv }, ...] }   (see handleTrack)
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

// ── Telemetry ────────────────────────────────────────────────────────────────
// Vercel Web Analytics on the Hobby plan will not let us READ custom events (402)
// and keeps only 31 days, so every window.Track event is also mirrored here as
// plain daily counters. It lives in this handler rather than its own route because
// the Hobby plan caps us at 12 functions and all 12 are taken.
//
// Aggregates only: no ids, no cookies, nothing per person. The IP is hashed for
// the rate limit (same as feedback) and never stored with the counts.
//
// Redis: tm:day:YYYY-MM-DD (UTC day, the same axis analytics.js uses for cohorts)
//   name              total
//   name|<mode>       per mode (game_view|cineline, game_abandon|cinecode, …)
//   name|new          from players on their first day (visit|new = the D0 cohort)
//   visit|mobile      device split, on the daily visit only
const TRACK_TTL = 400 * 24 * 3600;
const TRACK_MAX_BATCH = 25;
const TRACK_LIMIT_PER_IP = 600;   // events per IP per day
const TRACK_MAX_FIELDS = 600;     // per day hash: past this, only bare totals of known events
const TRACK_CORE = new Set(['visit', 'game_view', 'game_abandon', 'retained_d1', 'retained_d7', 'retained_d30']);
const NAME_RE = /^[a-z][a-z0-9_]{1,39}$/;
const MODE_RE = /^[a-z]{2,16}$/;

function utcDateKey(date = new Date()) { return date.toISOString().slice(0, 10); }

async function handleTrack(req, res, list) {
  const events = list.slice(0, TRACK_MAX_BATCH).filter((e) => e && NAME_RE.test(String(e.n || '')));
  res.setHeader('Cache-Control', 'no-store');
  if (!events.length) return res.status(204).end();

  const day = utcDateKey();
  const key = 'tm:day:' + day;
  const rlKey = 'tm:rl:' + day + ':' + clientIpHash(req);
  try {
    const pre = await redisCommand([['INCRBY', rlKey, events.length], ['EXPIRE', rlKey, 86400], ['HLEN', key]]);
    const count = parseInt(pre && pre[0] && pre[0].result, 10) || 0;
    if (count > TRACK_LIMIT_PER_IP) return res.status(429).json({ error: 'Too many events' });
    const full = (parseInt(pre && pre[2] && pre[2].result, 10) || 0) >= TRACK_MAX_FIELDS;

    const cmds = [];
    for (const e of events) {
      const n = String(e.n);
      if (full && !TRACK_CORE.has(n)) continue;     // a flood of junk names can't grow the hash
      cmds.push(['HINCRBY', key, n, 1]);
      if (full) continue;
      const m = String(e.m || '');
      if (m && MODE_RE.test(m)) cmds.push(['HINCRBY', key, n + '|' + m, 1]);
      if (e.np === 1) cmds.push(['HINCRBY', key, n + '|new', 1]);
      if (n === 'visit' && (e.dv === 'mobile' || e.dv === 'desktop' || e.dv === 'tablet')) cmds.push(['HINCRBY', key, 'visit|' + e.dv, 1]);
    }
    if (!cmds.length) return res.status(204).end();
    cmds.push(['EXPIRE', key, TRACK_TTL]);
    await redisCommand(cmds);
    return res.status(204).end();
  } catch (error) {
    console.error('Track error:', error);
    return res.status(500).json({ error: 'Internal error' });
  }
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

  let body = req.body || {};
  // sendBeacon may arrive as text/plain; accept the JSON string too
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = {}; } }
  if (Array.isArray(body.track)) return handleTrack(req, res, body.track);
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
