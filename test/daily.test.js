'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { dailyListIndex, coprimeStride, gcd, daysFromKey } = require('../lib/daily');

function keyForDays(days) {
  const d = new Date(days * 86400000);
  return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0');
}

test('coprimeStride returns a value coprime to n', () => {
  for (const n of [3, 7, 10, 12, 100, 365, 366]) {
    assert.strictEqual(gcd(coprimeStride(n), n), 1, 'stride coprime for n=' + n);
  }
});

test('each cycle is a full permutation (no repeats, covers all indices)', () => {
  for (const len of [10, 50, 365]) {
    for (const cycle of [0, 1, 5]) {
      const seen = new Set();
      for (let i = 0; i < len; i++) {
        const days = cycle * len + i;
        seen.add(dailyListIndex(keyForDays(days), len));
      }
      assert.strictEqual(seen.size, len, `cycle ${cycle} len ${len} should hit all ${len} indices`);
    }
  }
});

test('consecutive years are not identical orderings', () => {
  const len = 365;
  let identical = true;
  for (let i = 0; i < len; i++) {
    const y0 = dailyListIndex(keyForDays(i), len);
    const y1 = dailyListIndex(keyForDays(len + i), len);
    if (y0 !== y1) { identical = false; break; }
  }
  assert.strictEqual(identical, false, 'year 2 must differ from year 1');
});

test('deterministic for a given date', () => {
  assert.strictEqual(dailyListIndex('2026-06-22', 365), dailyListIndex('2026-06-22', 365));
});

test('handles tiny lengths safely', () => {
  assert.strictEqual(dailyListIndex('2026-06-22', 1), 0);
  assert.strictEqual(dailyListIndex('2026-06-22', 0), 0);
  const i = dailyListIndex('2026-06-22', 2);
  assert.ok(i === 0 || i === 1);
});

test('daysFromKey is stable and ordered', () => {
  assert.strictEqual(daysFromKey('2026-06-23') - daysFromKey('2026-06-22'), 1);
  assert.strictEqual(daysFromKey('1970-01-01'), 0);
});
