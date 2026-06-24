const { test } = require('node:test');
const assert = require('node:assert');
const M = require('../lib/merge-stats');

test('mergeStreak keeps the best of both', () => {
  assert.deepStrictEqual(M.mergeStreak({ current: 3, best: 5 }, { current: 7, best: 6 }), { current: 7, best: 7 });
  assert.deepStrictEqual(M.mergeStreak({ current: 2, best: 9 }, { current: 1, best: 4 }), { current: 2, best: 9 });
  assert.deepStrictEqual(M.mergeStreak(null, undefined), { current: 0, best: 0 });
});

test('mergePlayed unions dates and keeps the lower click count', () => {
  const a = { '2026-06-22': 5, '2026-06-23': 8 };
  const b = { '2026-06-23': 4, '2026-06-24': 6 };
  assert.deepStrictEqual(M.mergePlayed(a, b), { '2026-06-22': 5, '2026-06-23': 4, '2026-06-24': 6 });
});

test('mergePlayed handles missing inputs', () => {
  assert.deepStrictEqual(M.mergePlayed(null, { x: 1 }), { x: 1 });
  assert.deepStrictEqual(M.mergePlayed({ x: 1 }, null), { x: 1 });
  assert.deepStrictEqual(M.mergePlayed(null, null), {});
});

test('mergeDayState keeps the newer day', () => {
  const older = { day: 100, finished: true, solved: true };
  const newer = { day: 101, finished: false, solved: false };
  assert.strictEqual(M.mergeDayState(older, newer), newer);
  assert.strictEqual(M.mergeDayState(newer, older), newer);
});

test('mergeDayState prefers the more complete outcome on the same day', () => {
  const inProgress = { day: 50, finished: false, solved: false };
  const solved = { day: 50, finished: true, solved: true };
  assert.strictEqual(M.mergeDayState(inProgress, solved), solved);
  assert.strictEqual(M.mergeDayState(solved, inProgress), solved);
});

test('mergeDayState handles nulls', () => {
  assert.strictEqual(M.mergeDayState(null, null), null);
  const s = { day: 1, finished: true };
  assert.strictEqual(M.mergeDayState(null, s), s);
  assert.strictEqual(M.mergeDayState(s, null), s);
});

test('merge is order-independent (commutative result) for a full blob', () => {
  const a = {
    clStreak: { current: 4, best: 10 },
    clPlayed: { '2026-06-22': 5 },
    cineclueStreak: { current: 1, best: 1 },
    cineclueState: { day: 20627, finished: true, solved: false }
  };
  const b = {
    clStreak: { current: 6, best: 6 },
    clPlayed: { '2026-06-22': 3, '2026-06-23': 7 },
    cineclueStreak: { current: 0, best: 9 },
    cineclueState: { day: 20627, finished: true, solved: true }
  };
  const ab = M.merge(a, b);
  const ba = M.merge(b, a);
  assert.deepStrictEqual(ab, ba);
  assert.deepStrictEqual(ab.clStreak, { current: 6, best: 10 });
  assert.deepStrictEqual(ab.clPlayed, { '2026-06-22': 3, '2026-06-23': 7 });
  assert.deepStrictEqual(ab.cineclueStreak, { current: 1, best: 9 });
  assert.strictEqual(ab.cineclueState.solved, true);
});

test('merge tolerates empty / missing blobs and unknown keys', () => {
  const out = M.merge({}, { clStreak: { current: 2, best: 2 }, somethingNew: { x: 1 } });
  assert.deepStrictEqual(out.clStreak, { current: 2, best: 2 });
  assert.deepStrictEqual(out.clPlayed, {});
  assert.strictEqual(out.somethingNew, undefined); // unknown keys ignored, not crashing
});

test('SYNC_KEYS covers all synced stores', () => {
  ['clStreak', 'cineclueStreak', 'cineframeStreak', 'cinecastStreak', 'cineplotStreak', 'cinelineStreak',
    'cineclueState', 'cineframeState', 'cinecastState', 'cineplotState', 'cinelineState', 'clPlayed']
    .forEach(k => assert.ok(M.SYNC_KEYS.includes(k), 'missing ' + k));
});
