// Home "cinema ambience": one TMDB call (movie/top_rated) powers a blurred
// backdrop behind the hub and a strip of posters by the rating games. Uses
// top-rated classics — NOT the daily answers — so nothing is spoiled. Lazy,
// cached for the session, and fully optional: any failure leaves the home as-is.
(function () {
  'use strict';
  var bd = document.getElementById('cineBackdrop');
  var strip = document.getElementById('ratingStrip');
  if (!bd && !strip) return;
  var IMG = 'https://image.tmdb.org/t/p/';

  function pick(list, n) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a.slice(0, n);
  }

  function paint(results) {
    if (!Array.isArray(results) || !results.length) return;
    if (bd) {
      var withBack = results.filter(function (m) { return m && m.backdrop_path; });
      var b = pick(withBack, 1)[0];
      if (b) {
        var img = new Image();
        img.onload = function () { bd.style.backgroundImage = 'url(' + IMG + 'w780' + b.backdrop_path + ')'; bd.classList.add('on'); };
        img.src = IMG + 'w780' + b.backdrop_path;
      }
    }
    if (strip) {
      var posters = pick(results.filter(function (m) { return m && m.poster_path; }), 7);
      strip.innerHTML = '';
      posters.forEach(function (m) {
        var im = document.createElement('img');
        im.alt = ''; im.loading = 'lazy';
        im.src = IMG + 'w185' + m.poster_path;
        im.onload = function () { im.classList.add('on'); };
        strip.appendChild(im);
      });
    }
  }

  var cached = null;
  try { cached = JSON.parse(sessionStorage.getItem('homeArt')); } catch (_) {}
  if (cached && cached.length) { paint(cached); return; }

  fetch('/api/tmdb?path=movie/top_rated')
    .then(function (r) { return r.json(); })
    .then(function (data) {
      var results = (data && data.results) || [];
      try { sessionStorage.setItem('homeArt', JSON.stringify(results.slice(0, 20))); } catch (_) {}
      paint(results);
    })
    .catch(function () {});
})();
