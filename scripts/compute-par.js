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
 *   node scripts/compute-par.js --force --limit 5     # time the first 5 keys
 *
 * Output: par-data.json  { "person:3092>movie:346698": 2, ... }
 *
 * Notes:
 *   - Neighbour expansion mirrors what a player can actually click, using the
 *     board's own rules (scripts/tmdb-neighbors.js) — so par is the real
 *     achievable minimum. (--branch is kept only for cache invalidation.)
 *   - Bidirectional search keeps the node count ~2·b^(d/2) instead of b^d.
 *     Boards are one-way (truncated top-N lists), so the backward half walks
 *     every credit that COULD list a node and checks each against its own board
 *     (lib/graph-bfs.js `directed`): the route is playable and the minimum.
 *   - Boards are cached in .cache/tmdb/ (gitignored), shared across keys and
 *     runs, and fetched --concurrency at a time; a rerun only pays for new nodes.
 *   - Requires Node 18+ (global fetch). Incremental: existing entries are reused.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { shortestPathTrace } = require('../lib/graph-bfs');
const { createGraph } = require('./tmdb-neighbors');
const { dailyListIndex } = require('../lib/daily');
require('./load-env').loadEnv(); // picks up TMDB_API_KEY from .env.local if present

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'par-data.json');
const PATHS_OUT = path.join(ROOT, 'par-paths.json');
const META_OUT = path.join(ROOT, 'par-data.meta.json');
// Bump when the BFS / neighbour rules change, to invalidate cached pars.
const PAR_ALGO_VERSION = 3;   // v3: board-exact neighbours (role-aware people) + exact directed search (only playable routes)
const API_KEY = process.env.TMDB_API_KEY;

function arg(flag, def) {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}
const MAX_DEPTH = parseInt(arg('--max-depth', '6'), 10);
const BRANCH = parseInt(arg('--branch', '50'), 10);
const FORCE = process.argv.includes('--force');   // recompute everything
const ONLY_KEY = arg('--key', null);              // recompute just one "a>b" key
const LIMIT = parseInt(arg('--limit', '0'), 10);   // stop after N keys (timing runs)
const CONCURRENCY = parseInt(arg('--concurrency', '16'), 10);
const CACHE_DIR = path.join(ROOT, '.cache', 'tmdb');

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

function dayNumToKey(n) {
  const d = new Date(n * 86400000);
  return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0');
}

// Order keys by the next date (today onward) on which each appears as the daily,
// so par for today and the coming days is computed first; any keys not reached
// by the date mapping are appended at the end ("the old ones").
function orderKeysByDate(keys) {
  const len = keys.length;
  if (len === 0) return keys;
  const today = new Date();
  const startDay = Math.floor(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) / 86400000);
  const seen = new Set();
  const ordered = [];
  for (let i = 0; i < len * 2 && ordered.length < len; i++) {
    const idx = dailyListIndex(dayNumToKey(startDay + i), len);
    const key = keys[idx];
    if (key && !seen.has(key)) { seen.add(key); ordered.push(key); }
  }
  for (const k of keys) if (!seen.has(k)) ordered.push(k); // leftovers last
  return ordered;
}

const graph = createGraph(API_KEY, { branch: BRANCH, cacheDir: CACHE_DIR });

function readJson(file, fallback) {
  try { return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback; } catch (_) { return fallback; }
}

async function resolvePath(pathKeys) {
  if (!pathKeys) return null;
  const out = [];
  for (const k of pathKeys) {
    const [type, id] = k.split(':');
    let name = k;
    try { name = await graph.name(type + ':' + id); } catch (_) {}
    out.push(k.endsWith(':d') ? { type, id: Number(id), name, role: 'director' } : { type, id: Number(id), name });
  }
  return out;
}

