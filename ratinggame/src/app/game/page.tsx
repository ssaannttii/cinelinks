"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";

// ─── Types ──────────────────────────────────────────────────────────────────

interface MovieData {
  imdbId: string;
  title: string;
  year: string;
  rated: string;
  runtime: string;
  genre: string;
  director: string;
  plot: string;
  poster: string;
  imdbRating: string;
  rtRating: string;
  metacritic: string;
}

interface Round {
  movie: MovieData;
  imdbGuess?: number;
  rtGuess?: number;
  imdbPoints?: number;
  rtPoints?: number;
  totalPoints?: number;
  revealed: boolean;
}

type GameMode = "imdb" | "rt" | "both";

// ─── Scoring ────────────────────────────────────────────────────────────────

function scoreImdb(guess: number, actual: string): number {
  const a = parseFloat(actual);
  if (isNaN(a)) return 0;
  const diff = Math.abs(guess - a);
  if (diff === 0) return 100;
  if (diff <= 0.2) return 95;
  if (diff <= 0.5) return 80;
  if (diff <= 1.0) return 55;
  if (diff <= 1.5) return 30;
  if (diff <= 2.0) return 10;
  return 0;
}

function scoreRt(guess: number, actual: string): number {
  const a = parseInt(actual.replace("%", ""));
  if (isNaN(a)) return 0;
  const diff = Math.abs(guess - a);
  if (diff === 0) return 100;
  if (diff <= 3) return 95;
  if (diff <= 7) return 80;
  if (diff <= 12) return 55;
  if (diff <= 20) return 30;
  if (diff <= 30) return 10;
  return 0;
}

function scoreLabel(pts: number) {
  if (pts >= 95) return { label: "Perfect! 🎯", color: "text-green-400" };
  if (pts >= 80) return { label: "Very close! 🔥", color: "text-yellow-400" };
  if (pts >= 55) return { label: "Not bad 👍", color: "text-blue-400" };
  if (pts >= 30) return { label: "Getting warmer 🤔", color: "text-orange-400" };
  return { label: "Way off 💀", color: "text-red-400" };
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function PosterImage({ src, title }: { src: string; title: string }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className="relative w-full aspect-[2/3] rounded-xl overflow-hidden bg-zinc-900">
      {!loaded && <div className="absolute inset-0 skeleton" />}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src !== "N/A" ? src : "/placeholder.png"}
        alt={title}
        className={`w-full h-full object-cover transition-opacity duration-500 ${loaded ? "opacity-100" : "opacity-0"}`}
        onLoad={() => setLoaded(true)}
      />
    </div>
  );
}

function RatingBar({ label, guess, actual, color }: { label: string; guess: number; actual: string; color: string }) {
  const actualNum = parseFloat(actual.replace("%", ""));
  const max = label === "IMDB" ? 10 : 100;
  const guessWidth = Math.min((guess / max) * 100, 100);
  const actualWidth = Math.min((actualNum / max) * 100, 100);

  return (
    <div className="mb-4">
      <div className="flex justify-between text-xs text-zinc-400 mb-1">
        <span>{label}</span>
        <span>Actual: <span className={`font-bold ${color}`}>{actual}</span></span>
      </div>
      <div className="relative h-3 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className="absolute top-0 left-0 h-full bg-zinc-600 rounded-full transition-all duration-700"
          style={{ width: `${guessWidth}%` }}
        />
        <div
          className="absolute top-0 left-0 h-full rounded-full transition-all duration-700"
          style={{ width: `${actualWidth}%`, background: color.includes("yellow") ? "#eab308" : "#ef4444" }}
        />
      </div>
      <div className="flex justify-between text-xs text-zinc-500 mt-1">
        <span>Your guess: <span className="text-zinc-300 font-medium">{label === "IMDB" ? guess.toFixed(1) : `${guess}%`}</span></span>
      </div>
    </div>
  );
}

