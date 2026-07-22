// Shared CORS policy for every API route.
//
// Files in /api prefixed with "_" are not exposed as routes by Vercel, so this
// costs nothing against the Hobby 12-function cap.
//
// This exists because four handlers (score, sync, feedback, push) each carried
// their own hand-rolled copy of the same origin check. The logic happened to
// still agree, but they had already drifted in formatting and header sets —
// which is exactly how one of them silently loosens later. tmdb, daily and img
// meanwhile shipped a blanket 'Access-Control-Allow-Origin: *', which let any
// site on the web use our TMDB proxy on our API quota.
//
// Policy: reflect Origin only for same-origin, *.vercel.app previews, and
// localhost. Never a wildcard.
function allowedOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return null;
  let host;
  try { host = new URL(origin).host; } catch (_) { return null; }
  const ok = host === req.headers.host ||
             /(^|\.)vercel\.app$/.test(host) ||
             /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
  return ok ? origin : null;
}

function applyCors(req, res, opts) {
  const o = opts || {};
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', o.methods || 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', o.headers || 'Content-Type');
  const origin = allowedOrigin(req);
  if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
}

module.exports = { applyCors, allowedOrigin };
