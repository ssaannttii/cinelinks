// POST /api/score  { date: "2026-04-14", clicks: 5 }
// GET  /api/score?date=2026-04-14
//
// Redis keys (per date):
//   score:YYYY-MM-DD:total   – sum of all clicks
//   score:YYYY-MM-DD:count   – number of completions
//   score:YYYY-MM-DD:records – sorted click scores for the daily record

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

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // Validate date param (YYYY-MM-DD)
  const dateParam = req.method === 'GET' ? req.query.date : (req.body && req.body.date);
  if (!dateParam || !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    return res.status(400).json({ error: 'Missing or invalid date' });
  }

  const totalKey = 'score:' + dateParam + ':total';
  const countKey = 'score:' + dateParam + ':count';
  const recordsKey = 'score:' + dateParam + ':records';

  try {
    if (req.method === 'POST') {
      const clicks = parseInt(req.body && req.body.clicks, 10);
      if (!Number.isFinite(clicks) || clicks < 1 || clicks > 200) {
        return res.status(400).json({ error: 'Invalid clicks value' });
      }

      const recordMember = Date.now() + '-' + Math.random().toString(36).slice(2);

      // Increment total/count and store this score so the record can be read as the lowest score.
      const results = await redisCommand([
        ['INCRBY', totalKey, clicks],
        ['INCR', countKey],
        ['ZADD', recordsKey, clicks, recordMember],
        ['ZRANGE', recordsKey, 0, 0, 'WITHSCORES'],
        // Expire after 48h so old data cleans itself up
        ['EXPIRE', totalKey, 172800],
        ['EXPIRE', countKey, 172800],
        ['EXPIRE', recordsKey, 172800]
      ]);

      const total = parseNumber(results[0].result);
      const count = parseNumber(results[1].result);
      const avg = Math.round(total / count);
      const record = parseRecord(results[3].result);

      return res.status(200).json({ avg, count, total, record });

    } else if (req.method === 'GET') {
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
