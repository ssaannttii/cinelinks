// Unit tests for the collection ECONOMY — the load-bearing rules (pity floors,
// Daily Double, level payouts, forge, showcase, dupes/dust) that games and the
// Trumps PvP now depend on. collection.js is a browser IIFE, so this harness
// stubs the handful of globals it touches at load time and drives the engine
// through the public window.Collection API.
const { test, beforeEach } = require('node:test');
const assert = require('node:assert');

// ── browser stubs (minimal, in-memory) ──────────────────────────────────────
const store = new Map();
global.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k)
};
global.window = global;             // the IIFE reads window.* and assigns window.Collection
global.location = { search: '' };
global.navigator = {};
global.matchMedia = () => ({ matches: false });
global.document = {
  getElementById: () => null,
  createElement: () => ({ style: {}, classList: { add() {}, remove() {} }, setAttribute() {}, addEventListener() {}, appendChild() {}, querySelector: () => null, querySelectorAll: () => [] }),
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener() {},
  head: { appendChild() {} },
  body: { appendChild() {} }
};
global.addEventListener = () => {};
global.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve({ poster_path: '/forged.jpg' }) });

require('../collection.js');
const C = global.window.Collection;

const KEY = 'cl_collection';
const blob = () => JSON.parse(store.get(KEY) || 'null') || {};
const setBlob = (b) => store.set(KEY, JSON.stringify(b));
const iso = (daysAgo) => new Date(Date.now() - daysAgo * 864e5).toISOString().slice(0, 10);

beforeEach(() => { store.clear(); });

// ── grants: rarity floors, bumps, dupes ─────────────────────────────────────
test('a prize card is floored to rare and bumps raise the tier', () => {
  // movie:27205 (Inception) hashes to common — floor lifts it, bump lifts further
  const [a] = C.add([{ id: 27205, type: 'movie', name: 'Inception', img: '/i.jpg', rarityFloor: 'rare' }]);
  assert.strictEqual(a.rarity, 'rare');
  store.clear();
  const [b] = C.add([{ id: 27205, type: 'movie', name: 'Inception', img: '/i.jpg', rarityFloor: 'rare', bump: 2 }]);
  assert.strictEqual(b.rarity, 'legendary');
});

test('explicit rarity wins over floor and hash', () => {
  const [a] = C.add([{ id: 27205, type: 'movie', name: 'X', img: '', rarity: 'elite', rarityFloor: 'rare' }]);
  assert.strictEqual(a.rarity, 'elite');
});

test('a dupe pays dust by rarity and dupe XP, never a second card', () => {
  C.add([{ id: 1, type: 'movie', name: 'A', img: '', rarity: 'elite' }]);
  const xp0 = C.stats().xp, dust0 = C.dust();
  const again = C.add([{ id: 1, type: 'movie', name: 'A', img: '', rarity: 'elite' }]);
  assert.strictEqual(again.length, 0);                     // not "new"
  assert.strictEqual(C.dust() - dust0, 40);                // elite dupe dust
  assert.strictEqual(C.stats().xp - xp0, 5);               // dupe XP
  assert.strictEqual(C.all()[0].n, 2);
});

// ── pity floors ─────────────────────────────────────────────────────────────
test('7 dry days force a prize to elite; 21 force legendary; clocks reset', () => {
  setBlob({ v: 1, cards: {}, xp: 0, pityE: iso(8), pityL: iso(8) });
  const [a] = C.add([{ id: 27205, type: 'movie', name: 'X', img: '', rarityFloor: 'rare' }]);
  assert.strictEqual(a.rarity, 'elite');                   // elite pity fired
  assert.strictEqual(blob().pityE, iso(0));                // clock reset today

  setBlob({ v: 1, cards: {}, xp: 0, pityE: iso(2), pityL: iso(22) });
  const [b] = C.add([{ id: 27205, type: 'movie', name: 'X', img: '', rarityFloor: 'rare' }]);
  assert.strictEqual(b.rarity, 'legendary');               // legendary pity beats elite
  assert.strictEqual(blob().pityL, iso(0));
});

