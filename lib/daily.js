// Daily-challenge ordering, shared by index.html (browser) and api/admin.js (Node)
// so the live game and the admin month-preview always agree.
//
// The old mapping was `index = days mod length`, which replays the exact same
// challenge on the same calendar slot every `length` days. This version maps each
// cycle through a bijective permutation (stride scramble + per-cycle hashed
// offset): within any block of `length` days every challenge appears exactly once
// (no repeats), and consecutive years use different orderings.
(function (root) {
  'use strict';

  function hashString(str) {
    let h = 2166136261;
    str = String(str);
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function gcd(a, b) {
    a = Math.abs(a); b = Math.abs(b);
    while (b) { const t = b; b = a % b; a = t; }
    return a;
  }

  // A stride coprime to n (so multiplying is a bijection mod n), near the golden
  // ratio for good spread. Falls back to 1 if none found (n <= 2).
  function coprimeStride(n) {
    if (n <= 2) return 1;
    let s = Math.floor(n * 0.6180339887) || 1;
    if (s < 1) s = 1;
    for (let tries = 0; tries < n; tries++) {
      if (gcd(s, n) === 1) return s;
      s = (s % (n - 1)) + 1;
    }
    return 1;
  }

  function daysFromKey(key) {
    const parts = String(key).split('-').map(Number);
    const y = parts[0], m = parts[1] || 1, d = parts[2] || 1;
    return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
  }

  function dailyListIndex(key, length) {
    const len = length | 0;
    if (len <= 1) return 0;
    const days = daysFromKey(key);
    const base = ((days % len) + len) % len;
    const cycle = Math.floor(days / len);
    const stride = coprimeStride(len);
    const offset = hashString('cyc-' + cycle) % len;
    return ((base * stride) % len + offset) % len;
  }

  const api = { hashString, gcd, coprimeStride, daysFromKey, dailyListIndex };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CineDaily = api;
})(typeof window !== 'undefined' ? window : globalThis);
