// Media helpers shared by CineClue & CineFrame so both can handle movies AND TV
// series. A pool entry is either a movie id (number) or a TV id tagged "tv:12345"
// (or an object {id, type}). These helpers normalise the differences between the
// TMDB movie and tv shapes (title vs name, release_date vs first_air_date, etc.).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Media = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function parseEntry(e) {
    if (e && typeof e === 'object') return { type: e.type === 'tv' ? 'tv' : 'movie', id: +e.id };
    if (typeof e === 'string') {
      var m = e.match(/^tv:(\d+)$/i);
      if (m) return { type: 'tv', id: +m[1] };
      return { type: 'movie', id: +e };
    }
    return { type: 'movie', id: +e };
  }

  function title(d, type) {
    if (!d) return '';
    return type === 'tv' ? (d.name || d.original_name || '') : (d.title || d.original_title || '');
  }
  function year(d, type) {
    if (!d) return '';
    return ((type === 'tv' ? d.first_air_date : d.release_date) || '').slice(0, 4);
  }
  // movie: runtime in minutes; tv: season count (more meaningful than ep length).
  function lengthLabel(d, type) {
    if (!d) return '';
    if (type === 'tv') return d.number_of_seasons ? d.number_of_seasons + (d.number_of_seasons === 1 ? ' season' : ' seasons') : '';
    return d.runtime ? d.runtime + ' min' : '';
  }
  // movie: Director (from crew); tv: Creator(s) (from created_by).
  function makers(d, credits, type) {
    if (type === 'tv') return (d && d.created_by || []).map(function (c) { return c.name; }).filter(Boolean).slice(0, 2);
    return ((credits && credits.crew || []).filter(function (c) { return c.job === 'Director'; }).map(function (c) { return c.name; })).slice(0, 2);
  }
  function makerLabel(type) { return type === 'tv' ? 'Creator' : 'Director'; }
  function mediumLabel(type) { return type === 'tv' ? 'TV series' : 'Movie'; }

  function detailPath(type, id) { return (type === 'tv' ? 'tv/' : 'movie/') + id; }
  function keywordsPath(type, id) { return detailPath(type, id) + '/keywords'; }
  function creditsPath(type, id) { return detailPath(type, id) + (type === 'tv' ? '/aggregate_credits' : '/credits'); }
  function imagesPath(type, id) { return detailPath(type, id) + '/images'; }

  // Map one search/multi result to a guess item, or null if it's not a film/show.
  function searchMap(r) {
    if (!r) return null;
    if (r.media_type === 'tv' && (r.name || r.original_name)) {
      return { id: r.id, type: 'tv', title: r.name || r.original_name, year: (r.first_air_date || '').slice(0, 4), poster: r.poster_path };
    }
    if (r.media_type === 'movie' && (r.title || r.original_title)) {
      return { id: r.id, type: 'movie', title: r.title || r.original_title, year: (r.release_date || '').slice(0, 4), poster: r.poster_path };
    }
    return null;
  }

  // Same film? compare id AND type (a movie and a show can share an id).
  function sameTarget(a, b) {
    return a && b && a.id === b.id && (a.type || 'movie') === (b.type || 'movie');
  }

  return {
    parseEntry: parseEntry, title: title, year: year, lengthLabel: lengthLabel,
    makers: makers, makerLabel: makerLabel, mediumLabel: mediumLabel,
    detailPath: detailPath, keywordsPath: keywordsPath, creditsPath: creditsPath, imagesPath: imagesPath,
    searchMap: searchMap, sameTarget: sameTarget
  };
}));
