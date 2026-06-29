// Tiny dependency-free WebAudio sound engine for Top Trumps. Every sound is
// synthesized at runtime (no asset files, no network). The AudioContext can only
// start after a user gesture, so the first tap unlocks it; calls before that are
// no-ops. Mute state persists in localStorage and survives reloads.

type Osc = OscillatorType;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let enabled = true;
let loaded = false;

const KEY = "toptrumps_sound";

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const v = localStorage.getItem(KEY);
    if (v === "0") enabled = false;
  } catch { /* noop */ }
}

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    } catch { return null; }
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

// One enveloped oscillator voice. `slideTo` glides the pitch over the note.
function note(freq: number, t0: number, dur: number, opts: { type?: Osc; gain?: number; slideTo?: number; attack?: number } = {}) {
  if (!ctx || !master) return;
  const { type = "sine", gain = 0.3, slideTo, attack = 0.006 } = opts;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(master);
  o.start(t0); o.stop(t0 + dur + 0.02);
}

// Short filtered-noise burst — used for whooshes and impact texture.
function noise(t0: number, dur: number, opts: { gain?: number; freq?: number; q?: number; sweepTo?: number } = {}) {
  if (!ctx || !master) return;
  const { gain = 0.18, freq = 1400, q = 0.7, sweepTo } = opts;
  const n = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource(); src.buffer = buf;
  const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = freq; bp.Q.value = q;
  if (sweepTo) bp.frequency.exponentialRampToValueAtTime(Math.max(80, sweepTo), t0 + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(bp); bp.connect(g); g.connect(master);
  src.start(t0); src.stop(t0 + dur + 0.02);
}

function go(fn: (t: number) => void) {
  load();
  if (!enabled) return;
  const c = ac();
  if (!c) return;
  fn(c.currentTime);
}

export const Sfx = {
  get enabled() { load(); return enabled; },
  toggle(): boolean {
    load();
    enabled = !enabled;
    try { localStorage.setItem(KEY, enabled ? "1" : "0"); } catch { /* noop */ }
    if (enabled) Sfx.tap(); // confirm un-mute audibly
    return enabled;
  },
  // soft UI tap
  tap() { go((t) => note(420, t, 0.05, { type: "triangle", gain: 0.12 })); },
  // segmented-control / toggle select — brighter, two-step
  select() { go((t) => { note(540, t, 0.05, { type: "triangle", gain: 0.14 }); note(720, t + 0.04, 0.06, { type: "triangle", gain: 0.13 }); }); },
  // card flip — airy whoosh
  flip() { go((t) => { noise(t, 0.22, { gain: 0.13, freq: 1800, sweepTo: 500 }); note(300, t, 0.18, { type: "sine", gain: 0.08, slideTo: 160 }); }); },
  // stat locked in — confident rising blip
  pick() { go((t) => { note(480, t, 0.07, { type: "square", gain: 0.1 }); note(640, t + 0.05, 0.08, { type: "square", gain: 0.1 }); note(840, t + 0.1, 0.1, { type: "triangle", gain: 0.11 }); }); },
  // the two numbers counting up — subtle tick (call sparingly)
  tick() { go((t) => note(1200, t, 0.02, { type: "square", gain: 0.04 })); },
  // round win — bright major arpeggio + sparkle
  win() {
    go((t) => {
      [523, 659, 784, 1047].forEach((f, i) => note(f, t + i * 0.06, 0.22, { type: "triangle", gain: 0.16 }));
      noise(t, 0.12, { gain: 0.08, freq: 2600, sweepTo: 4200 });
    });
  },
  // round loss — low descending thud
  lose() { go((t) => { note(220, t, 0.26, { type: "sawtooth", gain: 0.13, slideTo: 110 }); noise(t, 0.16, { gain: 0.1, freq: 320, sweepTo: 120 }); }); },
  // tie → war — tense rising buzz
  tie() { go((t) => { note(180, t, 0.34, { type: "sawtooth", gain: 0.11, slideTo: 300 }); note(184, t, 0.34, { type: "sawtooth", gain: 0.09, slideTo: 306 }); }); },
  // streak escalation — pitch climbs with the streak length
  streak(n: number) {
    const base = 600 + Math.min(n, 8) * 70;
    go((t) => { note(base, t, 0.1, { type: "triangle", gain: 0.16 }); note(base * 1.5, t + 0.07, 0.12, { type: "triangle", gain: 0.14 }); noise(t, 0.1, { gain: 0.06, freq: 3000, sweepTo: 5000 }); });
  },
  // match victory fanfare
  victory() {
    go((t) => {
      const seq = [523, 659, 784, 1047, 1319];
      seq.forEach((f, i) => note(f, t + i * 0.1, 0.5, { type: "triangle", gain: 0.18 }));
      note(784, t + 0.5, 0.7, { type: "sine", gain: 0.12 });
      noise(t, 0.25, { gain: 0.1, freq: 3000, sweepTo: 5200 });
    });
  },
  // match defeat
  defeat() {
    go((t) => { [392, 330, 262, 196].forEach((f, i) => note(f, t + i * 0.16, 0.5, { type: "sawtooth", gain: 0.13 })); });
  },
};
