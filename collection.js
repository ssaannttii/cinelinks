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
  // Duplicates economy: a dupe yields "dust" (by the dupe's rarity); dust is spent
  // to "Shine" an owned card — a permanent holographic foil. Purely cosmetic: it
  // never changes a card's rarity, number, or stats, so the rarity economy stays honest.
  var DUST = { common: 5, rare: 15, elite: 40, legendary: 100 };
  var SHINE_COST = { common: 40, rare: 80, elite: 160, legendary: 320 };
  var _pendingDust = 0; // dust earned since the last reveal summary (for the "+N dust" line)
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
  // Real fake-3D tilt: a per-element perspective rotation plus a "lift", with
  // cursor-following CSS vars that drive layered parallax (bg recedes, frame/text/
  // star pop forward) and a specular glare — so the card tilts in space instead of
  // the photo spinning flat on its axis. The motion runs on a SPRING (stiffness +
  // damping) so it has weight: it accelerates toward the cursor and overshoots back
  // to rest on leave, the way a real object would. Only the hovered card animates;
  // the loop stops itself once settled, so a big grid stays cheap.
  function tiltMount(grid, sel, innerSel) {
    if (reducedMotion()) return;
    Array.prototype.forEach.call(grid.querySelectorAll(sel), function (card) {
      var inner = card.querySelector(innerSel); if (!inner) return;
      var raf = 0, active = false;
      var rx = 0, ry = 0, sc = 1, px = 0.5, py = 0.5;            // current
      var vx = 0, vy = 0, vs = 0;                                 // velocity
      var trx = 0, try_ = 0, tsc = 1, tpx = 0.5, tpy = 0.5;       // target
      var STIFF = 0.18, DAMP = 0.8;
      // hard caps so the spring's overshoot can never push the card past the safe
      // envelope its container reserves — otherwise a corner of the card clips.
      function cap(v, m) { return v > m ? m : v < -m ? -m : v; }
      function frame() {
        vx = (vx + (trx - rx) * STIFF) * DAMP; rx += vx;
        vy = (vy + (try_ - ry) * STIFF) * DAMP; ry += vy;
        vs = (vs + (tsc - sc) * STIFF) * DAMP; sc += vs;
        px += (tpx - px) * 0.22; py += (tpy - py) * 0.22;
        var scc = sc > 1.02 ? 1.02 : sc;
        inner.style.transform = 'perspective(760px) rotateX(' + cap(rx, 13).toFixed(2) + 'deg) rotateY(' + cap(ry, 13).toFixed(2) + 'deg) scale(' + scc.toFixed(3) + ')';
        inner.style.setProperty('--gx', (px * 100).toFixed(1) + '%');
        inner.style.setProperty('--gy', (py * 100).toFixed(1) + '%');
        inner.style.setProperty('--fx', (px * 200).toFixed(1) + '%');
        inner.style.setProperty('--fy', (py * 200).toFixed(1) + '%');
        inner.style.setProperty('--px', (px - 0.5).toFixed(3));
        inner.style.setProperty('--py', (py - 0.5).toFixed(3));
        var rest = !active &&
          Math.abs(vx) < 0.01 && Math.abs(vy) < 0.01 && Math.abs(vs) < 0.002 &&
          Math.abs(trx - rx) < 0.02 && Math.abs(try_ - ry) < 0.02 && Math.abs(tsc - sc) < 0.003;
        if (rest) { raf = 0; inner.style.transform = ''; inner.classList.remove('tilted'); return; }
        raf = requestAnimationFrame(frame);
      }
      function kick() { if (!raf) raf = requestAnimationFrame(frame); }
      card.addEventListener('pointermove', function (e) {
        if (e.pointerType && e.pointerType !== 'mouse') return;
        var r = card.getBoundingClientRect();
        tpx = (e.clientX - r.left) / r.width; tpy = (e.clientY - r.top) / r.height;
        try_ = (tpx - 0.5) * 12;     // rotateY
        trx = (0.5 - tpy) * 12;      // rotateX
        tsc = 1.018; active = true; inner.classList.add('tilted'); kick();
      });
      var reset = function () { active = false; trx = 0; try_ = 0; tsc = 1; tpx = 0.5; tpy = 0.5; kick(); };
      card.addEventListener('pointerleave', reset);
      card.addEventListener('pointercancel', reset);
    });
  }
  // Gyroscope tilt for a single hero card (detail / reveal) on touch devices: the
  // card shimmers and leans as you physically tilt the phone — the Pokémon-TCG-Pocket
  // feel. Drives the same CSS vars as the pointer tilt. Returns a teardown fn (or
  // null) so the caller can detach the global listener when the view closes.
  function gyroMount(container) {
    try {
      if (reducedMotion()) return null;
      if (!container || !window.DeviceOrientationEvent) return null;
      if (!(window.matchMedia && matchMedia('(pointer: coarse)').matches)) return null;
      var inner = container.querySelector('.auth-card,.ctc-inner,.clc-card'); if (!inner) return null;
      var raf = 0, rx = 0, ry = 0, px = 0.5, py = 0.5, trx = 0, try_ = 0, tpx = 0.5, tpy = 0.5;
      function clamp(v) { return v < -1 ? -1 : v > 1 ? 1 : v; }
      function frame() {
        rx += (trx - rx) * 0.12; ry += (try_ - ry) * 0.12;
        px += (tpx - px) * 0.12; py += (tpy - py) * 0.12;
        inner.style.transform = 'perspective(760px) rotateX(' + rx.toFixed(2) + 'deg) rotateY(' + ry.toFixed(2) + 'deg)';
        inner.style.setProperty('--gx', (px * 100).toFixed(1) + '%');
        inner.style.setProperty('--gy', (py * 100).toFixed(1) + '%');
        inner.style.setProperty('--fx', (px * 200).toFixed(1) + '%');
        inner.style.setProperty('--fy', (py * 200).toFixed(1) + '%');
        inner.style.setProperty('--px', (px - 0.5).toFixed(3));
        inner.style.setProperty('--py', (py - 0.5).toFixed(3));
        inner.classList.add('tilted');
        raf = requestAnimationFrame(frame);
      }
      function onOrient(e) {
        var g = clamp((e.gamma || 0) / 32), b = clamp(((e.beta || 0) - 38) / 32);
        tpx = 0.5 + g * 0.5; tpy = 0.5 + b * 0.5; try_ = g * 13; trx = -b * 13;
        if (!raf) raf = requestAnimationFrame(frame);
      }
      var bound = false;
      function bind() { if (bound) return; bound = true; window.addEventListener('deviceorientation', onOrient); }
      if (typeof window.DeviceOrientationEvent.requestPermission === 'function') {
        window.DeviceOrientationEvent.requestPermission().then(function (s) { if (s === 'granted') bind(); }).catch(function () { /* denied */ });
      } else { bind(); }
      return function () {
        window.removeEventListener('deviceorientation', onOrient);
        if (raf) { cancelAnimationFrame(raf); raf = 0; }
        inner.style.transform = ''; inner.classList.remove('tilted');
      };
    } catch (_) { return null; }
  }
  var _gyroOff = null;
  function stopGyro() { if (_gyroOff) { try { _gyroOff(); } catch (_) { /* noop */ } _gyroOff = null; } }

  // Touch drag-to-tilt for a single hero card (detail view): drag a finger across the
  // card and it leans + the foil/glare/parallax track the finger — the tactile
  // equivalent of the desktop hover tilt, no permissions needed. Mouse is left to the
  // hover tilt (tiltMount), so this only handles touch/pen. The card gets
  // touch-action:none (via CSS) so the drag tilts instead of scrolling the modal.
  function dragTiltMount(container) {
    try {
      if (reducedMotion() || !container) return;
      var inner = container.querySelector('.auth-card,.ctc-inner,.clc-card'); if (!inner) return;
      var raf = 0, dragging = false;
      var rx = 0, ry = 0, px = 0.5, py = 0.5, trx = 0, try_ = 0, tpx = 0.5, tpy = 0.5;
      function frame() {
        rx += (trx - rx) * 0.18; ry += (try_ - ry) * 0.18;
        px += (tpx - px) * 0.2; py += (tpy - py) * 0.2;
        inner.style.transform = 'perspective(760px) rotateX(' + rx.toFixed(2) + 'deg) rotateY(' + ry.toFixed(2) + 'deg)' + (dragging ? ' scale(1.015)' : '');
        inner.style.setProperty('--gx', (px * 100).toFixed(1) + '%');
        inner.style.setProperty('--gy', (py * 100).toFixed(1) + '%');
        inner.style.setProperty('--fx', (px * 200).toFixed(1) + '%');
        inner.style.setProperty('--fy', (py * 200).toFixed(1) + '%');
        inner.style.setProperty('--px', (px - 0.5).toFixed(3));
        inner.style.setProperty('--py', (py - 0.5).toFixed(3));
        var rest = !dragging && Math.abs(rx) < 0.05 && Math.abs(ry) < 0.05 && Math.abs(px - 0.5) < 0.004 && Math.abs(py - 0.5) < 0.004;
        if (rest) { raf = 0; inner.style.transform = ''; inner.classList.remove('tilted'); return; }
        raf = requestAnimationFrame(frame);
      }
      function kick() { if (!raf) raf = requestAnimationFrame(frame); }
      function track(cx, cy) {
        var r = inner.getBoundingClientRect();
        tpx = Math.max(0, Math.min(1, (cx - r.left) / r.width));
        tpy = Math.max(0, Math.min(1, (cy - r.top) / r.height));
        try_ = (tpx - 0.5) * 16; trx = (0.5 - tpy) * 16;
      }
      // Touch events with a NON-passive touchmove + preventDefault reliably tilt the card
      // instead of scrolling the modal — pointer-events + touch-action:none alone did not
      // stop the scroll on iOS. Mouse is left untouched (keeps the hover tilt from tiltMount).
      inner.addEventListener('touchstart', function (e) {
        var t = e.touches && e.touches[0]; if (!t) return;
        dragging = true; track(t.clientX, t.clientY);
        // snap the glare/foil under the finger AND write the vars synchronously BEFORE
        // .tilted is added, so the first painted frame is already correct — no flash.
        px = tpx; py = tpy;
        inner.style.setProperty('--gx', (px * 100).toFixed(1) + '%');
        inner.style.setProperty('--gy', (py * 100).toFixed(1) + '%');
        inner.style.setProperty('--fx', (px * 200).toFixed(1) + '%');
        inner.style.setProperty('--fy', (py * 200).toFixed(1) + '%');
        inner.style.setProperty('--px', (px - 0.5).toFixed(3));
        inner.style.setProperty('--py', (py - 0.5).toFixed(3));
        inner.classList.add('tilted'); kick();
      }, { passive: true });
      inner.addEventListener('touchmove', function (e) {
        var t = e.touches && e.touches[0]; if (!dragging || !t) return;
        if (e.cancelable) e.preventDefault();
        track(t.clientX, t.clientY); kick();
      }, { passive: false });
      var end = function () { dragging = false; trx = 0; try_ = 0; tpx = 0.5; tpy = 0.5; kick(); };
      inner.addEventListener('touchend', end);
      inner.addEventListener('touchcancel', end);
    } catch (_) { /* noop */ }
  }

  // Legendary reveal shader: a lightweight raw-WebGL fragment shader (no Three.js)
  // that paints animated prismatic godrays radiating behind the card — the "this one
  // is special" hero beat. Self-contained, feature-detected (silent fallback to the
  // existing gold flash if WebGL is unavailable), and skipped under reduced-motion.
  var _shaderRAF = 0, _shaderEl = null;
  function stopShader() {
    if (_shaderRAF) { cancelAnimationFrame(_shaderRAF); _shaderRAF = 0; }
    if (_shaderEl) _shaderEl.classList.remove('on');
  }
  function startShader() {
    try {
      if (reducedMotion()) return;
      var ov = document.getElementById('clCollReveal'); if (!ov) return;
      var cv = _shaderEl;
      if (!cv) { cv = document.createElement('canvas'); cv.className = 'clr-shader'; ov.insertBefore(cv, ov.firstChild); _shaderEl = cv; }
      var gl = cv._gl || cv.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: false });
      if (!gl) return; cv._gl = gl;
      if (!cv._prog) {
        var vs = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
        var fs = 'precision highp float;uniform vec2 r;uniform float t;uniform float a;' +
          'vec3 hue(float h){return .55+.45*cos(6.2831*(h+vec3(0.,.33,.67)));}' +
          'void main(){vec2 uv=(gl_FragCoord.xy-.5*r)/r.y;float d=length(uv);float ang=atan(uv.y,uv.x);' +
          'float rays=.5+.5*sin(ang*16.+t*1.3)*sin(ang*7.-t*.6);' +
          'float beam=pow(max(0.,rays),2.2);' +
          'float fall=smoothstep(1.05,.05,d)*smoothstep(0.,.16,d);' +
          'float core=smoothstep(.36,0.,d);' +
          'vec3 col=hue(ang/6.2831+t*.04)*beam*fall+vec3(1.,.86,.5)*core;' +
          'float al=clamp(beam*fall*.6+core,0.,1.)*a;' +
          'gl_FragColor=vec4(col,al);}';
        var mk = function (type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
        var prog = gl.createProgram();
        gl.attachShader(prog, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(prog, mk(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(prog);
        var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
        var loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
        cv._prog = prog; cv._u = { r: gl.getUniformLocation(prog, 'r'), t: gl.getUniformLocation(prog, 't'), a: gl.getUniformLocation(prog, 'a') };
        gl.useProgram(prog); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      }
      var dpr = Math.min(2, window.devicePixelRatio || 1);
      var w = ov.clientWidth || window.innerWidth, h = ov.clientHeight || window.innerHeight;
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      gl.viewport(0, 0, cv.width, cv.height);
      cv.classList.add('on');
      var t0 = performance.now(), amp = 0;
      if (_shaderRAF) cancelAnimationFrame(_shaderRAF);
      (function loop(now) {
        amp += (1 - amp) * 0.05;
        gl.useProgram(cv._prog);
        gl.uniform2f(cv._u.r, cv.width, cv.height);
        gl.uniform1f(cv._u.t, (now - t0) / 1000);
        gl.uniform1f(cv._u.a, amp * 0.9);
        gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        _shaderRAF = requestAnimationFrame(loop);
      })(t0);
    } catch (_) { stopShader(); }
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
  var TIERS = ['common', 'rare', 'elite', 'legendary'];
  // Rarity is EARNED: a base tier (rating, else hash) is then raised by merit the
  // game passes in — it.rarityFloor (minimum, e.g. the goal/answer card) and
  // it.bump (+N tiers for a fast / under-par solve). Explicit it.rarity wins (seed).
  function rarityOf(it) {
    if (it.rarity && RARITY[it.rarity]) return it.rarity;
    var idx, r = it.rating;
    if (typeof r === 'number' && r > 0) idx = r >= 8.3 ? 3 : r >= 7.8 ? 2 : r >= 7 ? 1 : 0;
    else idx = TIERS.indexOf(hashRarity(it.id, it.type));
    if (it.rarityFloor && TIERS.indexOf(it.rarityFloor) > idx) idx = TIERS.indexOf(it.rarityFloor);
    if (it.bump) idx += it.bump;
    return TIERS[Math.max(0, Math.min(3, idx))];
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
        var gd = DUST[s.cards[k].rarity] || 5;
        s.dust = (s.dust || 0) + gd; _pendingDust += gd;
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

  // ── Sets / collections (the "catch 'em all" retention loop) ──
  // Two kinds: curated (explicit TMDB members → silhouette slots for the missing)
  // and milestone (computed from your stats). Member ids are real TMDB ids so a
  // set fills as you win those titles in the daily games.
  var SETS = [
    { id: 'avengers', name: 'Marvel Blockbusters', members: [
      { id: 24428, type: 'movie', name: 'The Avengers' }, { id: 299536, type: 'movie', name: 'Avengers: Infinity War' },
      { id: 299534, type: 'movie', name: 'Avengers: Endgame' }, { id: 634649, type: 'movie', name: 'Spider-Man: No Way Home' }
    ] },
    { id: 'pandora', name: 'Pandora · Avatar', members: [
      { id: 19995, type: 'movie', name: 'Avatar' }, { id: 76600, type: 'movie', name: 'Avatar: The Way of Water' }, { id: 83533, type: 'movie', name: 'Avatar: Fire and Ash' }
    ] },
    { id: 'titans', name: 'Box-Office Titans', members: [
      { id: 597, type: 'movie', name: 'Titanic' }, { id: 19995, type: 'movie', name: 'Avatar' },
      { id: 299534, type: 'movie', name: 'Avengers: Endgame' }, { id: 361743, type: 'movie', name: 'Top Gun: Maverick' }
    ] },
    { id: 'cinephile', name: 'Cinephile', goal: { kind: 'films', target: 25 } },
    { id: 'starstruck', name: 'Star-studded', goal: { kind: 'people', target: 15 } },
    { id: 'spectrum', name: 'Full Spectrum', goal: { kind: 'rarityAll' } },
    { id: 'legends', name: 'Legend Hunter', goal: { kind: 'rarity', rarity: 'legendary', target: 5 } }
  ];

  function setsStateFrom(s) {
    var cards = (s && s.cards) || {};
    var arr = Object.keys(cards).map(function (k) { return cards[k]; });
    var films = arr.filter(function (c) { return c.type !== 'person'; }).length;
    var people = arr.filter(function (c) { return c.type === 'person'; }).length;
    var byR = { common: 0, rare: 0, elite: 0, legendary: 0 };
    arr.forEach(function (c) { byR[c.rarity] = (byR[c.rarity] || 0) + 1; });
    return SETS.map(function (set) {
      if (set.members) {
        var owned = 0;
        var members = set.members.map(function (m) {
          var card = cards[m.type + ':' + m.id] || null; if (card) owned++;
          return { id: m.id, type: m.type, name: m.name, owned: !!card, card: card };
        });
        return { id: set.id, name: set.name, kind: 'curated', owned: owned, total: set.members.length, pct: owned / set.members.length, complete: owned >= set.members.length, members: members, bonus: 50 * set.members.length };
      }
      var g = set.goal, cur = 0, tot = g.target || 1;
      if (g.kind === 'films') cur = films;
      else if (g.kind === 'people') cur = people;
      else if (g.kind === 'rarity') cur = byR[g.rarity] || 0;
      else if (g.kind === 'rarityAll') { cur = ['common', 'rare', 'elite', 'legendary'].filter(function (r) { return byR[r] > 0; }).length; tot = 4; }
      return { id: set.id, name: set.name, kind: 'milestone', goal: g, owned: Math.min(cur, tot), total: tot, pct: Math.min(1, cur / tot), complete: cur >= tot, bonus: 75 };
    });
  }
  function setsState() { return setsStateFrom(load() || blank()); }

  // ── Card backs: most unlock by level; "Mastery" is gated on the trophy case
  //   (achievements) so it can't be reached by level-grinding alone. ──
  var CARDBACKS = [
    { id: 'classic', name: 'Classic', level: 1, css: '' },
    { id: 'gold', name: 'Gold Foil', level: 3, css: 'cb-gold' },
    { id: 'holo', name: 'Holographic', level: 6, css: 'cb-holo' },
    { id: 'midnight', name: 'Midnight', level: 10, css: 'cb-midnight' },
    { id: 'crimson', name: 'Crimson', level: 15, css: 'cb-crimson' },
    { id: 'mastery', name: 'Mastery', achv: 12, css: 'cb-mastery' }
  ];
  // Met trophy count (matches the trophy case). Safe from recursion because achievement
  // evaluation uses rawCardbackId(), not activeCardbackId() (see achCtx).
  function achvCount() { return achievementsState().filter(function (a) { return a.unlocked; }).length; }
  function cbUnlocked(cb) { return cb.achv ? achvCount() >= cb.achv : stats().level >= (cb.level || 1); }
  function cbReq(cb) { return cb.achv ? { type: 'achv', need: cb.achv } : { type: 'level', need: cb.level || 1 }; }
  function activeCardbackId() {
    var id = null; try { id = localStorage.getItem('cl_cardback'); } catch (_) {}
    var cb = CARDBACKS.filter(function (c) { return c.id === id; })[0];
    return (cb && cbUnlocked(cb)) ? cb.id : 'classic';
  }
  function activeCardbackClass() { var cb = CARDBACKS.filter(function (c) { return c.id === activeCardbackId(); })[0]; return cb ? cb.css : ''; }
  function cardbacksState() {
    var active = activeCardbackId();
    return CARDBACKS.map(function (cb) { return { id: cb.id, name: cb.name, css: cb.css, unlocked: cbUnlocked(cb), active: cb.id === active, req: cbReq(cb) }; });
  }
  function useCardback(id) {
    var cb = CARDBACKS.filter(function (c) { return c.id === id; })[0];
    if (!cb || !cbUnlocked(cb)) return false;
    try { localStorage.setItem('cl_cardback', id); } catch (_) {}
    return true;
  }
  // level-gated card backs newly unlocked crossing from lvA to lvB (for the level-up message)
  function cardbacksUnlockedBetween(lvA, lvB) { return CARDBACKS.filter(function (cb) { return cb.level && cb.level > lvA && cb.level <= lvB; }); }
  // achievement-gated card backs newly unlocked crossing from count cA to cB (after earning trophies)
  function cardbacksUnlockedByAchv(cA, cB) { return CARDBACKS.filter(function (cb) { return cb.achv && cb.achv > cA && cb.achv <= cB; }); }
  // One-time award + record for newly-completed sets. Returns the newly claimed.
  function claimSets() {
    var s = load() || blank();
    if (!s.setsDone) s.setsDone = {};
    var newly = [];
    setsStateFrom(s).forEach(function (st) {
      if (st.complete && !s.setsDone[st.id]) { s.setsDone[st.id] = today(); s.xp = (s.xp || 0) + (st.bonus || 75); newly.push(st); }
    });
    if (newly.length) save(s);
    return newly;
  }

  // ── Achievements / Mastery (trophy case — prestige badges, no XP so the
  //    rarity/XP economy stays honest and an existing save isn't retro-inflated) ──
  var ACHV = [
    { id: 'first', icon: '🎬', name: 'First Frame', desc: 'Collect your first card', goal: function (c) { return [c.st.count, 1]; } },
    { id: 'coll25', icon: '📚', name: 'Collector', desc: 'Collect 25 cards', goal: function (c) { return [c.st.count, 25]; } },
    { id: 'coll50', icon: '🗃️', name: 'Curator', desc: 'Collect 50 cards', goal: function (c) { return [c.st.count, 50]; } },
    { id: 'coll100', icon: '🏛️', name: 'Archivist', desc: 'Collect 100 cards', goal: function (c) { return [c.st.count, 100]; } },
    { id: 'people10', icon: '⭐', name: 'Star Power', desc: 'Collect 10 people', goal: function (c) { return [c.st.people, 10]; } },
    { id: 'films25', icon: '🍿', name: 'Cinephile', desc: 'Collect 25 films', goal: function (c) { return [c.st.films, 25]; } },
    { id: 'rare1', icon: '🔷', name: 'Rare Find', desc: 'Own a Rare card', goal: function (c) { return [c.st.byRarity.rare, 1]; } },
    { id: 'elite1', icon: '💠', name: 'Elite', desc: 'Own an Elite card', goal: function (c) { return [c.st.byRarity.elite, 1]; } },
    { id: 'leg1', icon: '👑', name: 'Legend', desc: 'Own a Legendary card', goal: function (c) { return [c.st.byRarity.legendary, 1]; } },
    { id: 'leg5', icon: '🌟', name: 'Hall of Fame', desc: 'Own 5 Legendaries', goal: function (c) { return [c.st.byRarity.legendary, 5]; } },
    { id: 'spectrum', icon: '🌈', name: 'Full Spectrum', desc: 'Own every rarity tier', goal: function (c) { var b = c.st.byRarity; var n = ['common', 'rare', 'elite', 'legendary'].filter(function (r) { return b[r] > 0; }).length; return [n, 4]; } },
    { id: 'set1', icon: '🧩', name: 'Set Theorist', desc: 'Complete your first set', goal: function (c) { return [c.sd, 1]; } },
    { id: 'set3', icon: '🏆', name: 'Completionist', desc: 'Complete 3 sets', goal: function (c) { return [c.sd, 3]; } },
    { id: 'lvl5', icon: '📈', name: 'Rising Star', desc: 'Reach level 5', goal: function (c) { return [c.st.level, 5]; } },
    { id: 'lvl10', icon: '🎖️', name: 'Veteran', desc: 'Reach level 10', goal: function (c) { return [c.st.level, 10]; } },
    { id: 'style', icon: '🎴', name: 'Style Icon', desc: 'Equip a non-default card back', goal: function (c) { return [c.cb !== 'classic' ? 1 : 0, 1]; } }
  ];
  // Raw equipped card-back id (no unlock validation) — used for the 'style' achievement so
  // achievement evaluation never calls activeCardbackId()→cbUnlocked()→achvCount() (would recurse).
  // useCardback() only ever stores an unlocked id, so the raw value is safe to trust here.
  function rawCardbackId() { var id = null; try { id = localStorage.getItem('cl_cardback'); } catch (_) {} return id || 'classic'; }
  function achCtx() {
    var st = stats(), s = load() || blank();
    return { st: st, sd: s.setsDone ? Object.keys(s.setsDone).length : 0, cb: rawCardbackId() };
  }
  function achMet(a, ctx) { var g = a.goal(ctx); return g[0] >= g[1]; }
  // Record newly-satisfied achievements; returns the list newly unlocked this call.
  function syncAchievements() {
    var s = load() || blank();
    if (!s.achievements) s.achievements = {};
    var ctx = achCtx(), newly = [];
    ACHV.forEach(function (a) { if (!s.achievements[a.id] && achMet(a, ctx)) { s.achievements[a.id] = today(); newly.push({ id: a.id, name: a.name, icon: a.icon }); } });
    if (newly.length) save(s);
    return newly;
  }
  function achievementsState() {
    var s = load() || blank(), un = s.achievements || {}, ctx = achCtx();
    return ACHV.map(function (a) {
      var g = a.goal(ctx);
      return { id: a.id, icon: a.icon, name: a.name, desc: a.desc, unlocked: !!un[a.id] || achMet(a, ctx), date: un[a.id] || null, have: Math.min(g[0], g[1]), need: g[1] };
    });
  }

  // ── Dust economy (spend duplicate dust to "Shine" owned cards) ──
  function dustBalance() { return (load() || blank()).dust || 0; }
  function shineCost(c) { return SHINE_COST[c && c.rarity] || 80; }
  function cardRecord(c) { var s = load(); return (c && s && s.cards) ? s.cards[c.type + ':' + c.id] : null; }
  function isShined(c) { var r = cardRecord(c); return !!(r && r.shine); }
  // Returns {ok, reason?, need?, have?, dust?}. Reasons: 'notowned','already','dust'.
  function shineCard(c) {
    var s = load() || blank();
    if (!c || !s.cards) return { ok: false, reason: 'notowned' };
    var rec = s.cards[c.type + ':' + c.id];
    if (!rec) return { ok: false, reason: 'notowned' };
    if (rec.shine) return { ok: false, reason: 'already' };
    var cost = SHINE_COST[rec.rarity] || 80, have = s.dust || 0;
    if (have < cost) return { ok: false, reason: 'dust', need: cost, have: have };
    s.dust = have - cost; rec.shine = 1; save(s); refreshOpen();
    return { ok: true, dust: s.dust };
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
      '.ctc-glare{position:absolute;inset:0;z-index:3;pointer-events:none;opacity:0;background:radial-gradient(circle at var(--gx,50%) var(--gy,50%),rgba(255,255,255,.5),rgba(255,255,255,.08) 30%,transparent 52%);mix-blend-mode:overlay;transition:opacity .2s}' +
      '.ctc-inner:hover .ctc-glare,.ctc-inner.tilted .ctc-glare{opacity:1}' +
      '.ctc-common .ctc-inner:hover,.ctc-common .ctc-inner.tilted{box-shadow:0 16px 36px rgba(0,0,0,.58)}' +
      '.ctc-rare .ctc-inner:hover,.ctc-rare .ctc-inner.tilted{box-shadow:0 16px 36px rgba(0,0,0,.58),0 0 24px rgba(122,166,232,.5)}' +
      '.ctc-elite .ctc-inner:hover,.ctc-elite .ctc-inner.tilted{box-shadow:0 16px 36px rgba(0,0,0,.58),0 0 24px rgba(181,138,214,.55)}' +
      '.ctc-legendary .ctc-inner:hover,.ctc-legendary .ctc-inner.tilted{box-shadow:0 16px 36px rgba(0,0,0,.58),0 0 28px rgba(232,194,74,.6)}' +
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
      return '<div class="ctc ctc-' + c.rarity + (person ? ' person' : '') + (c.shine ? ' cl-shine' : '') + '" style="--cr:' + rar.ring + ';animation-delay:' + Math.min(i, 16) * 22 + 'ms" title="' + ctx.esc(c.name) + ' · ' + rar.label + (c.shine ? ' · Shined' : '') + '">' +
        '<div class="ctc-inner"><div class="ctc-frame"><div class="ctc-art">' +
          (p ? '<img src="' + ctx.esc(p) + '" alt="" loading="lazy">' : '<div class="ctc-noimg"></div>') +
          '<div class="ctc-foil"></div><div class="ctc-glare"></div>' +
          (c.shine ? '<span class="cl-shine-t">&#10024;</span>' : '') +
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
      '.auth-bgimg{position:absolute;inset:-1px;width:calc(100% + 2px);height:calc(100% + 2px);object-fit:cover;object-position:center top;z-index:0}' +
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
      '.auth-foil{position:absolute;inset:0;z-index:7;pointer-events:none;opacity:0;background:repeating-linear-gradient(115deg,rgba(255,119,115,.4),rgba(255,237,95,.4) 11%,rgba(168,255,150,.4) 21%,rgba(131,255,247,.4) 31%,rgba(120,148,255,.4) 42%,rgba(216,117,255,.4) 52%,rgba(255,119,115,.4) 62%);background-size:280% 280%;background-position:var(--fx,50%) var(--fy,50%);mix-blend-mode:color-dodge;filter:brightness(.92) contrast(1.12);transition:opacity .22s}' +
      '.auth-rare .auth-foil{opacity:.16}.auth-elite .auth-foil{opacity:.24}.auth-legendary .auth-foil{opacity:.34;animation:authDrift 7s linear infinite}' +
      // glitter layer: fine specular dots that travel with the cursor/tilt and read as metallic foil grain. Elite+ only, on hover/tilt.
      '.auth-glit{position:absolute;inset:0;z-index:7;pointer-events:none;opacity:0;background-image:radial-gradient(rgba(255,255,255,.85) 0 5%,transparent 8%),radial-gradient(rgba(255,255,255,.5) 0 4%,transparent 7%);background-size:7cqw 7cqw,4.6cqw 4.6cqw;background-position:var(--fx,50%) var(--fy,50%),calc(var(--fx,50%) + 2.3cqw) calc(var(--fy,50%) + 1.4cqw);-webkit-mask:radial-gradient(circle at var(--gx,50%) var(--gy,50%),#000,rgba(0,0,0,.3) 24%,transparent 54%);mask:radial-gradient(circle at var(--gx,50%) var(--gy,50%),#000,rgba(0,0,0,.3) 24%,transparent 54%);mix-blend-mode:screen;filter:brightness(1.1);transition:opacity .25s}' +
      '.auth-elite .auth-card:hover .auth-glit,.auth-elite .auth-card.tilted .auth-glit{opacity:.42}' +
      '.auth-legendary .auth-card:hover .auth-glit,.auth-legendary .auth-card.tilted .auth-glit{opacity:.6}' +
      // one-shot diagonal light sweep when the pointer enters a card
      '.auth-sheen{position:absolute;inset:0;z-index:8;pointer-events:none;border-radius:13px;opacity:0;background:linear-gradient(105deg,transparent 36%,rgba(255,255,255,.55) 50%,transparent 64%)}' +
      '.auth-card:hover .auth-sheen,.auth-card.sheen-go .auth-sheen{animation:authSheen .7s ease-out}' +
      '@keyframes authSheen{0%{opacity:0;transform:translateX(-65%)}28%{opacity:.85}100%{opacity:0;transform:translateX(65%)}}' +
      // in-card depth parallax: while tilted the poster recedes (moves against the cursor) and the star/badges/title pop forward (move with it)
      '.auth-bgimg,.auth-star,.auth-corner,.auth-tags,.auth-text{transition:transform .28s cubic-bezier(.2,.8,.2,1)}' +
      '.auth-card.tilted .auth-bgimg{transform:translate(calc(var(--px,0) * -2.4cqw),calc(var(--py,0) * -2.4cqw)) scale(1.06)}' +
      '.auth-card.tilted .auth-star{transform:translate(calc(var(--px,0) * 3.6cqw),calc(var(--py,0) * 3.6cqw))}' +
      '.auth-card.tilted .auth-corner{transform:translate(calc(var(--px,0) * 2.6cqw),calc(var(--py,0) * 2.6cqw))}' +
      '.auth-card.tilted .auth-tags{transform:translate(calc(var(--px,0) * 3cqw),calc(var(--py,0) * 3cqw))}' +
      '.auth-card.tilted .auth-text{transform:translate(calc(var(--px,0) * 2.2cqw),calc(var(--py,0) * 2.2cqw))}' +
      '.auth-glare{position:absolute;inset:0;z-index:8;pointer-events:none;opacity:0;background:radial-gradient(circle at var(--gx,50%) var(--gy,50%),rgba(255,255,255,.42),rgba(255,255,255,.08) 30%,transparent 52%);mix-blend-mode:overlay;transition:opacity .2s}' +
      '.auth-card:hover .auth-glare,.auth-card.tilted .auth-glare{opacity:1}' +
      // the WHOLE card tilts as one plane (no independent photo zoom); a moving inner
      // shade darkens the side that turns away, so it reads as a lit 3D surface.
      '.auth-shade{position:absolute;inset:0;z-index:8;pointer-events:none;opacity:0;border-radius:13px;background:linear-gradient(var(--shang,105deg),rgba(0,0,0,.5),transparent 42%,transparent 58%,rgba(255,255,255,.14));transition:opacity .2s}' +
      '.auth-card.tilted .auth-shade{opacity:1}' +
      '.auth-card:hover,.auth-card.tilted{box-shadow:0 20px 44px rgba(0,0,0,.64)}' +
      '.auth-rare .auth-card:hover,.auth-rare .auth-card.tilted{box-shadow:0 20px 44px rgba(0,0,0,.64),0 0 26px rgba(122,166,232,.5)}' +
      '.auth-elite .auth-card:hover,.auth-elite .auth-card.tilted{box-shadow:0 20px 44px rgba(0,0,0,.64),0 0 26px rgba(181,138,214,.55)}' +
      '.auth-legendary .auth-card:hover,.auth-legendary .auth-card.tilted{box-shadow:0 20px 44px rgba(0,0,0,.64),0 0 30px rgba(232,194,74,.6)}' +
      '@media(prefers-reduced-motion:reduce){.auth{animation:none}.auth-star,.auth-legendary .auth-foil{animation:none}.auth-card{transition:none}.auth-sheen{animation:none;display:none}.auth-glit{display:none}.auth-bgimg,.auth-star,.auth-corner,.auth-tags,.auth-text{transition:none}}',
    card: function (c, ctx, i) {
      var rar = ctx.RARITY[c.rarity] || ctx.RARITY.common;
      var p = ctx.posterUrl(c.img);
      var person = c.type === 'person';
      var typeUp = person ? 'Actor' : (c.type === 'tv' ? 'Series' : 'Film');
      var no = '#' + ('00' + (c.no || 0)).slice(-3);
      var nlen = (c.name || '').length;
      var nmCls = nlen > 22 ? ' auth-name--sm' : nlen > 14 ? ' auth-name--md' : '';
      var nm = ctx.esc(c.name);
      return '<div class="auth auth-' + c.rarity + (person ? ' person' : '') + (c.shine ? ' cl-shine' : '') + '" style="--cr:' + rar.ring + ';--m1:' + (METAL[c.rarity] || '#fff') + ';animation-delay:' + Math.min(i, 16) * 22 + 'ms" title="' + nm + ' · ' + rar.label + ' · ' + no + (c.shine ? ' · Shined' : '') + '">' +
        '<div class="auth-card">' +
          (p ? '<img class="auth-bgimg" src="' + ctx.esc(p) + '" alt="" loading="lazy">' : '<div class="auth-noimg"></div>') +
          '<div class="auth-scrim"></div><div class="auth-corner"></div><div class="auth-star"></div>' +
          '<div class="auth-tags">' + (c.shine ? '<span class="cl-shine-t">&#10024;</span>' : '') + (c.n > 1 ? '<span class="auth-dp">×' + c.n + '</span>' : '') + (c.isNew ? '<span class="auth-nw">New</span>' : '') + '</div>' +
          '<div class="auth-text">' +
            '<div class="auth-name' + nmCls + '">' + nm + '</div>' +
            '<div class="auth-meta"><span class="auth-gem"></span><span class="auth-rar">' + rar.label + '</span><span class="sep">·</span><span>' + typeUp + '</span><span class="sep">·</span><span class="auth-no">' + no + '</span></div>' +
          '</div>' +
          '<div class="auth-frame"></div><div class="auth-foil"></div><div class="auth-glit"></div><div class="auth-shade"></div><div class="auth-sheen"></div><div class="auth-glare"></div>' +
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
      '.cl-coll-dust{display:inline-flex;align-items:center;font-size:.78rem;font-weight:800;color:#bfe6ff;background:rgba(120,184,255,.12);border:1px solid rgba(150,205,255,.3);border-radius:99px;padding:3px 9px;margin-right:2px;white-space:nowrap}' +
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
      // Scroll lives on the MODAL, not the box — so the box can stay overflow:visible
      // and never clip the 3D-tilted card against a rectangle. margin:auto centres the
      // box when it fits and lets it scroll from the top when it doesn't.
      '#clCollDetail{position:fixed;inset:0;z-index:250;display:none;align-items:flex-start;justify-content:center;overflow-y:auto;padding:18px;background:rgba(0,0,0,.82);backdrop-filter:blur(7px)}' +
      '#clCollDetail.open{display:flex;animation:clCollIn .26s cubic-bezier(.2,.9,.3,1.1) both}' +
      '.cl-detail-box{position:relative;display:flex;flex-direction:column;align-items:center;gap:18px;margin:auto;overflow:visible;padding:4px}' +
      '.cl-detail-stage{width:340px;height:476px;max-width:94vw;display:flex;align-items:center;justify-content:center;flex-shrink:0}' +
      '.cl-detail-card{width:300px;max-width:86vw}' +
      '#clDetailCard{touch-action:none;-webkit-user-select:none;user-select:none}' +
      '.cl-detail-x{position:fixed;top:16px;right:18px;background:rgba(20,20,20,.65);border:1px solid rgba(255,255,255,.16);color:#ddd;font-size:1.1rem;cursor:pointer;border-radius:999px;width:38px;height:38px;line-height:1;z-index:1}' +
      '.cl-di{width:300px;max-width:90vw}' +
      '.cl-di-name{font-size:1.15rem;font-weight:800;color:#f5f5f5;text-align:center;margin-bottom:11px}' +
      '.cl-di-rows{display:flex;flex-direction:column;gap:1px;border-radius:11px;overflow:hidden;border:1px solid rgba(255,255,255,.09)}' +
      '.cl-di-row{display:flex;justify-content:space-between;padding:10px 14px;background:#181818;font-size:.84rem}' +
      '.cl-di-row span{color:#9a9a9a}.cl-di-row b{color:#f0f0f0;font-weight:700}' +
      '.cl-shine-wrap{width:100%;margin-top:13px;text-align:center}' +
      '.cl-shine-btn{width:100%;border:none;border-radius:11px;padding:12px 14px;font-size:.92rem;font-weight:800;cursor:pointer;color:#06121f;background:linear-gradient(135deg,#bfe6ff,#7ab8ff);box-shadow:0 6px 18px rgba(120,184,255,.32);transition:transform .12s ease,box-shadow .2s ease}' +
      '.cl-shine-btn:hover{transform:translateY(-1px);box-shadow:0 10px 24px rgba(120,184,255,.45)}' +
      '.cl-shine-btn.off{background:#2a2a2a;color:#8a8a8a;box-shadow:none;cursor:not-allowed}' +
      '.cl-shine-btn.shake{animation:clShake .4s}' +
      '@keyframes clShake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-6px)}40%,80%{transform:translateX(6px)}}' +
      '.cl-shine-hint{font-size:.72rem;color:#9a9a9a;margin-top:7px;font-weight:600}' +
      '.cl-shine-done{width:100%;border-radius:11px;padding:12px 14px;font-size:.92rem;font-weight:800;color:#bfe6ff;background:linear-gradient(135deg,rgba(120,184,255,.16),rgba(120,184,255,.06));border:1px solid rgba(150,205,255,.4);text-shadow:0 1px 6px rgba(150,205,255,.6)}' +
      // ── reveal sequence ──
      '#clCollReveal{position:fixed;inset:0;z-index:260;display:none;flex-direction:column;align-items:center;justify-content:center;background:radial-gradient(circle at 50% 42%,rgba(18,20,30,.72),rgba(0,0,0,.92) 70%);backdrop-filter:blur(8px);overflow:hidden;cursor:pointer}' +
      '#clCollReveal.open{display:flex}' +
      '.clr-flash{position:absolute;inset:0;z-index:5;pointer-events:none;opacity:0;background:radial-gradient(circle at 50% 45%,rgba(232,160,0,.5),rgba(232,160,0,.12) 38%,transparent 66%)}' +
      '.clr-flash.go{animation:clrFlash .62s cubic-bezier(.22,1,.36,1)}' +
      '@keyframes clrFlash{0%{opacity:0;transform:scale(.7)}22%{opacity:1}100%{opacity:0;transform:scale(1.3)}}' +
      '.clr-progress{position:absolute;top:22px;display:flex;gap:6px;z-index:7}' +
      '.clr-dot{width:7px;height:7px;border-radius:50%;background:rgba(255,255,255,.22);transition:background .2s}' +
      '.clr-dot.on{background:#e8a000}' +
      '.clr-skip{position:absolute;top:18px;right:20px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.18);color:#ccc;font:inherit;font-size:.74rem;font-weight:700;padding:6px 13px;border-radius:999px;cursor:pointer;z-index:8}' +
      '.clr-skip:hover{color:#fff}' +
      '.clr-stage{position:relative;width:300px;max-width:82vw;z-index:6;perspective:1200px;animation:clrStageIn .45s cubic-bezier(.2,.9,.3,1.2) both}' +
      '@keyframes clrStageIn{from{opacity:0;transform:translateY(16px) scale(.93)}to{opacity:1;transform:none}}' +
      '.clr-stage::after{content:"";position:absolute;left:50%;bottom:-22px;width:60%;height:24px;transform:translateX(-50%);background:radial-gradient(ellipse at center,rgba(0,0,0,.6),transparent 72%);filter:blur(5px);z-index:-1}' +
      '.clr-flip{position:relative;width:100%;aspect-ratio:5/7;transform-style:preserve-3d;transform:rotateY(180deg);will-change:transform}' +
      '.clr-flip.flipped{transform:rotateY(0)}' +                       // static (reduced-motion) reveal
      '.clr-flip.flip-go{animation:clrFlip 1.05s cubic-bezier(.42,.04,.24,1) forwards}' +
      '@keyframes clrFlip{0%{transform:rotateY(180deg) scale(.84)}46%{transform:rotateY(94deg) scale(.95)}72%{transform:rotateY(-11deg) scale(1.05)}100%{transform:rotateY(0) scale(1)}}' +
      '.clr-flip.flip-go.live{animation:clrLive 5s ease-in-out infinite}' +
      '@keyframes clrLive{0%,100%{transform:rotateY(0) rotateX(0)}25%{transform:rotateY(6deg) rotateX(-2.5deg)}50%{transform:rotateY(0) rotateX(0)}75%{transform:rotateY(-6deg) rotateX(2.5deg)}}' +
      '.clr-face,.clr-back{position:absolute;inset:0;-webkit-backface-visibility:hidden;backface-visibility:hidden;border-radius:13px;overflow:hidden}' +
      // light + shade that fire as the front face swings into view — makes the card a lit surface, not a flat plane
      '.clr-face::before{content:"";position:absolute;inset:0;z-index:29;pointer-events:none;border-radius:13px;opacity:0;background:linear-gradient(106deg,rgba(0,0,0,.45),transparent 46%,transparent 60%,rgba(255,255,255,.12))}' +
      '.clr-face::after{content:"";position:absolute;inset:0;z-index:30;pointer-events:none;border-radius:13px;opacity:0;background:linear-gradient(118deg,transparent 34%,rgba(255,255,255,.92) 50%,transparent 66%)}' +
      '.clr-flip.flip-go .clr-face::before{animation:clrShade 1.05s ease-out}' +
      '.clr-flip.flip-go .clr-face::after{animation:clrLightPass 1.05s ease-in-out}' +
      '@keyframes clrShade{0%,46%{opacity:0}68%{opacity:1}100%{opacity:0}}' +
      '@keyframes clrLightPass{0%,40%{opacity:0}55%{opacity:.95}76%{opacity:.22}100%{opacity:0}}' +
      '.clr-back{transform:rotateY(180deg);background:repeating-linear-gradient(45deg,#101a30,#101a30 9px,#13203a 9px,#13203a 18px);border:1px solid rgba(232,160,0,.32);display:flex;align-items:center;justify-content:center;box-shadow:inset 0 0 0 3px rgba(232,160,0,.16)}' +
      '.clr-mono{font-size:3rem;font-weight:900;color:#e8a000;letter-spacing:-.05em;text-shadow:0 2px 14px rgba(232,140,0,.5)}' +
      '.clr-halo{position:absolute;inset:0;border-radius:13px;box-shadow:0 0 0 0 var(--halo,transparent)}' +
      '.clr-flip:not(.flip-go):not(.flipped) .clr-halo{animation:clrHalo 1s ease-in-out infinite}' +
      '@keyframes clrHalo{0%,100%{box-shadow:0 0 10px 1px var(--halo,transparent),inset 0 0 12px var(--halo,transparent)}50%{box-shadow:0 0 30px 7px var(--halo,transparent),inset 0 0 22px var(--halo,transparent)}}' +
      '.clr-cap{margin-top:20px;text-align:center;z-index:6;min-height:54px}' +
      '.clr-tag{display:inline-block;font-size:.72rem;font-weight:900;letter-spacing:.14em;text-transform:uppercase;border-radius:6px;padding:4px 11px;animation:clrPop .42s cubic-bezier(.2,1.7,.4,1) both}' +
      '.clr-tag.new{color:#06281a;background:#7fd49a}.clr-tag.dupe{color:#1a1200;background:linear-gradient(135deg,#f5c542,#e8a000)}' +
      '@keyframes clrPop{0%{opacity:0;transform:scale(.4)}100%{opacity:1;transform:scale(1)}}' +
      '.clr-rare-lbl{display:block;margin-top:5px;font-size:.66rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase}' +
      '.clr-xp{display:block;margin-top:8px;color:#e8a000;font-weight:800;font-size:.92rem;letter-spacing:.02em}' +
      '.clr-hint{position:absolute;bottom:24px;color:rgba(255,255,255,.5);font-size:.78rem;z-index:6}' +
      '.clr-sum{display:flex;flex-direction:column;align-items:center;gap:13px;z-index:6;text-align:center;animation:clrIn2 .4s ease both}' +
      '@keyframes clrIn2{from{opacity:0;transform:translateY(12px)}to{opacity:1}}' +
      '.clr-sum-h{font-size:1.5rem;font-weight:900;color:#f5f5f5}.clr-sum-x{color:#e8a000;font-weight:800}.clr-sum-lvl{color:#7fd49a;font-weight:800;font-size:.95rem}' +
      '.clr-sum-btns{display:flex;gap:10px;margin-top:6px}' +
      '.clr-btn{padding:11px 20px;border-radius:12px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.06);color:#f0f0f0;font:inherit;font-weight:800;cursor:pointer}.clr-btn.gold{background:linear-gradient(135deg,#f5c542,#e8a000);color:#111;border:none}' +
      '@media(prefers-reduced-motion:reduce){.clr-stage,.clr-flip.flip-go,.clr-flip.live{animation:none}.clr-flash.go,.clr-flip .clr-halo,.clr-face::before,.clr-face::after{animation:none}.clr-face::before,.clr-face::after{display:none}}' +
      // ── sets view ──
      '.cl-set{width:100%;display:flex;align-items:center;gap:12px;padding:13px 14px;margin-bottom:10px;border-radius:12px;background:#1c1c1c;border:1px solid rgba(255,255,255,.09);cursor:pointer;text-align:left;font:inherit;color:#f0f0f0}' +
      '.cl-set:hover{border-color:rgba(232,160,0,.4)}' +
      '.cl-set.done{border-color:rgba(232,160,0,.5);background:linear-gradient(180deg,rgba(232,160,0,.1),#1c1c1c)}' +
      '.cl-set-tx{flex:1;min-width:0}' +
      '.cl-set-nm{font-weight:800;font-size:.92rem;display:flex;align-items:center;gap:8px}' +
      '.cl-set-done{font-size:.58rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#e8a000;border:1px solid rgba(232,160,0,.5);border-radius:999px;padding:2px 8px}' +
      '.cl-set-bar{height:6px;border-radius:99px;background:rgba(255,255,255,.1);margin-top:8px;overflow:hidden}' +
      '.cl-set-bar>i{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,#e8a000,#f5c542);transition:width .5s cubic-bezier(.3,.9,.3,1)}' +
      '.cl-set-ct{font-size:.74rem;color:#9a9a9a;font-weight:800;flex-shrink:0;font-family:ui-monospace,Menlo,monospace}' +
      '.cl-set-arrow{color:#888;font-size:1.2rem;flex-shrink:0}' +
      '.cl-set-head{grid-column:1/-1;display:flex;align-items:center;gap:12px;margin-bottom:4px}' +
      '.cl-back-btn{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);color:#ccc;font:inherit;font-weight:700;font-size:.78rem;border-radius:999px;padding:6px 13px;cursor:pointer}' +
      '.cl-back-btn:hover{color:#fff}' +
      '.cl-set-htitle{font-weight:800;font-size:.9rem;color:#f0f0f0}' +
      '.cl-slot{position:relative;aspect-ratio:5/7;border-radius:13px;border:1.5px dashed rgba(255,255,255,.16);background:repeating-linear-gradient(45deg,#141414,#141414 9px,#181818 9px,#181818 18px);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;text-align:center;padding:8px}' +
      '.cl-slot-q{font-size:1.8rem;font-weight:900;color:rgba(255,255,255,.22)}' +
      '.cl-slot-nm{font-size:.64rem;font-weight:700;color:rgba(255,255,255,.45);line-height:1.2}' +
      // ── card backs ──
      '.clr-back.cb-gold,.cb-swatch.cb-gold{background:linear-gradient(160deg,#3a2c0f,#150f04);border-color:rgba(232,194,74,.6);box-shadow:inset 0 0 0 3px rgba(232,194,74,.28)}' +
      '.clr-back.cb-gold .clr-mono,.cb-swatch.cb-gold .clr-mono{color:#f5d97a;text-shadow:0 2px 14px rgba(232,194,74,.5)}' +
      '.clr-back.cb-holo,.cb-swatch.cb-holo{background:conic-gradient(from 0deg,#3a2a4a,#243a5a,#244a44,#4a3a24,#3a2a4a);border-color:rgba(255,255,255,.42);box-shadow:inset 0 0 0 3px rgba(255,255,255,.18)}' +
      '.clr-back.cb-holo .clr-mono,.cb-swatch.cb-holo .clr-mono{color:#fff}' +
      '.clr-back.cb-midnight,.cb-swatch.cb-midnight{background:radial-gradient(circle at 30% 20%,#1a2238,#080c16);border-color:rgba(122,166,232,.42);box-shadow:inset 0 0 0 3px rgba(122,166,232,.18)}' +
      '.clr-back.cb-midnight .clr-mono,.cb-swatch.cb-midnight .clr-mono{color:#9ab8e8}' +
      '.clr-back.cb-crimson,.cb-swatch.cb-crimson{background:linear-gradient(160deg,#3a1218,#16080a);border-color:rgba(216,90,90,.5);box-shadow:inset 0 0 0 3px rgba(216,90,90,.22)}' +
      '.clr-back.cb-crimson .clr-mono,.cb-swatch.cb-crimson .clr-mono{color:#e88080}' +
      '.clr-back.cb-mastery,.cb-swatch.cb-mastery{background:conic-gradient(from 45deg,#0b0b0b,#3a2a10,#e8c24a,#3a2a10,#0b0b0b,#1a1206,#0b0b0b);border-color:rgba(232,194,74,.7);box-shadow:inset 0 0 0 3px rgba(232,194,74,.38),0 0 22px rgba(232,194,74,.32)}' +
      '.clr-back.cb-mastery .clr-mono,.cb-swatch.cb-mastery .clr-mono{color:#fff;text-shadow:0 2px 18px rgba(232,194,74,.85)}' +
      '#clCardbacks{position:fixed;inset:0;z-index:255;display:none;align-items:center;justify-content:center;padding:18px;background:rgba(0,0,0,.78);backdrop-filter:blur(7px)}' +
      '#clCardbacks.open{display:flex}' +
      '.cb-box{background:#161616;border:1px solid rgba(232,160,0,.22);border-radius:16px;width:100%;max-width:460px;max-height:86vh;overflow-y:auto;padding:18px;box-shadow:0 28px 80px rgba(0,0,0,.55)}' +
      '.cb-box h3{display:flex;justify-content:space-between;align-items:center;font-size:1.05rem;font-weight:800;margin:0 0 6px;color:#f5f5f5}.cb-box h3 span{color:#e8a000}' +
      '.cb-sub{font-size:.74rem;color:#9a9a9a;margin-bottom:14px}' +
      '.cb-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:12px}' +
      '.cb-item{cursor:pointer;text-align:center}.cb-item.locked{cursor:default}' +
      '.cb-swatch{position:relative;aspect-ratio:5/7;border-radius:11px;overflow:hidden;display:flex;align-items:center;justify-content:center;background:repeating-linear-gradient(45deg,#101a30,#101a30 9px,#13203a 9px,#13203a 18px);border:1px solid rgba(232,160,0,.32);box-shadow:inset 0 0 0 3px rgba(232,160,0,.16)}' +
      '.cb-swatch .clr-mono{font-size:1.6rem}' +
      '.cb-item.active .cb-swatch{outline:2px solid #e8a000;outline-offset:2px}' +
      '.cb-item.locked .cb-swatch{filter:grayscale(.7) brightness(.5)}' +
      '.cb-item.locked .cb-swatch::after{content:attr(data-req);position:absolute;inset:0;display:flex;align-items:center;justify-content:center;text-align:center;padding:6px;color:#fff;font-size:.66rem;font-weight:800;background:rgba(0,0,0,.55)}' +
      '.cb-nm{font-size:.7rem;font-weight:700;color:#cfcfcf;margin-top:6px}.cb-item.locked .cb-nm{color:#777}' +
      '#clAchv{position:fixed;inset:0;z-index:255;display:none;align-items:center;justify-content:center;padding:18px;background:rgba(0,0,0,.78);backdrop-filter:blur(7px)}' +
      '#clAchv.open{display:flex}' +
      '.ac-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(132px,1fr));gap:11px}' +
      '.ac-item{position:relative;border-radius:13px;padding:13px 11px 12px;text-align:center;background:#1d1d1d;border:1px solid rgba(255,255,255,.06)}' +
      '.ac-item.got{background:linear-gradient(165deg,#2a2410,#161204);border-color:rgba(232,194,74,.4);box-shadow:0 0 0 1px rgba(232,194,74,.12),0 10px 26px rgba(0,0,0,.4)}' +
      '.ac-ic{font-size:1.9rem;line-height:1;filter:grayscale(1) opacity(.4)}' +
      '.ac-item.got .ac-ic{filter:none;text-shadow:0 3px 14px rgba(232,194,74,.45)}' +
      '.ac-nm{font-size:.78rem;font-weight:800;color:#777;margin-top:7px}.ac-item.got .ac-nm{color:#f5d97a}' +
      '.ac-ds{font-size:.64rem;color:#777;margin-top:3px;line-height:1.25}.ac-item.got .ac-ds{color:#b9b9b9}' +
      '.ac-bar{height:5px;border-radius:99px;background:rgba(255,255,255,.08);overflow:hidden;margin-top:8px}.ac-bar>i{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,#e8a000,#f5c542)}' +
      '.ac-pg{font-size:.6rem;color:#888;font-weight:700;margin-top:4px}' +
      // Shine (foil) cosmetic — forces the holo overlay on regardless of rarity, plus a cool glow + sparkle tag.
      '@keyframes clShineDrift{0%{background-position:0% 50%}100%{background-position:260% 50%}}' +
      '.cl-shine .auth-foil,.cl-shine .ctc-foil{display:block;opacity:.62;animation:clShineDrift 5.5s linear infinite}' +
      '.cl-shine .auth-glit{opacity:.5}' +
      '.cl-shine .auth-card{box-shadow:0 8px 22px rgba(0,0,0,.55),0 0 0 1px rgba(190,225,255,.35),0 0 26px rgba(150,205,255,.4)}' +
      '.cl-shine .ctc-inner{box-shadow:0 6px 18px rgba(0,0,0,.5),0 0 0 1px rgba(190,225,255,.35),0 0 22px rgba(150,205,255,.4)}' +
      '.cl-shine-t{position:absolute;z-index:10;font-size:.86rem;line-height:1;filter:drop-shadow(0 1px 5px rgba(150,205,255,.95));animation:clSpark 2.4s ease-in-out infinite}' +
      '.ctc-art .cl-shine-t{top:6px;left:6px}' +
      '@keyframes clSpark{0%,100%{transform:scale(1);opacity:.85}50%{transform:scale(1.18);opacity:1}}' +
      '@media(prefers-reduced-motion:reduce){.cl-shine .auth-foil,.cl-shine .ctc-foil,.cl-shine-t{animation:none}}' +
      // ── scroll-in entrance (cards past the first screen rise as they scroll into view) ──
      '.cl-pre{opacity:0!important;transform:translateY(20px) scale(.95)!important;animation:none!important}' +
      '.cl-rise{animation:clRise .52s cubic-bezier(.2,.9,.3,1.25) both}' +
      '@keyframes clRise{from{opacity:0;transform:translateY(20px) scale(.95)}to{opacity:1;transform:none}}' +
      // ── shared-element morph: a tapped card grows into the detail view (View Transitions API) ──
      '::view-transition-group(cl-card-morph){animation-duration:.42s;animation-timing-function:cubic-bezier(.2,.8,.2,1)}' +
      '::view-transition-old(cl-card-morph),::view-transition-new(cl-card-morph){mix-blend-mode:normal}' +
      // ── WebGL godray canvas behind the legendary reveal ──
      '.clr-shader{position:absolute;inset:0;z-index:4;pointer-events:none;opacity:0;transition:opacity .5s ease}' +
      '.clr-shader.on{opacity:1}' +
      '@media(prefers-reduced-motion:reduce){.cl-pre{opacity:1!important;transform:none!important}.cl-rise{animation:none}.clr-shader{display:none}}';
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
            '<div class="cl-coll-hd-btns" id="clCollHdBtns"><span class="cl-coll-dust" id="clCollDust" title="Dust — earned from duplicates, spent to Shine cards">&#10024; 0</span><button class="cl-coll-x" aria-label="Close">&#10005;</button></div></div>' +
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
    // trophy case + card-back picker
    var acBtn = document.createElement('button');
    acBtn.className = 'cl-coll-icon'; acBtn.innerHTML = '🏅'; acBtn.title = 'Trophy case';
    acBtn.addEventListener('click', openAchievements);
    document.getElementById('clCollHdBtns').insertBefore(acBtn, m.querySelector('.cl-coll-x'));
    var cbBtn = document.createElement('button');
    cbBtn.className = 'cl-coll-icon'; cbBtn.innerHTML = '🎴'; cbBtn.title = 'Card backs';
    cbBtn.addEventListener('click', openCardbacks);
    document.getElementById('clCollHdBtns').insertBefore(cbBtn, m.querySelector('.cl-coll-x'));
    // optional debug gear (only when enabled)
    if (debugEnabled()) {
      var gear = document.createElement('button');
      gear.className = 'cl-coll-icon'; gear.innerHTML = '⚙'; gear.title = 'Debug';
      gear.addEventListener('click', debug);
      document.getElementById('clCollHdBtns').insertBefore(gear, m.querySelector('.cl-coll-x'));
    }
    return m;
  }

  var _filter = 'all', _setOpen = null;
  function isOpen() { var m = document.getElementById('clCollModal'); return m && m.classList.contains('open'); }
  function refreshOpen() { if (isOpen()) render(); if (document.getElementById('clCollDebug') && document.getElementById('clCollDebug').classList.contains('open')) renderDebug(); }

  var _holoStop = null;
  function stopHolo() { if (_holoStop) { try { _holoStop(); } catch (_) { /* noop */ } _holoStop = null; } }
  // On touch devices the grid can't hover, so the card nearest the scroll centre comes
  // alive: a gentle oscillator drifts its glare/foil and micro-tilts it (the TCG-Pocket
  // "card in focus" feel). Only one card animates at a time and it follows the scroll;
  // desktop is left to the hover tilt. Cheap: a single rAF driving one element.
  function mobileScrollHolo(grid) {
    try {
      if (reducedMotion()) return;
      if (!(window.matchMedia && matchMedia('(pointer: coarse)').matches)) return;
      var cards = Array.prototype.slice.call(grid.querySelectorAll('.auth,.ctc'));
      if (!cards.length) return;
      var active = null, inner = null, raf = 0, sraf = 0, t = Math.random() * 6;
      var VARS = ['--gx', '--gy', '--fx', '--fy', '--px', '--py'];
      function innerOf(el) { return el.querySelector('.auth-card,.ctc-inner') || el; }
      function clearActive() {
        if (inner) { inner.classList.remove('tilted'); inner.style.transform = ''; VARS.forEach(function (v) { inner.style.removeProperty(v); }); }
        active = null; inner = null;
      }
      function setActive(el) {
        if (el === active) return;
        clearActive(); active = el; inner = innerOf(el);
        if (inner) inner.classList.add('tilted');
      }
      function nearest() {
        var r = grid.getBoundingClientRect(), cy = r.top + r.height / 2, best = null, bd = 1e9;
        cards.forEach(function (el) {
          var b = el.getBoundingClientRect();
          if (b.bottom < r.top + 4 || b.top > r.bottom - 4) return;   // off-screen
          var d = Math.abs((b.top + b.height / 2) - cy);
          if (d < bd) { bd = d; best = el; }
        });
        return best;
      }
      function osc() {
        t += 0.02;
        if (inner) {
          var gx = 50 + 22 * Math.sin(t), gy = 50 + 15 * Math.cos(t * 0.8);
          inner.style.transform = 'perspective(760px) rotateX(' + (2 * Math.cos(t * 0.8)).toFixed(2) + 'deg) rotateY(' + (3 * Math.sin(t)).toFixed(2) + 'deg)';
          inner.style.setProperty('--gx', gx.toFixed(1) + '%');
          inner.style.setProperty('--gy', gy.toFixed(1) + '%');
          inner.style.setProperty('--fx', (gx * 2).toFixed(1) + '%');
          inner.style.setProperty('--fy', (gy * 2).toFixed(1) + '%');
          inner.style.setProperty('--px', (gx / 100 - 0.5).toFixed(3));
          inner.style.setProperty('--py', (gy / 100 - 0.5).toFixed(3));
        }
        raf = requestAnimationFrame(osc);
      }
      function onScroll() { if (sraf) return; sraf = requestAnimationFrame(function () { sraf = 0; var n = nearest(); if (n) setActive(n); }); }
      grid.addEventListener('scroll', onScroll, { passive: true });
      setActive(nearest() || cards[0]); raf = requestAnimationFrame(osc);
      _holoStop = function () {
        grid.removeEventListener('scroll', onScroll);
        if (raf) cancelAnimationFrame(raf); if (sraf) cancelAnimationFrame(sraf);
        clearActive();
      };
    } catch (_) { /* noop */ }
  }

  function render() {
    stopHolo();
    var st = stats();
    document.getElementById('clCollLvl').textContent = st.level;
    document.getElementById('clCollXpName').textContent = 'Level ' + st.level;
    document.getElementById('clCollXpNum').textContent = st.xpInto + ' / ' + st.xpSpan + ' XP';
    document.getElementById('clCollXpFill').style.width = Math.max(3, Math.min(100, st.xpSpan ? (st.xpInto / st.xpSpan) * 100 : 0)) + '%';
    var du = document.getElementById('clCollDust'); if (du) du.innerHTML = '&#10024; ' + dustBalance();

    var chips = [
      { k: 'all', label: 'All ' + st.count }, { k: 'film', label: 'Films ' + st.films },
      { k: 'person', label: 'People ' + st.people }, { k: 'sets', label: 'Sets' },
      { k: 'legendary', label: 'Legendary ' + st.byRarity.legendary }, { k: 'elite', label: 'Elite ' + st.byRarity.elite }
    ];
    document.getElementById('clCollChips').innerHTML = chips.map(function (c) {
      return '<button class="cl-coll-chip' + (_filter === c.k ? ' on' : '') + '" data-k="' + c.k + '">' + esc(c.label) + '</button>';
    }).join('');
    Array.prototype.forEach.call(document.querySelectorAll('#clCollChips .cl-coll-chip'), function (b) {
      b.addEventListener('click', function () { _filter = b.dataset.k; _setOpen = null; render(); });
    });

    if (_filter === 'sets') { renderSets(); return; }

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
      el.addEventListener('click', function () { openDetail(cards[idx], el); });
    });
    scrollReveal(grid);
    mobileScrollHolo(grid);
  }

  // Cards past the first screen start hidden and rise as they scroll into view —
  // the staggered Apple/Linear entrance. Progressive enhancement: a safety timer
  // reveals everything if IntersectionObserver misfires, and reduced-motion opts out.
  function scrollReveal(grid) {
    try {
      if (reducedMotion() || !window.IntersectionObserver) return;
      var kids = grid.children; if (kids.length <= 8) return;
      Array.prototype.forEach.call(kids, function (el, i) { if (i >= 8) el.classList.add('cl-pre'); });
      var io = new window.IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { en.target.classList.remove('cl-pre'); en.target.classList.add('cl-rise'); io.unobserve(en.target); }
        });
      }, { root: grid, rootMargin: '0px 0px -6% 0px', threshold: 0.06 });
      Array.prototype.forEach.call(kids, function (el, i) { if (i >= 8) io.observe(el); });
      setTimeout(function () {
        try { Array.prototype.forEach.call(grid.querySelectorAll('.cl-pre'), function (el) { el.classList.remove('cl-pre'); el.classList.add('cl-rise'); }); } catch (_) { /* noop */ }
      }, 2600);
    } catch (_) { /* noop */ }
  }

  function renderSets() {
    var grid = document.getElementById('clCollGrid');
    try { claimSets(); } catch (_) { /* claim passively-completed (milestone) sets */ }
    var states = setsState();
    if (_setOpen) {
      var set = null; states.forEach(function (s) { if (s.id === _setOpen) set = s; });
      if (!set || set.kind !== 'curated') { _setOpen = null; renderSets(); return; }
      var theme = activeTheme(); injectThemeCss(theme);
      grid.style.display = 'grid';
      grid.style.gridTemplateColumns = 'repeat(auto-fill,' + (theme.gridCols || 'minmax(110px,1fr)') + ')';
      var owned = [];
      grid.innerHTML = '<div class="cl-set-head"><button class="cl-back-btn" id="clSetBack">&#8249; Sets</button><span class="cl-set-htitle">' + esc(set.name) + ' &middot; ' + set.owned + '/' + set.total + (set.complete ? ' &#10003;' : '') + '</span></div>' +
        set.members.map(function (m, i) {
          if (m.owned) { owned.push(m.card); return theme.card(m.card, CTX, i); }
          return '<div class="cl-slot"><div class="cl-slot-q">?</div><div class="cl-slot-nm">' + esc(m.name) + '</div></div>';
        }).join('');
      document.getElementById('clSetBack').addEventListener('click', function () { _setOpen = null; render(); });
      try { if (theme.mount) theme.mount(grid); } catch (_) { /* noop */ }
      var oi = 0;
      Array.prototype.forEach.call(grid.querySelectorAll('.auth,.ctc,.clc-card'), function (el) {
        var card = owned[oi++]; if (!card) return;
        el.style.cursor = 'pointer'; el.addEventListener('click', function () { openDetail(card, el); });
      });
      return;
    }
    grid.style.display = 'block';
    grid.innerHTML = states.map(function (s) {
      return '<button class="cl-set' + (s.complete ? ' done' : '') + '" data-set="' + s.id + '">' +
        '<div class="cl-set-tx"><div class="cl-set-nm">' + esc(s.name) + (s.complete ? '<span class="cl-set-done">&#10003; Complete</span>' : '') + '</div>' +
        '<div class="cl-set-bar"><i style="width:' + Math.round(s.pct * 100) + '%"></i></div></div>' +
        '<div class="cl-set-ct">' + s.owned + '/' + s.total + '</div>' +
        (s.kind === 'curated' ? '<div class="cl-set-arrow">&#8250;</div>' : '') + '</button>';
    }).join('');
    Array.prototype.forEach.call(grid.querySelectorAll('.cl-set'), function (el) {
      el.addEventListener('click', function () {
        var sid = el.getAttribute('data-set'), s = null; states.forEach(function (x) { if (x.id === sid) s = x; });
        if (s && s.kind === 'curated') { _setOpen = sid; render(); }
      });
    });
  }

  function openGallery() {
    injectShell(); buildModal(); injectThemeCss(activeTheme());
    _filter = 'all'; render();
    document.getElementById('clCollModal').classList.add('open');
    try { if (window.Track) window.Track('collection_open', stats()); } catch (_) { /* noop */ }
    setTimeout(markSeen, 600);
  }
  function close() { stopHolo(); var m = document.getElementById('clCollModal'); if (m) m.classList.remove('open'); }

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
    var shined = isShined(c), cost = shineCost(c), bal = dustBalance(), afford = bal >= cost;
    var shineBlock = shined
      ? '<div class="cl-shine-done">&#10024; Shined</div>'
      : '<button class="cl-shine-btn' + (afford ? '' : ' off') + '" id="clShineBtn">&#10024; Shine &middot; ' + cost + ' dust</button>' +
        '<div class="cl-shine-hint">You have ' + bal + ' dust' + (afford ? '' : ' &middot; need ' + (cost - bal) + ' more') + '</div>';
    return '<div class="cl-di-name">' + esc(c.name) + '</div><div class="cl-di-rows">' +
      rows.map(function (r) { return '<div class="cl-di-row"><span>' + r[0] + '</span><b' + (r[2] ? ' style="color:' + r[2] + '"' : '') + '>' + esc(r[1]) + '</b></div>'; }).join('') +
      '</div><div class="cl-shine-wrap">' + shineBlock + '</div>';
  }
  var DETAIL_SEL = '#clDetailCard .auth-card,#clDetailCard .ctc-inner,#clDetailCard .clc-card';
  function openDetail(c, srcEl) {
    if (!c) return;
    function fill() {
      buildDetail();
      var theme = activeTheme(); injectThemeCss(theme);
      var holder = document.getElementById('clDetailCard');
      holder.innerHTML = theme.card(c, CTX, 0);
      // the card renders at 2× here — pull a higher-res TMDB poster so it stays crisp
      Array.prototype.forEach.call(holder.querySelectorAll('img'), function (im) { im.src = im.src.replace(/\/t\/p\/w\d+\//, '/t/p/w780/'); });
      try { if (theme.mount) theme.mount(holder); } catch (_) { /* noop */ }
      document.getElementById('clDetailInfo').innerHTML = detailInfo(c);
      var sb = document.getElementById('clShineBtn');
      if (sb) sb.addEventListener('click', function () {
        var r = shineCard(c);
        if (r.ok) { c.shine = 1; try { if (window.Sfx) { window.Sfx.reveal('elite'); window.Sfx.haptic([12, 24]); } } catch (_) { /* noop */ } openDetail(c); }
        else { try { if (window.Sfx) window.Sfx.tap(); } catch (_) { /* noop */ } if (r.reason === 'dust') { sb.classList.add('shake'); setTimeout(function () { sb.classList.remove('shake'); }, 420); } }
      });
      document.getElementById('clCollDetail').classList.add('open');
      stopGyro();                        // gyro paused for now (re-enable: _gyroOff = gyroMount(holder))
      dragTiltMount(holder);             // touch: drag a finger on the card to tilt it
      // tap-to-open shimmer: a light sweep across the card as it appears
      var ac = holder.querySelector('.auth-card');
      if (ac && window.Fx && window.Fx.play) window.Fx.play(ac, 'sheen-go', 800);
      try { if (window.Track) window.Track('collection_card', { rarity: c.rarity, type: c.type }); } catch (_) { /* noop */ }
    }
    // Shared-element morph: the tapped grid card grows seamlessly into the detail card.
    var srcCard = (srcEl && srcEl.querySelector) ? srcEl.querySelector('.auth-card,.ctc-inner,.clc-card') : null;
    if (srcCard && document.startViewTransition && !reducedMotion()) {
      try {
        srcCard.style.viewTransitionName = 'cl-card-morph';
        var t = document.startViewTransition(function () {
          srcCard.style.viewTransitionName = '';                 // hand the name to the detail card
          fill();
          var tgt = document.querySelector(DETAIL_SEL);
          if (tgt) tgt.style.viewTransitionName = 'cl-card-morph';
        });
        t.finished.then(function () { var tgt = document.querySelector(DETAIL_SEL); if (tgt) tgt.style.viewTransitionName = ''; }).catch(function () { /* noop */ });
        return;
      } catch (_) { try { srcCard.style.viewTransitionName = ''; } catch (_) { /* noop */ } }
    }
    fill();
  }
  function closeDetail() { stopGyro(); var d = document.getElementById('clCollDetail'); if (d) d.classList.remove('open'); }

  // ── Reveal sequence: the "earn" moment. reveal(newCards) plays a per-card
  // flip with rarity-scaled flair (sound + haptics + legendary flash), then a
  // summary with XP and any level-up. Auto-plays after a win; skippable. ──
  function buildReveal() {
    var ov = document.getElementById('clCollReveal');
    if (ov) return ov;
    injectShell();
    ov = document.createElement('div'); ov.id = 'clCollReveal'; ov.setAttribute('role', 'dialog');
    ov.innerHTML = '<div class="clr-flash" id="clrFlash"></div><div class="clr-progress" id="clrDots"></div>' +
      '<button class="clr-skip" id="clrSkip">Skip &#9197;</button><div id="clrBody"></div>';
    document.body.appendChild(ov);
    return ov;
  }
  function closeReveal() { stopShader(); stopGyro(); var ov = document.getElementById('clCollReveal'); if (ov) ov.classList.remove('open'); }
  function reveal(cards) {
    try {
      if (!Array.isArray(cards)) return;
      var queue = cards.filter(function (c) { return c && c.rarity && RARITY[c.rarity]; });
      if (!queue.length) return;
      queue.sort(function (a, b) { return ORDER[b.rarity] - ORDER[a.rarity]; }); // climax (rarest) last
      injectShell();
      var theme = activeTheme(); injectThemeCss(theme);
      var ov = buildReveal();
      var gained = queue.reduce(function (s, c) { return s + (XP[c.rarity] || 10); }, 0);
      var afterXp = (load() || blank()).xp || 0, beforeXp = afterXp - gained;
      var lvlAfter = levelFromXp(afterXp), lvlBefore = levelFromXp(beforeXp);
      var reduced = reducedMotion();
      var timers = []; function clearT() { timers.forEach(clearTimeout); timers = []; }
      function later(ms, fn) { timers.push(setTimeout(fn, ms)); }
      var idx = 0, state = '';
      document.getElementById('clrDots').innerHTML = queue.map(function () { return '<span class="clr-dot"></span>'; }).join('');
      function setDots() { Array.prototype.forEach.call(ov.querySelectorAll('.clr-dot'), function (x, i) { x.classList.toggle('on', i <= idx); }); }
      function card(c) {
        var tier = c.rarity, rl = RARITY[tier];
        document.getElementById('clrBody').innerHTML =
          '<div class="clr-stage"><div class="clr-flip" id="clrFlip" style="--halo:' + rl.ring + '">' +
          '<div class="clr-back ' + activeCardbackClass() + '"><div class="clr-halo"></div><div class="clr-mono">CL</div></div>' +
          '<div class="clr-face" id="clrFace"></div></div></div>' +
          '<div class="clr-cap" id="clrCap"></div>' +
          '<div class="clr-hint">' + (idx < queue.length - 1 ? 'tap for next' : 'tap to finish') + '</div>';
        document.getElementById('clrFace').innerHTML = theme.card(c, CTX, 0);
        setDots();
        var flip = document.getElementById('clrFlip');
        state = 'anim';
        if (reduced) { flip.classList.add('flipped'); showCap(c); state = 'ready'; return; }
        try { if (window.Sfx) { window.Sfx.cardFlip(); window.Sfx.haptic(tier === 'legendary' ? [10, 30] : 8); } } catch (_) { /* noop */ }
        later(360, function () { flip.classList.add('flip-go'); });            // keyframe flip (1.05s)
        later(900, function () {                                                // ~crossover: front swings into view
          try { if (window.Sfx) window.Sfx.reveal(tier); } catch (_) { /* noop */ }
          if (tier === 'legendary') {
            var fl = document.getElementById('clrFlash'); if (fl) { fl.classList.remove('go'); void fl.offsetWidth; fl.classList.add('go'); }
            try { if (window.Sfx) window.Sfx.haptic([20, 40, 20, 40, 90]); } catch (_) { /* noop */ }
            try { if (window.Fx && window.Fx.confetti) window.Fx.confetti({ count: 130, power: 1.25 }); } catch (_) { /* noop */ }
            startShader();                                                       // prismatic godrays behind the legendary card
          }
        });
        later(1420, function () {                                               // flip settled: mount tilt + idle + cap
          var face = document.getElementById('clrFace');
          try { if (theme.mount) theme.mount(face); } catch (_) { /* noop */ }
          stopGyro();                                                           // gyro paused for now (re-enable: _gyroOff = gyroMount(face))
          var f = document.getElementById('clrFlip'); if (f) f.classList.add('live');
          showCap(c); state = 'ready';
        });
        later(3600, function () { if (state === 'ready') next(); });
      }
      function showCap(c) {
        var cap = document.getElementById('clrCap'); if (!cap) return;
        var rl = RARITY[c.rarity];
        cap.innerHTML = '<span class="clr-tag new">New</span><span class="clr-rare-lbl" style="color:' + rl.ring + '">' + rl.label + '</span><span class="clr-xp">+' + (XP[c.rarity] || 10) + ' XP</span>';
        try { if (window.Sfx) window.Sfx.haptic(c.rarity === 'legendary' ? [20, 40, 60] : c.rarity === 'elite' ? [15, 30] : 10); } catch (_) { /* noop */ }
      }
      function next() { clearT(); stopShader(); stopGyro(); idx++; if (idx >= queue.length) summary(); else card(queue[idx]); }
      function summary() {
        state = 'sum'; stopShader(); stopGyro();
        var newSets = []; try { newSets = claimSets(); } catch (_) { /* noop */ }
        var finalXp = (load() || blank()).xp || 0, lvlNow = levelFromXp(finalXp);
        if (lvlNow > lvlBefore) { try { if (window.Sfx) window.Sfx.levelUp(); } catch (_) { /* noop */ } }
        else if (newSets.length) { try { if (window.Sfx) window.Sfx.allDone(); } catch (_) { /* noop */ } }
        var setLines = newSets.map(function (st) { return '<div class="clr-sum-lvl">⭐ Set complete: ' + esc(st.name) + ' &middot; +' + st.bonus + ' XP</div>'; }).join('');
        var lvlLine = lvlNow > lvlBefore ? '<div class="clr-sum-lvl">Level up &mdash; level ' + lvlNow + '! 🎉</div>' : '';
        var newBacks = lvlNow > lvlBefore ? cardbacksUnlockedBetween(lvlBefore, lvlNow) : [];
        var backLine = newBacks.map(function (cb) { return '<div class="clr-sum-lvl">🎴 Card back unlocked: ' + esc(cb.name) + '</div>'; }).join('');
        var newAchv = []; try { newAchv = syncAchievements(); } catch (_) { /* noop */ }
        if (newAchv.length) { try { if (window.Sfx) window.Sfx.allDone(); } catch (_) { /* noop */ } }
        var achLine = newAchv.slice(0, 3).map(function (a) { return '<div class="clr-sum-lvl">' + a.icon + ' Achievement: ' + esc(a.name) + '</div>'; }).join('') +
          (newAchv.length > 3 ? '<div class="clr-sum-lvl">🏅 +' + (newAchv.length - 3) + ' more achievements</div>' : '');
        // achievement-gated card backs (e.g. Mastery) newly crossed this win
        if (newAchv.length) { var ac2 = achvCount(); backLine += cardbacksUnlockedByAchv(ac2 - newAchv.length, ac2).map(function (cb) { return '<div class="clr-sum-lvl">🎴 Card back unlocked: ' + esc(cb.name) + '</div>'; }).join(''); }
        var dustLine = _pendingDust > 0 ? '<div class="clr-sum-lvl">&#10024; +' + _pendingDust + ' dust from duplicates</div>' : '';
        _pendingDust = 0;
        document.getElementById('clrBody').innerHTML =
          '<div class="clr-sum"><div class="clr-sum-h">+' + queue.length + (queue.length === 1 ? ' card' : ' cards') + '</div>' +
          '<div class="clr-sum-x">+' + gained + ' XP</div>' + setLines + lvlLine + backLine + achLine + dustLine +
          '<div class="clr-sum-btns"><button class="clr-btn" id="clrAgain">Continue</button><button class="clr-btn gold" id="clrView">View collection</button></div></div>';
        var sk = document.getElementById('clrSkip'); if (sk) sk.style.display = 'none';
        ov.onclick = null;
        document.getElementById('clrView').onclick = function (e) { e.stopPropagation(); closeReveal(); openGallery(); };
        document.getElementById('clrAgain').onclick = function (e) { e.stopPropagation(); closeReveal(); };
      }
      var skip = document.getElementById('clrSkip');
      skip.style.display = ''; skip.onclick = function (e) { e.stopPropagation(); clearT(); summary(); };
      ov.onclick = function () { if (state === 'ready') next(); };
      ov.classList.add('open');
      try { if (window.Sfx) window.Sfx.cardDeal(); } catch (_) { /* noop */ }
      try { if (window.Track) window.Track('card_revealed', { n: queue.length, top: queue[queue.length - 1].rarity }); } catch (_) { /* noop */ }
      card(queue[0]);
    } catch (_) { /* noop */ }
  }

  // ── Card-back picker ──
  function buildCardbacks() {
    var d = document.getElementById('clCardbacks');
    if (d) return d;
    injectShell();
    d = document.createElement('div'); d.id = 'clCardbacks'; d.setAttribute('role', 'dialog');
    d.innerHTML = '<div class="cb-box"><h3>Card <span>backs</span><button class="cl-coll-x" id="cbClose" style="font-size:1.2rem">&#10005;</button></h3>' +
      '<div class="cb-sub">Unlock card backs by leveling up — or earn Mastery in the trophy case. Tap to equip.</div><div class="cb-grid" id="cbGrid"></div></div>';
    document.body.appendChild(d);
    d.querySelector('#cbClose').addEventListener('click', function () { d.classList.remove('open'); });
    d.addEventListener('click', function (e) { if (e.target === d) d.classList.remove('open'); });
    return d;
  }
  function renderCardbacks() {
    var grid = document.getElementById('cbGrid'); if (!grid) return;
    grid.innerHTML = cardbacksState().map(function (cb) {
      var lock = cb.req.type === 'achv' ? ('🔒 ' + cb.req.need + ' trophies') : ('🔒 Lvl ' + cb.req.need);
      return '<div class="cb-item' + (cb.active ? ' active' : '') + (cb.unlocked ? '' : ' locked') + '" data-id="' + cb.id + '">' +
        '<div class="cb-swatch ' + cb.css + '" data-req="' + lock + '"><div class="clr-mono">CL</div></div>' +
        '<div class="cb-nm">' + esc(cb.name) + '</div></div>';
    }).join('');
    Array.prototype.forEach.call(grid.querySelectorAll('.cb-item'), function (el) {
      el.addEventListener('click', function () {
        if (el.classList.contains('locked')) return;
        if (useCardback(el.getAttribute('data-id'))) { renderCardbacks(); try { if (window.Sfx) window.Sfx.tap(); } catch (_) { /* noop */ } }
      });
    });
  }
  function openCardbacks() { buildCardbacks(); renderCardbacks(); document.getElementById('clCardbacks').classList.add('open'); }

  // ── Achievements trophy case ──
  function buildAchv() {
    var d = document.getElementById('clAchv');
    if (d) return d;
    injectShell();
    d = document.createElement('div'); d.id = 'clAchv'; d.setAttribute('role', 'dialog');
    d.innerHTML = '<div class="cb-box"><h3>Trophy <span>case</span><button class="cl-coll-x" id="acClose" style="font-size:1.2rem">&#10005;</button></h3>' +
      '<div class="cb-sub" id="acSub"></div><div class="ac-grid" id="acGrid"></div></div>';
    document.body.appendChild(d);
    d.querySelector('#acClose').addEventListener('click', function () { d.classList.remove('open'); });
    d.addEventListener('click', function (e) { if (e.target === d) d.classList.remove('open'); });
    return d;
  }
  function renderAchv() {
    var grid = document.getElementById('acGrid'); if (!grid) return;
    var st = achievementsState(), got = st.filter(function (a) { return a.unlocked; }).length;
    var sub = document.getElementById('acSub'); if (sub) sub.innerHTML = got + ' / ' + st.length + ' unlocked';
    grid.innerHTML = st.map(function (a) {
      var pct = Math.max(0, Math.min(100, Math.round(a.have / a.need * 100)));
      var bar = a.unlocked ? '' : '<div class="ac-bar"><i style="width:' + pct + '%"></i></div><div class="ac-pg">' + a.have + ' / ' + a.need + '</div>';
      return '<div class="ac-item' + (a.unlocked ? ' got' : '') + '"><div class="ac-ic">' + a.icon + '</div>' +
        '<div class="ac-nm">' + esc(a.name) + '</div><div class="ac-ds">' + esc(a.desc) + '</div>' + bar + '</div>';
    }).join('');
  }
  function openAchievements() { syncAchievements(); buildAchv(); renderAchv(); document.getElementById('clAchv').classList.add('open'); }

  // expose + init
  window.Collection = {
    add: add, stats: stats, all: allCards, openGallery: openGallery, markSeen: markSeen, reveal: reveal, sets: setsState,
    cardbacks: cardbacksState, useCardback: useCardback, openCardbacks: openCardbacks,
    achievements: achievementsState, openAchievements: openAchievements,
    dust: dustBalance, shine: shineCard, shineCost: shineCost, isShined: isShined,
    addDust: function (n) { var s = load() || blank(); s.dust = Math.max(0, (s.dust || 0) + (+n || 0)); save(s); refreshOpen(); return s.dust; },
    reset: reset, grant: grant, addXp: addXp, setLevel: setLevel, exportData: exportData, importData: importData, seed: function () { return grant(SEED.map(function (s) { return s; })); },
    debug: debug,
    themes: { register: defineTheme, use: useTheme, list: function () { return Object.keys(THEMES).map(function (n) { return { name: n, label: THEMES[n].label || n }; }); }, current: activeThemeName }
  };
  // Record already-earned achievements once on load (silent — no reveal spam for an existing save).
  try { window.addEventListener('load', function () { try { syncAchievements(); } catch (_) { /* noop */ } }); } catch (_) { /* noop */ }
  if (debugEnabled()) { try { window.addEventListener('load', function () { try { debug(); } catch (_) { /* noop */ } }); } catch (_) { /* noop */ } }
})();
