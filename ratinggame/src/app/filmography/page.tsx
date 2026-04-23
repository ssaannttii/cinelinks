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
  director: string;
}

interface Challenge {
  name: string;
  type: "director" | "actor";
  emoji: string;
  movieIds: string[];
}

type Phase = "loading" | "choosing" | "revealing" | "done";

interface RoundResult {
  correct: boolean;
  personName: string;
  personEmoji: string;
  winnerTitle: string;
  winnerRating: string;
  pickedTitle: string;
}

const ROUNDS = 10;

// ── Helpers ───────────────────────────────────────────────────────────────────

function ordinal(n: number) {
  return ["1st", "2nd", "3rd", "4th"][n] ?? `${n + 1}th`;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function FilmographyPage() {
  const router = useRouter();

  const cacheRef = useRef<Record<string, Movie>>({});
  const fetchingRef = useRef<Set<string>>(new Set());
  const challengesRef = useRef<Challenge[]>([]);

  const [phase, setPhase] = useState<Phase>("loading");
  const [round, setRound] = useState(0);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [movies, setMovies] = useState<Movie[]>([]);
  const [picked, setPicked] = useState<number | null>(null); // index into movies[]
  const [score, setScore] = useState(0);
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
      const ch = challengesRef.current[idx];
      if (!ch) return;

      setPhase("loading");
      setChallenge(ch);
      setPicked(null);

      const fetched = await Promise.all(ch.movieIds.map((id) => fetchMovie(id)));
      setMovies(fetched);
      setPhase("choosing");

      // Prefetch next round's movies in background
      const next = challengesRef.current[idx + 1];
      if (next) next.movieIds.forEach((id) => fetchMovie(id));
    },
    [fetchMovie]
  );

  // ── Init ──────────────────────────────────────────────────────────────────

  const initGame = useCallback(() => {
    fetch(`/api/filmography?count=${ROUNDS}`)
      .then((r) => r.json())
      .then((d: { challenges: Challenge[] }) => {
        challengesRef.current = d.challenges;
        loadRound(0);
      });
  }, [loadRound]);

  useEffect(() => {
    initGame();
  }, [initGame]);

  // ── Pick handler ──────────────────────────────────────────────────────────

  const handlePick = (idx: number) => {
    if (phase !== "choosing") return;

    const ratings = movies.map((m) => parseFloat(m.imdbRating) || 0);
    const maxRating = Math.max(...ratings);
    const winnerIdx = ratings.indexOf(maxRating);
    const correct = idx === winnerIdx;

    setPicked(idx);
    setPhase("revealing");
    if (correct) setScore((s) => s + 1);

    const winner = movies[winnerIdx];
    const picked_ = movies[idx];
    setResults((prev) => [
      ...prev,
      {
        correct,
        personName: challenge!.name,
        personEmoji: challenge!.emoji,
        winnerTitle: winner.title,
        winnerRating: winner.imdbRating,
        pickedTitle: picked_.title,
      },
    ]);
  };

  const handleNext = () => {
    const next = round + 1;
    if (next >= ROUNDS || next >= challengesRef.current.length) {
      setPhase("done");
      return;
    }
    setRound(next);
    loadRound(next);
  };

  const handleRestart = () => {
    cacheRef.current = {};
    fetchingRef.current = new Set();
    challengesRef.current = [];
    setRound(0);
    setScore(0);
    setResults([]);
    setChallenge(null);
    setMovies([]);
    setPicked(null);
    initGame();
  };

  // ── Render: Loading ───────────────────────────────────────────────────────

  if (phase === "loading" && !challenge) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="text-4xl animate-pulse">🎬</div>
          <p className="text-zinc-400 text-sm">Loading filmography…</p>
        </div>
      </div>
    );
  }

  // ── Render: Done ──────────────────────────────────────────────────────────

  if (phase === "done") {
    const grade =
      score >= 9
        ? { label: "Film Archivist 📚", color: "text-purple-400" }
        : score >= 7
        ? { label: "Cinephile 🎬", color: "text-green-400" }
        : score >= 5
        ? { label: "Movie Buff 🍿", color: "text-yellow-400" }
        : { label: "Casual Viewer 👀", color: "text-zinc-400" };

    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <div className="text-5xl mb-3">🎬</div>
            <h2 className="text-3xl font-black mb-1">Filmography Done</h2>
            <p className={`text-xl font-bold ${grade.color}`}>{grade.label}</p>
            <p className="text-5xl font-black mt-4">
              {score}
              <span className="text-zinc-500 text-xl font-normal"> / {ROUNDS}</span>
            </p>
          </div>

          <div className="space-y-2 mb-8 max-h-72 overflow-y-auto">
            {results.map((r, i) => (
              <div
                key={i}
                className={`flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs ${
                  r.correct
                    ? "bg-green-950/40 border border-green-900/30"
                    : "bg-red-950/40 border border-red-900/30"
                }`}
              >
                <span className={`font-bold mt-0.5 ${r.correct ? "text-green-400" : "text-red-400"}`}>
                  {r.correct ? "✓" : "✗"}
                </span>
                <div className="flex-1">
                  <span className="text-zinc-400">
                    {r.personEmoji} {r.personName}:
                  </span>{" "}
                  <span className="text-yellow-400 font-semibold">{r.winnerTitle}</span>{" "}
                  <span className="text-zinc-600">({r.winnerRating})</span>
                  {!r.correct && (
                    <p className="text-zinc-600 mt-0.5">
                      You picked: <span className="text-zinc-400">{r.pickedTitle}</span>
                    </p>
                  )}
                </div>
              </div>
            ))}
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

  if (!challenge || movies.length === 0) return null;

  // ── Render: Active Round ──────────────────────────────────────────────────

  const ratings = movies.map((m) => parseFloat(m.imdbRating) || 0);
  const maxRating = Math.max(...ratings);
  const winnerIdx = ratings.indexOf(maxRating);
  // Ranked indices (highest first)
  const ranked = [...ratings.map((r, i) => ({ r, i }))]
    .sort((a, b) => b.r - a.r)
    .map((x) => x.i);
  const rankOf = (idx: number) => ranked.indexOf(idx);

  const progress = ((round + 1) / ROUNDS) * 100;
  const typeLabel = challenge.type === "director" ? "director" : "actor";

  return (
    <div className="min-h-screen flex flex-col px-4 py-4 max-w-2xl mx-auto w-full">
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

      {/* Person info */}
      <div className="text-center mb-5">
        <span className="text-3xl">{challenge.emoji}</span>
        <h2 className="text-xl font-black mt-1">{challenge.name}</h2>
        <p className="text-zinc-500 text-sm capitalize">{typeLabel}</p>
        <p className="text-zinc-400 text-sm mt-2">
          Which film has the highest{" "}
          <span className="text-yellow-400 font-semibold">IMDB rating</span>?
        </p>
      </div>

      {/* 2×2 Movie grid */}
      {phase === "loading" ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-zinc-600 animate-pulse text-sm">Loading films…</div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 flex-1">
          {movies.map((movie, idx) => {
            const isWinner = phase === "revealing" && idx === winnerIdx;
            const isPicked = picked === idx;
            const isCorrect = isPicked && idx === winnerIdx;
            const isWrong = isPicked && idx !== winnerIdx;
            const rank = rankOf(idx);

            return (
              <button
                key={movie.imdbId}
                onClick={() => handlePick(idx)}
                disabled={phase !== "choosing"}
                className={[
                  "flex flex-col rounded-2xl overflow-hidden border-2 transition-all duration-200 text-left",
                  phase === "choosing"
                    ? "hover:border-yellow-400/50 hover:scale-[1.02] cursor-pointer border-zinc-800"
                    : "cursor-default",
                  isCorrect ? "border-green-400 scale-[1.01]" : "",
                  isWrong ? "border-red-500 opacity-70" : "",
                  !isPicked && phase === "revealing" && !isWinner ? "opacity-50 border-zinc-800" : "",
                  !isPicked && isWinner ? "border-green-700" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {/* Poster */}
                <div className="relative bg-zinc-900" style={{ height: 180 }}>
                  {movie.poster && movie.poster !== "N/A" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={movie.poster}
                      alt={movie.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-4xl">🎬</span>
                    </div>
                  )}

                  {/* Reveal overlay */}
                  {phase === "revealing" && (
                    <div
                      className={`absolute inset-0 flex flex-col items-center justify-center animate-pop ${
                        isWinner ? "bg-green-950/90" : "bg-zinc-950/80"
                      }`}
                    >
                      <p
                        className={`text-3xl font-black ${
                          isWinner ? "text-green-400" : "text-zinc-400"
                        }`}
                      >
                        ⭐ {movie.imdbRating}
                      </p>
                      <p
                        className={`text-xs font-semibold mt-1 ${
                          isWinner ? "text-green-300" : "text-zinc-500"
                        }`}
                      >
                        {ordinal(rank)}
                      </p>
                      {isCorrect && (
                        <p className="text-green-300 text-xs font-bold mt-1">✓ Correct!</p>
                      )}
                      {isWrong && (
                        <p className="text-red-400 text-xs font-bold mt-1">✗ Wrong</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-2.5 bg-zinc-900 flex-1">
                  <p className="font-bold text-xs leading-tight line-clamp-2">{movie.title}</p>
                  <p className="text-[10px] text-zinc-500 mt-0.5">{movie.year}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Next button */}
      {phase === "revealing" && (
        <button
          onClick={handleNext}
          className="mt-4 w-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 rounded-xl transition-colors"
        >
          {round + 1 >= ROUNDS ? "See Results 🏆" : "Next Director →"}
        </button>
      )}
    </div>
  );
}
