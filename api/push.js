// Web push — one function, three actions (merged to stay under the serverless-function
// limit). ?action=config | subscribe | send.
//   GET  /api/push?action=config                 -> { key }  (public VAPID key or null)
//   POST /api/push?action=subscribe { subscription }         -> store   (DELETE removes)
//   POST /api/push?action=send  (x-push-secret)  { body? }   -> send to all, prune dead
// Inert without VAPID keys. See docs/PUSH_SETUP.md.
const { redisCommand } = require('./_redis');
const { applyCors } = require('./_cors');


module.exports = async function handler(req, res) {
  applyCors(req, res, { methods: 'GET, POST, DELETE, OPTIONS' });
  if (req.method === 'OPTIONS') return res.status(200).end();
  const action = (req.query && req.query.action) || (req.method === 'GET' ? 'config' : '');

  // ── config ──
  if (action === 'config') {
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.status(200).json({ key: process.env.VAPID_PUBLIC_KEY || null });
  }

  // ── send (protected) ──
  if (action === 'send') {
    const secret = process.env.PUSH_SECRET || '';
    const given = req.headers['x-push-secret'] || (req.query && req.query.secret) || '';
    if (!secret || given !== secret) return res.status(401).json({ error: 'unauthorized' });
    const pub = process.env.VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
    if (!pub || !priv) return res.status(501).json({ error: 'VAPID not configured' });
    let webpush; try { webpush = require('web-push'); } catch (_) { return res.status(500).json({ error: 'web-push not installed' }); }
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:hello@cinelinks.vercel.app', pub, priv);
    let members = [];
    try { const r = await redisCommand([['SMEMBERS', 'push:subs']]); members = (r && r[0] && r[0].result) || []; }
    catch (_) { return res.status(500).json({ error: 'redis' }); }
    const body = (req.body && req.body.body) || "Today's CineLinks puzzle is ready 🎬";
    const payload = JSON.stringify({ title: 'CineLinks', body: body, url: '/', tag: 'cl-daily' });
    let sent = 0, pruned = 0;
    await Promise.all(members.map(async (m) => {
      let sub; try { sub = JSON.parse(m); } catch (_) { return; }
      try { await webpush.sendNotification(sub, payload); sent++; }
      catch (err) { const c = err && err.statusCode; if (c === 404 || c === 410) { try { await redisCommand([['SREM', 'push:subs', m]]); pruned++; } catch (_) {} } }
    }));
    return res.status(200).json({ sent: sent, pruned: pruned, total: members.length });
  }

  // ── subscribe / unsubscribe ──
  if (req.method === 'POST' || req.method === 'DELETE') {
    const sub = req.body && (req.body.subscription || req.body);
    if (!sub || !sub.endpoint) return res.status(400).json({ error: 'bad subscription' });
    try {
      const cmd = req.method === 'DELETE'
        ? [['SREM', 'push:subs', JSON.stringify(sub)]]
        : [['SADD', 'push:subs', JSON.stringify(sub)]];
      await redisCommand(cmd);
      return res.status(200).json({ ok: true });
    } catch (_) { return res.status(200).json({ ok: false }); }
  }

  return res.status(400).json({ error: 'bad action' });
};
