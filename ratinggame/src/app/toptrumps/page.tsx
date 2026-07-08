"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import HomeIcon from "@/components/HomeIcon";
import { TRUMP_POOL, type TrumpTuple } from "@/lib/trumps-pool";
import { confetti } from "@/lib/confetti";
import { Sfx } from "@/lib/sfx";
import { madridDayKey, markRatingDaily } from "@/lib/daily";

// ── Movie card battle vs CPU. Baked TMDB stats (instant, every field present). ──

const IMG = "https://image.tmdb.org/t/p/w342";

interface Card {
  id: number; title: string; year: number; poster: string; genre: string;
  rating: number; votes: number; revenue: number; budget: number; runtime: number;
  rarity: "common" | "rare" | "elite" | "legendary";
  owned?: boolean;      // came from YOUR CineLinks collection (rarity shown is the one you earned)
  mastery?: number;     // collection copies tier (×3=1, ×5=2, ×10=3) — masters win ties
  loaner?: boolean;     // house card lent to fill the hand until you collect more
  shine?: boolean;      // Shined in the collection — once per match, re-pick after a losing duel
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

// ── Collection bridge: your CineLinks cards ARE your deck ──
// Same origin through the /rating/* proxy, so the shared collection blob is right
// there in localStorage. Owned cards keep the rarity you EARNED (floors, bumps,
// pity) rather than the pool's rating-derived tier, and carry their mastery.
const TRUMP_MAP = new Map(TRUMP_POOL.map((t) => [t[0], t]));
type OwnedRec = { t: TrumpTuple; rarity: Card["rarity"]; mastery: number; shine: boolean };
function readOwned(): OwnedRec[] {
  try {
    const blob = JSON.parse(localStorage.getItem("cl_collection") || "null");
    if (!blob || !blob.cards) return [];
    const out: OwnedRec[] = [];
    for (const k of Object.keys(blob.cards)) {
      const c = blob.cards[k];
      if (!c || c.type !== "movie") continue;
      const t = TRUMP_MAP.get(+c.id);
      if (!t) continue;
      const n = c.n || 1;
      const rar: Card["rarity"] = (["common", "rare", "elite", "legendary"] as const).includes(c.rarity) ? c.rarity : rarityOf(t[4]);
      out.push({ t, rarity: rar, mastery: n >= 10 ? 3 : n >= 5 ? 2 : n >= 3 ? 1 : 0, shine: !!c.shine });
    }
    out.sort((a, b) => a.t[0] - b.t[0]);   // stable base order → deterministic daily shuffle
    return out;
  } catch { return []; }
}

// Deal both hands. Yours is built from your collection first (owned cards, earned
// rarity, mastery); "loaner" house cards fill the gaps until you collect more.
// The CPU never draws a card that's in your hand.
function buildDecks(m: Mode): { mine: Card[]; theirs: Card[]; ownedN: number } {
  const rnd = m === "daily" ? mulberry(dayNum() * 2654435761) : mulberry((Math.random() * 1e9) | 0);
  const owned = shuffle(readOwned(), rnd).slice(0, HAND);
  const mineOwned = owned.map((o) => ({ ...toCard(o.t), owned: true, rarity: o.rarity, mastery: o.mastery, shine: o.shine }));
  const used = new Set(mineOwned.map((c) => c.id));
  const rest = shuffle(TRUMP_POOL.filter((t) => !used.has(t[0])), rnd);
  const loaners = rest.slice(0, HAND - mineOwned.length).map((t) => ({ ...toCard(t), loaner: true }));
  const mine = shuffle([...mineOwned, ...loaners], rnd);
  const theirs = rest.slice(HAND - mineOwned.length, HAND - mineOwned.length + HAND).map(toCard);
  return { mine, theirs, ownedN: mineOwned.length };
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
  // "Value" = return on budget (revenue/budget). A cheap hit crushes a bloated
  // blockbuster here, so small/cult cards finally win an axis. Guards budget=0.
  { key: "budget", label: "Value", icon: "💎", val: (c) => (c.budget > 0 ? c.revenue / c.budget : 0), fmtNum: (n) => (n > 0 ? n.toFixed(1) + "×" : "—"), bar: (c) => Math.min(1, (c.budget > 0 ? c.revenue / c.budget : 0) / 8), from: () => 0 },
  { key: "runtime", label: "Runtime", icon: "⏱️", val: (c) => c.runtime, fmtNum: (n) => runFmt(n), bar: (c) => Math.min(1, c.runtime / 210), from: () => 0 },
  // "Vintage" = age. Older wins, so classics beat modern tentpoles on this axis.
  { key: "year", label: "Vintage", icon: "📼", val: (c) => new Date().getFullYear() - c.year, fmtNum: (n) => Math.round(n) + " yrs", bar: (c) => Math.min(1, (new Date().getFullYear() - c.year) / 75), from: () => 0 },
];

const HAND = 8;
const MAX_ROUNDS = 40;
type Phase = "deal" | "play" | "reveal" | "over";
type Mode = "daily" | "practice";
type Res = "win" | "lose" | "tie";
type Duel = { stat: StatKey; pv: number; cv: number; res: Res; tb?: boolean } | null;

function shuffle<T>(a: T[], rnd: () => number): T[] {
  const r = a.slice();
  for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; }
  return r;
}
function mulberry(seed: number) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function dayNum() { const n = new Date(); return Math.floor(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()) / 86400000); }
const todayKey = madridDayKey;   // suite dailies roll over on Madrid midnight, not UTC

function cpuPick(card: Card): StatKey {
  const scored = STATS.map((s) => ({ k: s.key, b: s.bar(card) }));
  scored.sort((a, b) => b.b - a.b);
  // Beatable but competent: usually plays its strongest stat, sometimes its 2nd.
  return Math.random() < 0.7 ? scored[0].k : scored[1].k;
}
function vibrate(ms: number | number[]) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch { /* noop */ } }
const resColor = (r: Res) => (r === "win" ? "#7fd49a" : r === "lose" ? "#e8806f" : "#b58ad6");
// streak "charge" ramp: the board aura + mult badge heat up as the run grows
const AURA = ["transparent", "rgba(232,160,0,.18)", "rgba(255,140,0,.24)", "rgba(255,80,20,.30)", "rgba(255,40,30,.36)"];

