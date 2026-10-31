'use strict';
// Shared TMDB graph definition used by the offline scripts (compute-par,
// generate-challenges). Keeping a single neighbour definition guarantees the
// computed "par" and the generated challenges describe the SAME graph the game
// presents to players. Requires Node 18+ (global fetch).
const fs = require('fs');
const path = require('path');
const { filterPersonCredits } = require('../lib/credits');

// Bump when neighbors() changes what a board shows: it names the disk cache, so
// old boards are never reused under new rules. The year is in the name too,
// because filterPersonCredits boosts last year's and this year's titles.
const RULES_VERSION = 3;   // r2: person nodes carry their role; r3: + backward candidates

// Append-only "key<TAB>json" lines; the last line for a key wins.
function loadNdjson(file, into) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const tab = line.indexOf('\t');
    if (tab < 0) continue;
    try { into.set(line.slice(0, tab), JSON.parse(line.slice(tab + 1))); } catch (_) {}
  }
}

// opts.cacheDir: persist boards and names there (shared across keys and runs).
function createGraph(apiKey, opts) {
  opts = opts || {};
  const tmdbCache = new Map();
  const neighborCache = new Map();
  const candidateCache = new Map();
  const nameCache = new Map();
  const inflight = new Map();
  const stats = { requests: 0, failures: 0 };
  let boardsFile = null;
  let candsFile = null;
  let namesFile = null;
  if (opts.cacheDir) {
    fs.mkdirSync(opts.cacheDir, { recursive: true });
    boardsFile = path.join(opts.cacheDir, 'boards-r' + RULES_VERSION + '-' + new Date().getFullYear() + '.ndjson');
    candsFile = boardsFile.replace('boards-', 'cands-');
    namesFile = path.join(opts.cacheDir, 'names.ndjson');
    loadNdjson(boardsFile, neighborCache);
    loadNdjson(candsFile, candidateCache);
    loadNdjson(namesFile, nameCache);
  }
  const persist = (file, key, value) => { if (file) fs.appendFileSync(file, key + '\t' + JSON.stringify(value) + '\n'); };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // Throws after retries rather than returning {}: an empty answer would be
  // cached (and persisted) as a board with no options. keep=false skips the
  // in-memory copy: raw credits are big and the derived board is what's cached.
  async function tmdb(p, keep) {
    if (tmdbCache.has(p)) return tmdbCache.get(p);
    const url = 'https://api.themoviedb.org/3/' + p + (p.includes('?') ? '&' : '?') + 'api_key=' + apiKey;
    for (let attempt = 0; attempt < 8; attempt++) {
      let res;
      stats.requests++;
      try { res = await fetch(url); } catch (_) { await sleep(500 * (attempt + 1)); continue; }
      if (res.status === 429 || res.status >= 500) {
        const wait = (parseInt(res.headers.get('retry-after') || '1', 10) || 1) * 1000;
        await sleep(wait * (attempt + 1));
        continue;
      }
      // Bad/expired key -> fail loudly instead of silently returning no graph.
      if (res.status === 401) {
        throw new Error('TMDB rejected the API key (401). Pass a real key: TMDB_API_KEY=xxxxx');
      }
      // 404 is a real answer (deleted title): an empty board.
      const json = res.status === 404 ? {} : await res.json().catch(() => null);
      if (json == null) { await sleep(500); continue; }
      if (keep !== false) tmdbCache.set(p, json);
      return json;
    }
    stats.failures++;
    throw new Error('TMDB request kept failing: ' + p);
  }

  // Preflight: confirm the key works before crawling, so an invalid key produces
  // a clear error rather than a graph where everything looks "unreachable".
  async function verify() {
    const res = await fetch('https://api.themoviedb.org/3/movie/27205?api_key=' + apiKey);
    if (res.status === 401) throw new Error('TMDB rejected the API key (401). Pass a real key: TMDB_API_KEY=xxxxx');
    if (!res.ok) throw new Error('TMDB preflight failed: HTTP ' + res.status);
    const j = await res.json().catch(() => ({}));
    if (!j || !j.id) throw new Error('TMDB preflight returned no data — check TMDB_API_KEY.');
    return true;
  }

  // Neighbours of a node as an array of neighbour keys, mirroring the in-game
  // connection rules (see below). People come in two nodes, because the board
  // depends on how you got there: "person:ID" (reached as cast, or the start)
  // shows acting credits; "person:ID:d" (reached through a Director chip) shows
  // directed works.
  async function neighbors(key) {
    if (neighborCache.has(key)) return neighborCache.get(key);
    const base = key.endsWith(':d') ? key.slice(0, -2) : key; // both roles share one fetch
    if (!inflight.has(base)) {
      inflight.set(base, board(base).finally(() => inflight.delete(base)));
    }
    await inflight.get(base);
    return neighborCache.get(key);
  }

  async function board(key) {
    const [type, idStr] = key.split(':');
    const id = Number(idStr);
    let out = [];
    const save = (k, list) => { neighborCache.set(k, list); persist(boardsFile, k, list); };
    // Everything that could list this node on its board (every credit, not the
    // truncated top-N): the backward search's candidates. Saved first, so a
    // cached board always has its candidates.
    const saveCands = (k, list) => { list = [...new Set(list)]; candidateCache.set(k, list); persist(candsFile, k, list); };
    const titles = (list) => list.filter((m) => m.media_type === 'movie' || m.media_type === 'tv').map((m) => m.media_type + ':' + m.id);

    // Mirror the board EXACTLY (index.html loadConnections + lib/credits.js). The
    // old rule (top-50 by votes, acting + directing, no talk/award filter) found
    // routes through talk shows, award telecasts and deep-cut credits that never
    // appear as options, so "best possible" was unreachable on many dailies.
    if (type === 'person') {
      // One fetch serves both of this person's nodes.
      const d = await tmdb('person/' + id + '/combined_credits', false);
      const keys = (list) => list.map((m) => m.type + ':' + m.id);
      saveCands('person:' + id, titles(d.cast || []));
      saveCands('person:' + id + ':d', titles((d.crew || []).filter((c) => c.job === 'Director')));
      save('person:' + id, keys(filterPersonCredits(d, {})));
      save('person:' + id + ':d', keys(filterPersonCredits(d, { isDirector: true })));
      return out;
    } else {
      const order = (p) => (Number.isFinite(p.order) ? p.order : 999);
      let cast = [];
      let directors = [];
      if (type === 'tv') {
        const [c, a] = await Promise.all([
          tmdb('tv/' + id + '/credits', false),
          tmdb('tv/' + id + '/aggregate_credits', false)
        ]);
        const eps = (p) => p.total_episode_count || ((p.roles || [])[0] || {}).episode_count || 0;
        const regular = (c.cast || []).slice().sort((x, y) => order(x) - order(y)).slice(0, 32);
        const regIds = new Set(regular.map((p) => p.id));
        const agg = (a.cast || [])
          .filter((p) => !regIds.has(p.id))
          .filter((p) => eps(p) > 1 || (p.popularity || 0) >= 10)
          .sort((x, y) => (eps(y) - eps(x)) || ((y.popularity || 0) - (x.popularity || 0)));
        cast = regular.length ? [...regular, ...agg.slice(0, 20)].slice(0, 52) : agg.slice(0, 52);
        directors = (c.crew || []).filter((x) => x.job === 'Director');
        const allDirectors = [...directors, ...(a.crew || []).filter((x) => (x.jobs || []).some((j) => j.job === 'Director'))];
        if (!directors.length && !cast.length) directors = (a.crew || []).filter((x) => (x.jobs || []).some((j) => j.job === 'Director'));
        saveCands(key, [...(c.cast || []), ...(a.cast || [])].map((p) => 'person:' + p.id).concat(allDirectors.map((p) => 'person:' + p.id + ':d')));
      } else {
        const c = await tmdb('movie/' + id + '/credits', false);
        cast = (c.cast || []).slice().sort((x, y) => order(x) - order(y)).slice(0, 38);
        directors = (c.crew || []).filter((x) => x.job === 'Director');
        saveCands(key, (c.cast || []).map((p) => 'person:' + p.id).concat(directors.map((p) => 'person:' + p.id + ':d')));
      }
      // Same as the board: directors who are also cast show as cast.
      const castIds = new Set(cast.map((p) => p.id));
      const seen = new Set();
      for (const p of directors) {
        if (castIds.has(p.id) || seen.has(p.id)) continue;
        seen.add(p.id);
        out.push('person:' + p.id + ':d');
      }
      for (const p of cast) {
        if (seen.has(p.id)) continue;
        seen.add(p.id);
        out.push('person:' + p.id);
      }
    }

    save(key, out);
    return out;
  }

  // Superset of the nodes whose board lists `key` (see board()).
  async function candidates(key) {
    if (!candidateCache.has(key)) await neighbors(key);
    return candidateCache.get(key) || [];
  }

  // { neighbors, candidates } for a search that ends at endKey: reaching an end
  // person through either chip wins, and the end's own board (never played,
  // only searched backward from) is the union of both roles.
  function towards(endKey) {
    const asDirector = endKey + ':d';
    const isPerson = endKey.startsWith('person:');
    const both = async (fn) => [...new Set([...(await fn(endKey)), ...(await fn(asDirector))])];
    return {
      async neighbors(key) {
        if (key === endKey && isPerson) return both(neighbors);
        const out = await neighbors(key);
        return out.indexOf(asDirector) === -1 ? out : [...new Set(out.map((k) => (k === asDirector ? endKey : k)))];
      },
      async candidates(key) {
        return key === endKey && isPerson ? both(candidates) : candidates(key);
      }
    };
  }

  // Display name of a node (cached like the boards).
  async function name(key) {
    if (nameCache.has(key)) return nameCache.get(key);
    const [type, id] = key.split(':');
    const d = await tmdb(type + '/' + id);
    const n = d.title || d.name || key;
    nameCache.set(key, n);
    persist(namesFile, key, n);
    return n;
  }

  return { tmdb, neighbors, candidates, towards, name, verify, stats };
}

module.exports = { createGraph };
