"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import AutoNextButton from "@/components/AutoNextButton";

interface Movie {
  imdbId: string; title: string; year: string; poster: string; imdbRating: string; director: string;
}
interface Challenge {
  name: string; type: "director" | "actor"; wikipediaSlug: string; movieIds: string[];
}
type Phase = "loading" | "choosing" | "revealing" | "done";
interface RoundResult {
  correct: boolean; personName: string; personPhoto: string | null;
  winnerTitle: string; winnerRating: string; pickedTitle: string;
}

const ROUNDS = 10;

function ordinal(n: number) { return ["1st", "2nd", "3rd", "4th"][n] ?? `${n + 1}th`; }

function gradeFor(score: number) {
  if (score >= 9) return { label: "Film Archivist", sub: "You know every frame", color: "#a855f7" };
  if (score >= 7) return { label: "Cinephile",      sub: "A true connoisseur",  color: "#e8a000" };
  if (score >= 5) return { label: "Movie Buff",     sub: "Not bad at all",      color: "#4ade80" };
  return           { label: "Casual Viewer",         sub: "Keep watching",       color: "#777"    };
}

// ── Canvas image share ────────────────────────────────────────────────────────

async function generateShareBlob(score: number, results: RoundResult[]): Promise<Blob | null> {
  const W = 440, H = 300;
  const canvas = document.createElement("canvas");
  canvas.width = W * 2; canvas.height = H * 2; // retina
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.scale(2, 2);

  // Background
  ctx.fillStyle = "#0d0d0d";
  ctx.fillRect(0, 0, W, H);

  // Subtle vignette gradient
  const vg = ctx.createLinearGradient(0, 0, 0, H);
  vg.addColorStop(0, "rgba(232,160,0,0.05)");
  vg.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);

  // Gold top bar
  ctx.fillStyle = "#e8a000";
  ctx.fillRect(0, 0, W, 3);

  // Mode label
  ctx.fillStyle = "#e8a000";
  ctx.font = "bold 10px 'Inter', system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("FILMOGRAPHY BATTLE", W / 2, 26);

  // Grade
  const g = gradeFor(score);
  ctx.fillStyle = g.color;
  ctx.font = "bold 26px 'Inter', system-ui, sans-serif";
  ctx.fillText(g.label, W / 2, 62);

  // Score
  ctx.fillStyle = "#f0f0f0";
  ctx.font = "bold 64px 'Inter', system-ui, sans-serif";
  const scoreStr = String(score);
  const scoreW = ctx.measureText(scoreStr).width;
  ctx.fillText(scoreStr, W / 2 - 20, 144);
  ctx.fillStyle = "#555";
  ctx.font = "28px 'Inter', system-ui, sans-serif";
  ctx.fillText(`/${ROUNDS}`, W / 2 - 20 + scoreW + 4, 144);

  // Emoji grid (5 per row max)
  const emojis = results.map((r) => (r.correct ? "🟩" : "🟥"));
  ctx.font = "22px 'Segoe UI Emoji', 'Apple Color Emoji', sans-serif";
  ctx.textAlign = "center";
  const chunk1 = emojis.slice(0, 5).join(" ");
  const chunk2 = emojis.slice(5).join(" ");
  if (chunk1) ctx.fillText(chunk1, W / 2, 185);
  if (chunk2) ctx.fillText(chunk2, W / 2, 212);

  // URL
  ctx.fillStyle = "#444";
  ctx.font = "11px 'Inter', system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("cinerating.vercel.app/filmography", W / 2, H - 16);

  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
}

async function shareImage(score: number, results: RoundResult[]) {
  const blob = await generateShareBlob(score, results);
  if (!blob) return;
  const file = new File([blob], "filmography-battle.png", { type: "image/png" });
  try {
    if (navigator.share && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: `Filmography Battle ${score}/${ROUNDS}` });
      return;
    }
  } catch { /* fallthrough */ }
  // fallback: download
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "filmography-battle.png";
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

// ── PersonAvatar ──────────────────────────────────────────────────────────────

