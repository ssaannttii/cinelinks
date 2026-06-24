const { test } = require('node:test');
const assert = require('node:assert');
const T = require('../lib/timeline');

test('validSlots: empty timeline accepts the only slot', () => {
  assert.deepStrictEqual(T.validSlots([], 1990), [0]);
});

test('validSlots: ends and middles', () => {
  const placed = [1980, 2000, 2010];
  assert.deepStrictEqual(T.validSlots(placed, 1970), [0]);      // before all
  assert.deepStrictEqual(T.validSlots(placed, 1990), [1]);      // between 1980 and 2000
  assert.deepStrictEqual(T.validSlots(placed, 2005), [2]);      // between 2000 and 2010
  assert.deepStrictEqual(T.validSlots(placed, 2020), [3]);      // after all
});

test('validSlots: a tie year is valid on both sides of the equal card', () => {
  const placed = [1980, 2000, 2010];
  assert.deepStrictEqual(T.validSlots(placed, 2000), [1, 2]);   // == 2000 fits either side
  assert.deepStrictEqual(T.validSlots(placed, 1980), [0, 1]);
});

test('isCorrect mirrors validSlots', () => {
  const placed = [1990, 2005];
  assert.ok(T.isCorrect(placed, 1995, 1));
  assert.ok(!T.isCorrect(placed, 1995, 0));
  assert.ok(!T.isCorrect(placed, 1995, 2));
  assert.ok(T.isCorrect(placed, 1990, 0)); // tie accepted on the low side
  assert.ok(T.isCorrect(placed, 1990, 1));
});

test('insertSorted keeps ascending order and is immutable', () => {
  const a = [1980, 2000];
  const b = T.insertSorted(a, 1990);
  assert.deepStrictEqual(b, [1980, 1990, 2000]);
  assert.deepStrictEqual(a, [1980, 2000]); // original untouched
  assert.deepStrictEqual(T.insertSorted([], 1999), [1999]);
  assert.deepStrictEqual(T.insertSorted([2000], 2000), [2000, 2000]);
});

test('shuffle is deterministic per seed and a permutation', () => {
  const base = [1, 2, 3, 4, 5, 6, 7, 8];
  const a = T.shuffle(base, 42);
  const b = T.shuffle(base, 42);
  const c = T.shuffle(base, 43);
  assert.deepStrictEqual(a, b);                       // same seed -> same order
  assert.notDeepStrictEqual(a, base);                 // actually shuffled
  assert.notDeepStrictEqual(a, c);                    // different seed -> different
  assert.deepStrictEqual(a.slice().sort((x, y) => x - y), base); // same elements
  assert.deepStrictEqual(base, [1, 2, 3, 4, 5, 6, 7, 8]); // input untouched
});