// One search. A TMDB request that kept failing reads as an empty board inside
// the BFS, which could make par look longer or unreachable — so such a run is
// retried, and reported as failed rather than written.
async function solve(start, end) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const before = graph.stats.failures;
    const g = graph.towards(end);
    const r = await shortestPathTrace(start, end, g.neighbors, { maxDepth: MAX_DEPTH, directed: true, candidates: g.candidates, concurrency: CONCURRENCY });
    if (graph.stats.failures === before) return r;
    console.warn('  TMDB failures during search, retrying...');
  }
  return null;
}

async function main() {
  await graph.verify(); // aborts with a clear error if the key is invalid

  const result = readJson(OUT, {});
  const paths = readJson(PATHS_OUT, {});
  const meta = readJson(META_OUT, null);

  // "Has the par definition changed?" -> recompute everything. Triggers on
  // --force, or when the stored algo version / branch / depth differ. A missing
  // meta file is treated as "up to date" so existing values are kept.
  const stale = !!meta && (meta.version !== PAR_ALGO_VERSION || meta.branch !== BRANCH || meta.maxDepth !== MAX_DEPTH);
  const recomputeAll = FORCE || stale;

  let keys;
  if (ONLY_KEY) {
    keys = [ONLY_KEY.replace(/\s+/g, '')];
    console.log('Recomputing single key: ' + keys[0]);
  } else {
    keys = orderKeysByDate(readKeys()); // today's daily first, then forward, then the rest
    const mode = recomputeAll ? (FORCE ? 'forced full recompute' : 'params changed → full recompute') : 'incremental (only missing)';
    console.log(`Computing par for ${keys.length} challenges — ${mode}, today first (depth<=${MAX_DEPTH}, branch=${BRANCH})...`);
  }

  let done = 0;
  let computed = 0;
  const failed = [];
  const t0 = Date.now();
  for (const key of keys) {
    done++;
    if (LIMIT && computed >= LIMIT) break;
    const isMissing = result[key] == null || paths[key] === undefined; // missing par OR path
    if (!recomputeAll && !ONLY_KEY && !isMissing) continue; // skip already-calculated
    const [start, end] = key.split('>');
    const t = Date.now();
    const req = graph.stats.requests;
    let r = null;
    try { r = await solve(start, end); } catch (e) { console.error('  error on', key, e.message); }
    computed++;
    const took = `${((Date.now() - t) / 1000).toFixed(1)}s, ${graph.stats.requests - req} req`;
    if (!r) { failed.push(key); console.log(`[${done}/${keys.length}] ${key} -> FAILED (kept old value) ${took}`); continue; }
    result[key] = r.dist;
    paths[key] = await resolvePath(r.path);
    console.log(`[${done}/${keys.length}] ${key} -> ${r.dist == null ? 'unreachable' : r.dist}  (${took})`);
    fs.writeFileSync(OUT, JSON.stringify(result, null, 0));        // checkpoint
    fs.writeFileSync(PATHS_OUT, JSON.stringify(paths, null, 0));
  }

  // Only a complete, clean pass may claim the new version: a partial run would
  // otherwise mark the leftover old values as up to date.
  const complete = !ONLY_KEY && !LIMIT && !failed.length && (recomputeAll || !stale);
  if (complete) {
    fs.writeFileSync(META_OUT, JSON.stringify({ version: PAR_ALGO_VERSION, branch: BRANCH, maxDepth: MAX_DEPTH, updatedAt: new Date().toISOString() }, null, 2) + '\n');
  }
  console.log(`Done. Computed ${computed} in ${((Date.now() - t0) / 60000).toFixed(1)} min, ${graph.stats.requests} TMDB requests, wrote ${OUT} + ${path.basename(PATHS_OUT)}`);
  if (failed.length) console.log(`${failed.length} key(s) failed, rerun to fill them: ${failed.join(' ')}`);
  if (!complete) console.log('Meta not updated (partial run).');
  try { require('./difficulty').audit(false); } catch (_) {}
}

main().catch((e) => { console.error(e); process.exit(1); });
