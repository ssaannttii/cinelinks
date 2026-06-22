'use strict';
// Shared TMDB graph definition used by the offline scripts (compute-par,
// generate-challenges). Keeping a single neighbour definition guarantees the
// computed "par" and the generated challenges describe the SAME graph the game
// presents to players. Requires Node 18+ (global fetch).

function createGraph(apiKey, opts) {
  opts = opts || {};
  const BRANCH = opts.branch || 50;
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
  // in-game connection rules and capped to the top BRANCH by relevance.
  async function neighbors(key) {
    if (neighborCache.has(key)) return neighborCache.get(key);
    const [type, idStr] = key.split(':');
    const id = Number(idStr);
    let out = [];

    if (type === 'person') {
      const d = await tmdb('person/' + id + '/combined_credits');
      const cast = d.cast || [];
      const directed = (d.crew || []).filter((c) => c.job === 'Director');
      const seen = new Set();
      const items = [];
      for (const m of [...cast, ...directed]) {
        if (m.media_type !== 'movie' && m.media_type !== 'tv') continue;
        const k = m.media_type + ':' + m.id;
        if (seen.has(k)) continue;
        seen.add(k);
        items.push({ k, score: m.vote_count || 0 });
      }
      out = items.sort((a, b) => b.score - a.score).slice(0, BRANCH).map((x) => x.k);
    } else {
      let cast = [];
      let crew = [];
      if (type === 'tv') {
        const [c, a] = await Promise.all([
          tmdb('tv/' + id + '/credits'),
          tmdb('tv/' + id + '/aggregate_credits')
        ]);
        cast = (c.cast && c.cast.length ? c.cast : a.cast) || [];
        crew = (c.crew || []).filter((x) => x.job === 'Director');
      } else {
        const c = await tmdb('movie/' + id + '/credits');
        cast = c.cast || [];
        crew = (c.crew || []).filter((x) => x.job === 'Director');
      }
      const seen = new Set();
      const items = [];
      for (const p of [...crew, ...cast]) {
        if (seen.has(p.id)) continue;
        seen.add(p.id);
        const order = Number.isFinite(p.order) ? p.order : 999;
        items.push({ k: 'person:' + p.id, score: 10000 - order + (p.popularity || 0) });
      }
      out = items.sort((a, b) => b.score - a.score).slice(0, BRANCH).map((x) => x.k);
    }

    neighborCache.set(key, out);
    return out;
  }

  return { tmdb, neighbors, verify };
}

module.exports = { createGraph };
