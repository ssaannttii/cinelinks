const fs = require('fs');
const path = require('path');
const https = require('https');

function requireAdmin(req, res) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    res.status(500).json({ error: 'ADMIN_PASSWORD not configured' });
    return false;
  }

  const provided = req.headers['x-admin-password'] || (req.body && req.body.password) || req.query.password;
  if (provided !== expected) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }

  return true;
}

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

function requestJson(tmdbPath) {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) return Promise.reject(new Error('TMDB_API_KEY not configured'));

  const separator = tmdbPath.includes('?') ? '&' : '?';
  const requestPath = '/3/' + tmdbPath + separator + 'api_key=' + encodeURIComponent(apiKey);

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.themoviedb.org',
      port: 443,
      path: requestPath,
      method: 'GET',
      headers: { Accept: 'application/json' }
    }, (response) => {
      let data = '';
      response.on('data', chunk => { data += chunk; });
      response.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

function loadBaseChallenges() {
  const file = fs.readFileSync(path.join(process.cwd(), 'daily-challenges.js'), 'utf8');
  const re = /\/\/\s*(\d+):\s*(.*?)\n\s*"([^"]+)"/g;
  const items = [];
  let match;
  while ((match = re.exec(file))) {
    items.push({
      number: Number(match[1]),
      label: match[2],
      key: match[3]
    });
  }
  return items;
}

function dateKey(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return y + '-' + m + '-' + d;
}

function dailyListIndex(key, length) {
  const [year, month, day] = key.split('-').map(Number);
  const days = Math.floor(Date.UTC(year, month - 1, day) / 86400000);
  return ((days % length) + length) % length;
}

function monthDates(month) {
  if (!/^\d{4}-\d{2}$/.test(month || '')) return null;
  const [year, monthNum] = month.split('-').map(Number);
  const dates = [];
  const current = new Date(Date.UTC(year, monthNum - 1, 1));
  while (current.getUTCMonth() === monthNum - 1) {
    dates.push(dateKey(current));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

function parseChallenge(raw) {
  if (!raw) return null;
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch (_) {
    return null;
  }
}

function nodeLabel(node) {
  if (!node) return '';
  const year = node.yearLabel ? ' (' + node.yearLabel + ')' : '';
  return node.name + year;
}

function challengeLabel(challenge) {
  return nodeLabel(challenge.s) + ' -> ' + nodeLabel(challenge.e);
}

function compactNode(item) {
  const type = item.media_type || (item.title ? 'movie' : 'tv');
  if (!['person', 'movie', 'tv'].includes(type)) return null;
  const name = type === 'movie' ? item.title : item.name;
  const img = type === 'person' ? item.profile_path : item.poster_path;
  const date = type === 'movie' ? item.release_date : item.first_air_date;
  const yearLabel = type === 'person' ? '' : (date || '').slice(0, 4);
  if (!name || !item.id) return null;
  return { name, type, id: item.id, img: img || '', yearLabel };
}

async function handleMonth(req, res) {
  const dates = monthDates(req.query.month);
  if (!dates) return res.status(400).json({ error: 'Missing or invalid month' });

  const base = loadBaseChallenges();
  const commands = dates.map(date => ['GET', 'daily:challenge:' + date]);
  const results = commands.length ? await redisCommand(commands) : [];

  const days = dates.map((date, i) => {
    const override = parseChallenge(results[i] && results[i].result);
    const baseItem = base[dailyListIndex(date, base.length)];
    return {
      date,
      base: baseItem,
      override,
      label: override ? challengeLabel(override) : baseItem.label,
      overridden: !!override
    };
  });

  return res.status(200).json({ days });
}

async function handleSearch(req, res) {
  const q = String(req.query.q || '').trim();
  if (q.length < 2 || q.length > 80) return res.status(400).json({ error: 'Search needs 2-80 chars' });

  const data = await requestJson('search/multi?language=en-US&include_adult=false&query=' + encodeURIComponent(q));
  const results = (data.results || [])
    .map(compactNode)
    .filter(Boolean)
    .slice(0, 12);

  return res.status(200).json({ results });
}

function validNode(node) {
  return node &&
    ['person', 'movie', 'tv'].includes(node.type) &&
    Number.isInteger(node.id) &&
    typeof node.name === 'string' &&
    node.name.trim().length > 0;
}

function sameNode(a, b) {
  return a && b && a.type === b.type && a.id === b.id;
}

async function handleUpdate(req, res) {
  const date = req.body && req.body.date;
  const challenge = req.body && req.body.challenge;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'Missing or invalid date' });
  }
  if (!challenge || !validNode(challenge.s) || !validNode(challenge.e)) {
    return res.status(400).json({ error: 'Invalid challenge' });
  }
  if (sameNode(challenge.s, challenge.e)) {
    return res.status(400).json({ error: 'Start and end must be different' });
  }

  const clean = {
    s: {
      name: challenge.s.name.trim(),
      type: challenge.s.type,
      id: challenge.s.id,
      img: challenge.s.img || '',
      yearLabel: challenge.s.yearLabel || ''
    },
    e: {
      name: challenge.e.name.trim(),
      type: challenge.e.type,
      id: challenge.e.id,
      img: challenge.e.img || '',
      yearLabel: challenge.e.yearLabel || ''
    }
  };

  await redisCommand([['SET', 'daily:challenge:' + date, JSON.stringify(clean)]]);
  return res.status(200).json({ challenge: clean, label: challengeLabel(clean) });
}

async function handleClear(req, res) {
  const date = req.body && req.body.date;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'Missing or invalid date' });
  }
  await redisCommand([['DEL', 'daily:challenge:' + date]]);
  return res.status(200).json({ ok: true });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Password');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!requireAdmin(req, res)) return;

  try {
    const action = req.method === 'GET' ? req.query.action : (req.body && req.body.action);
    if (req.method === 'GET' && action === 'month') return handleMonth(req, res);
    if (req.method === 'GET' && action === 'search') return handleSearch(req, res);
    if (req.method === 'POST' && action === 'update') return handleUpdate(req, res);
    if (req.method === 'POST' && action === 'clear') return handleClear(req, res);
    return res.status(400).json({ error: 'Unknown action' });
  } catch (e) {
    console.error('Admin API error:', e);
    return res.status(500).json({ error: 'Internal error' });
  }
};
