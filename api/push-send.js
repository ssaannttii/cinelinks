// Daily reminder sender. Protected by PUSH_SECRET. Meant to be hit by a cron
// (see docs/PUSH_SETUP.md). Sends one notification to every stored subscription
// and prunes dead ones. Inert (501) until VAPID keys are configured.
const { redisCommand } = require('./_redis');

module.exports = async function handler(req, res) {
  const secret = process.env.PUSH_SECRET || '';
  const given = req.headers['x-push-secret'] || (req.query && req.query.secret) || '';
  if (!secret || given !== secret) return res.status(401).json({ error: 'unauthorized' });

  const pub = process.env.VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return res.status(501).json({ error: 'VAPID not configured' });

  let webpush;
  try { webpush = require('web-push'); }
  catch (_) { return res.status(500).json({ error: 'web-push not installed' }); }
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:hello@cinelinks.vercel.app', pub, priv);

  let members = [];
  try {
    const r = await redisCommand([['SMEMBERS', 'push:subs']]);
    members = (r && r[0] && r[0].result) || [];
  } catch (_) { return res.status(500).json({ error: 'redis' }); }

  const body = (req.body && req.body.body) || "Today's CineLinks puzzle is ready 🎬";
  const payload = JSON.stringify({ title: 'CineLinks', body: body, url: '/', tag: 'cl-daily' });

  let sent = 0, pruned = 0;
  await Promise.all(members.map(async (m) => {
    let sub; try { sub = JSON.parse(m); } catch (_) { return; }
    try { await webpush.sendNotification(sub, payload); sent++; }
    catch (err) {
      const code = err && err.statusCode;
      if (code === 404 || code === 410) { try { await redisCommand([['SREM', 'push:subs', m]]); pruned++; } catch (_) {} }
    }
  }));

  return res.status(200).json({ sent: sent, pruned: pruned, total: members.length });
};
