// "Infinite practice pool": builds TMDB Discover query paths that return
// RECOGNISABLE titles (gated by vote_count, the same quality bar the curated
// fixed pools use). Daily puzzles keep their fixed, deterministic pools; only
// Practice taps this so it never runs out of fresh, well-known films.
//
// Paths are returned in the `api()` shape ("discover/movie&param=value&…") and
// only ever use read-only filters the /api/tmdb allowlist permits.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Pool = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function discoverMovie(opts) {
    opts = opts || {};
    var p = ['discover/movie&sort_by=' + (opts.sort || 'vote_count.desc'),
      'include_adult=false',
      'vote_count.gte=' + (opts.minVotes || 700),
      'page=' + (opts.page || 1)];
    if (opts.from) p.push('primary_release_date.gte=' + opts.from + '-01-01');
    if (opts.to) p.push('primary_release_date.lte=' + opts.to + '-12-31');
    return p.join('&');
  }

  function discoverTv(opts) {
    opts = opts || {};
    var p = ['discover/tv&sort_by=' + (opts.sort || 'vote_count.desc'),
      'include_adult=false',
      'vote_count.gte=' + (opts.minVotes || 250),
      'page=' + (opts.page || 1)];
    if (opts.from) p.push('first_air_date.gte=' + opts.from + '-01-01');
    if (opts.to) p.push('first_air_date.lte=' + opts.to + '-12-31');
    return p.join('&');
  }

  function randInt(n) { return 1 + Math.floor(Math.random() * Math.max(1, n)); }

  // A random page of the most-voted (recognisable) films/shows — endless variety.
  function practiceMovie() { return discoverMovie({ minVotes: 700, page: randInt(40) }); }
  function practiceTv() { return discoverTv({ minVotes: 250, page: randInt(20) }); }

  // For CineLine: the top-voted films of one decade (keeps the timeline spread
  // across cinema history, matching the curated pool's year balance).
  var DECADES = [1930, 1940, 1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020];
  function decadeMovie(start) { return discoverMovie({ from: start, to: start + 9, minVotes: 400, page: randInt(3) }); }

  // ── Automatic freshness: a deterministic slice of RECENT, well-known films
  // (last ~2 years, ordered by vote_count — stable enough that every player gets
  // the same set on a given UTC day). Cached per day. Blend a couple of these into
  // the front of a mode's daily candidates so ~1 in 3 dailies leads with a current
  // hit, with the fixed curated pool as the guaranteed fallback. No rebuild needed.
  function recentDaily(base, k, apiFn) {
    if (typeof apiFn !== 'function') return Promise.resolve([]);
    var day = Math.floor(Date.now() / 864e5);
    var key = 'cl_recent_' + day, cached = null;
    try { var c = localStorage.getItem(key); if (c) cached = JSON.parse(c); } catch { /* noop */ }
    var pick = function (ids) {
      if (!ids || !ids.length) return [];
      var out = []; for (var i = 0; i < k; i++) out.push({ type: 'movie', id: ids[(((base + i) % ids.length) + ids.length) % ids.length] });
      return out;
    };
    if (cached) return Promise.resolve(pick(cached));
    var yr = new Date().getUTCFullYear();
    var path = discoverMovie({ from: yr - 2, to: yr, minVotes: 900, sort: 'vote_count.desc', page: 1 });
    return apiFn(path).then(function (data) {
      var ids = ((data && data.results) || []).slice(0, 20).map(function (m) { return m.id; });
      if (ids.length) { try { localStorage.setItem(key, JSON.stringify(ids)); } catch { /* noop */ } }
      return pick(ids);
    }).catch(function () { return []; });
  }

  return {
    discoverMovie: discoverMovie, discoverTv: discoverTv, randInt: randInt,
    practiceMovie: practiceMovie, practiceTv: practiceTv, decadeMovie: decadeMovie, DECADES: DECADES,
    recentDaily: recentDaily
  };
}));
