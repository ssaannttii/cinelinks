"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import HomeIcon from "@/components/HomeIcon";
import { TRUMP_POOL, type TrumpTuple } from "@/lib/trumps-pool";
import { confetti } from "@/lib/confetti";
import { Sfx } from "@/lib/sfx";

// ── Movie card battle vs CPU. Baked TMDB stats (instant, every field present). ──

const IMG = "https://image.tmdb.org/t/p/w342";

interface Card {
  id: number; title: string; year: number; poster: string; genre: string;
  rating: number; votes: number; revenue: number; budget: number; runtime: number;
  rarity: "common" | "rare" | "elite" | "legendary";
}
type StatKey = "rating" | "votes" | "revenue" | "budget" | "runtime" | "year";

function rarityOf(r: number): Card["rarity"] {
  return r >= 8.3 ? "legendary" : r >= 7.8 ? "elite" : r >= 7 ? "rare" : "common";
}
const RARITY: Record<Card["rarity"], { label: string; ring: string; glow: string; grad: string }> = {
  legendary: { label: "Legendary", ring: "#e8c24a", glow: "rgba(232,194,74,.55)", grad: "linear-gradient(135deg,rgba(232,194,74,.16),rgba(232,194,74,0) 55%)" },
  elite: { label: "Elite", ring: "#b58ad6", glow: "rgba(181,138,214,.5)", grad: "linear-gradient(135deg,rgba(181,138,214,.15),rgba(181,138,214,0) 55%)" },
  rare: { label: "Rare", ring: "#7aa6e8", glow: "rgba(122,166,232,.45)", grad: "linear-gradient(135deg,rgba(122,166,232,.13),rgba(122,166,232,0) 55%)" },
  common: { label: "Common", ring: "rgba(255,255,255,.2)", glow: "rgba(255,255,255,.14)", grad: "none" },
};

function toCard(t: TrumpTuple): Card {
  return { id: t[0], title: t[1], year: t[2], poster: IMG + t[3], rating: t[4], votes: t[5], revenue: t[6], budget: t[7], runtime: t[8], genre: t[9], rarity: rarityOf(t[4]) };
}

// pool maxima for the strength bars
const MAX = TRUMP_POOL.reduce((m, t) => ({
  votes: Math.max(m.votes, t[5]), revenue: Math.max(m.revenue, t[6]), budget: Math.max(m.budget, t[7]), runtime: Math.max(m.runtime, t[8]),
}), { votes: 1, revenue: 1, budget: 1, runtime: 1 });

function money(n: number): string { return n >= 1e9 ? "$" + (n / 1e9).toFixed(1) + "B" : n >= 1e6 ? "$" + Math.round(n / 1e6) + "M" : "$" + Math.round(n / 1e3) + "k"; }
function votesFmt(n: number): string { return n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1) + "k" : String(Math.round(n)); }
function runFmt(n: number): string { const h = Math.floor(n / 60), m = Math.round(n % 60); return h ? h + "h " + m + "m" : m + "m"; }

const STATS: { key: StatKey; label: string; icon: string; val: (c: Card) => number; fmtNum: (n: number) => string; bar: (c: Card) => number; from: (c: Card) => number }[] = [
  { key: "rating", label: "Rating", icon: "⭐", val: (c) => c.rating, fmtNum: (n) => n.toFixed(1), bar: (c) => c.rating / 10, from: () => 0 },
  { key: "votes", label: "Fame", icon: "🔥", val: (c) => c.votes, fmtNum: (n) => votesFmt(n), bar: (c) => Math.log10(c.votes + 1) / Math.log10(MAX.votes + 1), from: () => 0 },
  { key: "revenue", label: "Box office", icon: "💰", val: (c) => c.revenue, fmtNum: (n) => money(n), bar: (c) => Math.log10(c.revenue + 1) / Math.log10(MAX.revenue + 1), from: () => 0 },
  { key: "budget", label: "Budget", icon: "💵", val: (c) => c.budget, fmtNum: (n) => money(n), bar: (c) => Math.log10(c.budget + 1) / Math.log10(MAX.budget + 1), from: () => 0 },
  { key: "runtime", label: "Runtime", icon: "⏱️", val: (c) => c.runtime, fmtNum: (n) => runFmt(n), bar: (c) => Math.min(1, c.runtime / 210), from: () => 0 },
  { key: "year", label: "Year", icon: "📅", val: (c) => c.year, fmtNum: (n) => String(Math.round(n)), bar: (c) => (c.year - 1950) / (new Date().getFullYear() - 1950), from: (c) => Math.max(1900, c.year - 18) },
];

const HAND = 8;
const MAX_ROUNDS = 40;
type Phase = "play" | "reveal" | "over";
type Mode = "daily" | "practice";
type Diff = "normal" | "hard";
type Res = "win" | "lose" | "tie";
type Duel = { stat: StatKey; pv: number; cv: number; res: Res } | null;

