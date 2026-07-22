// CORS policy guard.
//
// tmdb.js, daily.js and img.js used to send 'Access-Control-Allow-Origin: *',
// which let any site on the web drive our TMDB proxy on our API quota. The four
// handlers that DID check origin each carried their own copy of the check, and
// had already drifted in formatting and header sets — one copy quietly loosening
// is the failure mode this guards against.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { applyCors, allowedOrigin } = require('../api/_cors');

const API = path.join(__dirname, '..', 'api');
const HOST = 'cinelinks.vercel.app';

function headersFor(origin) {
  const req = { headers: { host: HOST } };
  if (origin) req.headers.origin = origin;
  const out = {};
  applyCors(req, { setHeader: (k, v) => { out[k] = v; } }, {});
  return out;
}

test('reflects only same-origin, vercel previews and localhost', () => {
  for (const o of ['https://' + HOST, 'https://cinelinks-git-x.vercel.app', 'http://localhost:3000']) {
    assert.strictEqual(headersFor(o)['Access-Control-Allow-Origin'], o, 'should allow ' + o);
  }
});

test('rejects foreign and look-alike origins', () => {
  // evilvercel.app must not pass: the pattern requires a dot or string start
  // before "vercel.app".
  for (const o of ['https://evil.example.com', 'https://evilvercel.app',
                   'https://notvercel.app.evil.com', 'no-es-una-url']) {
    assert.strictEqual(headersFor(o)['Access-Control-Allow-Origin'], undefined, 'should reject ' + o);
  }
});

test('always varies on Origin so a CDN cannot cache one caller answer for all', () => {
  assert.strictEqual(headersFor('https://' + HOST)['Vary'], 'Origin');
  assert.strictEqual(headersFor(undefined)['Vary'], 'Origin');
});

test('no api route ships a wildcard Access-Control-Allow-Origin', () => {
  const offenders = fs.readdirSync(API)
    .filter(f => f.endsWith('.js'))
    .filter(f => /Access-Control-Allow-Origin['"]?\s*[:,]\s*['"]\*/.test(
      fs.readFileSync(path.join(API, f), 'utf8')));
  assert.deepStrictEqual(offenders, [], 'wildcard CORS found in: ' + offenders.join(', '));
});

test('every handler routes CORS through the shared helper', () => {
  const handlers = fs.readdirSync(API).filter(f => f.endsWith('.js') && !f.startsWith('_'));
  const rogue = handlers.filter(f => /^function applyCors\(/m.test(fs.readFileSync(path.join(API, f), 'utf8')));
  assert.deepStrictEqual(rogue, [], 'handler defines its own applyCors instead of using _cors: ' + rogue.join(', '));
});

test('allowedOrigin tolerates a missing or malformed Origin', () => {
  assert.strictEqual(allowedOrigin({ headers: { host: HOST } }), null);
  assert.strictEqual(allowedOrigin({ headers: { host: HOST, origin: '::::' } }), null);
});
