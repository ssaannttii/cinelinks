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
  window.Fx = { confetti: confetti, burstFrom: burstFrom, play: play, reduced: reduced, countUp: countUp, shake: shake, popText: popText, popFrom: popFrom };

  // Pause all CSS animations while the tab is backgrounded (fx.css does the work).
  try {
    document.addEventListener('visibilitychange', function () {
      document.documentElement.classList.toggle('cl-hidden', document.hidden);
    });
  } catch (_) { /* noop */ }
})();
