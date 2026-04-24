"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import AutoNextButton from "@/components/AutoNextButton";
import ShareButton from "@/components/ShareButton";

// ── Types ────────────────────────────────────────────────────────────────────

interface Movie {
  imdbId: string;
  title: string;
  year: string;
  poster: string;
  imdbRating: string;
  genre: string;
}

type Phase = "loading" | "choosing" | "revealing" | "done";

interface RoundResult {
  correct: boolean;
  left: { title: string; rating: string };
  right: { title: string; rating: string };
  pick: "left" | "right";
}

const ROUNDS = 10;

function buildShareText(score: number, results: RoundResult[]) {
  const squares = results.map((r) => (r.correct ? "🟩" : "🟥")).join("");
  return `CineRating: Higher or Lower\n${score}/${ROUNDS}\n${squares}\nhttps://cinerating.vercel.app/versus`;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function VersusPage() {
  const router = useRouter();

  const cacheRef = useRef<Record<string, Movie>>({});
  const fetchingRef = useRef<Set<string>>(new Set());
  const pairsRef = useRef<[string, string][]>([]);

  const [phase, setPhase] = useState<Phase>("loading");
  const [round, setRound] = useState(0);
  const [leftMovie, setLeftMovie] = useState<Movie | null>(null);
  const [rightMovie, setRightMovie] = useState<Movie | null>(null);
  const [pick, setPick] = useState<"left" | "right" | null>(null);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [results, setResults] = useState<RoundResult[]>([]);

  // ── Movie fetching ─────────────────────────────────────────────────────────

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

  const loadRound = useCallback(async (idx: number) => {
    const pair = pairsRef.current[idx];
    if (!pair) return;
    setPhase("loading");
    const [l, r] = await Promise.all([fetchMovie(pair[0]), fetchMovie(pair[1])]);
    setLeftMovie(l);
    setRightMovie(r);
    setPick(null);
    setPhase("choosing");
    const next = pairsRef.current[idx + 1];
    if (next) next.forEach((id) => fetchMovie(id));
  }, [fetchMovie]);

  const initGame = useCallback(() => {
    fetch("/api/session?count=20")
      .then((r) => r.json())
      .then((d) => {
        const ids: string[] = d.movies.map((m: { imdbId: string }) => m.imdbId);
        const pairs: [string, string][] = [];
        for (let i = 0; i + 1 < ids.length && pairs.length < ROUNDS; i += 2) pairs.push([ids[i], ids[i + 1]]);
        pairsRef.current = pairs;
        loadRound(0);
      });
  }, [loadRound]);

  useEffect(() => { initGame(); }, [initGame]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleNext = useCallback(() => {
    const next = round + 1;
    if (next >= ROUNDS || next >= pairsRef.current.length) { setPhase("done"); return; }
    setRound(next);
    loadRound(next);
  }, [round, loadRound]);

  const handlePick = useCallback((side: "left" | "right") => {
    setLeftMovie((lm) => {
      setRightMovie((rm) => {
        if (!lm || !rm) return rm;
        const lr = parseFloat(lm.imdbRating) || 0;
        const rr = parseFloat(rm.imdbRating) || 0;
        const winner: "left" | "right" | "tie" = lr > rr ? "left" : rr > lr ? "right" : "tie";
        const correct = winner === "tie" || side === winner;
        setPick(side);
        setPhase("revealing");
        setStreak((s) => {
          const ns = correct ? s + 1 : 0;
          setMaxStreak((ms) => Math.max(ms, ns));
          return ns;
        });
        if (correct) setScore((s) => s + 1);
        setResults((prev) => [
          ...prev,
          { correct, left: { title: lm.title, rating: lm.imdbRating }, right: { title: rm.title, rating: rm.imdbRating }, pick: side },
        ]);
        return rm;
      });
      return lm;
    });
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "a" || e.key === "1") handlePick("left");
      if (e.key === "ArrowRight" || e.key === "d" || e.key === "2") handlePick("right");
      if ((e.key === " " || e.key === "Enter") && (document.activeElement === document.body || document.activeElement?.tagName === "BUTTON")) {
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handlePick]);

  const handleRestart = () => {
    cacheRef.current = {}; fetchingRef.current = new Set(); pairsRef.current = [];
    setRound(0); setScore(0); setStreak(0); setMaxStreak(0); setResults([]);
    setLeftMovie(null); setRightMovie(null);
    initGame();
  };

  // ── Render: Loading ───────────────────────────────────────────────────────

  if (phase === "loading" && !leftMovie) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0d0d0d" }}>
        <div className="text-center space-y-4">
          <div className="relative w-14 h-14 mx-auto">
            <div className="absolute inset-0 rounded-lg border-2 border-t-[#e8a000] border-r-[rgba(232,160,0,0.4)] border-b-transparent border-l-transparent animate-spin" />
            <div className="absolute inset-3 rounded-full animate-pulse" style={{ background: "rgba(232,160,0,0.1)" }} />
          </div>
          <p className="text-sm font-medium" style={{ color: "#777" }}>Loading matchup…</p>
        </div>
      </div>
    );
  }

  // ── Render: Done ──────────────────────────────────────────────────────────

  if (phase === "done") {
    const grade =
      score >= 9 ? { label: "Uncanny Instinct", sub: "Almost telepathic", color: "text-purple-400" } :
      score >= 7 ? { label: "Sharp Eye", sub: "You read ratings well", color: "text-[#e8a000]" } :
      score >= 5 ? { label: "Decent Pick", sub: "More right than wrong", color: "text-green-400" } :
                   { label: "Coin Flipper", sub: "Unlucky guesses", color: "text-[#777]" };

    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12" style={{ background: "#0d0d0d" }}>
        <div className="max-w-md w-full rounded-2xl p-6" style={{ background: "rgba(255,255,255,0.045)", backdropFilter: "blur(18px)", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 30px 80px rgba(0,0,0,0.38)" }}>
          <div className="text-center mb-6">
            <p className="text-[0.6rem] font-bold tracking-[0.18em] uppercase mb-3" style={{ color: "#e8a000" }}>Higher or Lower</p>
            <p className={`text-2xl font-black mb-0.5 ${grade.color}`}>{grade.label}</p>
            <p className="text-sm" style={{ color: "#777" }}>{grade.sub}</p>
            <p className="text-6xl font-black mt-4 text-[#f0f0f0]">
              {score}<span className="text-2xl font-normal" style={{ color: "#777" }}> / {ROUNDS}</span>
            </p>
            {maxStreak >= 3 && <p className="text-sm mt-2" style={{ color: "#e8a000" }}>Best streak: {maxStreak} 🔥</p>}
          </div>

          <div className="space-y-2 mb-5 max-h-64 overflow-y-auto">
            {results.map((r, i) => {
              const lr = parseFloat(r.left.rating) || 0;
              const rr = parseFloat(r.right.rating) || 0;
              const winner = lr > rr ? "left" : rr > lr ? "right" : "tie";
              return (
                <div key={i} className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs"
                  style={{ background: r.correct ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)", border: r.correct ? "1px solid rgba(34,197,94,0.2)" : "1px solid rgba(239,68,68,0.2)" }}>
                  <span className={r.correct ? "text-green-400 font-bold" : "text-red-400 font-bold"}>{r.correct ? "✓" : "✗"}</span>
                  <span className={`flex-1 truncate ${r.pick === "left" ? "font-semibold text-[#f0f0f0]" : "text-[#555]"}`}>
                    {r.left.title} <span style={{ color: winner === "left" ? "#e8a000" : "#444" }}>({r.left.rating})</span>
                  </span>
                  <span className="text-[#444] text-[10px] flex-shrink-0">vs</span>
                  <span className={`flex-1 truncate text-right ${r.pick === "right" ? "font-semibold text-[#f0f0f0]" : "text-[#555]"}`}>
                    {r.right.title} <span style={{ color: winner === "right" ? "#e8a000" : "#444" }}>({r.right.rating})</span>
                  </span>
                </div>
              );
            })}
          </div>

          <div className="flex gap-3 mb-3">
            <button onClick={handleRestart} className="flex-1 font-bold py-3 rounded-xl transition-all hover:opacity-85" style={{ background: "#e8a000", color: "#111" }}>Play Again</button>
            <button onClick={() => router.push("/")} className="flex-1 font-bold py-3 rounded-xl transition-all hover:opacity-85" style={{ background: "transparent", color: "#f0f0f0", border: "1px solid rgba(255,255,255,0.09)" }}>Home</button>
          </div>
          <ShareButton text={buildShareText(score, results)} className="w-full" />
        </div>
      </div>
    );
  }

  if (!leftMovie || !rightMovie) return null;

  // ── Render: Active Round ──────────────────────────────────────────────────

  const lr = parseFloat(leftMovie.imdbRating) || 0;
  const rr = parseFloat(rightMovie.imdbRating) || 0;
  const winner: "left" | "right" | "tie" = lr > rr ? "left" : rr > lr ? "right" : "tie";
  const progress = ((round + 1) / ROUNDS) * 100;

  return (
    <div className="min-h-screen flex flex-col px-3 py-4 max-w-2xl mx-auto w-full" style={{ background: "#0d0d0d" }}>
      {/* Header */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <button onClick={() => router.push("/")} className="text-sm font-medium hover:opacity-80 transition-opacity" style={{ color: "#777" }}>← Back</button>
          <div className="flex items-center gap-3">
            {streak >= 2 && <span className="text-sm font-bold" style={{ color: "#e8a000" }}>{streak} 🔥</span>}
            <span className="text-sm" style={{ color: "#777" }}>{round + 1} / {ROUNDS}</span>
            <span className="text-sm font-bold text-green-400">{score} ✓</span>
          </div>
        </div>
        <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress}%`, background: "#e8a000" }} />
        </div>
      </div>

      <p className="text-center text-sm mb-3" style={{ color: "#777" }}>
        Which has the higher <span style={{ color: "#e8a000" }} className="font-semibold">IMDB rating</span>?
        <span className="hidden sm:inline text-xs ml-2" style={{ color: "#444" }}>(← → keys)</span>
      </p>

      {/* Cards — fill all remaining vertical space */}
      <div className="relative flex gap-2 flex-1 min-h-0">
        {(["left", "right"] as const).map((side) => {
          const movie = side === "left" ? leftMovie : rightMovie;
          const movieRating = side === "left" ? lr : rr;
          const isWinner = phase === "revealing" && (winner === side || winner === "tie");
          const isLoser = phase === "revealing" && winner !== "tie" && winner !== side;
          const isPicked = pick === side;
          const isCorrect = isPicked && (winner === side || winner === "tie");
          const isWrong = isPicked && !isCorrect;

          let borderColor = "rgba(255,255,255,0.09)";
          if (isCorrect) borderColor = "rgba(34,197,94,0.7)";
          else if (isWrong) borderColor = "rgba(239,68,68,0.6)";
          else if (!isPicked && isWinner && phase === "revealing") borderColor = "rgba(34,197,94,0.3)";

          return (
            <button
              key={side}
              onClick={() => handlePick(side)}
              disabled={phase !== "choosing"}
              className={[
                "flex-1 flex flex-col rounded-2xl overflow-hidden border transition-all duration-200 text-left min-h-0",
                phase === "choosing" ? "hover:scale-[1.01] cursor-pointer" : "cursor-default",
                !isPicked && isLoser ? "opacity-35" : "",
              ].filter(Boolean).join(" ")}
              style={{ borderColor, borderWidth: "1px", background: "rgba(255,255,255,0.03)" }}
            >
              {/* Poster — grows to fill all card height */}
              <div className="relative flex-1 min-h-0" style={{ background: "#181818" }}>
                {movie.poster && movie.poster !== "N/A" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={movie.poster}
                    alt={movie.title}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-5xl opacity-20">🎬</span>
                  </div>
                )}

                {phase === "revealing" && (
                  <div
                    className="absolute inset-0 flex flex-col items-center justify-center animate-pop"
                    style={{ background: isWinner ? "rgba(5,46,22,0.92)" : "rgba(13,13,13,0.88)" }}
                  >
                    <p className="text-4xl font-black" style={{ color: isWinner ? "#e8a000" : "#555" }}>
                      ⭐ {movieRating.toFixed(1)}
                    </p>
                    {isCorrect && <p className="text-green-400 font-bold text-sm mt-2">✓ Correct!</p>}
                    {isWrong && <p className="text-red-400 font-bold text-sm mt-2">✗ Wrong</p>}
                    {!isPicked && isWinner && (
                      <p className="text-xs mt-1" style={{ color: "rgba(232,160,0,0.6)" }}>Higher rated</p>
                    )}
                  </div>
                )}
              </div>

              {/* Info strip — fixed at bottom, never grows */}
              <div className="flex-shrink-0 p-3" style={{ background: "rgba(0,0,0,0.5)" }}>
                <p className="font-bold text-sm leading-tight line-clamp-1 text-[#f0f0f0]">{movie.title}</p>
                <p className="text-xs mt-0.5" style={{ color: "#666" }}>
                  {movie.year}
                  {movie.genre && movie.genre !== "N/A" && (
                    <span style={{ color: "#444" }}> · {movie.genre.split(", ")[0]}</span>
                  )}
                </p>
              </div>
            </button>
          );
        })}

        {/* VS badge — sits in the poster area at centre */}
        {phase === "choosing" && (
          <div className="absolute left-1/2 -translate-x-1/2 z-10 pointer-events-none"
            style={{ bottom: "52px" }}>
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center shadow-lg"
              style={{ background: "#0d0d0d", border: "2px solid rgba(255,255,255,0.15)" }}
            >
              <span className="text-[10px] font-black" style={{ color: "#666" }}>VS</span>
            </div>
          </div>
        )}
      </div>

      {phase === "revealing" && (
        <AutoNextButton
          onNext={handleNext}
          delay={3000}
          label="Next →"
          endLabel="See Results 🏆"
          isLast={round + 1 >= ROUNDS}
        />
      )}
    </div>
  );
}
