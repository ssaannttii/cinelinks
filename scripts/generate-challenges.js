#!/usr/bin/env node
/**
 * Mint NEW daily challenges calibrated to a target difficulty, using the same
 * graph + bidirectional BFS as the par precompute. Every emitted challenge is
 * guaranteed reachable with a par inside the requested range — no impossible or
 * trivial puzzles.
 *
 * Candidate endpoints are drawn from the curated DAILY_POOL in index.html (so
 * the names resolve in the game without extra data).
 *
 * Usage:
 *   TMDB_API_KEY=xxxxx node scripts/generate-challenges.js --count 30 --min 3 --max 5
 *
 * Output: prints ready-to-paste lines for daily-challenges.js, e.g.
 *   // Leonardo DiCaprio -> Parasite  (par 3)
 *   "person:6193>movie:496243",
 * and also writes them to generated-challenges.txt.
 *
 * Requires Node 18+ (global fetch).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { shortestPath } = require('../lib/graph-bfs');
const { createGraph } = require('./tmdb-neighbors');

const ROOT = path.join(__dirname, '..');
const API_KEY = process.env.TMDB_API_KEY;

function arg(flag, def) {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}
const COUNT = parseInt(arg('--count', '30'), 10);
const MIN_PAR = parseInt(arg('--min', '3'), 10);
const MAX_PAR = parseInt(arg('--max', '5'), 10);
const BRANCH = parseInt(arg('--branch', '50'), 10);
const MAX_DEPTH = parseInt(arg('--max-depth', '6'), 10);
const SEED = parseInt(arg('--seed', String(Date.now() % 1e9)), 10);

if (!API_KEY || API_KEY === 'tu_key' || API_KEY === 'xxxxx') {
  console.error('Set a REAL TMDB_API_KEY (you used a placeholder). Run: TMDB_API_KEY=<your key> node scripts/generate-challenges.js');
  console.error('Tip: get it locally with `vercel env pull .env.local` then `export $(grep TMDB_API_KEY .env.local)`');
  process.exit(1);
}

// Deterministic PRNG so a given --seed reproduces the same run.
function rng(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(SEED);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];

// Pull the DAILY_POOL entries (name/type/id) out of index.html.
function readPool() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const start = html.indexOf('const DAILY_POOL');
  const end = html.indexOf('\n};', start);
  const block = start >= 0 && end >= 0 ? html.slice(start, end) : '';
  const re = /\{name:"([^"]+)",type:"(person|movie|tv)",id:(\d+)/g;
  const nodes = [];
  let m;
  while ((m = re.exec(block))) nodes.push({ name: m[1], type: m[2], id: Number(m[3]) });
  return nodes;
}

async function main() {
  const pool = readPool();
  if (pool.length < 2) { console.error('Could not read DAILY_POOL from index.html'); process.exit(1); }
  console.error(`Pool: ${pool.length} nodes. Generating ${COUNT} challenges with par ${MIN_PAR}-${MAX_PAR} (seed ${SEED})...`);

  const graph = createGraph(API_KEY, { branch: BRANCH });
  await graph.verify(); // aborts with a clear error if the key is invalid
  const neighbors = graph.neighbors;
  const out = [];
  const usedPairs = new Set();
  let attempts = 0;
  const maxAttempts = COUNT * 60;

  while (out.length < COUNT && attempts < maxAttempts) {
    attempts++;
    const a = pick(pool);
    const b = pick(pool);
    if (a.type === b.type && a.id === b.id) continue;
    const startKey = a.type + ':' + a.id;
    const endKey = b.type + ':' + b.id;
    const pairId = [startKey, endKey].sort().join('|');
    if (usedPairs.has(pairId)) continue;
    usedPairs.add(pairId);

    let par;
    try { par = await shortestPath(startKey, endKey, neighbors, { maxDepth: MAX_DEPTH }); }
    catch (_) { par = null; }
    if (par == null || par < MIN_PAR || par > MAX_PAR) continue;

    const line = `  // ${a.name} -> ${b.name}  (par ${par})\n  "${startKey}>${endKey}",`;
    out.push(line);
    console.error(`  [${out.length}/${COUNT}] ${a.name} -> ${b.name} (par ${par})`);
  }

  const text = out.join('\n') + '\n';
  fs.writeFileSync(path.join(ROOT, 'generated-challenges.txt'), text);
  console.error(`\nWrote ${out.length} challenges to generated-challenges.txt (attempts: ${attempts}).`);
  process.stdout.write(text);
}

main().catch((e) => { console.error(e); process.exit(1); });
