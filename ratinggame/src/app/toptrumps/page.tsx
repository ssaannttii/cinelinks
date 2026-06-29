"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import HomeIcon from "@/components/HomeIcon";
import { MOVIE_POOL } from "@/lib/movies";
import { api } from "@/lib/base";
import { confetti } from "@/lib/confetti";

// ── Card battle: each movie is a card of stats; pick a stat, higher value wins
// the round and takes both cards. Win the whole deck (or be ahead at the cap). ──

interface Card {
  imdbId: string;
  title: string;
  year: number;
  poster: string;
  imdb: number;     // 0–10
  rt: number;       // 0–100
  meta: number;     // 0–100
  runtime: number;  // minutes
}

type StatKey = "imdb" | "rt" | "meta" | "runtime" | "year";

const STATS: { key: StatKey; label: string; icon: string; val: (c: Card) => number; fmt: (c: Card) => string }[] = [
  { key: "imdb", label: "IMDb rating", icon: "⭐", val: (c) => c.imdb, fmt: (c) => c.imdb.toFixed(1) },
  { key: "rt", label: "Tomatometer", icon: "🍅", val: (c) => c.rt, fmt: (c) => c.rt + "%" },
  { key: "meta", label: "Metascore", icon: "🅼", val: (c) => c.meta, fmt: (c) => String(c.meta) },
  { key: "runtime", label: "Runtime", icon: "⏱️", val: (c) => c.runtime, fmt: (c) => c.runtime + " min" },
  { key: "year", label: "Year (newer wins)", icon: "📅", val: (c) => c.year, fmt: (c) => String(c.year) },
];

const HAND = 8;          // cards per side
const MAX_ROUNDS = 40;   // safety cap — most ahead wins if reached

type Phase = "loading" | "error" | "play" | "reveal" | "over";

function shuffle<T>(a: T[]): T[] {
  const r = a.slice();
  for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; }
  return r;
}

function cpuPick(card: Card): StatKey {
  const norm: Record<StatKey, number> = {
    imdb: card.imdb / 10,
    rt: card.rt / 100,
    meta: card.meta / 100,
    runtime: Math.min(1, card.runtime / 210),
    year: (card.year - 1950) / 80,
  };
  return (Object.keys(norm) as StatKey[]).sort((a, b) => norm[b] - norm[a])[0];
}

