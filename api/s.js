// Share landing page. Because index.html is a static file, it can't carry
// per-result OG tags — so shared links point here instead. A crawler fetching
//   /s?g=cl&a=..&b=..&n=..&k=..&to=<game-url>
// gets result-specific Open Graph / Twitter meta (image = /api/og?...), while a
// human is immediately redirected to `to` (the real game). Pure Node, no deps.
const OG_KEYS = ['g', 'a', 'b', 'n', 'nl', 'k', 'w', 'l', 'title', 'sub'];

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
  });
}

module.exports = function handler(req, res) {
  const q = req.query || {};
  const proto = (req.headers['x-forwarded-proto'] || 'https').split(',')[0];
  const host = (req.headers['x-forwarded-host'] || req.headers.host || 'cinelinks.vercel.app').split(',')[0];
  const origin = proto + '://' + host;

  // OG image URL from the whitelisted result params.
  const ogParams = OG_KEYS
    .filter(function (k) { return q[k] != null && q[k] !== ''; })
    .map(function (k) { return k + '=' + encodeURIComponent(q[k]); })
    .join('&');
  const ogImg = origin + '/api/og' + (ogParams ? '?' + ogParams : '');

  // Human redirect target — only same-origin paths are allowed.
  let to = '/';
  try {
    const raw = q.to ? String(q.to) : '/';
    if (/^https?:\/\//i.test(raw)) {
      const u = new URL(raw);
      if (u.host === host) to = u.pathname + u.search + u.hash;
    } else if (raw.charAt(0) === '/') {
      to = raw;
    }
  } catch (_) { to = '/'; }

  const title = q.title
    ? String(q.title)
    : (q.g === 'trumps'
        ? 'Top Trumps ' + (q.w || '0') + '–' + (q.l || '0') + ' vs CPU'
        : (q.a && q.b
            ? q.a + ' → ' + q.b + ' in ' + (q.n || '?') + ' clicks'
            : 'CineLinks — a daily film puzzle'));
  const desc = 'A daily film-connection puzzle. Think you can beat it?';

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300');
  res.status(200).end(
    '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>' + esc(title) + ' · CineLinks</title>' +
    '<meta name="description" content="' + esc(desc) + '">' +
    '<meta property="og:type" content="website">' +
    '<meta property="og:site_name" content="CineLinks">' +
    '<meta property="og:title" content="' + esc(title) + '">' +
    '<meta property="og:description" content="' + esc(desc) + '">' +
    '<meta property="og:image" content="' + esc(ogImg) + '">' +
    '<meta property="og:image:width" content="1200">' +
    '<meta property="og:image:height" content="630">' +
    '<meta property="og:url" content="' + esc(origin + to) + '">' +
    '<meta name="twitter:card" content="summary_large_image">' +
    '<meta name="twitter:title" content="' + esc(title) + '">' +
    '<meta name="twitter:description" content="' + esc(desc) + '">' +
    '<meta name="twitter:image" content="' + esc(ogImg) + '">' +
    '<link rel="canonical" href="' + esc(origin + to) + '">' +
    '<meta http-equiv="refresh" content="0;url=' + esc(to) + '">' +
    '<script>location.replace(' + JSON.stringify(to) + ')</script>' +
    '</head><body style="background:#0d0d0d;color:#f5f5f5;font-family:system-ui,sans-serif;text-align:center;padding:40px">' +
    'Redirecting to <a href="' + esc(to) + '" style="color:#e8a000">CineLinks</a>…' +
    '</body></html>'
  );
};