function SliderInput({
  mode,
  imdbValue,
  rtValue,
  onImdbChange,
  onRtChange,
}: {
  mode: GameMode;
  imdbValue: number;
  rtValue: number;
  onImdbChange: (v: number) => void;
  onRtChange: (v: number) => void;
}) {
  return (
    <div className="space-y-6">
      {(mode === "imdb" || mode === "both") && (
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-sm font-semibold text-zinc-300 flex items-center gap-1.5">
              <span className="text-yellow-400">⭐</span> IMDB Score
            </label>
            <span className="text-2xl font-black text-yellow-400 tabular-nums">
              {imdbValue.toFixed(1)}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={10}
            step={0.1}
            value={imdbValue}
            onChange={(e) => onImdbChange(parseFloat(e.target.value))}
            className="w-full"
            style={{
              background: `linear-gradient(to right, #eab308 ${imdbValue * 10}%, #3f3f46 ${imdbValue * 10}%)`,
            }}
          />
          <div className="flex justify-between text-xs text-zinc-600 mt-1">
            <span>0.0</span><span>5.0</span><span>10.0</span>
          </div>
        </div>
      )}

      {(mode === "rt" || mode === "both") && (
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-sm font-semibold text-zinc-300 flex items-center gap-1.5">
              <span className="text-red-400">🍅</span> Tomatometer
            </label>
            <span className="text-2xl font-black text-red-400 tabular-nums">
              {rtValue}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={rtValue}
            onChange={(e) => onRtChange(parseInt(e.target.value))}
            className="w-full"
            style={{
              background: `linear-gradient(to right, #ef4444 ${rtValue}%, #3f3f46 ${rtValue}%)`,
            }}
          />
          <div className="flex justify-between text-xs text-zinc-600 mt-1">
            <span>0%</span><span>50%</span><span>100%</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Game Component ─────────────────────────────────────────────────────

function GameContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const mode = (searchParams.get("mode") ?? "imdb") as GameMode;

  const [movieIds, setMovieIds] = useState<{ imdbId: string; title: string; year: string }[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [movieLoading, setMovieLoading] = useState(false);
  const [imdbGuess, setImdbGuess] = useState(5.0);
  const [rtGuess, setRtGuess] = useState(50);
  const [phase, setPhase] = useState<"guess" | "reveal" | "done">("guess");
  const [totalScore, setTotalScore] = useState(0);
  const fetchedIds = useRef<Set<string>>(new Set());

  // Fetch session (list of movies)
  useEffect(() => {
    fetch("/api/session?count=10")
      .then((r) => r.json())
      .then((d) => {
        setMovieIds(d.movies);
        setLoading(false);
      });
  }, []);

  // Fetch a movie by IMDB ID
  const fetchMovie = useCallback(async (imdbId: string) => {
    if (fetchedIds.current.has(imdbId)) return;
    fetchedIds.current.add(imdbId);
    setMovieLoading(true);
    const res = await fetch(`/api/movie?id=${imdbId}`);
    const data: MovieData = await res.json();
    setMovieLoading(false);
    setRounds((prev) => {
      const idx = prev.findIndex((r) => r.movie.imdbId === imdbId);
      if (idx >= 0) return prev; // already there
      return [...prev, { movie: data, revealed: false }];
    });
  }, []);

  // When movieIds load, start fetching rounds
  useEffect(() => {
    if (!movieIds.length) return;
    // Fetch first two proactively
    movieIds.slice(0, 2).forEach((m) => fetchMovie(m.imdbId));
  }, [movieIds, fetchMovie]);

  const currentRound = rounds[currentIdx];

  // Pre-fetch next
  useEffect(() => {
    if (!movieIds.length || currentIdx >= movieIds.length - 1) return;
    fetchMovie(movieIds[currentIdx + 1].imdbId);
  }, [currentIdx, movieIds, fetchMovie]);

  function submitGuess() {
    if (!currentRound) return;
    const movie = currentRound.movie;
    let ip = 0, rp = 0;
    if (mode === "imdb" || mode === "both") ip = scoreImdb(imdbGuess, movie.imdbRating);
    if (mode === "rt" || mode === "both") rp = scoreRt(rtGuess, movie.rtRating);
    const total = mode === "both" ? Math.round((ip + rp) / 2) : (mode === "imdb" ? ip : rp);

    setRounds((prev) =>
      prev.map((r, i) =>
        i === currentIdx
          ? { ...r, imdbGuess, rtGuess, imdbPoints: ip, rtPoints: rp, totalPoints: total, revealed: true }
          : r
      )
    );
    setTotalScore((s) => s + total);
    setPhase("reveal");
  }

  function nextRound() {
    if (currentIdx + 1 >= movieIds.length) {
      setPhase("done");
      return;
    }
    const nextIdx = currentIdx + 1;
    setCurrentIdx(nextIdx);
    setImdbGuess(5.0);
    setRtGuess(50);
    setPhase("guess");

    // If next movie not yet fetched
    if (!rounds[nextIdx]) {
      fetchMovie(movieIds[nextIdx].imdbId);
    }
  }

  // ── Loading ──────────────────────────────────────────────────────────────

  if (loading || (movieIds.length > 0 && !currentRound)) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-screen">
        <div className="text-center space-y-3">
          <div className="text-4xl animate-pulse">🎬</div>
          <p className="text-zinc-400">Loading films…</p>
        </div>
      </div>
    );
  }

  // ── Done screen ──────────────────────────────────────────────────────────

  if (phase === "done") {
    const maxScore = rounds.length * 100;
    const pct = Math.round((totalScore / maxScore) * 100);
    const grade =
      pct >= 90 ? { label: "Film Critic 🎖", color: "text-green-400" } :
      pct >= 75 ? { label: "Cinephile 🎬", color: "text-yellow-400" } :
      pct >= 55 ? { label: "Movie Buff 🍿", color: "text-blue-400" } :
      pct >= 35 ? { label: "Casual Viewer 👀", color: "text-orange-400" } :
                  { label: "Couch Potato 🥔", color: "text-red-400" };

    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 animate-slide-up">
        <div className="max-w-lg w-full">
          <div className="text-center mb-8">
            <div className="text-5xl mb-3">🎬</div>
            <h2 className="text-3xl font-black mb-1">Game Over</h2>
            <p className={`text-xl font-bold ${grade.color}`}>{grade.label}</p>
            <p className="text-4xl font-black mt-4">
              {totalScore} <span className="text-zinc-500 text-xl font-normal">/ {maxScore}</span>
            </p>
            <div className="mt-3 h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-yellow-400 rounded-full transition-all duration-1000"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          {/* Per-round summary */}
          <div className="space-y-2 mb-8">
            {rounds.map((r, i) => (
              <div key={i} className="flex items-center gap-3 bg-zinc-900 rounded-xl px-4 py-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={r.movie.poster !== "N/A" ? r.movie.poster : ""}
                  alt={r.movie.title}
                  className="w-8 h-12 object-cover rounded"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{r.movie.title}</p>
                  <p className="text-xs text-zinc-500">{r.movie.year}</p>
                </div>
                <div className="text-right">
                  {(mode === "imdb" || mode === "both") && (
                    <p className="text-xs text-zinc-400">
                      IMDB: <span className="text-yellow-400 font-bold">{r.movie.imdbRating}</span>
                      {" "}(you: {r.imdbGuess?.toFixed(1)})
                    </p>
                  )}
                  {(mode === "rt" || mode === "both") && (
                    <p className="text-xs text-zinc-400">
                      RT: <span className="text-red-400 font-bold">{r.movie.rtRating}</span>
                      {" "}(you: {r.rtGuess}%)
                    </p>
                  )}
                </div>
                <span className="text-sm font-bold text-zinc-300 ml-2 w-8 text-right">
                  {r.totalPoints}
                </span>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => { setRounds([]); setCurrentIdx(0); setTotalScore(0); setPhase("guess"); fetchedIds.current = new Set(); setLoading(true); fetch("/api/session?count=10").then(r => r.json()).then(d => { setMovieIds(d.movies); setLoading(false); }); }}
              className="flex-1 bg-yellow-400 text-black font-bold py-3 rounded-xl hover:bg-yellow-300 transition-colors"
            >
              Play Again
            </button>
            <button
              onClick={() => router.push("/")}
              className="flex-1 bg-zinc-800 text-white font-bold py-3 rounded-xl hover:bg-zinc-700 transition-colors"
            >
              Change Mode
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Active round ─────────────────────────────────────────────────────────

  if (!currentRound) return null;
  const movie = currentRound.movie;
  const progress = ((currentIdx + 1) / movieIds.length) * 100;

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-6 max-w-2xl mx-auto w-full">
      {/* Header */}
      <div className="w-full mb-5">
        <div className="flex justify-between items-center mb-2">
          <button onClick={() => router.push("/")} className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors">
            ← Back
          </button>
          <div className="flex items-center gap-3">
            <span className="text-sm text-zinc-400">Film {currentIdx + 1} / {movieIds.length}</span>
            <span className="text-sm font-bold text-yellow-400">{totalScore} pts</span>
          </div>
        </div>
        <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-yellow-400 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {movieLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-zinc-500 animate-pulse">Loading…</div>
        </div>
      ) : (
        <div className="w-full flex flex-col md:flex-row gap-6 animate-slide-up">
          {/* Poster */}
          <div className="w-full md:w-56 flex-shrink-0">
            <PosterImage src={movie.poster} title={movie.title} />
          </div>

          {/* Info + controls */}
          <div className="flex-1 flex flex-col">
            <div className="mb-4">
              <h2 className="text-2xl font-black leading-tight mb-1">{movie.title}</h2>
              <div className="flex flex-wrap gap-2 text-xs text-zinc-400">
                <span className="bg-zinc-800 rounded-full px-2.5 py-0.5">{movie.year}</span>
                {movie.runtime !== "N/A" && <span className="bg-zinc-800 rounded-full px-2.5 py-0.5">{movie.runtime}</span>}
                {movie.genre !== "N/A" && movie.genre.split(", ").slice(0, 2).map((g) => (
                  <span key={g} className="bg-zinc-800 rounded-full px-2.5 py-0.5">{g}</span>
                ))}
              </div>
              {movie.director !== "N/A" && (
                <p className="text-xs text-zinc-500 mt-2">Dir. {movie.director}</p>
              )}
            </div>

            {phase === "guess" ? (
              <>
                <SliderInput
                  mode={mode}
                  imdbValue={imdbGuess}
                  rtValue={rtGuess}
                  onImdbChange={setImdbGuess}
                  onRtChange={setRtGuess}
                />
                <button
                  onClick={submitGuess}
                  className="mt-6 w-full bg-yellow-400 hover:bg-yellow-300 text-black font-bold py-3 rounded-xl transition-colors text-base"
                >
                  Lock In My Guess 🎯
                </button>
              </>
            ) : (
              <div className="animate-pop">
                {/* Points */}
                <div className="text-center mb-4">
                  {(() => {
                    const { label, color } = scoreLabel(currentRound.totalPoints ?? 0);
                    return (
                      <>
                        <span className={`text-3xl font-black ${color}`}>+{currentRound.totalPoints}</span>
                        <span className="text-zinc-400 text-lg"> pts</span>
                        <p className={`text-sm mt-0.5 ${color}`}>{label}</p>
                      </>
                    );
                  })()}
                </div>

                {/* Rating bars */}
                {(mode === "imdb" || mode === "both") && movie.imdbRating !== "N/A" && (
                  <RatingBar
                    label="IMDB"
                    guess={currentRound.imdbGuess ?? 5}
                    actual={movie.imdbRating}
                    color="text-yellow-400"
                  />
                )}
                {(mode === "rt" || mode === "both") && movie.rtRating !== "N/A" && (
                  <RatingBar
                    label="RT"
                    guess={currentRound.rtGuess ?? 50}
                    actual={movie.rtRating}
                    color="text-red-400"
                  />
                )}

                {/* Plot reveal */}
                {movie.plot !== "N/A" && (
                  <p className="text-xs text-zinc-500 mt-3 leading-relaxed italic">"{movie.plot}"</p>
                )}

                <button
                  onClick={nextRound}
                  className="mt-5 w-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 rounded-xl transition-colors"
                >
                  {currentIdx + 1 >= movieIds.length ? "See Final Score 🏆" : "Next Film →"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function GamePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen text-zinc-400">Loading…</div>}>
      <GameContent />
    </Suspense>
  );
}