export default function TopTrumps() {
  const [mode, setMode] = useState<Mode>("daily");
  const [howto, setHowto] = useState(false);
  const [prize, setPrize] = useState<string | null>(null);   // card banked into the Vault this game
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
  const [ownedN, setOwnedN] = useState(0);   // how many of your hand came from your collection
  const [rivalTag, setRivalTag] = useState<string | null>(null);   // battling a recorded human deck
  const [rivalMsg, setRivalMsg] = useState<string | null>(null);
  const postedRef = useRef(false);           // deck published to the rival pool once per day
  const shineUsedRef = useRef(false);        // the Shine save is once per match
  const settleRef = useRef<(() => void) | null>(null);
  const [shineOffer, setShineOffer] = useState<StatKey | null>(null);
  const [banned, setBanned] = useState<StatKey | null>(null);   // the stat you just lost with (can't re-pick it)
  const [revealed, setRevealed] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [wide, setWide] = useState(false);   // desktop face-off layout
  const [sound, setSound] = useState(true);
  const [intel, setIntel] = useState(3);      // tactical resource: spend to Peek / Swap
  const [peeked, setPeeked] = useState(false); // this duel's rival card is fully scouted
  const [seenIds, setSeenIds] = useState<number[]>([]); // rival cards revealed so far (deck tracker)
  const [trackSel, setTrackSel] = useState<number | null>(null); // expanded card in the tracker

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const initHandRef = useRef<Set<number>>(new Set());   // your dealt hand — cards beyond it were captured in battle
  const myDeckRef = useRef<Card[]>([]);      // your starting 8 (fixed) — for the hand viewer
  const rivalDeckRef = useRef<Card[]>([]);   // rival's starting 8 (fixed) — scouting is tracked against this
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
    // desktop face-off layout, kept in sync on resize
    const mq = window.matchMedia("(min-width: 920px)");
    const sync = () => setWide(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // ── juice helpers (refs/setState only → stable) ──
  const triggerShake = useCallback((power = 1) => {
    if (reducedRef.current) return;
    const el = boardRef.current; if (!el) return;
    el.style.setProperty("--amp", String(Math.min(power, 3)));   // shake grows with the streak
    el.classList.remove("tt-shake"); void el.offsetWidth; el.classList.add("tt-shake");
  }, []);

  // Balatro-style score pop: a big "+N" that leaps out of the clash and fades.
  const scorePop = useCallback((n: number, color: string) => {
    if (reducedRef.current || typeof document === "undefined") return;
    const o = clashRef.current?.getBoundingClientRect(); if (!o) return;
    const el = document.createElement("div");
    el.textContent = "+" + n;
    el.style.cssText = `position:fixed;left:${o.left + o.width / 2}px;top:${o.top + o.height / 2}px;font-weight:900;font-size:${Math.min(2.8, 1.5 + n * 0.14)}rem;color:${color};text-shadow:0 2px 10px rgba(0,0,0,.7),0 0 22px ${color};z-index:9999;pointer-events:none;font-family:inherit`;
    document.body.appendChild(el);
    el.animate([
      { transform: "translate(-50%,-40%) scale(.5)", opacity: 0 },
      { transform: "translate(-50%,-95%) scale(1.18)", opacity: 1, offset: 0.28 },
      { transform: "translate(-50%,-175%) scale(1)", opacity: 0 },
    ], { duration: 920, easing: "cubic-bezier(.2,.8,.2,1)" }).onfinish = () => el.remove();
  }, []);

  // quick full-board colour wash on a resolve (green win / red loss) — the punch.
  const boardFlash = useCallback((color: string) => {
    if (reducedRef.current) return;
    const el = boardRef.current; if (!el) return;
    const f = document.createElement("div");
    f.style.cssText = `position:absolute;inset:0;border-radius:16px;background:${color};opacity:0;pointer-events:none;z-index:6;mix-blend-mode:screen`;
    el.appendChild(f);
    f.animate([{ opacity: 0 }, { opacity: 0.55, offset: 0.12 }, { opacity: 0 }], { duration: 440, easing: "ease-out" }).onfinish = () => f.remove();
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
    const { mine, theirs, ownedN: on } = buildDecks(m);
    initHandRef.current = new Set(mine.map((c) => c.id));
    myDeckRef.current = mine; rivalDeckRef.current = theirs;
    setOwnedN(on);
    setPlayer(mine); setCpu(theirs);
    setPot([]); setTurn("player"); setRound(1); setChosen(null); setDuel(null); setClash(false);
    setStreak(0); setBest(0); setWon(false); setRevealed(false);
    setRivalTag(null); setRivalMsg(null); setPrize(null);
    shineUsedRef.current = false; settleRef.current = null; setShineOffer(null); setBanned(null);
    setIntel(3); setPeeked(false); setSeenIds([]); setTrackSel(null);
    setPhase("deal");
    if (m === "daily") {
      try { const s = JSON.parse(localStorage.getItem("toptrumps_daily") || "null"); setDailyLocked(!!(s && s.date === todayKey())); } catch { setDailyLocked(false); }
    } else setDailyLocked(false);
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time deal on mount
  useEffect(() => {
    let m: Mode = "daily";
    try { if (new URLSearchParams(window.location.search).get("mode") === "practice") m = "practice"; } catch { /* noop */ }
    setMode(m); newGame(m);
  }, [newGame]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- surface the rules once, on first visit
  useEffect(() => { try { if (!localStorage.getItem("tt_seen_howto")) setHowto(true); } catch { /* noop */ } }, []);
  const closeHowto = () => { setHowto(false); try { localStorage.setItem("tt_seen_howto", "1"); } catch { /* noop */ } };
  const startBattle = useCallback(() => { Sfx.select(); setPhase("play"); }, []);
  // Top Trumps is the arena for your Vault: open the collection in-place (collection.js
  // is loaded app-wide). Falls back to the CineLinks home if it isn't ready.
  const openVault = () => {
    try { if (window.Collection?.openGallery) { Sfx.select(); window.Collection.openGallery(); return; } } catch { /* noop */ }
    window.location.href = "https://cinelinks.vercel.app";
  };

  const finish = useCallback((np: Card[], nc: Card[]) => {
    const w = np.length >= nc.length;
    setWon(w); setPhase("over");
    if (mode === "daily") {
      try {
        localStorage.setItem("toptrumps_daily", JSON.stringify({ date: todayKey(), won: w, mine: np.length, cpu: nc.length }));
        markRatingDaily("toptrumps");
      } catch { /* noop */ }
      setDailyLocked(true);
      // Publish today's deck to the rival pool (async PvP): someone else can now
      // battle YOUR cards. Fire-and-forget; 404s harmlessly in standalone dev.
      try {
        const isTester = typeof window !== "undefined" && window.CineInternal?.isTester?.();
        if (!postedRef.current && !isTester) {
          postedRef.current = true;
          let tag: string | null = null;
          try { tag = localStorage.getItem("gauth_name"); } catch { /* noop */ }
          fetch("/api/trumps", { method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ day: todayKey(), deck: Array.from(initHandRef.current).slice(0, 8), won: w, tag: tag || undefined }) }).catch(() => {});
        }
      } catch { /* noop */ }
      // Spoils of war: a daily win banks the best card you CAPTURED from the CPU
      // into the CineLinks collection (same origin via the /rating proxy). Prize
      // floor rare; a total sweep (CPU wiped out) bumps it a tier higher.
      try {
        if (w && typeof window !== "undefined" && window.Collection) {
          const captured = np.filter((c) => !initHandRef.current.has(c.id));
          const pool = captured.length ? captured : np;
          const prize = pool.reduce((b, c) => (c.rating > b.rating ? c : b), pool[0]);
          if (prize) {
            const nc2 = window.Collection.add([{ id: prize.id, type: "movie", name: prize.title, img: prize.poster, rarityFloor: "rare", bump: nc.length === 0 ? 2 : 1 }]);
            if (nc2 && nc2.length) {
              setPrize(prize.title);
              try { const wns = JSON.parse(localStorage.getItem("clCardWins") || "[]"); if (wns.indexOf("rating") < 0) { wns.push("rating"); localStorage.setItem("clCardWins", JSON.stringify(wns)); } } catch { /* noop */ }
              const rev = window.Collection.reveal;
              if (rev) setTimeout(() => rev(nc2), 1300);
            }
          }
        }
      } catch { /* collection is optional */ }
    }
    if (w) { vibrate([20, 40, 20]); Sfx.victory(); setTimeout(() => confetti(160), 140); setTimeout(() => confetti(90), 620); }
    else { vibrate(80); Sfx.defeat(); }
  }, [mode]);

  const startRival = useCallback(async () => {
    try {
      Sfx.select();
      setRivalMsg(null);
      const myIds = Array.from(initHandRef.current).sort((a, b) => a - b).join(",");
      const r = await fetch("/api/trumps?day=" + todayKey() + "&skip=" + myIds).then((x) => (x.ok ? x.json() : null)).catch(() => null);
      const ids: number[] = r && r.rival && Array.isArray(r.rival.d) ? r.rival.d : [];
      const tuples = ids.map((i) => TRUMP_MAP.get(i)).filter(Boolean) as TrumpTuple[];
      if (tuples.length < 4) { setRivalMsg("No rival decks yet today — you might be the first!"); return; }
      clearTimers();
      const { mine, ownedN: on } = buildDecks("practice");
      initHandRef.current = new Set(mine.map((c) => c.id));
      const used = new Set(mine.map((c) => c.id));
      let theirs = tuples.filter((tp) => !used.has(tp[0])).slice(0, HAND).map(toCard);
      if (theirs.length < HAND) {
        const pad = TRUMP_POOL.filter((tp) => !used.has(tp[0]) && !theirs.some((c) => c.id === tp[0]));
        theirs = theirs.concat(pad.slice(0, HAND - theirs.length).map(toCard));
      }
      setMode("practice"); setOwnedN(on);
      myDeckRef.current = mine; rivalDeckRef.current = theirs;
      setPlayer(mine); setCpu(theirs);
      setPot([]); setTurn("player"); setRound(1); setChosen(null); setDuel(null); setClash(false);
      setStreak(0); setBest(0); setWon(false); setRevealed(false); setDailyLocked(false);
      setRivalTag((r.rival.t as string) || "Rival");
      shineUsedRef.current = false; settleRef.current = null; setShineOffer(null); setBanned(null);
      setPhase("play");
    } catch { /* noop */ }
  }, []);

  const resolve = useCallback((stat: StatKey) => {
    if (phase !== "play" || !player.length || !cpu.length || shineOffer) return;
    setBanned(null);
    const sdef = STATS.find((s) => s.key === stat)!;
    const pc = player[0], cc = cpu[0];
    const pv = sdef.val(pc), cv = sdef.val(cc);
    let res: Res = pv > cv ? "win" : cv > pv ? "lose" : "tie";
    let tb = false;
    // Mastery perk: a starred card from your collection (×3+ copies) wins ties.
    if (res === "tie" && (pc.mastery || 0) > 0) { res = "win"; tb = true; }
    const byPlayer = turn === "player";
    setChosen(stat); setRevealed(true); setPhase("reveal"); setClash(false);
    setSeenIds((prev) => { const add = [pc.id, cc.id].filter((id) => !prev.includes(id)); return add.length ? [...prev, ...add] : prev; });   // both cards shown this duel
    setDuel({ stat, pv, cv, res, tb });
    vibrate(10); Sfx.flip(); if (byPlayer) Sfx.pick();
    clearTimers();
    after(820, () => {
      setClash(true);
      const spoilsN = [pc, cc, ...pot].length;
      if (res === "win") { vibrate(28); Sfx.win(); triggerShake(1 + Math.min(streak, 6) * 0.4); boardFlash("rgba(127,212,154,.6)"); scorePop(spoilsN, "#7fd49a"); sweep("player", spoilsN); }
      else if (res === "lose") { vibrate([14, 28]); Sfx.lose(); triggerShake(0.7); boardFlash("rgba(232,128,111,.5)"); sweep("cpu", spoilsN); }
      else { vibrate([10, 22, 10]); Sfx.tie(); }
    });
    const settle = () => {
      const spoils = shuffle([pc, cc, ...pot], Math.random);
      let np = player.slice(1), nc = cpu.slice(1), nturn = turn, nstreak = streak;
      if (res === "win") { np = [...np, ...spoils]; nturn = "player"; nstreak = streak + 1; setPot([]); if (nstreak >= 2) Sfx.streak(nstreak); if (nstreak % 3 === 0) setIntel((i) => Math.min(6, i + 1)); }
      else if (res === "lose") { nc = [...nc, ...spoils]; nturn = "cpu"; nstreak = 0; setPot([]); }
      else { setPot(spoils); }
      setPlayer(np); setCpu(nc); setTurn(nturn); setStreak(nstreak); setBest((b) => Math.max(b, nstreak));
      if (np.length === 0 || nc.length === 0 || round >= MAX_ROUNDS) { finish(np, nc); }
      else { setRound((r) => r + 1); setRevealed(false); setChosen(null); setClash(false); setDuel(null); setPeeked(false); setTrackSel(null); setPhase("play"); }
    };
    after(1620, () => {
      // Shine save: a Shined card from your collection lets you re-pick ONCE per
      // match after losing a duel you chose — the cosmetic becomes a lifeline.
      if (res === "lose" && byPlayer && pc.shine && !shineUsedRef.current) {
        settleRef.current = settle;
        setShineOffer(stat);
        vibrate([8, 20]);
        return;
      }
      settle();
    });
  }, [phase, player, cpu, pot, turn, round, streak, finish, sweep, triggerShake, boardFlash, scorePop, shineOffer]);

  useEffect(() => {
    if (phase === "play" && turn === "cpu" && cpu.length) {
      const t = setTimeout(() => resolve(cpuPick(cpu[0])), 1700);
      return () => clearTimeout(t);
    }
  }, [phase, turn, cpu, resolve]);

  useEffect(() => () => clearTimers(), []);

  const pc = player[0], cc = cpu[0];
  const yourTurn = phase === "play" && turn === "player";
  const showCpu = revealed || phase === "over";
  // Intel is usable on your turn AND on defense (the rival's turn), so you're
  // never a pure spectator: read the attacker, then Peek or Swap to reposition.
  const canAct = phase === "play" && !clash;
  // Intel spends: Peek reveals the rival's full card this duel; Swap sinks your
  // top card and brings up the next (dodge a bad matchup). The rival card is
  // unchanged by a swap, so a prior Peek stays valid.
  const doPeek = () => { if (!canAct || peeked || intel < 1) return; setIntel((i) => i - 1); setPeeked(true); if (cc) setSeenIds((prev) => (prev.includes(cc.id) ? prev : [...prev, cc.id])); Sfx.select(); };
  const doSwap = () => { if (!canAct || intel < 2 || player.length < 2) return; setIntel((i) => i - 2); setPlayer((p) => [...p.slice(1), p[0]]); Sfx.tap(); };
  // Deck tracker: a rival card is "known" once it's been revealed in a duel, or if
  // it originally came from YOUR hand (you always knew those). You learn the SET
  // they hold, never the order — the top card stays a gamble until you Peek.
  // A rival card is "scouted" once it's been shown in a duel (seenIds captures
  // both cards each duel). We only surface the ones you've actually seen.
  // Scouting is tracked against each side's ORIGINAL 8 (fixed), not the live deck
  // that grows/shrinks as cards get captured. A rival card is "seen" once it has
  // appeared in any duel; your own 8 you always know.
  const rivalSeen = new Set<number>();
  rivalDeckRef.current.forEach((c) => { if (seenIds.includes(c.id)) rivalSeen.add(c.id); });
  const myKnown = new Set<number>(myDeckRef.current.map((c) => c.id));
  const rivalViewer = rivalDeckRef.current.length > 0 ? (
    <DeckViewer cards={rivalDeckRef.current} known={rivalSeen} label="Rival hand" sub={rivalSeen.size + " seen · " + (rivalDeckRef.current.length - rivalSeen.size) + " unknown"} sel={trackSel} onSel={setTrackSel} vs={pc} />
  ) : null;
  const myViewer = myDeckRef.current.length > 0 ? (
    <DeckViewer cards={myDeckRef.current} known={myKnown} label="Your hand" sub="tap for stats" sel={trackSel} onSel={setTrackSel} />
  ) : null;
  const total = player.length + cpu.length;
  const youPct = total ? (player.length / total) * 100 : 50;
  const onFire = streak >= 3;
  const chargeLvl = streak >= 7 ? 4 : streak >= 5 ? 3 : streak >= 3 ? 2 : streak >= 2 ? 1 : 0;

  function toggleSound() { setSound(Sfx.toggle()); }

  function share() {
    const s = `🃏 Top Trumps${mode === "daily" ? " #" + (dayNum() - 20000) : ""} — ${won ? "won" : "lost"} ${player.length}–${cpu.length} vs CPU${best >= 3 ? ` · ${best}🔥 streak` : ""}\ncinelinks.vercel.app/rating/toptrumps`;
    if (navigator.share) navigator.share({ text: s }).catch(() => {});
    else if (navigator.clipboard) navigator.clipboard.writeText(s).catch(() => {});
  }

  return (
    <main className="tt-main">
      <style>{CSS}</style>

      <a href="https://cinelinks.vercel.app" style={backStyle}><HomeIcon /> CineLinks</a>
      <button onClick={toggleSound} aria-label={sound ? "Mute sound" : "Unmute sound"} style={soundStyle}>{sound ? "🔊" : "🔇"}</button>
      <button onClick={openVault} aria-label="Open your Vault" style={vaultStyle}>🃏 Vault</button>

      <div className="text-center">
        <h1 className="tt-title" style={{ fontSize: "2rem", fontWeight: 900, letterSpacing: "-.025em", lineHeight: 1 }}>Top<span>Trumps</span></h1>
        <p className="tt-sub" style={{ color: "var(--mut)", fontSize: ".82rem", marginTop: 5 }}>Pick a stat. Higher wins the cards. Take the deck.</p>
      </div>

      {/* mode: daily is the ritual (shared deck, counts to your streak); practice is unlimited */}
      <div className="tt-mode-row flex items-center justify-center gap-2 mt-3">
        <div className="tt-seg">
          <Seg active={mode === "daily"} onClick={() => { Sfx.select(); setMode("daily"); newGame("daily"); }}>Daily</Seg>
          <Seg active={mode === "practice"} onClick={() => { Sfx.select(); setMode("practice"); newGame("practice"); }}>Practice</Seg>
        </div>
        <button onClick={() => (howto ? closeHowto() : setHowto(true))} className="tt-howto-btn" aria-label="How to play">How to play</button>
      </div>
      {howto && (
        <div className="tt-howto" role="note">
          <button onClick={closeHowto} className="tt-howto-x" aria-label="Dismiss">✕</button>
          <b style={{ color: "var(--gold)" }}>How it works.</b> You and the rival each hold a deck of {HAND}. Every round a card flips up: pick a stat and the higher value takes both cards. Win all the rival&apos;s cards to take the match. A tie starts a <b>WAR</b> — the cards pile into a pot for whoever wins next. Both of you start with a hidden hand of 8. As cards come out, the viewer fills in which of the rival&apos;s 8 you&apos;ve <b>seen</b> vs which are still <b>unknown</b> (you can review your own hand too) — but never which is on top. Spend <b>Intel</b> to <b>Peek</b> the exact top card, or <b>Swap</b> your own for the next. Your deck is built from the cards you&apos;ve collected in CineLinks.
        </div>
      )}

      {phase === "deal" && <DealTray cards={player} ownedN={ownedN} onStart={startBattle} reduced={reduced} />}

      {phase !== "deal" && (<>
      {/* deck provenance: your collection IS your deck */}
      <div className="tt-deck-line text-center" style={{ marginTop: 8, fontSize: ".7rem", fontWeight: 700, color: "var(--mut)" }}>
        {ownedN > 0
          ? <span>🃏 <b style={{ color: "var(--gold)" }}>{ownedN}</b> from your collection{ownedN < HAND ? <> · {HAND - ownedN} loaner{HAND - ownedN === 1 ? "" : "s"}</> : " — full deck!"}</span>
          : <span>Playing with house cards — <a href="https://cinelinks.vercel.app" style={{ color: "var(--gold)", textDecoration: "none" }}>collect cards in CineLinks</a> to battle with your own deck</span>}
      </div>

      {/* tug-of-war momentum bar */}
      <div className="tt-momentum mt-4 mb-3">
        <div className="flex items-end justify-between mb-1" style={{ fontSize: ".78rem", fontWeight: 800 }}>
          <span ref={youRef} style={{ color: "var(--gold)" }}>You <b style={{ fontSize: "1rem" }}>{player.length}</b></span>
          <span style={{ color: "var(--mut)", fontSize: ".66rem", fontWeight: 700 }}>round {round}/{MAX_ROUNDS}</span>
          <span ref={cpuRef} style={{ color: "#aab2c0", textAlign: "right" }}><b style={{ fontSize: "1rem" }}>{cpu.length}</b> {rivalTag ? rivalTag : "CPU"}</span>
        </div>
        <div className="tt-track">
          <i style={{ width: youPct + "%", transition: reduced ? "none" : "width .7s cubic-bezier(.3,.9,.3,1)" }}>
            {!reduced && <span className="tt-shine" />}
          </i>
          <span className="tt-knob" style={{ left: youPct + "%", transition: reduced ? "none" : "left .7s cubic-bezier(.3,.9,.3,1)" }} />
        </div>
        <div className="tt-status-row flex items-center justify-center gap-2 mt-2" style={{ minHeight: 20 }}>
          {streak >= 2 && <span className="tt-mult" key={streak} data-lvl={chargeLvl}>🔥 ×{streak}{streak >= 5 ? " · ON FIRE" : ""}</span>}
          {pot.length > 0 && <span className="tt-war">⚔ WAR · pot {pot.length}</span>}
        </div>
      </div>

      {canAct && cc && (
        <div className="tt-intel-region">
          {peeked && <ReconPanel card={cc} full />}
          {/* mobile: both hands stacked above the board. desktop: hidden (shown above each card instead) */}
          <div className="tt-viewers-m">{rivalViewer}{myViewer}</div>
        </div>
      )}

      <div ref={boardRef} className={"tt-board" + (wide ? " tt-wide" : "")}>
        {/* streak charge aura — heats up as the run grows (Balatro escalation) */}
        <div className={"tt-aura" + (chargeLvl >= 2 ? " tt-aura-pulse" : "")} aria-hidden style={{ opacity: chargeLvl ? 1 : 0, background: `radial-gradient(65% 55% at 50% 45%,${AURA[chargeLvl]},transparent 72%)` }} />
        {/* CPU card */}
        <div className="tt-slot tt-slot-cpu">
          {canAct && <div className="tt-viewer-d">{rivalViewer}</div>}
          <FlipCard card={cc} faceUp={showCpu} duel={duel} clash={clash} reduced={reduced} owner={rivalTag || "CPU"} wide={wide} />
        </div>

        {/* clash / VS zone */}
        <div ref={clashRef} className="tt-clash tt-slot-vs">
          {clash && duel && !reduced && <span className="tt-shock" style={{ borderColor: resColor(duel.res) }} />}
          <div className={"tt-vs" + (clash ? " on" : "")} style={clash && duel ? { borderColor: resColor(duel.res), color: resColor(duel.res), boxShadow: `0 0 22px ${resColor(duel.res)}55` } : undefined}>
            {!revealed ? "VS" : !clash ? "…" : duel ? (duel.res === "win" ? "✓" : duel.res === "lose" ? "✗" : "=") : "VS"}
          </div>
        </div>

        {/* banner */}
        <div className="tt-banner text-center" style={{ minHeight: 22, fontSize: ".82rem", fontWeight: 800, marginBottom: 8 }}>
          {shineOffer
            ? <span style={{ display: "inline-flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
                <button onClick={() => { shineUsedRef.current = true; setBanned(shineOffer); setShineOffer(null); settleRef.current = null; setRevealed(false); setChosen(null); setClash(false); setDuel(null); setPhase("play"); Sfx.select(); }}
                  style={{ ...btn(true), padding: "7px 14px", fontSize: ".76rem" }}>✨ Shine save — pick again</button>
                <button onClick={() => { const f = settleRef.current; settleRef.current = null; setShineOffer(null); if (f) f(); }}
                  style={{ ...btn(false), padding: "7px 14px", fontSize: ".76rem" }}>Accept loss</button>
              </span>
            : clash && duel
            ? <span style={{ color: resColor(duel.res) }}>{duel.res === "win" ? (duel.tb ? "★ Mastery breaks the tie — cards are yours" : "You took the cards") : duel.res === "lose" ? "CPU took the cards" : "Tie — pot grows ⚔"}</span>
            : yourTurn ? <span style={{ color: "var(--gold)" }}>Your turn — pick a stat</span>
            : phase === "reveal" ? <span style={{ color: "var(--mut)" }}>Revealing…</span>
            : <span style={{ color: "var(--mut)" }}>{rivalTag || "CPU"} choosing…</span>}
        </div>

        {/* Player card */}
        <div className="tt-slot tt-slot-you">
          {canAct && <div className="tt-viewer-d">{myViewer}</div>}
          {canAct && (
            <div className="tt-intel">
              <span className="tt-intel-n">🔎 Intel &times;{intel}{!yourTurn ? " · defend" : ""}</span>
              <button className="tt-intel-b" type="button" disabled={peeked || intel < 1} onClick={doPeek} title="Reveal the rival's full card">Peek &middot; 1</button>
              <button className="tt-intel-b" type="button" disabled={intel < 2 || player.length < 2} onClick={doSwap} title="Sink this card, bring up the next">Swap &middot; 2</button>
            </div>
          )}
          {pc && <PlayerCard key={pc.id} card={pc} chosen={chosen} duel={duel} clash={clash} revealed={revealed} yourTurn={yourTurn} onPick={resolve} onFire={onFire} streak={streak} banned={banned} wide={wide} />}
        </div>
      </div>
      </>)}

      {phase === "over" && (
        <div className="text-center mt-6 tt-rise">
          <div className="tt-trophy" style={{ fontSize: "2.6rem" }}>{won ? "🏆" : "🎬"}</div>
          <div style={{ fontSize: "1.55rem", fontWeight: 900, color: won ? "#7fd49a" : "#e8806f", marginTop: 2 }}>{won ? "You win!" : (rivalTag || "CPU") + " wins"}</div>
          <div className="flex items-center justify-center gap-4 my-3" style={{ fontWeight: 900 }}>
            <span style={{ color: "var(--gold)", fontSize: "1.5rem" }}><CountStat target={player.length} fmt={(n) => String(Math.round(n))} run /> <span style={{ fontSize: ".72rem", color: "var(--mut)", fontWeight: 800 }}>YOU</span></span>
            <span style={{ color: "var(--mut)" }}>·</span>
            <span style={{ color: "#aab2c0", fontSize: "1.5rem" }}><CountStat target={cpu.length} fmt={(n) => String(Math.round(n))} run /> <span style={{ fontSize: ".72rem", color: "var(--mut)", fontWeight: 800 }}>{(rivalTag || "CPU").toUpperCase()}</span></span>
          </div>
          {best >= 3 && <div style={{ color: "#7fd49a", fontSize: ".8rem", fontWeight: 800, marginBottom: 10 }}>Best streak this game · {best}🔥</div>}
          {won && prize && <div style={{ fontSize: ".82rem", fontWeight: 800, marginBottom: 12, color: "var(--txt)" }}>🃏 New card in your Vault: <b style={{ color: "var(--gold)" }}>{prize}</b></div>}
          <div className="flex gap-2 justify-center flex-wrap">
            {won && prize && <button onClick={openVault} style={btn(true)}>🃏 Open Vault</button>}
            <button onClick={() => { Sfx.tap(); share(); }} style={btn(false)}>Share</button>
            <button onClick={() => { startRival(); }} style={btn(false)}>⚔ Rival deck</button>
            {mode === "daily" && dailyLocked
              ? <button onClick={() => { Sfx.select(); setMode("practice"); newGame("practice"); }} style={btn(!(won && prize))}>Practice</button>
              : <button onClick={() => { Sfx.select(); newGame(mode); }} style={btn(!(won && prize))}>{mode === "daily" ? "Replay" : "New deck"}</button>}
          </div>
          {rivalMsg && <div style={{ color: "var(--mut)", fontSize: ".74rem", marginTop: 10 }}>{rivalMsg}</div>}
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
@keyframes ttshake{10%,90%{transform:translateX(calc(-2px*var(--amp,1)))}20%,80%{transform:translateX(calc(3px*var(--amp,1)))}30%,50%,70%{transform:translateX(calc(-6px*var(--amp,1)))}40%,60%{transform:translateX(calc(6px*var(--amp,1)))}}
@keyframes ttauraP{0%,100%{filter:brightness(1)}50%{filter:brightness(1.45)}}
@keyframes ttmultpop{0%{transform:scale(.5);opacity:0}55%{transform:scale(1.32)}100%{transform:scale(1);opacity:1}}
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
.tt-main{max-width:460px;margin:0 auto;padding:52px 14px 40px}
.tt-board{position:relative}
.tt-seg{display:inline-flex;background:rgba(255,255,255,.04);border:1px solid var(--bdr);border-radius:999px;padding:3px}
.tt-bar{height:5px;border-radius:3px;background:rgba(255,255,255,.08);overflow:hidden;flex:1}
.tt-bar>i{display:block;height:100%;border-radius:3px;transition:width .55s cubic-bezier(.3,.9,.3,1)}
.tt-track{position:relative;height:16px;border-radius:999px;background:linear-gradient(90deg,#2b2620,#262a31);border:1px solid var(--bdr);overflow:hidden}
.tt-track>i{position:absolute;left:0;top:0;bottom:0;border-radius:999px 4px 4px 999px;background:linear-gradient(90deg,#e8a000,#f5c542);box-shadow:0 0 14px rgba(232,160,0,.5);overflow:hidden}
.tt-shine{position:absolute;top:0;bottom:0;width:34%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.55),transparent);animation:ttbarshine 2.4s linear infinite}
.tt-knob{position:absolute;top:50%;width:4px;height:24px;border-radius:3px;background:#fff;transform:translate(-50%,-50%);box-shadow:0 0 8px rgba(0,0,0,.6)}
.tt-fire{color:#ffb24a;font-weight:900;font-size:.8rem;animation:ttfire 1s ease-in-out infinite;text-shadow:0 0 14px rgba(255,140,0,.5)}
.tt-aura{position:absolute;inset:-40px;pointer-events:none;z-index:0;transition:opacity .5s,background .5s}
.tt-aura-pulse{animation:ttauraP 1.2s ease-in-out infinite}
.tt-board>.tt-slot,.tt-board>.tt-clash,.tt-board>.tt-banner{position:relative;z-index:1}
.tt-mult{display:inline-flex;align-items:center;font-weight:900;font-size:.86rem;color:#ffb24a;text-shadow:0 0 14px rgba(255,140,0,.55);animation:ttmultpop .4s cubic-bezier(.2,.9,.3,1)}
.tt-mult[data-lvl="2"]{animation:ttmultpop .4s cubic-bezier(.2,.9,.3,1),ttfire 1s ease-in-out infinite}
.tt-mult[data-lvl="3"]{color:#ff7a2a;font-size:.94rem;text-shadow:0 0 16px rgba(255,110,20,.6)}
.tt-mult[data-lvl="4"]{color:#ff4d3d;font-size:1.02rem;text-shadow:0 0 20px rgba(255,60,30,.75)}
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
/* Poster-hero header (desktop wide only): the card wears its collectible
   silhouette - big poster on top, name-plate over a gradient, rarity badge -
   then the stat tray below. Unifies the Vault card with the Top Trumps card. */
.tt-hero{position:relative;height:172px;border-radius:12px;overflow:hidden;background:var(--s2);box-shadow:0 4px 16px rgba(0,0,0,.45)}
.tt-hero-poster{width:100%;height:100%;object-fit:cover;object-position:center;display:block}
.tt-hero-badge{position:absolute;top:8px;right:8px;font-size:.56rem;font-weight:800;text-transform:uppercase;letter-spacing:.08em;border:1px solid;border-radius:999px;padding:2px 9px;background:rgba(13,13,13,.6);backdrop-filter:blur(3px);z-index:5}
.tt-hero-plate{position:absolute;left:0;right:0;bottom:0;padding:22px 12px 9px;background:linear-gradient(transparent,rgba(0,0,0,.55) 45%,rgba(0,0,0,.88));z-index:5}
.tt-hero-title{font-weight:800;font-size:1.02rem;line-height:1.14;color:#fff;text-shadow:0 1px 6px rgba(0,0,0,.7)}
.tt-hero-meta{color:#e0cc94;font-size:.74rem;margin-top:3px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
/* How-to banner (first visit + on demand) and the opening hand deal. */
.tt-howto-btn{padding:5px 12px;border-radius:999px;border:1px solid var(--bdr);background:transparent;color:var(--mut);font-weight:800;font-family:inherit;cursor:pointer;font-size:.72rem;transition:color .15s,border-color .15s}
.tt-howto-btn:hover{color:var(--txt);border-color:rgba(255,255,255,.25)}
.tt-howto{position:relative;max-width:440px;margin:10px auto 0;padding:11px 34px 11px 13px;border:1px solid var(--bdr);border-radius:12px;background:rgba(255,255,255,.03);font-size:.76rem;line-height:1.55;color:var(--txt);text-align:left}
.tt-howto-x{position:absolute;top:6px;right:8px;background:none;border:none;color:var(--mut);cursor:pointer;font-size:.72rem;font-family:inherit;padding:4px;line-height:1}
.tt-deal-tray{margin-top:16px;text-align:center;animation:ttrise .4s both}
.tt-deal-title{font-size:1.15rem;font-weight:900;letter-spacing:-.01em}
.tt-deal-sub{font-size:.74rem;font-weight:700;color:var(--mut);margin-top:3px}
.tt-deal-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:9px;margin:13px auto 16px;max-width:440px}
.tt-deal-card{position:relative;border-radius:10px;overflow:hidden;border:2px solid var(--bdr);background:var(--s2);aspect-ratio:2/3;animation:ttdeal .42s cubic-bezier(.2,.8,.2,1) both}
.tt-deal-card.loaner{opacity:.5;filter:saturate(.65)}
.tt-deal-card img{width:100%;height:100%;object-fit:cover;display:block}
.tt-deal-plate{position:absolute;left:0;right:0;bottom:0;padding:14px 6px 5px;background:linear-gradient(transparent,rgba(0,0,0,.9));text-align:left}
.tt-deal-name{font-size:.6rem;font-weight:800;color:#fff;line-height:1.12;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tt-deal-rar{font-size:.5rem;font-weight:800;text-transform:uppercase;letter-spacing:.06em;margin-top:2px}
@media(min-width:920px){.tt-deal-grid{max-width:600px;gap:12px}}
/* Intel tactical layer: recon (free read of the rival) + Peek/Swap spends. */
.tt-recon{margin-top:8px;border:1px solid var(--bdr);border-radius:11px;background:rgba(255,255,255,.03);padding:8px 10px;font-size:.72rem;font-weight:700;text-align:left;animation:ttrise .25s both}
.tt-recon.full{border-color:rgba(232,160,0,.4);background:rgba(232,160,0,.07)}
.tt-recon-hd{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;gap:8px}
.tt-recon-tag{font-size:.55rem;font-weight:800;text-transform:uppercase;letter-spacing:.07em;border:1px solid;border-radius:999px;padding:1px 7px}
.tt-recon-lbl{font-size:.58rem;font-weight:800;text-transform:uppercase;letter-spacing:.11em;color:var(--mut)}
.tt-recon-hint{color:var(--txt)}
.tt-recon-warn{color:#e8806f;font-weight:900;margin-right:4px}
.tt-recon-rows{display:grid;grid-template-columns:1fr 1fr;gap:3px 12px}
.tt-recon-row{display:flex;align-items:center;justify-content:space-between;color:#cfcfcf}
.tt-recon-row.hot{color:#e8806f}
.tt-recon-row b{color:#fff}
.tt-intel{display:flex;align-items:center;gap:7px;margin-bottom:9px;flex-wrap:wrap;justify-content:center}
.tt-intel-n{font-size:.72rem;font-weight:800;color:var(--gold)}
.tt-intel-b{font-family:inherit;font-size:.72rem;font-weight:800;color:var(--txt);background:rgba(255,255,255,.05);border:1px solid var(--bdr);border-radius:999px;padding:5px 12px;cursor:pointer;transition:background .14s,border-color .14s,opacity .14s}
.tt-intel-b:not(:disabled):hover{background:rgba(232,160,0,.14);border-color:rgba(232,160,0,.4)}
.tt-intel-b:disabled{opacity:.4;cursor:default}
.tt-intel-region{max-width:460px;margin:0 auto 10px}
.tt-viewer-d{display:none}
@media(min-width:920px){.tt-viewers-m{display:none}.tt-viewer-d{display:block;margin-bottom:8px}}
.tt-rdeck{margin-top:8px;border:1px solid var(--bdr);border-radius:11px;background:rgba(255,255,255,.03);padding:8px 10px;text-align:left;animation:ttrise .25s both}
.tt-track-hd{display:flex;align-items:center;justify-content:space-between;margin-bottom:7px;gap:8px}
.tt-track-lbl{font-size:.64rem;font-weight:800;text-transform:uppercase;letter-spacing:.09em;color:var(--gold)}
.tt-track-sub{font-size:.58rem;font-weight:800;text-transform:uppercase;letter-spacing:.09em;color:var(--mut)}
.tt-track-chips{display:flex;flex-wrap:wrap;gap:5px}
.tt-chip{width:30px;height:44px;border-radius:6px;border:1.5px solid rgba(255,255,255,.18);background:var(--s2);overflow:hidden;padding:0;cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.55);font-weight:900;font-size:.95rem;transition:transform .12s,box-shadow .12s}
.tt-chip img{width:100%;height:100%;object-fit:cover;display:block}
.tt-chip.unknown{cursor:default;border-style:dashed;border-color:rgba(255,255,255,.22);background:rgba(255,255,255,.04)}
.tt-chip.on{transform:translateY(-2px);box-shadow:0 0 0 2px var(--gold)}
.tt-track-detail{margin-top:8px;padding-top:8px;border-top:1px solid var(--bdr)}
.tt-track-name{font-size:.78rem;font-weight:800;margin-bottom:6px}.tt-track-name span{color:var(--mut);font-weight:700;font-size:.7rem;margin-left:4px}
.tt-track-vs{float:right;font-size:.58rem!important;font-weight:800!important;text-transform:uppercase;letter-spacing:.08em;color:var(--gold)!important;margin-left:0!important}
/* Mobile compact: on phones the whole your-turn state (momentum bar, CPU card,
   VS, banner and ALL six stat rows) must fit one screen - no scrolling to act. */
@media(max-width:480px){
  .tt-main{padding:46px 12px 24px}
  .tt-title{font-size:1.35rem}
  .tt-sub{display:none}
  .tt-mode-row{margin-top:8px}
  .tt-deck-line{margin-top:5px;font-size:.64rem}
  .tt-momentum{margin:8px 0 6px}
  .tt-status-row{min-height:16px;margin-top:4px}
  .tt-flip-face{min-height:70px!important;padding:8px!important}
  .tt-flip-poster{width:38px!important;height:57px!important}
  .tt-clash{height:30px;margin:4px 0 2px}
  .tt-pc{padding:10px!important}
  .tt-pc-poster{width:50px!important;height:75px!important}
  .tt-pc-title{font-size:.88rem!important}
  .tt-rows{margin-top:7px!important;gap:5px!important}
  .tt-row{padding:4px 10px;font-size:.78rem}
}
/* Desktop face-off: your card and the opponent's sit side by side with the VS
   between them, using the wide aspect ratio instead of a narrow phone column. */
@media(min-width:920px){
  .tt-main{max-width:1000px;padding:60px 24px 48px}
  .tt-momentum{max-width:620px;margin-left:auto;margin-right:auto}
  .tt-board.tt-wide{display:grid;grid-template-columns:minmax(0,380px) 104px minmax(0,380px);grid-template-rows:auto auto;justify-content:center;align-items:start;column-gap:10px;row-gap:4px;margin-top:6px}
  .tt-wide .tt-slot{width:100%}
  .tt-wide .tt-slot-you{grid-column:1;grid-row:1}
  .tt-wide .tt-slot-vs{grid-column:2;grid-row:1;align-self:center;height:auto;margin:0}
  .tt-wide .tt-slot-cpu{grid-column:3;grid-row:1}
  .tt-wide .tt-banner{grid-column:1 / -1;grid-row:2;margin-top:10px}
  .tt-wide .tt-vs{width:52px;height:52px;font-size:1.3rem}
  .tt-wide .tt-vs.on{font-size:1.6rem}
}
@media(prefers-reduced-motion:reduce){
  .tt-deal,.tt-rise,.tt-trophy,.tt-shake,.tt-vs.on,.tt-fire,.tt-aura-pulse,.tt-mult{animation:none}
  .tt-shine,.tt-sheen,.tt-spark,.tt-shock{display:none}
  .tt-bar>i,.tt-track>i,.tt-knob{transition:none}
}`;

const backStyle: React.CSSProperties = { position: "fixed", top: 13, left: 13, zIndex: 50, display: "inline-flex", alignItems: "center", gap: 5, color: "var(--mut)", textDecoration: "none", fontSize: ".78rem", fontWeight: 700, background: "rgba(20,20,20,.6)", border: "1px solid var(--bdr)", borderRadius: 999, padding: "7px 13px", backdropFilter: "blur(8px)" };
const soundStyle: React.CSSProperties = { position: "fixed", top: 13, right: 13, zIndex: 50, width: 38, height: 38, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "1rem", color: "var(--txt)", background: "rgba(20,20,20,.6)", border: "1px solid var(--bdr)", borderRadius: 999, cursor: "pointer", backdropFilter: "blur(8px)" };
const vaultStyle: React.CSSProperties = { position: "fixed", top: 13, right: 59, zIndex: 50, height: 38, display: "inline-flex", alignItems: "center", gap: 5, padding: "0 13px", fontSize: ".78rem", fontWeight: 700, fontFamily: "inherit", color: "var(--txt)", background: "rgba(20,20,20,.6)", border: "1px solid var(--bdr)", borderRadius: 999, cursor: "pointer", backdropFilter: "blur(8px)" };
function btn(gold: boolean): React.CSSProperties { return { padding: "11px 20px", borderRadius: 12, border: gold ? "none" : "1px solid var(--bdr)", background: gold ? "linear-gradient(135deg,#f5c542,#e8a000)" : "transparent", color: gold ? "#111" : "var(--txt)", fontWeight: 800, fontFamily: "inherit", cursor: "pointer", fontSize: ".88rem", boxShadow: gold ? "0 6px 18px rgba(232,160,0,.35)" : "none" }; }

function DeckViewer({ cards, known, label, sub, sel, onSel, vs }: { cards: Card[]; known: Set<number>; label: string; sub: string; sel: number | null; onSel: (id: number | null) => void; vs?: Card }) {
  // A side's ORIGINAL 8 (fixed). Known cards show their poster; hover (or tap on
  // touch) opens a stat panel. When `vs` (your current card) is passed, each stat
  // is coloured green/red for whether your card would beat this rival card on it.
  const [hover, setHover] = useState<number | null>(null);
  const sorted = [...cards].sort((a, b) => a.id - b.id);
  const activeId = hover != null ? hover : sel;
  const active = activeId != null ? cards.find((c) => c.id === activeId && known.has(c.id)) : null;
  return (
    <div className="tt-rdeck">
      <div className="tt-track-hd">
        <span className="tt-track-lbl">{label}</span>
        <span className="tt-track-sub">{sub}</span>
      </div>
      <div className="tt-track-chips">
        {sorted.map((c) => known.has(c.id) ? (
          <button key={c.id} type="button" className={"tt-chip" + (activeId === c.id ? " on" : "")}
            onMouseEnter={() => setHover(c.id)} onMouseLeave={() => setHover(null)}
            onClick={() => onSel(sel === c.id ? null : c.id)} title={c.title} style={{ borderColor: RARITY[c.rarity].ring }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={c.poster} alt="" />
          </button>
        ) : (
          <span key={c.id} className="tt-chip unknown">?</span>
        ))}
      </div>
      {active && (
        <div className="tt-track-detail">
          <div className="tt-track-name">{active.title} <span>{active.year}</span>{vs && <span className="tt-track-vs">you › rival</span>}</div>
          <div className="tt-recon-rows">
            {STATS.map((s) => {
              if (vs) {
                const pv = s.val(vs), cv = s.val(active);
                const col = pv > cv ? "#7fd49a" : pv < cv ? "#e8806f" : "var(--mut)";
                return (
                  <div key={s.key} className="tt-recon-row" style={{ color: col }}>
                    <span>{s.icon} {s.label}</span>
                    <span>{s.fmtNum(pv)} <span style={{ opacity: .5 }}>›</span> {s.fmtNum(cv)} <b>{pv > cv ? "✓" : pv < cv ? "✗" : "="}</b></span>
                  </div>
                );
              }
              return <div key={s.key} className="tt-recon-row"><span>{s.icon} {s.label}</span><b>{s.fmtNum(s.val(active))}</b></div>;
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function ReconPanel({ card, full }: { card: Card; full: boolean }) {
  const rar = RARITY[card.rarity];
  const rows = STATS.map((s) => ({ s, bar: s.bar(card), val: s.fmtNum(s.val(card)) }));
  const strong = rows.reduce((a, b) => (b.bar > a.bar ? b : a), rows[0]);
  return (
    <div className={"tt-recon" + (full ? " full" : "")}>
      <div className="tt-recon-hd">
        <span className="tt-recon-tag" style={{ color: rar.ring, borderColor: rar.ring }}>{rar.label}</span>
        <span className="tt-recon-lbl">{full ? "On top now" : "Recon"}</span>
      </div>
      {full ? (
        <div className="tt-recon-rows">
          {rows.map((r) => (
            <div key={r.s.key} className={"tt-recon-row" + (r === strong ? " hot" : "")}>
              <span>{r.s.icon} {r.s.label}</span><b>{r.val}</b>
            </div>
          ))}
        </div>
      ) : (
        <div className="tt-recon-hint"><span className="tt-recon-warn">&#9888; Strong</span> {strong.s.icon} {strong.s.label} &middot; <b>{strong.val}</b></div>
      )}
    </div>
  );
}

function DealTray({ cards, ownedN, onStart, reduced }: { cards: Card[]; ownedN: number; onStart: () => void; reduced: boolean }) {
  return (
    <div className="tt-deal-tray">
      <div className="tt-deal-title">Your deck</div>
      <div className="tt-deal-sub">
        {ownedN > 0
          ? <><b style={{ color: "var(--gold)" }}>{ownedN}</b> of {HAND} from your CineLinks collection{ownedN < HAND ? <> · {HAND - ownedN} loaner{HAND - ownedN === 1 ? "" : "s"}</> : " — full deck!"}</>
          : <>House cards for now — <a href="https://cinelinks.vercel.app" style={{ color: "var(--gold)", textDecoration: "none" }}>collect in CineLinks</a> to battle with your own</>}
      </div>
      <div className="tt-deal-grid">
        {cards.map((c, i) => {
          const rar = RARITY[c.rarity];
          return (
            <div key={c.id} className={"tt-deal-card" + (c.owned ? "" : " loaner")} style={{ borderColor: c.owned ? rar.ring : "var(--bdr)", animationDelay: reduced ? undefined : (i * 0.055).toFixed(3) + "s" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.poster} alt="" />
              <div className="tt-deal-plate">
                <div className="tt-deal-name">{c.title}</div>
                <div className="tt-deal-rar" style={{ color: c.owned ? rar.ring : "var(--mut)" }}>{c.owned ? rar.label : "loaner"}</div>
              </div>
            </div>
          );
        })}
      </div>
      <button onClick={onStart} style={btn(true)}>Start battle</button>
    </div>
  );
}

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

function PlayerCard({ card, chosen, duel, clash, revealed, yourTurn, onPick, onFire, streak, banned, wide }: { card: Card; chosen: StatKey | null; duel: Duel; clash: boolean; revealed: boolean; yourTurn: boolean; onPick: (k: StatKey) => void; onFire: boolean; streak: number; banned?: StatKey | null; wide?: boolean }) {
  const rar = RARITY[card.rarity];
  const fancy = card.rarity !== "common";
  const ownTag = card.owned ? " · yours" : card.loaner ? " · loaner" : "";
  const glow = onFire ? `0 14px 40px rgba(0,0,0,.45), 0 0 ${18 + Math.min(streak, 7) * 4}px rgba(232,160,0,${0.25 + Math.min(streak, 7) * 0.04})` : `0 14px 40px rgba(0,0,0,.4)`;
  return (
    <div className="tt-deal tt-pc" key={card.id} style={{ position: "relative", background: "var(--s1)", border: "2px solid " + rar.ring, borderRadius: 16, padding: 14, boxShadow: glow, overflow: "hidden", animation: onFire ? "ttdeal .4s cubic-bezier(.2,.8,.2,1) both, ttglow 1.8s ease-in-out infinite" : undefined }}>
      {fancy && <div style={{ position: "absolute", inset: 0, background: rar.grad, pointerEvents: "none" }} />}
      {!wide && fancy && <span className="tt-sheen" />}
      {!wide && card.rarity === "legendary" && <Sparkles />}
      {wide ? (
        <div className="tt-hero" style={{ position: "relative" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={card.poster} alt="" className="tt-hero-poster" style={{ background: "var(--s2)" }} />
          {fancy && <span className="tt-sheen" />}
          {card.rarity === "legendary" && <Sparkles />}
          <span className="tt-hero-badge" style={{ color: rar.ring, borderColor: rar.ring }}>{rar.label}{ownTag}</span>
          <div className="tt-hero-plate">
            <div className="tt-hero-title">{card.title}</div>
            <div className="tt-hero-meta">
              <span>{card.year} · {card.genre}</span>
              {(card.mastery || 0) > 0 && <span title="Mastery — wins ties" style={{ fontWeight: 900, color: card.mastery === 3 ? "#f5c542" : card.mastery === 2 ? "#dfe6f2" : "#cd8f52", textShadow: "0 0 8px rgba(245,197,66,.5)" }}>★ M{card.mastery}</span>}
              {card.shine && <span title="Shined — once per match you may re-pick after losing a duel">✨</span>}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex gap-3" style={{ position: "relative" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={card.poster} alt="" className="tt-pc-poster" style={{ width: 72, height: 108, objectFit: "cover", borderRadius: 9, flexShrink: 0, background: "var(--s2)", boxShadow: "0 4px 14px rgba(0,0,0,.5)" }} />
          <div className="min-w-0 flex-1">
            <div className="tt-pc-title" style={{ fontWeight: 800, fontSize: "1rem", lineHeight: 1.2 }}>{card.title}</div>
            <div style={{ color: "var(--mut)", fontSize: ".78rem", marginTop: 2 }}>{card.year} · {card.genre}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 7, flexWrap: "wrap" }}>
              <span style={{ fontSize: ".58rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: ".07em", color: rar.ring, border: "1px solid " + rar.ring, borderRadius: 999, padding: "2px 8px" }}>{rar.label}{ownTag}</span>
              {(card.mastery || 0) > 0 && <span title="Mastery — wins ties" style={{ fontSize: ".62rem", fontWeight: 900, color: card.mastery === 3 ? "#f5c542" : card.mastery === 2 ? "#dfe6f2" : "#cd8f52", textShadow: "0 0 8px rgba(245,197,66,.5)" }}>★ M{card.mastery}</span>}
              {card.shine && <span title="Shined — once per match you may re-pick after losing a duel" style={{ fontSize: ".62rem" }}>✨</span>}
            </div>
          </div>
        </div>
      )}
      <div className="tt-rows mt-3 flex flex-col gap-2" style={{ position: "relative" }}>
        {STATS.map((s) => {
          const lit = chosen === s.key;
          const win = lit && clash && duel ? duel.res === "win" : false;
          const lose = lit && clash && duel ? duel.res === "lose" : false;
          const valColor = win ? "#7fd49a" : lose ? "#e8806f" : lit ? "var(--gold)" : "var(--txt)";
          return (
            <button key={s.key} disabled={!yourTurn || banned === s.key} onClick={() => onPick(s.key)}
              className={"tt-row" + (lit ? " lit" : "")}
              style={{ background: lit ? "rgba(232,160,0,.16)" : (yourTurn ? "rgba(255,255,255,.03)" : "transparent"), cursor: yourTurn && banned !== s.key ? "pointer" : "default", opacity: (yourTurn && banned !== s.key) || lit ? 1 : .55, animation: lit && !clash ? "ttpulse .8s" : undefined }}>
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

function FlipCard({ card, faceUp, duel, clash, reduced, owner, wide }: { card?: Card; faceUp: boolean; duel: Duel; clash: boolean; reduced: boolean; owner: string; wide?: boolean }) {
  if (!card) return null;
  const rar = RARITY[card.rarity];
  const sdef = duel ? STATS.find((s) => s.key === duel.stat)! : null;
  const fancy = card.rarity !== "common";
  const win = clash && duel ? duel.res === "lose" : false;  // CPU wins when player loses
  const lose = clash && duel ? duel.res === "win" : false;
  const valColor = win ? "#7fd49a" : lose ? "#e8806f" : "var(--gold)";
  const hidden: React.CSSProperties = { backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" };
  const frontBorder = win ? "#7fd49a" : lose ? "rgba(232,128,111,.5)" : rar.ring;

  // Desktop face-off: a full vertical card that mirrors the player's card —
  // poster header + all six stat slots, values masked with "?" until the duel
  // reveals the chosen one. Opponent's other stats stay hidden (real Top Trumps).
  const frontWide = (
    <div className="tt-flip-face tt-pc" style={{ ...hidden, position: "relative", background: "var(--s1)", border: "2px solid " + frontBorder, borderRadius: 16, padding: 14, overflow: "hidden", boxShadow: win ? "0 0 26px rgba(127,212,154,.5)" : "0 14px 40px rgba(0,0,0,.4)" }}>
      {fancy && <div style={{ position: "absolute", inset: 0, background: rar.grad, pointerEvents: "none" }} />}
      <div className="tt-hero" style={{ position: "relative" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={card.poster} alt="" className="tt-hero-poster" style={{ background: "var(--s2)" }} />
        {fancy && <span className="tt-sheen" />}
        {card.rarity === "legendary" && <Sparkles />}
        <span className="tt-hero-badge" style={{ color: rar.ring, borderColor: rar.ring }}>{rar.label} · {owner}</span>
        <div className="tt-hero-plate">
          <div className="tt-hero-title">{card.title}</div>
          <div className="tt-hero-meta">{card.year} · {card.genre}</div>
        </div>
      </div>
      <div className="tt-rows mt-3 flex flex-col gap-2" style={{ position: "relative" }}>
        {STATS.map((s) => {
          const isDuel = duel && duel.stat === s.key;
          const showVal = isDuel && faceUp;
          const rowColor = isDuel ? valColor : "var(--txt)";
          return (
            <div key={s.key} className={"tt-row" + (isDuel ? " lit" : "")} style={{ background: isDuel ? "rgba(232,160,0,.16)" : "transparent", opacity: isDuel ? 1 : 0.5 }}>
              <span style={{ width: 18, textAlign: "center" }}>{s.icon}</span>
              <span style={{ width: 64, flexShrink: 0 }}>{s.label}</span>
              {showVal ? <StatBar frac={s.bar(card)} color={valColor} lit /> : <span className="tt-bar" style={{ opacity: 0.35 }} />}
              <span style={{ width: 58, textAlign: "right", fontWeight: 800, color: rowColor, display: "inline-block", animation: win && clash && isDuel ? "ttwinpop .4s cubic-bezier(.2,.9,.3,1) both" : undefined }}>
                {showVal ? <CountStat target={s.val(card)} from={s.from(card)} fmt={s.fmtNum} run /> : "?"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );

  const frontCompact = (
    <div className="tt-flip-face" style={{ ...hidden, position: "relative", background: "var(--s1)", border: "2px solid " + frontBorder, borderRadius: 14, padding: 12, display: "flex", alignItems: "center", gap: 12, minHeight: 96, overflow: "hidden", boxShadow: win ? "0 0 22px rgba(127,212,154,.45)" : "0 10px 30px rgba(0,0,0,.4)" }}>
      {fancy && <div style={{ position: "absolute", inset: 0, background: rar.grad, pointerEvents: "none" }} />}
      {fancy && <span className="tt-sheen" />}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={card.poster} alt="" className="tt-flip-poster" style={{ width: 54, height: 81, objectFit: "cover", borderRadius: 7, flexShrink: 0, background: "var(--s2)", position: "relative" }} />
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
  );

  const backCompact = (
    <div className="tt-flip-face" style={{ ...hidden, position: "absolute", inset: 0, transform: "rotateY(180deg)", background: "repeating-linear-gradient(45deg,#161616,#161616 10px,#1d1d1d 10px,#1d1d1d 20px)", border: "2px solid var(--bdr)", borderRadius: 14, padding: 12, display: "flex", alignItems: "center", gap: 12 }}>
      <div className="tt-flip-poster" style={{ width: 54, height: 81, borderRadius: 7, flexShrink: 0, background: "rgba(232,160,0,.1)", border: "1px solid rgba(232,160,0,.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.6rem", color: "var(--gold)" }}>🃏</div>
      <div><div style={{ fontWeight: 800, fontSize: ".86rem" }}>{owner}&apos;s card</div><div style={{ color: "var(--mut)", fontSize: ".74rem", marginTop: 2 }}>hidden until a stat is picked</div></div>
    </div>
  );

  const backWide = (
    <div className="tt-flip-face" style={{ ...hidden, position: "absolute", inset: 0, transform: "rotateY(180deg)", background: "repeating-linear-gradient(45deg,#161616,#161616 12px,#1d1d1d 12px,#1d1d1d 24px)", border: "2px solid var(--bdr)", borderRadius: 16, padding: 14, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
      <div style={{ width: 88, height: 132, borderRadius: 12, background: "rgba(232,160,0,.1)", border: "1px solid rgba(232,160,0,.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2.6rem", color: "var(--gold)" }}>🃏</div>
      <div className="text-center"><div style={{ fontWeight: 800, fontSize: ".92rem" }}>{owner}&apos;s card</div><div style={{ color: "var(--mut)", fontSize: ".76rem", marginTop: 2 }}>hidden until you pick a stat</div></div>
    </div>
  );

  return (
    <div style={{ perspective: 900, minHeight: wide ? undefined : 96 }}>
      <div style={{ position: "relative", transformStyle: "preserve-3d", transition: reduced ? "none" : "transform .55s cubic-bezier(.3,.9,.3,1)", transform: faceUp ? "rotateY(0)" : "rotateY(180deg)", filter: lose ? "saturate(.6) brightness(.85)" : "none" }}>
        {wide ? frontWide : frontCompact}
        {wide ? backWide : backCompact}
      </div>
    </div>
  );
}
