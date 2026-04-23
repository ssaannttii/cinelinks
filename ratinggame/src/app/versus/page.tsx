"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

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

// ── Component ────────────────────────────────────────────────────────────────

export default function VersusPage() {
  const router = useRouter();

  // Stable refs (no re-render on change)
  const cacheRef = useRef<Record<string, Movie>>({});
  const fetchingRef = useRef<Set<string>>(new Set());
  const pairsRef = useRef<[string, string][]>([]);

  // Game state
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
          if (cacheRef.current[id]) {
            clearInterval(poll);
            resolve(cacheRef.current[id]);
          }
        }, 50);
      });
    }

    fetchingRef.current.add(id);
    const res = await fetch(`/api/movie?id=${id}`);
    const data: Movie = await res.json();
    cacheRef.current[id] = data;
    return data;
  }, []);

  const loadRound = useCallback(
    async (idx: number) => {
      const pair = pairsRef.current[idx];
      if (!pair) return;

      setPhase("loading");
      const [l, r] = await Promise.all([fetchMovie(pair[0]), fetchMovie(pair[1])]);
      setLeftMovie(l);
      setRightMovie(r);
      setPick(null);
      setPhase("choosing");

      // Prefetch next pair in background
      const next = pairsRef.current[idx + 1];
      if (next) next.forEach((id) => fetchMovie(id));
    },
    [fetchMovie]
  );

  // ── Init ──────────────────────────────────────────────────────────────────

  const initGame = useCallback(() => {
    fetch("/api/session?count=20")
      .then((r) => r.json())
      .then((d) => {
        const ids: string[] = d.movies.map((m: { imdbId: string }) => m.imdbId);
        const pairs: [string, string][] = [];
        for (let i = 0; i + 1 < ids.length && pairs.length < ROUNDS; i += 2) {
          pairs.push([ids[i], ids[i + 1]]);
        }
        pairsRef.current = pairs;
        loadRound(0);
      });
  }, [loadRound]);

  useEffect(() => {
    initGame();
  }, [initGame]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handlePick = (side: "left" | "right") => {
    if (phase !== "choosing" || !leftMovie || !rightMovie) return;

    const lr = parseFloat(leftMovie.imdbRating) || 0;
    const rr = parseFloat(rightMovie.imdbRating) || 0;
    const winner: "left" | "right" | "tie" =
      lr > rr ? "left" : rr > lr ? "right" : "tie";
    const correct = winner === "tie" || side === winner;

    setPick(side);
    setPhase("revealing");

    const newStreak = correct ? streak + 1 : 0;
    setStreak(newStreak);
    setMaxStreak((s) => Math.max(s, newStreak));
    if (correct) setScore((s) => s + 1);

    setResults((prev) => [
      ...prev,
      {
        correct,
        left: { title: leftMovie.title, rating: leftMovie.imdbRating },
        right: { title: rightMovie.title, rating: rightMovie.imdbRating },
        pick: side,
      },
    ]);
  };

  const handleNext = () => {
    const next = round + 1;
    if (next >= ROUNDS || next >= pairsRef.current.length) {
      setPhase("done");
      return;
    }
    setRound(next);
    loadRound(next);
  };

  const handleRestart = () => {
    cacheRef.current = {};
    fetchingRef.current = new Set();
    pairsRef.current = [];
    setRound(0);
    setScore(0);
    setStreak(0);
    setMaxStreak(0);
    setResults([]);
    setLeftMovie(null);
    setRightMovie(null);
    initGame();
  };

  // ── Render: Loading ───────────────────────────────────────────────────────

  if (phase === "loading" && !leftMovie) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="text-4xl animate-pulse">🆚</div>
          <p className="text-zinc-400 text-sm">Loading matchup…</p>
        </div>
      </div>
    );
  }

  // ── Render: Done ──────────────────────────────────────────────────────────

  if (phase === "done") {
    const grade =
      score >= 9
        ? { label: "Uncanny Instinct 🔮", color: "text-purple-400" }
        : score >= 7
        ? { label: "Sharp Eye 🎯", color: "text-green-400" }
        : score >= 5
        ? { label: "Decent Pick 👍", color: "text-yellow-400" }
        : { label: "Coin Flipper 🪙", color: "text-zinc-500" };

    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <div className="text-5xl mb-3">🆚</div>
            <h2 className="text-3xl font-black mb-1">Done!</h2>
            <p className={`text-xl font-bold ${grade.color}`}>{grade.label}</p>
            <p className="text-5xl font-black mt-4">
              {score}
              <span className="text-zinc-500 text-xl font-normal"> / {ROUNDS}</span>
            </p>
            {maxStreak >= 3 && (
              <p className="text-sm text-orange-400 mt-2">Best streak: {maxStreak} 🔥</p>
            )}
          </div>

          {/* Per-round summary */}
          <div className="space-y-2 mb-8 max-h-72 overflow-y-auto">
            {results.map((r, i) => {
              const lr = parseFloat(r.left.rating) || 0;
              const rr = parseFloat(r.right.rating) || 0;
              const winner = lr > rr ? "left" : rr > lr ? "right" : "tie";
              return (
                <div
                  key={i}
                  className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs ${
                    r.correct
                      ? "bg-green-950/40 border border-green-900/30"
                      : "bg-red-950/40 border border-red-900/30"
                  }`}
                >
                  <span className={r.correct ? "text-green-400 font-bold" : "text-red-400 font-bold"}>
                    {r.correct ? "✓" : "✗"}
                  </span>
                  <span
                    className={`flex-1 truncate ${
                      r.pick === "left" ? "font-semibold text-white" : "text-zinc-500"
                    }`}
                  >
                    {r.left.title}{" "}
                    <span className={winner === "left" ? "text-yellow-400" : "text-zinc-600"}>
                      ({r.left.rating})
                    </span>
                  </span>
                  <span className="text-zinc-700 text-[10px] flex-shrink-0">vs</span>
                  <span
                    className={`flex-1 truncate text-right ${
                      r.pick === "right" ? "font-semibold text-white" : "text-zinc-500"
                    }`}
                  >
                    {r.right.title}{" "}
                    <span className={winner === "right" ? "text-yellow-400" : "text-zinc-600"}>
                      ({r.right.rating})
                    </span>
                  </span>
                </div>
              );
            })}
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleRestart}
              className="flex-1 bg-yellow-400 text-black font-bold py-3 rounded-xl hover:bg-yellow-300 transition-colors"
            >
              Play Again
            </button>
            <button
              onClick={() => router.push("/")}
              className="flex-1 bg-zinc-800 text-white font-bold py-3 rounded-xl hover:bg-zinc-700 transition-colors"
            >
              Home
            </button>
          </div>
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
    <div className="min-h-screen flex flex-col px-3 py-4 max-w-2xl mx-auto w-full">
      {/* Header */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <button
            onClick={() => router.push("/")}
            className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors"
          >
            ← Back
          </button>
          <div className="flex items-center gap-3">
            {streak >= 2 && (
              <span className="text-sm font-bold text-orange-400">{streak} 🔥</span>
            )}
            <span className="text-sm text-zinc-400">
              {round + 1} / {ROUNDS}
            </span>
            <span className="text-sm font-bold text-green-400">{score} ✓</span>
          </div>
        </div>
        <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-yellow-400 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <p className="text-center text-zinc-500 text-sm mb-4">
        Which has the higher{" "}
        <span className="text-yellow-400 font-semibold">IMDB rating</span>?
      </p>

      {/* Cards */}
      <div className="flex gap-2 items-stretch flex-1">
        {(["left", "right"] as const).map((side) => {
          const movie = side === "left" ? leftMovie : rightMovie;
          const movieRating = side === "left" ? lr : rr;
          const isWinner = phase === "revealing" && (winner === side || winner === "tie");
          const isLoser = phase === "revealing" && winner !== "tie" && winner !== side;
          const isPicked = pick === side;
          const isCorrect = isPicked && (winner === side || winner === "tie");
          const isWrong = isPicked && !isCorrect;

          return (
            <button
              key={side}
              onClick={() => handlePick(side)}
              disabled={phase !== "choosing"}
              className={[
                "flex-1 flex flex-col rounded-2xl overflow-hidden border-2 transition-all duration-200 text-left",
                phase === "choosing"
                  ? "hover:border-yellow-400/50 hover:scale-[1.01] cursor-pointer border-zinc-800"
                  : "cursor-default",
                isCorrect ? "border-green-400 scale-[1.01]" : "",
                isWrong ? "border-red-500 opacity-70" : "",
                !isPicked && isLoser ? "opacity-40 border-zinc-800" : "",
                !isPicked && isWinner && phase === "revealing" ? "border-green-800" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {/* Poster */}
              <div className="relative bg-zinc-900 overflow-hidden" style={{ height: 280 }}>
                {movie.poster && movie.poster !== "N/A" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={movie.poster}
                    alt={movie.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-5xl">🎬</span>
                  </div>
                )}

                {/* Rating overlay */}
                {phase === "revealing" && (
                  <div
                    className={`absolute inset-0 flex flex-col items-center justify-center animate-pop ${
                      isWinner ? "bg-green-950/90" : "bg-zinc-950/85"
                    }`}
                  >
                    <p
                      className={`text-4xl font-black ${
                        isWinner ? "text-green-400" : "text-zinc-400"
                      }`}
                    >
                      ⭐ {movieRating.toFixed(1)}
                    </p>
                    {isCorrect && (
                      <p className="text-green-300 font-bold text-sm mt-2">✓ Correct!</p>
                    )}
                    {isWrong && (
                      <p className="text-red-400 font-bold text-sm mt-2">✗ Wrong</p>
                    )}
                    {!isPicked && isWinner && (
                      <p className="text-green-400/70 text-xs mt-1">Higher rated</p>
                    )}
                  </div>
                )}
              </div>

              {/* Info bar */}
              <div className="p-3 bg-zinc-900 flex-1">
                <p className="font-bold text-sm leading-tight line-clamp-2">{movie.title}</p>
                <p className="text-xs text-zinc-500 mt-0.5">{movie.year}</p>
                {movie.genre && movie.genre !== "N/A" && (
                  <p className="text-xs text-zinc-700 mt-1 truncate">
                    {movie.genre.split(", ")[0]}
                  </p>
                )}
              </div>
            </button>
          );
        })}

        {/* VS divider */}
        {phase === "choosing" && (
          <div className="absolute left-1/2 -translate-x-1/2 flex items-center" style={{ top: "calc(50% + 60px)" }}>
            <div className="bg-zinc-950 border-2 border-zinc-700 rounded-full w-9 h-9 flex items-center justify-center pointer-events-none z-10">
              <span className="text-[10px] font-black text-zinc-400">VS</span>
            </div>
          </div>
        )}
      </div>

      {/* Next button */}
      {phase === "revealing" && (
        <button
          onClick={handleNext}
          className="mt-4 w-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 rounded-xl transition-colors"
        >
          {round + 1 >= ROUNDS ? "See Results 🏆" : "Next →"}
        </button>
      )}
    </div>
  );
}
