// Image proxy for html2canvas — serves TMDB images with CORS headers
// so the share card canvas doesn't get tainted by cross-origin images.
const https = require('https');
const { allowedOrigin } = require('./_cors');

const ALLOWED_HOSTS = ['image.tmdb.org'];

module.exports = function handler(req, res) {
  const { url } = req.query;
  if (!url) return res.status(400).end();

  let parsed;
  try { parsed = new URL(url); } catch { return res.status(400).end(); }
  if (!ALLOWED_HOSTS.includes(parsed.hostname)) return res.status(403).end();

  // Reflect our own origin instead of '*'. The share-card canvas still gets
  // untainted images (this route is same-origin to the page), but other sites
  // can no longer use us as a free TMDB image CDN.
  const origin = allowedOrigin(req);
  res.setHeader('Vary', 'Origin');
  if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Cache-Control', 'public, max-age=604800, immutable');

  const request = https.request(parsed.href, proxyRes => {
    const headers = {
      'Content-Type': proxyRes.headers['content-type'] || 'image/jpeg',
      'Cache-Control': 'public, max-age=604800, immutable',
      'Vary': 'Origin'
    };
    if (origin) headers['Access-Control-Allow-Origin'] = origin;
    res.writeHead(proxyRes.statusCode, headers);
    proxyRes.pipe(res);
  });
  request.on('error', () => res.status(502).end());
  request.end();
};
