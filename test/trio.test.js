// lib/trio.js is how a game page knows "next: CineChain" — it must agree with the
// home about which three games make today's trio, and read the same done flags.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const Trio = require('../lib/trio');

test('every day is CineLinks plus two distinct pool games', () => {
  for (let ud = 20000; ud < 20400; ud++) {
    const t = Trio.today(ud);
    assert.strictEqual(t[0], 'cl');
    assert.notStrictEqual(t[1], t[2]);
    assert.ok(Trio.POOL.includes(t[1]) && Trio.POOL.includes(t[2]));
  }
});

test('matches the home\'s own trio formula', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const pool = JSON.parse(src.match(/const TRIO_POOL = (\[[^\]]+\])/)[1].replace(/'/g, '"'));
  assert.deepStrictEqual(pool, Trio.POOL);
  for (let ud = 20000; ud < 20100; ud++) {
    const n = pool.length, i = ud % n, j = (i + 1 + Math.floor(ud / n) % (n - 1)) % n;
    assert.deepStrictEqual(Trio.today(ud), ['cl', pool[i], pool[j]]);
  }
});

test('a guess game fills the guess slot; done reads the game\'s saved state', () => {
  const store = {};
  globalThis.localStorage = { getItem: k => (k in store ? store[k] : null) };
  try {
    const ud = Trio.udNow();
    assert.strictEqual(Trio.result('code').done, false);
    store.cinecodeState = JSON.stringify({ day: ud, finished: true, won: true, score: 3 });
    assert.strictEqual(Trio.result('code').done, true);
    store.cinecodeState = JSON.stringify({ day: ud - 1, finished: true });
    assert.strictEqual(Trio.result('code').done, false, 'yesterday does not count');
    store.cineframeState = JSON.stringify({ day: ud, finished: true });
    assert.strictEqual(Trio.slotDone('guess'), true);
    assert.strictEqual(Trio.slotPlayed('guess'), 'frame');
    assert.strictEqual(Trio.slotOf('frame', ['cl', 'guess', 'line']), 1);
    assert.strictEqual(Trio.slotOf('grid', ['cl', 'guess', 'line']), -1);
  } finally { delete globalThis.localStorage; }
});