function PersonAvatar({ photo, name, size = 80 }: { photo: string | null; name: string; size?: number }) {
  if (photo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={photo} alt={name} style={{ width: size, height: size }} className="rounded-full object-cover border-2 border-[#e8a000]/40 shadow-lg flex-shrink-0" />;
  }
  const initials = name.split(" ").slice(0, 2).map((w) => w[0]).join("");
  return (
    <div style={{ width: size, height: size }} className="rounded-full bg-[#1a1a1a] border-2 border-[#e8a000]/30 flex items-center justify-center text-[#e8a000] font-black text-xl flex-shrink-0">
      {initials}
    </div>
  );
}

// ── ShareImageButton ──────────────────────────────────────────────────────────

function ShareImageButton({ score, results }: { score: number; results: RoundResult[] }) {
  const [state, setState] = useState<"idle" | "generating" | "done">("idle");
  const handle = async () => {
    if (state !== "idle") return;
    setState("generating");
    await shareImage(score, results);
    setState("done");
    setTimeout(() => setState("idle"), 2500);
  };
  return (
    <button onClick={handle} className="w-full font-bold py-3 rounded-xl transition-all hover:opacity-85 active:scale-[0.98]"
      style={{
        background: state === "done" ? "rgba(34,197,94,0.15)" : "rgba(232,160,0,0.12)",
        color:      state === "done" ? "#4ade80" : "#e8a000",
        border:     state === "done" ? "1px solid rgba(34,197,94,0.3)" : "1px solid rgba(232,160,0,0.3)",
      }}>
      {state === "generating" ? "Generating…" : state === "done" ? "✓ Shared!" : "📷 Share Result"}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function FilmographyPage() {
  const router = useRouter();

  const cacheRef       = useRef<Record<string, Movie>>({});
  const fetchingRef    = useRef<Set<string>>(new Set());
  const challengesRef  = useRef<Challenge[]>([]);
  const photoCache     = useRef<Record<string, string | null>>({});

  const [phase,       setPhase]       = useState<Phase>("loading");
  const [round,       setRound]       = useState(0);
  const [challenge,   setChallenge]   = useState<Challenge | null>(null);
  const [personPhoto, setPersonPhoto] = useState<string | null>(null);
  const [movies,      setMovies]      = useState<Movie[]>([]);
  const [picked,      setPicked]      = useState<number | null>(null);
  const [score,       setScore]       = useState(0);
  const [results,     setResults]     = useState<RoundResult[]>([]);

  const fetchMovie = useCallback(async (id: string): Promise<Movie> => {
    if (cacheRef.current[id]) return cacheRef.current[id];
    if (fetchingRef.current.has(id)) {
      return new Promise((resolve) => {
        const poll = setInterval(() => {
          if (cacheRef.current[id]) { clearInterval(poll); resolve(cacheRef.current[id]); }
        }, 50);
      });
    }
    fetchingRef.current.add(id);
    const res = await fetch(`/api/movie?id=${id}`);
    const data: Movie = await res.json();
    cacheRef.current[id] = data;
    return data;
  }, []);

  const fetchPersonPhoto = useCallback(async (slug: string): Promise<string | null> => {
    if (slug in photoCache.current) return photoCache.current[slug];
    try {
      const res = await fetch(`/api/person-photo?slug=${encodeURIComponent(slug)}`);
      const data = await res.json();
      photoCache.current[slug] = data.photo ?? null;
      return photoCache.current[slug];
    } catch { photoCache.current[slug] = null; return null; }
  }, []);

  const loadRound = useCallback(async (idx: number) => {
    const ch = challengesRef.current[idx];
    if (!ch) return;
    setPhase("loading"); setChallenge(ch); setPicked(null); setPersonPhoto(null);
    const [fetched, photo] = await Promise.all([
      Promise.all(ch.movieIds.map((id) => fetchMovie(id))),
      fetchPersonPhoto(ch.wikipediaSlug),
    ]);
    setMovies(fetched); setPersonPhoto(photo); setPhase("choosing");
    // Prefetch next
    const next = challengesRef.current[idx + 1];
    if (next) { next.movieIds.forEach((id) => fetchMovie(id)); fetchPersonPhoto(next.wikipediaSlug); }
  }, [fetchMovie, fetchPersonPhoto]);

  const initGame = useCallback(() => {
    fetch(`/api/filmography?count=${ROUNDS}`)
      .then((r) => r.json())
      .then((d: { challenges: Challenge[] }) => { challengesRef.current = d.challenges; loadRound(0); });
  }, [loadRound]);

  useEffect(() => { initGame(); }, [initGame]);

  const handleNext = useCallback(() => {
    const next = round + 1;
    if (next >= ROUNDS || next >= challengesRef.current.length) { setPhase("done"); return; }
    setRound(next); loadRound(next);
  }, [round, loadRound]);

  const handlePick = useCallback((idx: number) => {
    setMovies((mvs) => {
      if (!mvs.length) return mvs;
      const ratings  = mvs.map((m) => parseFloat(m.imdbRating) || 0);
      const maxRating = Math.max(...ratings);
      // Tie-safe: any movie with max rating counts as correct
      const correct  = ratings[idx] === maxRating;
      const winnerIdx = ratings.indexOf(maxRating);
      setPicked(idx);
      setPhase("revealing");
      if (correct) setScore((s) => s + 1);
      const winner  = mvs[winnerIdx];
      const picked_ = mvs[idx];
      setChallenge((ch) => {
        setPersonPhoto((photo) => {
          setResults((prev) => [...prev, {
            correct, personName: ch!.name, personPhoto: photo,
            winnerTitle: winner.title, winnerRating: winner.imdbRating, pickedTitle: picked_.title,
          }]);
          return photo;
        });
        return ch;
      });
      return mvs;
    });
  }, []);

  // Keyboard shortcuts: 1/2/3/4 to pick, Space/Enter to advance
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (phase === "choosing" && movies.length) {
        const n = parseInt(e.key);
        if (n >= 1 && n <= movies.length) { e.preventDefault(); handlePick(n - 1); }
      }
      if (phase === "revealing" && (e.key === " " || e.key === "Enter")) {
        e.preventDefault(); handleNext();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, movies.length, handlePick, handleNext]);

  const handleRestart = () => {
    cacheRef.current = {}; fetchingRef.current = new Set(); challengesRef.current = [];
    setRound(0); setScore(0); setResults([]); setChallenge(null); setMovies([]); setPicked(null); setPersonPhoto(null);
    initGame();
  };

  // ── Loading ─────────────────────────────────────────────────────────────────

  if (phase === "loading" && !challenge) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0d0d0d" }}>
        <div className="text-center space-y-4">
          <div className="relative w-14 h-14 mx-auto">
            <div className="absolute inset-0 rounded-lg border-2 border-t-[#e8a000] border-r-[rgba(232,160,0,0.4)] border-b-transparent border-l-transparent animate-spin" />
            <div className="absolute inset-3 rounded-full animate-pulse" style={{ background: "rgba(232,160,0,0.1)" }} />
          </div>
          <p className="text-sm font-medium" style={{ color: "#777" }}>Loading filmography…</p>
        </div>
      </div>
    );
  }

  // ── Done ────────────────────────────────────────────────────────────────────

  if (phase === "done") {
    const grade = gradeFor(score);
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 animate-slide-up" style={{ background: "#0d0d0d" }}>
        <div className="max-w-md w-full rounded-2xl p-6 animate-pop"
          style={{ background: "rgba(255,255,255,0.045)", backdropFilter: "blur(18px)", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 30px 80px rgba(0,0,0,0.5)" }}>
          <div className="text-center mb-6">
            <p className="text-[0.6rem] font-bold tracking-[0.18em] uppercase mb-3" style={{ color: "#e8a000" }}>Filmography Battle</p>
            <p className="text-2xl font-black mb-0.5" style={{ color: grade.color }}>{grade.label}</p>
            <p className="text-sm" style={{ color: "#777" }}>{grade.sub}</p>
            <p className="text-6xl font-black mt-4 text-white">
              {score}<span className="text-2xl font-normal" style={{ color: "#777" }}> / {ROUNDS}</span>
            </p>
          </div>
          <div className="space-y-2 mb-5 max-h-64 overflow-y-auto pr-1">
            {results.map((r, i) => (
              <div key={i} className="flex items-start gap-3 rounded-xl px-3 py-2.5 text-xs"
                style={{ background: r.correct ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)", border: r.correct ? "1px solid rgba(34,197,94,0.2)" : "1px solid rgba(239,68,68,0.2)" }}>
                <span className={`font-bold mt-0.5 flex-shrink-0 ${r.correct ? "text-green-400" : "text-red-400"}`}>{r.correct ? "✓" : "✗"}</span>
                {r.personPhoto && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.personPhoto} alt={r.personName} className="w-7 h-7 rounded-full object-cover flex-shrink-0 border border-[rgba(255,255,255,0.1)]" />
                )}
                <div className="flex-1 min-w-0">
                  <span style={{ color: "#777" }}>{r.personName}:</span>{" "}
                  <span style={{ color: "#e8a000" }} className="font-semibold">{r.winnerTitle}</span>{" "}
                  <span style={{ color: "#555" }}>({r.winnerRating})</span>
                  {!r.correct && <p style={{ color: "#555" }} className="mt-0.5">You picked: <span style={{ color: "#999" }}>{r.pickedTitle}</span></p>}
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-3 mb-3">
            <button onClick={handleRestart} className="flex-1 font-bold py-3 rounded-xl hover:opacity-85 transition-all" style={{ background: "#e8a000", color: "#111" }}>Play Again</button>
            <button onClick={() => router.push("/")} className="flex-1 font-bold py-3 rounded-xl hover:opacity-85 transition-all" style={{ background: "transparent", color: "#f0f0f0", border: "1px solid rgba(255,255,255,0.09)" }}>🏠 Home</button>
          </div>
          <ShareImageButton score={score} results={results} />
        </div>
      </div>
    );
  }

  if (!challenge || movies.length === 0) return null;

  // ── Active Round ─────────────────────────────────────────────────────────────

  const ratings    = movies.map((m) => parseFloat(m.imdbRating) || 0);
  const maxRating  = Math.max(...ratings);
  const winnerIdx  = ratings.indexOf(maxRating);
  const ranked     = [...ratings.map((r, i) => ({ r, i }))].sort((a, b) => b.r - a.r).map((x) => x.i);
  const rankOf     = (idx: number) => ranked.indexOf(idx);
  const progress   = ((round + 1) / ROUNDS) * 100;
  const typeLabel  = challenge.type === "director" ? "DIRECTOR" : "ACTOR";

  return (
    <div className="min-h-screen flex flex-col px-4 py-4 max-w-2xl mx-auto w-full" style={{ background: "#0d0d0d" }}>

      {/* Progress header */}
      <div className="mb-3 flex-shrink-0">
        <div className="flex justify-between items-center mb-2">
          <button onClick={() => router.push("/")} className="text-sm font-medium hover:opacity-80 transition-opacity" style={{ color: "#777" }}>← Back</button>
          <div className="flex items-center gap-3">
            <span className="text-sm" style={{ color: "#777" }}>{round + 1} / {ROUNDS}</span>
            <span className="text-sm font-bold" style={{ color: "#e8a000" }}>{score} ✓</span>
          </div>
        </div>
        <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress}%`, background: "#e8a000" }} />
        </div>
      </div>

      {/* Person card — key={round} triggers slide-in animation each round */}
      <div key={`person-${round}`}
        className="rounded-2xl px-5 py-4 mb-3 flex items-center gap-4 flex-shrink-0 animate-slide-left"
        style={{ background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.09)", backdropFilter: "blur(18px)" }}>
        <PersonAvatar photo={personPhoto} name={challenge.name} size={64} />
        <div className="flex-1 min-w-0">
          <p className="text-[0.6rem] font-bold tracking-[0.18em] uppercase mb-0.5" style={{ color: "#e8a000" }}>{typeLabel}</p>
          <h2 className="text-xl font-black leading-tight text-[#f0f0f0] truncate">{challenge.name}</h2>
          <p className="text-xs mt-1" style={{ color: "#777" }}>
            Highest <span style={{ color: "#e8a000" }} className="font-semibold">IMDB</span> rating?
            <span className="hidden sm:inline ml-2" style={{ color: "#444" }}>(keys 1–4)</span>
          </p>
        </div>
      </div>

      {/* 2×2 movie grid — key={round} triggers slide-in animation */}
      {phase === "loading" ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-sm animate-pulse" style={{ color: "#555" }}>Loading films…</div>
        </div>
      ) : (
        <div key={`grid-${round}`} className="grid grid-cols-2 grid-rows-2 gap-3 flex-1 min-h-0">
          {movies.map((movie, idx) => {
            // Tie-safe: all movies matching max rating are winners
            const isWinner  = phase === "revealing" && ratings[idx] === maxRating;
            const isPicked  = picked === idx;
            const isCorrect = isPicked && ratings[idx] === maxRating;
            const isWrong   = isPicked && ratings[idx] !== maxRating;
            const rank      = rankOf(idx);
            const dimmed    = !isPicked && phase === "revealing" && !isWinner;

            let borderColor = "rgba(255,255,255,0.09)";
            if (isCorrect) borderColor = "rgba(34,197,94,0.7)";
            else if (isWrong)                             borderColor = "rgba(239,68,68,0.6)";
            else if (isWinner && phase === "revealing")   borderColor = "rgba(34,197,94,0.4)";

            // Staggered spring entrance per card
            const staggerDelay = `${idx * 70}ms`;

            return (
              <button
                key={movie.imdbId}
                onClick={() => handlePick(idx)}
                disabled={phase !== "choosing"}
                className={[
                  "relative overflow-hidden rounded-2xl border transition-all duration-200 text-left animate-card-in",
                  phase === "choosing" ? "hover:scale-[1.02] hover:brightness-110 cursor-pointer active:scale-[0.98]" : "cursor-default",
                  dimmed ? "opacity-35" : "",
                ].filter(Boolean).join(" ")}
                style={{ borderColor, borderWidth: "1px", animationDelay: staggerDelay }}
              >
                {/* Full-bleed poster */}
                <div className="absolute inset-0 bg-[#181818]">
                  {movie.poster && movie.poster !== "N/A" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={movie.poster} alt={movie.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-4xl opacity-20">🎬</span>
                    </div>
                  )}
                </div>

                {/* Key number badge (choosing phase) */}
                {phase === "choosing" && (
                  <div className="absolute top-2 left-2 z-10 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black"
                    style={{ background: "rgba(0,0,0,0.72)", color: "#888" }}>
                    {idx + 1}
                  </div>
                )}

                {/* Gradient title overlay at bottom */}
                {phase === "choosing" && (
                  <div className="absolute bottom-0 left-0 right-0 z-10 px-2.5 pt-8 pb-2.5"
                    style={{ background: "linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.5) 55%, transparent 100%)" }}>
                    <p className="font-bold text-xs leading-tight line-clamp-2 text-white">{movie.title}</p>
                    <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>{movie.year}</p>
                  </div>
                )}

                {/* Reveal overlay */}
                {phase === "revealing" && (
                  <div className="absolute inset-0 z-20 flex flex-col items-center justify-center animate-pop"
                    style={{ background: isWinner ? "rgba(5,46,22,0.93)" : "rgba(13,13,13,0.9)" }}>
                    <p className="text-3xl font-black" style={{ color: isWinner ? "#e8a000" : "#555" }}>
                      ⭐ {movie.imdbRating}
                    </p>
                    <p className="text-xs font-bold mt-1" style={{ color: isWinner ? "#e8a000" : "#444" }}>
                      {ordinal(rank)}
                    </p>
                    <p className="font-semibold text-[11px] mt-2 px-3 text-center leading-tight line-clamp-2"
                      style={{ color: isWinner ? "rgba(255,255,255,0.9)" : "#555" }}>
                      {movie.title}
                    </p>
                    <p className="text-[10px] mt-0.5" style={{ color: isWinner ? "rgba(255,255,255,0.4)" : "#333" }}>
                      {movie.year}
                    </p>
                    {isCorrect && <p className="text-green-400 text-xs font-bold mt-2">✓ Correct!</p>}
                    {isWrong   && <p className="text-red-400   text-xs font-bold mt-2">✗ Wrong</p>}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Fixed-height slot — always present to prevent layout jump on reveal */}
      <div className="flex-shrink-0" style={{ minHeight: 64 }}>
        {phase === "revealing" && (
          <AutoNextButton
            onNext={handleNext}
            delay={3500}
            label="Next →"
            endLabel="See Results 🏆"
            isLast={round + 1 >= ROUNDS}
          />
        )}
      </div>
    </div>
  );
}
