/* Shared confetti + motion helpers for the Cine* games. Exposes window.Fx. */
(function () {
  'use strict';
  var COLORS = ['#e8a000', '#7fd49a', '#f0d878', '#5bbd7a', '#ffffff', '#7aa6e8', '#b58ad6'];
  function reduced() { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) { return false; } }

  // Confetti burst. opts: {count, x, y, spread, power}
  function confetti(opts) {
    opts = opts || {};
    if (reduced()) return;
    var n = opts.count || 80;
    var ox = opts.x != null ? opts.x : window.innerWidth / 2;
    var oy = opts.y != null ? opts.y : window.innerHeight * 0.32;
    var power = opts.power || 1;
    for (var i = 0; i < n; i++) {
      var p = document.createElement('div');
      p.className = 'fx-confetti';
      p.style.background = COLORS[i % COLORS.length];
      if (i % 3 === 0) p.style.borderRadius = '50%';
      p.style.left = ox + 'px';
      p.style.top = oy + 'px';
      var ang = Math.random() * Math.PI * 2;
      var vel = (4 + Math.random() * 7) * power;
      spawn(p, Math.cos(ang) * vel, Math.sin(ang) * vel - 7 * power);
      document.body.appendChild(p);
    }
  }
  function spawn(p, vx, vy) {
    var x = 0, y = 0, rot = Math.random() * 360, t0 = performance.now();
    var dur = 950 + Math.random() * 800;
    function step(t) {
      var e = t - t0;
      if (e > dur) { p.remove(); return; }
      vy += 0.3; x += vx; y += vy; rot += 9;
      p.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) rotate(' + rot.toFixed(0) + 'deg)';
      p.style.opacity = String(Math.max(0, 1 - e / dur));
      requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  // Confetti centred on an element.
  function burstFrom(el, opts) {
    if (!el) { confetti(opts); return; }
    var r = el.getBoundingClientRect();
    confetti(Object.assign({ x: r.left + r.width / 2, y: r.top + r.height / 2 }, opts || {}));
  }
  // Add a class, force reflow so re-adding re-triggers, optionally auto-remove.
  function play(el, cls, ms) {
    if (!el) return;
    el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
    if (ms) setTimeout(function () { el.classList.remove(cls); }, ms);
  }
  // Count a number up to `to` (eases out). opts: {ms, prefix, suffix}
  function countUp(el, to, opts) {
    if (!el) return;
    to = +to || 0; opts = opts || {};
    var ms = opts.ms || 700, prefix = opts.prefix || '', suffix = opts.suffix || '';
    if (reduced() || to <= 0) { el.textContent = prefix + to + suffix; return; }
    var t0 = performance.now();
    (function step(t) {
      var p = Math.min(1, (t - t0) / ms), eased = 1 - Math.pow(1 - p, 3);
      el.textContent = prefix + Math.round(to * eased) + suffix;
      if (p < 1) requestAnimationFrame(step); else el.textContent = prefix + to + suffix;
    })(performance.now());
  }
  // Screen-shake / camera-punch — a decaying jitter on a target (default the
  // page body). Power scales amplitude + duration. The whole viewport kicks and
  // settles, Balatro-style. Transform-only, so it never triggers scrollbars.
  function shake(power, target) {
    if (reduced()) return;
    var el = target || document.body; if (!el) return;
    power = power || 1;
    var amp = 5 * power, dur = 300 + power * 90, t0 = performance.now();
    var base = el.style.transform || '';
    (function step(t) {
      var k = 1 - Math.min(1, (t - t0) / dur);
      if (k <= 0) { el.style.transform = base; return; }
      var a = amp * k * k;
      el.style.transform = (base ? base + ' ' : '') +
        'translate(' + ((Math.random() * 2 - 1) * a).toFixed(1) + 'px,' + ((Math.random() * 2 - 1) * a).toFixed(1) + 'px)';
      requestAnimationFrame(step);
    })(performance.now());
  }
  // Floating "+N" pop that rises and fades from a screen point — the score-juice
  // primitive: call it wherever points / streak / dust change.
  function popText(x, y, text, opts) {
    if (reduced()) return;
    opts = opts || {};
    var d = document.createElement('div');
    d.className = 'fx-pop-txt';
    d.textContent = text;
    if (opts.color) d.style.color = opts.color;
    if (opts.size) d.style.fontSize = opts.size;
    d.style.left = x + 'px'; d.style.top = y + 'px';
    document.body.appendChild(d);
    setTimeout(function () { try { d.remove(); } catch (_) {} }, 1050);
  }
  function popFrom(el, text, opts) {
    if (!el) return;
    var r = el.getBoundingClientRect();
    popText(r.left + r.width / 2, r.top + r.height * 0.3, text, opts);
  }
  // ── Shared end-of-game moments ──────────────────────────────────────────────
  // Every mode used to roll its own: confetti anywhere from 90 to 130+90 pieces,
  // shake from none to 1.6, and on a loss most modes did nothing at all. These two
  // are the calibrated versions. Visual + haptic only; each mode keeps its own Sfx
  // cue, so the sound stays specific to the game.
  //   win(tier, opts)  tier 1 = scraped through · 2 = solid · 3 = perfect
  //                    opts.el → burst from that element instead of screen centre
  //   lose(opts)       opts.el → the answer, which slams in as the reveal
  // Only after a real play in THIS visit: every mode re-renders its result screen when
  // you reopen a finished daily, and that must not re-fire confetti or the loss beat.
  var played = false;
  try {
    var mark = function () { played = true; };
    window.addEventListener('pointerdown', mark, { capture: true, once: true });
    window.addEventListener('keydown', mark, { capture: true, once: true });
  } catch (_) { /* noop */ }
  var WIN = { 1: { n: 60, p: 0.9, s: 0.7 }, 2: { n: 100, p: 1.05, s: 1.1 }, 3: { n: 150, p: 1.25, s: 1.5 } };
  var calmAt = 0;   // when the running celebration has settled (see after())
  function win(tier, opts) {
    opts = opts || {};
    if (!played && !opts.force) return;
    var w = WIN[tier] || WIN[2];
    calmAt = performance.now() + (tier >= 3 ? 1900 : 1400);
    shake(w.s);
    var burst = function (n, pw) { if (opts.el) burstFrom(opts.el, { count: n, power: pw }); else confetti({ count: n, power: pw }); };
    setTimeout(function () { burst(w.n, w.p); }, 120);
    if (tier >= 3) setTimeout(function () { confetti({ count: 70, power: 0.9 }); }, 520);   // a second wave only for a perfect run
    try { if (window.Sfx && Sfx.haptic) Sfx.haptic(tier >= 3 ? [30, 40, 30, 40, 60] : [30, 40, 60]); } catch (_) {}
  }
  function lose(opts) {
    opts = opts || {};
    if (!played && !opts.force) return;
    try { if (window.Sfx && Sfx.haptic) Sfx.haptic([60, 40, 90]); } catch (_) {}
    if (opts.el) play(opts.el, 'fx-slam', 900);
    if (reduced()) return;
    shake(0.55);
    // a brief drained, vignetted beat (the "it's over" frame); fixed overlay rather
    // than a filter on <body>, which would re-anchor every position:fixed child
    var v = document.createElement('div');
    v.className = 'fx-lose-vig';
    document.body.appendChild(v);
    setTimeout(function () { try { v.remove(); } catch (_) {} }, 1300);
  }
  // Run fn no sooner than ms from now AND not while a win celebration is still
  // playing — the card reveal used to open 0.5–0.9 s in and cut the confetti off.
  function after(fn, ms) {
    setTimeout(function () {
      var wait = calmAt - performance.now();
      if (wait > 0) setTimeout(fn, wait); else fn();
    }, ms || 0);
  }
  // ── The feedback vocabulary ─────────────────────────────────────────────────
  // One calibrated set for every game, so a right answer feels the same in
  // CineLine as in CineGrid: each call is the visual, the sound and the haptic.
  //   right(el, o)    a correct step. o.n = the run so far (the chime climbs from 2),
  //                   o.pop = text to float off el, o.shake = override (default .4)
  //   wrong(el, o)    a wrong step. o.hard = the costly one (last life, one away):
  //                   bigger shake, longer haptic. A red ring on el + a red beat.
  //   confirm(el)     a guess committed (Submit, Go, Finish): tick + short haptic
  //   pick()          a selection changed: a soft tap (the spring is the global :active)
  //   tension(el, on) last attempt or time running out: el pulses red while on; a
  //                   low two-note warning + haptic the moment it starts
  // el is optional everywhere: pass null when the game draws its own visual.
  function sfx(name, a) { try { if (window.Sfx && window.Sfx[name]) window.Sfx[name](a); } catch (_) {} }
  function hap(p) { try { if (window.Sfx && window.Sfx.haptic) window.Sfx.haptic(p); } catch (_) {} }
  function right(el, o) {
    o = o || {}; var n = o.n || 1;
    if (el) play(el, 'fx-right', 760);
    if (n >= 2) sfx('streak', n); else sfx('goalReach');
    hap(n >= 3 ? [10, 20, 10] : [10, 25]);
    shake(o.shake != null ? o.shake : 0.4);
    if (o.pop && el) popFrom(el, o.pop, { color: '#f6dd86', size: '1.15rem' });
  }
  function wrong(el, o) {
    o = o || {};
    if (el) play(el, 'fx-wrong', 520);
    sfx('deadEnd'); hap(o.hard ? [40, 30, 70] : [40, 30, 40]);
    shake(o.hard ? 0.85 : 0.6);
    if (reduced()) return;
    var v = document.createElement('div'); v.className = 'fx-wrong-vig' + (o.hard ? ' hard' : '');
    document.body.appendChild(v);
    setTimeout(function () { try { v.remove(); } catch (_) {} }, 460);
  }
  function confirm(el) { sfx('select'); hap(8); if (el) play(el, 'fx-confirm', 320); }
  function pick() { sfx('tap'); hap(4); }
  function tension(el, on) {
    if (!el) return;
    if (!on) { el.classList.remove('fx-tense'); return; }
    if (el.classList.contains('fx-tense')) return;
    el.classList.add('fx-tense'); sfx('tense'); hap([20, 40, 20]);
  }
  window.Fx = { after: after, confetti: confetti, burstFrom: burstFrom, play: play, reduced: reduced, countUp: countUp, shake: shake, popText: popText, popFrom: popFrom, win: win, lose: lose,
    right: right, wrong: wrong, confirm: confirm, pick: pick, tension: tension };

  // Pages that load fx.js without fx.css (the home page keeps its own chrome rules)
  // still need the styles of the elements this file CREATES — otherwise the "+N"
  // floater and confetti are bare, unpositioned divs.
  try {
    if (!document.querySelector('link[href*="fx.css"]') && !document.getElementById('fxCore')) {
      var st = document.createElement('style'); st.id = 'fxCore';
      st.textContent =
        '.fx-confetti{position:fixed;top:0;left:0;width:8px;height:8px;border-radius:2px;pointer-events:none;z-index:9999;will-change:transform,opacity}' +
        '@keyframes fxPopRise{0%{opacity:0;transform:translate(-50%,4px) scale(.7)}18%{opacity:1;transform:translate(-50%,-6px) scale(1.12)}40%{transform:translate(-50%,-14px) scale(1)}100%{opacity:0;transform:translate(-50%,-52px) scale(1)}}' +
        '.fx-pop-txt{position:fixed;transform:translate(-50%,0);z-index:10000;pointer-events:none;font-weight:900;font-size:1.5rem;color:#f5c542;text-shadow:0 2px 12px rgba(0,0,0,.6),0 0 18px rgba(232,160,0,.5);animation:fxPopRise 1.05s cubic-bezier(.2,.8,.2,1) forwards;font-family:ui-rounded,"Schibsted Grotesk",system-ui,sans-serif}' +
        'html.cl-hidden *,html.cl-hidden *::before,html.cl-hidden *::after{animation-play-state:paused!important}';
      (document.head || document.documentElement).appendChild(st);
    }
  } catch (_) { /* noop */ }

  // ── Accessible modal focus trap (a11y) ──────────────────────────────────────
  // fxTrapFocus(container) moves focus into the dialog, keeps Tab/Shift+Tab cycling
  // within it, and returns a release() that restores focus to whatever was focused
  // before it opened. Shared by every overlay so keyboard/AT users can't fall
  // behind the modal. Safe to call with a missing element.
  var FOCUSABLE = 'a[href],area[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
  window.fxTrapFocus = function (container) {
    if (!container) return function () {};
    var prev = document.activeElement;
    function items() {
      return Array.prototype.slice.call(container.querySelectorAll(FOCUSABLE))
        .filter(function (el) { return el.offsetWidth > 0 || el.offsetHeight > 0 || el === document.activeElement; });
    }
    function onKey(e) {
      if (e.key !== 'Tab') return;
      var f = items(); if (!f.length) { e.preventDefault(); try { container.focus(); } catch (_) {} return; }
      var first = f[0], last = f[f.length - 1], a = document.activeElement;
      if (e.shiftKey) { if (a === first || !container.contains(a)) { e.preventDefault(); last.focus(); } }
      else { if (a === last || !container.contains(a)) { e.preventDefault(); first.focus(); } }
    }
    if (container.getAttribute && container.getAttribute('tabindex') == null) container.setAttribute('tabindex', '-1');
    setTimeout(function () { try { var f = items(); (f[0] || container).focus(); } catch (_) {} }, 30);
    document.addEventListener('keydown', onKey, true);
    var released = false;
    return function release() {
      if (released) return; released = true;
      document.removeEventListener('keydown', onKey, true);
      try { if (prev && prev.focus) prev.focus(); } catch (_) {}
    };
  };

  // ── Images arrive with a fade, never a pop ──────────────────────────────────
  // Every <img> still loading when it enters the DOM gets .fx-img until it lands
  // (or fails). Images already decoded are left alone, so nothing blinks.
  function watchImg(img) {
    if (img.__fxw || img.complete) return; img.__fxw = 1;
    img.classList.add('fx-img');
    var on = function () { img.classList.add('on'); };
    img.addEventListener('load', on, { once: true }); img.addEventListener('error', on, { once: true });
    if (img.complete) on();
  }
  try {
    Array.prototype.forEach.call(document.images, watchImg);
    new MutationObserver(function (ms) {
      for (var i = 0; i < ms.length; i++) {
        var added = ms[i].addedNodes;
        for (var j = 0; j < added.length; j++) {
          var n = added[j]; if (n.nodeType !== 1) continue;
          if (n.tagName === 'IMG') watchImg(n);
          else if (n.getElementsByTagName) { var imgs = n.getElementsByTagName('img'); for (var k = 0; k < imgs.length; k++) watchImg(imgs[k]); }
        }
      }
    }).observe(document.documentElement, { childList: true, subtree: true });
  } catch (_) { /* noop */ }

  // Pause all CSS animations while the tab is backgrounded (fx.css does the work).
  try {
    document.addEventListener('visibilitychange', function () {
      document.documentElement.classList.toggle('cl-hidden', document.hidden);
    });
  } catch (_) { /* noop */ }
})();
