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
  // dupe = 5 (half a common): with a mature collection most daily cards are dupes,
  // so this is the late-game levelling pace — 3 made levels crawl to a halt.
  var XP = { common: 10, rare: 25, elite: 50, legendary: 100, dupe: 5 };
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
  function blank() { return { v: SCHEMA, cards: {}, xp: 0, seen: 0, lvlPaid: 1 }; }
  function save(s) { try { s.v = SCHEMA; localStorage.setItem(KEY, JSON.stringify(s)); } catch (_) { /* noop */ } }
  function today() { return new Date().toISOString().slice(0, 10); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function posterUrl(p) { if (!p) return ''; return /^https?:/.test(p) ? p : IMG + p; }
  function typeLabel(c) { return c.type === 'person' ? CT('Person') : c.type === 'tv' ? CT('Series') : CT('Film'); }
  function reducedMotion() { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) { return false; } }
  // Live-tunable depth-zoom params (driven by the ?cvdebug=1 slider panel). Defaults
  // are the shipped values; the shader reads these each frame so sliders update live.
  var DEPTH_CFG = window.CL_DEPTH_CFG = (window.CL_DEPTH_CFG || { zoom: 0.03, aoStr: 1, aoMax: 0.16, ease: 0.04, ovs: 1.0 });
  try { if (/[?&]cvdebug=1\b/.test(location.search)) document.documentElement.style.setProperty('--ovs', DEPTH_CFG.ovs); } catch (_) { /* noop */ }
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
        inner.style.setProperty('--pfc', Math.min(1, Math.hypot(px - 0.5, py - 0.5) * 2).toFixed(3));
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
  // Desktop grid: on hover, mount the depth-parallax canvas on the hovered card so the
  // zoom-in is DEPTH-AWARE (the subject magnifies out of the frame via the depth map
  // while the background stays put), then tear it down on leave to free the WebGL
  // context. One card at a time, with a short delay so quick pass-overs don't spawn
  // contexts. Driven by the `--dz` var the shader loop eases into the `zoom` uniform.
  function gridDepthHover(grid, sel, innerSel) {
    if (reducedMotion()) return;
    try { if (matchMedia('(pointer: coarse)').matches) return; } catch (_) { return; }
    var activeInner = null;                                            // only one live grid canvas at a time
    function unmount(inner) {
      if (!inner) return;
      inner.style.setProperty('--dz', '0');
      var cv = inner.querySelector('.auth-bgcv');
      if (cv) { try { var im = inner.querySelector('.auth-bgimg, .ctc-art img'); if (im) im.style.visibility = ''; cv.remove(); } catch (_) { /* noop */ } }
      inner.classList.remove('fx-out');                                // back to rest: normal FX gating for the next hover
    }
    Array.prototype.forEach.call(grid.querySelectorAll(sel), function (card) {
      var inner = card.querySelector(innerSel); if (!inner) return;
      var leaveT = 0;
      // Mount immediately on hover (no delay) so the depth zoom eases in FROM the start
      // of the hover instead of appearing after a beat. The canvas always starts at
      // zoom 0 (= the <img>), so the img->canvas swap is invisible and there is no jump
      // from a plain scale to the depth zoom. Only one card's canvas lives at a time.
      card.addEventListener('pointerenter', function (e) {
        if (e.pointerType && e.pointerType !== 'mouse') return;
        clearTimeout(leaveT);
        if (activeInner && activeInner !== inner) unmount(activeInner);
        activeInner = inner;
        inner.classList.remove('fx-out');
        inner.style.setProperty('--dz', '1');
        if (!inner.querySelector('.auth-bgcv')) { try { mountPosterDepth(card); } catch (_) { /* keep the img */ } }
      });
      card.addEventListener('pointerleave', function () {
        inner.style.setProperty('--dz', '0');                        // ease the zoom back out first
        inner.classList.add('fx-out');                               // and fade every hover brightness/glow out in sync
        clearTimeout(leaveT);
        leaveT = setTimeout(function () {
          if (inner.style.getPropertyValue('--dz') !== '1') { unmount(inner); if (activeInner === inner) activeInner = null; }
        }, 640);                                                      // grace: keep the canvas until the zoom has fully eased out, then swap the <img> back
      });
    });
  }
  // ?cvdebug=1 : floating panel with a live preview card + sliders to tune the depth
  // zoom / fake-AO / overscan / ease and read off the best combination. Dev only.
  function mountDepthDebug() {
    try {
      if ((!/[?&]cvdebug=1\b/.test(location.search) && !debugEnabled()) || document.getElementById('cvDbg')) return;
      var poster = posterUrl('/RYMX2wcKCBAr24UyPD7xwmjaTn.jpg');      // The Avengers (cast in front, deep bg)
      function row(label, key, min, max, step) {
        return '<label style="display:block;margin:9px 0 2px">' + label + ' <b id="cvv_' + key + '" style="color:#f5c542">' + DEPTH_CFG[key === 'ovs' ? 'ovs' : key] + '</b>' +
          '<input type="range" data-k="' + key + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + DEPTH_CFG[key] + '" style="width:100%;accent-color:#e8a000;margin-top:3px"></label>';
      }
      var p = document.createElement('div');
      p.id = 'cvDbg';
      p.style.cssText = 'position:fixed;right:14px;bottom:14px;z-index:100000;width:250px;background:rgba(37,44,53,.97);border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:14px;color:#eee;font:12px/1.35 system-ui,-apple-system,sans-serif;box-shadow:0 24px 70px rgba(0,0,0,.65);backdrop-filter:blur(8px)';
      p.innerHTML =
        '<div style="font-weight:800;margin-bottom:10px;color:#e8a000;display:flex;justify-content:space-between;align-items:center">Depth zoom debug<span id="cvDbgX" style="cursor:pointer;opacity:.6">✕</span></div>' +
        '<div style="width:150px;margin:0 auto 10px"><div class="auth auth-common" id="cvDbgPrevWrap"><div class="auth-card tilted" id="cvDbgPrev" style="--dz:1;position:relative;aspect-ratio:2/3;border-radius:12px;overflow:hidden;background:#111"><img class="auth-bgimg" crossorigin="anonymous" src="' + poster + '" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center top"></div></div></div>' +
        row('Depth zoom', 'zoom', 0, 0.6, 0.01) +
        row('AO strength', 'aoStr', 0, 6, 0.1) +
        row('AO max', 'aoMax', 0, 0.85, 0.02) +
        row('Ease speed', 'ease', 0.02, 0.3, 0.01) +
        row('Overscan', 'ovs', 1, 1.18, 0.005) +
        '<button id="cvDbgCopy" style="margin-top:10px;width:100%;padding:8px;border-radius:8px;border:0;background:#e8a000;color:#1a1200;font-weight:800;cursor:pointer">Copy values</button>' +
        '<div id="cvDbgOut" style="margin-top:7px;font-size:10px;color:#9a9a9e;word-break:break-all"></div>';
      document.body.appendChild(p);
      document.documentElement.style.setProperty('--ovs', DEPTH_CFG.ovs);
      mountPosterDepth(document.getElementById('cvDbgPrevWrap'));      // preview canvas, always at --dz:1
      p.addEventListener('input', function (e) {
        var k = e.target.dataset.k; if (!k) return;
        var v = parseFloat(e.target.value);
        if (k === 'ovs') { DEPTH_CFG.ovs = v; document.documentElement.style.setProperty('--ovs', v); }
        else DEPTH_CFG[k] = v;
        var lbl = document.getElementById('cvv_' + k); if (lbl) lbl.textContent = v;
      });
      document.getElementById('cvDbgCopy').onclick = function () {
        var s = 'zoom ' + DEPTH_CFG.zoom + ' · aoStr ' + DEPTH_CFG.aoStr + ' · aoMax ' + DEPTH_CFG.aoMax + ' · ease ' + DEPTH_CFG.ease + ' · ovs ' + DEPTH_CFG.ovs;
        try { navigator.clipboard.writeText(s); } catch (_) { /* noop */ }
        document.getElementById('cvDbgOut').textContent = s;
      };
      document.getElementById('cvDbgX').onclick = function () { p.remove(); };
    } catch (_) { /* noop */ }
  }
  // ?cvdebug=1 : a persistent floating button (anywhere in the app) that toggles the
  // depth-tuning panel, so the values can be edited without opening the Vault first.
  function depthDebugButton() {
    try {
      if ((!/[?&]cvdebug=1\b/.test(location.search) && !debugEnabled()) || document.getElementById('cvDbgBtn')) return;
      var b = document.createElement('button');
      b.id = 'cvDbgBtn';
      b.textContent = '⚙ depth';
      b.style.cssText = 'position:fixed;left:14px;bottom:14px;z-index:100001;background:#e8a000;color:#1a1200;border:0;border-radius:999px;padding:9px 15px;font:800 12px system-ui,-apple-system,sans-serif;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.5)';
      b.onclick = function () { var p = document.getElementById('cvDbg'); if (p) p.remove(); else mountDepthDebug(); };
      document.body.appendChild(b);
    } catch (_) { /* noop */ }
  }
  // Toggle debug mode from ANY screen (collection.js loads on every page): Cmd/Ctrl+Shift+D
  // on desktop, or 4 quick taps in the bottom-left corner on touch. Flips cl_debug and
  // shows/hides the tuning button immediately, with a small confirmation toast.
  function enableDebugGesture() {
    try {
      function flip() {
        var on = false; try { on = localStorage.getItem('cl_debug') === '1'; } catch (_) { /* noop */ }
        try { if (on) localStorage.removeItem('cl_debug'); else localStorage.setItem('cl_debug', '1'); } catch (_) { /* noop */ }
        var btn = document.getElementById('cvDbgBtn'), panel = document.getElementById('cvDbg');
        if (on) { if (btn) btn.remove(); if (panel) panel.remove(); } else { depthDebugButton(); }
        var t = document.createElement('div');
        t.textContent = 'Debug ' + (on ? 'off' : 'on');
        t.style.cssText = 'position:fixed;left:50%;bottom:72px;transform:translateX(-50%);z-index:100002;background:rgba(30,37,46,.96);color:#e8a000;border:1px solid rgba(232,160,0,.4);padding:8px 16px;border-radius:999px;font:800 12px system-ui,sans-serif;pointer-events:none;box-shadow:0 8px 24px rgba(0,0,0,.5)';
        document.body.appendChild(t);
        setTimeout(function () { try { t.remove(); } catch (_) { /* noop */ } }, 1400);
      }
      window.addEventListener('keydown', function (e) {
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'D' || e.key === 'd')) { e.preventDefault(); flip(); }
      });
      var taps = 0, last = 0;
      window.addEventListener('pointerdown', function (e) {
        if (e.clientX > 46 || e.clientY < window.innerHeight - 46) { taps = 0; return; } // bottom-left corner only
        var now = e.timeStamp || 0;
        if (now - last > 1400) taps = 0;
        last = now; taps++;
        if (taps >= 4) { taps = 0; flip(); }
      }, true);
    } catch (_) { /* noop */ }
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
        inner.style.transform = 'perspective(700px) rotateX(' + rx.toFixed(2) + 'deg) rotateY(' + ry.toFixed(2) + 'deg)';
        inner.style.setProperty('--gx', (px * 100).toFixed(1) + '%');
        inner.style.setProperty('--gy', (py * 100).toFixed(1) + '%');
        inner.style.setProperty('--fx', (px * 200).toFixed(1) + '%');
        inner.style.setProperty('--fy', (py * 200).toFixed(1) + '%');
        inner.style.setProperty('--px', (px - 0.5).toFixed(3));
        inner.style.setProperty('--py', (py - 0.5).toFixed(3));
        inner.style.setProperty('--pfc', Math.min(1, Math.hypot(px - 0.5, py - 0.5) * 2).toFixed(3));
        inner.classList.add('tilted');
        raf = requestAnimationFrame(frame);
      }
      // Calibrate to the pose the phone is in when the view opens: the first reading
      // becomes 0,0 (card flat), and tilting is measured from there — instead of
      // assuming some universal "held at 38°" grip.
      var b0 = null, g0 = null;
      function onOrient(e) {
        if (b0 === null) { b0 = e.beta || 0; g0 = e.gamma || 0; }
        // More dramatic gyro on phones: reach the full range with less phone tilt
        // (÷24) and lean the card harder (±22° instead of ±13°).
        var g = clamp(((e.gamma || 0) - g0) / 24), b = clamp(((e.beta || 0) - b0) / 24);
        tpx = 0.5 + g * 0.5; tpy = 0.5 + b * 0.5; try_ = g * 22; trx = -b * 22;
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
        inner.style.setProperty('--pfc', Math.min(1, Math.hypot(px - 0.5, py - 0.5) * 2).toFixed(3));
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
        stopGyro();                       // finger takes over — two rAF loops writing the same transform fight
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

  // ── Depth-parallax poster (detail view): the poster is re-rendered in a small
  // WebGL canvas whose fragment shader displaces UVs by a procedural pseudo-depth
  // (subject centre-upper pops forward, edges recede) driven by the live tilt vars —
  // the "TCG Pocket" in-art 3D feel. Single canvas + uniform updates per frame, so
  // it is safe under the mobile no-blend/no-repaint compositing constraint, and the
  // depth function can later be swapped for a real per-poster depth-map texture.
  // Fails soft at every step (no WebGL, CORS, no image) → the plain <img> stays.
  function mountPosterDepth(holder) {
    try {
      if (reducedMotion() || !holder) return;
      var inner = holder.querySelector('.auth-card, .ctc-inner'); if (!inner) return;
      var img = inner.querySelector('.auth-bgimg, .ctc-art img'); if (!img || !img.src) return;
      var cv = document.createElement('canvas');
      cv.className = 'auth-bgcv';
      var artCv = inner.classList.contains('auth-card');
      cv.style.cssText = 'position:absolute;top:-1px;left:' + (artCv ? '16%' : '-1px') + ';width:' + (artCv ? 'calc(84% + 1px)' : 'calc(100% + 2px)') + ';height:calc(100% + 2px);z-index:0;pointer-events:none';
      var gl = cv.getContext('webgl', { alpha: false, antialias: false });
      if (!gl) return;
      var VS = 'attribute vec2 p;varying vec2 v;void main(){v=p*.5+.5;gl_Position=vec4(p,0.,1.);}';
      // Depth: a real per-poster map (white = near) when /depth/<basename> exists,
      // else the procedural centre-weighted blob. On touch the holo also lives here:
      // rainbow foil as color-dodge math and glare as screen math — the exact look
      // DOM blend layers could never survive on Android.
      var FS = 'precision mediump float;varying vec2 v;' +
        'uniform sampler2D img;uniform sampler2D dmap;' +
        'uniform vec2 cov;uniform vec2 off;uniform vec2 tilt;uniform float hasD;' +
        'uniform vec2 glr;uniform float foilx;uniform float fAmp;uniform float gAmp;uniform float zoom;uniform float zAmt;uniform float aoK;uniform float aoMx;' +
        'float pdepth(vec2 uv){vec2 f=vec2(.5,.62);' +            // focus (texture coords, y up): subject sits centre-upper
        'float d=distance(vec2(uv.x,(uv.y-.5)*1.15+.5),f);' +
        'return 1.-smoothstep(.12,.78,d);}' +                      // 1 = front (subject), 0 = back (edges)
        'float depAt(vec2 uv){return mix(pdepth(uv),texture2D(dmap,uv).r,hasD);}' +
        // Damped fixed-point refinement (2 extra taps): re-estimate depth at the
        // displaced position and average — makes the displacement consistent with
        // the depth of the pixel actually sampled, so background pixels next to a
        // silhouette stop grabbing foreground colours (the "duplicated edge").
        'void main(){vec2 uv=v*cov+off;' +
        // Depth-scaled zoom-in: on hover, pull UVs toward the crop centre MORE where the
        // depth map reads "near" — so the subject magnifies out of the frame while the
        // background barely moves (a true parallax pop, not a flat scale).
        // Gate the depth zoom + AO on hasD: with a REAL depth map they pop the subject;
        // on the procedural centre-blob fallback the zoom would just spherically inflate
        // the middle (generic, ugly), so skip both there and keep only the flat overscan.
        'vec2 ctr=off+cov*.5;float dz=depAt(uv);uv=mix(uv,ctr,zoom*zAmt*hasD*smoothstep(.05,1.,dz));' +
        'float dep=depAt(uv);' +
        'vec2 suv=clamp(uv-tilt*(dep-.42)*.055,vec2(.002),vec2(.998));' +
        'for(int i=0;i<2;i++){' +
          'dep=mix(dep,depAt(suv),.5);' +
          'suv=clamp(uv-tilt*(dep-.42)*.055,vec2(.002),vec2(.998));' +
        '}' +
        'vec3 c=texture2D(img,suv).rgb;' +
        // Fake ambient occlusion: darken where the depth map has a steep gradient (the
        // silhouette edges of the popped-out subject), scaled by the zoom so the contact
        // shading only appears as the card lifts. Sharper on a real depth map.
        'float ao=abs(depAt(suv+vec2(.006,0.))-depAt(suv-vec2(.006,0.)))+abs(depAt(suv+vec2(0.,.006))-depAt(suv-vec2(0.,.006)));' +
        'c*=1.-clamp(ao*aoK,0.,aoMx)*zoom*hasD;' +
        'if(fAmp>0.){' +
          'float t=(suv.x*.9+suv.y*.4)*3.5+foilx;' +
          'vec3 rb=.5+.5*cos(6.2832*(t+vec3(0.,.33,.67)));' +
          'c=c/(1.-clamp(rb*fAmp,0.,.85));' +                      // color-dodge foil
        '}' +
        'if(gAmp>0.){' +
          'vec2 gv=(v-glr)*vec2(1.,1.4);' +
          'float g=exp(-dot(gv,gv)*6.)*gAmp;' +
          'c=c+(1.-c)*g;' +                                        // screen glare
        '}' +
        'gl_FragColor=vec4(c,1.);}';
      function sh(t, s) { var o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); return o; }
      var prog = gl.createProgram();
      gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
      gl.linkProgram(prog); if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
      gl.useProgram(prog);
      var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      var loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      var u = {};
      ['cov', 'off', 'tilt', 'hasD', 'glr', 'foilx', 'fAmp', 'gAmp', 'zoom', 'zAmt', 'aoK', 'aoMx', 'img', 'dmap'].forEach(function (n) { u[n] = gl.getUniformLocation(prog, n); });
      gl.uniform1i(u.img, 0); gl.uniform1i(u.dmap, 1);
      gl.uniform1f(u.hasD, 0); gl.uniform1f(u.fAmp, 0); gl.uniform1f(u.gAmp, 0); gl.uniform1f(u.zoom, 0); gl.uniform2f(u.glr, 0.5, 0.5);
      gl.uniform1f(u.zAmt, DEPTH_CFG.zoom); gl.uniform1f(u.aoK, DEPTH_CFG.aoStr); gl.uniform1f(u.aoMx, DEPTH_CFG.aoMax);
      function mkTex(unit, image) {
        gl.activeTexture(gl.TEXTURE0 + unit);
        var t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        return t;
      }
      // Foil/glare in-shader on touch only — desktop keeps the (richer) DOM blend
      // layers it already renders fine. Intensity scales with rarity / shine.
      var coarse = false; try { coarse = matchMedia('(pointer: coarse)').matches || /[?&]cvholo=1\b/.test(location.search); } catch (_) { /* noop */ }
      var wrap = holder.querySelector('.auth, .ctc') || holder;
      var rar = (wrap && (wrap.className.match(/(?:auth|ctc)-(common|rare|elite|legendary)/) || [])[1]) || 'common';
      var shine = !!(wrap && /cl-shine/.test(wrap.className));
      var fMax = !coarse ? 0 : shine ? 0.34 : rar === 'legendary' ? 0.27 : rar === 'elite' ? 0.2 : rar === 'rare' ? 0.13 : 0.06;
      var im = new Image();
      im.crossOrigin = 'anonymous';
      im.onload = function () {
        try {
          if (!cv.isConnected && !inner.isConnected) return;
          mkTex(0, im);
          mkTex(1, im);                                             // dmap placeholder until the real map arrives
          var dpr = Math.min(2, window.devicePixelRatio || 1);
          var w = (artCv ? inner.clientWidth * 0.84 + 1 : inner.clientWidth + 2), h = inner.clientHeight + 2;
          cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
          gl.viewport(0, 0, cv.width, cv.height);
          // cover-fit + "center top" anchor (matches the img's object-fit/position)
          var ca = w / h, ia = im.width / im.height, cov, off;
          if (ia > ca) { cov = [ca / ia, 1]; off = [(1 - cov[0]) / 2, 0]; }
          else { cov = [1, ia / ca]; off = [0, 1 - cov[1]]; }        // y-crop anchored to the TOP (v=1 after flip)
          gl.uniform2f(u.cov, cov[0], cov[1]); gl.uniform2f(u.off, off[0], off[1]);
          img.parentNode.insertBefore(cv, img.nextSibling);
          img.style.visibility = 'hidden';                            // <img> stays as instant fallback
          if (coarse) inner.classList.add('cv-holo');                 // shader replaces the DOM holo layers
          // Real depth map: pre-baked (/depth) first; the long tail falls back to the
          // on-demand server model (/api/depth, CDN-cached per poster); any failure
          // leaves the procedural depth in place.
          var base = img.src.split('?')[0].split('/').pop() || '';
          if (/^[\w-]{5,64}\.(jpg|jpeg|png)$/i.test(base)) {
            var dm = new Image();
            dm.onload = function () { try { if (cv.isConnected || inner.isConnected) { mkTex(1, dm); gl.uniform1f(u.hasD, 1); last = ''; } } catch (_) { /* procedural */ } };
            dm.onerror = function () {
              if (dm._retried) return; dm._retried = 1;
              dm.src = '/api/depth?im=' + encodeURIComponent(base);
            };
            dm.src = '/depth/' + base;
          }
          var last = '', fA = 0, gA = 0, zA = 0;
          function num(nme, dflt) { var s = inner.style.getPropertyValue(nme); var f = parseFloat(s); return isNaN(f) ? dflt : f; }
          (function loop() {
            if (!cv.isConnected) {                                    // view closed / re-rendered: free the context
              try { img.style.visibility = ''; inner.classList.remove('cv-holo'); var lx = gl.getExtension('WEBGL_lose_context'); if (lx) lx.loseContext(); } catch (_) { /* noop */ }
              return;
            }
            var px = num('--px', 0), py = num('--py', 0);
            var gx = num('--gx', 50) / 100, gy = num('--gy', 50) / 100;
            var fx = num('--fx', 100) / 200;
            var tilted = inner.classList.contains('tilted');
            fA += ((tilted ? fMax : fMax * 0.5) - fA) * 0.12;         // idle keeps a soft foil, touch brings it up
            gA += ((coarse && tilted ? 0.5 : 0) - gA) * 0.15;
            zA += (num('--dz', 0) - zA) * (DEPTH_CFG.ease || 0.09);    // depth-scaled zoom eases smoothly in/out on hover (--dz set by the caller)
            var key = px + ',' + py + ',' + gx + ',' + gy + ',' + fx + ',' + fA.toFixed(3) + ',' + gA.toFixed(3) + ',' + zA.toFixed(3) + ',' + DEPTH_CFG.zoom + ',' + DEPTH_CFG.aoStr + ',' + DEPTH_CFG.aoMax;
            if (key !== last) {                                       // redraw only when something moved (or a debug slider changed)
              last = key;
              gl.uniform2f(u.tilt, px, -py);
              gl.uniform2f(u.glr, gx, 1 - gy);
              gl.uniform1f(u.foilx, fx * 2.2);
              gl.uniform1f(u.fAmp, fA < 0.005 ? 0 : fA);
              gl.uniform1f(u.gAmp, gA < 0.005 ? 0 : gA);
              gl.uniform1f(u.zoom, zA < 0.002 ? 0 : zA);
              gl.uniform1f(u.zAmt, DEPTH_CFG.zoom); gl.uniform1f(u.aoK, DEPTH_CFG.aoStr); gl.uniform1f(u.aoMx, DEPTH_CFG.aoMax);
              gl.drawArrays(gl.TRIANGLES, 0, 3);
            }
            requestAnimationFrame(loop);
          })();
        } catch (_) { /* keep the img */ }
      };
      // Cache-bust so the CORS-mode load never hits the <img>'s non-CORS cache entry
      // (Chrome refuses a crossOrigin request served from a cache entry that was
      // stored without CORS headers — the classic canvas-taint trap).
      im.src = img.src + (img.src.indexOf('?') < 0 ? '?xo=1' : '&xo=1');
    } catch (_) { /* keep the img */ }
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
  // Pity floors (deterministic, no RNG): a prize/goal card (anything a game marks
  // with rarityFloor) is forced up to Elite after 7 straight days without seeing an
  // elite+, and to Legendary after 21 days without one — a dry streak self-corrects
  // instead of souring. Any NEW elite/legendary from any source resets the clocks
  // (dupes don't: there's no reveal moment). Clocks start at the first prize.
  var PITY_ELITE_DAYS = 7, PITY_LEG_DAYS = 21;
  function daysBetween(a, b) { var ms = new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00'); return isNaN(ms) ? 0 : Math.round(ms / 864e5); }
  // Every level pays dust (15 + 5·level) so levelling always rewards something,
  // not just the sparse card-back levels. Existing saves start the ladder at their
  // current level — no retroactive windfall.
  function payLevels(s) {
    var lv = levelFromXp(s.xp || 0);
    if (s.lvlPaid == null) { s.lvlPaid = lv; return 0; }
    var paid = 0;
    // Cap the per-level dust so high levels don't flood the economy (the escalating
    // 15+5·lvl outran every sink past ~level 12). Capped at 70/level.
    while (s.lvlPaid < lv) { s.lvlPaid++; paid += Math.min(70, 15 + 5 * s.lvlPaid); }
    if (paid) { s.dust = (s.dust || 0) + paid; _pendingDust += paid; }
    return paid;
  }
  // Daily Double: collect prize cards from TWO different daily games in one day
  // → +60 dust. The suite's cross-game hook — one win invites a second.
  var DD_GOAL = 2, DD_DUST = 60;
  function ddBump(s, d) {
    if (!s.dd || s.dd.d !== d) s.dd = { d: d, n: 0, done: 0 };
    s.dd.n++;
    if (!s.dd.done && s.dd.n >= DD_GOAL) { s.dd.done = 1; s.dust = (s.dust || 0) + DD_DUST; _pendingDust += DD_DUST; }
  }
  function add(items) {
    if (!Array.isArray(items) || !items.length) return [];
    var s = load(); if (!s || !s.cards) s = blank();
    var added = [], dupes = 0, top = 'common', d = today();
    items.forEach(function (it) {
      if (!it || it.id == null || !it.type) return;
      if (it.rarityFloor) ddBump(s, d);                        // a prize grant (new OR dupe) counts toward the Daily Double
      var k = it.type + ':' + it.id;
      if (s.cards[k]) {
        s.cards[k].n = (s.cards[k].n || 1) + 1;
        ensureWeek(s).dup++;
        s.xp += XP.dupe;
        var gd = DUST[s.cards[k].rarity] || 5;
        s.dust = (s.dust || 0) + gd; _pendingDust += gd;
        dupes++;
        if (ORDER[s.cards[k].rarity] < ORDER[top]) top = s.cards[k].rarity;
      } else {
        var rar = rarityOf(it);
        if (it.rarityFloor) {                                  // prize card → pity + paid Prime apply
          if (!s.pityE) s.pityE = d; if (!s.pityL) s.pityL = d;
          if (daysBetween(s.pityL, d) >= PITY_LEG_DAYS) rar = 'legendary';
          else if (daysBetween(s.pityE, d) >= PITY_ELITE_DAYS && TIERS.indexOf(rar) < 2) rar = 'elite';
          if (s.prime && ORDER[s.prime] < ORDER[rar]) rar = s.prime;   // paid Prime floors the reveal up
          s.prime = null;                                              // consumed by the next prize card
        }
        if (rar === 'legendary') { s.pityL = d; s.pityE = d; }
        else if (rar === 'elite') s.pityE = d;
        s.cards[k] = { id: it.id, type: it.type, name: it.name || '', img: it.img || '', rarity: rar, n: 1, first: d, no: (s.seq = (s.seq || 0) + 1), isNew: 1, i18n: (function () { var o = {}; o[currentLang()] = it.name || ''; return o; })() };
        s.xp += XP[rar] || 10;
        ensureWeek(s).got++;
        added.push(s.cards[k]);
        if (ORDER[rar] < ORDER[top]) top = rar;
      }
      s.seen = (s.seen || 0) + 1;
    });
    payLevels(s);
    save(s);
    try { if (window.Track) window.Track('collection_grant', { items: items.length, fresh: added.length, dupes: dupes, top: top, total: Object.keys(s.cards || {}).length }); } catch (_) { /* noop */ }
    return added;
  }
  function allCards() { var s = load() || blank(); return Object.keys(s.cards || {}).map(function (k) { return s.cards[k]; }); }

  // ─── Title localisation ───
  // A card stores its title in whatever language it was collected in, plus a per-language
  // cache (card.i18n = { 'es-ES': '…', 'en-US': '…' }). The card is shown in the CURRENT
  // UI language (localStorage.clLang, which is already a TMDB code); any rendered movie/TV
  // card missing that language is fetched from TMDB once and cached. Person names are stable
  // across our locales, so they keep the snapshot. Offline / API-down → snapshot is shown.
  var _uiLang = 'en-US';
  function currentLang() { try { var l = localStorage.getItem('clLang'); return (l && /^[a-z]{2}-[A-Z]{2}$/.test(l)) ? l : 'en-US'; } catch (_) { return 'en-US'; } }
  // Self-contained UI strings (i18n.js isn't loaded on the game pages where the
  // collection modal also lives, so we key off clLang directly). English fallback.
  var CT_STR = {
    Film: { es: 'Película', fr: 'Film', de: 'Film', pt: 'Filme' },
    Series: { es: 'Serie', fr: 'Série', de: 'Serie', pt: 'Série' },
    Person: { es: 'Persona', fr: 'Personne', de: 'Person', pt: 'Pessoa' },
    Actor: { es: 'Actor', fr: 'Acteur', de: 'Schauspieler', pt: 'Ator' },
    All: { es: 'Todas', fr: 'Toutes', de: 'Alle', pt: 'Todas' },
    Films: { es: 'Películas', fr: 'Films', de: 'Filme', pt: 'Filmes' },
    People: { es: 'Personas', fr: 'Personnes', de: 'Personen', pt: 'Pessoas' },
    Rarity: { es: 'Rareza', fr: 'Rarete', de: 'Seltenheit', pt: 'Raridade' },
    Type: { es: 'Tipo', fr: 'Type', de: 'Typ', pt: 'Tipo' },
    Number: { es: 'Numero', fr: 'Numero', de: 'Nummer', pt: 'Numero' },
    Collected: { es: 'Obtenida', fr: 'Obtenue', de: 'Erhalten', pt: 'Obtida' },
    Copies: { es: 'Copias', fr: 'Copies', de: 'Kopien', pt: 'Copias' },
    Mastery: { es: 'Maestria', fr: 'Maitrise', de: 'Meisterschaft', pt: 'Maestria' }
  };
  function CT(key) { var m = CT_STR[key]; if (!m) return key; var l = currentLang().slice(0, 2); return m[l] || key; }
  function locName(c) { return (c && c.i18n && c.i18n[_uiLang]) ? c.i18n[_uiLang] : (c ? (c.name || '') : ''); }
  function locCard(c) { var n = locName(c); return (n === c.name) ? c : Object.assign({}, c, { name: n }); }
  function tmdbTitle(type, id, lang) {
    var tp = type === 'person' ? 'person' : (type === 'tv' ? 'tv' : 'movie');
    return fetch('/api/tmdb?path=' + encodeURIComponent(tp + '/' + id) + '&language=' + encodeURIComponent(lang))
      .then(function (r) { return r && r.ok ? r.json() : null; })
      .then(function (j) { return (j && (j.title || j.name)) || null; })
      .catch(function () { return null; });
  }
  var _locUpd = {}, _locT = 0;
  function _locFlush() {
    _locT = 0; var keys = Object.keys(_locUpd); if (!keys.length) return;
    var s = load(); if (!s || !s.cards) { _locUpd = {}; return; }
    keys.forEach(function (k) { var card = s.cards[k]; if (!card) return; card.i18n = card.i18n || {}; var u = _locUpd[k]; Object.keys(u).forEach(function (l) { card.i18n[l] = u[l]; }); });
    save(s); _locUpd = {};
  }
  function _locQueue(key, lang, title) { (_locUpd[key] = _locUpd[key] || {})[lang] = title; if (!_locT) _locT = setTimeout(_locFlush, 900); }
  // Fetch+swap localised titles for rendered cards missing the current language (max 4 in
  // flight). `els` (optional) are the matching DOM nodes whose name is updated in place.
  function localizeCards(cards, els, lang) {
    try {
      if (!lang) return;
      var pend = [];
      for (var i = 0; i < cards.length; i++) {
        var c = cards[i]; if (!c || c.type === 'person') continue;
        if (c.i18n && c.i18n[lang]) continue;
        pend.push({ c: c, el: els ? els[i] : null });
      }
      if (!pend.length) return;
      var qi = 0, active = 0, MAX = 4;
      function pump() {
        while (active < MAX && qi < pend.length) {
          (function (it) {
            active++;
            tmdbTitle(it.c.type, it.c.id, lang).then(function (title) {
              active--;
              if (title) {
                it.c.i18n = it.c.i18n || {}; it.c.i18n[lang] = title;
                _locQueue(it.c.type + ':' + it.c.id, lang, title);
                if (it.el) {
                  var nm = it.el.querySelector('.auth-name,.ctc-name,.clc-name'); if (nm) nm.textContent = title;
                  try { it.el.setAttribute('title', title); } catch (_) { /* noop */ }
                }
              }
              pump();
            });
          })(pend[qi++]);
        }
      }
      pump();
    } catch (_) { /* noop */ }
  }
  // ─── Canonical posters ───
  // A card's art must be the SAME object for every player (like a printed TCG:
  // worldwide identical art, only the text localises — and our localised title is
  // already overlaid on top). CineLinks fetches TMDB in the UI language, so cards
  // could be collected with localised poster files; this lazily converges every
  // rendered card to the canonical (default-language) poster, one TMDB fetch per
  // card ever (card.imgc marks it done). Also what makes /depth maps match.
  var _normUpd = {}, _normT = 0;
  function _normFlush() {
    _normT = 0; var keys = Object.keys(_normUpd); if (!keys.length) return;
    var s = load(); if (!s || !s.cards) { _normUpd = {}; return; }
    keys.forEach(function (k) { var card = s.cards[k]; if (!card) return; var u = _normUpd[k]; if (u.img) card.img = u.img; card.imgc = 1; });
    save(s); _normUpd = {};
  }
  function _normQueue(key, img) { _normUpd[key] = { img: img }; if (!_normT) _normT = setTimeout(_normFlush, 900); }
  function normalizePosters(cards, els) {
    try {
      var pend = [];
      for (var i = 0; i < cards.length; i++) {
        var c = cards[i]; if (!c || c.imgc) continue;
        if (c.type === 'person' || !c.img || /^https?:/.test(c.img)) { c.imgc = 1; _normQueue(c.type + ':' + c.id, null); continue; } // profiles aren't localised
        pend.push({ c: c, el: els ? els[i] : null });
      }
      if (!pend.length) return;
      var qi = 0, active = 0, MAX = 3;
      function pump() {
        while (active < MAX && qi < pend.length) {
          (function (it) {
            active++;
            var tp = it.c.type === 'tv' ? 'tv' : 'movie';
            fetch('/api/tmdb?path=' + encodeURIComponent(tp + '/' + it.c.id))
              .then(function (r) { return r && r.ok ? r.json() : null; })
              .then(function (j) {
                active--;
                var canon = j && j.poster_path;
                if (canon) {
                  var changed = canon !== it.c.img;
                  it.c.img = canon; it.c.imgc = 1;
                  _normQueue(it.c.type + ':' + it.c.id, canon);
                  if (changed && it.el) {
                    var im = it.el.querySelector('.auth-bgimg,.ctc-art>img,.clc-img');
                    if (im && im.tagName === 'IMG') im.src = im.src.replace(/\/t\/p\/(w\d+)\/.*$/, '/t/p/$1' + canon);
                  }
                }
                pump();
              })
              .catch(function () { active--; pump(); });   // API down → retry on a future render
          })(pend[qi++]);
        }
      }
      pump();
    } catch (_) { /* noop */ }
  }

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
      depth: cards.reduce(function (t, c) { return t + Math.max(0, (c.n || 1) - 1); }, 0),
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
  // Every curated member is verified to appear in the daily-goal pool (daily-challenges.js)
  // or the shared clue pool (cineclue-pool.js), so each set genuinely fills from play —
  // a set with an unobtainable member is pure frustration. (That's why Avatar: Fire and
  // Ash was dropped from Pandora: it's in no pool.) Person/TV sets draw on the most
  // frequent daily endpoints, so they complete within a few weeks of dailies.
  var SETS = [
    { id: 'avengers', name: 'Marvel Blockbusters', members: [
      { id: 24428, type: 'movie', name: 'The Avengers' }, { id: 299536, type: 'movie', name: 'Avengers: Infinity War' },
      { id: 299534, type: 'movie', name: 'Avengers: Endgame' }, { id: 634649, type: 'movie', name: 'Spider-Man: No Way Home' }
    ] },
    { id: 'pandora', name: 'Pandora · Avatar', members: [
      { id: 19995, type: 'movie', name: 'Avatar' }, { id: 76600, type: 'movie', name: 'Avatar: The Way of Water' }
    ] },
    { id: 'titans', name: 'Box-Office Titans', members: [
      { id: 597, type: 'movie', name: 'Titanic' }, { id: 19995, type: 'movie', name: 'Avatar' },
      { id: 299534, type: 'movie', name: 'Avengers: Endgame' }, { id: 361743, type: 'movie', name: 'Top Gun: Maverick' }
    ] },
    { id: 'nolan', name: 'Nolan Mind-Benders', members: [
      { id: 27205, type: 'movie', name: 'Inception' }, { id: 157336, type: 'movie', name: 'Interstellar' },
      { id: 155, type: 'movie', name: 'The Dark Knight' }, { id: 49026, type: 'movie', name: 'The Dark Knight Rises' }
    ] },
    { id: 'middleearth', name: 'Middle-earth', members: [
      { id: 120, type: 'movie', name: 'The Fellowship of the Ring' }, { id: 121, type: 'movie', name: 'The Two Towers' },
      { id: 122, type: 'movie', name: 'The Return of the King' }
    ] },
    { id: 'mcucast', name: 'Avengers Assembled', members: [
      { id: 3223, type: 'person', name: 'Robert Downey Jr.' }, { id: 16828, type: 'person', name: 'Chris Evans' },
      { id: 1245, type: 'person', name: 'Scarlett Johansson' }, { id: 103, type: 'person', name: 'Mark Ruffalo' },
      { id: 74568, type: 'person', name: 'Chris Hemsworth' }
    ] },
    { id: 'icons', name: 'Hollywood Icons', members: [
      { id: 31, type: 'person', name: 'Tom Hanks' }, { id: 3, type: 'person', name: 'Harrison Ford' },
      { id: 380, type: 'person', name: 'Robert De Niro' }, { id: 1158, type: 'person', name: 'Al Pacino' },
      { id: 192, type: 'person', name: 'Morgan Freeman' }
    ] },
    { id: 'leading', name: 'Leading Ladies', members: [
      { id: 524, type: 'person', name: 'Natalie Portman' }, { id: 1204, type: 'person', name: 'Julia Roberts' },
      { id: 2227, type: 'person', name: 'Nicole Kidman' }, { id: 54693, type: 'person', name: 'Emma Stone' }
    ] },
    { id: 'prestigetv', name: 'Prestige TV', members: [
      { id: 1396, type: 'tv', name: 'Breaking Bad' }, { id: 1438, type: 'tv', name: 'The Wire' },
      { id: 76331, type: 'tv', name: 'Succession' }, { id: 1104, type: 'tv', name: 'Mad Men' }
    ] },
    { id: 'starwars', name: 'A Galaxy Far Away', members: [
      { id: 11, type: 'movie', name: 'Star Wars' }, { id: 1891, type: 'movie', name: 'The Empire Strikes Back' },
      { id: 1892, type: 'movie', name: 'Return of the Jedi' }, { id: 140607, type: 'movie', name: 'The Force Awakens' }
    ] },
    { id: 'jurassic', name: 'Isla Nublar', members: [
      { id: 329, type: 'movie', name: 'Jurassic Park' }, { id: 135397, type: 'movie', name: 'Jurassic World' }
    ] },
    { id: 'gotham', name: 'Gotham Nights', members: [
      { id: 414906, type: 'movie', name: 'The Batman' }, { id: 475557, type: 'movie', name: 'Joker' },
      { id: 297762, type: 'movie', name: 'Wonder Woman' }
    ] },
    { id: 'pixar', name: 'Pixar Hearts', members: [
      { id: 862, type: 'movie', name: 'Toy Story' }, { id: 12, type: 'movie', name: 'Finding Nemo' },
      { id: 150540, type: 'movie', name: 'Inside Out' }, { id: 14160, type: 'movie', name: 'Up' }
    ] },
    { id: 'spielberg', name: 'Spielberg Signature', members: [
      { id: 578, type: 'movie', name: 'Jaws' }, { id: 601, type: 'movie', name: 'E.T. the Extra-Terrestrial' },
      { id: 85, type: 'movie', name: 'Raiders of the Lost Ark' }, { id: 857, type: 'movie', name: 'Saving Private Ryan' }
    ] },
    { id: 'tarantino', name: 'Tarantino Cuts', members: [
      { id: 680, type: 'movie', name: 'Pulp Fiction' }, { id: 24, type: 'movie', name: 'Kill Bill: Vol. 1' },
      { id: 68718, type: 'movie', name: 'Django Unchained' }, { id: 16869, type: 'movie', name: 'Inglourious Basterds' }
    ] },
    { id: 'scifi', name: 'Sci-Fi Legends', members: [
      { id: 603, type: 'movie', name: 'The Matrix' }, { id: 78, type: 'movie', name: 'Blade Runner' },
      { id: 348, type: 'movie', name: 'Alien' }, { id: 218, type: 'movie', name: 'The Terminator' }
    ] },
    { id: 'alist', name: 'A-List Leading Men', members: [
      { id: 6193, type: 'person', name: 'Leonardo DiCaprio' }, { id: 287, type: 'person', name: 'Brad Pitt' },
      { id: 500, type: 'person', name: 'Tom Cruise' }, { id: 5292, type: 'person', name: 'Denzel Washington' },
      { id: 6384, type: 'person', name: 'Keanu Reeves' }
    ] },
    { id: 'newwave', name: 'New Hollywood', members: [
      { id: 505710, type: 'person', name: 'Zendaya' }, { id: 234352, type: 'person', name: 'Margot Robbie' },
      { id: 30614, type: 'person', name: 'Ryan Gosling' }
    ] },
    { id: 'godfathertrilogy', name: 'The Corleone Saga', members: [
      { id: 238, type: 'movie', name: 'The Godfather' }, { id: 240, type: 'movie', name: 'The Godfather Part II' },
      { id: 242, type: 'movie', name: 'The Godfather Part III' }
    ] },
    { id: 'wizarding', name: 'The Wizarding World', members: [
      { id: 671, type: 'movie', name: "Harry Potter and the Philosopher's Stone" }, { id: 672, type: 'movie', name: 'Harry Potter and the Chamber of Secrets' },
      { id: 673, type: 'movie', name: 'Harry Potter and the Prisoner of Azkaban' }, { id: 674, type: 'movie', name: 'Harry Potter and the Goblet of Fire' }
    ] },
    { id: 'fastsaga', name: 'Family - Fast Saga', members: [
      { id: 9799, type: 'movie', name: 'The Fast and the Furious' }, { id: 51497, type: 'movie', name: 'Fast Five' },
      { id: 168259, type: 'movie', name: 'Furious 7' }
    ] },
    { id: 'hobbit', name: 'There and Back Again', members: [
      { id: 49051, type: 'movie', name: 'The Hobbit: An Unexpected Journey' }, { id: 57158, type: 'movie', name: 'The Hobbit: The Desolation of Smaug' },
      { id: 122917, type: 'movie', name: 'The Hobbit: The Battle of the Five Armies' }
    ] },
    { id: 'bond', name: 'Licence to Kill - 007', members: [
      { id: 36557, type: 'movie', name: 'Casino Royale' }, { id: 37724, type: 'movie', name: 'Skyfall' },
      { id: 370172, type: 'movie', name: 'No Time to Die' }
    ] },
    { id: 'webslingers', name: 'Into the Spider-Verse', members: [
      { id: 634649, type: 'movie', name: 'Spider-Man: No Way Home' }, { id: 324857, type: 'movie', name: 'Spider-Man: Into the Spider-Verse' },
      { id: 569094, type: 'movie', name: 'Spider-Man: Across the Spider-Verse' }
    ] },
    { id: 'scorsese', name: 'Scorsese Streets', members: [
      { id: 769, type: 'movie', name: 'GoodFellas' }, { id: 1422, type: 'movie', name: 'The Departed' },
      { id: 103, type: 'movie', name: 'Taxi Driver' }, { id: 106646, type: 'movie', name: 'The Wolf of Wall Street' }
    ] },
    { id: 'kubrick', name: 'Kubrick Vision', members: [
      { id: 62, type: 'movie', name: '2001: A Space Odyssey' }, { id: 694, type: 'movie', name: 'The Shining' },
      { id: 185, type: 'movie', name: 'A Clockwork Orange' }, { id: 600, type: 'movie', name: 'Full Metal Jacket' }
    ] },
    { id: 'fincher', name: 'Fincher Files', members: [
      { id: 550, type: 'movie', name: 'Fight Club' }, { id: 807, type: 'movie', name: 'Se7en' },
      { id: 37799, type: 'movie', name: 'The Social Network' }, { id: 210577, type: 'movie', name: 'Gone Girl' }
    ] },
    { id: 'villeneuve', name: 'Villeneuve Worlds', members: [
      { id: 438631, type: 'movie', name: 'Dune' }, { id: 329865, type: 'movie', name: 'Arrival' },
      { id: 335984, type: 'movie', name: 'Blade Runner 2049' }, { id: 273481, type: 'movie', name: 'Sicario' }
    ] },
    { id: 'ridley', name: 'Ridley Scott Epics', members: [
      { id: 348, type: 'movie', name: 'Alien' }, { id: 78, type: 'movie', name: 'Blade Runner' },
      { id: 98, type: 'movie', name: 'Gladiator' }, { id: 286217, type: 'movie', name: 'The Martian' }
    ] },
    { id: 'cameron', name: 'Cameron Spectacle', members: [
      { id: 597, type: 'movie', name: 'Titanic' }, { id: 19995, type: 'movie', name: 'Avatar' },
      { id: 76600, type: 'movie', name: 'Avatar: The Way of Water' }, { id: 218, type: 'movie', name: 'The Terminator' }
    ] },
    { id: 'ghibli', name: 'Studio Ghibli', members: [
      { id: 129, type: 'movie', name: 'Spirited Away' }, { id: 8392, type: 'movie', name: 'My Neighbor Totoro' },
      { id: 128, type: 'movie', name: 'Princess Mononoke' }, { id: 4935, type: 'movie', name: "Howl's Moving Castle" }
    ] },
    { id: 'horror', name: 'Horror Hall of Fame', members: [
      { id: 9552, type: 'movie', name: 'The Exorcist' }, { id: 694, type: 'movie', name: 'The Shining' },
      { id: 948, type: 'movie', name: 'Halloween' }, { id: 419430, type: 'movie', name: 'Get Out' }
    ] },
    { id: 'modernbestpic', name: 'Modern Best Picture', members: [
      { id: 496243, type: 'movie', name: 'Parasite' }, { id: 581734, type: 'movie', name: 'Nomadland' },
      { id: 545611, type: 'movie', name: 'Everything Everywhere All at Once' }, { id: 872585, type: 'movie', name: 'Oppenheimer' }
    ] },
    { id: 'deepspace', name: 'Deep Space', members: [
      { id: 157336, type: 'movie', name: 'Interstellar' }, { id: 62, type: 'movie', name: '2001: A Space Odyssey' },
      { id: 329865, type: 'movie', name: 'Arrival' }, { id: 286217, type: 'movie', name: 'The Martian' }
    ] },
    { id: 'toon', name: 'Animation Masters', members: [
      { id: 8587, type: 'movie', name: 'The Lion King' }, { id: 808, type: 'movie', name: 'Shrek' },
      { id: 129, type: 'movie', name: 'Spirited Away' }, { id: 324857, type: 'movie', name: 'Spider-Man: Into the Spider-Verse' }
    ] },
    { id: 'auteurs', name: 'The Auteurs', members: [
      { id: 488, type: 'person', name: 'Steven Spielberg' }, { id: 525, type: 'person', name: 'Christopher Nolan' },
      { id: 138, type: 'person', name: 'Quentin Tarantino' }, { id: 1032, type: 'person', name: 'Martin Scorsese' },
      { id: 240, type: 'person', name: 'Stanley Kubrick' }
    ] },
    { id: 'visionaries', name: 'Visionary Directors', members: [
      { id: 7467, type: 'person', name: 'David Fincher' }, { id: 137427, type: 'person', name: 'Denis Villeneuve' },
      { id: 608, type: 'person', name: 'Hayao Miyazaki' }, { id: 2710, type: 'person', name: 'James Cameron' },
      { id: 578, type: 'person', name: 'Ridley Scott' }
    ] },
    { id: 'queens', name: 'Queens of Cinema', members: [
      { id: 5064, type: 'person', name: 'Meryl Streep' }, { id: 112, type: 'person', name: 'Cate Blanchett' },
      { id: 2227, type: 'person', name: 'Nicole Kidman' }, { id: 1204, type: 'person', name: 'Julia Roberts' }
    ] },
    { id: 'nextgen', name: 'Next Generation', members: [
      { id: 1190668, type: 'person', name: 'Timothee Chalamet' }, { id: 1373737, type: 'person', name: 'Florence Pugh' },
      { id: 1397778, type: 'person', name: 'Anya Taylor-Joy' }, { id: 505710, type: 'person', name: 'Zendaya' }
    ] },
    { id: 'method', name: 'The Method', members: [
      { id: 73421, type: 'person', name: 'Joaquin Phoenix' }, { id: 3894, type: 'person', name: 'Christian Bale' },
      { id: 6193, type: 'person', name: 'Leonardo DiCaprio' }, { id: 2037, type: 'person', name: 'Cillian Murphy' }
    ] },
    { id: 'actionlegends', name: 'Action Legends', members: [
      { id: 6384, type: 'person', name: 'Keanu Reeves' }, { id: 500, type: 'person', name: 'Tom Cruise' },
      { id: 2231, type: 'person', name: 'Samuel L. Jackson' }, { id: 5292, type: 'person', name: 'Denzel Washington' }
    ] },
    { id: 'hbofantasy', name: 'The Realm', members: [
      { id: 1399, type: 'tv', name: 'Game of Thrones' }, { id: 94997, type: 'tv', name: 'House of the Dragon' },
      { id: 100088, type: 'tv', name: 'The Last of Us' }
    ] },
    { id: 'streamtv', name: 'Streaming Giants', members: [
      { id: 66732, type: 'tv', name: 'Stranger Things' }, { id: 82856, type: 'tv', name: 'The Mandalorian' },
      { id: 65494, type: 'tv', name: 'The Crown' }, { id: 119051, type: 'tv', name: 'Wednesday' }
    ] },
    { id: 'sitcoms', name: 'Sitcom Legends', members: [
      { id: 2316, type: 'tv', name: 'The Office' }, { id: 1668, type: 'tv', name: 'Friends' },
      { id: 1400, type: 'tv', name: 'Seinfeld' }, { id: 8592, type: 'tv', name: 'Parks and Recreation' }
    ] },
    { id: 'crimetv', name: 'Crime and Antiheroes', members: [
      { id: 1396, type: 'tv', name: 'Breaking Bad' }, { id: 60059, type: 'tv', name: 'Better Call Saul' },
      { id: 1438, type: 'tv', name: 'The Wire' }, { id: 76331, type: 'tv', name: 'Succession' }
    ] },
    { id: 'cinephile', name: 'Cinephile', goal: { kind: 'films', target: 25 } },
    { id: 'starstruck', name: 'Star-studded', goal: { kind: 'people', target: 15 } },
    { id: 'spectrum', name: 'Full Spectrum', goal: { kind: 'rarityAll' } },
    { id: 'legends', name: 'Legend Hunter', goal: { kind: 'rarity', rarity: 'legendary', target: 5 } },
    { id: 'elite10', name: 'Elite Circle', goal: { kind: 'rarity', rarity: 'elite', target: 10 } },
    { id: 'vault60', name: 'Serious Collector', goal: { kind: 'count', target: 60 } },
    { id: 'century', name: 'Century Club', goal: { kind: 'count', target: 100 } },
    { id: 'vault150', name: 'Dedicated Curator', goal: { kind: 'count', target: 150 } },
    { id: 'vault250', name: 'Vault Keeper', goal: { kind: 'count', target: 250 } },
    { id: 'films50', name: 'Film Buff', goal: { kind: 'films', target: 50 } },
    { id: 'films100', name: 'Silver-Screen Scholar', goal: { kind: 'films', target: 100 } },
    { id: 'people30', name: 'Casting Director', goal: { kind: 'people', target: 30 } },
    { id: 'people50', name: 'Talent Agent', goal: { kind: 'people', target: 50 } },
    { id: 'legend10', name: 'Legend Collector', goal: { kind: 'rarity', rarity: 'legendary', target: 10 } },
    { id: 'legend20', name: 'Mythmaker', goal: { kind: 'rarity', rarity: 'legendary', target: 20 } },
    { id: 'elite25', name: 'Elite Guard', goal: { kind: 'rarity', rarity: 'elite', target: 25 } },
    { id: 'elite50', name: 'Elite Vanguard', goal: { kind: 'rarity', rarity: 'elite', target: 50 } },
    { id: 'rare50', name: 'Rare Breed', goal: { kind: 'rarity', rarity: 'rare', target: 50 } }
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
        // 100 XP per member: completing a 4-set ≈ two fresh legendaries — worth chasing
        // even at high level (50/member made set completion feel like pocket change).
        // A set stays "undiscovered" (locked, forge disabled) until you own at least one
        // member — so the wall of sets is a map of things to find, not a spoiler list.
        var allPeople = set.members.every(function (m) { return m.type === 'person'; });
        return { id: set.id, name: set.name, kind: 'curated', cat: allPeople ? 'people' : 'franchise', discovered: owned >= 1, owned: owned, total: set.members.length, pct: owned / set.members.length, complete: owned >= set.members.length, members: members, bonus: 100 * set.members.length };
      }
      var g = set.goal, cur = 0, tot = g.target || 1;
      if (g.kind === 'films') cur = films;
      else if (g.kind === 'people') cur = people;
      else if (g.kind === 'count') cur = arr.length;
      else if (g.kind === 'rarity') cur = byR[g.rarity] || 0;
      else if (g.kind === 'rarityAll') { cur = ['common', 'rare', 'elite', 'legendary'].filter(function (r) { return byR[r] > 0; }).length; tot = 4; }
      return { id: set.id, name: set.name, kind: 'milestone', cat: 'milestone', discovered: true, owned: Math.min(cur, tot), total: tot, pct: Math.min(1, cur / tot), complete: cur >= tot, bonus: 150 };
    });
  }
  function setsState() { return setsStateFrom(load() || blank()); }

  // ── Card backs: most unlock by level; "Mastery" is gated on the trophy case
  //   (achievements) so it can't be reached by level-grinding alone. ──
  // 'Countdown leader' back (design handoff, back 8c): film perforations, crosshair,
  // double-ring circle with the CL monogram, wordmark. Geometry is shared; each
  // cb-* material only swaps the CSS palette vars.
  function cbBackHtml() {
    return '<div class="cbk"><i class="cbk-perf l"></i><i class="cbk-perf r"></i><i class="cbk-cross v"></i><i class="cbk-cross h"></i>' +
      '<div class="cbk-circle"><div class="cbk-mono">CL</div></div>' +
      '<div class="cbk-word">CineLinks</div></div>';
  }
  var CARDBACKS = [
    { id: 'classic', name: 'Classic', level: 1, css: '' },
    { id: 'gold', name: 'Gold Foil', level: 3, css: 'cb-gold' },
    { id: 'holo', name: 'Holographic', level: 5, css: 'cb-holo' },
    { id: 'aurora', name: 'Aurora', level: 8, css: 'cb-aurora' },
    { id: 'midnight', name: 'Midnight', level: 10, css: 'cb-midnight' },
    { id: 'crimson', name: 'Crimson', level: 13, css: 'cb-crimson' },
    { id: 'emerald', name: 'Emerald', level: 16, css: 'cb-emerald' },
    { id: 'prism', name: 'Prismatic', level: 20, css: 'cb-prism' },
    { id: 'mastery', name: 'Mastery', achv: 12, css: 'cb-mastery' },
    { id: 'obsidian', name: 'Obsidian', achv: 22, css: 'cb-obsidian' }
  ];
  // Met trophy count (matches the trophy case). Safe from recursion because achievement
  // evaluation uses rawCardbackId(), not activeCardbackId() (see achCtx).
  function achvCount() { return achievementsState().filter(function (a) { return a.unlocked; }).length; }
  // A locked back can be bought outright with dust — a clean, non-inflating home
  // for surplus dust (cosmetic, so it never distorts progression). Price scales
  // with how "deep" the back is (its level/trophy gate). Classic is free.
  function backCost(cb) { if (!cb || cb.level === 1) return 0; return cb.achv ? (200 + cb.achv * 20) : (55 + (cb.level || 1) * 16); }
  function cbBought(cb) { var s = load() || blank(); return !!(s.backs && s.backs[cb.id]); }
  function cbUnlocked(cb) { return cbBought(cb) || (cb.achv ? achvCount() >= cb.achv : stats().level >= (cb.level || 1)); }
  function cbReq(cb) { return cb.achv ? { type: 'achv', need: cb.achv } : { type: 'level', need: cb.level || 1 }; }
  // Returns {ok} or {ok:false, reason:'bad'|'already'|'dust', need?, have?}.
  function buyBack(id) {
    var cb = null; CARDBACKS.forEach(function (c) { if (c.id === id) cb = c; });
    if (!cb) return { ok: false, reason: 'bad' };
    if (cbUnlocked(cb)) return { ok: false, reason: 'already' };
    var cost = backCost(cb), s = load() || blank(), have = s.dust || 0;
    if (have < cost) return { ok: false, reason: 'dust', need: cost, have: have };
    s.dust = have - cost; if (!s.backs) s.backs = {}; s.backs[id] = 1; save(s);
    return { ok: true, dust: s.dust };
  }
  function activeCardbackId() {
    var id = null; try { id = localStorage.getItem('cl_cardback'); } catch (_) {}
    var cb = CARDBACKS.filter(function (c) { return c.id === id; })[0];
    return (cb && cbUnlocked(cb)) ? cb.id : 'classic';
  }
  function activeCardbackClass() { var cb = CARDBACKS.filter(function (c) { return c.id === activeCardbackId(); })[0]; return cb ? cb.css : ''; }
  function cardbacksState() {
    var active = activeCardbackId();
    return CARDBACKS.map(function (cb) { return { id: cb.id, name: cb.name, css: cb.css, unlocked: cbUnlocked(cb), active: cb.id === active, req: cbReq(cb), cost: backCost(cb) }; });
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
    if (newly.length) { payLevels(s); save(s); }
    return newly;
  }

  // ── Achievements / Mastery (trophy case — prestige badges, no XP so the
  //    rarity/XP economy stays honest and an existing save isn't retro-inflated) ──
  function AI(p){ return '<svg viewBox="0 0 24 24" width="1em" height="1em" style="vertical-align:-.15em" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + p + '</svg>'; }
  var ACHV = [
    { id: 'first', icon: AI('<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M3 11h18M7 7l-2 4M12 7l-2 4M17 7l-2 4"/>'), name: 'First Frame', desc: 'Collect your first card', goal: function (c) { return [c.st.count, 1]; } },
    { id: 'coll25', icon: AI('<path d="M12 3 3 7l9 4 9-4-9-4z"/><path d="m3 12 9 4 9-4M3 16.5l9 4 9-4"/>'), name: 'Collector', desc: 'Collect 25 cards', goal: function (c) { return [c.st.count, 25]; } },
    { id: 'coll50', icon: AI('<rect x="3" y="4" width="18" height="4.5" rx="1"/><path d="M5 8.5V19a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8.5"/><path d="M9.5 12.5h5"/>'), name: 'Curator', desc: 'Collect 50 cards', goal: function (c) { return [c.st.count, 50]; } },
    { id: 'coll100', icon: AI('<path d="M12 3 4 7h16z"/><path d="M4 10h16M6 10v9M10 10v9M14 10v9M18 10v9M3 21h18"/>'), name: 'Archivist', desc: 'Collect 100 cards', goal: function (c) { return [c.st.count, 100]; } },
    { id: 'coll200', icon: AI('<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="12" cy="12" r="4"/><path d="M12 8v4l2 1.5"/>'), name: 'Vault Keeper', desc: 'Collect 200 cards', goal: function (c) { return [c.st.count, 200]; } },
    { id: 'people10', icon: AI('<circle cx="9" cy="8" r="3.2"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M16 5.2a3.2 3.2 0 0 1 0 5.9M21 20a6 6 0 0 0-4-5.7"/>'), name: 'Star Power', desc: 'Collect 10 people', goal: function (c) { return [c.st.people, 10]; } },
    { id: 'films25', icon: AI('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.4"/><circle cx="12" cy="5.6" r="1.2"/><circle cx="12" cy="18.4" r="1.2"/><circle cx="5.6" cy="12" r="1.2"/><circle cx="18.4" cy="12" r="1.2"/>'), name: 'Cinephile', desc: 'Collect 25 films', goal: function (c) { return [c.st.films, 25]; } },
    { id: 'rare1', icon: AI('<path d="M6 3h12l3 5-9 12L3 8z"/><path d="M3 8h18M9.5 3 8 8l4 12 4-12-1.5-5"/>'), name: 'Rare Find', desc: 'Own a Rare card', goal: function (c) { return [c.st.byRarity.rare, 1]; } },
    { id: 'elite1', icon: AI('<path d="M12 3 4 9l8 12 8-12z"/><path d="M4 9h16M9 9l3 12 3-12"/>'), name: 'Elite', desc: 'Own an Elite card', goal: function (c) { return [c.st.byRarity.elite, 1]; } },
    { id: 'leg1', icon: AI('<path d="M3 8l3.5 3.2L12 5l5.5 6.2L21 8l-1.6 10.5H4.6z"/><path d="M5.5 18.5h13"/>'), name: 'Legend', desc: 'Own a Legendary card', goal: function (c) { return [c.st.byRarity.legendary, 1]; } },
    { id: 'leg5', icon: AI('<path d="M12 3v4.5M12 16.5V21M4.5 12H9M15 12h4.5"/><path d="M12 8l1.4 2.6L16 12l-2.6 1.4L12 16l-1.4-2.6L8 12l2.6-1.4z"/>'), name: 'Hall of Fame', desc: 'Own 5 Legendaries', goal: function (c) { return [c.st.byRarity.legendary, 5]; } },
    { id: 'spectrum', icon: AI('<path d="M4 18a8 8 0 0 1 16 0"/><path d="M7.2 18a4.8 4.8 0 0 1 9.6 0"/><path d="M10.3 18a1.7 1.7 0 0 1 3.4 0"/>'), name: 'Full Spectrum', desc: 'Own every rarity tier', goal: function (c) { var b = c.st.byRarity; var n = ['common', 'rare', 'elite', 'legendary'].filter(function (r) { return b[r] > 0; }).length; return [n, 4]; } },
    { id: 'set1', icon: AI('<path d="M9.2 4.2a1.6 1.6 0 0 1 3.1 0c0 .9.7 1.3 1.5 1.3h1.6a1 1 0 0 1 1 1v1.6c0 .8.4 1.5 1.3 1.5a1.6 1.6 0 0 1 0 3.1c-.9 0-1.3.7-1.3 1.5V17a1 1 0 0 1-1 1h-1.6c-.8 0-1.5.5-1.5 1.3a1.6 1.6 0 0 1-3.1 0c0-.8-.7-1.3-1.5-1.3H6a1 1 0 0 1-1-1v-1.6c0-.8-.5-1.5-1.3-1.5a1.6 1.6 0 0 1 0-3.1c.8 0 1.3-.7 1.3-1.5V7a1 1 0 0 1 1-1h1.7c.8 0 1.5-.4 1.5-1.3z"/>'), name: 'Set Theorist', desc: 'Complete your first set', goal: function (c) { return [c.sd, 1]; } },
    { id: 'set3', icon: AI('<path d="M7 4h10v3.5a5 5 0 0 1-10 0z"/><path d="M7 5.5H4V7a3 3 0 0 0 3 3M17 5.5h3V7a3 3 0 0 1-3 3"/><path d="M12 12.5V16M9 20h6M9.6 20l.5-4M14.4 20l-.5-4"/>'), name: 'Completionist', desc: 'Complete 3 sets', goal: function (c) { return [c.sd, 3]; } },
    { id: 'set5', icon: AI('<rect x="3" y="3" width="7" height="7" rx="1.4"/><rect x="14" y="3" width="7" height="7" rx="1.4"/><rect x="3" y="14" width="7" height="7" rx="1.4"/><rect x="14" y="14" width="7" height="7" rx="1.4"/>'), name: 'Set Master', desc: 'Complete 5 sets', goal: function (c) { return [c.sd, 5]; } },
    { id: 'allsets', icon: AI('<path d="M12 2l2.9 6 6.6.6-5 4.3 1.5 6.5L12 16.9 5.9 20l1.5-6.5-5-4.3 6.6-.6z"/>'), name: 'Grand Slam', desc: 'Complete every franchise & cast set', goal: function (c) { return [c.csTotal ? c.csDone : 0, c.csTotal || 1]; } },
    { id: 'films50', icon: AI('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 9h18M7 5v4M11 5v4M15 5v4M19 5v4M7 15h6"/>'), name: 'Film Buff', desc: 'Collect 50 films', goal: function (c) { return [c.st.films, 50]; } },
    { id: 'people25', icon: AI('<circle cx="8" cy="8" r="3"/><path d="M2 20a6 6 0 0 1 12 0"/><circle cx="16.5" cy="8.5" r="2.6"/><path d="M14 14.4a5.5 5.5 0 0 1 8 5.1"/>'), name: 'Ensemble', desc: 'Collect 25 people', goal: function (c) { return [c.st.people, 25]; } },
    { id: 'elite5', icon: AI('<path d="M12 3 4 9l8 12 8-12z"/><path d="M4 9h16M9 9l3 12 3-12"/><path d="M9.5 6.2 12 3l2.5 3.2"/>'), name: 'Elite Guard', desc: 'Own 5 Elite cards', goal: function (c) { return [c.st.byRarity.elite, 5]; } },
    { id: 'leg10', icon: AI('<path d="M3 8l3.5 3.2L12 5l5.5 6.2L21 8l-1.6 10.5H4.6z"/><path d="M5.5 18.5h13"/><circle cx="12" cy="12" r="1.3"/>'), name: 'Immortal', desc: 'Own 10 Legendary cards', goal: function (c) { return [c.st.byRarity.legendary, 10]; } },
    { id: 'depth15', icon: AI('<rect x="6" y="3" width="12" height="15" rx="2"/><path d="M4 6v13a2 2 0 0 0 2 2h11" opacity=".65"/>'), name: 'Stacked', desc: 'Hold 15 spare copies', goal: function (c) { return [c.depth, 15]; } },
    { id: 'depth60', icon: AI('<rect x="7" y="2.5" width="11" height="14" rx="2"/><path d="M4.5 5.5v13a2 2 0 0 0 2 2h10" opacity=".7"/><path d="M2.5 8v12a2 2 0 0 0 2 2h9" opacity=".4"/>'), name: 'Deep Vault', desc: 'Hold 60 spare copies', goal: function (c) { return [c.depth, 60]; } },
    { id: 'ascend1', icon: AI('<path d="M12 4l6 7h-4v9h-4v-9H6z"/>'), name: 'Ascendant', desc: 'Ascend a card a rarity tier', goal: function (c) { return [c.asc, 1]; } },
    { id: 'copies5', icon: AI('<rect x="7" y="3" width="12" height="16" rx="2"/><path d="M5 6v13a2 2 0 0 0 2 2h9" opacity=".7"/><path d="M11 8h4M11 11h4"/>'), name: 'Deep Pull', desc: 'Pull 5 copies of one card', goal: function (c) { return [c.maxN, 5]; } },
    { id: 'lvl20', icon: AI('<circle cx="12" cy="8.5" r="5"/><path d="M7 8.5l3.4 2.5L15.5 6"/><path d="M8 13 6.5 21l5.5-2.8L17.5 21 16 13"/>'), name: 'Master Curator', desc: 'Reach level 20', goal: function (c) { return [c.st.level, 20]; } },
    { id: 'lvl5', icon: AI('<path d="M3 17 9 11l4 4 8-8"/><path d="M16 7h5v5"/>'), name: 'Rising Star', desc: 'Reach level 5', goal: function (c) { return [c.st.level, 5]; } },
    { id: 'lvl10', icon: AI('<circle cx="12" cy="9" r="5.5"/><path d="M8.5 13.5 7 21l5-2.5L17 21l-1.5-7.5"/>'), name: 'Veteran', desc: 'Reach level 10', goal: function (c) { return [c.st.level, 10]; } },
    { id: 'style', icon: AI('<rect x="4" y="4" width="16" height="16" rx="2.4"/><circle cx="12" cy="12" r="3.2"/><path d="M12 4.5v15M4.5 12h15"/>'), name: 'Style Icon', desc: 'Equip a non-default card back', goal: function (c) { return [c.cb !== 'classic' ? 1 : 0, 1]; } },
    { id: 'shine1', icon: AI('<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M18.5 14.5l.6 1.8 1.8.6-1.8.6-.6 1.8-.6-1.8-1.8-.6 1.8-.6z"/>'), name: 'Polished', desc: 'Shine a card with dust', goal: function (c) { return [c.sh, 1]; } }
  ];
  // Raw equipped card-back id (no unlock validation) — used for the 'style' achievement so
  // achievement evaluation never calls activeCardbackId()→cbUnlocked()→achvCount() (would recurse).
  // useCardback() only ever stores an unlocked id, so the raw value is safe to trust here.
  function rawCardbackId() { var id = null; try { id = localStorage.getItem('cl_cardback'); } catch (_) {} return id || 'classic'; }
  // ── Vault Quests: rotating weekly goals that give owned cards a job and a
  //    short-horizon chase. Progress uses lightweight weekly counters (below) so
  //    goals reset every week; completing one pays dust. Distinct from lifetime
  //    Achievements (one-off) and Sets (franchise completion).
  function weekKey() { return Math.floor(Date.now() / (7 * 864e5)); }   // rolling 7-day buckets
  function ensureWeek(s) {
    var wk = weekKey();
    if (!s.wk || s.wk.key !== wk) s.wk = { key: wk, got: 0, dup: 0, xp0: s.xp || 0, acted: 0 };
    return s.wk;
  }
  var QUESTS = [
    { id: 'collect5', icon: '&#127916;', label: 'Add 5 new cards to your Vault', need: 5, dust: 40, have: function (w) { return w.got; } },
    { id: 'collect8', icon: '&#128218;', label: 'Add 8 new cards to your Vault', need: 8, dust: 60, have: function (w) { return w.got; } },
    { id: 'dupes3', icon: '&#9819;', label: 'Pull 3 duplicate copies', need: 3, dust: 40, have: function (w) { return w.dup; } },
    { id: 'xp200', icon: '&#9889;', label: 'Earn 200 XP this week', need: 200, dust: 45, have: function (w, s) { return Math.max(0, (s.xp || 0) - (w.xp0 || 0)); } },
    { id: 'act1', icon: '&#10024;', label: 'Shine or ascend any card', need: 1, dust: 50, have: function (w) { return w.acted; } }
  ];
  function questSeed(wk) { var a = QUESTS.slice(), out = [], r = wk * 2654435761 >>> 0; while (out.length < 3 && a.length) { r = (r * 1103515245 + 12345) >>> 0; out.push(a.splice(r % a.length, 1)[0]); } return out; }
  function questsState() {
    var s = load() || blank(); var w = ensureWeek(s); save(s);
    if (!s.qDone) s.qDone = {};
    var wk = weekKey();
    return questSeed(wk).map(function (q) {
      var have = Math.min(q.need, q.have(w, s));
      var claimed = s.qDone[wk + ':' + q.id];
      return { id: q.id, icon: q.icon, label: q.label, have: have, need: q.need, dust: q.dust, done: have >= q.need, claimed: !!claimed };
    });
  }
  function claimQuest(id) {
    var s = load() || blank(); var w = ensureWeek(s); if (!s.qDone) s.qDone = {};
    var wk = weekKey(), q = QUESTS.filter(function (x) { return x.id === id; })[0]; if (!q) return { ok: false };
    if (s.qDone[wk + ':' + id]) return { ok: false, reason: 'claimed' };
    if (q.have(w, s) < q.need) return { ok: false, reason: 'incomplete' };
    s.qDone[wk + ':' + id] = today();
    s.dust = (s.dust || 0) + q.dust; _pendingDust += q.dust;
    save(s); refreshOpen();
    return { ok: true, dust: q.dust };
  }

  function achCtx() {
    var st = stats(), s = load() || blank();
    var sh = 0, maxN = 0;
    Object.keys(s.cards || {}).forEach(function (k) { var c = s.cards[k]; if (c.shine) sh++; if ((c.n || 1) > maxN) maxN = c.n || 1; });
    var cur = setsStateFrom(s).filter(function (x) { return x.kind === 'curated'; });
    var csTotal = cur.length, csDone = cur.filter(function (x) { return x.complete; }).length;
    var depth = 0, ascN = 0; Object.keys(s.cards || {}).forEach(function (k) { var c = s.cards[k]; depth += Math.max(0, (c.n || 1) - 1); ascN += (c.asc || 0); });
    return { st: st, sd: s.setsDone ? Object.keys(s.setsDone).length : 0, cb: rawCardbackId(), sh: sh, maxN: maxN, csDone: csDone, csTotal: csTotal, depth: depth, asc: ascN };
  }
  function achMet(a, ctx) { var g = a.goal(ctx); return g[0] >= g[1]; }
  // Record newly-satisfied achievements; returns the list newly unlocked this call.
  function syncAchievements() {
    var s = load() || blank();
    if (!s.achievements) s.achievements = {};
    var ctx = achCtx(), newly = [];
    ACHV.forEach(function (a) { if (!s.achievements[a.id] && achMet(a, ctx)) { s.achievements[a.id] = today(); newly.push({ id: a.id, name: a.name, icon: a.icon }); } });
    // each trophy pays a one-time dust bounty — prestige you can also spend
    if (newly.length) { s.dust = (s.dust || 0) + newly.length * 40; _pendingDust += newly.length * 40; save(s); }
    return newly;
  }
  function achievementsState() {
    var s = load() || blank(), un = s.achievements || {}, ctx = achCtx();
    return ACHV.map(function (a) {
      var g = a.goal(ctx);
      return { id: a.id, icon: a.icon, name: a.name, desc: a.desc, unlocked: !!un[a.id] || achMet(a, ctx), date: un[a.id] || null, have: Math.min(g[0], g[1]), need: g[1] };
    });
  }

  // ── Forge (spend dust to craft a specific MISSING curated-set member) ──
  // Turns set completion from pure luck into player agency: the last stubborn slot
  // can be bought with saved-up dupe dust. Costs ~1.5× the Shine of the card's
  // natural (hash) tier — crafting a real card is stronger than a cosmetic.
  var FORGE_COST = { common: 60, rare: 120, elite: 240, legendary: 480 };
  function forgeCost(member) { return FORGE_COST[rarityOf({ id: member.id, type: member.type })] || 120; }
  function tmdbPoster(type, id) {
    var tp = type === 'person' ? 'person' : (type === 'tv' ? 'tv' : 'movie');
    return fetch('/api/tmdb?path=' + encodeURIComponent(tp + '/' + id))
      .then(function (r) { return r && r.ok ? r.json() : null; })
      .then(function (j) { return (j && (j.poster_path || j.profile_path)) || ''; })
      .catch(function () { return ''; });
  }
  // Resolves {ok, cards?, dust?} | {ok:false, reason:'owned'|'dust', need?, have?}.
  function forgeCard(member) {
    var s = load() || blank();
    var k = member.type + ':' + member.id;
    if (s.cards && s.cards[k]) return Promise.resolve({ ok: false, reason: 'owned' });
    var rar = rarityOf({ id: member.id, type: member.type });
    var cost = FORGE_COST[rar] || 120;
    if ((s.dust || 0) < cost) return Promise.resolve({ ok: false, reason: 'dust', need: cost, have: s.dust || 0 });
    return tmdbPoster(member.type, member.id).then(function (img) {
      var s2 = load() || blank();                    // re-check: the poster fetch took time
      if (s2.cards && s2.cards[k]) return { ok: false, reason: 'owned' };
      if ((s2.dust || 0) < cost) return { ok: false, reason: 'dust', need: cost, have: s2.dust || 0 };
      s2.dust = (s2.dust || 0) - cost; save(s2);
      var added = add([{ id: member.id, type: member.type, name: member.name, img: img, rarity: rar }]);
      return { ok: true, cards: added, dust: dustBalance() };
    });
  }

  // ── Draw: spend dust to pull a random card you don't yet own, from the whole
  // collectible universe (every set's members). The instant-gratification dust
  // sink — distinct from Prime (floors a card you still have to EARN) and Forge
  // (a SPECIFIC set card at a premium). Biased toward sets you've already started,
  // so it accelerates completion. Terminal-safe: once you own the whole universe
  // there's nothing to draw. Uses the same fetch→add→reveal flow as Forge.
  var DRAW_COST = 90;
  function drawPool() {
    var seen = {}, out = [];
    SETS.forEach(function (set) {
      (set.members || []).forEach(function (m) {
        var k = m.type + ':' + m.id; if (seen[k]) return; seen[k] = 1;
        out.push({ id: m.id, type: m.type, name: m.name, set: set.id });
      });
    });
    return out;
  }
  function drawInfo() {
    var s = load() || blank(), pool = drawPool();
    var left = pool.filter(function (m) { return !(s.cards && s.cards[m.type + ':' + m.id]); }).length;
    return { cost: DRAW_COST, dust: s.dust || 0, left: left, total: pool.length };
  }
  function drawPack() {
    var s = load() || blank();
    if ((s.dust || 0) < DRAW_COST) return Promise.resolve({ ok: false, reason: 'dust', need: DRAW_COST, have: s.dust || 0 });
    var pool = drawPool(), owned = {};
    Object.keys(s.cards || {}).forEach(function (k) { owned[k] = 1; });
    var setOwned = {}, setTotal = {};
    pool.forEach(function (m) { setTotal[m.set] = (setTotal[m.set] || 0) + 1; if (owned[m.type + ':' + m.id]) setOwned[m.set] = (setOwned[m.set] || 0) + 1; });
    var unowned = pool.filter(function (m) { return !owned[m.type + ':' + m.id]; });
    if (!unowned.length) return Promise.resolve({ ok: false, reason: 'complete' });
    var bag = [];
    unowned.forEach(function (m) { var o = setOwned[m.set] || 0, t = setTotal[m.set] || 1, w = (o > 0 && o < t) ? 3 : 1; for (var i = 0; i < w; i++) bag.push(m); });
    var pick = bag[Math.floor(Math.random() * bag.length)];
    var rar = rarityOf({ id: pick.id, type: pick.type });
    return tmdbPoster(pick.type, pick.id).then(function (img) {
      var s2 = load() || blank(), k = pick.type + ':' + pick.id;
      if (s2.cards && s2.cards[k]) return { ok: false, reason: 'owned' };            // raced with another grant
      if ((s2.dust || 0) < DRAW_COST) return { ok: false, reason: 'dust', need: DRAW_COST, have: s2.dust || 0 };
      s2.dust = (s2.dust || 0) - DRAW_COST; save(s2);
      var added = add([{ id: pick.id, type: pick.type, name: pick.name, img: img, rarity: rar }]);
      return { ok: true, cards: added, dust: dustBalance() };
    });
  }

  // ── Showcase: a hand-picked vitrine of up to 6 cards (the TCG-Pocket binder
  //    instinct in miniature) — curation is what turns a database into a collection. ──
  var SHOWCASE_MAX = 6;
  function showcaseKeys() { var s = load() || blank(); return Array.isArray(s.showcase) ? s.showcase : []; }
  function showcaseCards() {
    var s = load() || blank(); var ks = Array.isArray(s.showcase) ? s.showcase : [];
    return ks.map(function (k) { return s.cards && s.cards[k]; }).filter(Boolean);
  }
  function inShowcase(c) { return showcaseKeys().indexOf(c.type + ':' + c.id) >= 0; }
  function toggleShowcase(c) {
    var s = load() || blank();
    if (!Array.isArray(s.showcase)) s.showcase = [];
    var k = c.type + ':' + c.id, i = s.showcase.indexOf(k);
    if (i >= 0) { s.showcase.splice(i, 1); save(s); return { ok: true, on: false }; }
    if (s.showcase.length >= SHOWCASE_MAX) return { ok: false, full: true };
    s.showcase.push(k); save(s); return { ok: true, on: true };
  }

  // ── Duplicate value: spares power shine discounts and rarity ascension ──
  // A "spare" is any copy beyond the first. Total spares of a rarity form a pool.
  function spareCopies(rarity) {
    var s = load() || blank(), n = 0;
    Object.keys(s.cards || {}).forEach(function (k) { var c = s.cards[k]; if (!rarity || c.rarity === rarity) n += Math.max(0, (c.n || 1) - 1); });
    return n;
  }
  // Shine gets cheaper the more copies of THAT card you hold (you have spares to burn):
  // 10% off per spare, capped at 50%. Rounded to the nearest 5 dust.
  function shineDiscount(rec) { return Math.min(0.5, Math.max(0, (rec ? (rec.n || 1) : 1) - 1) * 0.1); }
  function shineCostFor(rec) {
    var base = SHINE_COST[rec ? rec.rarity : 'common'] || 80;
    return Math.max(5, Math.round(base * (1 - shineDiscount(rec)) / 5) * 5);
  }
  // Ascension: invest spare copies of a rarity to elevate ONE owned card a tier.
  // Capped below legendary so pulled legendaries stay the real prize.
  var ASCEND_NEXT = { common: 'rare', rare: 'elite' };
  var ASCEND_SPARES = { common: 5, rare: 6 };
  function ascendInfo(c) {
    if (!c) return null;
    var next = ASCEND_NEXT[c.rarity]; if (!next) return null;
    var need = ASCEND_SPARES[c.rarity], have = spareCopies(c.rarity);
    return { next: next, nextLabel: (RARITY[next] || {}).label || next, need: need, have: have, ok: have >= need };
  }
  function ascendCard(c) {
    var s = load() || blank();
    var rec = s.cards && s.cards[c.type + ':' + c.id]; if (!rec) return { ok: false, reason: 'notowned' };
    var next = ASCEND_NEXT[rec.rarity]; if (!next) return { ok: false, reason: 'maxed' };
    var need = ASCEND_SPARES[rec.rarity];
    var pool = Object.keys(s.cards).map(function (k) { return s.cards[k]; })
      .filter(function (x) { return x.rarity === rec.rarity && (x.n || 1) > 1; })
      .sort(function (a2, b2) { return (b2.n || 1) - (a2.n || 1); });
    var avail = pool.reduce(function (t, x) { return t + ((x.n || 1) - 1); }, 0);
    if (avail < need) return { ok: false, reason: 'spares', need: need, have: avail };
    var left = need;
    for (var i = 0; i < pool.length && left > 0; i++) { var take = Math.min(left, (pool[i].n || 1) - 1); pool[i].n -= take; left -= take; }
    var oldR = rec.rarity; rec.rarity = next; rec.asc = (rec.asc || 0) + 1;
    s.xp += Math.max(0, (XP[next] || 0) - (XP[oldR] || 0));
    ensureWeek(s).acted++;
    payLevels(s); save(s); refreshOpen();
    return { ok: true, next: next };
  }

  // ── Dust economy (spend duplicate dust to "Shine" owned cards) ──
  function dustBalance() { return (load() || blank()).dust || 0; }
  function shineCost(c) { return shineCostFor(cardRecord(c) || c); }
  function cardRecord(c) { var s = load(); return (c && s && s.cards) ? s.cards[c.type + ':' + c.id] : null; }
  function isShined(c) { var r = cardRecord(c); return !!(r && r.shine); }
  // Returns {ok, reason?, need?, have?, dust?}. Reasons: 'notowned','already','dust'.
  function shineCard(c) {
    var s = load() || blank();
    if (!c || !s.cards) return { ok: false, reason: 'notowned' };
    var rec = s.cards[c.type + ':' + c.id];
    if (!rec) return { ok: false, reason: 'notowned' };
    if (rec.shine) return { ok: false, reason: 'already' };
    var cost = shineCostFor(rec), have = s.dust || 0;
    if (have < cost) return { ok: false, reason: 'dust', need: cost, have: have };
    s.dust = have - cost; rec.shine = 1; ensureWeek(s).acted++; save(s); refreshOpen();
    return { ok: true, dust: s.dust };
  }

  // ── Prime: spend dust to guarantee your NEXT daily prize card is at least a
  // given rarity. The one repeatable, always-useful dust sink — it never runs
  // dry (unlike Forge), turns surplus dust back into collection quality, and
  // feeds every downstream system (sets, mastery, Arena, depth). One prime is
  // held at a time and consumed by the next prize reveal. Cheaper than Forge
  // per tier because it's a floor, not a guaranteed specific card.
  var PRIME_COST = { rare: 45, elite: 150, legendary: 450 };
  function primeCost(tier) { return PRIME_COST[tier] || 0; }
  function primeState() { var s = load() || blank(); return { tier: s.prime || null, dust: s.dust || 0 }; }
  // Returns {ok, tier?} or {ok:false, reason:'dust'|'bad'|'lower', need?, have?}.
  function primeNext(tier) {
    var s = load() || blank();
    var cost = PRIME_COST[tier];
    if (!cost) return { ok: false, reason: 'bad' };
    // Don't let a player pay to downgrade an already-held higher prime.
    if (s.prime && ORDER[s.prime] <= ORDER[tier]) return { ok: false, reason: 'lower', tier: s.prime };
    var have = s.dust || 0;
    if (have < cost) return { ok: false, reason: 'dust', need: cost, have: have };
    s.dust = have - cost; s.prime = tier; save(s); refreshOpen();
    return { ok: true, tier: tier, dust: s.dust };
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
      '.ctc-inner{position:relative;border-radius:12px;transition:transform .16s ease,box-shadow .2s ease;backface-visibility:hidden}' +
      '.ctc-frame{position:relative;border-radius:12px;padding:4px;box-shadow:0 6px 18px rgba(0,0,0,.5)}' +
      '.ctc-common .ctc-frame{background:linear-gradient(150deg,#46463f,#15140f)}' +
      '.ctc-rare .ctc-frame{background:linear-gradient(150deg,#6f93c8,#15233c)}' +
      '.ctc-elite .ctc-frame{background:linear-gradient(150deg,#a585c8,#251537)}' +
      '.ctc-legendary .ctc-frame{background:linear-gradient(150deg,#f7dd86,#7a5610);animation:ctcLeg 3.2s ease-in-out infinite}' +
      '@keyframes ctcLeg{0%,100%{box-shadow:0 6px 18px rgba(0,0,0,.5),0 0 0 0 rgba(232,194,74,0)}50%{box-shadow:0 6px 18px rgba(0,0,0,.5),0 0 24px rgba(232,194,74,.55)}}' +
      '.ctc-art{position:relative;border-radius:8px;overflow:hidden;aspect-ratio:5/7;background:#222}' +
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
      '.ctc-dupe{position:absolute;right:7px;bottom:7px;z-index:6;font-size:.54rem;font-weight:800;color:#1a1200;background:linear-gradient(135deg,#f5c542,#e8a000);border-radius:99px;padding:1px 7px;box-shadow:0 2px 8px rgba(0,0,0,.5)}' +
      '@media(prefers-reduced-motion:reduce){.ctc{animation:none}.ctc-legendary .ctc-frame,.ctc-legendary .ctc-foil{animation:none}.ctc-inner{transition:none}}' +
      // Mobile (coarse pointer): idle animations of box-shadow / background-position can't
      // run on Blink's compositor — they invalidate paint and re-rasterize the layer stack
      // every frame forever, saturating the raster queue until Chrome draws unpainted tiles
      // as black flashes. Foil stays visible (static) and still tracks the drag tilt.
      '@media(pointer:coarse){.ctc-legendary .ctc-frame{animation:none}.ctc-legendary .ctc-foil{animation:none}' +
        // no blend-mode render surfaces on touch (see the authentic theme note)
        '.ctc-foil,.ctc-glare{mix-blend-mode:normal}.ctc-foil{filter:none}' +
        '.ctc-rare .ctc-foil{opacity:.18}.ctc-elite .ctc-foil{opacity:.26}.ctc-legendary .ctc-foil{opacity:.32}' +
        '.ctc-inner:hover .ctc-glare,.ctc-inner.tilted .ctc-glare{opacity:.55}' +
      '}',
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
    mount: function (grid) { tiltMount(grid, '.ctc', '.ctc-inner'); gridDepthHover(grid, '.ctc', '.ctc-inner'); }
  });

  // ── Built-in theme #2: "classic" simple poster tile (lightweight fallback) ──
  defineTheme({
    name: 'classic', label: 'Classic',
    gridCols: 'minmax(92px,1fr)',
    css:
      '.clc-card{position:relative;border-radius:8px;overflow:hidden;background:#222;border:2px solid var(--cr);animation:clCardIn .35s cubic-bezier(.2,.9,.3,1.2) both}' +
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

  // ── Card Studio bridge ────────────────────────────────────────────────
  // A template exported from /studio.html can drive the live "authentic" card.
  // It stores an ordered `layers` list; built-in layers (poster/scrim/corner/
  // star/frame/foil/tags/text) get position/opacity/blend/z overrides, and any
  // custom image/text/fill layers are injected. No template = untouched card.
  // Precedence: a local "Apply to game" override (cl_card_template, just this
  // browser) wins; otherwise the site-wide design shipped in /card-template.json
  // (published for every player). Empty layers = default cards.
  var _globalTpl = null;
  function activeCardTemplate() {
    try { var s = localStorage.getItem('cl_card_template'); if (s) { var o = JSON.parse(s); if (o && o.layers) return o; } } catch (_) { /* noop */ }
    return _globalTpl;
  }
  function tplGet(layers, id) { for (var i = 0; i < layers.length; i++) { if (layers[i].id === id || layers[i].type === id) return { L: layers[i], z: i }; } return null; }
  // name-plate title treatment (per rarity) → inline override for .auth-name.
  // '' = keep the default metal gradient. Legacy flat titleMode fields still read.
  function titleCfgFor(L, r) {
    if (L.title && L.title[r]) return L.title[r];
    if (L.titleMode) return { mode: L.titleMode, color: L.titleColor, c1: L.titleC1, c2: L.titleC2, angle: L.titleAngle };
    return { mode: 'metal' };
  }
  function tplTitleStyle(layers, rarity) {
    if (!layers) return '';
    var g = tplGet(layers, 'textblock') || tplGet(layers, 'text'); if (!g) return '';
    var L = g.L, s = '';
    // typography (shared) — overrides the default name-plate CSS on .auth-name
    if (L.font) s += 'font-family:' + L.font + ';';
    if (L.size) s += 'font-size:' + L.size + 'cqw;';
    if (L.weight) s += 'font-weight:' + L.weight + ';';
    if (L.tracking != null) s += 'letter-spacing:' + L.tracking + 'em;';
    if (L.upper === false) s += 'text-transform:none;';
    if (L.align) s += 'text-align:' + L.align + ';';
    // colour treatment (per rarity)
    var c = titleCfgFor(L, rarity), m = c.mode;
    if (m === 'solid') s += 'background:none;-webkit-text-fill-color:' + (c.color || '#fff') + ';color:' + (c.color || '#fff') + ';';
    else if (m === 'rarity') s += 'background:none;-webkit-text-fill-color:var(--cr);color:var(--cr);';
    else if (m === 'gradient') s += 'background:linear-gradient(' + (c.angle == null ? 180 : c.angle) + 'deg,' + (c.c1 || '#fff3c4') + ',' + (c.c2 || '#e8a000') + ');-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:transparent;';
    return s ? (' style="' + s + '"') : '';
  }
  // full style for the .auth-text box: position/opacity/blend override + vertical
  // justification of the name+meta inside the box (top / middle / bottom).
  function tplTextBoxStyle(layers, rarity) {
    if (!layers) return '';
    var s = tplOv(layers, 'text', rarity) || '';
    var g = tplGet(layers, 'textblock') || tplGet(layers, 'text');
    if (g && g.L.valign) s += 'display:flex;flex-direction:column;justify-content:' + (g.L.valign === 'bottom' ? 'flex-end' : g.L.valign === 'middle' ? 'center' : 'flex-start') + ';';
    return s ? (' style="' + s + '"') : '';
  }
  // ── separate meta line (rarity · type · #no + gem) ──
  function tplMetaContent(layers, rar, typeUp, no) {
    var g = tplGet(layers, 'meta'), L = g ? g.L : {}, f = L.fields || {};
    var plain = L.colorMode && L.colorMode !== 'default';
    var gem = (f.gem !== false) ? '<span class="auth-gem"></span>' : '', t = [];
    if (f.rarity !== false) t.push(plain ? '<span>' + rar.label + '</span>' : '<span class="auth-rar">' + rar.label + '</span>');
    if (f.type !== false) t.push('<span>' + typeUp + '</span>');
    if (f.no !== false) t.push(plain ? '<span>' + no + '</span>' : '<span class="auth-no">' + no + '</span>');
    return gem + t.join('<span class="sep">·</span>');
  }
  function tplMetaBoxStyle(layers, rarity) {
    var g = tplGet(layers, 'meta'); if (!g) return '';
    var L = g.L, s = 'position:absolute;' + (tplOv(layers, 'meta', rarity) || '');
    if (L.align) s += 'justify-content:' + (L.align === 'left' ? 'flex-start' : L.align === 'right' ? 'flex-end' : 'center') + ';';
    if (L.font) s += 'font-family:' + L.font + ';';
    if (L.size) s += 'font-size:' + L.size + 'cqw;';
    if (L.weight) s += 'font-weight:' + L.weight + ';';
    if (L.tracking != null) s += 'letter-spacing:' + L.tracking + 'em;';
    if (L.colorMode === 'rarity') s += 'color:var(--cr);';
    else if (L.colorMode === 'solid') s += 'color:' + (L.color || '#fff') + ';';
    return ' style="' + s + '"';
  }
  // rotate + flip transform for a layer ('' if none)
  function tplXform(L) { var t = ''; if (L.rot) t += 'rotate(' + L.rot + 'deg) '; if (L.flipH) t += 'scaleX(-1) '; if (L.flipV) t += 'scaleY(-1) '; return t ? ('transform:' + t.trim() + ';') : ''; }
  // inline style override for a built-in layer (id = studio layer id) — '' if none
  function tplOv(layers, id, rarity) {
    if (!layers) return '';
    var g = tplGet(layers, id); if (!g) return '';
    var L = g.L; if (L.visible === false) return 'display:none;';
    if (L.rarities && L.rarities.indexOf(rarity) < 0) return '';   // layer scoped to other rarities → default built-in
    var s = 'z-index:' + g.z + ';', rc = L.rect;
    if (rc) s += 'left:' + rc.x + '%;top:' + rc.y + '%;width:' + rc.w + '%;height:' + rc.h + '%;right:auto;bottom:auto;';
    var o = (L.opacity && typeof L.opacity === 'object') ? L.opacity[rarity] : L.opacity;
    if (o != null) s += 'opacity:' + o + ';';
    if (L.blend && L.blend !== 'normal') s += 'mix-blend-mode:' + L.blend + ';';
    s += tplXform(L);
    return s;
  }
  // HTML for the studio's custom (added) layers: image / text / fill
  function tplCustom(layers, rarity, cd) {
    if (!layers) return '';
    var builtin = { poster: 1, scrim: 1, corner: 1, star: 1, frame: 1, foil: 1, tags: 1, textblock: 1, meta: 1, badgeStar: 1, badgeCopies: 1, badgeNew: 1 };
    return layers.map(function (L, z) {
      if (builtin[L.type]) return '';
      if (L.rarities && L.rarities.indexOf(rarity) < 0) return '';   // custom layer scoped to other rarities → hidden here
      var rc = L.rect || { x: 0, y: 0, w: 100, h: 100 };
      var o = (L.opacity && typeof L.opacity === 'object') ? L.opacity[rarity] : (L.opacity == null ? 1 : L.opacity);
      var base = 'position:absolute;pointer-events:none;left:' + rc.x + '%;top:' + rc.y + '%;width:' + rc.w + '%;height:' + rc.h + '%;z-index:' + z + ';opacity:' + o + ';' +
        (L.blend && L.blend !== 'normal' ? 'mix-blend-mode:' + L.blend + ';' : '') + tplXform(L);
      if (L.type === 'image') {
        var fc = L.fit === 'stretch' ? '100% 100%' : (L.fit || 'contain');   // 'stretch' deforms to fill the box
        if (L.radius) base += 'border-radius:' + L.radius + '%;';
        if (L.tint && L.tint !== 'none') { var col = L.tint === 'rarity' ? 'var(--cr)' : L.tint; base += 'background:' + col + ';-webkit-mask:url(' + L.src + ') center/' + fc + ' no-repeat;mask:url(' + L.src + ') center/' + fc + ' no-repeat;'; }
        else base += 'background:url(' + L.src + ') center/' + fc + ' no-repeat;';
        return '<div style="' + base + '"></div>';
      }
      if (L.type === 'fill') {
        base += 'border-radius:' + (L.radius || 0) + '%;';
        if (L.fillType === 'linear') base += 'background:linear-gradient(' + (L.angle || 135) + 'deg,' + (L.c1 || '#e8c24a') + ',' + (L.c2 || '#7a5610') + ');';
        else if (L.fillType === 'radial') base += 'background:radial-gradient(circle,' + (L.c1 || '#e8c24a') + ',' + (L.c2 || '#1a1206') + ');';
        else base += 'background:' + (L.tint === 'rarity' ? 'var(--cr)' : (L.c1 || '#e8c24a')) + ';';
        return '<div style="' + base + '"></div>';
      }
      if (L.type === 'text') {
        base += 'display:flex;align-items:' + (L.valign === 'top' ? 'flex-start' : L.valign === 'bottom' ? 'flex-end' : 'center') + ';justify-content:' + (L.align === 'left' ? 'flex-start' : L.align === 'right' ? 'flex-end' : 'center') + ';line-height:1.05;font-family:' + (L.font || 'inherit') + ';font-size:' + (L.size || 8) + 'cqw;font-weight:' + (L.weight || 800) + ';letter-spacing:' + (L.tracking || 0) + 'em;text-align:' + (L.align || 'center') + ';' + (L.upper ? 'text-transform:uppercase;' : '');
        if (L.colorMode === 'metal') base += 'background:linear-gradient(180deg,var(--m1),var(--cr) 52%,var(--m1));-webkit-background-clip:text;background-clip:text;color:transparent;-webkit-text-fill-color:transparent;';
        else if (L.colorMode === 'rarity') base += 'color:var(--cr);';
        else base += 'color:' + (L.color || '#fff') + ';';
        var val = L.bind === 'name' ? cd.name : L.bind === 'number' ? cd.no : (L.text || '');
        return '<div style="' + base + '">' + esc(val) + '</div>';
      }
      return '';
    }).join('');
  }

  // ── Built-in theme #3: "authentic" — premium licensed-card look (navy + foil) ──
  defineTheme({
    name: 'authentic', label: 'Authentic',
    gridCols: 'minmax(150px,1fr)',
    css:
      '.auth{position:relative;perspective:800px;animation:clCardIn .4s cubic-bezier(.2,.9,.3,1.2) both}' +
      // isolation:isolate gives the card its own compositing context so the mix-blend-mode
      // layers (foil/glit/glare/shade) blend WITHIN the card instead of re-compositing
      // against the page every frame — the canonical fix for the transform+blend+radius
      // flicker in Chrome/Blink & Safari (they'd otherwise flash the card bg to black).
      '.auth-card{position:relative;container-type:inline-size;aspect-ratio:5/7;border-radius:13px;overflow:hidden;isolation:isolate;transition:transform .16s ease,box-shadow .2s ease;background:var(--spbg,#0c1117);box-shadow:0 14px 34px -10px rgba(0,0,0,.6);-webkit-backface-visibility:hidden;backface-visibility:hidden}' +
      '.auth-bgimg{position:absolute;top:-1px;left:16%;width:calc(84% + 1px);height:calc(100% + 2px);object-fit:cover;object-position:center top;z-index:0;transform:translateZ(0);-webkit-backface-visibility:hidden;backface-visibility:hidden}' +
      '.auth-noimg{position:absolute;top:0;bottom:0;left:16%;right:0;z-index:0;background:radial-gradient(120% 80% at 50% 0%,#17325e,#0a1830)}' +
      '.auth-scrim{position:absolute;left:16%;right:0;bottom:0;height:44%;z-index:1;pointer-events:none;background:linear-gradient(180deg,#ffffff,#000000);mix-blend-mode:multiply;opacity:.85}' +
      // Spine: left rail architecture (design 5) — stripes / vertical meta / card number.
      '.auth-common{--cr:#9aa3ad}' +
      '.auth-elite{--spbg:#100c15}.auth-legendary{--spbg:#15100a}' +
      '.auth-spine{position:absolute;left:0;top:0;bottom:0;width:16%;z-index:4;display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:4.8cqw 0 5.6cqw;background:var(--spbg,#0c1117);border-right:.8cqw solid var(--cr);pointer-events:none}' +
      '.auth-elite .auth-spine,.auth-legendary .auth-spine{border-right-width:1.2cqw}' +
      '.auth-sp-stripes{display:flex;flex-direction:column;gap:1.6cqw;width:100%;padding:0 3.6cqw}' +
      '.auth-sp-stripes i{display:block;height:2cqw;border-radius:.8cqw;background:var(--cr)}' +
      '.auth-sp-stripes i:nth-child(2){opacity:.55}.auth-sp-stripes i:nth-child(3){opacity:.25}' +
      '.auth-elite .auth-sp-stripes i:nth-child(1){box-shadow:0 0 6px rgba(181,138,214,.6)}.auth-elite .auth-sp-stripes i:nth-child(2){opacity:1}.auth-elite .auth-sp-stripes i:nth-child(3){opacity:.4}' +
      '.auth-legendary .auth-sp-stripes i:nth-child(1){box-shadow:0 0 7px rgba(232,194,74,.8)}.auth-legendary .auth-sp-stripes i:nth-child(2){opacity:1;box-shadow:0 0 7px rgba(232,194,74,.55)}.auth-legendary .auth-sp-stripes i:nth-child(3){opacity:1;box-shadow:0 0 7px rgba(232,194,74,.35)}' +
      '.auth-sp-meta,.auth-sp-no{writing-mode:vertical-rl;transform:rotate(180deg);font-family:"Space Mono",ui-monospace,Menlo,monospace;font-size:4cqw;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:var(--cr);white-space:nowrap;max-height:62%;overflow:hidden}' +
      '.auth-sp-no{font-weight:400;letter-spacing:.06em;color:rgba(255,255,255,.6);max-height:none}' +
      '@keyframes authDrift{0%{background-position:0% 50%}100%{background-position:280% 50%}}' +
      '.auth-tags{position:absolute;top:4.6cqw;right:4.6cqw;z-index:9;display:flex;gap:2.7cqw}' +
      '.auth-nw{font-size:4.2cqw;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:#06281a;background:#7fd49a;border-radius:3.6cqw;padding:1.6cqw 4cqw}' +
      '.auth-dp{font-size:5.3cqw;font-weight:800;color:#1a1200;background:linear-gradient(135deg,#f5c542,#e8a000);border-radius:99px;padding:.7cqw 4.6cqw}' +
      // mastery star (copies ×3/×5/×10 → bronze/silver/gold)
      '.auth-mst{font-size:6.2cqw;line-height:1;font-weight:800}' +
      '.auth-mst.m1{color:#cd8f52;text-shadow:0 1px 4px rgba(0,0,0,.7)}' +
      '.auth-mst.m2{color:#dfe6f2;text-shadow:0 0 6px rgba(200,220,255,.6),0 1px 4px rgba(0,0,0,.7)}' +
      '.auth-mst.m3{color:#f5c542;text-shadow:0 0 8px rgba(245,197,66,.8),0 1px 4px rgba(0,0,0,.7)}' +
      '.auth-text{position:absolute;left:16%;right:0;bottom:0;z-index:5;padding:0 5.6cqw 6cqw;text-align:left}' +
      '.auth-bar{width:10.4cqw;height:1.6cqw;border-radius:.8cqw;background:var(--cr);margin-bottom:3.2cqw}' +
      '.auth-elite .auth-bar{height:2cqw;box-shadow:0 0 7px rgba(181,138,214,.5)}' +
      '.auth-legendary .auth-bar{height:2cqw;box-shadow:0 0 9px rgba(232,194,74,.7)}' +
      '.auth-name{font-weight:900;font-size:10.4cqw;line-height:1;letter-spacing:.01em;text-transform:uppercase;white-space:normal;max-height:2.05em;overflow:hidden;color:#f4f6f8;text-shadow:0 .8cqw 2cqw rgba(0,0,0,.85);margin-bottom:0}' +
      '.auth-name--md{font-size:8.8cqw}.auth-name--sm{font-size:7.4cqw;letter-spacing:0}' +
      '.auth-meta{display:flex;align-items:center;justify-content:center;gap:4cqw;font-size:5.3cqw;font-weight:800;letter-spacing:.05em;text-transform:uppercase}' +
      '.auth-gem{width:4.7cqw;height:4.7cqw;flex-shrink:0;border-radius:1.3cqw;transform:rotate(45deg);background:var(--cr);box-shadow:0 0 4cqw var(--cr)}' +
      '.auth-rar{color:var(--cr)}' +
      '.auth-meta .sep{color:rgba(255,255,255,.32)}' +
      '.auth-no{color:rgba(255,255,255,.82);font-family:ui-monospace,Menlo,monospace;letter-spacing:.03em}' +
      '.auth-frame{position:absolute;inset:0;z-index:6;border-radius:13px;pointer-events:none}' +
      '.auth-frame::before{content:"";position:absolute;left:16%;top:0;right:0;bottom:0;pointer-events:none}' +
      '.auth-elite .auth-frame::before{box-shadow:inset 0 0 0 1.5px rgba(181,138,214,.35)}' +
      '.auth-legendary .auth-frame::before{box-shadow:inset 0 0 0 1.5px rgba(232,194,74,.5)}' +
      '.auth-legendary .auth-frame{box-shadow:inset 0 0 0 2px rgba(232,194,74,.85)}' +
      '.auth-elite .auth-card{box-shadow:0 14px 34px -10px rgba(0,0,0,.6),0 0 16px rgba(181,138,214,.16)}' +
      '.auth-legendary .auth-card{box-shadow:0 14px 34px -10px rgba(0,0,0,.6),0 0 26px rgba(232,194,74,.28)}' +
      '.auth-foil{position:absolute;top:0;right:0;bottom:0;left:16%;z-index:7;pointer-events:none;opacity:0;background:repeating-linear-gradient(115deg,rgba(255,119,115,.4),rgba(255,237,95,.4) 11%,rgba(168,255,150,.4) 21%,rgba(131,255,247,.4) 31%,rgba(120,148,255,.4) 42%,rgba(216,117,255,.4) 52%,rgba(255,119,115,.4) 62%);background-size:280% 280%;background-position:var(--fx,50%) var(--fy,50%);mix-blend-mode:color-dodge;filter:brightness(.92) contrast(1.12);transition:opacity .22s}' +
      '.auth-rare .auth-foil{opacity:.14}.auth-elite .auth-foil{opacity:.22}.auth-legendary .auth-foil{opacity:.32;animation:authDrift 7s linear infinite}' +
      // Mastery (copies) upgrades the card's material: bronze rim (x3) -> silver + shimmer (x5) -> gold frame + foil floor (x10).
      '.auth-mrim{position:absolute;inset:0;z-index:6;border-radius:13px;pointer-events:none}' +
      '.auth.mst-m1 .auth-mrim{box-shadow:inset 0 0 0 1.4px rgba(205,143,82,.6)}' +
      '.auth.mst-m2 .auth-mrim{box-shadow:inset 0 0 0 1.6px rgba(223,230,242,.72),0 0 14px rgba(223,230,242,.14)}' +
      '.auth.mst-m2 .auth-foil{opacity:.2}' +
      '.auth.mst-m3 .auth-mrim{box-shadow:inset 0 0 0 2px rgba(245,197,66,.9),0 0 22px rgba(245,197,66,.22)}' +
      '.auth.mst-m3 .auth-foil{opacity:.34;animation:authDrift 9s linear infinite}' +
      '.auth.mst-m3 .auth-mrim{animation:authMrim 3.6s ease-in-out infinite}' +
      '@keyframes authMrim{0%,100%{filter:brightness(1)}50%{filter:brightness(1.25)}}' +
      '@media(pointer:coarse){.auth.mst-m3 .auth-mrim,.auth.mst-m3 .auth-foil{animation:none}}' +
      '@media(prefers-reduced-motion:reduce){.auth.mst-m3 .auth-mrim,.auth.mst-m3 .auth-foil{animation:none}}' +
      // glitter layer: fine specular dots that travel with the cursor/tilt and read as metallic foil grain. Elite+ only, on hover/tilt.
      // Mask is STATIC (centred) on purpose: following --gx/--gy every frame forces a
      // per-frame mask recomposite that stutters on mobile. The sparkle still travels via
      // the background-position (--fx/--fy), which is cheap.
      '.auth-glit{position:absolute;top:0;right:0;bottom:0;left:16%;z-index:7;pointer-events:none;opacity:0;background-image:radial-gradient(rgba(255,255,255,.85) 0 5%,transparent 8%),radial-gradient(rgba(255,255,255,.5) 0 4%,transparent 7%);background-size:7cqw 7cqw,4.6cqw 4.6cqw;background-position:var(--fx,50%) var(--fy,50%),calc(var(--fx,50%) + 2.3cqw) calc(var(--fy,50%) + 1.4cqw);-webkit-mask:radial-gradient(circle at 50% 46%,#000,rgba(0,0,0,.3) 30%,transparent 62%);mask:radial-gradient(circle at 50% 46%,#000,rgba(0,0,0,.3) 30%,transparent 62%);mix-blend-mode:screen;filter:brightness(1.1);transition:opacity .25s}' +
      '.auth-elite .auth-card:hover .auth-glit,.auth-elite .auth-card.tilted .auth-glit{opacity:.42}' +
      '.auth-legendary .auth-card:hover .auth-glit,.auth-legendary .auth-card.tilted .auth-glit{opacity:.6}' +
      // one-shot diagonal light sweep when the pointer enters a card
      '.auth-sheen{position:absolute;inset:0;z-index:8;pointer-events:none;border-radius:13px;opacity:0;background:linear-gradient(105deg,transparent 36%,rgba(255,255,255,.55) 50%,transparent 64%)}' +
      '.auth-card:hover .auth-sheen,.auth-card.sheen-go .auth-sheen{animation:authSheen .7s ease-out}' +
      '@keyframes authSheen{0%{opacity:0;transform:translateX(-65%)}28%{opacity:.85}100%{opacity:0;transform:translateX(65%)}}' +
      // in-card depth parallax: while tilted the poster recedes (moves against the cursor) and the star/badges/title pop forward (move with it)
      '.auth-bgimg,.auth-bgcv,.auth-tags,.auth-text{transition:transform .34s cubic-bezier(.2,.8,.2,1)}' +
      // While actively tilting, the layers track the finger every frame — a CSS transition
      // there re-interpolates each frame and stutters, so kill it and promote to GPU. The
      // .28s transition only applies on release (class removed) for a smooth settle.
      '.auth-card.tilted .auth-bgimg,.auth-card.tilted .auth-bgcv,.auth-card.tilted .auth-tags,.auth-card.tilted .auth-text{transition:none}' +
      '.auth-card.tilted{will-change:transform}' +
      // Poster parallax ONLY on fine pointers (desktop). On touch the photo stays put on
      // its stable GPU layer — transforming it every frame under the blend layers is what
      // re-rasterised it and flashed the card background through ("petardeo" to black).
      '@media(pointer:fine){.auth-card.tilted .auth-bgimg{transform:translate3d(calc(var(--px,0) * -2.4cqw),calc(var(--py,0) * -2.4cqw),0) scale(var(--ovs,1.0))}}' +
      // The depth canvas replaces the <img>; it must carry the SAME 1.06 overscan the
      // img has when tilted, otherwise the poster visibly shrinks 6% at the img->canvas
      // swap and then the depth zoom eases in (the "jump between two zooms"). The shader
      // does the parallax itself, so the canvas only needs the scale, not the translate.
      '@media(pointer:fine){.auth-card.tilted .auth-bgcv,.ctc-inner.tilted .auth-bgcv{transform:scale(var(--ovs,1.0))}}' +
            '.auth-card.tilted .auth-tags{transform:translate(calc(var(--px,0) * 3cqw),calc(var(--py,0) * 3cqw))}' +
      '.auth-card.tilted .auth-text{transform:translate(calc(var(--px,0) * 2.2cqw),calc(var(--py,0) * 2.2cqw))}' +
      '.auth-glare{position:absolute;inset:0;z-index:8;pointer-events:none;opacity:0;background:radial-gradient(circle at var(--gx,50%) var(--gy,50%),rgba(255,255,255,.42),rgba(255,255,255,.08) 30%,transparent 52%);mix-blend-mode:overlay;transition:opacity .2s}' +
      '.auth-card:hover .auth-glare,.auth-card.tilted .auth-glare{opacity:1}' +
      // Environment reflection sweep: a soft "window" of light baked into a static
      // gradient on an oversized layer, slid with TRANSFORM against the tilt (a fixed
      // light source the card moves under). Compositor-only per frame — mobile-safe.
      '.auth-refl{position:absolute;inset:-45%;z-index:8;pointer-events:none;opacity:0;background:linear-gradient(115deg,transparent 34%,rgba(255,255,255,.13) 43%,rgba(255,255,255,.3) 50%,rgba(255,255,255,.13) 57%,transparent 66%);transition:opacity .25s}' +
      '@media(pointer:fine){.auth-refl{mix-blend-mode:screen}}' +
      '.auth-card.tilted .auth-refl{opacity:1;transform:translate3d(calc(var(--px,0) * -22%),calc(var(--py,0) * -22%),0)}' +
      // Tilt-reactive rim light: thin metal-tinted strips on each edge whose opacity
      // follows the tilt direction (fake Fresnel) — the edge "catches the light" as the
      // card leans. Static paint, opacity-only per frame — mobile-safe.
      '.auth-rim{position:absolute;z-index:9;pointer-events:none;opacity:0}' +
      '.auth-rim-t{top:0;left:8%;right:8%;height:1.6%;background:linear-gradient(90deg,transparent,var(--m1,#fff),transparent)}' +
      '.auth-rim-b{bottom:0;left:8%;right:8%;height:1.6%;background:linear-gradient(90deg,transparent,var(--m1,#fff),transparent)}' +
      '.auth-rim-l{left:0;top:8%;bottom:8%;width:1.6%;background:linear-gradient(180deg,transparent,var(--m1,#fff),transparent)}' +
      '.auth-rim-r{right:0;top:8%;bottom:8%;width:1.6%;background:linear-gradient(180deg,transparent,var(--m1,#fff),transparent)}' +
      '.auth-card.tilted .auth-rim-r{opacity:max(0, calc(var(--px,0) * 1.8))}' +
      '.auth-card.tilted .auth-rim-l{opacity:max(0, calc(var(--px,0) * -1.8))}' +
      '.auth-card.tilted .auth-rim-b{opacity:max(0, calc(var(--py,0) * 1.8))}' +
      '.auth-card.tilted .auth-rim-t{opacity:max(0, calc(var(--py,0) * -1.8))}' +
      // Desktop: foil/glitter brightness rises as the pointer nears the card edges
      // (--pfc = pointer distance from centre) — foil "catches the light" at angles,
      // the pokemon-cards-css trick. Repaints per frame, so fine pointers only.
      '@media(pointer:fine){.auth-card.tilted .auth-foil{filter:brightness(calc(.74 + var(--pfc,.5) * .55)) contrast(1.12)}.auth-card.tilted .auth-glit{filter:brightness(calc(.9 + var(--pfc,.5) * .5))}}' +
      // the WHOLE card tilts as one plane (no independent photo zoom); a moving inner
      // shade darkens the side that turns away, so it reads as a lit 3D surface.
      '.auth-shade{position:absolute;inset:0;z-index:8;pointer-events:none;opacity:0;border-radius:13px;background:linear-gradient(var(--shang,105deg),rgba(0,0,0,.5),transparent 42%,transparent 58%,rgba(255,255,255,.14));transition:opacity .2s}' +
      '.auth-card.tilted .auth-shade{opacity:1}' +
      '.auth-card:hover,.auth-card.tilted{box-shadow:0 20px 44px rgba(0,0,0,.64)}' +
      /* hover-out: force every added brightness/glow to ease off in sync with the depth zoom */
      '.auth-card.fx-out .auth-glare,.auth-card.fx-out .auth-glit,.auth-card.fx-out .auth-sheen{opacity:0!important;transition:opacity .4s ease!important}' +
      '.auth-card.fx-out,.auth-rare .auth-card.fx-out,.auth-elite .auth-card.fx-out,.auth-legendary .auth-card.fx-out{box-shadow:0 14px 34px -10px rgba(0,0,0,.6)!important;transition:box-shadow .4s ease!important}' +
      '.auth-rare .auth-card:hover,.auth-rare .auth-card.tilted{box-shadow:0 20px 44px rgba(0,0,0,.64),0 0 26px rgba(122,166,232,.5)}' +
      '.auth-elite .auth-card:hover,.auth-elite .auth-card.tilted{box-shadow:0 20px 44px rgba(0,0,0,.64),0 0 26px rgba(181,138,214,.55)}' +
      '.auth-legendary .auth-card:hover,.auth-legendary .auth-card.tilted{box-shadow:0 20px 44px rgba(0,0,0,.64),0 0 30px rgba(232,194,74,.6)}' +
      // Fake card THICKNESS on the big detail card: a stack of hard, dark shadows
      // offset opposite the tilt extrudes a solid "side" out of the receding edge,
      // so the flat plane reads as a chunky 3D slab as you drag-tilt it. Single card,
      // desktop only → the per-frame box-shadow repaint is cheap. (--px/--py = tilt.)
      '@media(pointer:fine){#clDetailCard .auth-card.tilted{box-shadow:' +
        'calc(var(--px,0) * 3px) calc(var(--py,0) * 3px) 0 rgba(255,246,220,.14),' +   // lit leading edge (bevel)
        'calc(var(--px,0) * -8px) calc(var(--py,0) * -8px) 0 #0c1426,' +               // extruded side (receding edge)
        'calc(var(--px,0) * -16px) calc(var(--py,0) * -16px) 0 #0a1120,' +
        'calc(var(--px,0) * -24px) calc(var(--py,0) * -24px) 0 #080e1a,' +
        'calc(var(--px,0) * -32px) calc(var(--py,0) * -32px) 0 #060b15,' +
        'calc(var(--px,0) * -40px) calc(var(--py,0) * -40px) 0 #050910,' +
        'calc(var(--px,0) * -48px) calc(var(--py,0) * -48px) 0 #04070d,' +
        '0 34px 66px rgba(0,0,0,.72);transition:box-shadow 0s}}' +
      '@media(prefers-reduced-motion:reduce){.auth{animation:none}.auth-legendary .auth-foil{animation:none}.auth-card{transition:none}.auth-sheen{animation:none;display:none}.auth-glit{display:none}.auth-refl,.auth-rim{display:none}.auth-bgimg,.auth-tags,.auth-text{transition:none}}' +
      // Mobile (coarse pointer): kill the idle infinite animations. None of them can run on
      // Blink's compositor — authStar animates filter with a drop-shadow in the keyframe
      // (disqualifies compositor filters), authDrift animates background-position and
      // authMetal brightness on a blended layer — so each invalidates paint and forces the
      // whole isolated card group (img included) to re-rasterize every frame, forever.
      // On Android that saturates the raster queue and Chrome draws missed tiles as black
      // flashes over the photo. Star/foil/frame remain visible, just static; the foil and
      // glare still move with the finger during the drag tilt.
      '@media(pointer:coarse){.auth-legendary .auth-foil{animation:none}' +
        // Compositing diet v2: layers were still vanishing/flashing — every mix-blend-mode
        // sibling forces the card group into an offscreen render surface, and dozens of grid
        // cards each held a promoted poster texture underneath the open detail view. Android
        // evicts textures under that pressure and whole layers blink out. So on touch: no
        // blend modes (plain translucent overlays approximate the look — the pokemon-cards-css
        // author ships exactly this tradeoff on mobile), no isolation (moot without blends),
        // and posters only get a GPU layer inside the drag-tilted detail/reveal cards.
        '.auth-card{isolation:auto}' +
        '.auth-foil,.auth-glit,.auth-glare{mix-blend-mode:normal}' +
        '.auth-scrim{mix-blend-mode:normal;background:linear-gradient(180deg,transparent,rgba(0,0,0,.82));opacity:1}' +
        '.auth-foil,.auth-glit{filter:none}' +
        '.auth-rare .auth-foil{opacity:.1}.auth-elite .auth-foil{opacity:.15}.auth-legendary .auth-foil{opacity:.22}' +
        '.auth-card:hover .auth-glare,.auth-card.tilted .auth-glare{opacity:.55}' +
        '.auth-elite .auth-card:hover .auth-glit,.auth-elite .auth-card.tilted .auth-glit{opacity:.25}' +
        '.auth-legendary .auth-card:hover .auth-glit,.auth-legendary .auth-card.tilted .auth-glit{opacity:.35}' +
                '.auth-bgimg{transform:none;-webkit-backface-visibility:visible;backface-visibility:visible}' +
        '#clDetailCard .auth-bgimg,#clrBody .auth-bgimg{transform:translateZ(0);-webkit-backface-visibility:hidden;backface-visibility:hidden}' +
      '}' +
      // when the WebGL canvas renders the holo (cv-holo — set on coarse pointers or
      // the ?cvholo=1 debug override), the DOM approximations duck out: the shader
      // does real color-dodge/screen math in ONE surface.
      '.auth-card.cv-holo .auth-foil,.auth-card.cv-holo .auth-glit,.auth-card.cv-holo .auth-glare{display:none}',
    card: function (c, ctx, i) {
      var rar = ctx.RARITY[c.rarity] || ctx.RARITY.common;
      var p = ctx.posterUrl(c.img);
      var person = c.type === 'person';
      var typeUp = person ? CT('Actor') : (c.type === 'tv' ? CT('Series') : CT('Film'));
      var no = '#' + ('00' + (c.no || 0)).slice(-3);
      var nlen = (c.name || '').length;
      var nmCls = nlen > 22 ? ' auth-name--sm' : nlen > 14 ? ' auth-name--md' : '';
      var nm = ctx.esc(c.name);
      // Card mastery: copies upgrade the card visibly (×3 bronze, ×5 silver, ×10 gold)
      var mst = (c.n || 1) >= 10 ? 'm3' : (c.n || 1) >= 5 ? 'm2' : (c.n || 1) >= 3 ? 'm1' : '';
      // Card Studio template (if applied): O() = per-layer inline override, tplCustom = added layers
      var TL = activeCardTemplate(); TL = (TL && TL.layers) ? TL.layers : null;
      function O(id) { return TL ? (' style="' + tplOv(TL, id, c.rarity) + '"') : ''; }
      // Badges: New / ×N copies / Mastery ★. A studio template can split them into
      // three independently-placed layers (badgeStar/badgeCopies/badgeNew); otherwise
      // they cluster in one flex row (default + legacy 'tags' templates).
      var shineT = c.shine ? '<span class="cl-shine-t">&#10024;</span>' : '';
      var starB = mst ? '<span class="auth-mst ' + mst + '" title="Mastery ×' + c.n + '">&#9733;</span>' : '';
      var copiesB = c.n > 1 ? '<span class="auth-dp">×' + c.n + '</span>' : '';
      var newB = c.isNew ? '<span class="auth-nw">New</span>' : '';
      var tagsHtml;
      if (TL && (tplGet(TL, 'badgeStar') || tplGet(TL, 'badgeCopies') || tplGet(TL, 'badgeNew'))) {
        var badgeBox = function (id, inner) { var g = tplGet(TL, id); if (!g || g.L.visible === false || !inner) return ''; return '<div class="auth-badge" style="position:absolute;display:flex;align-items:center;justify-content:center;' + tplOv(TL, id, c.rarity) + '">' + inner + '</div>'; };
        tagsHtml = badgeBox('badgeStar', shineT + starB) + badgeBox('badgeCopies', copiesB) + badgeBox('badgeNew', newB);
      } else {
        tagsHtml = '<div class="auth-tags"' + O('tags') + '>' + shineT + starB + copiesB + newB + '</div>';
      }
      // Meta line: its own positioned layer when the template splits it out; else
      // it rides inside the name-plate box (default + legacy).
      var hasMetaLayer = TL && tplGet(TL, 'meta');
      var metaLayer = hasMetaLayer ? ('<div class="auth-meta"' + tplMetaBoxStyle(TL, c.rarity) + '>' + tplMetaContent(TL, rar, typeUp, no) + '</div>') : '';
      return '<div class="auth auth-' + c.rarity + (person ? ' person' : '') + (c.shine ? ' cl-shine' : '') + (mst ? ' mst-' + mst : '') + (TL ? ' auth-tpl' : '') + '" style="--cr:' + rar.ring + ';--m1:' + (METAL[c.rarity] || '#fff') + ';animation-delay:' + Math.min(i, 16) * 22 + 'ms" title="' + nm + ' · ' + rar.label + ' · ' + no + (c.shine ? ' · Shined' : '') + '">' +
        '<div class="auth-card">' +
          (p ? '<img class="auth-bgimg" src="' + ctx.esc(p) + '" alt="" loading="lazy" decoding="async"' + O('poster') + '>' : '<div class="auth-noimg"></div>') +
          '<div class="auth-scrim"' + O('scrim') + '></div>' +
          '<div class="auth-spine"><span class="auth-sp-stripes"><i></i><i></i><i></i></span><span class="auth-sp-meta">' + rar.label + ' · ' + typeUp + '</span><span class="auth-sp-no">' + no + '</span></div>' +
          tagsHtml +
          '<div class="auth-text"' + (TL ? tplTextBoxStyle(TL, c.rarity) : '') + '>' +
            '<div class="auth-bar"></div>' +
            '<div class="auth-name' + nmCls + '"' + (TL ? tplTitleStyle(TL, c.rarity) : '') + '>' + nm + '</div>' +
          '</div>' + metaLayer +
          '<div class="auth-frame"' + O('frame') + '></div>' + (mst ? '<div class="auth-mrim"></div>' : '') + '<div class="auth-foil"' + O('foil') + '></div><div class="auth-glit"></div><div class="auth-shade"></div><div class="auth-sheen"></div><div class="auth-glare"></div><div class="auth-refl"></div>' +
          '<div class="auth-rim auth-rim-t"></div><div class="auth-rim auth-rim-b"></div><div class="auth-rim auth-rim-l"></div><div class="auth-rim auth-rim-r"></div>' +
          (TL ? tplCustom(TL, c.rarity, { name: nm, no: no }) : '') +
        '</div>' +
      '</div>';
    },
    mount: function (grid) { tiltMount(grid, '.auth', '.auth-card'); gridDepthHover(grid, '.auth', '.auth-card'); }
  });

  // ─────────────────────────── gallery shell ─────────────────────────────
  function injectShell() {
    if (document.getElementById('clCollStyles')) return;
    var css = document.createElement('style'); css.id = 'clCollStyles';
    css.textContent =
      '#clCollDebug{position:fixed;inset:0;z-index:240;display:none;align-items:center;justify-content:center;padding:18px;background:rgba(0,0,0,.72);backdrop-filter:blur(6px)}' +
      '#clCollDebug.open{display:flex}' +
      '@keyframes clCollIn{from{opacity:0;transform:translateY(14px) scale(.97)}to{opacity:1;transform:none}}' +
      // ── The Vault: fullscreen collection stage. UI is a dark neutral chrome so the
      // card art carries all the colour (the Snap rule: cards own the hierarchy).
      '#clCollModal{position:fixed;inset:0;z-index:240;display:none;flex-direction:column;background:#252c35}' +
      // site chrome that floats above the vault (help FAB z900, cookie bar z1000)
      // ducks while any collection surface is open
      'body:has(#clCollModal.open) #ht-btn,body:has(#clCollDetail.open) #ht-btn,body:has(#clCollReveal.open) #ht-btn,' +
      'body:has(#clCollModal.open) #clCookieBar,body:has(#clCollDetail.open) #clCookieBar,body:has(#clCollReveal.open) #clCookieBar{display:none}' +
      '#clCollModal.open{display:flex;animation:clVaultIn .3s ease both}' +
      '@keyframes clVaultIn{from{opacity:0}to{opacity:1}}' +
      '.cl-vault-hd{flex-shrink:0;width:100%;max-width:1192px;margin:0 auto;padding:calc(14px + env(safe-area-inset-top)) 16px 0}' +
      '.cl-coll-hd-top{display:flex;align-items:center;justify-content:space-between;gap:10px}' +
      '.cl-coll-hd-top>div:first-child{min-width:0}' +
      '.cl-coll-title{font-size:1.3rem;font-weight:800;letter-spacing:-.01em;color:#f5f5f5;white-space:nowrap}.cl-coll-title span{color:#e8a000}' +
      '.cl-coll-sub{font-size:.7rem;font-weight:700;color:#9aa4b0;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '.cl-coll-hd-btns{display:flex;align-items:center;gap:6px;flex-shrink:0}' +
      '.cl-coll-icon{background:none;border:none;color:#888;font-size:1.1rem;cursor:pointer;line-height:1;padding:2px 6px}.cl-coll-icon:hover{color:#f5f5f5}.cl-coll-icon svg{width:17px;height:17px;display:block}' +
      '.cl-coll-dust{display:inline-flex;align-items:center;font-size:.78rem;font-weight:800;color:#bfe6ff;background:rgba(120,184,255,.12);border:1px solid rgba(150,205,255,.3);border-radius:99px;padding:3px 9px;margin-right:2px;white-space:nowrap}' +
      '.cl-coll-battle{color:#f5c542;background:rgba(232,160,0,.12);border-color:rgba(232,160,0,.4);text-decoration:none;cursor:pointer}' +
      '.cl-coll-battle:hover{background:rgba(232,160,0,.22)}' +
      // Narrow phones: the header chips go compact (icon-only Battle, tighter pills)
      // so title + chips + close always fit on ONE row.
      '@media(max-width:480px){' +
        '.cl-coll-battle .lbl{display:none}' +
        '.cl-coll-dust{font-size:.7rem;padding:3px 7px;margin-right:0}' +
        '.cl-coll-title{font-size:1.12rem}' +
        '.cl-coll-x{width:30px;height:30px;font-size:.95rem}' +
        '.cl-xp-extra{display:none}' +                       // "to level N" / "Guaranteed:" prefixes
      '}' +
      // Short screens (landscape phones): the identity strip folds away so the
      // grid keeps real estate; everything it shows lives in the tabs/sub anyway.
      '@media(max-height:520px){.cl-vault-hd .cl-coll-lvl{display:none}.cl-vault-hd{padding-top:8px}.cl-vault-hd .cl-vault-tabs{margin-top:8px}}' +
      // Phones: shrink the whole top block so cards appear sooner (tabs are bottom-fixed).
      '@media(max-width:640px){' +
        '.cl-vault-hd{padding:calc(10px + env(safe-area-inset-top)) 14px 0}' +
        '.cl-coll-lvl{margin-top:9px;gap:10px}' +
        '.cl-lvl-ring{width:42px;height:42px}.cl-lvl-ring b{font-size:1rem}' +
        '.cl-coll-xp-l{font-size:.62rem}' +
        '.cl-quests .cl-q-head{margin:9px 2px 5px}' +
        '.cl-quests .cl-q{padding:7px 10px}.cl-quests .cl-q-ic{width:28px;height:28px}' +
      '}' +
      '.cl-coll-x{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:999px;width:34px;height:34px;color:#bbb;font-size:1.05rem;cursor:pointer;line-height:1}.cl-coll-x:hover{color:#fff;border-color:rgba(255,255,255,.3)}' +
      // identity strip: SVG progress ring around the level + next-unlock teaser
      '.cl-coll-lvl{display:flex;align-items:center;gap:12px;margin-top:12px}' +
      '.cl-lvl-ring{position:relative;flex-shrink:0;width:52px;height:52px}' +
      '.cl-lvl-ring svg{position:absolute;inset:0;transform:rotate(-90deg)}' +
      '.cl-lvl-ring circle{fill:none;stroke-width:3.4}' +
      '.cl-lvl-ring .bg{stroke:rgba(255,255,255,.1)}' +
      '.cl-lvl-ring .fg{stroke:#e8a000;stroke-linecap:round;transition:stroke-dashoffset .7s cubic-bezier(.3,.9,.3,1)}' +
      '.cl-lvl-ring b{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:1.15rem;font-weight:800;color:#f5c542;text-shadow:0 2px 10px rgba(232,160,0,.5)}' +
      '.cl-coll-xp{flex:1;min-width:0}' +
      '.cl-coll-xp-bar{height:6px;border-radius:99px;background:rgba(255,255,255,.1);overflow:hidden;margin-top:5px}' +
      '.cl-coll-xp-bar>i{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,#e8a000,#f5c542);transition:width .6s cubic-bezier(.3,.9,.3,1)}' +
      '.cl-coll-xp-l{display:flex;justify-content:space-between;gap:10px;font-size:.66rem;color:#9a9a9a;font-weight:700}' +
      '.cl-coll-next{color:#7fb2e8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      // nav tabs: labelled, top on desktop, thumb-reach bottom bar on mobile
      '.cl-vault-tabs{display:flex;gap:4px;margin-top:12px;border-bottom:1px solid rgba(255,255,255,.08)}' +
      '.cl-vtab{flex:0 0 auto;display:flex;align-items:center;gap:6px;background:none;border:none;border-bottom:2px solid transparent;color:#9a9a9a;font:inherit;font-size:.8rem;font-weight:800;letter-spacing:.02em;padding:9px 13px;cursor:pointer}' +
      '.cl-vtab .ic{font-size:.95rem;line-height:1}.cl-vtab .ic svg{width:20px;height:20px;display:block}' +
      '.cl-vtab:hover{color:#e8e8e8}' +
      '.cl-vtab.on{color:#e8a000;border-bottom-color:#e8a000}' +
      '.cl-vtab .bdg{min-width:16px;padding:1px 5px;border-radius:99px;background:#e8a000;color:#1a1200;font-size:.6rem;font-weight:800;text-align:center}' +
      '@media(max-width:640px){' +
        '.cl-vault-tabs{position:fixed;left:0;right:0;bottom:0;z-index:6;margin:0;justify-content:space-around;background:rgba(37,44,53,.97);border-top:1px solid rgba(255,255,255,.1);border-bottom:none;padding:4px 6px calc(4px + env(safe-area-inset-bottom))}' +
        '.cl-vtab{flex:1;flex-direction:column;gap:2px;padding:7px 4px;font-size:.6rem;border-bottom:none;border-radius:12px}' +
        '.cl-vtab .ic{font-size:1.15rem}' +
        '.cl-vtab.on{background:rgba(232,160,0,.12);border-bottom-color:transparent}' +
      '}' +
      // toolbar (Cards tab): search + one-tap rarity gems + sort. On mobile the
      // chips collapse to a single horizontally-scrollable row under the search.
      '.cl-vault-tools{display:flex;gap:8px;flex-wrap:wrap;align-items:center;padding:11px 0 4px}' +
      // Weekly quests strip
      '.cl-quests{width:100%}' +
      '.cl-q-head{display:flex;align-items:center;justify-content:space-between;font-size:.62rem;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--mut,#9aa4b0);margin:12px 2px 7px}' +
      '.cl-q-head b{color:#f5c542}.cl-q-head i{color:#8d8d8d;font-style:normal;font-weight:700}' +
      '.cl-q-row{display:grid;grid-template-columns:1fr;gap:7px}' +
      '@media(min-width:640px){.cl-q-row{grid-template-columns:1fr 1fr 1fr}}' +
      '.cl-q{display:flex;align-items:center;gap:10px;background:#2c343f;border-radius:13px;padding:9px 11px}' +
      '.cl-q.ready{background:linear-gradient(180deg,rgba(232,160,0,.14),#2c343f);box-shadow:inset 0 0 0 1px rgba(232,194,74,.35)}' +
      '.cl-q.claimed{opacity:.55}' +
      '.cl-q-ic{width:30px;height:30px;flex:none;border-radius:9px;background:rgba(232,160,0,.14);display:flex;align-items:center;justify-content:center;font-size:.95rem}' +
      '.cl-q-body{flex:1;min-width:0}' +
      '.cl-q-lbl{font-size:.76rem;font-weight:700;color:#f0f0f0;line-height:1.2;overflow:hidden;text-overflow:ellipsis}' +
      '.cl-q-bar{height:5px;border-radius:99px;background:rgba(255,255,255,.1);overflow:hidden;margin-top:5px}' +
      '.cl-q-bar>i{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,#e8a000,#f5c542);transition:width .5s cubic-bezier(.3,.9,.3,1)}' +
      '.cl-q-prog{flex:none;font-family:ui-monospace,Menlo,monospace;font-size:.72rem;font-weight:700;color:#9aa4b0}' +
      '.cl-q-claim{flex:none;border:0;border-radius:999px;background:#e8a000;color:#1a1408;font:inherit;font-weight:800;font-size:.68rem;padding:6px 10px;cursor:pointer}' +
      '.cl-q-claim:hover{filter:brightness(1.05)}' +
      '.cl-q-ok{flex:none;color:#5bbd7a;font-weight:800}' +
      // Prime strip — the always-open dust sink (guarantee the next card's rarity)
      '.cl-prime{width:100%}' +
      '.cl-prime-box{display:flex;align-items:center;gap:10px;flex-wrap:wrap;background:#2c343f;border-radius:13px;padding:9px 11px;margin-top:9px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.05)}' +
      '.cl-prime.armed .cl-prime-box{background:linear-gradient(180deg,rgba(232,160,0,.16),#2c343f);box-shadow:inset 0 0 0 1px rgba(232,194,74,.4)}' +
      '.cl-prime-ic{width:30px;height:30px;flex:none;border-radius:9px;background:rgba(232,160,0,.14);display:flex;align-items:center;justify-content:center;font-size:1rem}' +
      '.cl-prime-body{flex:1;min-width:120px}' +
      '.cl-prime-ttl{font-size:.72rem;font-weight:800;color:#f0f0f0;line-height:1.25}' +
      '.cl-prime-sub{font-size:.62rem;font-weight:700;color:#9aa4b0;margin-top:2px}' +
      '.cl-prime-btns{display:flex;gap:6px;flex:none}' +
      '.cl-prime-b{border:0;border-radius:999px;background:rgba(255,255,255,.08);color:#f0f0f0;font:inherit;font-weight:800;font-size:.66rem;padding:6px 10px;cursor:pointer;white-space:nowrap;transition:filter .12s,background .12s}' +
      '.cl-prime-b:hover{filter:brightness(1.12)}' +
      '.cl-prime-b.rare{background:rgba(122,166,232,.22);color:#bcd3f7}' +
      '.cl-prime-b.elite{background:rgba(181,138,214,.22);color:#e0cdf2}' +
      '.cl-prime-b.legendary{background:rgba(232,194,74,.24);color:#f6e2a0}' +
      '.cl-prime-b:disabled{opacity:.4;cursor:default;filter:none}' +
      '.cl-prime-armed{flex:none;font-weight:800;font-size:.68rem;color:#f5c542}' +
      // Buyable card back button (in the Backs tab)
      '.cb-buy{position:absolute;left:50%;bottom:8px;transform:translateX(-50%);border:0;border-radius:999px;background:#e8a000;color:#1a1408;font:inherit;font-weight:800;font-size:.66rem;padding:5px 11px;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,.4);z-index:3}' +
      '.cb-buy:hover{filter:brightness(1.08)}.cb-buy.off{background:#5a5348;color:#2a2620;cursor:default}' +
      '.cb-buy.shake{animation:clShake .4s}' +
      // Draw strip (dust → random unowned card) — sits under the Collections hero
      '.cl-draw{display:flex;align-items:center;gap:11px;background:linear-gradient(180deg,rgba(232,160,0,.12),#2c343f);border-radius:14px;padding:11px 13px;margin:2px 0 16px;box-shadow:inset 0 0 0 1px rgba(232,194,74,.28)}' +
      '.cl-draw[data-complete="1"]{background:#2c343f;box-shadow:inset 0 0 0 1px rgba(255,255,255,.06);opacity:.75}' +
      '.cl-draw-ic{width:34px;height:34px;flex:none;border-radius:10px;background:rgba(232,160,0,.16);display:flex;align-items:center;justify-content:center;font-size:1.15rem}' +
      '.cl-draw-b{flex:1;min-width:0}' +
      '.cl-draw-t{font-size:.82rem;font-weight:800;color:#f0f0f0;line-height:1.2}' +
      '.cl-draw-s{font-size:.64rem;font-weight:600;color:#9aa4b0;margin-top:2px;line-height:1.3}' +
      '.cl-draw-go{flex:none;border:0;border-radius:999px;background:#e8a000;color:#1a1408;font:inherit;font-weight:800;font-size:.74rem;padding:8px 14px;cursor:pointer;white-space:nowrap}' +
      '.cl-draw-go:hover{filter:brightness(1.08)}.cl-draw.off .cl-draw-go{background:#5a5348;color:#2a2620}' +
      '.cl-draw-go.shake{animation:clShake .4s}' +
      '@keyframes clShake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-5px)}40%,80%{transform:translateX(5px)}}' +
      '.cl-vchips{display:flex;gap:8px;align-items:center;flex-wrap:wrap}' +
      '@media(max-width:640px){' +
        '.cl-vsearch{flex:1 1 100%}' +
        '.cl-vchips{flex:1 1 100%;flex-wrap:nowrap;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none;padding-bottom:2px}' +
        '.cl-vchips::-webkit-scrollbar{display:none}' +
        '.cl-coll-chip{flex-shrink:0}' +
      '}' +
      '.cl-vsearch{flex:1 1 150px;min-width:130px;position:relative}' +
      '.cl-vsearch input{width:100%;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);border-radius:99px;color:#eee;font:inherit;font-size:.8rem;font-weight:600;padding:7px 12px 7px 30px;outline:none}' +
      '.cl-vsearch input:focus{border-color:rgba(232,160,0,.5)}' +
      '.cl-vsearch::before{content:"";position:absolute;left:10px;top:50%;transform:translateY(-50%);width:13px;height:13px;opacity:.5;background:center/contain no-repeat url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%23f5f5f5%27 stroke-width=%272%27 stroke-linecap=%27round%27%3E%3Ccircle cx=%2711%27 cy=%2711%27 r=%277%27/%3E%3Cpath d=%27m21 21-4.3-4.3%27/%3E%3C/svg%3E")}' +
      '.cl-coll-chip{display:inline-flex;align-items:center;gap:6px;font-size:.66rem;font-weight:800;letter-spacing:.03em;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.04);color:#cfcfcf;border-radius:99px;padding:6px 11px;cursor:pointer;text-transform:uppercase}' +
      '.cl-coll-chip.on{border-color:rgba(232,160,0,.6);background:rgba(232,160,0,.14);color:#e8a000}' +
      '.cl-coll-chip .gem{width:8px;height:8px;border-radius:2px;transform:rotate(45deg);background:var(--gc,#888);box-shadow:0 0 6px var(--gc,transparent)}' +
      '.cl-vsort{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);border-radius:99px;color:#cfcfcf;font:inherit;font-size:.7rem;font-weight:800;padding:6px 10px;outline:none;cursor:pointer;-webkit-appearance:none;appearance:none}' +
      '.cl-vsort:focus{border-color:rgba(232,160,0,.5)}' +
      // scroller + tier sections with sticky headers
      '.cl-coll-grid{flex:1;overflow-y:auto;width:100%;max-width:1192px;margin:0 auto;padding:6px 16px 26px}' +
      '@media(max-width:640px){.cl-coll-grid{padding-bottom:96px}}' +
      '.cl-sec{position:sticky;top:0;z-index:5;display:flex;align-items:center;gap:9px;padding:12px 2px 9px;background:linear-gradient(180deg,#252c35 72%,rgba(37,44,53,0));font-weight:800;font-size:.76rem;letter-spacing:.09em;text-transform:uppercase;color:var(--sc,#cfcfcf)}' +
      '.cl-sec .gem{width:9px;height:9px;border-radius:2.5px;transform:rotate(45deg);background:var(--sc,#888);box-shadow:0 0 9px var(--sc,transparent);flex-shrink:0}' +
      '.cl-sec .n{color:#777;font-family:ui-monospace,Menlo,monospace;font-size:.72rem;letter-spacing:0}' +
      '.cl-sec .ln{flex:1;height:1px;background:linear-gradient(90deg,rgba(255,255,255,.12),transparent)}' +
      '.cl-sec-grid{display:grid;gap:14px;margin-bottom:10px}' +
      // Protect card art from casual extraction (open-image-in-new-tab / long-press save /
      // drag out) on desktop and mobile. pointer-events:none also means the tap/tilt lands
      // on the card itself, not the <img>, so there is no image context menu at all.
      '.cl-coll-grid img,#clDetailCard img,#clrBody img,.cl-detail-card img{pointer-events:none;-webkit-user-drag:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none}' +
      '.cl-coll-empty{padding:36px 20px 46px;text-align:center;color:#9a9a9a;font-size:.9rem;grid-column:1/-1}' +
      '.cl-empty-row{display:flex;justify-content:center;gap:12px;margin-bottom:18px}' +
      '.cl-ghost{width:86px;aspect-ratio:5/7;border-radius:12px;border:1.5px dashed rgba(255,255,255,.14);background:repeating-linear-gradient(45deg,#28303a,#28303a 8px,#2c343f 8px,#2c343f 16px);display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.16);font-size:1.5rem;font-weight:800}' +
      '.cl-empty-row .cl-ghost:nth-child(2){transform:translateY(-7px) rotate(2deg)}' +
      '.cl-empty-row .cl-ghost:nth-child(1){transform:rotate(-4deg)}' +
      '.cl-empty-row .cl-ghost:nth-child(3){transform:rotate(4deg)}' +
      '.cl-empty-title{font-size:1.05rem;font-weight:800;color:#f5f5f5;margin-bottom:8px}' +
      '.cl-empty-steps{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;max-width:620px;margin:18px auto 0}' +
      '.cl-empty-step{border:1px solid rgba(255,255,255,.1);border-radius:12px;background:rgba(255,255,255,.035);padding:12px 10px;color:#cfcfcf;font-size:.76rem;font-weight:700;line-height:1.35}' +
      '.cl-empty-step b{display:block;color:#e8a000;margin-bottom:4px;font-size:.72rem;text-transform:uppercase;letter-spacing:.08em}' +
      '.cl-empty-cta{display:inline-flex;align-items:center;justify-content:center;margin-top:18px;border:none;border-radius:999px;background:#e8a000;color:#1a1408;font:inherit;font-size:.84rem;font-weight:800;padding:11px 17px;text-decoration:none}' +
      '@media(max-width:560px){.cl-empty-steps{grid-template-columns:1fr}}' +
      // detail prev/next: browse the current filtered list without round-tripping
      '.cl-det-nav{position:fixed;top:50%;transform:translateY(-50%);z-index:2;width:42px;height:42px;border-radius:999px;background:rgba(30,37,46,.75);border:1px solid rgba(255,255,255,.16);color:#ddd;font-size:1.25rem;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center}' +
      '.cl-det-nav:hover{color:#fff;border-color:rgba(232,160,0,.55)}' +
      '.cl-det-nav.prev{left:14px}.cl-det-nav.next{right:14px}' +
      '.cl-det-count{position:fixed;top:calc(22px + env(safe-area-inset-top));left:18px;z-index:1;font-size:.7rem;font-weight:800;color:#9a9a9a;background:rgba(30,37,46,.65);border:1px solid rgba(255,255,255,.12);border-radius:99px;padding:5px 11px;font-family:ui-monospace,Menlo,monospace}' +
      '@media(max-width:640px){.cl-det-nav{top:auto;bottom:calc(18px + env(safe-area-inset-bottom));transform:none}}' +
      '@keyframes clDetSwap{from{opacity:.25;transform:scale(.965)}to{opacity:1;transform:none}}' +
      '.cl-detail-box.swap{animation:clDetSwap .2s ease both}' +
      // debug panel
      '.cl-dbg{background:#2c343f;border:1px solid rgba(255,255,255,.1);border-radius:16px;width:100%;max-width:440px;max-height:86vh;overflow-y:auto;padding:16px;box-shadow:0 28px 80px rgba(0,0,0,.6);color:#e8e8e8;font-size:.82rem}' +
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
      '.cl-dbg textarea{width:100%;height:74px;margin-top:8px;background:#212831;color:#cfcfcf;border:1px solid rgba(255,255,255,.14);border-radius:8px;font-family:monospace;font-size:.66rem;padding:7px;resize:vertical}' +
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
      '.cl-detail-x{position:fixed;top:calc(16px + env(safe-area-inset-top));right:18px;background:rgba(30,37,46,.68);border:1px solid rgba(255,255,255,.16);color:#ddd;font-size:1.1rem;cursor:pointer;border-radius:999px;width:38px;height:38px;line-height:1;z-index:1}' +
      // Short screens (landscape phones): the fixed-height stage would force a scroll
      // before the card is even fully seen — let it collapse and size the card by
      // height instead so the hero moment fits the screen.
      '@media(max-height:560px){.cl-detail-stage{width:auto;height:auto;padding:22px 0 8px}.cl-detail-card{max-width:min(86vw,46vh)}}' +
      '.cl-di{width:300px;max-width:90vw}' +
      '.cl-di-name{font-size:1.15rem;font-weight:800;color:#f5f5f5;text-align:center;margin-bottom:11px}' +
      '.cl-di-rows{display:flex;flex-direction:column;gap:1px;border-radius:12px;overflow:hidden;border:1px solid rgba(255,255,255,.09)}' +
      '.cl-di-row{display:flex;justify-content:space-between;padding:10px 14px;background:#2c343f;font-size:.84rem}' +
      '.cl-di-row span{color:#9a9a9a}.cl-di-row b{color:#f0f0f0;font-weight:700}' +
      '.cl-shine-wrap{width:100%;margin-top:13px;text-align:center}' +
      '.cl-shine-btn{width:100%;border:none;border-radius:12px;padding:12px 14px;font-size:.92rem;font-weight:800;cursor:pointer;color:#06121f;background:linear-gradient(135deg,#bfe6ff,#7ab8ff);box-shadow:0 6px 18px rgba(120,184,255,.32);transition:transform .12s ease,box-shadow .2s ease}' +
      '.cl-shine-btn:hover{transform:translateY(-1px);box-shadow:0 10px 24px rgba(120,184,255,.45)}' +
      '.cl-shine-btn.off{background:#2a2a2a;color:#8a8a8a;box-shadow:none;cursor:not-allowed}' +
      '.cl-shine-was{text-decoration:line-through;opacity:.6;font-weight:700;margin-left:4px}' +
      '.cl-shine-off{font-size:.7rem;font-weight:800;color:#06121f;background:rgba(255,255,255,.55);border-radius:6px;padding:1px 5px}' +
      '.cl-ascend-btn{width:100%;border:none;border-radius:12px;padding:12px 14px;font-size:.92rem;font-weight:800;cursor:pointer;color:#1a1408;background:linear-gradient(135deg,#f5d97a,#e8a000);box-shadow:0 6px 18px rgba(232,160,0,.32);transition:transform .12s ease,box-shadow .2s ease}' +
      '.cl-ascend-btn:hover{transform:translateY(-1px);box-shadow:0 10px 24px rgba(232,160,0,.45)}' +
      '.cl-ascend-btn.off{background:#2a2a2a;color:#8a8a8a;box-shadow:none;cursor:not-allowed}' +
      '.cl-shine-btn.shake{animation:clShake .4s}' +
      '@keyframes clShake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-6px)}40%,80%{transform:translateX(6px)}}' +
      '.cl-shine-hint{font-size:.72rem;color:#9a9a9a;margin-top:7px;font-weight:600}' +
      '.cl-shine-done{width:100%;border-radius:12px;padding:12px 14px;font-size:.92rem;font-weight:800;color:#bfe6ff;background:linear-gradient(135deg,rgba(120,184,255,.16),rgba(120,184,255,.06));border:1px solid rgba(150,205,255,.4);text-shadow:0 1px 6px rgba(150,205,255,.6)}' +
      '.cl-share-btn{width:100%;margin-top:9px;border:1px solid rgba(232,160,0,.55);border-radius:12px;padding:11px 14px;font-size:.9rem;font-weight:800;cursor:pointer;color:#e8a000;background:rgba(232,160,0,.1);transition:transform .12s ease,background .2s ease}' +
      '.cl-share-btn:hover{background:rgba(232,160,0,.18);transform:translateY(-1px)}' +
      '.cl-share-btn:disabled{opacity:.85;cursor:default;transform:none}' +
      '.cl-share-btn.shake{animation:clShake .4s}' +
      // ── reveal sequence ──
      '#clCollReveal{position:fixed;inset:0;z-index:260;display:none;flex-direction:column;align-items:center;justify-content:center;background:radial-gradient(circle at 50% 42%,rgba(26,32,41,.75),rgba(8,11,15,.93) 70%);backdrop-filter:blur(8px);overflow:hidden;cursor:pointer}' +
      '#clCollReveal.open{display:flex}' +
      'html.cl-scroll-lock{overflow:hidden}' +
      'body.cl-scroll-lock{position:fixed;left:0;right:0;width:100%;overflow:hidden;overscroll-behavior:none}' +
      '.clr-flash{position:absolute;inset:0;z-index:5;pointer-events:none;opacity:0;background:radial-gradient(circle at 50% 45%,rgba(232,160,0,.5),rgba(232,160,0,.12) 38%,transparent 66%)}' +
      '.clr-flash.go{animation:clrFlash .62s cubic-bezier(.22,1,.36,1)}' +
      '@keyframes clrFlash{0%{opacity:0;transform:scale(.7)}22%{opacity:1}100%{opacity:0;transform:scale(1.3)}}' +
      '.clr-progress{position:absolute;top:calc(22px + env(safe-area-inset-top));display:flex;gap:6px;z-index:7}' +
      '.clr-dot{width:7px;height:7px;border-radius:50%;background:rgba(255,255,255,.22);transition:background .2s}' +
      '.clr-dot.on{background:#e8a000}' +
      '.clr-skip{position:absolute;top:calc(18px + env(safe-area-inset-top));right:20px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.18);color:#ccc;font:inherit;font-size:.74rem;font-weight:700;padding:6px 13px;border-radius:999px;cursor:pointer;z-index:8}' +
      '.clr-skip:hover{color:#fff}' +
      // width also capped by HEIGHT (5/7 card ⇒ ~56vh wide fits with the caption)
      // so landscape phones never clip the reveal card off-screen.
      '.clr-stage{position:relative;width:300px;max-width:min(82vw,56vh);z-index:6;perspective:1200px;animation:clrStageIn .45s cubic-bezier(.2,.9,.3,1.2) both}' +
      '@keyframes clrStageIn{from{opacity:0;transform:translateY(16px) scale(.93)}to{opacity:1;transform:none}}' +
      '.clr-stage::after{content:"";position:absolute;left:50%;bottom:-22px;width:60%;height:24px;transform:translateX(-50%);background:radial-gradient(ellipse at center,rgba(0,0,0,.6),transparent 72%);filter:blur(5px);z-index:-1}' +
      // elite+ crossover shockwave: a rarity-coloured ring that blasts outward.
      // Pre-painted ring + transform/opacity keyframes only (compositor-safe).
      '.clr-shock{position:absolute;inset:-4%;border-radius:18px;pointer-events:none;opacity:0;border:2px solid var(--halo,#fff);box-shadow:0 0 22px var(--halo,transparent),inset 0 0 16px var(--halo,transparent)}' +
      '.clr-shock.go{animation:clrShock .75s cubic-bezier(.19,1,.22,1) forwards}' +
      '@keyframes clrShock{0%{opacity:.95;transform:scale(.7)}100%{opacity:0;transform:scale(1.65)}}' +
      '.clr-flip{position:relative;width:100%;aspect-ratio:5/7;transform-style:preserve-3d;transform:rotateY(180deg);will-change:transform}' +
      '.clr-flip.flipped{transform:rotateY(0)}' +                       // static (reduced-motion) reveal
      '.clr-flip.flip-go{animation:clrFlip 1.05s cubic-bezier(.42,.04,.24,1) forwards}' +
      '@keyframes clrFlip{0%{transform:rotateY(180deg) scale(.84)}46%{transform:rotateY(94deg) scale(.95)}72%{transform:rotateY(-11deg) scale(1.05)}100%{transform:rotateY(0) scale(1)}}' +
      '.clr-flip.flip-go.live{animation:clrLive 5s ease-in-out infinite}' +
      '@keyframes clrLive{0%,100%{transform:rotateY(0) rotateX(0)}25%{transform:rotateY(6deg) rotateX(-2.5deg)}50%{transform:rotateY(0) rotateX(0)}75%{transform:rotateY(-6deg) rotateX(2.5deg)}}' +
      '.clr-face,.clr-back{position:absolute;inset:0;-webkit-backface-visibility:hidden;backface-visibility:hidden;border-radius:12px;overflow:hidden}' +
      // The inner card tilts on hover after the flip settles; the face must NOT clip
      // it (its own 13px radius/overflow handles the card shape) or the tilt gets
      // cropped against this static rectangle. Content layers here are inset:0, so
      // dropping the clip is safe.
      '.clr-face{overflow:visible}' +
      // Real card THICKNESS: clr-flip is already preserve-3d, so push the front face
      // out by --thick and build 4 dark side walls (--cw = pixel width, set in JS) —
      // as the card spins through edge-on during the flip you see its physical side.
      '.clr-flip{--thick:7px}' +
      '.clr-face{transform:translateZ(var(--thick))}' +
      '.clr-edge{position:absolute;background:linear-gradient(180deg,#33456a,#1a2a48 45%,#0e1830);box-shadow:inset 0 1px 0 rgba(255,255,255,.16),inset 0 0 9px rgba(0,0,0,.45);transition:opacity .35s ease}' +
      // The 3D thickness walls are a flip-time effect. Once the card settles and the
      // inner face tilts on hover/gyro, the walls (which sit on the static flip box)
      // read as a stray blue rectangle behind the card — so fade them out once settled.
      '.clr-flip.live .clr-edge,.clr-flip.flipped .clr-edge{opacity:0}' +
      '.clr-edge.e-l,.clr-edge.e-r{top:0;height:100%;width:calc(var(--thick) * 2);left:calc(50% - var(--thick))}' +
      '.clr-edge.e-r{transform:rotateY(90deg) translateZ(calc(var(--cw,300px) / 2))}' +
      '.clr-edge.e-l{transform:rotateY(-90deg) translateZ(calc(var(--cw,300px) / 2))}' +
      '.clr-edge.e-t,.clr-edge.e-b{left:0;width:100%;height:calc(var(--thick) * 2);top:calc(50% - var(--thick))}' +
      '.clr-edge.e-t{transform:rotateX(90deg) translateZ(calc(var(--cw,300px) * 0.7))}' +
      '.clr-edge.e-b{transform:rotateX(-90deg) translateZ(calc(var(--cw,300px) * 0.7))}' +
      // light + shade that fire as the front face swings into view — makes the card a lit surface, not a flat plane
      '.clr-face::before{content:"";position:absolute;inset:0;z-index:29;pointer-events:none;border-radius:12px;opacity:0;background:linear-gradient(106deg,rgba(0,0,0,.45),transparent 46%,transparent 60%,rgba(255,255,255,.12))}' +
      '.clr-face::after{content:"";position:absolute;inset:0;z-index:30;pointer-events:none;border-radius:12px;opacity:0;background:linear-gradient(118deg,transparent 34%,rgba(255,255,255,.92) 50%,transparent 66%)}' +
      '.clr-flip.flip-go .clr-face::before{animation:clrShade 1.05s ease-out}' +
      '.clr-flip.flip-go .clr-face::after{animation:clrLightPass 1.05s ease-in-out}' +
      '@keyframes clrShade{0%,46%{opacity:0}68%{opacity:1}100%{opacity:0}}' +
      '@keyframes clrLightPass{0%,40%{opacity:0}55%{opacity:.95}76%{opacity:.22}100%{opacity:0}}' +
      '.clr-back{transform:rotateY(180deg) translateZ(var(--thick,7px));background:var(--cbk-bg,#0c1117);border:1px solid rgba(255,255,255,.09);display:flex;align-items:center;justify-content:center}' +
      '.clr-mono{font-size:3rem;font-weight:800;color:#e8a000;letter-spacing:-.05em;text-shadow:0 2px 14px rgba(232,140,0,.5)}' +
      // ── back geometry (shared by reveal flip + picker swatches; palette via --cbk-* vars) ──
      '.cbk{position:absolute;inset:0;container-type:inline-size;pointer-events:none}' +
      '.cbk-perf{position:absolute;top:0;bottom:0;width:4.7cqw;border-radius:.8cqw;background:repeating-linear-gradient(180deg,var(--cbk-perf,rgba(232,194,74,.32)) 0 4.2cqw,transparent 4.2cqw 8.4cqw)}' +
      '.cbk-perf.l{left:5.8cqw}.cbk-perf.r{right:5.8cqw}' +
      '.cbk-cross{position:absolute;background:var(--cbk-cross,rgba(232,194,74,.14))}' +
      '.cbk-cross.v{left:50%;top:0;bottom:0;width:1px}' +
      '.cbk-cross.h{top:50%;left:10.5cqw;right:10.5cqw;height:1px}' +
      '.cbk-circle{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:54.7cqw;aspect-ratio:1;border-radius:50%;border:.9cqw solid var(--cbk-ring,rgba(232,194,74,.5));background:var(--cbk-cbg,transparent);display:flex;align-items:center;justify-content:center}' +
      '.cbk-circle::before{content:"";position:absolute;inset:3.7cqw;border-radius:50%;border:.6cqw solid var(--cbk-ring2,rgba(232,194,74,.22))}' +
      '.cbk-mono{font-size:17.4cqw;font-weight:900;letter-spacing:-.03em;background:var(--cbk-cl,linear-gradient(160deg,#f0a832,#c47f16));-webkit-background-clip:text;background-clip:text;color:transparent;-webkit-text-fill-color:transparent;filter:drop-shadow(0 .8cqw 2.4cqw var(--cbk-glow,rgba(232,194,74,.35)))}' +
      '.cbk-word{position:absolute;left:0;right:0;bottom:13.7cqw;text-align:center;font-family:"Space Mono",ui-monospace,Menlo,monospace;font-size:3.9cqw;font-weight:700;letter-spacing:.32em;text-indent:.32em;text-transform:uppercase;color:var(--cbk-word,rgba(255,255,255,.42))}' +
      '.clr-halo{position:absolute;inset:0;border-radius:12px;box-shadow:0 0 0 0 var(--halo,transparent)}' +
      '.clr-flip:not(.flip-go):not(.flipped) .clr-halo{animation:clrHalo 1s ease-in-out infinite}' +
      '@keyframes clrHalo{0%,100%{box-shadow:0 0 10px 1px var(--halo,transparent),inset 0 0 12px var(--halo,transparent)}50%{box-shadow:0 0 30px 7px var(--halo,transparent),inset 0 0 22px var(--halo,transparent)}}' +
      '.clr-cap{margin-top:20px;text-align:center;z-index:6;min-height:54px}' +
      '.clr-tag{display:inline-block;font-size:.72rem;font-weight:800;letter-spacing:.14em;text-transform:uppercase;border-radius:6px;padding:4px 11px;animation:clrPop .42s cubic-bezier(.2,1.7,.4,1) both}' +
      '.clr-tag.new{color:#06281a;background:#7fd49a}.clr-tag.dupe{color:#1a1200;background:linear-gradient(135deg,#f5c542,#e8a000)}' +
      '@keyframes clrPop{0%{opacity:0;transform:scale(.4)}100%{opacity:1;transform:scale(1)}}' +
      '.clr-rare-lbl{display:block;margin-top:5px;font-size:.66rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase}' +
      '.clr-xp{display:block;margin-top:8px;color:#e8a000;font-weight:800;font-size:.92rem;letter-spacing:.02em}' +
      '.clr-hint{position:absolute;bottom:24px;color:rgba(255,255,255,.5);font-size:.78rem;z-index:6}' +
      '.clr-sum{display:flex;flex-direction:column;align-items:center;gap:13px;z-index:6;text-align:center;animation:clrIn2 .4s ease both}' +
      '@keyframes clrIn2{from{opacity:0;transform:translateY(12px)}to{opacity:1}}' +
      '.clr-sum-h{font-size:1.5rem;font-weight:800;color:#f5f5f5}.clr-sum-x{color:#e8a000;font-weight:800}.clr-sum-lvl{color:#7fd49a;font-weight:800;font-size:.95rem}' +
      '.clr-sum-btns{display:flex;gap:10px;margin-top:6px}' +
      '.clr-btn{padding:11px 20px;border-radius:12px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.06);color:#f0f0f0;font:inherit;font-weight:800;cursor:pointer}.clr-btn.gold{background:linear-gradient(135deg,#f5c542,#e8a000);color:#111;border:none}' +
      '@media(prefers-reduced-motion:reduce){.clr-stage,.clr-flip.flip-go,.clr-flip.live{animation:none}.clr-flash.go,.clr-flip .clr-halo,.clr-face::before,.clr-face::after{animation:none}.clr-face::before,.clr-face::after{display:none}}' +
      // ── sets view ──
      '.cl-set{width:100%;display:flex;align-items:center;gap:12px;padding:13px 14px;margin-bottom:10px;border-radius:12px;background:#2c343f;border:1px solid rgba(255,255,255,.09);cursor:pointer;text-align:left;font:inherit;color:#f0f0f0}' +
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
      // ── premium collections view (poster-fan set cards + milestone rings) ──
      '.cl-sx-hero{display:flex;align-items:center;gap:14px;padding:14px 15px;margin:6px 0 4px;border-radius:16px;background:linear-gradient(135deg,rgba(232,160,0,.15),rgba(20,20,22,.4));border:1px solid rgba(232,194,74,.24)}' +
      '.cl-sx-hero-n{font-size:1.75rem;font-weight:800;color:#f5c542;line-height:1;font-variant-numeric:tabular-nums;flex-shrink:0}' +
      '.cl-sx-hero-n i{font-style:normal;font-size:.9rem;color:#9a8a5a;font-weight:800}' +
      '.cl-sx-hero-t b{display:block;font-size:1rem;font-weight:800;color:#f4ecd8;letter-spacing:.01em}' +
      '.cl-sx-hero-t span{display:block;font-size:.72rem;color:#a89e88;margin-top:2px;line-height:1.4}' +
      '.cl-sx-sec{display:flex;align-items:baseline;gap:9px;margin:18px 2px 10px}' +
      '.cl-sx-sec>span{font-size:.68rem;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#c9a24a}' +
      '.cl-sx-sec>em{font-style:normal;font-size:.64rem;color:#7a7362;font-weight:700}' +
      '.cl-sx-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(210px,46vw),1fr));gap:12px}' +
      '.cl-sx{position:relative;display:flex;flex-direction:column;gap:11px;padding:15px 14px 13px;border-radius:16px;background:linear-gradient(180deg,#1e1d1b,#161514);border:1px solid rgba(255,255,255,.08);cursor:pointer;text-align:left;font:inherit;color:#f0f0f0;overflow:hidden;transition:transform .18s cubic-bezier(.2,.8,.2,1),border-color .2s,box-shadow .2s}' +
      '.cl-sx[data-set]:hover{transform:translateY(-3px);border-color:rgba(232,194,74,.5);box-shadow:0 14px 34px rgba(0,0,0,.45)}' +
      '.cl-sx.done{border-color:rgba(232,194,74,.55);background:linear-gradient(180deg,rgba(232,160,0,.14),#161211)}' +
      '.cl-sx.done::after{content:"";position:absolute;inset:0;pointer-events:none;background:radial-gradient(120% 60% at 50% -10%,rgba(245,197,66,.22),transparent 60%)}' +
      '.cl-sx.locked{cursor:default}' +
      '.cl-sx-fan{position:relative;height:98px;display:flex;justify-content:center;align-items:flex-start;padding-top:6px}' +
      '.cl-sx-p{width:58px;height:84px;margin:0 -15px;border-radius:8px;background:#0c0c0e center/cover no-repeat;border:1.5px solid rgba(255,255,255,.14);box-shadow:0 6px 15px rgba(0,0,0,.5);transform-origin:bottom center;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.18);font-weight:800;font-size:1.4rem}' +
      '.cl-sx-p.own{border-color:rgba(232,194,74,.5)}' +
      '.cl-sx-p.myst{background:repeating-linear-gradient(45deg,#141414,#141414 7px,#1a1a1a 7px,#1a1a1a 14px);color:rgba(255,255,255,.28)}' +
      '.cl-sx-info{display:flex;flex-direction:column;gap:7px}' +
      '.cl-sx-nm{font-weight:800;font-size:.9rem;color:#f2ead6;display:flex;align-items:center;gap:6px;line-height:1.2}' +
      '.cl-sx-foot{display:flex;align-items:center;justify-content:space-between;gap:8px}' +
      '.cl-sx-ct{font-size:.74rem;color:#b7ad95;font-weight:800;font-variant-numeric:tabular-nums}' +
      '.cl-sx-rw{font-size:.6rem;font-weight:800;letter-spacing:.04em;color:#8fd6a0;background:rgba(120,200,140,.12);border:1px solid rgba(120,200,140,.32);border-radius:999px;padding:2px 8px;white-space:nowrap}' +
      '.cl-sx-crown{color:#f5c542;font-size:1rem;filter:drop-shadow(0 2px 6px rgba(245,197,66,.55))}' +
      '.cl-sx-crown.sm{font-size:.85rem}' +
      '.cl-sx-hint{font-size:.68rem;color:#8a8272;font-weight:700}' +
      '.cl-sx.mile{flex-direction:row;align-items:center;gap:13px;padding:13px 14px}' +
      '.cl-sx-ring{--p:0;flex-shrink:0;width:56px;height:56px;border-radius:50%;background:conic-gradient(#f5c542 calc(var(--p)*1%),rgba(255,255,255,.09) 0)}' +
      '.cl-sx-ring span{width:44px;height:44px;margin:6px;border-radius:50%;background:#212831;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:.9rem;color:#f2ead6;font-variant-numeric:tabular-nums}' +
      '.cl-sx-ring i{font-style:normal;font-size:.6rem;color:#8a8272}' +
      '.cl-sx.mile .cl-sx-info{flex:1;min-width:0}' +
      '.cl-slot{position:relative;aspect-ratio:5/7;border-radius:12px;border:1.5px dashed rgba(255,255,255,.16);background:repeating-linear-gradient(45deg,#28303a,#28303a 9px,#2c343f 9px,#2c343f 18px);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;text-align:center;padding:8px}' +
      '.cl-slot-q{font-size:1.8rem;font-weight:800;color:rgba(255,255,255,.22)}' +
      '.cl-slot-nm{font-size:.64rem;font-weight:700;color:rgba(255,255,255,.45);line-height:1.2}' +
      '.cl-slot-forge{font:inherit;font-size:.66rem;font-weight:800;color:#bfe6ff;background:rgba(120,184,255,.12);border:1px solid rgba(150,205,255,.4);border-radius:999px;padding:4px 10px;cursor:pointer;transition:background .15s}' +
      '.cl-slot-forge:hover{background:rgba(120,184,255,.22)}' +
      '.cl-slot-forge.off{color:#8a8a8a;background:rgba(255,255,255,.05);border-color:rgba(255,255,255,.14)}' +
      '.cl-slot-forge.shake{animation:clShake .4s}' +
      '.cl-slot-forge:disabled{opacity:.6;cursor:default}' +
      // ── card-back materials: each cb-* swaps the --cbk-* palette on the shared geometry ──
      '.clr-back.cb-gold,.cb-swatch.cb-gold{--cbk-bg:linear-gradient(160deg,#1c1408,#0e0903);--cbk-perf:rgba(245,217,122,.4);--cbk-cross:rgba(245,217,122,.16);--cbk-ring:rgba(245,217,122,.65);--cbk-ring2:rgba(245,217,122,.3);--cbk-cl:linear-gradient(160deg,#f5d97a,#c8921a);--cbk-glow:rgba(232,194,74,.55);--cbk-word:rgba(245,217,122,.5)}' +
      '.clr-back.cb-holo,.cb-swatch.cb-holo{--cbk-bg:conic-gradient(from 0deg,#241d33,#1a2638,#1a2f2a,#2e271a,#241d33);--cbk-perf:rgba(255,255,255,.35);--cbk-cross:rgba(255,255,255,.14);--cbk-ring:rgba(255,255,255,.55);--cbk-ring2:rgba(255,255,255,.25);--cbk-cl:linear-gradient(120deg,#ffd3d3,#fff7c9,#cfffdc,#cdeeff,#e3d3ff);--cbk-glow:rgba(255,255,255,.4);--cbk-word:rgba(255,255,255,.55)}' +
      '.clr-back.cb-aurora,.cb-swatch.cb-aurora{--cbk-bg:linear-gradient(160deg,#07222e,#0d3b40 55%,#14524a);--cbk-perf:rgba(140,230,210,.38);--cbk-cross:rgba(140,230,210,.14);--cbk-ring:rgba(140,230,210,.6);--cbk-ring2:rgba(140,230,210,.28);--cbk-cl:linear-gradient(160deg,#baf5df,#3aa88f);--cbk-glow:rgba(120,230,200,.5);--cbk-word:rgba(200,255,240,.5)}' +
      '.clr-back.cb-midnight,.cb-swatch.cb-midnight{--cbk-bg:radial-gradient(circle at 30% 20%,#141b2e,#070b14);--cbk-perf:rgba(122,166,232,.35);--cbk-cross:rgba(122,166,232,.14);--cbk-ring:rgba(122,166,232,.55);--cbk-ring2:rgba(122,166,232,.26);--cbk-cl:linear-gradient(160deg,#cfe0ff,#6f92d8);--cbk-glow:rgba(122,166,232,.45);--cbk-word:rgba(170,200,245,.5)}' +
      '.clr-back.cb-crimson,.cb-swatch.cb-crimson{--cbk-bg:linear-gradient(160deg,#2a0d12,#12060a);--cbk-perf:rgba(216,90,90,.4);--cbk-cross:rgba(216,90,90,.15);--cbk-ring:rgba(216,90,90,.6);--cbk-ring2:rgba(216,90,90,.28);--cbk-cl:linear-gradient(160deg,#f0a0a0,#b04040);--cbk-glow:rgba(216,90,90,.5);--cbk-word:rgba(240,160,160,.5)}' +
      '.clr-back.cb-emerald,.cb-swatch.cb-emerald{--cbk-bg:linear-gradient(160deg,#08211a,#04120c);--cbk-perf:rgba(80,200,140,.4);--cbk-cross:rgba(80,200,140,.15);--cbk-ring:rgba(80,200,140,.6);--cbk-ring2:rgba(80,200,140,.28);--cbk-cl:linear-gradient(160deg,#9fe8bf,#2f9e68);--cbk-glow:rgba(80,200,140,.55);--cbk-word:rgba(160,240,200,.5)}' +
      '.clr-back.cb-prism,.cb-swatch.cb-prism{--cbk-bg:linear-gradient(160deg,#191024,#0b0714);--cbk-perf:rgba(216,160,255,.4);--cbk-cross:rgba(216,160,255,.16);--cbk-ring:rgba(216,160,255,.6);--cbk-ring2:rgba(216,160,255,.28);--cbk-cl:linear-gradient(100deg,#ff9a9a,#fff39a,#9affb0,#9ad9ff,#c39aff);--cbk-glow:rgba(180,140,255,.5);--cbk-word:rgba(220,190,255,.55)}' +
      '.clr-back.cb-mastery,.cb-swatch.cb-mastery{--cbk-bg:conic-gradient(from 45deg,#0b0b0b,#2e2208,#4a3a12,#2e2208,#0b0b0b,#1a1206,#0b0b0b);--cbk-perf:rgba(232,194,74,.5);--cbk-cross:rgba(232,194,74,.2);--cbk-ring:rgba(232,194,74,.8);--cbk-ring2:rgba(232,194,74,.4);--cbk-cl:linear-gradient(160deg,#fff7dd,#e8c24a);--cbk-glow:rgba(232,194,74,.75);--cbk-word:rgba(255,240,200,.6)}' +
      '.clr-back.cb-obsidian,.cb-swatch.cb-obsidian{--cbk-bg:radial-gradient(120% 120% at 30% 20%,#22242a,#0a0a0c);--cbk-perf:rgba(150,170,200,.4);--cbk-cross:rgba(150,170,200,.15);--cbk-ring:rgba(150,170,200,.6);--cbk-ring2:rgba(150,170,200,.28);--cbk-cl:linear-gradient(120deg,#dfe7f2,#9fb2c9);--cbk-glow:rgba(150,180,220,.45);--cbk-word:rgba(190,205,225,.55)}' +
      // ── Set-complete reward motion ──
      '#clSetWin{position:fixed;inset:0;z-index:255;display:none;align-items:center;justify-content:center;padding:22px;background:rgba(8,11,15,.72);backdrop-filter:blur(6px)}' +
      '#clSetWin.on{display:flex;animation:clswFade .25s ease both}' +
      '@keyframes clswFade{from{opacity:0}to{opacity:1}}' +
      '.clsw-card{position:relative;width:100%;max-width:340px;text-align:center;background:var(--s1,#2c343f);border:1px solid rgba(232,194,74,.4);border-radius:20px;padding:26px 22px 22px;box-shadow:0 24px 70px rgba(0,0,0,.5);animation:clswPop .42s cubic-bezier(.22,1,.36,1) both}' +
      '@keyframes clswPop{from{opacity:0;transform:translateY(18px) scale(.94)}to{opacity:1;transform:none}}' +
      '.clsw-badge{width:64px;height:64px;margin:0 auto 12px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#1a1408;background:linear-gradient(160deg,#f5d97a,#e8a000);box-shadow:0 0 0 6px rgba(232,194,74,.14),0 10px 26px rgba(232,160,0,.4)}' +
      '.clsw-badge svg{width:34px;height:34px}' +
      '.clsw-kicker{font-size:.62rem;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:#e8c24a}' +
      '.clsw-name{font-family:var(--fdisp,Georgia,serif);font-weight:600;font-size:1.32rem;color:#f4f6f8;margin:5px 0 14px;line-height:1.15}' +
      '.clsw-xp{display:inline-flex;align-items:center;gap:7px;font-weight:800;font-size:1.05rem;color:#1a1408;background:linear-gradient(135deg,#f5d97a,#e8a000);border-radius:999px;padding:8px 16px}' +
      '.clsw-cta{margin-top:18px;width:100%;border:0;border-radius:999px;background:rgba(255,255,255,.06);color:var(--txt,#f0f0f0);font:inherit;font-weight:800;font-size:.88rem;padding:11px;cursor:pointer}' +
      '.clsw-cta:hover{background:rgba(255,255,255,.11)}' +
      // the flying XP coin that arcs from the card into the header level bar
      '.cl-xp-coin{position:fixed;z-index:260;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:.62rem;color:#1a1408;background:linear-gradient(160deg,#f5d97a,#e8a000);box-shadow:0 6px 18px rgba(232,160,0,.5);pointer-events:none;will-change:transform,opacity;transition:transform .62s cubic-bezier(.5,0,.6,1),opacity .62s ease}' +
      // level bar / number reactions
      '.cl-coll-xp-bar>i.gain{transition:width .8s cubic-bezier(.3,.9,.3,1)}' +
      '.cl-coll-xp-bar.flash{box-shadow:0 0 0 0 rgba(232,194,74,.6);animation:clxpFlash .7s ease}' +
      '@keyframes clxpFlash{0%{box-shadow:0 0 0 0 rgba(232,194,74,.55)}100%{box-shadow:0 0 0 7px rgba(232,194,74,0)}}' +
      '.cl-lvl-ring.levelup{animation:clLvlPop .7s cubic-bezier(.2,1.4,.4,1) both}' +
      '@keyframes clLvlPop{0%{transform:scale(1)}40%{transform:scale(1.28)}100%{transform:scale(1)}}' +
      '@media(prefers-reduced-motion:reduce){.clsw-card,#clSetWin.on{animation:none}.cl-xp-coin{transition:opacity .3s ease}.cl-lvl-ring.levelup{animation:none}}' +
      '.cb-sub{font-size:.74rem;color:#9a9a9a;margin-bottom:14px}' +
      '.cb-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:12px}' +
      '.cb-item{cursor:pointer;text-align:center}.cb-item.locked{cursor:default}' +
      '.cb-swatch{position:relative;aspect-ratio:5/7;border-radius:12px;overflow:hidden;display:flex;align-items:center;justify-content:center;background:var(--cbk-bg,#0c1117);border:1px solid rgba(255,255,255,.09)}' +
      '' +
      '.cb-item.active .cb-swatch{outline:2px solid #e8a000;outline-offset:2px}' +
      '.cb-item.locked .cb-swatch{filter:grayscale(.7) brightness(.5)}' +
      '.cb-item.locked .cb-swatch::after{content:attr(data-req);position:absolute;inset:0;display:flex;align-items:flex-start;justify-content:center;text-align:center;padding:12px 6px;color:#fff;font-size:.66rem;font-weight:800;background:rgba(0,0,0,.55)}' +
      '.cb-nm{font-size:.7rem;font-weight:700;color:#cfcfcf;margin-top:6px}.cb-item.locked .cb-nm{color:#777}' +
      '.ac-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(148px,1fr));gap:11px}' +
      '.ac-item{position:relative;border-radius:12px;padding:13px 11px 12px;text-align:center;background:#2c343f;border:1px solid rgba(255,255,255,.06)}' +
      '.ac-item.got{background:linear-gradient(165deg,#2a2410,#161204);border-color:rgba(232,194,74,.4);box-shadow:0 0 0 1px rgba(232,194,74,.12),0 10px 26px rgba(0,0,0,.4)}' +
      '.ac-ic{color:#e8c24a;font-size:1.9rem;line-height:1;filter:grayscale(1) opacity(.4)}.ac-ic svg{width:30px;height:30px}' +
      '.ac-item.got .ac-ic{filter:drop-shadow(0 3px 10px rgba(232,194,74,.5))}' +
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
      '@media(prefers-reduced-motion:reduce){.cl-pre{opacity:1!important;transform:none!important}.cl-rise{animation:none}.clr-shader{display:none}.clr-shock{display:none}}' +
      // ── Mobile (coarse pointer) compositing diet ──
      // backdrop-filter re-filters the full backdrop texture every frame anything above it
      // changes, and the detail view stacks a second fullscreen blur on top of the gallery's.
      // On Android that plus the card's paint-invalidating animations starves the raster
      // queue → black tile flashes over the card photo. Swap blurs for darker scrims.
      '@media(pointer:coarse){' +
        '#clCollDebug{backdrop-filter:none;background:rgba(0,0,0,.9)}' +
        '#clCollDetail{backdrop-filter:none;background:rgba(0,0,0,.94)}' +
        '#clCollReveal{backdrop-filter:none}' +
        // shine foil drift animates background-position (main-thread repaint per frame):
        // static on mobile, still lights up and tracks the drag tilt. Blend gone too
        // (render surface), so drop the opacity to keep the wash subtle.
        '.cl-shine .auth-foil,.cl-shine .ctc-foil{animation:none;mix-blend-mode:normal;filter:none;opacity:.4}' +
        // While the detail view is open the gallery grid below it still held dozens of
        // live card layer stacks — hide it so its textures are released. (Coarse-only:
        // desktop keeps the blurred grid visible behind the backdrop-filter.)
        'body:has(#clCollDetail.open) #clCollModal .cl-coll-grid{visibility:hidden}' +
        // halo pulse: box-shadow keyframes repaint per frame — pulse opacity instead
        // (compositor-only) over a static glow.
        '.clr-flip:not(.flip-go):not(.flipped) .clr-halo{animation:clrHaloO 1s ease-in-out infinite;box-shadow:0 0 24px 5px var(--halo,transparent),inset 0 0 18px var(--halo,transparent)}' +
      '}' +
      '@keyframes clrHaloO{0%,100%{opacity:.35}50%{opacity:1}}';
    document.head.appendChild(css);
  }

  // The Vault: fullscreen stage — identity strip up top, labelled tabs (bottom bar
  // on mobile via CSS), a Cards toolbar (search / rarity gems / sort), and the
  // scrolling tier-sectioned grid. Card backs & trophies live as tabs, not modals.
  var RING_C = 138.23;                                   // 2π·22 (level-ring circumference)
  function buildModal() {
    var m = document.getElementById('clCollModal');
    if (m) return m;
    m = document.createElement('div'); m.id = 'clCollModal'; m.setAttribute('role', 'dialog');
    m.innerHTML =
      '<div class="cl-vault-hd">' +
        '<div class="cl-coll-hd-top">' +
          '<div><div class="cl-coll-title">Your <span>collection</span></div><div class="cl-coll-sub" id="clCollSub"></div></div>' +
          '<div class="cl-coll-hd-btns" id="clCollHdBtns"><a class="cl-coll-dust cl-coll-battle" href="/rating/toptrumps" title="Top Trumps — battle the CPU with cards from this collection">&#9876;&#65039;<span class="lbl">&nbsp;Battle</span></a><span class="cl-coll-dust" id="clCollDD" title="Daily Double — win two daily games today for bonus dust">&#9889; 0/2</span><span class="cl-coll-dust" id="clCollDust" title="Dust — earned from duplicate cards, leveling up, the Daily Double and trophies. Spend it to Prime your next card (guarantee its rarity), Shine a card (permanent foil) or Forge a missing set card.">&#10024; 0</span><button class="cl-coll-x" aria-label="Close">&#10005;</button></div>' +
        '</div>' +
        '<div class="cl-coll-lvl">' +
          '<div class="cl-lvl-ring"><svg viewBox="0 0 52 52"><circle class="bg" cx="26" cy="26" r="22"></circle><circle class="fg" id="clCollRing" cx="26" cy="26" r="22" stroke-dasharray="' + RING_C + '" stroke-dashoffset="' + RING_C + '"></circle></svg><b id="clCollLvl">1</b></div>' +
          '<div class="cl-coll-xp">' +
            '<div class="cl-coll-xp-l"><span id="clCollXpName">Level 1</span><span class="cl-coll-next" id="clCollNext"></span></div>' +
            '<div class="cl-coll-xp-bar"><i id="clCollXpFill" style="width:0%"></i></div>' +
            '<div class="cl-coll-xp-l" style="margin-top:4px"><span id="clCollXpNum"></span><span id="clCollPity" title="Guaranteed floors: a dry streak always self-corrects"></span></div>' +
          '</div>' +
        '</div>' +
        '<div class="cl-vault-tabs" id="clVaultTabs"></div>' +
        '<div class="cl-quests" id="clQuests"></div>' +
        '<div class="cl-prime" id="clPrime"></div>' +
        '<div class="cl-vault-tools" id="clCollChips"></div>' +
      '</div>' +
      '<div class="cl-coll-grid" id="clCollGrid"></div>';
    document.body.appendChild(m);
    m.querySelector('.cl-coll-x').addEventListener('click', close);
    // optional debug gear (only when enabled)
    if (debugEnabled()) {
      var gear = document.createElement('button');
      gear.className = 'cl-coll-icon'; gear.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></svg>'; gear.title = 'Debug';
      gear.addEventListener('click', debug);
      document.getElementById('clCollHdBtns').insertBefore(gear, m.querySelector('.cl-coll-x'));
    }
    return m;
  }

  var _filter = 'all', _setOpen = null, _tab = 'cards', _query = '', _sort = 'rarity';
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

  var TABS = [
    { k: 'cards', ic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="14" height="18" rx="2.2"/><path d="M9 8h6M9 12h6M9 16h3"/></svg>', label: 'Cards' }, { k: 'sets', ic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.4"/><rect x="14" y="3" width="7" height="7" rx="1.4"/><rect x="3" y="14" width="7" height="7" rx="1.4"/><rect x="14" y="14" width="7" height="7" rx="1.4"/></svg>', label: 'Sets' },
    { k: 'show', ic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.2l2.5 5.3 5.8.8-4.2 4 1 5.7-5.1-2.7-5.1 2.7 1-5.7-4.2-4 5.8-.8z"/></svg>', label: 'Showcase' },
    { k: 'backs', ic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2.4"/><path d="M12 4v16M4 12h16" opacity=".55"/><circle cx="12" cy="12" r="3.2"/></svg>', label: 'Backs' }, { k: 'trophies', ic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4h10v3.5a5 5 0 0 1-10 0z"/><path d="M7 5.5H4V7a3 3 0 0 0 3 3M17 5.5h3V7a3 3 0 0 1-3 3"/><path d="M12 12.5V16M9 20h6M9.5 20l.6-4M14.5 20l-.6-4"/></svg>', label: 'Trophies' }
  ];
  // What leveling gives you next — the retention teaser beside the XP bar.
  function nextUnlock(st) {
    var lv = CARDBACKS.filter(function (cb) { return cb.level && cb.level > st.level; }).sort(function (a, b) { return a.level - b.level; })[0];
    if (lv) return 'Next: ' + lv.name + ' back &middot; Lvl ' + lv.level;
    var have = achvCount();
    var ac = CARDBACKS.filter(function (cb) { return cb.achv && have < cb.achv; }).sort(function (a, b) { return a.achv - b.achv; })[0];
    if (ac) return 'Next: ' + ac.name + ' back &middot; ' + ac.achv + ' trophies';
    return 'All card backs unlocked';
  }
  // Tier sections get physically larger cards as rarity climbs (presence = status);
  // min() keeps phones at 2 columns instead of blowing up to a single giant card.
  function tierCols(theme, tier) {
    var base = theme.gridCols || 'minmax(150px,1fr)';
    if (activeThemeName() !== 'authentic') return base;
    return tier === 'legendary' ? 'minmax(min(178px,42vw),1fr)' : tier === 'elite' ? 'minmax(min(162px,41vw),1fr)' : 'minmax(min(150px,40vw),1fr)';
  }
  function cardMatches(c, q) {
    if ((c.name || '').toLowerCase().indexOf(q) >= 0) return true;
    var m = c.i18n || {};
    for (var l in m) if (Object.prototype.hasOwnProperty.call(m, l) && (m[l] || '').toLowerCase().indexOf(q) >= 0) return true;
    return false;
  }
  var SORTS = [
    { k: 'rarity', label: 'Rarity' }, { k: 'new', label: 'Newest' }, { k: 'name', label: 'A–Z' },
    { k: 'no', label: 'Number' }, { k: 'copies', label: 'Copies' }
  ];
  function sortCards(cards) {
    var by = {
      rarity: function (a, b) { return (ORDER[a.rarity] - ORDER[b.rarity]) || (a.name || '').localeCompare(b.name || ''); },
      'new': function (a, b) { return (b.first || '').localeCompare(a.first || '') || (b.no || 0) - (a.no || 0); },
      name: function (a, b) { return locName(a).localeCompare(locName(b)); },
      no: function (a, b) { return (a.no || 0) - (b.no || 0); },
      copies: function (a, b) { return (b.n || 1) - (a.n || 1) || (ORDER[a.rarity] - ORDER[b.rarity]); }
    };
    return cards.sort(by[_sort] || by.rarity);
  }

  function render() {
    stopHolo();
    _uiLang = currentLang();
    var st = stats();
    document.getElementById('clCollLvl').textContent = st.level;
    document.getElementById('clCollXpName').textContent = 'Level ' + st.level;
    document.getElementById('clCollXpNum').innerHTML = st.xpInto + ' / ' + st.xpSpan + ' XP<span class="cl-xp-extra"> to level ' + (st.level + 1) + '</span>';
    document.getElementById('clCollXpFill').style.width = Math.max(3, Math.min(100, st.xpSpan ? (st.xpInto / st.xpSpan) * 100 : 0)) + '%';
    var ring = document.getElementById('clCollRing');
    if (ring) ring.style.strokeDashoffset = (RING_C * (1 - Math.min(1, st.xpSpan ? st.xpInto / st.xpSpan : 0))).toFixed(1);
    var nx = document.getElementById('clCollNext'); if (nx) nx.innerHTML = nextUnlock(st);
    var sub = document.getElementById('clCollSub');
    if (sub) {
      var synced = false; try { synced = !!localStorage.getItem('gauth_in'); } catch (_) { /* noop */ }
      sub.innerHTML = st.count + ' cards · ' + st.films + ' films · ' + st.people + ' people' +
        (st.depth > 0 ? ' · <span title="Vault depth — your total spare copies" style="color:#e8c24a">&#9707; depth ' + st.depth + '</span>' : '') +
        (synced ? ' · <span title="Signed in — your collection syncs across devices" style="color:#7fd49a">&#9729; synced</span>'
                : ' · <span title="Sign in on the home page to back up your collection across devices" style="color:#8d8d8d">&#9729; local</span>');
    }
    var du = document.getElementById('clCollDust'); if (du) du.innerHTML = '&#10024; ' + dustBalance();
    var sNow = load() || blank();
    // Daily Double chip: n/2 today, ✓ when banked
    var dd = document.getElementById('clCollDD');
    if (dd) {
      var t = today(), n = (sNow.dd && sNow.dd.d === t) ? sNow.dd.n : 0, done = !!(sNow.dd && sNow.dd.d === t && sNow.dd.done);
      dd.innerHTML = done ? '&#9889; &#10003; +' + 60 : '&#9889; ' + Math.min(n, 2) + '/2';
      dd.style.opacity = done ? '.75' : '';
    }
    // Visible pity: anxiety → anticipation ("guaranteed Elite in ≤3d")
    var pit = document.getElementById('clCollPity');
    if (pit) {
      if (sNow.pityE) {
        var tD = today();
        var eLeft = Math.max(0, PITY_ELITE_DAYS - daysBetween(sNow.pityE, tD));
        var lLeft = Math.max(0, PITY_LEG_DAYS - daysBetween(sNow.pityL || tD, tD));
        pit.innerHTML = '<span class="cl-xp-extra">Guaranteed: </span><span style="color:' + RARITY.elite.ring + '" title="An Elite or better prize is guaranteed within this many days">Elite &le;' + eLeft + 'd</span> · <span style="color:' + RARITY.legendary.ring + '" title="A Legendary prize is guaranteed within this many days">Legend. &le;' + lLeft + 'd</span>';
      } else pit.innerHTML = '';
    }

    // nav tabs (Cards badge = unseen new cards)
    document.getElementById('clVaultTabs').innerHTML = TABS.map(function (t) {
      var bdg = (t.k === 'cards' && st.newCount) ? '<span class="bdg">' + st.newCount + '</span>' : '';
      return '<button class="cl-vtab' + (_tab === t.k ? ' on' : '') + '" data-k="' + t.k + '"><span class="ic">' + t.ic + '</span><span>' + t.label + '</span>' + bdg + '</button>';
    }).join('');
    Array.prototype.forEach.call(document.querySelectorAll('#clVaultTabs .cl-vtab'), function (b) {
      b.addEventListener('click', function () {
        if (_tab === b.dataset.k) return;
        _tab = b.dataset.k; _setOpen = null;
        try { if (window.Sfx) window.Sfx.tap(); } catch (_) { /* noop */ }
        render();
      });
    });

    var tools = document.getElementById('clCollChips');
    var grid = document.getElementById('clCollGrid');
    var _qs = document.getElementById('clQuests'); if (_qs && _tab !== 'cards') _qs.innerHTML = '';
    var _pr = document.getElementById('clPrime'); if (_pr && _tab !== 'cards') { _pr.innerHTML = ''; _pr.className = 'cl-prime'; }
    if (_tab === 'sets') { tools.innerHTML = ''; renderSets(); return; }
    if (_tab === 'show') { tools.innerHTML = ''; renderShowcase(); return; }
    if (_tab === 'backs') {
      tools.innerHTML = '';
      grid.style.display = 'block';
      grid.innerHTML = '<div class="cb-sub" style="margin:8px 2px 12px">Unlock card backs by leveling up or earning Mastery — or buy any locked back with &#10024;dust. Tap to equip.</div><div class="cb-grid" id="cbGrid"></div>';
      renderCardbacks(); return;
    }
    if (_tab === 'trophies') {
      tools.innerHTML = '';
      grid.style.display = 'block';
      grid.innerHTML = '<div class="cb-sub" id="acSub" style="margin:8px 2px 12px"></div><div class="cb-sub" style="margin:-6px 2px 12px">Each trophy pays a one-time &#10024;40 dust bounty.</div><div class="ac-grid" id="acGrid"></div>';
      renderAchv(); return;
    }

    renderQuests();
    renderPrime();
    // ── Cards tab: toolbar (search / rarity gems / sort) + tier-sectioned grid ──
    var chips = [
      { k: 'all', label: CT('All') }, { k: 'film', label: CT('Films') }, { k: 'person', label: CT('People') },
      { k: 'legendary', gem: RARITY.legendary.ring, label: st.byRarity.legendary }, { k: 'elite', gem: RARITY.elite.ring, label: st.byRarity.elite },
      { k: 'rare', gem: RARITY.rare.ring, label: st.byRarity.rare }, { k: 'common', gem: '#9a9a9a', label: st.byRarity.common }
    ];
    tools.innerHTML =
      '<span class="cl-vsearch"><input id="clVaultQ" type="search" placeholder="Search cards…" autocomplete="off" value="' + esc(_query) + '"></span>' +
      '<div class="cl-vchips">' +
        chips.map(function (c) {
          return '<button class="cl-coll-chip' + (_filter === c.k ? ' on' : '') + '" data-k="' + c.k + '"' + (c.gem ? ' style="--gc:' + c.gem + '"' : '') + '>' + (c.gem ? '<span class="gem"></span>' : '') + c.label + '</button>';
        }).join('') +
        '<select class="cl-vsort" id="clVaultSort" title="Sort">' + SORTS.map(function (s) { return '<option value="' + s.k + '"' + (_sort === s.k ? ' selected' : '') + '>' + s.label + '</option>'; }).join('') + '</select>' +
      '</div>';
    Array.prototype.forEach.call(tools.querySelectorAll('.cl-coll-chip'), function (b) {
      b.addEventListener('click', function () { _filter = _filter === b.dataset.k ? 'all' : b.dataset.k; render(); });
    });
    var q = document.getElementById('clVaultQ'), qT = 0;
    q.addEventListener('input', function () { clearTimeout(qT); qT = setTimeout(function () { _query = q.value.trim(); renderCardsGrid(); }, 140); });
    document.getElementById('clVaultSort').addEventListener('change', function (e) { _sort = e.target.value; renderCardsGrid(); });
    renderCardsGrid();
  }

  // The grid alone re-renders on search/sort so the search input keeps focus.
  function renderCardsGrid() {
    stopHolo();
    var theme = activeTheme();
    injectThemeCss(theme);
    var grid = document.getElementById('clCollGrid');
    var query = _query.toLowerCase();
    var cards = allCards().filter(function (c) {
      if (query && !cardMatches(c, query)) return false;
      if (_filter === 'all') return true;
      if (_filter === 'film') return c.type !== 'person';
      if (_filter === 'person') return c.type === 'person';
      return c.rarity === _filter;
    });
    sortCards(cards);
    grid.style.display = 'block';
    grid.style.gridTemplateColumns = ''; grid.style.justifyContent = ''; grid.style.gap = '';
    if (!cards.length) {
      grid.innerHTML = query
        ? '<div class="cl-coll-empty"><div class="cl-empty-row"><div class="cl-ghost">?</div><div class="cl-ghost">?</div><div class="cl-ghost">?</div></div>No cards match &ldquo;' + esc(_query) + '&rdquo;.</div>'
        : '<div class="cl-coll-empty"><div class="cl-empty-row"><div class="cl-ghost">?</div><div class="cl-ghost">?</div><div class="cl-ghost">?</div></div>' +
          '<div class="cl-empty-title">Start your collection</div>' +
          '<div>Win a daily game to pull your first card. Better solves can upgrade the prize.</div>' +
          '<div class="cl-empty-steps"><div class="cl-empty-step"><b>1 · Play</b>Finish a daily puzzle.</div><div class="cl-empty-step"><b>2 · Reveal</b>Flip your prize card.</div><div class="cl-empty-step"><b>3 · Complete</b>Build sets, dust dupes, unlock backs.</div></div>' +
          '<a class="cl-empty-cta" href="/">Choose today&apos;s daily</a></div>';
      try { if (!query && window.Track) window.Track('collection_zero_state'); } catch (_) { /* noop */ }
      return;
    }
    // Sections: rarity sort groups by tier (with unseen cards pinned on top);
    // any other sort/search is one flat stream labelled by what you asked for.
    var secs = [];
    if (_sort === 'rarity' && !query) {
      var news = cards.filter(function (c) { return c.isNew; });
      if (news.length >= 2) secs.push({ id: 'new', name: 'Just collected', color: '#7fd49a', cards: news });
      TIERS.slice().reverse().forEach(function (t) {
        var tc = cards.filter(function (c) { return c.rarity === t && !(news.length >= 2 && c.isNew); });
        if (tc.length) secs.push({ id: t, name: RARITY[t].label, color: t === 'common' ? '#9a9a9a' : RARITY[t].ring, cards: tc });
      });
    } else {
      var lbl = query ? 'Results' : (SORTS.filter(function (s) { return s.k === _sort; })[0] || {}).label || 'Cards';
      secs.push({ id: 'flat', name: lbl, color: '#cfcfcf', cards: cards });
    }
    var flat = [], gi = 0;
    grid.innerHTML = secs.map(function (sec) {
      var cells = sec.cards.map(function (c) { flat.push(c); return theme.card(locCard(c), CTX, gi++); }).join('');
      return '<div class="cl-sec" style="--sc:' + sec.color + '"><span class="gem"></span>' + esc(sec.name) + '<span class="n">' + sec.cards.length + '</span><span class="ln"></span></div>' +
        '<div class="cl-sec-grid" style="grid-template-columns:repeat(auto-fill,' + tierCols(theme, sec.id) + ')">' + cells + '</div>';
    }).join('');
    try { if (theme.mount) theme.mount(grid); } catch (_) { /* noop */ }
    var els = grid.querySelectorAll('.auth,.ctc,.clc-card');
    Array.prototype.forEach.call(els, function (el, idx) {
      el.style.cursor = 'pointer';
      el.addEventListener('click', function () { openDetail(flat[idx], el, { list: flat, i: idx }); });
    });
    scrollReveal(grid);
    mobileScrollHolo(grid);
    localizeCards(flat, els, _uiLang);
    normalizePosters(flat, els);
  }

  // Cards past the first screen start hidden and rise as they scroll into view —
  // the staggered Apple/Linear entrance. Progressive enhancement: a safety timer
  // reveals everything if IntersectionObserver misfires, and reduced-motion opts out.
  function scrollReveal(grid) {
    try {
      if (reducedMotion() || !window.IntersectionObserver) return;
      var kids = grid.querySelectorAll('.auth,.ctc,.clc-card'); if (kids.length <= 8) return;
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

  function renderShowcase() {
    var grid = document.getElementById('clCollGrid');
    var theme = activeTheme(); injectThemeCss(theme);
    var cards = showcaseCards().map(locCard);
    grid.style.display = 'block';
    grid.style.gridTemplateColumns = '';
    var cells = cards.map(function (c, i) { return theme.card(c, CTX, i); }).join('');
    for (var i = cards.length; i < SHOWCASE_MAX; i++) cells += '<div class="cl-slot"><div class="cl-slot-q">&#9733;</div><div class="cl-slot-nm">Empty slot</div></div>';
    grid.innerHTML =
      '<div class="cb-sub" style="margin:8px 2px 12px">Your vitrine — up to ' + SHOWCASE_MAX + ' cards. Open any card and tap &#9733; Showcase to feature it here.</div>' +
      '<div class="cl-sec-grid" style="grid-template-columns:repeat(auto-fill,' + tierCols(theme, 'legendary') + ')">' + cells + '</div>' +
      (cards.length ? '<button class="cl-share-btn" id="clShowShare" style="max-width:340px;display:block;margin:16px auto 0">&#8599; Share my showcase</button>' : '');
    try { if (theme.mount) theme.mount(grid); } catch (_) { /* noop */ }
    var els = grid.querySelectorAll('.auth,.ctc,.clc-card');
    Array.prototype.forEach.call(els, function (el, idx) {
      el.style.cursor = 'pointer';
      el.addEventListener('click', function () { openDetail(cards[idx], el, { list: cards, i: idx }); });
    });
    localizeCards(cards, els, _uiLang);
    normalizePosters(cards, els);
    mobileScrollHolo(grid);
    var sb = document.getElementById('clShowShare');
    if (sb) sb.addEventListener('click', function () { shareShowcase(cards, sb); });
  }
  // Share the vitrine: the rarest card's OG unfurl carries the visual, the text
  // carries the full line-up.
  function shareShowcase(cards, btn) {
    try {
      var names = cards.map(function (c) { return locName(c); }).join(' · ');
      // rarest first so the fan leads with your best pulls
      var byRank = cards.slice().sort(function (a, b) { return ORDER[a.rarity] - ORDER[b.rarity]; });
      var qs = 'g=show&n=' + cards.length +
        '&ims=' + encodeURIComponent(byRank.map(function (c) { return c.img || ''; }).join(',')) +
        '&rs=' + encodeURIComponent(byRank.map(function (c) { return c.rarity || 'common'; }).join(',')) + '&to=/';
      var url = location.origin + '/s?' + qs;
      var text = 'My CineLinks showcase: ' + names;
      try { if (window.Track) window.Track('showcase_shared', { n: cards.length }); } catch (_) { /* noop */ }
      if (navigator.share) { navigator.share({ title: 'CineLinks', text: text, url: url }).catch(function () { /* cancelled */ }); return; }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text + ' ' + url).then(function () { flashShare(btn, 'Copied ✓'); }).catch(function () { window.prompt('Copy this', text + ' ' + url); });
      } else { window.prompt('Copy this', text + ' ' + url); }
    } catch (_) { /* noop */ }
  }

  // ── Set-complete reward: an XP coin arcs from the celebration card into the
  //    vault's level bar, which then fills; a level-up pops the ring. Purely
  //    visual — the XP was already credited by claimSets(). Reduced-motion safe.
  var _setWinQ = [];
  function playSetReward(sets, xpBefore, xpAfter, lvlBefore, lvlAfter) {
    if (!sets || !sets.length) return;
    var gain = xpAfter - xpBefore;
    var reduce = false; try { reduce = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) {}
    // Build the celebration card (queue if several sets complete at once).
    var ov = document.getElementById('clSetWin');
    if (!ov) { ov = document.createElement('div'); ov.id = 'clSetWin'; document.body.appendChild(ov); }
    var trophy = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4h10v3.5a5 5 0 0 1-10 0z"/><path d="M7 5.5H4V7a3 3 0 0 0 3 3M17 5.5h3V7a3 3 0 0 1-3 3"/><path d="M12 12.5V16M9 20h6M9.6 20l.5-4M14.4 20l-.5-4"/></svg>';
    var nm = sets.length > 1 ? (sets.length + ' sets complete') : esc(sets[0].name);
    ov.innerHTML = '<div class="clsw-card">' +
      '<div class="clsw-badge">' + trophy + '</div>' +
      '<div class="clsw-kicker">Set complete</div>' +
      '<div class="clsw-name">' + nm + '</div>' +
      '<div class="clsw-xp">+' + gain + ' XP</div>' +
      '<button class="clsw-cta" id="clswGo">Collect</button>' +
      '</div>';
    ov.classList.add('on');
    try { if (window.Sfx) window.Sfx.haptic([10, 40, 12]); } catch (_) {}
    var done = function () {
      ov.classList.remove('on');
      flyCoinToBar(gain, xpBefore, xpAfter, lvlBefore, lvlAfter, reduce);
    };
    var go = document.getElementById('clswGo'); if (go) go.onclick = done;
    ov.onclick = function (e) { if (e.target === ov) done(); };
    if (reduce) { setTimeout(done, 900); }
  }
  function flyCoinToBar(gain, xpBefore, xpAfter, lvlBefore, lvlAfter, reduce) {
    var fill = document.getElementById('clCollXpFill');
    var ring = document.querySelector('.cl-lvl-ring');
    var bar = fill && fill.parentNode;
    var applyBar = function () {
      // recompute the bar for the post-claim state and animate the width
      var lv = lvlAfter, into = xpAfter - xpForLevel(lv), span = xpForLevel(lv + 1) - xpForLevel(lv);
      if (fill) { fill.classList.add('gain'); fill.style.width = Math.max(3, Math.min(100, span ? (into / span) * 100 : 0)) + '%'; }
      if (bar) { bar.classList.remove('flash'); void bar.offsetWidth; bar.classList.add('flash'); }
      var lvlEl = document.getElementById('clCollXpName'); if (lvlEl) lvlEl.textContent = 'Level ' + lv;
      var lvlNum = document.getElementById('clCollLvl'); if (lvlNum) lvlNum.textContent = lv;
      var xpNum = document.getElementById('clCollXpNum');
      if (xpNum) xpNum.innerHTML = into + ' / ' + span + ' XP<span class="cl-xp-extra"> to level ' + (lv + 1) + '</span>';
      if (lvlAfter > lvlBefore && ring) { ring.classList.remove('levelup'); void ring.offsetWidth; ring.classList.add('levelup'); try { if (window.Sfx) window.Sfx.haptic([12, 50, 12, 50, 20]); } catch (_) {} }
    };
    if (reduce || !fill) { applyBar(); return; }
    // coin flies from centre to the bar
    var br = fill.getBoundingClientRect();
    var coin = document.createElement('div'); coin.className = 'cl-xp-coin'; coin.textContent = 'XP';
    var sx = window.innerWidth / 2, sy = window.innerHeight / 2;
    coin.style.left = (sx - 15) + 'px'; coin.style.top = (sy - 15) + 'px';
    document.body.appendChild(coin);
    requestAnimationFrame(function () { requestAnimationFrame(function () {
      var tx = (br.left + br.width * 0.12) - sx, ty = (br.top + br.height / 2) - sy;
      coin.style.transform = 'translate(' + tx.toFixed(0) + 'px,' + ty.toFixed(0) + 'px) scale(.5)';
      coin.style.opacity = '.2';
    }); });
    setTimeout(function () { coin.remove(); applyBar(); }, 640);
  }

  function renderSets() {
    var grid = document.getElementById('clCollGrid');
    var _sw = load() || blank(); var _xpB = _sw.xp || 0; var _lvB = levelFromXp(_xpB);
    var _newSets = []; try { _newSets = claimSets() || []; } catch (_) { /* claim passively-completed (milestone) sets */ }
    if (_newSets.length) { var _sa = load() || blank(); var _xpA = _sa.xp || 0; requestAnimationFrame(function () { playSetReward(_newSets, _xpB, _xpA, _lvB, levelFromXp(_xpA)); }); }
    var states = setsState();
    if (_setOpen) {
      var set = null; states.forEach(function (s) { if (s.id === _setOpen) set = s; });
      if (!set || set.kind !== 'curated' || !set.discovered) { _setOpen = null; renderSets(); return; }
      var theme = activeTheme(); injectThemeCss(theme);
      grid.style.display = 'grid';
      // Sets are short lists: capped flexible tracks + centered block (vs the full-bleed cards tab)
      grid.style.gridTemplateColumns = 'repeat(auto-fill,minmax(min(150px,40vw),176px))';
      grid.style.justifyContent = 'center';
      grid.style.gap = '14px';
      var owned = [], dustNow = dustBalance();
      grid.innerHTML = '<div class="cl-set-head"><button class="cl-back-btn" id="clSetBack">&#8249; Sets</button><span class="cl-set-htitle">' + esc(set.name) + ' &middot; ' + set.owned + '/' + set.total + (set.complete ? ' &#10003;' : '') + '</span></div>' +
        set.members.map(function (m, i) {
          if (m.owned) { owned.push(m.card); return theme.card(locCard(m.card), CTX, i); }
          var fc = forgeCost(m);
          return '<div class="cl-slot"><div class="cl-slot-q">?</div><div class="cl-slot-nm">' + esc(m.name) + '</div>' +
            '<button class="cl-slot-forge' + (dustNow >= fc ? '' : ' off') + '" data-fi="' + i + '" title="Forge this card with dust">&#9874; ' + fc + '</button></div>';
        }).join('');
      document.getElementById('clSetBack').addEventListener('click', function () { _setOpen = null; render(); });
      // Forge a missing member: spend dust → the card is added and revealed like a win.
      Array.prototype.forEach.call(grid.querySelectorAll('.cl-slot-forge'), function (b) {
        b.addEventListener('click', function (e) {
          e.stopPropagation();
          var m = set.members[+b.getAttribute('data-fi')]; if (!m || m.owned) return;
          b.disabled = true;
          forgeCard(m).then(function (r) {
            if (r.ok) {
              try { if (window.Sfx) { window.Sfx.haptic([12, 30]); } } catch (_) { /* noop */ }
              try { if (window.Track) window.Track('card_forged', { rarity: r.cards && r.cards[0] && r.cards[0].rarity, set: set.id }); } catch (_) { /* noop */ }
              render();                                             // refresh slots + dust chip
              if (r.cards && r.cards.length) setTimeout(function () { reveal(r.cards); }, 250);
            } else {
              b.disabled = false;
              try { if (window.Sfx) window.Sfx.tap(); } catch (_) { /* noop */ }
              if (r.reason === 'dust') { b.classList.add('shake'); setTimeout(function () { b.classList.remove('shake'); }, 420); }
            }
          });
        });
      });
      try { if (theme.mount) theme.mount(grid); } catch (_) { /* noop */ }
      var oi = 0, ownedEls = [];
      Array.prototype.forEach.call(grid.querySelectorAll('.auth,.ctc,.clc-card'), function (el) {
        var card = owned[oi], idx = oi; oi++; if (!card) return;
        ownedEls.push(el);
        el.style.cursor = 'pointer'; el.addEventListener('click', function () { openDetail(card, el, { list: owned, i: idx }); });
      });
      localizeCards(owned, ownedEls, _uiLang);
      normalizePosters(owned, ownedEls);
      return;
    }
    grid.style.display = 'block';
    grid.style.gridTemplateColumns = ''; grid.style.justifyContent = ''; grid.style.gap = '';
    var curated = states.filter(function (s) { return s.kind === 'curated'; });
    var found = curated.filter(function (s) { return s.discovered; });
    var locked = curated.filter(function (s) { return !s.discovered; });
    var miles = states.filter(function (s) { return s.kind === 'milestone'; });
    // sort discovered: completed first, then by progress — the closest-to-done bubbles up
    found.sort(function (a, b) { return (b.complete - a.complete) || (b.pct - a.pct); });
    var doneN = curated.filter(function (s) { return s.complete; }).length;

    // a fanned hand of member posters — owned = real poster, missing = silhouette slot
    function fan(s, mystery) {
      var m = (s.members || []).slice(0, 5);
      var mid = (m.length - 1) / 2;
      return '<div class="cl-sx-fan">' + m.map(function (mem, i) {
        var rot = (i - mid) * 7, dy = Math.abs(i - mid) * 6;
        var st = 'transform:rotate(' + rot.toFixed(1) + 'deg) translateY(' + dy.toFixed(0) + 'px);z-index:' + (10 - Math.abs(i - mid));
        if (mystery) return '<span class="cl-sx-p myst" style="' + st + '">?</span>';
        if (mem.owned && mem.card && mem.card.img) return '<span class="cl-sx-p own" style="' + st + ';background-image:url(' + posterUrl(mem.card.img) + ')"></span>';
        return '<span class="cl-sx-p" style="' + st + '"></span>';
      }).join('') + '</div>';
    }
    function premiumCard(s) {
      var pctW = Math.round(s.pct * 100);
      var badge = s.complete
        ? '<span class="cl-sx-crown" title="Set complete">&#9733;</span>'
        : '<span class="cl-sx-rw" title="XP awarded when you complete this set">+' + s.bonus + ' XP</span>';
      return '<button class="cl-sx' + (s.complete ? ' done' : '') + '" data-set="' + s.id + '">' +
        fan(s, false) +
        '<div class="cl-sx-info"><div class="cl-sx-nm">' + esc(s.name) + '</div>' +
        '<div class="cl-set-bar"><i style="width:' + pctW + '%"></i></div>' +
        '<div class="cl-sx-foot"><span class="cl-sx-ct">' + s.owned + ' / ' + s.total + '</span>' + badge + '</div></div></button>';
    }
    function lockedCard(s) {
      return '<div class="cl-sx locked" title="Collect any card from this set to unlock it">' +
        fan(s, true) +
        '<div class="cl-sx-info"><div class="cl-sx-nm">&#128274; ' + (s.cat === 'people' ? 'Cast set' : 'Film set') + '</div>' +
        '<div class="cl-sx-hint">Undiscovered &middot; ' + s.total + ' cards</div></div></div>';
    }
    function milestoneCard(s) {
      var pctW = Math.round(s.pct * 100);
      return '<div class="cl-sx mile' + (s.complete ? ' done' : '') + '">' +
        '<div class="cl-sx-ring" style="--p:' + pctW + '"><span>' + s.owned + '<i>/' + s.total + '</i></span></div>' +
        '<div class="cl-sx-info"><div class="cl-sx-nm">' + esc(s.name) + (s.complete ? ' <span class="cl-sx-crown sm">&#9733;</span>' : '') + '</div>' +
        '<div class="cl-set-bar"><i style="width:' + pctW + '%"></i></div>' +
        '<div class="cl-sx-hint">' + (s.complete ? 'Complete' : 'Milestone reward: +' + s.bonus + ' XP') + '</div></div></div>';
    }
    function sec(title, note) { return '<div class="cl-sx-sec"><span>' + title + '</span>' + (note ? '<em>' + note + '</em>' : '') + '</div>'; }

    var html = '<div class="cl-sx-hero"><div class="cl-sx-hero-n">' + doneN + '<i>/' + curated.length + '</i></div>' +
      '<div class="cl-sx-hero-t"><b>Collections</b><span>Complete a set to bank a big XP bonus. Sets reveal once you collect one of their cards.</span></div></div>';
    var _di = drawInfo();
    html += '<div class="cl-draw' + (_di.dust >= _di.cost ? '' : ' off') + '"' + (_di.left ? '' : ' data-complete="1"') + '>' +
      '<div class="cl-draw-ic">&#127183;</div>' +
      '<div class="cl-draw-b"><div class="cl-draw-t">' + (_di.left ? 'Draw a random card' : 'You own every set card') + '</div>' +
      '<div class="cl-draw-s">' + (_di.left ? ('Pull one of ' + _di.left + ' cards you don\'t own yet — favours sets you\'ve started') : 'Nothing left to draw here') + '</div></div>' +
      (_di.left ? '<button class="cl-draw-go" id="clDrawGo">&#10024; ' + _di.cost + '</button>' : '') + '</div>';
    if (found.length) html += sec('Your sets', found.length + (found.length === 1 ? ' unlocked' : ' unlocked')) + '<div class="cl-sx-grid">' + found.map(premiumCard).join('') + '</div>';
    if (miles.length) html += sec('Milestones') + '<div class="cl-sx-grid">' + miles.map(milestoneCard).join('') + '</div>';
    if (locked.length) html += sec('Undiscovered', locked.length + ' to find') + '<div class="cl-sx-grid">' + locked.map(lockedCard).join('') + '</div>';
    grid.innerHTML = html;

    Array.prototype.forEach.call(grid.querySelectorAll('.cl-sx[data-set]'), function (el) {
      el.addEventListener('click', function () {
        var sid = el.getAttribute('data-set'), s = null; states.forEach(function (x) { if (x.id === sid) s = x; });
        if (s && s.kind === 'curated' && s.discovered) { try { if (window.Sfx) window.Sfx.tap(); } catch (_) { /* noop */ } _setOpen = sid; render(); }
      });
    });
    // Draw: spend dust for a random unowned card, revealed like a win.
    var drawGo = grid.querySelector('#clDrawGo');
    if (drawGo) drawGo.addEventListener('click', function () {
      drawGo.disabled = true;
      drawPack().then(function (r) {
        if (r.ok) {
          try { if (window.Sfx) window.Sfx.haptic([12, 30]); } catch (_) { /* noop */ }
          try { if (window.Track) window.Track('card_drawn', { rarity: r.cards && r.cards[0] && r.cards[0].rarity }); } catch (_) { /* noop */ }
          render();                                              // refresh hero counts + dust chip
          if (r.cards && r.cards.length) setTimeout(function () { reveal(r.cards); }, 250);
        } else {
          drawGo.disabled = false;
          try { if (window.Sfx) window.Sfx.tap(); } catch (_) { /* noop */ }
          if (r.reason === 'dust') { drawGo.classList.add('shake'); setTimeout(function () { drawGo.classList.remove('shake'); }, 420); }
        }
      });
    });
  }

  function openGallery(tab) {
    injectShell(); buildModal(); injectThemeCss(activeTheme());
    _tab = (typeof tab === 'string' && tab) ? tab : 'cards';
    _filter = 'all'; _query = ''; _setOpen = null;
    render();
    document.getElementById('clCollModal').classList.add('open'); lockScroll(true);
    try { if (window.Track) window.Track('collection_open', stats()); } catch (_) { /* noop */ }
    // one-shot orientation tip on the first real visit
    try {
      if (!localStorage.getItem('clVaultTip') && stats().count > 0) {
        localStorage.setItem('clVaultTip', '1');
        var tip = document.createElement('div');
        tip.style.cssText = 'position:absolute;left:50%;bottom:calc(84px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:9;max-width:min(92vw,420px);background:#2f3540;border:1px solid rgba(232,160,0,.5);border-radius:12px;padding:11px 14px;font-size:.78rem;line-height:1.5;color:#e8dcc0;box-shadow:0 14px 40px rgba(0,0,0,.5)';
        tip.innerHTML = '<b style="color:#f5c542">Welcome to your collection.</b> Tap any card for the 3D view. Duplicates become &#10024;dust — spend it to Shine a card or Forge missing set cards. Win two games in a day for the &#9889;Daily&nbsp;Double.';
        document.getElementById('clCollModal').appendChild(tip);
        var killTip = function () { try { tip.remove(); } catch (_) { /* noop */ } };
        tip.addEventListener('click', killTip); setTimeout(killTip, 9000);
      }
    } catch (_) { /* noop */ }
  }
  // "New" badges live for the whole visit (Hearthstone-style) and clear on close,
  // not 600ms after opening — so the pinned "Just collected" section stays put.
  function close() { stopHolo(); markSeen(); var m = document.getElementById('clCollModal'); if (m && m.classList.contains('open')) { m.classList.remove('open'); lockScroll(false); } }

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
      '<span class="cl-det-count" id="clDetCount" style="display:none"></span>' +
      '<button class="cl-det-nav prev" id="clDetPrev" aria-label="Previous card" style="display:none">&#8249;</button>' +
      '<button class="cl-det-nav next" id="clDetNext" aria-label="Next card" style="display:none">&#8250;</button>' +
      '<div class="cl-detail-box"><div class="cl-detail-stage"><div class="cl-detail-card" id="clDetailCard"></div></div>' +
      '<div class="cl-di" id="clDetailInfo"></div></div>';
    document.body.appendChild(d);
    d.querySelector('.cl-detail-x').addEventListener('click', closeDetail);
    d.querySelector('#clDetPrev').addEventListener('click', function (e) { e.stopPropagation(); navDetail(-1); });
    d.querySelector('#clDetNext').addEventListener('click', function (e) { e.stopPropagation(); navDetail(1); });
    d.addEventListener('click', function (e) { if (e.target === d) closeDetail(); });
    return d;
  }
  // Browse the current filtered list from inside the detail view (wraps around).
  var _detCtx = null, _detKeysOn = false;
  function navDetail(dir) {
    if (!_detCtx || !_detCtx.list || _detCtx.list.length < 2) return;
    _detCtx.i = (_detCtx.i + dir + _detCtx.list.length) % _detCtx.list.length;
    try { if (window.Sfx) window.Sfx.tap(); } catch (_) { /* noop */ }
    var box = document.querySelector('#clCollDetail .cl-detail-box');
    if (box) { box.classList.remove('swap'); void box.offsetWidth; box.classList.add('swap'); }
    openDetail(_detCtx.list[_detCtx.i], null, _detCtx);
  }
  function _detKeys(e) {
    if (e.key === 'Escape') closeDetail();
    else if (e.key === 'ArrowRight') navDetail(1);
    else if (e.key === 'ArrowLeft') navDetail(-1);
  }
  function detailInfo(c) {
    var rar = RARITY[c.rarity] || RARITY.common;
    var dt = null; try { dt = c.first ? new Date(c.first + 'T00:00:00') : null; } catch (_) { dt = null; }
    var dateStr = (dt && !isNaN(dt.getTime())) ? dt.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
    var n = c.n || 1;
    var mstRow = n >= 10 ? [CT('Mastery'), 'Gold ★', '#f5c542'] : n >= 5 ? [CT('Mastery'), 'Silver ★', '#dfe6f2'] : n >= 3 ? [CT('Mastery'), 'Bronze ★', '#cd8f52'] : [CT('Mastery'), (3 - n) + ' more cop' + (3 - n === 1 ? 'y' : 'ies') + ' to ★', ''];
    var rows = [
      [CT('Rarity'), rar.label, rar.ring],
      [CT('Type'), typeLabel(c), ''],
      [CT('Number'), '#' + ('00' + (c.no || 0)).slice(-3), ''],
      [CT('Collected'), dateStr, ''],
      [CT('Copies'), '×' + n, ''],
      mstRow
    ];
    var rec0 = cardRecord(c) || c;
    var shined = isShined(c), cost = shineCost(c), bal = dustBalance(), afford = bal >= cost;
    var disc = shineDiscount(rec0), base = SHINE_COST[rec0.rarity] || 80;
    var discTag = (!shined && disc > 0) ? ' <span class="cl-shine-was">' + base + '</span> <span class="cl-shine-off">-' + Math.round(disc * 100) + '%</span>' : '';
    var shineBlock = shined
      ? '<div class="cl-shine-done">&#10024; Shined</div>'
      : '<button class="cl-shine-btn' + (afford ? '' : ' off') + '" id="clShineBtn">&#10024; Shine &middot; ' + cost + ' dust' + discTag + '</button>' +
        '<div class="cl-shine-hint">You have ' + bal + ' dust' + (afford ? '' : ' &middot; need ' + (cost - bal) + ' more') + (disc > 0 ? ' &middot; ' + Math.max(0, (rec0.n || 1) - 1) + ' spare' + ((rec0.n || 1) - 1 === 1 ? '' : 's') + ' cut the cost' : '') + '</div>';
    var asc = ascendInfo(rec0);
    var ascBlock = asc
      ? '<button class="cl-ascend-btn' + (asc.ok ? '' : ' off') + '" id="clAscendBtn">&#9650; Ascend to ' + esc(asc.nextLabel) + ' &middot; ' + asc.need + ' spare ' + (RARITY[rec0.rarity] || {}).label + ' copies</button>' +
        '<div class="cl-shine-hint">' + (asc.ok ? 'Elevates this card a tier' : 'You have ' + asc.have + ' &middot; need ' + (asc.need - asc.have) + ' more') + '</div>'
      : '';
    return '<div class="cl-di-name">' + esc(locName(c)) + '</div><div class="cl-di-rows">' +
      rows.map(function (r) { return '<div class="cl-di-row"><span>' + r[0] + '</span><b' + (r[2] ? ' style="color:' + r[2] + '"' : '') + '>' + esc(r[1]) + '</b></div>'; }).join('') +
      '</div><div class="cl-shine-wrap">' + shineBlock + '</div>' + (ascBlock ? '<div class="cl-shine-wrap" style="margin-top:8px">' + ascBlock + '</div>' : '') +
      '<button class="cl-share-btn" id="clShareBtn">&#8599; Share card</button>' +
      '<button class="cl-share-btn" id="clShowTog" style="margin-top:7px">' + (inShowcase(c) ? '&#9733; In your showcase — remove' : '&#9734; Add to showcase') + '</button>';
  }
  var _cineStop = null;
  function closeCine() {
    var ov = document.getElementById('clCine');
    if (_cineStop) { try { _cineStop(); } catch (_) { /* noop */ } _cineStop = null; }
    if (ov) ov.remove();
  }
  function openCine(c) {
    try {
      closeCine();
      var theme = activeTheme(); injectThemeCss(theme);
      var ov = document.createElement('div');
      ov.id = 'clCine';
      ov.style.cssText = 'position:fixed;inset:0;z-index:260;display:flex;align-items:center;justify-content:center;background:radial-gradient(120% 90% at 50% 40%,#1a2029,#0a0e13 75%);animation:clVaultIn .35s ease both;cursor:pointer';
      ov.innerHTML = '<div id="clCineCard" style="width:min(80vw,58vh)">' + theme.card(locCard(c), CTX, 0) + '</div>' +
        '<div style="position:fixed;bottom:calc(20px + env(safe-area-inset-bottom));left:0;right:0;text-align:center;color:#7a7a7a;font-size:.72rem;font-weight:700">tap to exit</div>';
      document.body.appendChild(ov);
      var holder = document.getElementById('clCineCard');
      Array.prototype.forEach.call(holder.querySelectorAll('img'), function (im) { im.src = im.src.replace(/\/t\/p\/w\d+\//, '/t/p/w780/'); });
      mountPosterDepth(holder);
      // slow cinematic drift through the depth + holo (single rAF, one card)
      var inner = holder.querySelector('.auth-card,.ctc-inner,.clc-card');
      var raf = 0, tt = Math.random() * 9;
      if (inner && !reducedMotion()) {
        inner.classList.add('tilted');
        (function drift() {
          tt += 0.008;
          var px = 0.30 * Math.sin(tt), py = 0.22 * Math.cos(tt * 0.7);
          inner.style.transform = 'perspective(900px) rotateX(' + (-py * 14).toFixed(2) + 'deg) rotateY(' + (px * 16).toFixed(2) + 'deg)';
          inner.style.setProperty('--px', px.toFixed(3)); inner.style.setProperty('--py', py.toFixed(3));
          inner.style.setProperty('--gx', (50 + px * 90).toFixed(1) + '%'); inner.style.setProperty('--gy', (50 + py * 90).toFixed(1) + '%');
          inner.style.setProperty('--fx', (100 + px * 170).toFixed(1) + '%'); inner.style.setProperty('--fy', (100 + py * 170).toFixed(1) + '%');
          inner.style.setProperty('--pfc', Math.min(1, Math.hypot(px, py) * 2).toFixed(3));
          raf = requestAnimationFrame(drift);
        })();
      }
      _cineStop = function () { if (raf) cancelAnimationFrame(raf); };
      ov.addEventListener('click', closeCine);
      try { if (window.Sfx) { window.Sfx.reveal('legendary'); window.Sfx.haptic([10, 30, 10]); } } catch (_) { /* noop */ }
      try { if (window.Track) window.Track('cinema_mode', { rarity: c.rarity }); } catch (_) { /* noop */ }
    } catch (_) { closeCine(); }
  }
  // long-press (~550ms, no movement) on a legendary detail card opens cinema mode
  function cineLongPress(holder, c) {
    try {
      if (c.rarity !== 'legendary') return;
      var inner = holder.querySelector('.auth-card,.ctc-inner,.clc-card'); if (!inner) return;
      var timer = 0, sx = 0, sy = 0;
      var arm = function (x, y) { sx = x; sy = y; clearTimeout(timer); timer = setTimeout(function () { openCine(c); }, 550); };
      var cancel = function () { clearTimeout(timer); };
      inner.addEventListener('touchstart', function (e) { var p = e.touches && e.touches[0]; if (p) arm(p.clientX, p.clientY); }, { passive: true });
      inner.addEventListener('touchmove', function (e) { var p = e.touches && e.touches[0]; if (p && Math.hypot(p.clientX - sx, p.clientY - sy) > 12) cancel(); }, { passive: true });
      inner.addEventListener('touchend', cancel);
      inner.addEventListener('mousedown', function (e) { arm(e.clientX, e.clientY); });
      inner.addEventListener('mousemove', function (e) { if (timer && Math.hypot(e.clientX - sx, e.clientY - sy) > 12) cancel(); });
      inner.addEventListener('mouseup', cancel);
      inner.addEventListener('mouseleave', cancel);
    } catch (_) { /* noop */ }
  }

  var DETAIL_SEL = '#clDetailCard .auth-card,#clDetailCard .ctc-inner,#clDetailCard .clc-card';
  function openDetail(c, srcEl, ctx) {
    if (!c) return;
    if (ctx) _detCtx = ctx;
    function fill() {
      buildDetail();
      _uiLang = currentLang();
      var theme = activeTheme(); injectThemeCss(theme);
      var holder = document.getElementById('clDetailCard');
      holder.innerHTML = theme.card(locCard(c), CTX, 0);
      // the card renders at 2× here — pull a higher-res TMDB poster so it stays crisp
      Array.prototype.forEach.call(holder.querySelectorAll('img'), function (im) { im.src = im.src.replace(/\/t\/p\/w\d+\//, '/t/p/w780/'); });
      try { if (theme.mount) theme.mount(holder); } catch (_) { /* noop */ }
      document.getElementById('clDetailInfo').innerHTML = detailInfo(c);
      // localise this card's title if we don't have the current language yet
      if (c.type !== 'person' && !(c.i18n && c.i18n[_uiLang])) {
        var wantLang = _uiLang;
        tmdbTitle(c.type, c.id, wantLang).then(function (title) {
          if (!title) return;
          c.i18n = c.i18n || {}; c.i18n[wantLang] = title; _locQueue(c.type + ':' + c.id, wantLang, title);
          if (_uiLang !== wantLang) return;
          var h = document.getElementById('clDetailCard'); var nm = h && h.querySelector('.auth-name,.ctc-name,.clc-name'); if (nm) nm.textContent = title;
          var dn = document.getElementById('clDetailInfo'); var t = dn && dn.querySelector('.cl-di-name'); if (t) t.textContent = title;
        });
      }
      var sb = document.getElementById('clShineBtn');
      if (sb) sb.addEventListener('click', function () {
        var r = shineCard(c);
        if (r.ok) { c.shine = 1; try { if (window.Sfx) { window.Sfx.reveal('elite'); window.Sfx.haptic([12, 24]); } } catch (_) { /* noop */ } openDetail(c); }
        else { try { if (window.Sfx) window.Sfx.tap(); } catch (_) { /* noop */ } if (r.reason === 'dust') { sb.classList.add('shake'); setTimeout(function () { sb.classList.remove('shake'); }, 420); } }
      });
      var ab = document.getElementById('clAscendBtn');
      if (ab) ab.addEventListener('click', function () {
        var r = ascendCard(c);
        if (r.ok) { c.rarity = r.next; try { if (window.Sfx) { window.Sfx.reveal(r.next); window.Sfx.haptic([16, 40, 16]); } } catch (_) { /* noop */ } try { if (window.Fx && window.Fx.confetti) window.Fx.confetti({ count: 70 }); } catch (_) { /* noop */ } openDetail(c); }
        else { try { if (window.Sfx) window.Sfx.tap(); } catch (_) { /* noop */ } if (r.reason === 'spares') { ab.classList.add('shake'); setTimeout(function () { ab.classList.remove('shake'); }, 420); } }
      });
      var shb = document.getElementById('clShareBtn');
      if (shb) shb.addEventListener('click', function () { shareCard(c, shb); });
      var stg = document.getElementById('clShowTog');
      if (stg) stg.addEventListener('click', function () {
        var r = toggleShowcase(c);
        if (r.ok) {
          try { if (window.Sfx) window.Sfx.tap(); } catch (_) { /* noop */ }
          stg.innerHTML = r.on ? '&#9733; In your showcase — remove' : '&#9734; Add to showcase';
          refreshOpen();
        } else if (r.full) {
          try { if (window.Sfx) window.Sfx.tap(); } catch (_) { /* noop */ }
          stg.classList.add('shake'); setTimeout(function () { stg.classList.remove('shake'); }, 420);
          flashShare(stg, 'Showcase is full (6)');
        }
      });
      document.getElementById('clCollDetail').classList.add('open');
      // prev/next browsing within the list this card was opened from
      var hasNav = !!(_detCtx && _detCtx.list && _detCtx.list.length > 1);
      ['clDetPrev', 'clDetNext'].forEach(function (id) { var b = document.getElementById(id); if (b) b.style.display = hasNav ? '' : 'none'; });
      var cnt = document.getElementById('clDetCount');
      if (cnt) { cnt.style.display = hasNav ? '' : 'none'; if (hasNav) cnt.textContent = (_detCtx.i + 1) + ' / ' + _detCtx.list.length; }
      if (!_detKeysOn) { document.addEventListener('keydown', _detKeys); _detKeysOn = true; }
      stopGyro();
      _gyroOff = gyroMount(holder);      // tilt the phone and the card leans + holo shifts
      dragTiltMount(holder);             // touch: drag a finger on the card to tilt it
      mountPosterDepth(holder);          // WebGL depth-parallax poster (fails soft to the img)
      cineLongPress(holder, c);          // legendaries: hold the card → cinema mode
      var cnt2 = document.getElementById('clDetCount');
      if (c.rarity === 'legendary' && cnt2 && cnt2.style.display !== 'none') cnt2.textContent += ' · hold card for cinema';
      else if (c.rarity === 'legendary' && cnt2) { cnt2.style.display = ''; cnt2.textContent = 'hold card for cinema'; }
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
  function closeDetail() {
    stopGyro();
    if (_detKeysOn) { document.removeEventListener('keydown', _detKeys); _detKeysOn = false; }
    _detCtx = null;
    closeCine();
    var d = document.getElementById('clCollDetail'); if (d) d.classList.remove('open');
  }

  // Share a single card: opens a /s link that unfurls to a dynamic OG image of the
  // card (poster + rarity + number). Uses the native share sheet on mobile, and
  // falls back to copying the link on desktop.
  function shareCard(c, btn) {
    try {
      var no = ('00' + (c.no || 0)).slice(-3);
      var ty = c.type === 'person' ? CT('Actor') : (c.type === 'tv' ? CT('Series') : CT('Film'));
      var rlabel = (RARITY[c.rarity] || RARITY.common).label;
      var nm = locName(c) || c.name || '';
      var qs = 'g=card&title=' + encodeURIComponent(nm) + '&r=' + encodeURIComponent(c.rarity || 'common') +
        '&n=' + encodeURIComponent(no) + '&sub=' + encodeURIComponent(ty) + '&im=' + encodeURIComponent(c.img || '') + '&to=/';
      var url = location.origin + '/s?' + qs;
      var text = 'I just collected the ' + rlabel + ' card of ' + nm + ' #' + no + ' on CineLinks!';
      try { if (window.Sfx) window.Sfx.tap(); } catch (_) { /* noop */ }
      try { if (window.Track) window.Track('card_shared', { rarity: c.rarity, type: c.type }); } catch (_) { /* noop */ }
      if (navigator.share) { navigator.share({ title: 'CineLinks', text: text, url: url }).catch(function () { /* cancelled */ }); return; }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(function () { flashShare(btn, 'Link copied ✓'); }).catch(function () { window.prompt('Copy this link', url); });
      } else { window.prompt('Copy this link', url); }
    } catch (_) { /* noop */ }
  }
  function flashShare(btn, msg) {
    if (!btn) return;
    var old = btn.innerHTML; btn.innerHTML = msg; btn.disabled = true;
    setTimeout(function () { try { btn.innerHTML = old; btn.disabled = false; } catch (_) { /* noop */ } }, 1600);
  }

  // ── Reveal sequence: the "earn" moment. reveal(newCards) plays a per-card
  // flip with rarity-scaled flair (sound + haptics + legendary flash), then a
  // summary with XP and any level-up. Auto-plays after a win; skippable. ──
  // Background scroll-lock for fullscreen overlays (reveal + vault). Pins the page
  // with position:fixed (iOS-safe) so tapping through cards can't scroll the game
  // behind it and the mobile toolbar can't show/hide and resize the fixed overlay.
  var _lockN = 0, _lockY = 0;
  function lockScroll(on) {
    var d = document.documentElement, b = document.body;
    if (on) { if (_lockN++ === 0) { _lockY = window.scrollY || window.pageYOffset || 0; b.style.top = (-_lockY) + 'px'; d.classList.add('cl-scroll-lock'); b.classList.add('cl-scroll-lock'); } }
    else { if (_lockN > 0 && --_lockN === 0) { d.classList.remove('cl-scroll-lock'); b.classList.remove('cl-scroll-lock'); b.style.top = ''; window.scrollTo(0, _lockY); } }
  }

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
  function closeReveal() { stopShader(); stopGyro(); var ov = document.getElementById('clCollReveal'); if (ov && ov.classList.contains('open')) { ov.classList.remove('open'); lockScroll(false); } }
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
          '<div class="clr-stage" style="--halo:' + rl.ring + '"><div class="clr-flip" id="clrFlip">' +
          '<div class="clr-back ' + activeCardbackClass() + '"><div class="clr-halo"></div>' + cbBackHtml() + '</div>' +
          '<div class="clr-face" id="clrFace"></div>' +
          '<div class="clr-edge e-l"></div><div class="clr-edge e-r"></div><div class="clr-edge e-t"></div><div class="clr-edge e-b"></div>' +
          '</div><div class="clr-shock" id="clrShock"></div></div>' +
          '<div class="clr-cap" id="clrCap"></div>' +
          '<div class="clr-hint">' + (idx < queue.length - 1 ? 'tap for next' : 'tap to finish') + (function () { try { if (!localStorage.getItem('clRevealTip')) { localStorage.setItem('clRevealTip', '1'); return '<div style="margin-top:6px;font-size:.68rem;color:#b9a97f">New cards land in <b>Your collection</b> on the home page</div>'; } } catch (_) { /* noop */ } return ''; })() + '</div>';
        document.getElementById('clrFace').innerHTML = theme.card(c, CTX, 0);
        setDots();
        var flip = document.getElementById('clrFlip');
        try { flip.style.setProperty('--cw', (flip.offsetWidth || 300) + 'px'); } catch (_) { /* noop */ }   // real edge faces need the pixel width for translateZ
        state = 'anim';
        if (reduced) { flip.classList.add('flipped'); showCap(c); state = 'ready'; return; }
        try { if (window.Sfx) { window.Sfx.cardFlip(); window.Sfx.haptic(tier === 'legendary' ? [10, 30] : 8); } } catch (_) { /* noop */ }
        later(360, function () { flip.classList.add('flip-go'); });            // keyframe flip (1.05s)
        later(900, function () {                                                // ~crossover: front swings into view
          try { if (window.Sfx) window.Sfx.reveal(tier); } catch (_) { /* noop */ }
          // elite+ punctuates the crossover with a rarity-coloured ring shockwave
          // (transform/opacity only — safe everywhere) and a short haptic hit
          if (tier === 'legendary' || tier === 'elite') {
            var sh = document.getElementById('clrShock');
            if (sh) { sh.classList.remove('go'); void sh.offsetWidth; sh.classList.add('go'); }
            if (tier === 'elite') { try { if (window.Sfx) window.Sfx.haptic([12, 28]); } catch (_) { /* noop */ } }
          }
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
        var setLines = newSets.map(function (st) { return '<div class="clr-sum-lvl"><svg viewBox="0 0 24 24" width="1em" height="1em" style="vertical-align:-.12em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l2.6 5.6 6 .8-4.4 4.2 1.1 6L12 17.8 6.7 19.6l1.1-6L3.4 9.4l6-.8z"/></svg> Set complete: ' + esc(st.name) + ' &middot; +' + st.bonus + ' XP</div>'; }).join('');
        var lvlLine = lvlNow > lvlBefore ? '<div class="clr-sum-lvl">Level up &mdash; level ' + lvlNow + '! 🎉</div>' : '';
        var newBacks = lvlNow > lvlBefore ? cardbacksUnlockedBetween(lvlBefore, lvlNow) : [];
        var backLine = newBacks.map(function (cb) { return '<div class="clr-sum-lvl"><svg viewBox="0 0 24 24" width="1em" height="1em" style="vertical-align:-.12em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2.4"/><circle cx="12" cy="12" r="3.2"/></svg> Card back unlocked: ' + esc(cb.name) + '</div>'; }).join('');
        var newAchv = []; try { newAchv = syncAchievements(); } catch (_) { /* noop */ }
        if (newAchv.length) { try { if (window.Sfx) window.Sfx.allDone(); } catch (_) { /* noop */ } }
        var achLine = newAchv.slice(0, 3).map(function (a) { return '<div class="clr-sum-lvl">' + a.icon + ' Achievement: ' + esc(a.name) + '</div>'; }).join('') +
          (newAchv.length > 3 ? '<div class="clr-sum-lvl"><svg viewBox="0 0 24 24" width="1em" height="1em" style="vertical-align:-.12em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="9" r="5.5"/><path d="M8.5 13.5 7 21l5-2.5L17 21l-1.5-7.5"/></svg> +' + (newAchv.length - 3) + ' more achievements</div>' : '');
        // achievement-gated card backs (e.g. Mastery) newly crossed this win
        if (newAchv.length) { var ac2 = achvCount(); backLine += cardbacksUnlockedByAchv(ac2 - newAchv.length, ac2).map(function (cb) { return '<div class="clr-sum-lvl"><svg viewBox="0 0 24 24" width="1em" height="1em" style="vertical-align:-.12em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2.4"/><circle cx="12" cy="12" r="3.2"/></svg> Card back unlocked: ' + esc(cb.name) + '</div>'; }).join(''); }
        // _pendingDust bundles every source this session (dupes, level-ups, the
        // Daily Double, trophies) — so label it generically, not "from duplicates".
        var dustLine = _pendingDust > 0 ? '<div class="clr-sum-lvl">&#10024; +' + _pendingDust + ' dust earned</div>' : '';
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
      ov.classList.add('open'); lockScroll(true);
      try { if (window.Sfx) window.Sfx.cardDeal(); } catch (_) { /* noop */ }
      try { if (window.Track) window.Track('card_revealed', { n: queue.length, top: queue[queue.length - 1].rarity }); } catch (_) { /* noop */ }
      card(queue[0]);
    } catch (_) { /* noop */ }
  }

  function renderQuests() {
    var el = document.getElementById('clQuests'); if (!el) return;
    var all; try { all = questsState(); } catch (_) { el.innerHTML = ''; return; }
    // Claimed quests drop out — only active ones take space. When all are claimed
    // the whole strip collapses (nothing to do until next week's reset).
    var qs = all.filter(function (q) { return !q.claimed; });
    if (!qs.length) { el.innerHTML = ''; return; }
    var claimable = qs.filter(function (q) { return q.done; }).length;
    el.innerHTML =
      '<div class="cl-q-head"><span>Weekly quests</span>' + (claimable ? '<b>' + claimable + ' to claim</b>' : '<i>resets weekly</i>') + '</div>' +
      '<div class="cl-q-row">' + qs.map(function (q) {
        var pct = Math.round(q.have / q.need * 100);
        var state = q.claimed ? 'claimed' : q.done ? 'ready' : '';
        var right = q.claimed ? '<span class="cl-q-ok">&#10003;</span>'
          : q.done ? '<button class="cl-q-claim" data-q="' + q.id + '">Claim &#10024;' + q.dust + '</button>'
          : '<span class="cl-q-prog">' + q.have + '/' + q.need + '</span>';
        return '<div class="cl-q ' + state + '"><div class="cl-q-ic">' + q.icon + '</div>' +
          '<div class="cl-q-body"><div class="cl-q-lbl">' + q.label + '</div>' +
          '<div class="cl-q-bar"><i style="width:' + pct + '%"></i></div></div>' + right + '</div>';
      }).join('') + '</div>';
    Array.prototype.forEach.call(el.querySelectorAll('.cl-q-claim'), function (b) {
      b.addEventListener('click', function () {
        var r = claimQuest(b.getAttribute('data-q'));
        if (r.ok) {
          try { if (window.Sfx) { window.Sfx.allDone(); window.Sfx.haptic([12, 30, 12]); } } catch (_) { /* noop */ }
          try { if (window.Fx && window.Fx.confetti) window.Fx.confetti({ count: 60 }); } catch (_) { /* noop */ }
          renderQuests();
          var du = document.getElementById('clCollDust'); if (du) du.innerHTML = '&#10024; ' + dustBalance();
        }
      });
    });
  }

  // ── Prime strip (the always-open dust sink; sits under the cards-tab header) ──
  function renderPrime() {
    var el = document.getElementById('clPrime'); if (!el) return;
    var st; try { st = primeState(); } catch (_) { el.innerHTML = ''; el.className = 'cl-prime'; return; }
    var d = st.dust || 0;
    if (st.tier) {
      var nm = st.tier.charAt(0).toUpperCase() + st.tier.slice(1);
      el.className = 'cl-prime armed';
      el.innerHTML = '<div class="cl-prime-box">' +
        '<div class="cl-prime-ic">&#9889;</div>' +
        '<div class="cl-prime-body"><div class="cl-prime-ttl">Next card guaranteed ' + nm + '</div>' +
        '<div class="cl-prime-sub">Applies to your next daily prize card</div></div>' +
        '<span class="cl-prime-armed">&#10003; Armed</span></div>';
      return;
    }
    el.className = 'cl-prime';
    var tiers = [['rare', 'Rare'], ['elite', 'Elite'], ['legendary', 'Legendary']];
    var btns = tiers.map(function (t) {
      var c = primeCost(t[0]);
      return '<button class="cl-prime-b ' + t[0] + '" data-tier="' + t[0] + '"' + (d < c ? ' disabled' : '') + '>' + t[1] + ' &#10024;' + c + '</button>';
    }).join('');
    el.innerHTML = '<div class="cl-prime-box">' +
      '<div class="cl-prime-ic">&#9889;</div>' +
      '<div class="cl-prime-body"><div class="cl-prime-ttl">Prime your next card</div>' +
      '<div class="cl-prime-sub">Spend dust to floor the rarity of your next prize</div></div>' +
      '<div class="cl-prime-btns">' + btns + '</div></div>';
    Array.prototype.forEach.call(el.querySelectorAll('.cl-prime-b'), function (b) {
      b.addEventListener('click', function () {
        if (b.disabled) return;
        var r = primeNext(b.getAttribute('data-tier'));
        if (r.ok) {
          try { if (window.Sfx) { window.Sfx.allDone && window.Sfx.allDone(); window.Sfx.haptic && window.Sfx.haptic([10, 22, 10]); } } catch (_) { /* noop */ }
          renderPrime();
          var du = document.getElementById('clCollDust'); if (du) du.innerHTML = '&#10024; ' + dustBalance();
        }
      });
    });
  }

  // ── Card-back picker (renders into the Vault's Backs tab) ──
  function renderCardbacks() {
    var grid = document.getElementById('cbGrid'); if (!grid) return;
    var dustNow = dustBalance();
    grid.innerHTML = cardbacksState().map(function (cb) {
      var lock = cb.req.type === 'achv' ? ('🔒 ' + cb.req.need + ' trophies') : ('🔒 Lvl ' + cb.req.need);
      var buy = (!cb.unlocked && cb.cost) ? '<button class="cb-buy' + (dustNow >= cb.cost ? '' : ' off') + '" data-buy="' + cb.id + '" title="Unlock this back with dust">&#10024; ' + cb.cost + '</button>' : '';
      return '<div class="cb-item' + (cb.active ? ' active' : '') + (cb.unlocked ? '' : ' locked') + '" data-id="' + cb.id + '">' +
        '<div class="cb-swatch ' + cb.css + '" data-req="' + lock + '">' + cbBackHtml() + buy + '</div>' +
        '<div class="cb-nm">' + esc(cb.name) + '</div></div>';
    }).join('');
    Array.prototype.forEach.call(grid.querySelectorAll('.cb-item'), function (el) {
      el.addEventListener('click', function () {
        if (el.classList.contains('locked')) return;
        if (useCardback(el.getAttribute('data-id'))) { renderCardbacks(); try { if (window.Sfx) window.Sfx.tap(); } catch (_) { /* noop */ } }
      });
    });
    // Buy a locked back with dust → auto-equip it.
    Array.prototype.forEach.call(grid.querySelectorAll('.cb-buy'), function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        var id = b.getAttribute('data-buy'), r = buyBack(id);
        if (r.ok) {
          useCardback(id);
          try { if (window.Sfx) { window.Sfx.reveal && window.Sfx.reveal('elite'); window.Sfx.haptic && window.Sfx.haptic([12, 30, 12]); } } catch (_) { /* noop */ }
          try { if (window.Fx && window.Fx.confetti) window.Fx.confetti({ count: 50 }); } catch (_) { /* noop */ }
          try { if (window.Track) window.Track('cardback_bought', { id: id }); } catch (_) { /* noop */ }
          renderCardbacks();
          var du = document.getElementById('clCollDust'); if (du) du.innerHTML = '&#10024; ' + dustBalance();
        } else {
          try { if (window.Sfx) window.Sfx.tap(); } catch (_) { /* noop */ }
          if (r.reason === 'dust') { b.classList.add('shake'); setTimeout(function () { b.classList.remove('shake'); }, 420); }
        }
      });
    });
  }
  function openCardbacks() { _tab = 'backs'; if (isOpen()) render(); else openGallery('backs'); }

  // ── Achievements trophy case (renders into the Vault's Trophies tab) ──
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
  function openAchievements() { syncAchievements(); _tab = 'trophies'; if (isOpen()) render(); else openGallery('trophies'); }

  // Do you already own a card of this entity? (used by CineLinks to mark
  // "new to collect" nodes during play.)
  function owns(type, id) { try { var s = load(); return !!(s && s.cards && s.cards[type + ':' + id]); } catch (_) { return false; } }

  // expose + init
  window.Collection = {
    add: add, stats: stats, all: allCards, owns: owns, openGallery: openGallery, markSeen: markSeen, reveal: reveal, sets: setsState,
    cardbacks: cardbacksState, useCardback: useCardback, openCardbacks: openCardbacks,
    achievements: achievementsState, openAchievements: openAchievements,
    dust: dustBalance, shine: shineCard, shineCost: shineCost, isShined: isShined,
    prime: primeNext, primeCost: primeCost, primeState: primeState,
    draw: drawPack, drawInfo: drawInfo, buyBack: buyBack, backCost: backCost,
    addDust: function (n) { var s = load() || blank(); s.dust = Math.max(0, (s.dust || 0) + (+n || 0)); save(s); refreshOpen(); return s.dust; },
    forge: forgeCard, forgeCost: forgeCost, toggleShowcase: toggleShowcase, showcase: showcaseCards,
    reset: reset, grant: grant, addXp: addXp, setLevel: setLevel, exportData: exportData, importData: importData, seed: function () { return grant(SEED.map(function (s) { return s; })); },
    // Card Studio: force an exported design onto the live cards
    applyTemplate: function (tpl) { try { var o = typeof tpl === 'string' ? JSON.parse(tpl) : tpl; if (!o || !Array.isArray(o.layers)) return false; localStorage.setItem('cl_card_template', JSON.stringify(o)); refreshOpen(); return true; } catch (_) { return false; } },
    clearTemplate: function () { try { localStorage.removeItem('cl_card_template'); } catch (_) {} refreshOpen(); },
    cardTemplate: activeCardTemplate,
    debug: debug,
    themes: { register: defineTheme, use: useTheme, list: function () { return Object.keys(THEMES).map(function (n) { return { name: n, label: THEMES[n].label || n }; }); }, current: activeThemeName }
  };
  // Record already-earned achievements once on load (silent — no reveal spam for an existing save).
  try { window.addEventListener('load', function () { try { syncAchievements(); } catch (_) { /* noop */ } }); } catch (_) { /* noop */ }
  // Pull the published site-wide card design (if any). Async: applies + re-renders
  // once loaded. A local override still wins. Empty / missing file = default cards.
  try {
    fetch('/card-template.json', { cache: 'default' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      if (j && Array.isArray(j.layers) && j.layers.length) { _globalTpl = j; try { refreshOpen(); } catch (_) { /* noop */ } }
    }).catch(function () { /* no published design — fine */ });
  } catch (_) { /* noop */ }
  if (debugEnabled()) { try { window.addEventListener('load', function () { try { debug(); } catch (_) { /* noop */ } }); } catch (_) { /* noop */ } }
  try { enableDebugGesture(); if (document.readyState === 'complete') depthDebugButton(); else window.addEventListener('load', depthDebugButton); } catch (_) { /* noop */ }
})();
