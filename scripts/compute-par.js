#!/usr/bin/env node
/**
 * Precompute the "par" (minimum possible clicks) for each curated daily
 * challenge, via bidirectional BFS over the TMDB people<->titles graph.
 *
 * The live game can't do this — it would mean thousands of TMDB calls per
 * puzzle — so we compute it offline once and ship par-data.json. CineLinks loads
 * that file and shows "Best possible: N" + a difficulty label on the win screen.
 *
 * Usage:
 *   TMDB_API_KEY=xxxxx node scripts/compute-par.js
 *   TMDB_API_KEY=xxxxx node scripts/compute-par.js --max-depth 6 --branch 50
 *
 * Output: par-data.json  { "person:3092>movie:346698": 2, ... }
 *
 * Notes:
 *   - Neighbour expansion mirrors what a player can actually click (cast +
 *     directors on a title; acting + directed works on a person), capped to the
 *     top `--branch` by relevance — so par is the real achievable minimum.
 *   - Bidirectional search keeps the node count ~2·b^(d/2) instead of b^d.
 *   - Requires Node 18+ (global fetch). Incremental: existing entries are reused.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { shortestPath } = require('../lib/graph-bfs');
const { createGraph } = require('./tmdb-neighbors');
require('./load-env').loadEnv(); // picks up TMDB_API_KEY from .env.local if present

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'par-data.json');
const API_KEY = process.env.TMDB_API_KEY;

function arg(flag, def) {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}
const MAX_DEPTH = parseInt(arg('--max-depth', '6'), 10);
const BRANCH = parseInt(arg('--branch', '50'), 10);

if (!API_KEY || API_KEY === 'tu_key' || API_KEY === 'xxxxx') {
  console.error('Set a REAL TMDB_API_KEY (you used a placeholder). Run: TMDB_API_KEY=<your key> node scripts/compute-par.js');
  console.error('Tip: get it locally with `vercel env pull .env.local` then `export $(grep TMDB_API_KEY .env.local)`');
  process.exit(1);
}

function readKeys() {
  const file = fs.readFileSync(path.join(ROOT, 'daily-challenges.js'), 'utf8');
  const re = /"((?:person|movie|tv):\d+>(?:person|movie|tv):\d+)"/g;
  const keys = [];
  let m;
  while ((m = re.exec(file))) keys.push(m[1]);
  return [...new Set(keys)];
}

const graph = createGraph(API_KEY, { branch: BRANCH });
const neighbors = graph.neighbors;

async function main() {
  await graph.verify(); // aborts with a clear error if the key is invalid
  const keys = readKeys();
  const existing = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};
  const result = { ...existing };
  console.log(`Computing par for ${keys.length} challenges (depth<=${MAX_DEPTH}, branch=${BRANCH})...`);

  let done = 0;
  for (const key of keys) {
    done++;
    if (result[key] != null) continue; // incremental: skip already computed
    const [start, end] = key.split('>');
    let par = null;
    try { par = await shortestPath(start, end, neighbors, { maxDepth: MAX_DEPTH }); }
    catch (e) { console.error('  error on', key, e.message); }
    result[key] = par;
    console.log(`[${done}/${keys.length}] ${key} -> ${par == null ? 'unreachable' : par}`);
    fs.writeFileSync(OUT, JSON.stringify(result, null, 0)); // checkpoint each step
  }
  console.log(`Done. Wrote ${OUT}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
