// Top Trumps async PvP — the cheapest possible multiplayer: after a daily match
// your deck is recorded; anyone can then battle a RIVAL deck (a random recorded
// one from today) instead of the house CPU. No live server, no matchmaking, no
// accounts — a deck is just 8 pool ids plus a display tag.
//
//   POST /api/trumps  { day: 'YYYYMMDD', deck: [8 ids], won: bool, tag? }  -> { ok, rivals }
//   GET  /api/trumps?day=YYYYMMDD&skip=<idsCsv?>                          -> { rival } | { rival: null }
//
// Redis keys (expire after 3 days):
//   trumps:DAY – list of JSON entries { d: [ids], w: 0|1, t: tag }
const { redisCommand } = require('./_redis');

const MAX_PER_DAY = 400;              // cap the pool (LTRIM) so a day never grows unbounded
const TTL = 3 * 24 * 3600;

function bad(res, msg) { return res.status(400).json({ error: msg }); }

module.exports = async function handler(req, res) {
  try {
    if (req.method === 'POST') {
      const b = req.body || {};
      const day = String(b.day || '');
      if (!/^\d{8}$/.test(day)) return bad(res, 'bad day');
      const deck = Array.isArray(b.deck) ? b.deck.map(Number).filter(n => Number.isInteger(n) && n > 0).slice(0, 8) : [];
      if (deck.length !== 8) return bad(res, 'bad deck');
      const tag = String(b.tag || 'A rival').replace(/[^\w .\-']/g, '').slice(0, 18) || 'A rival';
      const entry = JSON.stringify({ d: deck, w: b.won ? 1 : 0, t: tag });
      const key = 'trumps:' + day;
      const out = await redisCommand([
        ['LPUSH', key, entry],
        ['LTRIM', key, 0, MAX_PER_DAY - 1],
        ['EXPIRE', key, String(TTL)],
        ['LLEN', key]
      ]);
      return res.status(200).json({ ok: true, rivals: (out && out[3] && out[3].result) || 0 });
    }

    if (req.method === 'GET') {
      const day = String((req.query && req.query.day) || '');
      if (!/^\d{8}$/.test(day)) return bad(res, 'bad day');
      const key = 'trumps:' + day;
      const lenOut = await redisCommand([['LLEN', key]]);
      const len = (lenOut && lenOut[0] && lenOut[0].result) || 0;
      if (!len) { res.setHeader('Cache-Control', 'no-store'); return res.status(200).json({ rival: null }); }
      // random pick; skip the caller's own deck if its ids are provided
      const skip = String((req.query && req.query.skip) || '');
      for (let tries = 0; tries < 4; tries++) {
        const idx = Math.floor(Math.random() * len);
        const got = await redisCommand([['LINDEX', key, String(idx)]]);
        const raw = got && got[0] && got[0].result;
        if (!raw) continue;
        try {
          const e = JSON.parse(raw);
          if (skip && Array.isArray(e.d) && e.d.slice().sort(function (a, b) { return a - b; }).join(',') === skip) continue;   // that's you — reroll (numeric sort, matching the client's a-b)
          res.setHeader('Cache-Control', 'no-store');
          return res.status(200).json({ rival: e });
        } catch (_) { /* skip corrupt entry */ }
      }
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({ rival: null });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'method' });
  } catch (e) {
    return res.status(500).json({ error: 'server' });
  }
};
