#!/usr/bin/env node
/**
 * Difficulty calculator / auditor.
 *
 *   node scripts/difficulty.js                         # audit the whole daily list
 *   node scripts/difficulty.js --all                   # ...and list every challenge
 *   node scripts/difficulty.js person:6193 movie:496243   # one pair
 *   node scripts/difficulty.js "person:6193>movie:496243" # same, single arg
 *
 * For a single pair it uses par-data.json if present, otherwise computes the par
 * live via BFS (needs TMDB_API_KEY — run `npm run env:pull` first). The audit
 * mode just reads par-data.json (no key needed). Difficulty thresholds come from
 * lib/difficulty.js, the same logic the game uses.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { difficultyLevel, LEVELS } = require('../lib/difficulty');
require('./load-env').loadEnv();

const ROOT = path.join(__dirname, '..');
const PAR = path.join(ROOT, 'par-data.json');

function parData() {
  return fs.existsSync(PAR) ? JSON.parse(fs.readFileSync(PAR, 'utf8')) : {};
}

// "startKey>endKey" -> "Name -> Name" from the comments in daily-challenges.js
function labels() {
  try {
    const file = fs.readFileSync(path.join(ROOT, 'daily-challenges.js'), 'utf8');
    const re = /\/\/\s*\d+:\s*(.*?)\n\s*"([^"]+)"/g;
    const map = {};
    let m;
    while ((m = re.exec(file))) map[m[2]] = m[1].trim();
    return map;
  } catch (_) { return {}; }
}

function normKey(args) {
  const joined = args.join(' ').trim();
  if (joined.includes('>')) return joined.replace(/\s+/g, '');
  if (args.length === 2 && args[0].includes(':') && args[1].includes(':')) return args[0] + '>' + args[1];
  return null;
}

async function single(key) {
  const data = parData();
  let par = data[key];
  let source = 'par-data.json';
  if (par == null) {
    const apiKey = process.env.TMDB_API_KEY;
    if (!apiKey || apiKey === 'tu_key' || apiKey === 'xxxxx') {
      console.error('Not in par-data.json and no real TMDB_API_KEY to compute it.');
      console.error('Run `npm run env:pull` (or pass TMDB_API_KEY=...) and try again.');
      process.exit(1);
    }
    const { shortestPath } = require('../lib/graph-bfs');
    const { createGraph } = require('./tmdb-neighbors');
    const g = createGraph(apiKey, { branch: 50 });
    await g.verify();
    const [s, e] = key.split('>');
    if (!s || !e) { console.error('Invalid pair. Use type:id type:id, e.g. person:6193 movie:496243'); process.exit(1); }
    par = await shortestPath(s, e, g.neighbors, { maxDepth: 6 });
    source = 'computed via BFS';
  }
  const lab = labels()[key];
  console.log('');
  console.log('  ' + key + (lab ? '  — ' + lab : ''));
  console.log('  par:        ' + (par == null ? 'unreachable' : par));
  console.log('  difficulty: ' + difficultyLevel(par));
  console.log('  source:     ' + source);
  console.log('');
}

function audit(showAll) {
  const data = parData();
  const lab = labels();
  const keys = Object.keys(data);
  if (!keys.length) { console.log('par-data.json is empty. Run `npm run par` first.'); return; }

  const buckets = { easy: [], medium: [], hard: [], expert: [], unknown: [] };
  for (const k of keys) buckets[difficultyLevel(data[k])].push(k);
  const total = keys.length;

  console.log('\nDifficulty audit — ' + total + ' challenges\n');
  for (const lvl of LEVELS.concat('unknown')) {
    const n = buckets[lvl].length;
    const pct = total ? Math.round((n / total) * 100) : 0;
    console.log('  ' + lvl.padEnd(8) + String(n).padStart(4) + '  ' + String(pct).padStart(3) + '%  ' + '#'.repeat(Math.round(pct / 3)));
  }
  if (buckets.unknown.length === total) {
    console.log('\nAll par values are null — run `npm run par` to populate par-data.json.');
    return;
  }

  const cap = showAll ? Infinity : 12;
  for (const lvl of LEVELS.concat('unknown')) {
    const list = buckets[lvl];
    if (!list.length) continue;
    console.log('\n' + lvl.toUpperCase() + ' (' + list.length + '):');
    list.slice(0, cap).forEach((k) => {
      console.log('  par ' + String(data[k] == null ? '-' : data[k]).padStart(2) + '  ' + k + (lab[k] ? '  — ' + lab[k] : ''));
    });
    if (list.length > cap) console.log('  …and ' + (list.length - cap) + ' more (use --all)');
  }
}

module.exports = { audit: audit, single: single };

if (require.main === module) {
  (async () => {
    const raw = process.argv.slice(2);
    const showAll = raw.includes('--all');
    const args = raw.filter((a) => !a.startsWith('--'));
    const key = normKey(args);
    if (key) await single(key);
    else audit(showAll);
  })().catch((e) => { console.error(e); process.exit(1); });
}
