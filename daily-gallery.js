// "Today's films — revealed": once you've finished ALL of today's daily puzzles,
// the home shows the posters of the films/series you uncovered. Reads each game's
// locally-stored answer (persisted only after you finish, so nothing is spoiled
// before you play). Exposed as window.renderDailyGallery so the SPA home can
// refresh it too.
(function () {
  'use strict';
  function getLS(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (_) { return null; } }
  function madridToday() { try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date()); } catch (_) { return new Date().toISOString().slice(0, 10); } }
  function utcDay() { var n = new Date(); return Math.floor(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()) / 86400000); }
  function posterUrl(p) { if (!p) return ''; return /^https?:/.test(p) ? p : 'https://image.tmdb.org/t/p/w185' + p; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }

  function render() {
    var host = document.getElementById('dailyGallery');
    if (!host) return;
    var today = madridToday(), ud = utcDay();
    var clR = getLS('clDailyResult');
    var clPlayed = getLS('clPlayed') || {};
    var clDone = (clPlayed[today] != null) || (clR && clR.date === today);

    function clueDone(k) { var s = getLS(k); return !!(s && s.day === ud && s.finished); }
    function answerOf(k, label) { var s = getLS(k); return (s && s.day === ud && s.finished && s.answer) ? { title: s.answer.title, poster: s.answer.poster, label: label } : null; }

    var games = [
      { done: clDone, tile: (clR && clR.date === today && clR.end) ? { title: clR.end.name, poster: clR.end.img, label: 'CineLinks' } : null },
      { done: clueDone('cineclueState'), tile: answerOf('cineclueState', 'CineClue') },
      { done: clueDone('cineframeState'), tile: answerOf('cineframeState', 'CineFrame') },
      { done: clueDone('cinecastState'), tile: answerOf('cinecastState', 'CineCast') },
      { done: clueDone('cineplotState'), tile: answerOf('cineplotState', 'CinePlot') }
    ];

    var allDone = games.every(function (g) { return g.done; });
    var tiles = games.map(function (g) { return g.tile; }).filter(Boolean);
    if (!allDone || !tiles.length) { host.style.display = 'none'; host.innerHTML = ''; return; }

    host.style.display = 'block';
    host.innerHTML =
      '<div class="dg-title">' + (typeof window.t === 'function' ? window.t('galleryTitle') : '🎬 Today’s answers — revealed') + '</div>' +
      '<div class="dg-grid">' + tiles.map(function (t) {
        var p = posterUrl(t.poster);
        return '<div class="dg-item">' +
          (p ? '<img src="' + p + '" alt="" loading="lazy">' : '<div class="dg-ph"></div>') +
          '<span class="dg-name">' + esc(t.title) + '</span>' +
          '<span class="dg-lbl">' + esc(t.label) + '</span>' +
        '</div>';
      }).join('') + '</div>';
  }

  window.renderDailyGallery = render;
  render();
})();