export default function TopTrumps() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [player, setPlayer] = useState<Card[]>([]);
  const [cpu, setCpu] = useState<Card[]>([]);
  const [pot, setPot] = useState<Card[]>([]);
  const [turn, setTurn] = useState<"player" | "cpu">("player");
  const [round, setRound] = useState(1);
  const [chosen, setChosen] = useState<StatKey | null>(null);
  const [last, setLast] = useState<{ res: "win" | "lose" | "tie"; label: string; pv: number; cv: number } | null>(null);
  const [won, setWon] = useState(false);
  const cpuTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const deal = useCallback(async () => {
    const order = shuffle(MOVIE_POOL).slice(0, 34);
    const settled = await Promise.all(order.map(async (m) => {
      try {
        const d = await fetch(api("/api/movie?id=" + m.imdbId)).then((r) => r.json());
        const imdb = parseFloat(d.imdbRating);
        const rt = parseInt(String(d.rtRating), 10);
        const meta = parseInt(String(d.metacritic), 10);
        const runtime = parseInt(String(d.runtime), 10);
        const year = parseInt(String(d.year), 10);
        if ([imdb, rt, meta, runtime, year].every((v) => Number.isFinite(v)) && d.poster && d.poster !== "N/A") {
          return { imdbId: m.imdbId, title: d.title, year, poster: d.poster, imdb, rt, meta, runtime } as Card;
        }
      } catch { /* skip */ }
      return null;
    }));
    const cards = settled.filter((c): c is Card => c !== null).slice(0, HAND * 2);
    if (cards.length < HAND * 2) { setPhase("error"); return; }
    const dealt = shuffle(cards);
    setPlayer(dealt.slice(0, HAND));
    setCpu(dealt.slice(HAND, HAND * 2));
    setPot([]); setTurn("player"); setRound(1); setChosen(null); setLast(null); setWon(false);
    setPhase("play");
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- deal() only sets state after an async fetch, not synchronously
  useEffect(() => { deal(); }, [deal]);

  const resolve = useCallback((stat: StatKey) => {
    if (player.length === 0 || cpu.length === 0) return;
    const sdef = STATS.find((s) => s.key === stat)!;
    const pc = player[0], cc = cpu[0];
    const pv = sdef.val(pc), cv = sdef.val(cc);
    setChosen(stat); setPhase("reveal");
    if (cpuTimer.current) clearTimeout(cpuTimer.current);
    cpuTimer.current = setTimeout(() => {
      const spoils = [pc, cc, ...pot];
      let np = player.slice(1), nc = cpu.slice(1), nturn = turn, res: "win" | "lose" | "tie";
      if (pv > cv) { np = [...np, ...shuffle(spoils)]; res = "win"; nturn = "player"; setPot([]); }
      else if (cv > pv) { nc = [...nc, ...shuffle(spoils)]; res = "lose"; nturn = "cpu"; setPot([]); }
      else { res = "tie"; setPot(spoils); }
      setPlayer(np); setCpu(nc); setTurn(nturn);
      setLast({ res, label: sdef.label, pv, cv });
      const ended = np.length === 0 || nc.length === 0 || round >= MAX_ROUNDS;
      if (ended) {
        const w = np.length > nc.length;
        setWon(w); setPhase("over");
        if (w) setTimeout(() => confetti(110), 150);
      } else {
        setRound((r) => r + 1); setChosen(null); setPhase("play");
      }
    }, 1250);
  }, [player, cpu, pot, turn, round]);

  // CPU's turn: auto-pick its strongest stat.
  useEffect(() => {
    if (phase === "play" && turn === "cpu" && cpu.length) {
      const t = setTimeout(() => resolve(cpuPick(cpu[0])), 950);
      return () => clearTimeout(t);
    }
  }, [phase, turn, cpu, resolve]);

  useEffect(() => () => { if (cpuTimer.current) clearTimeout(cpuTimer.current); }, []);

  const back = (
    <a href="https://cinelinks.vercel.app/rating" style={{ position: "fixed", top: 13, left: 13, zIndex: 50, display: "inline-flex", alignItems: "center", gap: 5, color: "var(--mut)", textDecoration: "none", fontSize: ".78rem", fontWeight: 700, background: "rgba(20,20,20,.6)", border: "1px solid var(--bdr)", borderRadius: 999, padding: "7px 13px", backdropFilter: "blur(8px)" }}>
      <HomeIcon /> Rating games
    </a>
  );

  if (phase === "loading") {
    return (<main className="min-h-screen flex items-center justify-center text-center px-4">{back}
      <div style={{ color: "var(--mut)" }}>Dealing the deck…</div></main>);
  }
  if (phase === "error") {
    return (<main className="min-h-screen flex flex-col items-center justify-center text-center px-4 gap-4">{back}
      <div style={{ color: "var(--mut)" }}>Couldn&apos;t deal a full deck. Try again.</div>
      <button onClick={() => { setPhase("loading"); deal(); }} className="px-5 py-3 rounded-xl font-bold" style={{ background: "var(--gold)", color: "#111" }}>Retry</button></main>);
  }

  const pc = player[0], cc = cpu[0];
  const yourTurn = phase === "play" && turn === "player";

  return (
    <main className="min-h-screen px-4 pb-12" style={{ paddingTop: 56, maxWidth: 460, margin: "0 auto" }}>
      {back}
      <div className="text-center">
        <h1 style={{ fontSize: "1.9rem", fontWeight: 800, letterSpacing: "-.02em" }}>Top<span style={{ color: "var(--gold)" }}>Trumps</span></h1>
        <p style={{ color: "var(--mut)", fontSize: ".85rem", marginTop: 2 }}>Pick a stat. Higher wins the cards. Take the whole deck.</p>
      </div>

      {/* scoreboard */}
      <div className="flex items-center justify-center gap-3 my-4" style={{ fontSize: ".82rem", fontWeight: 700 }}>
        <span style={{ color: "var(--gold)" }}>You {player.length}</span>
        <span style={{ color: "var(--mut)" }}>·</span>
        <span style={{ color: "var(--mut)" }}>CPU {cpu.length}</span>
        {pot.length > 0 && <span style={{ color: "#b58ad6" }}>· pot {pot.length}</span>}
      </div>

      {/* CPU card (hidden until reveal) */}
      <Mini card={cc} revealed={phase === "reveal" || phase === "over"} chosen={chosen} owner="cpu" />

      {/* turn / result banner */}
      <div className="text-center my-2" style={{ minHeight: 24, fontSize: ".82rem", fontWeight: 700 }}>
        {phase === "reveal" && last == null && <span style={{ color: "var(--mut)" }}>Comparing…</span>}
        {last && phase !== "over" && (
          <span style={{ color: last.res === "win" ? "#7fd49a" : last.res === "lose" ? "#e8806f" : "var(--mut)" }}>
            {last.res === "win" ? "You won the round! ✓" : last.res === "lose" ? "CPU won the round" : "Tie — pot grows"}
          </span>
        )}
        {phase === "play" && (yourTurn
          ? <span style={{ color: "var(--gold)" }}>Your turn — pick a stat</span>
          : <span style={{ color: "var(--mut)" }}>CPU is choosing…</span>)}
      </div>

      {/* Player card with selectable stats */}
      {pc && (
        <div style={{ background: "var(--s1)", border: "1px solid var(--bdr)", borderRadius: 16, padding: 14, boxShadow: "0 14px 40px rgba(0,0,0,.35)" }}>
          <div className="flex gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={pc.poster} alt="" style={{ width: 70, height: 105, objectFit: "cover", borderRadius: 8, flexShrink: 0, background: "var(--s2)" }} />
            <div className="min-w-0">
              <div style={{ fontWeight: 800, fontSize: ".98rem", lineHeight: 1.2 }}>{pc.title}</div>
              <div style={{ color: "var(--mut)", fontSize: ".8rem", marginTop: 2 }}>{pc.year}</div>
              <div style={{ color: "var(--gold)", fontSize: ".66rem", fontWeight: 700, marginTop: 8, textTransform: "uppercase", letterSpacing: ".08em" }}>Your card</div>
            </div>
          </div>
          <div className="mt-3 flex flex-col gap-2">
            {STATS.map((s) => {
              const lit = chosen === s.key;
              return (
                <button key={s.key} disabled={!yourTurn} onClick={() => resolve(s.key)}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                    padding: "10px 13px", borderRadius: 11, textAlign: "left", width: "100%",
                    border: "1px solid " + (lit ? "var(--gold)" : "var(--bdr)"),
                    background: lit ? "rgba(232,160,0,.16)" : (yourTurn ? "rgba(255,255,255,.03)" : "transparent"),
                    color: "var(--txt)", fontFamily: "inherit", fontWeight: 700, fontSize: ".88rem",
                    cursor: yourTurn ? "pointer" : "default", opacity: yourTurn || lit ? 1 : 0.6,
                    transition: "background .12s, border-color .12s",
                  }}>
                  <span><span style={{ marginRight: 8 }}>{s.icon}</span>{s.label}</span>
                  <span style={{ color: lit ? "var(--gold)" : "var(--txt)", fontWeight: 800 }}>{s.fmt(pc)}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {phase === "over" && (
        <div className="text-center mt-6" style={{ animation: "slideUp .35s ease both" }}>
          <div style={{ fontSize: "1.6rem", fontWeight: 900, color: won ? "#7fd49a" : "#e8806f" }}>{won ? "You win! 🏆" : "CPU wins"}</div>
          <div style={{ color: "var(--mut)", fontSize: ".85rem", margin: "6px 0 16px" }}>Final deck — You {player.length} · CPU {cpu.length}</div>
          <button onClick={() => { setPhase("loading"); deal(); }} className="px-6 py-3 rounded-xl font-bold" style={{ background: "var(--gold)", color: "#111", border: "none", cursor: "pointer" }}>Play again</button>
        </div>
      )}

      <div className="text-center" style={{ marginTop: 26, color: "var(--mut)", fontSize: ".7rem" }}>
        Data by <a href="https://www.omdbapi.com/" target="_blank" rel="noopener" style={{ color: "inherit" }}>OMDb</a> · part of <a href="https://cinelinks.vercel.app" style={{ color: "var(--gold)", textDecoration: "none" }}>CineLinks</a>
      </div>
    </main>
  );
}

function Mini({ card, revealed, chosen, owner }: { card?: Card; revealed: boolean; chosen: StatKey | null; owner: "cpu" }) {
  if (!card) return null;
  const sdef = chosen ? STATS.find((s) => s.key === chosen)! : null;
  return (
    <div style={{ background: "var(--s1)", border: "1px solid var(--bdr)", borderRadius: 14, padding: 12, display: "flex", alignItems: "center", gap: 12, minHeight: 92 }}>
      {revealed ? (<>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={card.poster} alt="" style={{ width: 52, height: 78, objectFit: "cover", borderRadius: 7, flexShrink: 0, background: "var(--s2)" }} />
        <div className="min-w-0 flex-1">
          <div style={{ fontWeight: 800, fontSize: ".9rem", lineHeight: 1.2 }}>{card.title}</div>
          <div style={{ color: "var(--mut)", fontSize: ".76rem" }}>{card.year} · CPU&apos;s card</div>
          {sdef && <div style={{ marginTop: 6, fontWeight: 800, color: "var(--gold)", fontSize: ".95rem" }}>{sdef.icon} {sdef.label}: {sdef.fmt(card)}</div>}
        </div>
      </>) : (
        <div className="flex items-center gap-3" style={{ color: "var(--mut)" }}>
          <div style={{ width: 52, height: 78, borderRadius: 7, flexShrink: 0, background: "repeating-linear-gradient(45deg,#1c1c1c,#1c1c1c 8px,#232323 8px,#232323 16px)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.4rem", color: "var(--gold)" }}>?</div>
          <div style={{ fontSize: ".84rem", fontWeight: 700 }}>CPU&apos;s card<div style={{ color: "var(--mut)", fontWeight: 400, fontSize: ".74rem", marginTop: 2 }}>hidden until you pick</div></div>
        </div>
      )}
      <span aria-hidden style={{ display: "none" }}>{owner}</span>
    </div>
  );
}