test('a naturally high tier resets pity without needing the floor', () => {
  setBlob({ v: 1, cards: {}, xp: 0, pityE: iso(6), pityL: iso(6) });
  C.add([{ id: 2, type: 'movie', name: 'Y', img: '', rarity: 'legendary' }]);  // path-card luck
  assert.strictEqual(blob().pityL, iso(0));
  assert.strictEqual(blob().pityE, iso(0));
});

// ── daily double ────────────────────────────────────────────────────────────
test('second prize of the day banks +60 dust, once, dupes count too', () => {
  C.add([{ id: 10, type: 'movie', name: 'P1', img: '', rarityFloor: 'rare' }]);
  assert.strictEqual(blob().dd.n, 1);
  const dust1 = C.dust();
  C.add([{ id: 10, type: 'movie', name: 'P1', img: '', rarityFloor: 'rare' }]);   // prize AGAIN (dupe)
  assert.strictEqual(blob().dd.done, 1);
  assert.strictEqual(C.dust() - dust1, 60 + 15);           // +60 daily double, +15 rare-dupe dust
  const dust2 = C.dust();
  C.add([{ id: 11, type: 'movie', name: 'P2', img: '', rarityFloor: 'rare' }]);   // third prize: no re-pay
  assert.strictEqual(blob().dd.n, 3);
  assert.strictEqual(blob().dd.done, 1);
  assert.ok(C.dust() - dust2 < 60);
});

// ── level payouts ───────────────────────────────────────────────────────────
test('crossing levels pays 15 + 5·level per level, no retro windfall', () => {
  C.add([{ id: 20, type: 'movie', name: 'L', img: '', rarity: 'common' }]);      // fresh save starts lvlPaid at 1
  const dust0 = C.dust();
  C.addXp(200);                                            // xp 210 → level 3 (needs 200)
  C.add([{ id: 21, type: 'movie', name: 'M', img: '', rarity: 'common' }]);      // triggers payLevels
  // levels 2 and 3 paid: (15+10) + (15+15) = 55
  assert.strictEqual(C.dust() - dust0, 55);
  assert.strictEqual(blob().lvlPaid, 3);
});

// ── forge ───────────────────────────────────────────────────────────────────
test('forge deducts dust and mints the card at its natural tier', async () => {
  C.addDust(500);
  const member = { id: 27205, type: 'movie', name: 'Inception' };                // hash → common → cost 60
  assert.strictEqual(C.forgeCost(member), 60);
  const r = await C.forge(member);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.cards[0].rarity, 'common');
  assert.strictEqual(r.cards[0].img, '/forged.jpg');
  assert.strictEqual(C.dust(), 440);                       // 500 − 60 cost (10 xp from a common crosses no level)
});

test('forge refuses without dust and when already owned', async () => {
  const member = { id: 27205, type: 'movie', name: 'Inception' };
  const broke = await C.forge(member);
  assert.deepStrictEqual({ ok: broke.ok, reason: broke.reason }, { ok: false, reason: 'dust' });
  C.addDust(100);
  await C.forge(member);
  const dup = await C.forge(member);
  assert.deepStrictEqual({ ok: dup.ok, reason: dup.reason }, { ok: false, reason: 'owned' });
});

// ── showcase ────────────────────────────────────────────────────────────────
test('showcase toggles membership and caps at six', () => {
  for (let i = 1; i <= 7; i++) C.add([{ id: 100 + i, type: 'movie', name: 'S' + i, img: '', rarity: 'common' }]);
  const cards = C.all();
  for (let i = 0; i < 6; i++) assert.strictEqual(C.toggleShowcase(cards[i]).ok, true);
  const full = C.toggleShowcase(cards[6]);
  assert.deepStrictEqual({ ok: full.ok, full: full.full }, { ok: false, full: true });
  assert.strictEqual(C.showcase().length, 6);
  const off = C.toggleShowcase(cards[0]);                  // remove frees a slot
  assert.deepStrictEqual({ ok: off.ok, on: off.on }, { ok: true, on: false });
  assert.strictEqual(C.showcase().length, 5);
});
