#!/usr/bin/env node
/**
 * Precompute the "par" (minimum possible clicks) for each curated daily
 * challenge, by BFS over the TMDB people<->titles graph.
 *
 * The live game can't do this — it would mean thousands of TMDB calls per
 * puzzle — so we compute it offline once and ship the result as par-data.json.
 * CineLinks loads that file and shows "Best possible: N" on the win screen
 * for any challenge whose endpoints are present.
 *
 * Usage:
 *   TMDB_API_KEY=xxxxx node scripts/compute-par.js
 *   TMDB_API_KEY=xxxxx node scripts/compute-par.js --max-depth 6 --branch 40
 *
 * Output: par-data.json  { "person:3092>movie:346698": 2, ... }
 *
 * Notes:
 *   - Branching is capped (default 40) to mirror what a player actually sees as
 *     selectable connections, and to keep the search tractable.
 *   - Requires Node 18+ (global fetch). Re-run whenever daily-challenges.js
 *     changes; existing entries are reused so it's incremental.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'par-data.json');
const API_KEY = process.env.TMDB_API_KEY;

function arg(flag, def) {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}
const MAX_DEPTH = parseInt(arg('--max-depth', '6'), 10);
const BRANCH = parseInt(arg('--branch', '40'), 10);

if (!API_KEY) {
  console.error('Missing TMDB_API_KEY. Run: TMDB_API_KEY=xxxxx node scripts/compute-par.js');
  process.exit(1);
}

// --- read curated challenge keys from daily-challenges.js ---
function readKeys() {
  const file = fs.readFileSync(path.join(ROOT, 'daily-challenges.js'), 'utf8');
  const re = /"((?:person|movie|tv):\d+>(?:person|movie|tv):\d+)"/g;
  const keys = [];
  let m;
  while ((m = re.exec(file))) keys.push(m[1]);
  return [...new Set(keys)];
}

function parseEndpoint(part) {
  const [type, id] = part.split(':');
  return { type, id: Number(id) };
}

// --- TMDB fetch with cache + 429 retry ---
const tmdbCache = new Map();
async function tmdb(p) {
  if (tmdbCache.has(p)) return tmdbCache.get(p);
  const url = 'https://api.themoviedb.org/3/' + p + (p.includes('?') ? '&' : '?') + 'api_key=' + API_KEY;
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(url);
    if (res.status === 429) {
      const wait = (parseInt(res.headers.get('retry-after') || '1', 10) || 1) * 1000;
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    const json = await res.json().catch(() => ({}));
    tmdbCache.set(p, json);
    return json;
  }
  tmdbCache.set(p, {});
  return {};
}

const nodeKey = (n) => n.type + ':' + n.id;

// Neighbors mirror the in-game connection rules, capped to BRANCH by relevance.
async function neighbors(node) {
  if (node.type === 'person') {
    const d = await tmdb('person/' + node.id + '/combined_credits');
    const cast = d.cast || [];
    const directed = (d.crew || []).filter((c) => c.job === 'Director');
    const out = [];
    const seen = new Set();
    for (const m of [...cast, ...directed]) {
      if (m.media_type !== 'movie' && m.media_type !== 'tv') continue;
      const k = m.media_type + ':' + m.id;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({ type: m.media_type === 'tv' ? 'tv' : 'movie', id: m.id, score: m.vote_count || 0 });
    }
    return out.sort((a, b) => b.score - a.score).slice(0, BRANCH);
  }
  // movie / tv -> people (cast + directors)
  let cast = [];
  let crew = [];
  if (node.type === 'tv') {
    const [c, a] = await Promise.all([
      tmdb('tv/' + node.id + '/credits'),
      tmdb('tv/' + node.id + '/aggregate_credits')
    ]);
    cast = (c.cast && c.cast.length ? c.cast : a.cast) || [];
    crew = (c.crew || []).filter((x) => x.job === 'Director');
  } else {
    const c = await tmdb('movie/' + node.id + '/credits');
    cast = c.cast || [];
    crew = (c.crew || []).filter((x) => x.job === 'Director');
  }
  const out = [];
  const seen = new Set();
  for (const p of [...crew, ...cast]) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    const order = Number.isFinite(p.order) ? p.order : 999;
    out.push({ type: 'person', id: p.id, score: 10000 - order + (p.popularity || 0) });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, BRANCH);
}

async function bfsPar(start, end) {
  if (start.type === end.type && start.id === end.id) return 0;
  const target = nodeKey(end);
  let frontier = [start];
  const visited = new Set([nodeKey(start)]);
  for (let depth = 1; depth <= MAX_DEPTH; depth++) {
    const next = [];
    for (const node of frontier) {
      let ns;
      try { ns = await neighbors(node); } catch (_) { ns = []; }
      for (const n of ns) {
        const k = nodeKey(n);
        if (k === target) return depth;
        if (!visited.has(k)) { visited.add(k); next.push(n); }
      }
    }
    if (!next.length) break;
    frontier = next;
  }
  return null;
}

async function main() {
  const keys = readKeys();
  const existing = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};
  const result = { ...existing };
  console.log(`Computing par for ${keys.length} challenges (depth<=${MAX_DEPTH}, branch=${BRANCH})...`);

  let done = 0;
  for (const key of keys) {
    done++;
    if (result[key] != null) { continue; } // incremental: skip already computed
    const [sPart, ePart] = key.split('>');
    const par = await bfsPar(parseEndpoint(sPart), parseEndpoint(ePart));
    result[key] = par;
    console.log(`[${done}/${keys.length}] ${key} -> ${par == null ? 'unreachable' : par}`);
    fs.writeFileSync(OUT, JSON.stringify(result, null, 0)); // checkpoint each step
  }
  console.log(`Done. Wrote ${OUT}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
