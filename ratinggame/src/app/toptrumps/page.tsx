"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import HomeIcon from "@/components/HomeIcon";
import { TRUMP_POOL, type TrumpTuple } from "@/lib/trumps-pool";
import { confetti } from "@/lib/confetti";

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
const RARITY: Record<Card["rarity"], { label: string; ring: string; glow: string }> = {
  legendary: { label: "Legendary", ring: "#e8c24a", glow: "rgba(232,194,74,.5)" },
  elite: { label: "Elite", ring: "#b58ad6", glow: "rgba(181,138,214,.45)" },
  rare: { label: "Rare", ring: "#7aa6e8", glow: "rgba(122,166,232,.4)" },
  common: { label: "Common", ring: "rgba(255,255,255,.18)", glow: "rgba(255,255,255,.12)" },
};

function toCard(t: TrumpTuple): Card {
  return { id: t[0], title: t[1], year: t[2], poster: IMG + t[3], rating: t[4], votes: t[5], revenue: t[6], budget: t[7], runtime: t[8], genre: t[9], rarity: rarityOf(t[4]) };
}

// pool maxima for the strength bars
const MAX = TRUMP_POOL.reduce((m, t) => ({
  votes: Math.max(m.votes, t[5]), revenue: Math.max(m.revenue, t[6]), budget: Math.max(m.budget, t[7]), runtime: Math.max(m.runtime, t[8]),
}), { votes: 1, revenue: 1, budget: 1, runtime: 1 });

function money(n: number): string { return n >= 1e9 ? "$" + (n / 1e9).toFixed(1) + "B" : n >= 1e6 ? "$" + Math.round(n / 1e6) + "M" : "$" + Math.round(n / 1e3) + "k"; }
function votesFmt(n: number): string { return n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1) + "k" : String(n); }
function runFmt(n: number): string { const h = Math.floor(n / 60), m = n % 60; return h ? h + "h " + m + "m" : m + "m"; }

const STATS: { key: StatKey; label: string; icon: string; val: (c: Card) => number; fmt: (c: Card) => string; bar: (c: Card) => number }[] = [
  { key: "rating", label: "Rating", icon: "⭐", val: (c) => c.rating, fmt: (c) => c.rating.toFixed(1), bar: (c) => c.rating / 10 },
  { key: "votes", label: "Fame", icon: "🔥", val: (c) => c.votes, fmt: (c) => votesFmt(c.votes), bar: (c) => Math.log10(c.votes + 1) / Math.log10(MAX.votes + 1) },
  { key: "revenue", label: "Box office", icon: "💰", val: (c) => c.revenue, fmt: (c) => money(c.revenue), bar: (c) => Math.log10(c.revenue + 1) / Math.log10(MAX.revenue + 1) },
  { key: "budget", label: "Budget", icon: "💵", val: (c) => c.budget, fmt: (c) => money(c.budget), bar: (c) => Math.log10(c.budget + 1) / Math.log10(MAX.budget + 1) },
  { key: "runtime", label: "Runtime", icon: "⏱️", val: (c) => c.runtime, fmt: (c) => runFmt(c.runtime), bar: (c) => Math.min(1, c.runtime / 210) },
  { key: "year", label: "Year", icon: "📅", val: (c) => c.year, fmt: (c) => String(c.year), bar: (c) => (c.year - 1950) / (new Date().getFullYear() - 1950) },
];

