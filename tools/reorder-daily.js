#!/usr/bin/env node
/* global require, __dirname, console */
// Regenerate daily-challenges.js with spacing-optimised ordering.
//
// Why: the daily index walks the array with a coprime stride, so the *array order*
// determines which challenges land on consecutive days. If many entries share an
// endpoint (e.g. several "-> Succession"), a naive order makes the same actor/title
// reappear every day or two and the daily "feels" repetitive.
//
// This greedily reorders entries (LRU on both endpoints) and then places them so
// that, traversed by the real daily stride, no endpoint (actor OR title) repeats
// within 7 days. Run from the repo root:  node tools/reorder-daily.js
//
// It reads the existing keys from daily-challenges.js and the node names/ids from
// DAILY_POOL in index.html, drops any key whose endpoints aren't in the pool, and
// rewrites daily-challenges.js in place.
'use strict';
const fs = require('fs');
const path = require('path');
const CineDaily = require('../lib/daily.js');

const root = path.join(__dirname, '..');
const idx = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

// DAILY_POOL nodes (between `const DAILY_POOL = {` and its closing `};`)
const start = idx.indexOf('const DAILY_POOL');
const end = idx.indexOf('\n};', start);
const block = idx.slice(start, end);
const names = {};
let m, re = /name:"([^"]+)",type:"(person|movie|tv)",id:(\d+)/g;
while ((m = re.exec(block))) names[m[2] + ':' + m[3]] = m[1];
const pool = new Set(Object.keys(names));

const djs = fs.readFileSync(path.join(root, 'daily-challenges.js'), 'utf8');
const keys = [...djs.matchAll(/"((?:person|movie|tv):\d+>(?:person|movie|tv):\d+)"/g)].map(x => x[1]);
const valid = keys.filter(k => { const [a, b] = k.split('>'); return pool.has(a) && pool.has(b); });
const dropped = keys.length - valid.length;

// Greedy LRU spacing on both endpoints, starting from a given input order.
function greedy(inputKeys) {
  const remaining = inputKeys.map(k => { const [s, e] = k.split('>'); return { k, s, e }; });
  const seq = []; const lastPos = {}; let pos = 0;
  while (remaining.length) {
    let best = -1, bestScore = -1;
    for (let i = 0; i < remaining.length; i++) {
      const r = remaining[i];
      const gs = lastPos[r.s] == null ? 9999 : pos - lastPos[r.s];
      const ge = lastPos[r.e] == null ? 9999 : pos - lastPos[r.e];
      const score = Math.min(gs, ge);
      if (score > bestScore) { bestScore = score; best = i; }
    }
    const r = remaining.splice(best, 1)[0];
    seq.push(r); lastPos[r.s] = pos; lastPos[r.e] = pos; pos++;
  }
  const len = seq.length, stride = CineDaily.coprimeStride(len);
  const out = new Array(len);
  for (let j = 0; j < len; j++) out[(j * stride) % len] = seq[j].k;
  return out;
}

// Verify against the real daily index over a full cycle + margin.
function simulate(arr) {
  const last = {}; let minGap = Infinity, viol = 0;
  for (let d = 0; d < arr.length + 40; d++) {
    const key = new Date((20264 + d) * 864e5).toISOString().slice(0, 10);
    const [s, e] = arr[CineDaily.dailyListIndex(key, arr.length)].split('>');
    for (const node of [s, e]) {
      if (last[node] != null) { const g = d - last[node]; if (g < minGap) minGap = g; if (g < 7) viol++; }
      last[node] = d;
    }
  }
  return { minGap, violationsUnder7: viol };
}

// Deterministic & idempotent: always greedy from a canonical (sorted) input,
// but also try a couple of seeded rotations and keep whichever simulates best.
const canonical = valid.slice().sort();
const candidates = [canonical, canonical.slice().reverse()];
for (let r = 1; r <= 3; r++) candidates.push(canonical.slice(r * 37).concat(canonical.slice(0, r * 37)));
let out = null, bestSim = null;
for (const c of candidates) {
  const o = greedy(c);
  const sim = simulate(o);
  if (!bestSim || sim.minGap > bestSim.minGap || (sim.minGap === bestSim.minGap && sim.violationsUnder7 < bestSim.violationsUnder7)) {
    bestSim = sim; out = o;
  }
}

const lines = out.map((k, i) => {
  const [s, e] = k.split('>');
  return '    // ' + String(i + 1).padStart(3, '0') + ': ' + (names[s] || s) + ' -> ' + (names[e] || e) + '\n    "' + k + '",';
});
const header = `// Daily challenge curation list.
// Delete any challenge line you dislike; keep the surrounding array syntax intact.
// Format: "startType:startId>endType:endId". Names live in index.html DAILY_POOL.
// Order is spacing-optimised: traversed by the daily index stride, no actor or
// title endpoint repeats within 7 days (regenerate with tools/reorder-daily.js if edited).
(function() {
  window.DAILY_CHALLENGE_KEYS = [
`;
fs.writeFileSync(path.join(root, 'daily-challenges.js'), header + lines.join('\n') + '\n  ];\n})();\n');
console.log('Wrote ' + out.length + ' keys (dropped ' + dropped + ' out-of-pool). Spacing:', JSON.stringify(simulate(out)));
