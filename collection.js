// CineLinks "collection" — the suite-wide retention meta-game, built in three
// decoupled layers so the card *look* can change (or be reset for debugging)
// without ever touching the engine or your saved data:
//
//   1. ENGINE   — storage, dedupe, rarity, XP/levels. Stable public API:
//        Collection.add(items) → newly-collected cards   (used by every game)
//        Collection.stats()    → { count, films, people, byRarity, xp, level, … }
//        Collection.all()      → array of collected cards
//        Collection.openGallery() / markSeen()
//   2. THEMES   — pluggable card skins. Add a new design later with ONE call,
//        no engine edits:
//        Collection.themes.register({ name, label, gridCols, css, card(c,ctx,i), mount(grid) })
//        Collection.themes.use('name')   list()   current()
//   3. DEBUG    — Collection.debug() (or ?ccdebug=1): switch theme, seed test
//        cards by rarity, grant XP/level, export/import JSON, reset.
//
// Local-first (one localStorage blob, no backend). Portable: a page only needs
// <script src="/collection.js">.
(function () {
  'use strict';
  var KEY = 'cl_collection';
  var THEME_KEY = 'cl_cardTheme';
  var SCHEMA = 1;
  var IMG = 'https://image.tmdb.org/t/p/w342';
  var XP = { common: 10, rare: 25, elite: 50, legendary: 100, dupe: 3 };
  var ORDER = { legendary: 0, elite: 1, rare: 2, common: 3 };
  var RARITY = {
    legendary: { label: 'Legendary', ring: '#e8c24a' },
    elite: { label: 'Elite', ring: '#b58ad6' },
    rare: { label: 'Rare', ring: '#7aa6e8' },
    common: { label: 'Common', ring: 'rgba(255,255,255,.22)' }
  };
  // Light "foil" highlight colour per rarity (paired with RARITY.ring for metal text).
  var METAL = { legendary: '#fff3c4', elite: '#f0e2ff', rare: '#dcebff', common: '#ffffff' };

  // ─────────────────────────────── helpers ───────────────────────────────
  function load() {
    var s; try { s = JSON.parse(localStorage.getItem(KEY)) || null; } catch (_) { return null; }
    if (s && (s.mv || 0) < 3) { migrate(s); save(s); }
    return s;
  }
  function blank() { return { v: SCHEMA, cards: {}, xp: 0, seen: 0 }; }
  function save(s) { try { s.v = SCHEMA; localStorage.setItem(KEY, JSON.stringify(s)); } catch (_) { /* noop */ } }
  function today() { return new Date().toISOString().slice(0, 10); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function posterUrl(p) { if (!p) return ''; return /^https?:/.test(p) ? p : IMG + p; }
  function typeLabel(c) { return c.type === 'person' ? 'Person' : c.type === 'tv' ? 'Series' : 'Film'; }
  function reducedMotion() { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) { return false; } }
  // Shared cursor-tracking 3D tilt + glare/foil shift (mouse only). Used by themes.
  function tiltMount(grid, sel, innerSel) {
    if (reducedMotion()) return;
    Array.prototype.forEach.call(grid.querySelectorAll(sel), function (card) {
      var inner = card.querySelector(innerSel); if (!inner) return;
      card.addEventListener('pointermove', function (e) {
        if (e.pointerType && e.pointerType !== 'mouse') return;
        var r = card.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        inner.style.transform = 'rotateY(' + ((px - 0.5) * 15).toFixed(2) + 'deg) rotateX(' + ((0.5 - py) * 19).toFixed(2) + 'deg)';
        inner.style.setProperty('--gx', (px * 100).toFixed(1) + '%');
        inner.style.setProperty('--gy', (py * 100).toFixed(1) + '%');
        inner.style.setProperty('--fx', (px * 200).toFixed(1) + '%');
        inner.style.setProperty('--fy', (py * 200).toFixed(1) + '%');
      });
      var reset = function () { inner.style.transform = ''; };
      card.addEventListener('pointerleave', reset);
      card.addEventListener('pointercancel', reset);
    });
  }
  // Deterministic per-card rarity when there's no rating (most game-collected
  // cards): a weighted hash of type:id so a collection has a natural spread and a
  // chase, instead of everything being "common". ~67% common / 22% rare / 8.5%
  // elite / 2.5% legendary.
  function hashRarity(id, type) {
    var s = String(type) + ':' + String(id), h = 0;
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    var r = h % 1000;
    return r < 25 ? 'legendary' : r < 110 ? 'elite' : r < 330 ? 'rare' : 'common';
  }
  function rarityOf(it) {
    if (it.rarity && RARITY[it.rarity]) return it.rarity;
    var r = it.rating;
    if (typeof r === 'number' && r > 0) return r >= 8.3 ? 'legendary' : r >= 7.8 ? 'elite' : r >= 7 ? 'rare' : 'common';
    return hashRarity(it.id, it.type);
  }
  // One-time re-tier of pre-existing cards (all stored as "common" before hash
  // rarity existed) so older collections gain variety too. Guarded by s.mv.
  function migrate(s) {
    if (!s || (s.mv || 0) >= 3) return;
    var cards = s.cards || {};
    // re-tier any card that somehow lacks a rarity (older blobs were all "common")
    Object.keys(cards).forEach(function (k) { var c = cards[k]; if (!c.rarity) c.rarity = rarityOf({ id: c.id, type: c.type }); });
    // assign stable collection numbers (#001…) in collected order to cards missing one
    var maxNo = 0; Object.keys(cards).forEach(function (k) { if (cards[k].no > maxNo) maxNo = cards[k].no; });
    Object.keys(cards).map(function (k) { return cards[k]; })
      .filter(function (c) { return !c.no; })
      .sort(function (a, b) { return (a.first || '').localeCompare(b.first || '') || (a.name || '').localeCompare(b.name || ''); })
      .forEach(function (c) { c.no = ++maxNo; });
    s.seq = Math.max(s.seq || 0, maxNo);
    s.mv = 3;
  }
  function xpForLevel(l) { return 50 * (l - 1) * (l - 1); }
  function levelFromXp(xp) { return Math.floor(Math.sqrt(Math.max(0, xp) / 50)) + 1; }

  // ─────────────────────────────── engine ────────────────────────────────
  function add(items) {
    if (!Array.isArray(items) || !items.length) return [];
    var s = load(); if (!s || !s.cards) s = blank();
    var added = [], d = today();
    items.forEach(function (it) {
      if (!it || it.id == null || !it.type) return;
      var k = it.type + ':' + it.id;
      if (s.cards[k]) {
        s.cards[k].n = (s.cards[k].n || 1) + 1;
        s.xp += XP.dupe;
      } else {
        var rar = rarityOf(it);
        s.cards[k] = { id: it.id, type: it.type, name: it.name || '', img: it.img || '', rarity: rar, n: 1, first: d, no: (s.seq = (s.seq || 0) + 1), isNew: 1 };
        s.xp += XP[rar] || 10;
        added.push(s.cards[k]);
      }
      s.seen = (s.seen || 0) + 1;
    });
    save(s);
    return added;
  }
  function allCards() { var s = load() || blank(); return Object.keys(s.cards || {}).map(function (k) { return s.cards[k]; }); }
  function stats() {
    var s = load() || blank();
    var cards = Object.keys(s.cards || {}).map(function (k) { return s.cards[k]; });
    var by = { common: 0, rare: 0, elite: 0, legendary: 0 };
    var films = 0, people = 0;
    cards.forEach(function (c) { by[c.rarity] = (by[c.rarity] || 0) + 1; if (c.type === 'person') people++; else films++; });
    var lvl = levelFromXp(s.xp || 0);
    return {
      count: cards.length, films: films, people: people, byRarity: by,
      xp: s.xp || 0, level: lvl,
      xpInto: (s.xp || 0) - xpForLevel(lvl), xpSpan: xpForLevel(lvl + 1) - xpForLevel(lvl),
      newCount: cards.filter(function (c) { return c.isNew; }).length
    };
  }
  function markSeen() {
    var s = load(); if (!s || !s.cards) return;
    Object.keys(s.cards).forEach(function (k) { if (s.cards[k].isNew) delete s.cards[k].isNew; });
    save(s);
  }

  // ─────────────────────────── admin / debug ops ─────────────────────────
  function reset() { try { localStorage.removeItem(KEY); } catch (_) { /* noop */ } refreshOpen(); }
  function grant(items) { var r = add(items); refreshOpen(); return r; }
  function addXp(n) { var s = load() || blank(); s.xp = Math.max(0, (s.xp || 0) + (+n || 0)); save(s); refreshOpen(); return s.xp; }
  function setLevel(l) { var s = load() || blank(); s.xp = xpForLevel(Math.max(1, +l || 1)); save(s); refreshOpen(); return levelFromXp(s.xp); }
  function markAllNew(on) { var s = load(); if (!s || !s.cards) return; Object.keys(s.cards).forEach(function (k) { if (on) s.cards[k].isNew = 1; else delete s.cards[k].isNew; }); save(s); refreshOpen(); }
  function exportData() { try { return localStorage.getItem(KEY) || JSON.stringify(blank()); } catch (_) { return JSON.stringify(blank()); } }
  function importData(str) {
    try {
      var o = JSON.parse(str);
      if (!o || typeof o !== 'object' || typeof o.cards !== 'object') return false;
      save(o); refreshOpen(); return true;
    } catch (_) { return false; }
  }
  // Real TMDB posters + forced rarities so foils/frames preview without playing.
  var SEED = [
    { id: 299534, type: 'movie', name: 'Avengers: Endgame', img: '/ulzhLuWrPK07P1YkdWQLZnQh1JL.jpg', rarity: 'legendary' },
    { id: 361743, type: 'movie', name: 'Top Gun: Maverick', img: '/n0YuM4f5lvGAP6MAW2kBIzugXnc.jpg', rarity: 'legendary' },
    { id: 19995, type: 'movie', name: 'Avatar', img: '/gKY6q7SjCkAU6FqvqWybDYgUKIF.jpg', rarity: 'elite' },
    { id: 597, type: 'movie', name: 'Titanic', img: '/9xjZS2rlVxm8SFx8kPC3aIGCOYQ.jpg', rarity: 'elite' },
    { id: 24428, type: 'movie', name: 'The Avengers', img: '/RYMX2wcKCBAr24UyPD7xwmjaTn.jpg', rarity: 'elite' },
    { id: 135397, type: 'movie', name: 'Jurassic World', img: '/rhr4y79GpxQF9IsfJItRXVaoGs4.jpg', rarity: 'rare' },
    { id: 420818, type: 'movie', name: 'The Lion King', img: '/dzBtMocZuJbjLOXvrl4zGYigDzh.jpg', rarity: 'rare' },
    { id: 330457, type: 'movie', name: 'Frozen II', img: '/mINJaa34MtknCYl5AjtNJzWj8cD.jpg', rarity: 'common' }
  ];

  // ─────────────────────────── theme registry ────────────────────────────
  var THEMES = {};
  var DEFAULT_THEME = 'authentic';
  function defineTheme(t) { if (t && t.name) THEMES[t.name] = t; return t; }
  function activeThemeName() {
    var n; try { n = localStorage.getItem(THEME_KEY); } catch (_) { n = null; }
    return (n && THEMES[n]) ? n : DEFAULT_THEME;
  }
  function activeTheme() { return THEMES[activeThemeName()] || THEMES[DEFAULT_THEME]; }
  function useTheme(name) {
    if (!THEMES[name]) return false;
    try { localStorage.setItem(THEME_KEY, name); } catch (_) { /* noop */ }
    // swap injected theme css + re-render if the gallery is open
    var t = THEMES[name];
    injectThemeCss(t);
    refreshOpen();
    return true;
  }
  function injectThemeCss(theme) {
    // remove any previously injected theme styles, then inject the active one
    Array.prototype.forEach.call(document.querySelectorAll('style[data-cl-theme]'), function (el) { el.remove(); });
    if (!theme || !theme.css) return;
    var s = document.createElement('style');
    s.setAttribute('data-cl-theme', theme.name);
    s.textContent = theme.css;
    document.head.appendChild(s);
  }
  var CTX = { RARITY: RARITY, posterUrl: posterUrl, esc: esc, typeLabel: typeLabel, IMG: IMG };

  // ── Built-in theme #1: AAA "trading" card (default) ──
  defineTheme({
    name: 'trading', label: 'Trading card',
    gridCols: 'minmax(118px,1fr)',
    css:
      '.ctc{position:relative;perspective:680px;animation:clCardIn .4s cubic-bezier(.2,.9,.3,1.2) both}' +
      '@keyframes clCardIn{from{opacity:0;transform:translateY(12px) scale(.93)}to{opacity:1;transform:none}}' +
      '.ctc-inner{position:relative;border-radius:13px;transition:transform .16s ease,box-shadow .2s ease;backface-visibility:hidden}' +
      '.ctc-frame{position:relative;border-radius:13px;padding:4px;box-shadow:0 6px 18px rgba(0,0,0,.5)}' +
      '.ctc-common .ctc-frame{background:linear-gradient(150deg,#46463f,#15140f)}' +
      '.ctc-rare .ctc-frame{background:linear-gradient(150deg,#6f93c8,#15233c)}' +
      '.ctc-elite .ctc-frame{background:linear-gradient(150deg,#a585c8,#251537)}' +
      '.ctc-legendary .ctc-frame{background:linear-gradient(150deg,#f7dd86,#7a5610);animation:ctcLeg 3.2s ease-in-out infinite}' +
      '@keyframes ctcLeg{0%,100%{box-shadow:0 6px 18px rgba(0,0,0,.5),0 0 0 0 rgba(232,194,74,0)}50%{box-shadow:0 6px 18px rgba(0,0,0,.5),0 0 24px rgba(232,194,74,.55)}}' +
      '.ctc-art{position:relative;border-radius:9px;overflow:hidden;aspect-ratio:5/7;background:#222}' +
      '.ctc-art>img,.ctc-noimg{width:100%;height:100%;object-fit:cover;display:block}' +
      '.ctc.person .ctc-art>img{object-position:center 16%}' +
      '.ctc-foil{position:absolute;inset:0;z-index:2;pointer-events:none;opacity:0;background-image:repeating-linear-gradient(110deg,rgba(255,119,115,.5) 0%,rgba(255,237,95,.5) 9%,rgba(168,255,95,.5) 18%,rgba(131,255,247,.5) 27%,rgba(120,148,255,.5) 36%,rgba(216,117,255,.5) 45%,rgba(255,119,115,.5) 54%);background-size:280% 280%;background-position:var(--fx,50%) var(--fy,50%);mix-blend-mode:color-dodge;filter:brightness(.82) contrast(1.2);transition:opacity .2s}' +
      '.ctc-common .ctc-foil{display:none}' +
      '.ctc-rare .ctc-foil{opacity:.3}.ctc-elite .ctc-foil{opacity:.44}' +
      '.ctc-legendary .ctc-foil{opacity:.52;animation:ctcDrift 7s linear infinite}' +
      '@keyframes ctcDrift{0%{background-position:0% 50%}100%{background-position:280% 50%}}' +
      '.ctc-glare{position:absolute;inset:0;z-index:3;pointer-events:none;opacity:0;background:radial-gradient(circle at var(--gx,50%) var(--gy,50%),rgba(255,255,255,.4),transparent 46%);mix-blend-mode:overlay;transition:opacity .2s}' +
      '.ctc-inner:hover .ctc-glare{opacity:1}' +
      '.ctc-common .ctc-inner:hover{box-shadow:0 14px 32px rgba(0,0,0,.55)}' +
      '.ctc-rare .ctc-inner:hover{box-shadow:0 14px 32px rgba(0,0,0,.55),0 0 22px rgba(122,166,232,.5)}' +
      '.ctc-elite .ctc-inner:hover{box-shadow:0 14px 32px rgba(0,0,0,.55),0 0 22px rgba(181,138,214,.55)}' +
      '.ctc-legendary .ctc-inner:hover{box-shadow:0 14px 32px rgba(0,0,0,.55),0 0 26px rgba(232,194,74,.6)}' +
      '.ctc-plate{position:absolute;left:0;right:0;bottom:0;z-index:4;padding:20px 9px 8px;background:linear-gradient(transparent,rgba(6,6,6,.55) 32%,rgba(6,6,6,.93))}' +
      '.ctc-plate::before{content:"";position:absolute;left:9px;right:9px;top:9px;height:1.5px;border-radius:2px;background:var(--cr);box-shadow:0 0 8px var(--cr)}' +
      '.ctc-name{font-size:.66rem;font-weight:800;color:#fff;line-height:1.18;text-shadow:0 1px 3px rgba(0,0,0,.85);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}' +
      '.ctc-type{font-size:.5rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--cr);margin-top:3px}' +
      '.ctc-gem{position:absolute;top:7px;left:7px;z-index:5;display:inline-flex;align-items:center;gap:4px;font-size:.46rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#fff;background:rgba(0,0,0,.45);border:1px solid var(--cr);border-radius:99px;padding:2px 7px 2px 5px}' +
      '.ctc-gem-d{width:7px;height:7px;border-radius:2px;transform:rotate(45deg);background:var(--cr);box-shadow:0 0 7px var(--cr)}' +
      '.ctc-new{position:absolute;top:7px;right:7px;z-index:5;font-size:.46rem;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:#06281a;background:#7fd49a;border-radius:5px;padding:2px 5px;box-shadow:0 2px 8px rgba(127,212,154,.4)}' +
      '.ctc-dupe{position:absolute;right:7px;bottom:7px;z-index:6;font-size:.54rem;font-weight:900;color:#1a1200;background:linear-gradient(135deg,#f5c542,#e8a000);border-radius:99px;padding:1px 7px;box-shadow:0 2px 8px rgba(0,0,0,.5)}' +
      '@media(prefers-reduced-motion:reduce){.ctc{animation:none}.ctc-legendary .ctc-frame,.ctc-legendary .ctc-foil{animation:none}.ctc-inner{transition:none}}',
    card: function (c, ctx, i) {
      var rar = ctx.RARITY[c.rarity] || ctx.RARITY.common;
      var p = ctx.posterUrl(c.img);
      var person = c.type === 'person';
      return '<div class="ctc ctc-' + c.rarity + (person ? ' person' : '') + '" style="--cr:' + rar.ring + ';animation-delay:' + Math.min(i, 16) * 22 + 'ms" title="' + ctx.esc(c.name) + ' · ' + rar.label + '">' +
        '<div class="ctc-inner"><div class="ctc-frame"><div class="ctc-art">' +
          (p ? '<img src="' + ctx.esc(p) + '" alt="" loading="lazy">' : '<div class="ctc-noimg"></div>') +
          '<div class="ctc-foil"></div><div class="ctc-glare"></div>' +
          '<div class="ctc-gem"><span class="ctc-gem-d"></span>' + rar.label + '</div>' +
          (c.isNew ? '<span class="ctc-new">New</span>' : '') +
          (c.n > 1 ? '<span class="ctc-dupe">×' + c.n + '</span>' : '') +
          '<div class="ctc-plate"><div class="ctc-name">' + ctx.esc(c.name) + '</div><div class="ctc-type">' + ctx.typeLabel(c) + '</div></div>' +
        '</div></div></div></div>';
    },
    mount: function (grid) { tiltMount(grid, '.ctc', '.ctc-inner'); }
  });

  // ── Built-in theme #2: "classic" simple poster tile (lightweight fallback) ──
  defineTheme({
    name: 'classic', label: 'Classic',
    gridCols: 'minmax(92px,1fr)',
    css:
      '.clc-card{position:relative;border-radius:9px;overflow:hidden;background:#222;border:2px solid var(--cr);animation:clCardIn .35s cubic-bezier(.2,.9,.3,1.2) both}' +
      '@keyframes clCardIn{from{opacity:0;transform:translateY(10px) scale(.94)}to{opacity:1;transform:none}}' +
      '.clc-card .clc-img{width:100%;aspect-ratio:2/3;object-fit:cover;display:block;background:#2a2a2a}' +
      '.clc-card.person .clc-img{aspect-ratio:1/1}' +
      '.clc-card .clc-name{font-size:.62rem;font-weight:700;color:#eee;padding:5px 6px;line-height:1.2;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}' +
      '.clc-card .clc-dupe{position:absolute;top:5px;right:5px;font-size:.55rem;font-weight:800;color:#1a1200;background:#e8a000;border-radius:99px;padding:1px 6px}' +
      '.clc-card .clc-new{position:absolute;top:5px;left:5px;font-size:.5rem;font-weight:800;letter-spacing:.05em;color:#1a1200;background:#7fd49a;border-radius:4px;padding:2px 5px;text-transform:uppercase}' +
      '@media(prefers-reduced-motion:reduce){.clc-card{animation:none}}',
    card: function (c, ctx) {
      var rar = ctx.RARITY[c.rarity] || ctx.RARITY.common;
      var p = ctx.posterUrl(c.img);
      var person = c.type === 'person';
      return '<div class="clc-card' + (person ? ' person' : '') + '" style="--cr:' + rar.ring + '" title="' + ctx.esc(c.name) + ' · ' + rar.label + '">' +
        (c.isNew ? '<span class="clc-new">New</span>' : '') +
        (c.n > 1 ? '<span class="clc-dupe">×' + c.n + '</span>' : '') +
        (p ? '<img class="clc-img" src="' + ctx.esc(p) + '" alt="" loading="lazy">' : '<div class="clc-img"></div>') +
        '<div class="clc-name">' + ctx.esc(c.name) + '</div></div>';
    }
  });

  // ── Built-in theme #3: "authentic" — premium licensed-card look (navy + foil) ──
  defineTheme({
    name: 'authentic', label: 'Authentic',
    gridCols: 'minmax(150px,1fr)',
    css:
      '.auth{position:relative;perspective:800px;animation:clCardIn .4s cubic-bezier(.2,.9,.3,1.2) both}' +
      '.auth-card{position:relative;container-type:inline-size;aspect-ratio:5/7;border-radius:13px;overflow:hidden;transition:transform .16s ease,box-shadow .2s ease;background:#0a1830;box-shadow:0 8px 22px rgba(0,0,0,.55);backface-visibility:hidden}' +
      '.auth-bgimg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center top;z-index:0}' +
      '.auth-noimg{position:absolute;inset:0;z-index:0;background:radial-gradient(120% 80% at 50% 0%,#17325e,#0a1830)}' +
      '.auth-scrim{position:absolute;inset:0;z-index:1;pointer-events:none;background:linear-gradient(180deg,rgba(6,11,22,.34),transparent 20%,transparent 56%,rgba(6,11,22,.74) 78%,rgba(4,9,18,.96))}' +
      '.auth-corner{position:absolute;top:0;left:0;width:30%;height:21%;z-index:3;background:linear-gradient(135deg,var(--m1),var(--cr) 58%,transparent 60%);clip-path:polygon(0 0,100% 0,0 100%);opacity:.95;pointer-events:none}' +
      '.auth-star{position:absolute;top:4.5%;left:4.5%;width:12%;aspect-ratio:1;z-index:4;background:conic-gradient(from 0deg,#ff9a9a,#fff39a,#9affb0,#9ad9ff,#c39aff,#ff9af0,#ff9a9a);clip-path:polygon(50% 0,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%);filter:drop-shadow(0 1px 3px rgba(0,0,0,.6));animation:authStar 9s linear infinite}' +
      '@keyframes authStar{to{filter:hue-rotate(360deg) drop-shadow(0 1px 3px rgba(0,0,0,.6))}}' +
      '@keyframes authDrift{0%{background-position:0% 50%}100%{background-position:280% 50%}}' +
      '.auth-tags{position:absolute;top:4.6cqw;right:4.6cqw;z-index:9;display:flex;gap:2.7cqw}' +
      '.auth-nw{font-size:4.6cqw;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:#06281a;background:#7fd49a;border-radius:3.3cqw;padding:1.3cqw 3.3cqw}' +
      '.auth-dp{font-size:5.3cqw;font-weight:900;color:#1a1200;background:linear-gradient(135deg,#f5c542,#e8a000);border-radius:99px;padding:.7cqw 4.6cqw}' +
      '.auth-text{position:absolute;left:0;right:0;bottom:0;z-index:5;padding:0 7.3cqw 6.7cqw;text-align:center}' +
      '.auth-name{font-weight:900;font-size:10.9cqw;line-height:1.02;letter-spacing:.01em;text-transform:uppercase;white-space:normal;max-height:2.05em;overflow:hidden;background:linear-gradient(180deg,var(--m1),var(--cr) 52%,var(--m1));-webkit-background-clip:text;background-clip:text;color:transparent;-webkit-text-fill-color:transparent;filter:drop-shadow(0 .7cqw 1.4cqw rgba(0,0,0,.9));margin-bottom:3.3cqw}' +
      '.auth-name--md{font-size:9cqw}.auth-name--sm{font-size:7.5cqw;letter-spacing:0}' +
      '.auth-meta{display:flex;align-items:center;justify-content:center;gap:4cqw;font-size:5.3cqw;font-weight:800;letter-spacing:.05em;text-transform:uppercase}' +
      '.auth-gem{width:4.7cqw;height:4.7cqw;flex-shrink:0;border-radius:1.3cqw;transform:rotate(45deg);background:var(--cr);box-shadow:0 0 4cqw var(--cr)}' +
      '.auth-rar{color:var(--cr)}' +
      '.auth-meta .sep{color:rgba(255,255,255,.32)}' +
      '.auth-no{color:rgba(255,255,255,.82);font-family:ui-monospace,Menlo,monospace;letter-spacing:.03em}' +
      '.auth-frame{position:absolute;inset:0;z-index:6;border-radius:13px;pointer-events:none;box-shadow:inset 0 0 0 .7cqw rgba(0,0,0,.55),inset 0 0 0 2cqw var(--cr),inset 0 0 0 2.7cqw rgba(0,0,0,.45)}' +
      '.auth-foil{position:absolute;inset:0;z-index:7;pointer-events:none;opacity:0;background:repeating-linear-gradient(115deg,rgba(255,119,115,.35),rgba(255,237,95,.35) 12%,rgba(131,255,247,.35) 24%,rgba(120,148,255,.35) 36%,rgba(216,117,255,.35) 48%,rgba(255,119,115,.35) 60%);background-size:260% 260%;background-position:var(--fx,50%) var(--fy,50%);mix-blend-mode:color-dodge;transition:opacity .2s}' +
      '.auth-rare .auth-foil{opacity:.14}.auth-elite .auth-foil{opacity:.2}.auth-legendary .auth-foil{opacity:.28;animation:authDrift 7s linear infinite}' +
      '.auth-glare{position:absolute;inset:0;z-index:8;pointer-events:none;opacity:0;background:radial-gradient(circle at var(--gx,50%) var(--gy,50%),rgba(255,255,255,.3),transparent 45%);mix-blend-mode:overlay;transition:opacity .2s}' +
      '.auth-card:hover .auth-glare{opacity:1}' +
      '.auth-common .auth-card:hover{box-shadow:0 16px 36px rgba(0,0,0,.6)}' +
      '.auth-rare .auth-card:hover{box-shadow:0 16px 36px rgba(0,0,0,.6),0 0 24px rgba(122,166,232,.5)}' +
      '.auth-elite .auth-card:hover{box-shadow:0 16px 36px rgba(0,0,0,.6),0 0 24px rgba(181,138,214,.55)}' +
      '.auth-legendary .auth-card:hover{box-shadow:0 16px 36px rgba(0,0,0,.6),0 0 28px rgba(232,194,74,.6)}' +
      '@media(prefers-reduced-motion:reduce){.auth{animation:none}.auth-star,.auth-legendary .auth-foil{animation:none}.auth-card{transition:none}}',
    card: function (c, ctx, i) {
      var rar = ctx.RARITY[c.rarity] || ctx.RARITY.common;
      var p = ctx.posterUrl(c.img);
      var person = c.type === 'person';
      var typeUp = person ? 'Actor' : (c.type === 'tv' ? 'Series' : 'Film');
      var no = '#' + ('00' + (c.no || 0)).slice(-3);
      var nlen = (c.name || '').length;
      var nmCls = nlen > 22 ? ' auth-name--sm' : nlen > 14 ? ' auth-name--md' : '';
      var nm = ctx.esc(c.name);
      return '<div class="auth auth-' + c.rarity + (person ? ' person' : '') + '" style="--cr:' + rar.ring + ';--m1:' + (METAL[c.rarity] || '#fff') + ';animation-delay:' + Math.min(i, 16) * 22 + 'ms" title="' + nm + ' · ' + rar.label + ' · ' + no + '">' +
        '<div class="auth-card">' +
          (p ? '<img class="auth-bgimg" src="' + ctx.esc(p) + '" alt="" loading="lazy">' : '<div class="auth-noimg"></div>') +
          '<div class="auth-scrim"></div><div class="auth-corner"></div><div class="auth-star"></div>' +
          '<div class="auth-tags">' + (c.n > 1 ? '<span class="auth-dp">×' + c.n + '</span>' : '') + (c.isNew ? '<span class="auth-nw">New</span>' : '') + '</div>' +
          '<div class="auth-text">' +
            '<div class="auth-name' + nmCls + '">' + nm + '</div>' +
            '<div class="auth-meta"><span class="auth-gem"></span><span class="auth-rar">' + rar.label + '</span><span class="sep">·</span><span>' + typeUp + '</span><span class="sep">·</span><span class="auth-no">' + no + '</span></div>' +
          '</div>' +
          '<div class="auth-frame"></div><div class="auth-foil"></div><div class="auth-glare"></div>' +
        '</div>' +
      '</div>';
    },
    mount: function (grid) { tiltMount(grid, '.auth', '.auth-card'); }
  });

  // ─────────────────────────── gallery shell ─────────────────────────────
  function injectShell() {
    if (document.getElementById('clCollStyles')) return;
    var css = document.createElement('style'); css.id = 'clCollStyles';
    css.textContent =
      '#clCollModal,#clCollDebug{position:fixed;inset:0;z-index:240;display:none;align-items:center;justify-content:center;padding:18px;background:rgba(0,0,0,.72);backdrop-filter:blur(6px)}' +
      '#clCollModal.open,#clCollDebug.open{display:flex}' +
      '.cl-coll-box{background:#161616;border:1px solid rgba(232,160,0,.22);border-radius:16px;width:100%;max-width:560px;max-height:86vh;display:flex;flex-direction:column;box-shadow:0 28px 80px rgba(0,0,0,.55);animation:clCollIn .28s cubic-bezier(.2,.9,.3,1.1) both}' +
      '@keyframes clCollIn{from{opacity:0;transform:translateY(14px) scale(.97)}to{opacity:1;transform:none}}' +
      '.cl-coll-hd{padding:18px 18px 12px;border-bottom:1px solid rgba(255,255,255,.08)}' +
      '.cl-coll-hd-top{display:flex;align-items:center;justify-content:space-between;gap:10px}' +
      '.cl-coll-title{font-size:1.1rem;font-weight:800;color:#f5f5f5}.cl-coll-title span{color:#e8a000}' +
      '.cl-coll-hd-btns{display:flex;align-items:center;gap:6px}' +
      '.cl-coll-icon{background:none;border:none;color:#888;font-size:1.1rem;cursor:pointer;line-height:1;padding:2px 6px}.cl-coll-icon:hover{color:#f5f5f5}' +
      '.cl-coll-x{background:none;border:none;color:#888;font-size:1.3rem;cursor:pointer;line-height:1;padding:2px 6px}.cl-coll-x:hover{color:#f5f5f5}' +
      '.cl-coll-lvl{display:flex;align-items:center;gap:10px;margin-top:12px}' +
      '.cl-coll-lvl-badge{flex-shrink:0;width:40px;height:40px;border-radius:50%;background:radial-gradient(circle,#e8a000,#a86f00);color:#1a1200;font-weight:900;font-size:1.05rem;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 14px rgba(232,160,0,.4)}' +
      '.cl-coll-xp{flex:1;min-width:0}' +
      '.cl-coll-xp-bar{height:7px;border-radius:99px;background:rgba(255,255,255,.1);overflow:hidden;margin-top:5px}' +
      '.cl-coll-xp-bar>i{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,#e8a000,#f5c542);transition:width .6s cubic-bezier(.3,.9,.3,1)}' +
      '.cl-coll-xp-l{display:flex;justify-content:space-between;font-size:.66rem;color:#9a9a9a;font-weight:700}' +
      '.cl-coll-counts{display:flex;gap:7px;flex-wrap:wrap;margin-top:13px}' +
      '.cl-coll-chip{font-size:.66rem;font-weight:800;letter-spacing:.03em;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.04);color:#cfcfcf;border-radius:99px;padding:5px 11px;cursor:pointer;text-transform:uppercase}' +
      '.cl-coll-chip.on{border-color:rgba(232,160,0,.6);background:rgba(232,160,0,.14);color:#e8a000}' +
      '.cl-coll-grid{padding:16px 16px 20px;overflow-y:auto;display:grid;gap:14px}' +
      '.cl-coll-empty{padding:40px 20px;text-align:center;color:#9a9a9a;font-size:.9rem;grid-column:1/-1}' +
      // debug panel
      '.cl-dbg{background:#141414;border:1px solid rgba(232,160,0,.3);border-radius:14px;width:100%;max-width:440px;max-height:86vh;overflow-y:auto;padding:16px;box-shadow:0 28px 80px rgba(0,0,0,.6);color:#e8e8e8;font-size:.82rem}' +
      '.cl-dbg h3{font-size:.95rem;font-weight:800;margin:0 0 4px;display:flex;justify-content:space-between;align-items:center}' +
      '.cl-dbg h3 span{color:#e8a000}' +
      '.cl-dbg section{border-top:1px solid rgba(255,255,255,.08);padding:12px 0 4px;margin-top:8px}' +
      '.cl-dbg .lbl{font-size:.62rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#9a9a9a;margin-bottom:8px}' +
      '.cl-dbg .row{display:flex;gap:7px;flex-wrap:wrap}' +
      '.cl-dbg button{font:inherit;font-size:.74rem;font-weight:700;cursor:pointer;border:1px solid var(--bdr,rgba(255,255,255,.18));background:rgba(255,255,255,.05);color:#e8e8e8;border-radius:8px;padding:7px 11px}' +
      '.cl-dbg button:hover{border-color:rgba(232,160,0,.5);color:#e8a000}' +
      '.cl-dbg button.on{border-color:#e8a000;background:rgba(232,160,0,.16);color:#e8a000}' +
      '.cl-dbg button.danger:hover{border-color:#e8806f;color:#e8806f}' +
      '.cl-dbg .stat{font-size:.7rem;color:#9a9a9a;margin-top:8px}.cl-dbg .stat b{color:#e8e8e8}' +
      '.cl-dbg textarea{width:100%;height:74px;margin-top:8px;background:#0d0d0d;color:#cfcfcf;border:1px solid rgba(255,255,255,.14);border-radius:8px;font-family:monospace;font-size:.66rem;padding:7px;resize:vertical}' +
      // card detail view
      '#clCollDetail{position:fixed;inset:0;z-index:250;display:none;align-items:center;justify-content:center;padding:18px;background:rgba(0,0,0,.82);backdrop-filter:blur(7px)}' +
      '#clCollDetail.open{display:flex;animation:clCollIn .26s cubic-bezier(.2,.9,.3,1.1) both}' +
      '.cl-detail-box{position:relative;display:flex;flex-direction:column;align-items:center;gap:18px;max-height:92vh;overflow:auto;padding:4px}' +
      '.cl-detail-stage{width:300px;height:420px;display:flex;align-items:center;justify-content:center;flex-shrink:0}' +
      '.cl-detail-card{width:300px;max-width:86vw}' +
      '.cl-detail-x{position:fixed;top:16px;right:18px;background:rgba(20,20,20,.65);border:1px solid rgba(255,255,255,.16);color:#ddd;font-size:1.1rem;cursor:pointer;border-radius:999px;width:38px;height:38px;line-height:1;z-index:1}' +
      '.cl-di{width:300px;max-width:90vw}' +
      '.cl-di-name{font-size:1.15rem;font-weight:800;color:#f5f5f5;text-align:center;margin-bottom:11px}' +
      '.cl-di-rows{display:flex;flex-direction:column;gap:1px;border-radius:11px;overflow:hidden;border:1px solid rgba(255,255,255,.09)}' +
      '.cl-di-row{display:flex;justify-content:space-between;padding:10px 14px;background:#181818;font-size:.84rem}' +
      '.cl-di-row span{color:#9a9a9a}.cl-di-row b{color:#f0f0f0;font-weight:700}';
    document.head.appendChild(css);
  }

  function buildModal() {
    var m = document.getElementById('clCollModal');
    if (m) return m;
    m = document.createElement('div'); m.id = 'clCollModal'; m.setAttribute('role', 'dialog');
    m.innerHTML =
      '<div class="cl-coll-box">' +
        '<div class="cl-coll-hd">' +
          '<div class="cl-coll-hd-top"><div class="cl-coll-title">Your <span>collection</span></div>' +
            '<div class="cl-coll-hd-btns" id="clCollHdBtns"><button class="cl-coll-x" aria-label="Close">&#10005;</button></div></div>' +
          '<div class="cl-coll-lvl"><div class="cl-coll-lvl-badge" id="clCollLvl">1</div>' +
            '<div class="cl-coll-xp"><div class="cl-coll-xp-l"><span id="clCollXpName">Level 1</span><span id="clCollXpNum"></span></div>' +
            '<div class="cl-coll-xp-bar"><i id="clCollXpFill" style="width:0%"></i></div></div></div>' +
          '<div class="cl-coll-counts" id="clCollChips"></div>' +
        '</div>' +
        '<div class="cl-coll-grid" id="clCollGrid"></div>' +
      '</div>';
    document.body.appendChild(m);
    m.querySelector('.cl-coll-x').addEventListener('click', close);
    m.addEventListener('click', function (e) { if (e.target === m) close(); });
    // optional debug gear (only when enabled)
    if (debugEnabled()) {
      var gear = document.createElement('button');
      gear.className = 'cl-coll-icon'; gear.innerHTML = '⚙'; gear.title = 'Debug';
      gear.addEventListener('click', debug);
      document.getElementById('clCollHdBtns').insertBefore(gear, m.querySelector('.cl-coll-x'));
    }
    return m;
  }

  var _filter = 'all';
  function isOpen() { var m = document.getElementById('clCollModal'); return m && m.classList.contains('open'); }
  function refreshOpen() { if (isOpen()) render(); if (document.getElementById('clCollDebug') && document.getElementById('clCollDebug').classList.contains('open')) renderDebug(); }

  function render() {
    var st = stats();
    document.getElementById('clCollLvl').textContent = st.level;
    document.getElementById('clCollXpName').textContent = 'Level ' + st.level;
    document.getElementById('clCollXpNum').textContent = st.xpInto + ' / ' + st.xpSpan + ' XP';
    document.getElementById('clCollXpFill').style.width = Math.max(3, Math.min(100, st.xpSpan ? (st.xpInto / st.xpSpan) * 100 : 0)) + '%';

    var chips = [
      { k: 'all', label: 'All ' + st.count }, { k: 'film', label: 'Films ' + st.films },
      { k: 'person', label: 'People ' + st.people }, { k: 'legendary', label: 'Legendary ' + st.byRarity.legendary },
      { k: 'elite', label: 'Elite ' + st.byRarity.elite }
    ];
    document.getElementById('clCollChips').innerHTML = chips.map(function (c) {
      return '<button class="cl-coll-chip' + (_filter === c.k ? ' on' : '') + '" data-k="' + c.k + '">' + esc(c.label) + '</button>';
    }).join('');
    Array.prototype.forEach.call(document.querySelectorAll('#clCollChips .cl-coll-chip'), function (b) {
      b.addEventListener('click', function () { _filter = b.dataset.k; render(); });
    });

    var cards = allCards().filter(function (c) {
      if (_filter === 'all') return true;
      if (_filter === 'film') return c.type !== 'person';
      if (_filter === 'person') return c.type === 'person';
      return c.rarity === _filter;
    }).sort(function (a, b) { return (ORDER[a.rarity] - ORDER[b.rarity]) || (a.name || '').localeCompare(b.name || ''); });

    var theme = activeTheme();
    injectThemeCss(theme);
    var grid = document.getElementById('clCollGrid');
    grid.style.gridTemplateColumns = 'repeat(auto-fill,' + (theme.gridCols || 'minmax(110px,1fr)') + ')';
    if (!cards.length) {
      grid.style.display = 'grid';
      grid.innerHTML = '<div class="cl-coll-empty">No cards yet — play a game to start collecting films, shows and people.</div>';
      return;
    }
    grid.style.display = 'grid';
    grid.innerHTML = cards.map(function (c, i) { return theme.card(c, CTX, i); }).join('');
    try { if (theme.mount) theme.mount(grid); } catch (_) { /* noop */ }
    Array.prototype.forEach.call(grid.children, function (el, idx) {
      el.style.cursor = 'pointer';
      el.addEventListener('click', function () { openDetail(cards[idx]); });
    });
  }

  function openGallery() {
    injectShell(); buildModal(); injectThemeCss(activeTheme());
    _filter = 'all'; render();
    document.getElementById('clCollModal').classList.add('open');
    try { if (window.Track) window.Track('collection_open', stats()); } catch (_) { /* noop */ }
    setTimeout(markSeen, 600);
  }
  function close() { var m = document.getElementById('clCollModal'); if (m) m.classList.remove('open'); }

  // ─────────────────────────────── debug panel ───────────────────────────
  function debugEnabled() {
    try { if (localStorage.getItem('cl_debug') === '1') return true; } catch (_) { /* noop */ }
    try { return /[?&]ccdebug=1\b/.test(location.search); } catch (_) { return false; }
  }
  function buildDebug() {
    var d = document.getElementById('clCollDebug');
    if (d) return d;
    injectShell();
    d = document.createElement('div'); d.id = 'clCollDebug'; d.setAttribute('role', 'dialog');
    d.innerHTML = '<div class="cl-dbg" id="clDbgBox"></div>';
    document.body.appendChild(d);
    d.addEventListener('click', function (e) { if (e.target === d) d.classList.remove('open'); });
    return d;
  }
  function renderDebug() {
    var st = stats();
    var themeButtons = Object.keys(THEMES).map(function (n) {
      return '<button data-theme="' + n + '" class="' + (activeThemeName() === n ? 'on' : '') + '">' + esc(THEMES[n].label || n) + '</button>';
    }).join('');
    document.getElementById('clDbgBox').innerHTML =
      '<h3>Collection <span>debug</span><button class="cl-coll-x" id="clDbgClose" style="font-size:1.2rem">&#10005;</button></h3>' +
      '<div class="stat">Level <b>' + st.level + '</b> · <b>' + st.count + '</b> cards (' + st.films + ' films / ' + st.people + ' people) · <b>' + st.xp + '</b> XP · L' + st.byRarity.legendary + ' E' + st.byRarity.elite + ' R' + st.byRarity.rare + ' C' + st.byRarity.common + '</div>' +
      '<section><div class="lbl">Card theme</div><div class="row" id="clDbgThemes">' + themeButtons + '</div></section>' +
      '<section><div class="lbl">Seed test cards</div><div class="row">' +
        '<button data-act="seed">Grant sample set</button><button data-act="seedNew">Mark all new</button><button data-act="clearNew">Clear new</button></div></section>' +
      '<section><div class="lbl">Progress</div><div class="row">' +
        '<button data-act="xp100">+100 XP</button><button data-act="lvlup">+1 level</button><button data-act="lvlset">Set level…</button></div></section>' +
      '<section><div class="lbl">Data</div><div class="row">' +
        '<button data-act="export">Export</button><button data-act="import">Import ↑</button><button data-act="reset" class="danger">Reset all</button></div>' +
        '<textarea id="clDbgData" placeholder="Collection JSON (Export fills this; paste + Import to restore)"></textarea></div></section>';
    var box = document.getElementById('clDbgBox');
    box.querySelector('#clDbgClose').addEventListener('click', function () { document.getElementById('clCollDebug').classList.remove('open'); });
    Array.prototype.forEach.call(box.querySelectorAll('#clDbgThemes button'), function (b) {
      b.addEventListener('click', function () { useTheme(b.dataset.theme); renderDebug(); });
    });
    Array.prototype.forEach.call(box.querySelectorAll('[data-act]'), function (b) {
      b.addEventListener('click', function () { debugAction(b.dataset.act); });
    });
  }
  function debugAction(act) {
    var ta = document.getElementById('clDbgData');
    if (act === 'seed') grant(SEED.map(function (s) { return s; }));
    else if (act === 'seedNew') markAllNew(true);
    else if (act === 'clearNew') markAllNew(false);
    else if (act === 'xp100') addXp(100);
    else if (act === 'lvlup') setLevel(stats().level + 1);
    else if (act === 'lvlset') { var v = window.prompt('Set level to:', String(stats().level)); if (v != null) setLevel(parseInt(v, 10) || 1); }
    else if (act === 'export') { if (ta) { ta.value = exportData(); ta.select(); try { navigator.clipboard && navigator.clipboard.writeText(ta.value); } catch (_) { /* noop */ } } }
    else if (act === 'import') { if (ta && ta.value.trim()) { if (!importData(ta.value.trim())) window.alert('Invalid collection JSON.'); } }
    else if (act === 'reset') { if (window.confirm('Reset your whole collection? This cannot be undone.')) reset(); }
    renderDebug();
  }
  function debug() {
    buildDebug();
    renderDebug();
    document.getElementById('clCollDebug').classList.add('open');
  }

  // ── Card detail view (click a card → large, legible, with full info) ──
  function buildDetail() {
    var d = document.getElementById('clCollDetail');
    if (d) return d;
    injectShell();
    d = document.createElement('div'); d.id = 'clCollDetail'; d.setAttribute('role', 'dialog');
    d.innerHTML = '<button class="cl-detail-x" aria-label="Close">&#10005;</button>' +
      '<div class="cl-detail-box"><div class="cl-detail-stage"><div class="cl-detail-card" id="clDetailCard"></div></div>' +
      '<div class="cl-di" id="clDetailInfo"></div></div>';
    document.body.appendChild(d);
    d.querySelector('.cl-detail-x').addEventListener('click', closeDetail);
    d.addEventListener('click', function (e) { if (e.target === d) closeDetail(); });
    return d;
  }
  function detailInfo(c) {
    var rar = RARITY[c.rarity] || RARITY.common;
    var dt = null; try { dt = c.first ? new Date(c.first + 'T00:00:00') : null; } catch (_) { dt = null; }
    var dateStr = (dt && !isNaN(dt.getTime())) ? dt.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
    var rows = [
      ['Rarity', rar.label, rar.ring],
      ['Type', typeLabel(c), ''],
      ['Number', '#' + ('00' + (c.no || 0)).slice(-3), ''],
      ['Collected', dateStr, ''],
      ['Copies', '×' + (c.n || 1), '']
    ];
    return '<div class="cl-di-name">' + esc(c.name) + '</div><div class="cl-di-rows">' +
      rows.map(function (r) { return '<div class="cl-di-row"><span>' + r[0] + '</span><b' + (r[2] ? ' style="color:' + r[2] + '"' : '') + '>' + esc(r[1]) + '</b></div>'; }).join('') +
      '</div>';
  }
  function openDetail(c) {
    if (!c) return;
    buildDetail();
    var theme = activeTheme(); injectThemeCss(theme);
    var holder = document.getElementById('clDetailCard');
    holder.innerHTML = theme.card(c, CTX, 0);
    // the card renders at 2× here — pull a higher-res TMDB poster so it stays crisp
    Array.prototype.forEach.call(holder.querySelectorAll('img'), function (im) { im.src = im.src.replace(/\/t\/p\/w\d+\//, '/t/p/w780/'); });
    try { if (theme.mount) theme.mount(holder); } catch (_) { /* noop */ }
    document.getElementById('clDetailInfo').innerHTML = detailInfo(c);
    document.getElementById('clCollDetail').classList.add('open');
    try { if (window.Track) window.Track('collection_card', { rarity: c.rarity, type: c.type }); } catch (_) { /* noop */ }
  }
  function closeDetail() { var d = document.getElementById('clCollDetail'); if (d) d.classList.remove('open'); }

  // expose + init
  window.Collection = {
    add: add, stats: stats, all: allCards, openGallery: openGallery, markSeen: markSeen,
    reset: reset, grant: grant, addXp: addXp, setLevel: setLevel, exportData: exportData, importData: importData, seed: function () { return grant(SEED.map(function (s) { return s; })); },
    debug: debug,
    themes: { register: defineTheme, use: useTheme, list: function () { return Object.keys(THEMES).map(function (n) { return { name: n, label: THEMES[n].label || n }; }); }, current: activeThemeName }
  };
  if (debugEnabled()) { try { window.addEventListener('load', function () { try { debug(); } catch (_) { /* noop */ } }); } catch (_) { /* noop */ } }
})();
