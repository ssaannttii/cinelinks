// Home "cinema ambience": one TMDB call powers a soft, blurred backdrop behind
// the hub. Pulls a RANDOM page of top-rated classics (not the daily answers, so
// nothing is spoiled) for variety. Lazy, session-cached, fully optional: any
// failure just leaves the home as-is.
(function () {
  'use strict';
  var bd = document.getElementById('cineBackdrop');
  if (!bd) return;
  var IMG = 'https://image.tmdb.org/t/p/';

  function paint(results) {
    if (!Array.isArray(results)) return;
    var withBack = results.filter(function (m) { return m && m.backdrop_path; });
    if (!withBack.length) return;
    var b = withBack[Math.floor(Math.random() * withBack.length)];
    var img = new Image();
    img.onload = function () { bd.style.backgroundImage = 'url(' + IMG + 'w780' + b.backdrop_path + ')'; bd.classList.add('on'); };
    img.src = IMG + 'w780' + b.backdrop_path;
  }

  var cached = null;
  try { cached = JSON.parse(sessionStorage.getItem('homeArt')); } catch (_) {}
  if (cached && cached.length) { paint(cached); return; }

  var page = 1 + Math.floor(Math.random() * 15); // top_rated has hundreds of pages
  fetch('/api/tmdb?path=movie/top_rated&page=' + page)
    .then(function (r) { return r.json(); })
    .then(function (data) {
      var results = (data && data.results) || [];
      try { sessionStorage.setItem('homeArt', JSON.stringify(results.slice(0, 20))); } catch (_) {}
      paint(results);
    })
    .catch(function () {});
})();
