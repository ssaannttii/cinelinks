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

  // Sustained voices (the pack hum) register here so muting mid-sound stops them.
  var live = [];
  function stopLive() { live.slice().forEach(function (h) { try { h.stop(true); } catch (_) {} }); live = []; }

  var Sfx = {
    get enabled() { load(); return enabled; },
    toggle: function () {
      load();
      enabled = !enabled;
      try { localStorage.setItem(KEY, enabled ? '1' : '0'); } catch (_) {}
      if (enabled) Sfx.tap(); else stopLive();
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

    // last attempt in play — a low two-note warning (Fx.tension)
    tense: function () {
      go(function (t) {
        note(220, t, 0.12, { type: 'triangle', gain: 0.09 });
        note(165, t + 0.15, 0.24, { type: 'triangle', gain: 0.1, slideTo: 150 });
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
    // ── pack opening ──
    // the house lights strike: a lamp clunk and a short hiss
    packLights: function () { go(function (t) { note(92, t, 0.12, { type: 'sine', gain: 0.07, slideTo: 58 }); noise(t + 0.02, 0.42, { gain: 0.022, freq: 4200, sweepTo: 1800, q: 0.4 }); }); },
    // the pack lands: a thud with a little weight
    packLand: function () { go(function (t) { note(72, t, 0.26, { type: 'sine', gain: 0.16, slideTo: 34, attack: 0.004 }); noise(t, 0.11, { gain: 0.1, freq: 320, sweepTo: 90, q: 0.6 }); noise(t, 0.04, { gain: 0.05, freq: 2400 }); }); },
    // the drone of a sealed pack: a low, slowly wobbling pad that rises in pitch and
    // brightness with the tear (set(p)) and fades on stop(). Returns a handle; every
    // method is safe to call when audio is off or unavailable.
    packHum: function (tier) {
      var h = { set: function () {}, stop: function () {} };
      load(); if (!enabled) return h;
      var c = ac(); if (!c) return h;
      try {
        var t = c.currentTime, big = tier === 'legendary' || tier === 'elite';
        var base = big ? 0.065 : 0.03, f0 = 55, span = big ? 42 : 16, cut0 = 150, cutSpan = big ? 1500 : 600;
        var o1 = c.createOscillator(), o2 = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain(), lfo = c.createOscillator(), lg = c.createGain();
        o1.type = 'sawtooth'; o2.type = 'sine';
        o1.frequency.value = f0; o2.frequency.value = f0 * 1.006;              // a hair of detune: the slow beating
        f.type = 'lowpass'; f.frequency.value = cut0; f.Q.value = 2.2;
        lfo.frequency.value = 0.8; lg.gain.value = 7; lfo.connect(lg); lg.connect(o1.frequency);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(base, t + 1.4);
        o1.connect(f); o2.connect(f); f.connect(g); g.connect(master);
        o1.start(t); o2.start(t); lfo.start(t);
        var done = false;
        h.set = function (p) {
          if (done) return;
          try {
            var now = c.currentTime, k = Math.max(0, Math.min(1, p || 0));
            f.frequency.setTargetAtTime(cut0 + k * cutSpan, now, 0.08);
            o1.frequency.setTargetAtTime(f0 + k * span, now, 0.1); o2.frequency.setTargetAtTime((f0 + k * span) * 1.006, now, 0.1);
            g.gain.setTargetAtTime(base * (1 + k * 1.3), now, 0.1);
          } catch (_) {}
        };
        h.stop = function (fast) {
          if (done) return; done = true;
          var i = live.indexOf(h); if (i >= 0) live.splice(i, 1);
          try {
            var now = c.currentTime, d = fast ? 0.07 : 0.5;
            g.gain.cancelScheduledValues(now); g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), now);
            g.gain.exponentialRampToValueAtTime(0.0001, now + d);
            o1.stop(now + d + 0.05); o2.stop(now + d + 0.05); lfo.stop(now + d + 0.05);
          } catch (_) {}
        };
        live.push(h);
      } catch (_) {}
      return h;
    },
    // the card rises out of the torn pack: a glide up, stretched to the walkout (ms)
    packRise: function (tier, ms) {
      var d = Math.max(0.3, Math.min(1.2, (ms || 560) / 1000));
      go(function (t) {
        note(196, t, d, { type: 'triangle', gain: 0.07, slideTo: tier === 'legendary' ? 1046 : tier === 'elite' ? 784 : 587, attack: 0.04 });
        noise(t, d, { gain: 0.045, freq: 700, sweepTo: 4600, q: 1.3 });
        if (tier === 'legendary' || tier === 'elite') note(49, t, d, { type: 'sine', gain: 0.09, slideTo: 98, attack: 0.05 });
      });
    },
    // the pack is pressed
    packPress: function () { go(function (t) { note(170, t, 0.05, { type: 'triangle', gain: 0.05, slideTo: 120 }); noise(t, 0.03, { gain: 0.03, freq: 900 }); }); },
    // a short foil tick as the tear advances
    packTear: function () { go(function (t) { noise(t, 0.045, { gain: 0.07, freq: 2600 + Math.random() * 1800, q: 1.6, sweepTo: 1500 }); }); },
    // low rumble while something big is inside (the caller loops short slices)
    packRumble: function (s) {
      s = s || 0.2;
      go(function (t) { note(46, t, s, { type: 'sine', gain: 0.11, attack: 0.03 }); note(31, t, s, { type: 'triangle', gain: 0.05, attack: 0.03 }); noise(t, s, { gain: 0.045, freq: 130, q: 0.5 }); });
    },
    // the rip itself
    packRip: function () { go(function (t) { noise(t, 0.2, { gain: 0.15, freq: 3400, sweepTo: 800, q: 0.8 }); noise(t + 0.04, 0.16, { gain: 0.1, freq: 1700, sweepTo: 420, q: 1 }); note(95, t, 0.16, { type: 'sine', gain: 0.12, slideTo: 42 }); }); },
    // light bursts out of the opening, scaled to what's inside
    packBurst: function (tier) {
      go(function (t) {
        if (tier === 'legendary') { noise(t, 0.55, { gain: 0.12, freq: 500, sweepTo: 7500, q: 0.6 }); note(55, t, 0.5, { type: 'sine', gain: 0.15, slideTo: 28 }); [523, 784, 1047].forEach(function (f, i) { note(f, t + 0.12 + i * 0.07, 0.5, { type: 'triangle', gain: 0.12 }); }); }
        else if (tier === 'elite') { noise(t, 0.4, { gain: 0.1, freq: 700, sweepTo: 6000, q: 0.6 }); note(70, t, 0.35, { type: 'sine', gain: 0.1, slideTo: 35 }); [659, 988].forEach(function (f, i) { note(f, t + 0.1 + i * 0.07, 0.4, { type: 'triangle', gain: 0.11 }); }); }
        else if (tier === 'rare') { noise(t, 0.3, { gain: 0.08, freq: 900, sweepTo: 5200, q: 0.7 }); note(784, t + 0.08, 0.3, { type: 'triangle', gain: 0.1 }); }
        else { noise(t, 0.26, { gain: 0.07, freq: 1100, sweepTo: 4200, q: 0.7 }); note(659, t + 0.06, 0.22, { type: 'sine', gain: 0.08 }); }
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
    dust: function () { go(function (t) { note(1175, t, 0.05, { type: 'triangle', gain: 0.08 }); note(1568, t + 0.04, 0.08, { type: 'triangle', gain: 0.07 }); }); },
    // XP bar charging up — a rising glide stretched to match the fill segment, so the
    // ear tracks the bar. Pass the segment's duration in ms.
    xpFill: function (ms) {
      var d = Math.max(0.12, Math.min(1.2, (ms || 600) / 1000));
      go(function (t) {
        note(320, t, d, { type: 'triangle', gain: 0.085, slideTo: 780, attack: 0.03 });
        noise(t, d, { gain: 0.03, freq: 900, sweepTo: 2600, q: 1.1 });
      });
    }
  };

  window.Sfx = Sfx;
})();
