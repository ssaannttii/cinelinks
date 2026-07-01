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
    'cineclueState', 'cineframeState', 'cinecastState', 'cineplotState', 'cinelineState', 'clPlayed', 'cl_collection']
    .forEach(k => assert.ok(M.SYNC_KEYS.includes(k), 'missing ' + k));
});

test('mergeCollection unions cards and never loses one', () => {
  const a = { v: 1, xp: 135, seen: 3, dust: 20, seq: 3, cards: {
    'movie:1': { id: 1, type: 'movie', name: 'A', rarity: 'legendary', n: 1, first: '2026-06-20', no: 1 },
    'movie:2': { id: 2, type: 'movie', name: 'B', rarity: 'rare', n: 2, first: '2026-06-21', no: 2 }
  } };
  const b = { v: 1, xp: 60, seen: 2, dust: 45, seq: 5, cards: {
    'movie:2': { id: 2, type: 'movie', name: 'B', rarity: 'rare', n: 1, first: '2026-06-19', no: 5, shine: 1 },
    'person:9': { id: 9, type: 'person', name: 'C', rarity: 'elite', n: 1, first: '2026-06-22', no: 2 }
  } };
  const out = M.mergeCollection(a, b);
  assert.deepStrictEqual(Object.keys(out.cards).sort(), ['movie:1', 'movie:2', 'person:9']); // union, nothing lost
  assert.strictEqual(out.cards['movie:2'].n, 2);          // most copies
  assert.strictEqual(out.cards['movie:2'].shine, 1);      // any shine kept
  assert.strictEqual(out.cards['movie:2'].first, '2026-06-19'); // earliest collected
  assert.strictEqual(out.cards['movie:2'].no, 2);         // lowest collection number
  // XP re-derived from the union: legendary(100) + rare(25 + 1 dupe*3) + elite(50) = 178
  assert.strictEqual(out.xp, 178);
  assert.strictEqual(out.dust, 45);                       // higher balance
  assert.strictEqual(out.seq, 5);                         // max sequence
});

test('mergeCollection is order-independent and handles nulls', () => {
  const a = { v: 1, xp: 10, cards: { 'movie:1': { id: 1, type: 'movie', rarity: 'common', n: 1, no: 1 } } };
  const b = { v: 1, xp: 25, cards: { 'movie:3': { id: 3, type: 'movie', rarity: 'rare', n: 1, no: 2 } } };
  assert.deepStrictEqual(M.mergeCollection(a, b), M.mergeCollection(b, a));
  assert.strictEqual(M.mergeCollection(a, null), a);
  assert.strictEqual(M.mergeCollection(null, b), b);
  assert.strictEqual(M.mergeCollection(null, null), null);
});

test('mergeCollection unions the per-language title cache (i18n)', () => {
  const a = { v: 1, cards: { 'movie:1': { id: 1, type: 'movie', rarity: 'rare', n: 1, no: 1, name: 'Endgame', i18n: { 'en-US': 'Endgame' } } } };
  const b = { v: 1, cards: { 'movie:1': { id: 1, type: 'movie', rarity: 'rare', n: 1, no: 1, name: 'Endgame', i18n: { 'es-ES': 'Endgame (ES)' } } } };
  const out = M.mergeCollection(a, b);
  assert.deepStrictEqual(out.cards['movie:1'].i18n, { 'en-US': 'Endgame', 'es-ES': 'Endgame (ES)' });
});
