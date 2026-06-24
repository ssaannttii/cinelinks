// Core placement logic for CineLine (the "place films on a timeline by year"
// game). Pure + unit-tested so the game UI can stay thin. `placed` is always a
// sorted-ascending array of years; a "slot" i (0..placed.length) means "insert
// before placed[i]" (slot === length means "after the last"). Equal years make
// several slots valid — any of them counts as correct.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Timeline = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function validSlots(placed, year) {
    placed = placed || [];
    var out = [];
    for (var i = 0; i <= placed.length; i++) {
      var okLeft = (i === 0) || (placed[i - 1] <= year);
      var okRight = (i === placed.length) || (year <= placed[i]);
      if (okLeft && okRight) out.push(i);
    }
    return out;
  }

  function isCorrect(placed, year, slot) {
    return validSlots(placed, year).indexOf(slot) !== -1;
  }

  // Insert keeping ascending order; returns a NEW array. Stable: equal years go
  // after existing ones (so the just-revealed card sits to the right of a tie).
  function insertSorted(placed, year) {
    placed = (placed || []).slice();
    var i = 0;
    while (i < placed.length && placed[i] <= year) i++;
    placed.splice(i, 0, year);
    return placed;
  }

  // Seeded shuffle (mulberry32) so the daily deck is deterministic per seed.
  function shuffle(arr, seed) {
    var a = arr.slice();
    var s = seed >>> 0;
    function rnd() {
      s |= 0; s = (s + 0x6D2B79F5) | 0;
      var t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  return { validSlots: validSlots, isCorrect: isCorrect, insertSorted: insertSorted, shuffle: shuffle };
}));
