// Pure helpers for turning a TMDB person `combined_credits` payload into the
// list of connectable movie/TV nodes shown in CineLinks. Kept framework-free so
// it can run both in the browser (as `window.CineCredits`) and in Node tests.
(function (root) {
  'use strict';

  // TV genres that are never useful as puzzle connections.
  var SKIP_TV_GENRES = [10767, 10763]; // talk show, news (documentaries are kept)
  // Award-show telecasts pollute filmographies — drop them (TV only).
  var AWARD_RE = /\b(oscars?|academy awards?|emmys?|golden globes?|grammys?|baftas?|sag awards?)\b|\bawards?\b/i;

  function year(m) {
    return (m.release_date || m.first_air_date || '').slice(0, 4) | 0;
  }

  function isUsableCredit(m) {
    if (!m || m.id == null) return false;
    if (m.media_type === 'movie') return true;
    if (m.media_type === 'tv') {
      if ((m.genre_ids || []).some(function (g) { return SKIP_TV_GENRES.indexOf(g) !== -1; })) return false;
      return !AWARD_RE.test(m.name || m.title || '');
    }
    return false;
  }

  // d: TMDB combined_credits response. opts.isDirector picks crew(Director)
  // instead of cast. opts.currentYear / opts.limit are injectable for tests.
  function filterPersonCredits(d, opts) {
    opts = opts || {};
    var isDirector = !!opts.isDirector;
    var currentYear = opts.currentYear || new Date().getFullYear();
    var limit = opts.limit || 30;

    var source = isDirector
      ? ((d && d.crew) || []).filter(function (c) { return c.job === 'Director'; })
      : ((d && d.cast) || []);

    var base = source.filter(isUsableCredit);

    var seen = Object.create(null);
    var unique = base.filter(function (m) {
      var k = m.media_type + '-' + m.id;
      if (seen[k]) return false;
      seen[k] = true;
      return true;
    });

    // Drop low-signal entries (duplicate/incomplete TMDB ids) unless very recent.
    var filtered = unique.filter(function (m) {
      var isRecent = year(m) >= currentYear - 1;
      return (m.vote_count || 0) > 20 || isRecent;
    });

    return filtered
      .sort(function (a, b) {
        var boostA = year(a) >= currentYear - 1 ? 2000 : 0;
        var boostB = year(b) >= currentYear - 1 ? 2000 : 0;
        return ((b.vote_count || 0) + boostB) - ((a.vote_count || 0) + boostA);
      })
      .slice(0, limit)
      .map(function (m) {
        var yr = (m.release_date || m.first_air_date || '').slice(0, 4);
        return {
          name: m.title || m.name,
          type: m.media_type === 'tv' ? 'tv' : 'movie',
          id: m.id,
          img: m.poster_path,
          yearLabel: yr,
          sub: yr + (m.media_type === 'tv' ? ' · TV' : '')
        };
      });
  }

  var api = { filterPersonCredits: filterPersonCredits, isUsableCredit: isUsableCredit, AWARD_RE: AWARD_RE };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CineCredits = api;
})(typeof window !== 'undefined' ? window : globalThis);
