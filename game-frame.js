// One frame for every game page. The nine games grew two different headers (a
// floating "← CineLinks" pill plus corner buttons, or an in-page topbar), so each
// felt like a separate site. This builds the same fixed bar on all of them:
// back to Today on the left, today's trio progress in the middle (dailies only),
// and on the right the controls the page already had (its Daily/Practice switch,
// sound, date badge, sign-in slot), moved in as they are, so their own code keeps
// working. Needs lib/trio.js for the trio dots; works without it.
(function () {
  'use strict';
  if (document.getElementById('gf')) return;
  var PAGE = { cineline: 'line', cinegroup: 'grp', cinechain: 'chain', cinecode: 'code', cinegrid: 'grid', cinereel: 'reel', cineclue: 'clue', cineframe: 'frame', cinecast: 'cast' };
  var mode = PAGE[String(location.pathname).replace(/^\//, '').replace(/\.html$/, '')];
  if (!mode) return;
  var practice = /[?&]practice=1/.test(location.search);
  var STR = {
    en: { today: 'Today', trio: 'Trio', privacy: 'Privacy', foot: 'This product uses the TMDB API and TMDB images, but is not endorsed or certified by TMDB.' },
    es: { today: 'Hoy', trio: 'Trío', privacy: 'Privacidad', foot: 'Este producto usa la API y las imágenes de TMDB, pero TMDB no lo respalda ni lo certifica.' },
    fr: { today: 'Aujourd’hui', trio: 'Trio', privacy: 'Confidentialité', foot: 'Ce produit utilise l’API et les images de TMDB, sans être approuvé ni certifié par TMDB.' },
    de: { today: 'Heute', trio: 'Trio', privacy: 'Datenschutz', foot: 'Dieses Produkt nutzt die TMDB-API und TMDB-Bilder, wird von TMDB aber weder unterstützt noch zertifiziert.' },
    pt: { today: 'Hoje', trio: 'Trio', privacy: 'Privacidade', foot: 'Este produto usa a API e as imagens do TMDB, mas não é endossado nem certificado pelo TMDB.' }
  };
  var lang = 'en'; try { lang = String(localStorage.getItem('clLang') || 'en').slice(0, 2); } catch (_) {}
  var S = STR[lang] || STR.en;

  var css = document.createElement('style'); css.id = 'gfCss';
  css.textContent =
    'body.gf{padding-top:calc(54px + env(safe-area-inset-top))}' +
    '#gf{position:fixed;top:0;left:0;right:0;z-index:60;height:calc(54px + env(safe-area-inset-top));padding:env(safe-area-inset-top) max(12px,env(safe-area-inset-right)) 0 max(12px,env(safe-area-inset-left));' +
      'display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:10px;font-family:"Schibsted Grotesk",system-ui,sans-serif;' +
      'background:rgba(12,11,13,.78);backdrop-filter:blur(16px) saturate(1.2);-webkit-backdrop-filter:blur(16px) saturate(1.2);border-bottom:1px solid rgba(246,221,134,.085)}' +
    '#gf .gf-l{display:flex;align-items:center;min-width:0}' +
    '#gf .gf-r{display:flex;align-items:center;justify-content:flex-end;gap:8px;min-width:0}' +
    '#gf .cl-home{position:static!important;display:inline-flex;align-items:center;gap:4px;height:36px;padding:0 12px 0 8px;border:0!important;border-radius:10px;background:rgba(255,255,255,.045)!important;' +
      'box-shadow:0 0 0 1px rgba(246,221,134,.14) inset;color:#f2ede4!important;font-size:.84rem!important;font-weight:600!important;text-decoration:none;backdrop-filter:none!important}' +
    '#gf .cl-home svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;color:#f6dd86}' +
    '#gf .gf-trio{display:inline-flex;align-items:center;gap:8px;height:30px;padding:0 12px;border-radius:9px;text-decoration:none;color:#a59f95;font-size:.7rem;font-weight:600;letter-spacing:.16em;text-transform:uppercase}' +
    '#gf .gf-trio i{width:8px;height:8px;border-radius:50%;box-shadow:0 0 0 1px rgba(246,221,134,.42) inset}' +
    '#gf .gf-trio i.on{background:linear-gradient(135deg,#f6dd86,#d9ab42 50%,#b9852a);box-shadow:none}' +
    '#gf .gf-trio i.me{box-shadow:0 0 0 1.5px #f6dd86 inset,0 0 0 4px rgba(246,221,134,.1)}' +
    '#gf .switch,#gf #modeSwitch{position:static!important;display:inline-flex;align-items:center;height:32px;padding:0 11px;border:0!important;border-radius:9px;background:rgba(255,255,255,.045)!important;box-shadow:0 0 0 1px rgba(246,221,134,.12) inset;color:#a59f95!important;font-size:.76rem!important;font-weight:600!important;backdrop-filter:none!important;white-space:nowrap}' +
    '#gf .snd{position:static!important;width:32px!important;height:32px!important;border:0!important;border-radius:9px!important;background:rgba(255,255,255,.045)!important;box-shadow:0 0 0 1px rgba(246,221,134,.12) inset;backdrop-filter:none!important}' +
    '#gf .topbar{margin:0!important;display:flex;align-items:center;gap:8px;justify-content:flex-end}' +
    '#gf .date-badge{display:none}' +
    'body.gf .wrap>.logo:first-child{margin-top:14px}' +
    '@media (max-width:420px){#gf .gf-trio b{display:none}#gf .gf-trio{padding:0 6px}}';
  document.head.appendChild(css);

  var bar = document.createElement('header'); bar.id = 'gf';
  bar.innerHTML = '<div class="gf-l"></div><div class="gf-c"></div><div class="gf-r"></div>';
  var L = bar.children[0], M = bar.children[1], R = bar.children[2];

  var home = document.querySelector('.cl-home');
  if (!home) { home = document.createElement('a'); home.href = '/'; home.className = 'cl-home'; }
  home.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 6-6 6 6 6"/></svg>' + S.today;
  home.setAttribute('aria-label', S.today);
  L.appendChild(home);

  // the page's own controls, moved as-is (their listeners come with them)
  var topbar = document.querySelector('.topbar');
  if (topbar) R.appendChild(topbar);
  else ['#modeSwitch', '#sndBtn'].forEach(function (sel) { var el = document.querySelector(sel); if (el) R.appendChild(el); });

  function trioDots() {
    if (practice || !window.Trio) { M.innerHTML = ''; return; }
    var slots = Trio.today(), mine = Trio.slotOf(mode, slots);
    if (mine < 0) { M.innerHTML = ''; return; }
    var done = slots.map(Trio.slotDone);
    M.innerHTML = '<a class="gf-trio" href="/" aria-label="' + S.trio + ' ' + done.filter(Boolean).length + '/3"><b>' + S.trio + '</b>' +
      done.map(function (d, i) { return '<i class="' + (d ? 'on' : i === mine ? 'me' : '') + '"></i>'; }).join('') + '</a>';
  }
  document.body.insertBefore(bar, document.body.firstChild);
  document.body.classList.add('gf');
  trioDots();
  // fill the slot's dot the moment this daily is finished
  var t = setInterval(function () { trioDots(); if (window.Trio && Trio.result(mode).done) clearInterval(t); }, 1500);
  window.addEventListener('load', trioDots);

  // one footer for all nine games: the TMDB mark, the sentence TMDB asks for, Privacy.
  // The pages used to write their own (five wordings, two class names); now none do.
  var foot = document.querySelector('.foot, .footer');
  if (foot) foot.innerHTML = '<a class="tmdb-mark" href="https://www.themoviedb.org/" target="_blank" rel="noopener">TMDB</a><span>' + S.foot + '</span> <span class="nw">· <a href="/privacy.html">' + S.privacy + '</a></span>';
})();
