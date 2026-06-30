/* CineLinks suite sound engine — exposes window.Sfx.
 * Every sound is synthesized at runtime (WebAudio): no asset files, no network.
 * The AudioContext can only start after a user gesture, so the first tap unlocks
 * it; calls before that are silent no-ops. Mute persists in localStorage. Haptics
 * (navigator.vibrate) are exposed too. Reduced-motion does NOT mute audio — sound
 * is its own toggle — but every call is wrapped so it can never throw. */
(function () {
  'use strict';

  var KEY = 'cl_sound';
  var ctx = null, master = null, enabled = true, loaded = false;

  function load() {
    if (loaded) return;
    loaded = true;
    try { if (localStorage.getItem(KEY) === '0') enabled = false; } catch (_) {}
  }

  function ac() {
    try {
      if (!ctx) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = 0.5;
        master.connect(ctx.destination);
      }
      if (ctx.state === 'suspended') ctx.resume().catch(function () {});
      return ctx;
    } catch (_) { return null; }
  }

  // One enveloped oscillator voice. slideTo glides the pitch across the note.
  function note(freq, t0, dur, o) {
    o = o || {};
    var type = o.type || 'sine', gain = o.gain == null ? 0.3 : o.gain, attack = o.attack || 0.006;
    var osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (o.slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.slideTo), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(master);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  }

  // Short filtered-noise burst — whooshes and impact texture.
  function noise(t0, dur, o) {
    o = o || {};
    var gain = o.gain == null ? 0.18 : o.gain, freq = o.freq || 1400, q = o.q || 0.7;
    var n = Math.floor(ctx.sampleRate * dur);
    var buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    var src = ctx.createBufferSource(); src.buffer = buf;
    var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = q;
    if (o.sweepTo) bp.frequency.exponentialRampToValueAtTime(Math.max(80, o.sweepTo), t0 + dur);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(bp); bp.connect(g); g.connect(master);
    src.start(t0); src.stop(t0 + dur + 0.02);
  }

  function go(fn) {
    load();
    if (!enabled) return;
    var c = ac();
    if (!c) return;
    try { fn(c.currentTime); } catch (_) {}
  }

  function haptic(p) { try { if (navigator.vibrate) navigator.vibrate(p); } catch (_) {} }

  var Sfx = {
    get enabled() { load(); return enabled; },
    toggle: function () {
      load();
      enabled = !enabled;
      try { localStorage.setItem(KEY, enabled ? '1' : '0'); } catch (_) {}
      if (enabled) Sfx.tap();
      return enabled;
    },
    haptic: haptic,

    // soft UI tap (buttons)
    tap: function () { go(function (t) { note(420, t, 0.05, { type: 'triangle', gain: 0.1 }); }); },

    // a card is committed / you move to a new node — confident tick + airy whoosh
    select: function () {
      go(function (t) {
        note(540, t, 0.05, { type: 'triangle', gain: 0.13 });
        note(760, t + 0.04, 0.07, { type: 'triangle', gain: 0.12 });
        noise(t, 0.2, { gain: 0.08, freq: 1700, sweepTo: 520 });
      });
    },

    // the goal card appears in the grid — bright shimmer "spotted"
    goalSight: function () {
      go(function (t) {
        note(880, t, 0.16, { type: 'triangle', gain: 0.1 });
        note(1320, t + 0.08, 0.2, { type: 'sine', gain: 0.09 });
        noise(t, 0.14, { gain: 0.05, freq: 3200, sweepTo: 5000 });
      });
    },

    // you land ON the goal — rising triumphant run into the win
    goalReach: function () {
      go(function (t) {
        [659, 880, 1175].forEach(function (f, i) { note(f, t + i * 0.07, 0.22, { type: 'triangle', gain: 0.16 }); });
        noise(t, 0.18, { gain: 0.07, freq: 2600, sweepTo: 4600 });
      });
    },

    // dead end — low descending thud
    deadEnd: function () {
      go(function (t) {
        note(240, t, 0.26, { type: 'sawtooth', gain: 0.12, slideTo: 110 });
        noise(t, 0.18, { gain: 0.1, freq: 360, sweepTo: 130 });
      });
    },

    // match win fanfare
    win: function () {
      go(function (t) {
        [523, 659, 784, 1047, 1319].forEach(function (f, i) { note(f, t + i * 0.1, 0.5, { type: 'triangle', gain: 0.17 }); });
        note(784, t + 0.5, 0.7, { type: 'sine', gain: 0.12 });
        noise(t, 0.25, { gain: 0.09, freq: 3000, sweepTo: 5200 });
      });
    },

    // streak-up — pitch climbs with the streak length
    streak: function (n) {
      var base = 600 + Math.min(n || 1, 8) * 70;
      go(function (t) {
        note(base, t, 0.1, { type: 'triangle', gain: 0.16 });
        note(base * 1.5, t + 0.07, 0.12, { type: 'triangle', gain: 0.14 });
        noise(t, 0.1, { gain: 0.06, freq: 3000, sweepTo: 5000 });
      });
    },

    // every daily cleared — grandest fanfare
    allDone: function () {
      go(function (t) {
        [523, 659, 784, 1047, 1319, 1568].forEach(function (f, i) { note(f, t + i * 0.11, 0.6, { type: 'triangle', gain: 0.17 }); });
        note(1047, t + 0.66, 0.9, { type: 'sine', gain: 0.13 });
        noise(t, 0.3, { gain: 0.1, freq: 3200, sweepTo: 5400 });
      });
    },

    // ── card collection: reveal cues ──
    // cards appear (deal/whoosh)
    cardDeal: function () { go(function (t) { noise(t, 0.26, { gain: 0.12, freq: 1600, sweepTo: 420 }); note(280, t, 0.2, { type: 'sine', gain: 0.06, slideTo: 150 }); }); },
    // a card flips over
    cardFlip: function () { go(function (t) { noise(t, 0.14, { gain: 0.1, freq: 2200, sweepTo: 700 }); note(520, t, 0.08, { type: 'triangle', gain: 0.08, slideTo: 380 }); }); },
    // rarity stinger when a card is revealed — escalates with tier
    reveal: function (tier) {
      if (tier === 'legendary') { Sfx.legendary(); return; }
      go(function (t) {
        if (tier === 'elite') {
          [784, 1047, 1319].forEach(function (f, i) { note(f, t + i * 0.06, 0.26, { type: 'triangle', gain: 0.15 }); });
          noise(t, 0.16, { gain: 0.07, freq: 3400, sweepTo: 5200 });
        } else if (tier === 'rare') {
          note(659, t, 0.16, { type: 'triangle', gain: 0.15 });
          note(988, t + 0.07, 0.22, { type: 'triangle', gain: 0.14 });
          noise(t, 0.1, { gain: 0.05, freq: 3000, sweepTo: 4600 });
        } else {
          note(523, t, 0.16, { type: 'triangle', gain: 0.12 });
          note(659, t + 0.06, 0.16, { type: 'sine', gain: 0.1 });
        }
      });
    },
    // legendary pull — the big one
    legendary: function () {
      go(function (t) {
        [523, 659, 784, 1047, 1319, 1568, 2093].forEach(function (f, i) { note(f, t + i * 0.085, 0.6, { type: 'triangle', gain: 0.17 }); });
        note(1047, t + 0.6, 0.95, { type: 'sine', gain: 0.13 });
        note(1568, t + 0.6, 0.95, { type: 'sine', gain: 0.1 });
        noise(t, 0.3, { gain: 0.11, freq: 3200, sweepTo: 6000 });
        noise(t + 0.5, 0.4, { gain: 0.06, freq: 5000, sweepTo: 8000 });
      });
    },
    // level up
    levelUp: function () {
      go(function (t) {
        [523, 784, 1047, 1568].forEach(function (f, i) { note(f, t + i * 0.09, 0.4, { type: 'triangle', gain: 0.16 }); });
        note(1047, t + 0.36, 0.6, { type: 'sine', gain: 0.12 });
        noise(t, 0.18, { gain: 0.07, freq: 3600, sweepTo: 5400 });
      });
    },
    // duplicate → dust
    dust: function () { go(function (t) { note(1175, t, 0.05, { type: 'triangle', gain: 0.08 }); note(1568, t + 0.04, 0.08, { type: 'triangle', gain: 0.07 }); }); }
  };

  window.Sfx = Sfx;
})();
