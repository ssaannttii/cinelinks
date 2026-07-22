// Funnel instrumentation guards.
//
// Two gaps this locks down:
//
// 1. Retention was a single boolean. `returning: last ? 1 : 0` answered "has this
//    person ever been here before", which cannot separate a player coming back on
//    day 1 from one drifting in after a month — so D1/D7 were not measurable at
//    all, despite being the numbers that decide whether the product works.
//
// 2. Nine of the ten modes emitted only "<mode>_complete". With no denominator,
//    a mode nobody finishes and a mode nobody opens look identical.
//
// analytics.js runs as an IIFE against browser globals, so these tests drive it
// through a fake window and assert on the events it emits.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'analytics.js'), 'utf8');

function runDay(store, iso, pathname) {
  const events = [];
  const handlers = {};
  const g = {
    localStorage: {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); }
    },
    location: { pathname, href: 'https://x' + pathname, search: '' },
    history: { replaceState() {} },
    screen: { width: 390, height: 844 },
    navigator: { language: 'es-ES' },
    document: {
      addEventListener: (t, fn) => { (handlers[t] = handlers[t] || []).push(fn); },
      createElement: () => ({}),
      head: { appendChild() {} },
      visibilityState: 'visible'
    },
    addEventListener: (t, fn) => { (handlers[t] = handlers[t] || []).push(fn); },
    va(_t, e) { events.push(e); }
  };
  g.window = g;
  g.URL = URL;
  g.Date = class extends Date {
    constructor(...a) { super(...(a.length ? a : [iso + 'T12:00:00Z'])); }
    static now() { return Date.parse(iso + 'T12:00:00Z'); }
    static parse(s) { return Date.parse(s); }
  };
  new Function(
    'window', 'localStorage', 'location', 'history', 'screen', 'navigator',
    'document', 'va', 'URL', 'Date', 'addEventListener',
    '"use strict";' + SRC
  )(g, g.localStorage, g.location, g.history, g.screen, g.navigator,
    g.document, g.va, g.URL, g.Date, g.addEventListener);

  return {
    events,
    names: () => events.map(e => e.name),
    find: n => events.find(e => e.name === n),
    hide() {
      g.document.visibilityState = 'hidden';
      (handlers.visibilitychange || []).forEach(fn => fn());
    },
    track: (n, p) => g.Track(n, p)
  };
}

test('cohort retention fires on the exact day, not just "came back"', () => {
  const store = {};
  assert.ok(runDay(store, '2026-01-01', '/').find('visit'), 'day 0 should emit a visit');
  assert.ok(runDay(store, '2026-01-02', '/').find('retained_d1'), 'day 1 should emit retained_d1');
  assert.ok(runDay(store, '2026-01-08', '/').find('retained_d7'), 'day 7 should emit retained_d7');
  assert.ok(runDay(store, '2026-01-31', '/').find('retained_d30'), 'day 30 should emit retained_d30');
});

test('a return on the wrong day does not count as retained', () => {
  const store = {};
  runDay(store, '2026-01-01', '/');
  const r = runDay(store, '2026-01-05', '/'); // day 4: retained by the old boolean, not a cohort day
  assert.strictEqual(r.find('retained_d1'), undefined);
  assert.strictEqual(r.find('retained_d7'), undefined);
  assert.strictEqual(r.find('visit').data.days_since_last, 4, 'gap length must still be reported');
});

test('the visit event is once per day, impressions are per page view', () => {
  const store = {};
  runDay(store, '2026-01-01', '/');
  const again = runDay(store, '2026-01-01', '/cineclue.html');
  assert.strictEqual(again.find('visit'), undefined, 'second visit the same day must not re-emit');
  assert.ok(again.find('game_view'), 'but each page view is still an impression');
});

test('every event carries the segmentation context', () => {
  const store = {};
  const r = runDay(store, '2026-01-01', '/cineclue.html');
  for (const e of r.events) {
    for (const k of ['day_index', 'visit_days', 'new_player', 'device', 'locale']) {
      assert.ok(k in e.data, e.name + ' is missing context key ' + k);
    }
  }
  assert.strictEqual(r.find('game_view').data.device, 'mobile');
  assert.strictEqual(r.find('game_view').data.locale, 'es-ES');
});

test('mode is derived from the path, and non-game pages are not modes', () => {
  const cases = [['/', 'cinelinks'], ['/index.html', 'cinelinks'], ['/cineclue.html', 'cineclue'], ['/cinegroup.html', 'cinegroup']];
  for (const [p, mode] of cases) {
    const r = runDay({}, '2026-01-01', p);
    assert.strictEqual(r.find('game_view').data.mode, mode, p + ' should be mode ' + mode);
  }
  for (const p of ['/privacy.html', '/stats.html', '/beta.html']) {
    assert.strictEqual(runDay({}, '2026-01-01', p).find('game_view'), undefined, p + ' is not a game');
  }
});

test('leaving without finishing is an abandon; finishing is not', () => {
  const a = runDay({}, '2026-01-01', '/cineclue.html');
  a.hide();
  assert.ok(a.find('game_abandon'), 'leaving an unfinished game should report abandon');

  const b = runDay({}, '2026-01-01', '/cineclue.html');
  b.track('cineclue_complete', { win: 1 });
  b.hide();
  assert.strictEqual(b.find('game_abandon'), undefined, 'a completed game must not report abandon');
});

test('abandon reports at most once', () => {
  const r = runDay({}, '2026-01-01', '/cineclue.html');
  r.hide(); r.hide(); r.hide();
  assert.strictEqual(r.events.filter(e => e.name === 'game_abandon').length, 1);
});
