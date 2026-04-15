// Image proxy for html2canvas — serves TMDB images with CORS headers
// so the share card canvas doesn't get tainted by cross-origin images.
const https = require('https');

const ALLOWED_HOSTS = ['image.tmdb.org'];

module.exports = function handler(req, res) {
  const { url } = req.query;
  if (!url) return res.status(400).end();

  let parsed;
  try { parsed = new URL(url); } catch { return res.status(400).end(); }
  if (!ALLOWED_HOSTS.includes(parsed.hostname)) return res.status(403).end();

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=604800, immutable');

  const request = https.request(parsed.href, proxyRes => {
    res.writeHead(proxyRes.statusCode, {
      'Content-Type': proxyRes.headers['content-type'] || 'image/jpeg',
      'Cache-Control': 'public, max-age=604800, immutable',
      'Access-Control-Allow-Origin': '*'
    });
    proxyRes.pipe(res);
  });
  request.on('error', () => res.status(502).end());
  request.end();
};