function shuffle<T>(a: T[], rnd: () => number): T[] {
  const r = a.slice();
  for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; }
  return r;
}
function mulberry(seed: number) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function dayNum() { const n = new Date(); return Math.floor(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()) / 86400000); }
function todayKey() { const n = new Date(); return "" + n.getUTCFullYear() + String(n.getUTCMonth() + 1).padStart(2, "0") + String(n.getUTCDate()).padStart(2, "0"); }

function buildDeck(mode: Mode): Card[] {
  const rnd = mode === "daily" ? mulberry(dayNum() * 2654435761) : mulberry((Math.random() * 1e9) | 0);
  return shuffle(TRUMP_POOL, rnd).slice(0, HAND * 2).map(toCard);
}
function cpuPick(card: Card, diff: Diff): StatKey {
  const scored = STATS.map((s) => ({ k: s.key, b: s.bar(card) }));
  scored.sort((a, b) => b.b - a.b);
  if (diff === "hard" || Math.random() < 0.7) return scored[0].k;
  return scored[1].k;
}
function vibrate(ms: number | number[]) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch { /* noop */ } }
const resColor = (r: Res) => (r === "win" ? "#7fd49a" : r === "lose" ? "#e8806f" : "#b58ad6");

export default function TopTrumps() {
  const [mode, setMode] = useState<Mode>("daily");
  const [diff, setDiff] = useState<Diff>("normal");
  const [phase, setPhase] = useState<Phase>("play");
  const [player, setPlayer] = useState<Card[]>(() => []);
  const [cpu, setCpu] = useState<Card[]>(() => []);
  const [pot, setPot] = useState<Card[]>([]);
  const [turn, setTurn] = useState<"player" | "cpu">("player");
  const [round, setRound] = useState(1);
  const [chosen, setChosen] = useState<StatKey | null>(null);
  const [duel, setDuel] = useState<Duel>(null);
  const [clash, setClash] = useState(false);
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(0);
  const [won, setWon] = useState(false);
  const [dailyLocked, setDailyLocked] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [sound, setSound] = useState(true);

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const reducedRef = useRef(false);
  const boardRef = useRef<HTMLDivElement>(null);
  const clashRef = useRef<HTMLDivElement>(null);
  const youRef = useRef<HTMLSpanElement>(null);
  const cpuRef = useRef<HTMLSpanElement>(null);

  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  const after = (ms: number, fn: () => void) => { timers.current.push(setTimeout(fn, ms)); };

  useEffect(() => {
    const r = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    reducedRef.current = r;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing client-only prefs on mount
    setReduced(r);
    setSound(Sfx.enabled);
  }, []);

  // ── juice helpers (refs/setState only → stable) ──
  const triggerShake = useCallback(() => {
    if (reducedRef.current) return;
    const el = boardRef.current; if (!el) return;
    el.classList.remove("tt-shake"); void el.offsetWidth; el.classList.add("tt-shake");
  }, []);

  const sweep = useCallback((side: "player" | "cpu", n: number) => {
    if (reducedRef.current || typeof document === "undefined") return;
    const o = clashRef.current?.getBoundingClientRect();
    const t = (side === "player" ? youRef : cpuRef).current?.getBoundingClientRect();
    if (!o || !t) return;
    const ox = o.left + o.width / 2, oy = o.top + o.height / 2;
    const tx = t.left + t.width / 2, ty = t.top + t.height / 2;
    const count = Math.min(7, Math.max(3, n));
    const col = side === "player" ? "linear-gradient(135deg,#f5c542,#e8a000)" : "linear-gradient(135deg,#aab2c0,#7d8696)";
    for (let i = 0; i < count; i++) {
      const el = document.createElement("div");
      el.style.cssText = `position:fixed;left:${ox - 9}px;top:${oy - 12}px;width:18px;height:24px;border-radius:3px;background:${col};z-index:9998;pointer-events:none;box-shadow:0 4px 12px rgba(0,0,0,.5);will-change:transform,opacity`;
      document.body.appendChild(el);
      const dx = tx - ox + (Math.random() * 34 - 17), dy = ty - oy + (Math.random() * 16 - 8);
      const rot = (Math.random() * 80 - 40) | 0;
      el.animate([
        { transform: "translate(0,0) scale(.5) rotate(0deg)", opacity: 0 },
        { transform: `translate(${dx * 0.2}px,${dy * 0.2 - 14}px) scale(1.05) rotate(${rot / 3}deg)`, opacity: 1, offset: 0.25 },
        { transform: `translate(${dx}px,${dy}px) scale(.4) rotate(${rot}deg)`, opacity: 0 },
      ], { duration: 520 + i * 45, delay: i * 38, easing: "cubic-bezier(.42,0,.25,1)" }).onfinish = () => el.remove();
    }
  }, []);

  const newGame = useCallback((m: Mode) => {
    clearTimers();
    const deck = buildDeck(m);
    setPlayer(deck.slice(0, HAND)); setCpu(deck.slice(HAND, HAND * 2));
    setPot([]); setTurn("player"); setRound(1); setChosen(null); setDuel(null); setClash(false);
    setStreak(0); setBest(0); setWon(false); setRevealed(false);
    setPhase("play");
    if (m === "daily") {
      try { const s = JSON.parse(localStorage.getItem("toptrumps_daily") || "null"); setDailyLocked(!!(s && s.date === todayKey())); } catch { setDailyLocked(false); }
    } else setDailyLocked(false);
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time deal on mount
  useEffect(() => { newGame("daily"); }, [newGame]);

  const finish = useCallback((np: Card[], nc: Card[]) => {
    const w = np.length >= nc.length;
    setWon(w); setPhase("over");
    if (mode === "daily") {
      try {
        localStorage.setItem("toptrumps_daily", JSON.stringify({ date: todayKey(), won: w, mine: np.length, cpu: nc.length }));
        const cur = JSON.parse(localStorage.getItem("cinerating_daily") || "null") || {};
        localStorage.setItem("cinerating_daily", JSON.stringify({ ...cur, date: todayKey() }));
      } catch { /* noop */ }
      setDailyLocked(true);
    }
    if (w) { vibrate([20, 40, 20]); Sfx.victory(); setTimeout(() => confetti(160), 140); setTimeout(() => confetti(90), 620); }
    else { vibrate(80); Sfx.defeat(); }
  }, [mode]);

  const resolve = useCallback((stat: StatKey) => {
    if (phase !== "play" || !player.length || !cpu.length) return;
    const sdef = STATS.find((s) => s.key === stat)!;
    const pc = player[0], cc = cpu[0];
    const pv = sdef.val(pc), cv = sdef.val(cc);
    const res: Res = pv > cv ? "win" : cv > pv ? "lose" : "tie";
    const byPlayer = turn === "player";
    setChosen(stat); setRevealed(true); setPhase("reveal"); setClash(false);
    setDuel({ stat, pv, cv, res });
    vibrate(10); Sfx.flip(); if (byPlayer) Sfx.pick();
    clearTimers();
    after(820, () => {
      setClash(true);
      if (res === "win") { vibrate(28); Sfx.win(); triggerShake(); sweep("player", [pc, cc, ...pot].length); }
      else if (res === "lose") { vibrate([14, 28]); Sfx.lose(); sweep("cpu", [pc, cc, ...pot].length); }
      else { vibrate([10, 22, 10]); Sfx.tie(); }
    });
    after(1620, () => {
      const spoils = shuffle([pc, cc, ...pot], Math.random);
      let np = player.slice(1), nc = cpu.slice(1), nturn = turn, nstreak = streak;
      if (res === "win") { np = [...np, ...spoils]; nturn = "player"; nstreak = streak + 1; setPot([]); if (nstreak >= 2) Sfx.streak(nstreak); }
      else if (res === "lose") { nc = [...nc, ...spoils]; nturn = "cpu"; nstreak = 0; setPot([]); }
      else { setPot(spoils); }
      setPlayer(np); setCpu(nc); setTurn(nturn); setStreak(nstreak); setBest((b) => Math.max(b, nstreak));
      if (np.length === 0 || nc.length === 0 || round >= MAX_ROUNDS) { finish(np, nc); }
      else { setRound((r) => r + 1); setRevealed(false); setChosen(null); setClash(false); setDuel(null); setPhase("play"); }
    });
  }, [phase, player, cpu, pot, turn, round, streak, finish, sweep, triggerShake]);

  useEffect(() => {
    if (phase === "play" && turn === "cpu" && cpu.length) {
      const t = setTimeout(() => resolve(cpuPick(cpu[0], diff)), 980);
      return () => clearTimeout(t);
    }
  }, [phase, turn, cpu, diff, resolve]);

  useEffect(() => () => clearTimers(), []);

  const pc = player[0], cc = cpu[0];
  const yourTurn = phase === "play" && turn === "player";
  const showCpu = revealed || phase === "over";
  const total = player.length + cpu.length;
  const youPct = total ? (player.length / total) * 100 : 50;
  const onFire = streak >= 3;

  function toggleSound() { setSound(Sfx.toggle()); }

  function share() {
    const s = `🃏 Top Trumps${mode === "daily" ? " #" + (dayNum() - 20000) : ""} — ${won ? "won" : "lost"} ${player.length}–${cpu.length} vs CPU${best >= 3 ? ` · ${best}🔥 streak` : ""}\ncinelinks.vercel.app/rating/toptrumps`;
    if (navigator.share) navigator.share({ text: s }).catch(() => {});
    else if (navigator.clipboard) navigator.clipboard.writeText(s).catch(() => {});
  }

  return (
    <main style={{ maxWidth: 460, margin: "0 auto", padding: "52px 14px 40px" }}>
      <style>{CSS}</style>

      <a href="https://cinelinks.vercel.app/rating" style={backStyle}><HomeIcon /> Rating games</a>
      <button onClick={toggleSound} aria-label={sound ? "Mute sound" : "Unmute sound"} style={soundStyle}>{sound ? "🔊" : "🔇"}</button>

      <div className="text-center">
        <h1 className="tt-title" style={{ fontSize: "2rem", fontWeight: 900, letterSpacing: "-.025em", lineHeight: 1 }}>Top<span>Trumps</span></h1>
        <p style={{ color: "var(--mut)", fontSize: ".82rem", marginTop: 5 }}>Pick a stat. Higher wins the cards. Take the deck.</p>
      </div>

      {/* mode + difficulty */}
      <div className="flex items-center justify-center gap-2 mt-3">
        <div className="tt-seg">
          <Seg active={mode === "daily"} onClick={() => { Sfx.select(); setMode("daily"); newGame("daily"); }}>Daily</Seg>
          <Seg active={mode === "practice"} onClick={() => { Sfx.select(); setMode("practice"); newGame("practice"); }}>Practice</Seg>
        </div>
        <div className="tt-seg">
          <Seg active={diff === "normal"} onClick={() => { Sfx.tap(); setDiff("normal"); }}>Normal</Seg>
          <Seg active={diff === "hard"} onClick={() => { Sfx.tap(); setDiff("hard"); }}>Hard</Seg>
        </div>
      </div>

      {/* tug-of-war momentum bar */}
      <div className="mt-4 mb-3">
        <div className="flex items-end justify-between mb-1" style={{ fontSize: ".78rem", fontWeight: 800 }}>
          <span ref={youRef} style={{ color: "var(--gold)" }}>You <b style={{ fontSize: "1rem" }}>{player.length}</b></span>
          <span style={{ color: "var(--mut)", fontSize: ".66rem", fontWeight: 700 }}>round {round}/{MAX_ROUNDS}</span>
          <span ref={cpuRef} style={{ color: "#aab2c0", textAlign: "right" }}><b style={{ fontSize: "1rem" }}>{cpu.length}</b> CPU</span>
        </div>
        <div className="tt-track">
          <i style={{ width: youPct + "%", transition: reduced ? "none" : "width .7s cubic-bezier(.3,.9,.3,1)" }}>
            {!reduced && <span className="tt-shine" />}
          </i>
          <span className="tt-knob" style={{ left: youPct + "%", transition: reduced ? "none" : "left .7s cubic-bezier(.3,.9,.3,1)" }} />
        </div>
        <div className="flex items-center justify-center gap-2 mt-2" style={{ minHeight: 20 }}>
          {onFire && <span className="tt-fire">🔥 {streak} in a row{streak >= 5 ? " · ON FIRE" : ""}</span>}
          {pot.length > 0 && <span className="tt-war">⚔ WAR · pot {pot.length}</span>}
        </div>
      </div>

      <div ref={boardRef} className="tt-board">
        {/* CPU card */}
        <FlipCard card={cc} faceUp={showCpu} duel={duel} clash={clash} reduced={reduced} owner="CPU" />

        {/* clash / VS zone */}
        <div ref={clashRef} className="tt-clash">
          {clash && duel && !reduced && <span className="tt-shock" style={{ borderColor: resColor(duel.res) }} />}
          <div className={"tt-vs" + (clash ? " on" : "")} style={clash && duel ? { borderColor: resColor(duel.res), color: resColor(duel.res), boxShadow: `0 0 22px ${resColor(duel.res)}55` } : undefined}>
            {!revealed ? "VS" : !clash ? "…" : duel ? (duel.res === "win" ? "✓" : duel.res === "lose" ? "✗" : "=") : "VS"}
          </div>
        </div>

        {/* banner */}
        <div className="text-center" style={{ minHeight: 22, fontSize: ".82rem", fontWeight: 800, marginBottom: 8 }}>
          {clash && duel
            ? <span style={{ color: resColor(duel.res) }}>{duel.res === "win" ? "You took the cards" : duel.res === "lose" ? "CPU took the cards" : "Tie — pot grows ⚔"}</span>
            : yourTurn ? <span style={{ color: "var(--gold)" }}>Your turn — pick a stat</span>
            : phase === "reveal" ? <span style={{ color: "var(--mut)" }}>Revealing…</span>
            : <span style={{ color: "var(--mut)" }}>CPU choosing…</span>}
        </div>

        {/* Player card */}
        {pc && <PlayerCard key={pc.id} card={pc} chosen={chosen} duel={duel} clash={clash} revealed={revealed} yourTurn={yourTurn} onPick={resolve} onFire={onFire} streak={streak} />}
      </div>

      {phase === "over" && (
        <div className="text-center mt-6 tt-rise">
          <div className="tt-trophy" style={{ fontSize: "2.6rem" }}>{won ? "🏆" : "🎬"}</div>
          <div style={{ fontSize: "1.55rem", fontWeight: 900, color: won ? "#7fd49a" : "#e8806f", marginTop: 2 }}>{won ? "You win!" : "CPU wins"}</div>
          <div className="flex items-center justify-center gap-4 my-3" style={{ fontWeight: 900 }}>
            <span style={{ color: "var(--gold)", fontSize: "1.5rem" }}><CountStat target={player.length} fmt={(n) => String(Math.round(n))} run /> <span style={{ fontSize: ".72rem", color: "var(--mut)", fontWeight: 800 }}>YOU</span></span>
            <span style={{ color: "var(--mut)" }}>·</span>
            <span style={{ color: "#aab2c0", fontSize: "1.5rem" }}><CountStat target={cpu.length} fmt={(n) => String(Math.round(n))} run /> <span style={{ fontSize: ".72rem", color: "var(--mut)", fontWeight: 800 }}>CPU</span></span>
          </div>
          {best >= 3 && <div style={{ color: "#7fd49a", fontSize: ".8rem", fontWeight: 800, marginBottom: 10 }}>Best streak this game · {best}🔥</div>}
          <div className="flex gap-2 justify-center">
            <button onClick={() => { Sfx.tap(); share(); }} style={btn(false)}>Share</button>
            {mode === "daily" && dailyLocked
              ? <button onClick={() => { Sfx.select(); setMode("practice"); newGame("practice"); }} style={btn(true)}>Practice</button>
              : <button onClick={() => { Sfx.select(); newGame(mode); }} style={btn(true)}>{mode === "daily" ? "Replay" : "New deck"}</button>}
          </div>
          {mode === "daily" && <div style={{ color: "var(--mut)", fontSize: ".72rem", marginTop: 12 }}>Daily counts toward your streak · come back tomorrow for a new deck</div>}
        </div>
      )}

      <div className="text-center" style={{ marginTop: 24, color: "var(--mut)", fontSize: ".68rem" }}>
        Stats &amp; posters by <a href="https://www.themoviedb.org/" target="_blank" rel="noopener" style={{ color: "inherit" }}>TMDB</a> · part of <a href="https://cinelinks.vercel.app" style={{ color: "var(--gold)", textDecoration: "none" }}>CineLinks</a>
      </div>
    </main>
  );
}

// ─────────────────────────────────────────────────────────────── count-up ──
function CountStat({ target, fmt, run, from = 0, dur = 680, style }: { target: number; fmt: (n: number) => string; run: boolean; from?: number; dur?: number; style?: React.CSSProperties }) {
  const [n, setN] = useState(target);
  useEffect(() => {
    if (!run) return;
    if (typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t0 = performance.now(); let raf = 0;
    const tick = (t: number) => { const e = Math.min(1, (t - t0) / dur); const k = 1 - Math.pow(1 - e, 3); setN(from + (target - from) * k); if (e < 1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [run, target, from, dur]);
  return <span style={style}>{fmt(n)}</span>;
}

// ───────────────────────────────────────────────────────────────── styles ──
const CSS = `
@keyframes ttdeal{from{opacity:0;transform:translateY(18px) scale(.96)}to{opacity:1;transform:none}}
@keyframes ttpulse{0%,100%{box-shadow:0 0 0 0 rgba(232,160,0,0)}50%{box-shadow:0 0 0 3px rgba(232,160,0,.4)}}
@keyframes ttshake{10%,90%{transform:translateX(-2px)}20%,80%{transform:translateX(3px)}30%,50%,70%{transform:translateX(-6px)}40%,60%{transform:translateX(6px)}}
@keyframes ttshock{from{opacity:.8;transform:translate(-50%,-50%) scale(.3)}to{opacity:0;transform:translate(-50%,-50%) scale(2.6)}}
@keyframes ttsheen{0%{transform:translateX(-130%) skewX(-20deg)}55%,100%{transform:translateX(260%) skewX(-20deg)}}
@keyframes tttwinkle{0%,100%{opacity:0;transform:scale(.3)}50%{opacity:1;transform:scale(1)}}
@keyframes ttpop{0%{opacity:0;transform:scale(.55)}60%{transform:scale(1.14)}100%{opacity:1;transform:scale(1)}}
@keyframes ttfire{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}
@keyframes ttrise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@keyframes ttbarshine{0%{transform:translateX(-120%)}100%{transform:translateX(340%)}}
@keyframes ttwinpop{0%{transform:scale(1)}35%{transform:scale(1.22)}100%{transform:scale(1.08)}}
@keyframes tttrophy{0%{opacity:0;transform:translateY(-14px) scale(.5) rotate(-10deg)}55%{transform:translateY(0) scale(1.18) rotate(5deg)}100%{opacity:1;transform:none}}
@keyframes ttglow{0%,100%{box-shadow:0 14px 40px rgba(0,0,0,.45),0 0 18px rgba(232,160,0,.25)}50%{box-shadow:0 14px 40px rgba(0,0,0,.45),0 0 34px rgba(232,160,0,.55)}}
.tt-title span{color:var(--gold);text-shadow:0 0 26px rgba(232,160,0,.45)}
.tt-deal{animation:ttdeal .4s cubic-bezier(.2,.8,.2,1) both}
.tt-rise{animation:ttrise .42s cubic-bezier(.2,.8,.2,1) both}
.tt-trophy{animation:tttrophy .7s cubic-bezier(.2,.9,.3,1) both}
.tt-shake{animation:ttshake .42s cubic-bezier(.36,.07,.19,.97)}
.tt-board{position:relative}
.tt-seg{display:inline-flex;background:rgba(255,255,255,.04);border:1px solid var(--bdr);border-radius:999px;padding:3px}
.tt-bar{height:5px;border-radius:3px;background:rgba(255,255,255,.08);overflow:hidden;flex:1}
.tt-bar>i{display:block;height:100%;border-radius:3px;transition:width .55s cubic-bezier(.3,.9,.3,1)}
.tt-track{position:relative;height:16px;border-radius:999px;background:linear-gradient(90deg,#2b2620,#262a31);border:1px solid var(--bdr);overflow:hidden}
.tt-track>i{position:absolute;left:0;top:0;bottom:0;border-radius:999px 4px 4px 999px;background:linear-gradient(90deg,#e8a000,#f5c542);box-shadow:0 0 14px rgba(232,160,0,.5);overflow:hidden}
.tt-shine{position:absolute;top:0;bottom:0;width:34%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.55),transparent);animation:ttbarshine 2.4s linear infinite}
.tt-knob{position:absolute;top:50%;width:4px;height:24px;border-radius:3px;background:#fff;transform:translate(-50%,-50%);box-shadow:0 0 8px rgba(0,0,0,.6)}
.tt-fire{color:#ffb24a;font-weight:900;font-size:.8rem;animation:ttfire 1s ease-in-out infinite;text-shadow:0 0 14px rgba(255,140,0,.5)}
.tt-war{color:#c79be6;font-size:.74rem;font-weight:800;border:1px solid rgba(181,138,214,.4);border-radius:999px;padding:2px 9px;background:rgba(181,138,214,.12)}
.tt-clash{position:relative;display:flex;align-items:center;justify-content:center;height:42px;margin:9px 0 2px}
.tt-shock{position:absolute;left:50%;top:50%;width:46px;height:46px;border-radius:50%;border:3px solid #fff;animation:ttshock .6s ease-out forwards;pointer-events:none}
.tt-vs{display:flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:50%;border:2px solid var(--bdr);background:rgba(13,13,13,.85);color:var(--mut);font-weight:900;font-size:1rem;transition:transform .2s,box-shadow .2s,color .2s,border-color .2s;z-index:2}
.tt-vs.on{animation:ttpop .42s cubic-bezier(.2,.9,.3,1) both;font-size:1.25rem}
.tt-sheen{position:absolute;top:0;bottom:0;width:55%;left:0;background:linear-gradient(90deg,transparent,rgba(255,255,255,.18),transparent);pointer-events:none;animation:ttsheen 3.4s ease-in-out infinite;z-index:3}
.tt-spark{position:absolute;width:5px;height:5px;border-radius:50%;background:#fff;box-shadow:0 0 6px #fff,0 0 10px var(--gold);animation:tttwinkle 1.8s ease-in-out infinite;z-index:4;pointer-events:none}
.tt-row{display:flex;align-items:center;gap:9px;padding:9px 12px;border-radius:11px;width:100%;text-align:left;color:var(--txt);font-family:inherit;font-weight:700;font-size:.84rem;border:1px solid var(--bdr);transition:background .14s,border-color .14s,transform .1s}
.tt-row:not(:disabled):hover{background:rgba(255,255,255,.06);border-color:rgba(255,255,255,.18)}
.tt-row:not(:disabled):active{transform:scale(.985)}
.tt-row.lit{border-color:var(--gold);background:rgba(232,160,0,.16)}
@media(prefers-reduced-motion:reduce){
  .tt-deal,.tt-rise,.tt-trophy,.tt-shake,.tt-vs.on,.tt-fire{animation:none}
  .tt-shine,.tt-sheen,.tt-spark,.tt-shock{display:none}
  .tt-bar>i,.tt-track>i,.tt-knob{transition:none}
}`;

const backStyle: React.CSSProperties = { position: "fixed", top: 13, left: 13, zIndex: 50, display: "inline-flex", alignItems: "center", gap: 5, color: "var(--mut)", textDecoration: "none", fontSize: ".78rem", fontWeight: 700, background: "rgba(20,20,20,.6)", border: "1px solid var(--bdr)", borderRadius: 999, padding: "7px 13px", backdropFilter: "blur(8px)" };
const soundStyle: React.CSSProperties = { position: "fixed", top: 13, right: 13, zIndex: 50, width: 38, height: 38, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "1rem", color: "var(--txt)", background: "rgba(20,20,20,.6)", border: "1px solid var(--bdr)", borderRadius: 999, cursor: "pointer", backdropFilter: "blur(8px)" };
function btn(gold: boolean): React.CSSProperties { return { padding: "11px 20px", borderRadius: 12, border: gold ? "none" : "1px solid var(--bdr)", background: gold ? "linear-gradient(135deg,#f5c542,#e8a000)" : "transparent", color: gold ? "#111" : "var(--txt)", fontWeight: 800, fontFamily: "inherit", cursor: "pointer", fontSize: ".88rem", boxShadow: gold ? "0 6px 18px rgba(232,160,0,.35)" : "none" }; }

function Seg({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} style={{ padding: "5px 13px", borderRadius: 999, border: "none", background: active ? "rgba(232,160,0,.18)" : "transparent", color: active ? "var(--gold)" : "var(--mut)", fontWeight: 800, fontFamily: "inherit", cursor: "pointer", fontSize: ".74rem", boxShadow: active ? "inset 0 0 0 1px rgba(232,160,0,.5)" : "none", transition: "background .15s,color .15s" }}>{children}</button>;
}

function StatBar({ frac, color, lit }: { frac: number; color: string; lit?: boolean }) {
  return <span className="tt-bar"><i style={{ width: Math.max(4, Math.min(100, frac * 100)) + "%", background: color, boxShadow: lit ? "0 0 8px rgba(232,160,0,.6)" : "none" }} /></span>;
}

function Sparkles() {
  const pts = [{ top: "8%", left: "12%", d: "0s" }, { top: "18%", left: "84%", d: ".5s" }, { top: "72%", left: "8%", d: "1s" }, { top: "80%", left: "78%", d: "1.4s" }];
  return <>{pts.map((p, i) => <span key={i} className="tt-spark" style={{ top: p.top, left: p.left, animationDelay: p.d }} />)}</>;
}

function PlayerCard({ card, chosen, duel, clash, revealed, yourTurn, onPick, onFire, streak }: { card: Card; chosen: StatKey | null; duel: Duel; clash: boolean; revealed: boolean; yourTurn: boolean; onPick: (k: StatKey) => void; onFire: boolean; streak: number }) {
  const rar = RARITY[card.rarity];
  const fancy = card.rarity !== "common";
  const glow = onFire ? `0 14px 40px rgba(0,0,0,.45), 0 0 ${18 + Math.min(streak, 7) * 4}px rgba(232,160,0,${0.25 + Math.min(streak, 7) * 0.04})` : `0 14px 40px rgba(0,0,0,.4)`;
  return (
    <div className="tt-deal" key={card.id} style={{ position: "relative", background: "var(--s1)", border: "2px solid " + rar.ring, borderRadius: 16, padding: 14, boxShadow: glow, overflow: "hidden", animation: onFire ? "ttdeal .4s cubic-bezier(.2,.8,.2,1) both, ttglow 1.8s ease-in-out infinite" : undefined }}>
      {fancy && <div style={{ position: "absolute", inset: 0, background: rar.grad, pointerEvents: "none" }} />}
      {fancy && <span className="tt-sheen" />}
      {card.rarity === "legendary" && <Sparkles />}
      <div className="flex gap-3" style={{ position: "relative" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={card.poster} alt="" style={{ width: 72, height: 108, objectFit: "cover", borderRadius: 9, flexShrink: 0, background: "var(--s2)", boxShadow: "0 4px 14px rgba(0,0,0,.5)" }} />
        <div className="min-w-0 flex-1">
          <div style={{ fontWeight: 800, fontSize: "1rem", lineHeight: 1.2 }}>{card.title}</div>
          <div style={{ color: "var(--mut)", fontSize: ".78rem", marginTop: 2 }}>{card.year} · {card.genre}</div>
          <div style={{ display: "inline-block", marginTop: 7, fontSize: ".58rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: ".07em", color: rar.ring, border: "1px solid " + rar.ring, borderRadius: 999, padding: "2px 8px" }}>{rar.label} · your card</div>
        </div>
      </div>
      <div className="mt-3 flex flex-col gap-2" style={{ position: "relative" }}>
        {STATS.map((s) => {
          const lit = chosen === s.key;
          const win = lit && clash && duel ? duel.res === "win" : false;
          const lose = lit && clash && duel ? duel.res === "lose" : false;
          const valColor = win ? "#7fd49a" : lose ? "#e8806f" : lit ? "var(--gold)" : "var(--txt)";
          return (
            <button key={s.key} disabled={!yourTurn} onClick={() => onPick(s.key)}
              className={"tt-row" + (lit ? " lit" : "")}
              style={{ background: lit ? "rgba(232,160,0,.16)" : (yourTurn ? "rgba(255,255,255,.03)" : "transparent"), cursor: yourTurn ? "pointer" : "default", opacity: yourTurn || lit ? 1 : .55, animation: lit && !clash ? "ttpulse .8s" : undefined }}>
              <span style={{ width: 18, textAlign: "center" }}>{s.icon}</span>
              <span style={{ width: 64, flexShrink: 0 }}>{s.label}</span>
              <StatBar frac={s.bar(card)} color={win ? "#7fd49a" : lose ? "#e8806f" : lit ? "var(--gold)" : "rgba(255,255,255,.4)"} lit={lit} />
              <span style={{ width: 58, textAlign: "right", fontWeight: 800, color: valColor, display: "inline-block", animation: win && clash ? "ttwinpop .4s cubic-bezier(.2,.9,.3,1) both" : undefined }}>
                {lit && revealed
                  ? <CountStat target={s.val(card)} from={s.from(card)} fmt={s.fmtNum} run />
                  : s.fmtNum(s.val(card))}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FlipCard({ card, faceUp, duel, clash, reduced, owner }: { card?: Card; faceUp: boolean; duel: Duel; clash: boolean; reduced: boolean; owner: string }) {
  if (!card) return null;
  const rar = RARITY[card.rarity];
  const sdef = duel ? STATS.find((s) => s.key === duel.stat)! : null;
  const fancy = card.rarity !== "common";
  const win = clash && duel ? duel.res === "lose" : false;  // CPU wins when player loses
  const lose = clash && duel ? duel.res === "win" : false;
  const valColor = win ? "#7fd49a" : lose ? "#e8806f" : "var(--gold)";
  const hidden: React.CSSProperties = { backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" };
  const frontBorder = win ? "#7fd49a" : lose ? "rgba(232,128,111,.5)" : rar.ring;
  return (
    <div style={{ perspective: 900, minHeight: 96 }}>
      <div style={{ position: "relative", transformStyle: "preserve-3d", transition: reduced ? "none" : "transform .55s cubic-bezier(.3,.9,.3,1)", transform: faceUp ? "rotateY(0)" : "rotateY(180deg)", filter: lose ? "saturate(.6) brightness(.85)" : "none" }}>
        {/* front face (revealed card) */}
        <div style={{ ...hidden, position: "relative", background: "var(--s1)", border: "2px solid " + frontBorder, borderRadius: 14, padding: 12, display: "flex", alignItems: "center", gap: 12, minHeight: 96, overflow: "hidden", boxShadow: win ? "0 0 22px rgba(127,212,154,.45)" : "0 10px 30px rgba(0,0,0,.4)" }}>
          {fancy && <div style={{ position: "absolute", inset: 0, background: rar.grad, pointerEvents: "none" }} />}
          {fancy && <span className="tt-sheen" />}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={card.poster} alt="" style={{ width: 54, height: 81, objectFit: "cover", borderRadius: 7, flexShrink: 0, background: "var(--s2)", position: "relative" }} />
          <div className="min-w-0 flex-1" style={{ position: "relative" }}>
            <div style={{ fontWeight: 800, fontSize: ".92rem", lineHeight: 1.2 }}>{card.title}</div>
            <div style={{ color: "var(--mut)", fontSize: ".74rem" }}>{card.year} · {owner}&apos;s card</div>
            {sdef && <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontWeight: 800, color: valColor, fontSize: ".98rem", display: "inline-block", animation: win && clash ? "ttwinpop .4s cubic-bezier(.2,.9,.3,1) both" : undefined }}>
                {sdef.icon} {faceUp ? <CountStat target={sdef.val(card)} from={sdef.from(card)} fmt={sdef.fmtNum} run /> : sdef.fmtNum(sdef.val(card))}
              </span>
              <StatBar frac={sdef.bar(card)} color={valColor} lit />
            </div>}
          </div>
        </div>
        {/* back face (pre-rotated so it reads correctly when the card is down) */}
        <div style={{ ...hidden, position: "absolute", inset: 0, transform: "rotateY(180deg)", background: "repeating-linear-gradient(45deg,#161616,#161616 10px,#1d1d1d 10px,#1d1d1d 20px)", border: "2px solid var(--bdr)", borderRadius: 14, padding: 12, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 54, height: 81, borderRadius: 7, flexShrink: 0, background: "rgba(232,160,0,.1)", border: "1px solid rgba(232,160,0,.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.6rem", color: "var(--gold)" }}>🃏</div>
          <div><div style={{ fontWeight: 800, fontSize: ".86rem" }}>{owner}&apos;s card</div><div style={{ color: "var(--mut)", fontSize: ".74rem", marginTop: 2 }}>hidden until a stat is picked</div></div>
        </div>
      </div>
    </div>
  );
}
