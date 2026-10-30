// First-party telemetry: the Hobby plan can't read Vercel custom events, so these
// counters are the only per-mode / retention numbers we have. Three guards:
//   1. the summary pairs retained_dN with the right cohort day
//   2. the collector counts what it should and can't be grown by junk names
//   3. analytics.js actually mirrors events — including the abandon that is only
//      queued as the page hides, which is the one most likely to get lost
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { summarize } = require('../lib/telemetry');

test('D1/D7 divide each day\'s returns by the cohort from N days earlier', () => {
  const s = summarize([
    { date: '2026-10-01', c: { visit: 10, 'visit|new': 10 } },
    { date: '2026-10-02', c: { visit: 6, 'visit|new': 4, retained_d1: 2 } },
    { date: '2026-10-08', c: { visit: 3, retained_d7: 1, retained_d1: 5 } }   // its D1 cohort (10-07) is outside the window
  ]);
  assert.deepStrictEqual([s.d1.num, s.d1.den], [2, 10]);
  assert.deepStrictEqual([s.d7.num, s.d7.den], [1, 10]);
  assert.strictEqual(s.totals.visits, 19);
});

test('finish rate per mode = views that did not abandon', () => {
  const s = summarize([{ date: '2026-10-01', c: {
    game_view: 5, 'game_view|cineline': 4, 'game_view|cinecode': 1,
    game_abandon: 2, 'game_abandon|cineline': 1, 'game_abandon|cinecode': 1, 'game_view|new': 3
  } }]);
  const line = s.modes.find(m => m.mode === 'cineline');
  assert.strictEqual(line.finishRate, 0.75);
  assert.strictEqual(s.modes.find(m => m.mode === 'cinecode').finishRate, 0);
  assert.ok(!s.modes.find(m => m.mode === 'new'), '"|new" is a cohort flag, not a mode');
});

function loadFeedbackHandler(calls, hlen) {
  process.env.KV_REST_API_URL = 'https://redis.test';
  process.env.KV_REST_API_TOKEN = 't';
  global.fetch = async (_url, opts) => {
    const cmds = JSON.parse(opts.body);
    calls.push(cmds);
    return { ok: true, json: async () => cmds.map(c => ({ result: c[0] === 'HLEN' ? hlen : c[0] === 'INCRBY' ? 1 : 1 })) };
  };
  delete require.cache[require.resolve('../api/feedback.js')];
  return require('../api/feedback.js');
}
function fakeRes() {
  const r = { code: 0, headers: {}, setHeader(k, v) { r.headers[k] = v; }, status(c) { r.code = c; return r; }, json() { return r; }, end() { return r; } };
  return r;
}
const req = (body) => ({ method: 'POST', headers: { host: 'cinelinks.vercel.app' }, socket: {}, body });

test('collector counts totals, modes, first-day and device', async () => {
  const calls = [];
  const handler = loadFeedbackHandler(calls, 3);
  const res = fakeRes();
  await handler(req({ track: [
    { n: 'visit', np: 1, dv: 'mobile' },
    { n: 'game_view', m: 'cineline', np: 0 },
    { n: 'Bad Name!' }
  ] }), res);
  assert.strictEqual(res.code, 204);
  const fields = calls[1].filter(c => c[0] === 'HINCRBY').map(c => c[2]).sort();
  assert.deepStrictEqual(fields, ['game_view', 'game_view|cineline', 'visit', 'visit|mobile', 'visit|new']);
  assert.ok(/^tm:day:\d{4}-\d{2}-\d{2}$/.test(calls[1][0][1]));
});

test('a full day hash only takes bare totals of the core events', async () => {
  const calls = [];
  const handler = loadFeedbackHandler(calls, 9999);
  await handler(req({ track: [{ n: 'junk_event_123' }, { n: 'game_view', m: 'cinecode' }] }), fakeRes());
  const fields = calls[1].filter(c => c[0] === 'HINCRBY').map(c => c[2]);
  assert.deepStrictEqual(fields, ['game_view']);
});

test('feedback votes still work alongside the tracker', async () => {
  const calls = [];
  const handler = loadFeedbackHandler(calls, 0);
  const res = fakeRes();
  await handler(req({ value: 'fun', page: 'home' }), res);
  assert.strictEqual(res.code, 200);
});

// ── analytics.js mirror ──
const SRC = fs.readFileSync(path.join(__dirname, '..', 'analytics.js'), 'utf8');
function runPage(hostname, pathname) {
  const store = {}, handlers = {}, beacons = [];
  const g = {
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
    location: { pathname, hostname, href: 'https://' + hostname + pathname, search: '' },
    history: { replaceState() {} },
    screen: { width: 390, height: 844 },
    navigator: { language: 'en-GB', sendBeacon: (url, blob) => { beacons.push({ url, blob }); return true; } },
    document: {
      addEventListener: (t, fn) => { (handlers[t] = handlers[t] || []).push(fn); },
      createElement: () => ({}), head: { appendChild() {} }, visibilityState: 'visible'
    },
    addEventListener: (t, fn) => { (handlers[t] = handlers[t] || []).push(fn); },
    va() {}
  };
  g.window = g; g.URL = URL;
  new Function('window', 'localStorage', 'location', 'history', 'screen', 'navigator', 'document', 'va', 'URL', 'addEventListener',
    '"use strict";' + SRC)(g, g.localStorage, g.location, g.history, g.screen, g.navigator, g.document, g.va, g.URL, g.addEventListener);
  return {
    g, beacons,
    hide() { g.document.visibilityState = 'hidden'; (handlers.visibilitychange || []).forEach(fn => fn()); }
  };
}

test('production page mirrors events and flushes the abandon on hide', async () => {
  const p = runPage('cinelinks.vercel.app', '/cinecode.html');
  const q = p.g.CineInternal.trackQueue();
  assert.ok(q.find(e => e.n === 'visit' && e.np === 1 && e.dv === 'mobile'));
  assert.ok(q.find(e => e.n === 'game_view' && e.m === 'cinecode'));
  p.hide();
  assert.strictEqual(p.beacons.length, 1, 'one batched beacon on hide');
  const sent = JSON.parse(await p.beacons[0].blob.text()).track.map(e => e.n);
  assert.ok(sent.includes('game_abandon'), 'the abandon queued by the hide handler must make the same flush');
});

test('localhost and preview deploys never write to the production counters', () => {
  assert.strictEqual(runPage('localhost', '/').g.CineInternal.trackQueue().length, 0);
  assert.strictEqual(runPage('cinelinks-git-x-ssaannttiis-projects.vercel.app', '/').g.CineInternal.trackQueue().length, 0);
});