const HAND = 8;
const MAX_ROUNDS = 40;
type Phase = "play" | "reveal" | "over";
type Mode = "daily" | "practice";
type Diff = "normal" | "hard";

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
  // hard always plays its best; normal sometimes (70%) plays best, else 2nd
  if (diff === "hard" || Math.random() < 0.7) return scored[0].k;
  return scored[1].k;
}
function vibrate(ms: number | number[]) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch { /* noop */ } }

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
  const [last, setLast] = useState<{ res: "win" | "lose" | "tie"; pv: number; cv: number } | null>(null);
  const [streak, setStreak] = useState(0);
  const [won, setWon] = useState(false);
  const [dailyLocked, setDailyLocked] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const newGame = useCallback((m: Mode) => {
    if (timer.current) clearTimeout(timer.current);
    const deck = buildDeck(m);
    setPlayer(deck.slice(0, HAND)); setCpu(deck.slice(HAND, HAND * 2));
    setPot([]); setTurn("player"); setRound(1); setChosen(null); setLast(null); setStreak(0); setWon(false); setRevealed(false);
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
        localStorage.setItem("cinerating_daily", JSON.stringify({ ...cur, date: todayKey() })); // counts toward the rating-daily streak slot
      } catch { /* noop */ }
      setDailyLocked(true);
    }
    if (w) { vibrate([20, 40, 20]); setTimeout(() => confetti(120), 150); } else vibrate(60);
  }, [mode]);

  const resolve = useCallback((stat: StatKey) => {
    if (phase !== "play" || !player.length || !cpu.length) return;
    const sdef = STATS.find((s) => s.key === stat)!;
    const pc = player[0], cc = cpu[0];
    const pv = sdef.val(pc), cv = sdef.val(cc);
    setChosen(stat); setRevealed(true); setPhase("reveal"); vibrate(12);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const rnd = Math.random;
      const spoils = shuffle([pc, cc, ...pot], rnd);
      let np = player.slice(1), nc = cpu.slice(1), nturn = turn, res: "win" | "lose" | "tie", nstreak = streak;
      if (pv > cv) { np = [...np, ...spoils]; res = "win"; nturn = "player"; nstreak = streak + 1; setPot([]); vibrate(25); }
      else if (cv > pv) { nc = [...nc, ...spoils]; res = "lose"; nturn = "cpu"; nstreak = 0; setPot([]); vibrate([15, 30]); }
      else { res = "tie"; setPot(spoils); }
      setPlayer(np); setCpu(nc); setTurn(nturn); setStreak(nstreak); setLast({ res, pv, cv });
      if (np.length === 0 || nc.length === 0 || round >= MAX_ROUNDS) { finish(np, nc); }
      else { setRound((r) => r + 1); setRevealed(false); setChosen(null); setPhase("play"); }
    }, 1400);
  }, [phase, player, cpu, pot, turn, round, streak, finish]);

  useEffect(() => {
    if (phase === "play" && turn === "cpu" && cpu.length) {
      const t = setTimeout(() => resolve(cpuPick(cpu[0], diff)), 950);
      return () => clearTimeout(t);
    }
  }, [phase, turn, cpu, diff, resolve]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const reduced = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const pc = player[0], cc = cpu[0];
  const yourTurn = phase === "play" && turn === "player";
  const showCpu = revealed || phase === "over";

  function share() {
    const s = `🃏 Top Trumps${mode === "daily" ? " #" + (dayNum() - 20000) : ""} — ${won ? "won" : "lost"} ${player.length}–${cpu.length} vs CPU\ncinelinks.vercel.app/rating/toptrumps`;
    if (navigator.share) navigator.share({ text: s }).catch(() => {});
    else if (navigator.clipboard) navigator.clipboard.writeText(s).catch(() => {});
  }

  return (
    <main style={{ maxWidth: 460, margin: "0 auto", padding: "52px 14px 40px" }}>
      <style>{`
        @keyframes ttflip{from{transform:rotateY(180deg)}to{transform:rotateY(0)}}
        @keyframes ttdeal{from{opacity:0;transform:translateY(14px) scale(.97)}to{opacity:1;transform:none}}
        @keyframes ttpulse{0%,100%{box-shadow:0 0 0 0 rgba(232,160,0,0)}50%{box-shadow:0 0 0 3px rgba(232,160,0,.35)}}
        .tt-deal{animation:ttdeal .34s cubic-bezier(.2,.8,.2,1) both}
        .tt-bar{height:5px;border-radius:3px;background:rgba(255,255,255,.08);overflow:hidden;flex:1}
        .tt-bar>i{display:block;height:100%;border-radius:3px;transition:width .5s cubic-bezier(.3,.9,.3,1)}
        @media(prefers-reduced-motion:reduce){.tt-deal{animation:none}.tt-bar>i{transition:none}}
      `}</style>

      <a href="https://cinelinks.vercel.app/rating" style={backStyle}><HomeIcon /> Rating games</a>

      <div className="text-center">
        <h1 style={{ fontSize: "1.9rem", fontWeight: 800, letterSpacing: "-.02em" }}>Top<span style={{ color: "var(--gold)" }}>Trumps</span></h1>
        <p style={{ color: "var(--mut)", fontSize: ".82rem", marginTop: 2 }}>Pick a stat. Higher wins the cards. Take the deck.</p>
      </div>

      {/* mode + difficulty */}
      <div className="flex items-center justify-center gap-2 mt-3" style={{ fontSize: ".74rem" }}>
        <Seg active={mode === "daily"} onClick={() => { setMode("daily"); newGame("daily"); }}>Daily</Seg>
        <Seg active={mode === "practice"} onClick={() => { setMode("practice"); newGame("practice"); }}>Practice</Seg>
        <span style={{ width: 1, height: 18, background: "var(--bdr)" }} />
        <Seg active={diff === "normal"} onClick={() => setDiff("normal")}>Normal</Seg>
        <Seg active={diff === "hard"} onClick={() => setDiff("hard")}>Hard</Seg>
      </div>

      {/* scoreboard with pile thickness */}
      <div className="flex items-center justify-between my-4">
        <Pile label="You" n={player.length} color="var(--gold)" />
        <div className="text-center" style={{ minWidth: 90 }}>
          {streak > 1 && <div style={{ color: "#7fd49a", fontWeight: 800, fontSize: ".8rem" }}>🔥 {streak} in a row</div>}
          {pot.length > 0 && <div style={{ color: "#b58ad6", fontSize: ".74rem", fontWeight: 700 }}>WAR · pot {pot.length}</div>}
          <div style={{ color: "var(--mut)", fontSize: ".66rem" }}>round {round}</div>
        </div>
        <Pile label="CPU" n={cpu.length} color="#9aa3b2" right />
      </div>

      {/* CPU card */}
      <FlipCard card={cc} faceUp={showCpu} chosen={chosen} reduced={reduced} owner="CPU" />

      {/* banner */}
      <div className="text-center my-2" style={{ minHeight: 22, fontSize: ".82rem", fontWeight: 700 }}>
        {last && (
          <span style={{ color: last.res === "win" ? "#7fd49a" : last.res === "lose" ? "#e8806f" : "var(--mut)" }}>
            {last.res === "win" ? "✓ You won the round" : last.res === "lose" ? "✗ CPU won the round" : "= Tie — pot grows"}
          </span>
        )}
        {phase === "play" && (yourTurn
          ? <span style={{ color: "var(--gold)" }}>{last ? " · " : ""}Your turn — pick a stat</span>
          : <span style={{ color: "var(--mut)" }}>{last ? " · " : ""}CPU choosing…</span>)}
      </div>

      {/* Player card */}
      {pc && <PlayerCard card={pc} chosen={chosen} yourTurn={yourTurn} onPick={resolve} />}

      {phase === "over" && (
        <div className="text-center mt-6 tt-deal">
          <div style={{ fontSize: "1.6rem", fontWeight: 900, color: won ? "#7fd49a" : "#e8806f" }}>{won ? "You win! 🏆" : "CPU wins"}</div>
          <div style={{ color: "var(--mut)", fontSize: ".85rem", margin: "6px 0 16px" }}>Final deck — You {player.length} · CPU {cpu.length}</div>
          <div className="flex gap-2 justify-center">
            <button onClick={share} style={btn(false)}>Share</button>
            {mode === "daily" && dailyLocked
              ? <button onClick={() => { setMode("practice"); newGame("practice"); }} style={btn(true)}>Practice</button>
              : <button onClick={() => newGame(mode)} style={btn(true)}>{mode === "daily" ? "Replay" : "New deck"}</button>}
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

const backStyle: React.CSSProperties = { position: "fixed", top: 13, left: 13, zIndex: 50, display: "inline-flex", alignItems: "center", gap: 5, color: "var(--mut)", textDecoration: "none", fontSize: ".78rem", fontWeight: 700, background: "rgba(20,20,20,.6)", border: "1px solid var(--bdr)", borderRadius: 999, padding: "7px 13px", backdropFilter: "blur(8px)" };
function btn(gold: boolean): React.CSSProperties { return { padding: "11px 20px", borderRadius: 12, border: gold ? "none" : "1px solid var(--bdr)", background: gold ? "var(--gold)" : "transparent", color: gold ? "#111" : "var(--txt)", fontWeight: 800, fontFamily: "inherit", cursor: "pointer", fontSize: ".88rem" }; }

function Seg({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} style={{ padding: "5px 12px", borderRadius: 999, border: "1px solid " + (active ? "rgba(232,160,0,.5)" : "var(--bdr)"), background: active ? "rgba(232,160,0,.16)" : "transparent", color: active ? "var(--gold)" : "var(--mut)", fontWeight: 700, fontFamily: "inherit", cursor: "pointer", fontSize: ".74rem" }}>{children}</button>;
}

function Pile({ label, n, color, right }: { label: string; n: number; color: string; right?: boolean }) {
  const layers = Math.min(6, Math.max(1, Math.ceil(n / 3)));
  return (
    <div style={{ textAlign: right ? "right" : "left" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 2, alignItems: right ? "flex-end" : "flex-start", marginBottom: 4 }}>
        {Array.from({ length: layers }).map((_, i) => <span key={i} style={{ display: "block", width: 34 - i * 1.5, height: 3, borderRadius: 2, background: color, opacity: 0.35 + i * 0.1 }} />)}
      </div>
      <div style={{ fontWeight: 800, fontSize: ".9rem", color }}>{label} {n}</div>
    </div>
  );
}

function StatBar({ frac, color }: { frac: number; color: string }) {
  return <span className="tt-bar"><i style={{ width: Math.max(4, Math.min(100, frac * 100)) + "%", background: color }} /></span>;
}

function PlayerCard({ card, chosen, yourTurn, onPick }: { card: Card; chosen: StatKey | null; yourTurn: boolean; onPick: (k: StatKey) => void }) {
  const rar = RARITY[card.rarity];
  return (
    <div className="tt-deal" key={card.id} style={{ background: "var(--s1)", border: "2px solid " + rar.ring, borderRadius: 16, padding: 14, boxShadow: `0 14px 40px rgba(0,0,0,.4), 0 0 0 0 ${rar.glow}` }}>
      <div className="flex gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={card.poster} alt="" style={{ width: 72, height: 108, objectFit: "cover", borderRadius: 9, flexShrink: 0, background: "var(--s2)" }} />
        <div className="min-w-0 flex-1">
          <div style={{ fontWeight: 800, fontSize: "1rem", lineHeight: 1.2 }}>{card.title}</div>
          <div style={{ color: "var(--mut)", fontSize: ".78rem", marginTop: 2 }}>{card.year} · {card.genre}</div>
          <div style={{ display: "inline-block", marginTop: 7, fontSize: ".58rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: ".07em", color: rar.ring, border: "1px solid " + rar.ring, borderRadius: 999, padding: "2px 8px" }}>{rar.label} · your card</div>
        </div>
      </div>
      <div className="mt-3 flex flex-col gap-2">
        {STATS.map((s) => {
          const lit = chosen === s.key;
          return (
            <button key={s.key} disabled={!yourTurn} onClick={() => onPick(s.key)}
              style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 12px", borderRadius: 11, width: "100%", textAlign: "left",
                border: "1px solid " + (lit ? "var(--gold)" : "var(--bdr)"), background: lit ? "rgba(232,160,0,.16)" : (yourTurn ? "rgba(255,255,255,.03)" : "transparent"),
                color: "var(--txt)", fontFamily: "inherit", fontWeight: 700, fontSize: ".84rem", cursor: yourTurn ? "pointer" : "default", opacity: yourTurn || lit ? 1 : .6,
                animation: lit ? "ttpulse .8s" : undefined, transition: "background .12s,border-color .12s" }}>
              <span style={{ width: 18, textAlign: "center" }}>{s.icon}</span>
              <span style={{ width: 64, flexShrink: 0 }}>{s.label}</span>
              <StatBar frac={s.bar(card)} color={lit ? "var(--gold)" : "rgba(255,255,255,.4)"} />
              <span style={{ width: 58, textAlign: "right", fontWeight: 800, color: lit ? "var(--gold)" : "var(--txt)" }}>{s.fmt(card)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FlipCard({ card, faceUp, chosen, reduced, owner }: { card?: Card; faceUp: boolean; chosen: StatKey | null; reduced: boolean; owner: string }) {
  if (!card) return null;
  const rar = RARITY[card.rarity];
  const sdef = chosen ? STATS.find((s) => s.key === chosen)! : null;
  return (
    <div style={{ perspective: 800, minHeight: 96 }}>
      <div style={{ position: "relative", transformStyle: "preserve-3d", transition: reduced ? "none" : "transform .5s cubic-bezier(.3,.9,.3,1)", transform: faceUp ? "rotateY(0)" : "rotateY(180deg)" }}>
        {faceUp ? (
          <div style={{ background: "var(--s1)", border: "2px solid " + rar.ring, borderRadius: 14, padding: 12, display: "flex", alignItems: "center", gap: 12, minHeight: 96 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={card.poster} alt="" style={{ width: 54, height: 81, objectFit: "cover", borderRadius: 7, flexShrink: 0, background: "var(--s2)" }} />
            <div className="min-w-0 flex-1">
              <div style={{ fontWeight: 800, fontSize: ".92rem", lineHeight: 1.2 }}>{card.title}</div>
              <div style={{ color: "var(--mut)", fontSize: ".74rem" }}>{card.year} · {owner}&apos;s card</div>
              {sdef && <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontWeight: 800, color: "var(--gold)", fontSize: ".95rem" }}>{sdef.icon} {sdef.fmt(card)}</span>
                <StatBar frac={sdef.bar(card)} color="var(--gold)" />
              </div>}
            </div>
          </div>
        ) : (
          <div style={{ background: "repeating-linear-gradient(45deg,#161616,#161616 10px,#1d1d1d 10px,#1d1d1d 20px)", border: "2px solid var(--bdr)", borderRadius: 14, padding: 12, display: "flex", alignItems: "center", gap: 12, minHeight: 96 }}>
            <div style={{ width: 54, height: 81, borderRadius: 7, flexShrink: 0, background: "rgba(232,160,0,.1)", border: "1px solid rgba(232,160,0,.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.6rem", color: "var(--gold)" }}>🃏</div>
            <div><div style={{ fontWeight: 800, fontSize: ".86rem" }}>{owner}&apos;s card</div><div style={{ color: "var(--mut)", fontSize: ".74rem", marginTop: 2 }}>hidden until you pick a stat</div></div>
          </div>
        )}
      </div>
    </div>
  );
}
