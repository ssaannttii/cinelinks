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

module.exports = { redisCommand };
