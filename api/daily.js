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

function parseChallenge(raw) {
  if (!raw) return null;
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!parsed || !parsed.s || !parsed.e) return null;
    return parsed;
  } catch (_) {
    return null;
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const date = req.query.date;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'Missing or invalid date' });
  }

  try {
    const key = 'daily:challenge:' + date;
    const results = await redisCommand([['GET', key]]);
    const challenge = parseChallenge(results[0] && results[0].result);
    res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=30');
    return res.status(200).json({ challenge });
  } catch (e) {
    return res.status(200).json({ challenge: null });
  }
};
