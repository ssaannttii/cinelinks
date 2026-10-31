'use strict';
// Shared TMDB graph definition used by the offline scripts (compute-par,
// generate-challenges). Keeping a single neighbour definition guarantees the
// computed "par" and the generated challenges describe the SAME graph the game
// presents to players. Requires Node 18+ (global fetch).
const { filterPersonCredits } = require('../lib/credits');

function createGraph(apiKey, opts) {
  opts = opts || {};
  const tmdbCache = new Map();
  const neighborCache = new Map();

  async function tmdb(p) {
    if (tmdbCache.has(p)) return tmdbCache.get(p);
    const url = 'https://api.themoviedb.org/3/' + p + (p.includes('?') ? '&' : '?') + 'api_key=' + apiKey;
    for (let attempt = 0; attempt < 6; attempt++) {
      const res = await fetch(url);
      if (res.status === 429) {
        const wait = (parseInt(res.headers.get('retry-after') || '1', 10) || 1) * 1000;
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      // Bad/expired key -> fail loudly instead of silently returning no graph.
      if (res.status === 401) {
        throw new Error('TMDB rejected the API key (401). Pass a real key: TMDB_API_KEY=xxxxx');
      }
      const json = await res.json().catch(() => ({}));
      tmdbCache.set(p, json);
      return json;
    }
    tmdbCache.set(p, {});
    return {};
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

  // Neighbours of a "type:id" node as an array of neighbour keys, mirroring the
  // in-game connection rules (see below).
  async function neighbors(key) {
    if (neighborCache.has(key)) return neighborCache.get(key);
    const [type, idStr] = key.split(':');
    const id = Number(idStr);
    let out = [];

    // Mirror the board EXACTLY (index.html loadConnections + lib/credits.js). The
    // old rule (top-50 by votes, acting + directing, no talk/award filter) found
    // routes through talk shows, award telecasts and deep-cut credits that never
    // appear as options, so "best possible" was unreachable on many dailies.
    if (type === 'person') {
      const d = await tmdb('person/' + id + '/combined_credits');
      // The board shows acting credits, or directed works when you arrived via a
      // "Director" chip. The graph has no notion of how you arrived, so it takes
      // the union — only ever optimistic for actor-directors.
      const acted = filterPersonCredits(d, {});
      const directed = filterPersonCredits(d, { isDirector: true });
      const seen = new Set();
      for (const m of [...acted, ...directed]) {
        const k = m.type + ':' + m.id;
        if (!seen.has(k)) { seen.add(k); out.push(k); }
      }
    } else {
      const order = (p) => (Number.isFinite(p.order) ? p.order : 999);
      let cast = [];
      let directors = [];
      if (type === 'tv') {
        const [c, a] = await Promise.all([
          tmdb('tv/' + id + '/credits'),
          tmdb('tv/' + id + '/aggregate_credits')
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
        if (!directors.length && !cast.length) directors = (a.crew || []).filter((x) => (x.jobs || []).some((j) => j.job === 'Director'));
      } else {
        const c = await tmdb('movie/' + id + '/credits');
        cast = (c.cast || []).slice().sort((x, y) => order(x) - order(y)).slice(0, 38);
        directors = (c.crew || []).filter((x) => x.job === 'Director');
      }
      const seen = new Set();
      for (const p of [...directors, ...cast]) {
        if (seen.has(p.id)) continue;
        seen.add(p.id);
        out.push('person:' + p.id);
      }
    }

    neighborCache.set(key, out);
    return out;
  }

  // Nodes whose board shows `key`, as far as we can see from `key`'s own board:
  // the mutual edges. A subset of the true predecessors (a node can list `key`
  // without `key` listing it back), so par can only come out longer than the
  // real minimum — never a route the board doesn't offer.
  async function predecessors(key) {
    const out = [];
    for (const k of await neighbors(key)) {
      if ((await neighbors(k)).indexOf(key) !== -1) out.push(k);
    }
    return out;
  }

  return { tmdb, neighbors, predecessors, verify };
}

module.exports = { createGraph };
