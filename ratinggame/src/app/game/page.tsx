"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";
import AutoNextButton from "@/components/AutoNextButton";
import ShareButton from "@/components/ShareButton";
import HomeIcon from "@/components/HomeIcon";

// ─── Types ───────────────────────────────────────────────────────────────────

interface MovieData {
  imdbId: string; title: string; year: string; rated: string; runtime: string;
  genre: string; director: string; plot: string; poster: string;
  imdbRating: string; rtRating: string; metacritic: string;
}

interface Round {
  movie: MovieData;
  imdbGuess?: number; rtGuess?: number;
  imdbPoints?: number; rtPoints?: number; totalPoints?: number;
  revealed: boolean;
}

type GameMode = "imdb" | "rt" | "both";

// ─── Scoring ─────────────────────────────────────────────────────────────────

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
  if (pts >= 95) return { label: "Perfect! 🎯", color: "#4ade80" };
  if (pts >= 80) return { label: "Very close! 🔥", color: "#e8a000" };
  if (pts >= 55) return { label: "Not bad 👍", color: "#60a5fa" };
  if (pts >= 30) return { label: "Getting warmer 🤔", color: "#fb923c" };
  return { label: "Way off 💀", color: "#f87171" };
}

function buildShareText(mode: GameMode, score: number, max: number, rounds: Round[]) {
  const modeLabel = mode === "imdb" ? "⭐ IMDB Score" : mode === "rt" ? "🍅 Rotten Tomatoes" : "🎯 Double Down";
  const pct = Math.round((score / max) * 100);
  const bars = rounds.map((r) => {
    const p = r.totalPoints ?? 0;
    return p >= 80 ? "🟩" : p >= 50 ? "🟨" : "🟥";
  }).join("");
  return `CineRating: ${modeLabel}\n${score}/${max} pts (${pct}%)\n${bars}\nhttps://cinerating.vercel.app/game?mode=${mode}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PosterImage({ src, title }: { src: string; title: string }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className="relative w-full aspect-[2/3] rounded-xl overflow-hidden" style={{ background: "#181818" }}>
      {!loaded && <div className="absolute inset-0 skeleton" />}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src !== "N/A" ? src : ""}
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
  const guessW = Math.min((guess / max) * 100, 100);
  const actualW = Math.min((actualNum / max) * 100, 100);
  return (
    <div className="mb-4">
      <div className="flex justify-between text-xs mb-1" style={{ color: "#777" }}>
        <span>{label}</span>
        <span>Actual: <span className="font-bold" style={{ color }}>{actual}</span></span>
      </div>
      <div className="relative h-2.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
        <div className="absolute top-0 left-0 h-full rounded-full transition-all duration-700" style={{ width: `${guessW}%`, background: "rgba(255,255,255,0.15)" }} />
        <div className="absolute top-0 left-0 h-full rounded-full transition-all duration-700" style={{ width: `${actualW}%`, background: color }} />
      </div>
      <div className="flex justify-between text-xs mt-1" style={{ color: "#555" }}>
        <span>Your guess: <span style={{ color: "#999" }}>{label === "IMDB" ? guess.toFixed(1) : `${guess}%`}</span></span>
      </div>
    </div>
  );
}

function SliderInput({ mode, imdbValue, rtValue, onImdbChange, onRtChange }: {
  mode: GameMode; imdbValue: number; rtValue: number;
  onImdbChange: (v: number) => void; onRtChange: (v: number) => void;
}) {
  return (
    <div className="space-y-6">
      {(mode === "imdb" || mode === "both") && (
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-sm font-semibold flex items-center gap-1.5" style={{ color: "#999" }}>
              <span style={{ color: "#e8a000" }}>⭐</span> IMDB Score
            </label>
            <span className="text-2xl font-black tabular-nums" style={{ color: "#e8a000" }}>{imdbValue.toFixed(1)}</span>
          </div>
          <input type="range" min={0} max={10} step={0.1} value={imdbValue}
            onChange={(e) => onImdbChange(parseFloat(e.target.value))}
            className="w-full"
            style={{ background: `linear-gradient(to right, #e8a000 ${imdbValue * 10}%, rgba(255,255,255,0.1) ${imdbValue * 10}%)` }}
          />
          <div className="flex justify-between text-xs mt-1" style={{ color: "#444" }}>
            <span>0.0</span><span>5.0</span><span>10.0</span>
          </div>
        </div>
      )}
      {(mode === "rt" || mode === "both") && (
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-sm font-semibold flex items-center gap-1.5" style={{ color: "#999" }}>
              <span className="text-red-400">🍅</span> Tomatometer
            </label>
            <span className="text-2xl font-black tabular-nums text-red-400">{rtValue}%</span>
          </div>
          <input type="range" min={0} max={100} step={1} value={rtValue}
            onChange={(e) => onRtChange(parseInt(e.target.value))}
            className="w-full"
            style={{ background: `linear-gradient(to right, #ef4444 ${rtValue}%, rgba(255,255,255,0.1) ${rtValue}%)` }}
          />
          <div className="flex justify-between text-xs mt-1" style={{ color: "#444" }}>
            <span>0%</span><span>50%</span><span>100%</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Game Component ──────────────────────────────────────────────────────

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

  useEffect(() => {
    fetch("/api/session?count=10")
      .then((r) => r.json())
      .then((d) => {
        // API returns { pairs: [MovieStub, MovieStub][] } — flatten to individual movies
        const flat = (d.pairs as Array<{ imdbId: string; title: string; year: string }[]>).flat();
        setMovieIds(flat.slice(0, 10));
        setLoading(false);
      });
  }, []);

  const fetchMovie = useCallback(async (imdbId: string) => {
    if (fetchedIds.current.has(imdbId)) return;
    fetchedIds.current.add(imdbId);
    setMovieLoading(true);
    const res = await fetch(`/api/movie?id=${imdbId}`);
    const data: MovieData = await res.json();
    setMovieLoading(false);
    setRounds((prev) => {
      if (prev.find((r) => r.movie.imdbId === imdbId)) return prev;
      return [...prev, { movie: data, revealed: false }];
    });
  }, []);

  useEffect(() => { if (movieIds.length) movieIds.slice(0, 2).forEach((m) => fetchMovie(m.imdbId)); }, [movieIds, fetchMovie]);

  const currentRound = rounds[currentIdx];

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
    setRounds((prev) => prev.map((r, i) => i === currentIdx ? { ...r, imdbGuess, rtGuess, imdbPoints: ip, rtPoints: rp, totalPoints: total, revealed: true } : r));
    setTotalScore((s) => s + total);
    setPhase("reveal");
  }

  const nextRound = useCallback(() => {
    if (currentIdx + 1 >= movieIds.length) { setPhase("done"); return; }
    const nextIdx = currentIdx + 1;
    setCurrentIdx(nextIdx);
    setImdbGuess(5.0);
    setRtGuess(50);
    setPhase("guess");
    if (!rounds[nextIdx]) fetchMovie(movieIds[nextIdx].imdbId);
  }, [currentIdx, movieIds, rounds, fetchMovie]);

  // Keyboard: Space/Enter = submit or next
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") {
        const active = document.activeElement;
        if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA")) return;
        e.preventDefault();
        if (phase === "guess") submitGuess();
        if (phase === "reveal") nextRound();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, nextRound]);

  const restartGame = () => {
    setRounds([]); setCurrentIdx(0); setTotalScore(0); setPhase("guess");
    fetchedIds.current = new Set(); setLoading(true);
    fetch("/api/session?count=10").then((r) => r.json()).then((d) => { setMovieIds(d.movies); setLoading(false); });
  };

  // ── Loading ──────────────────────────────────────────────────────────────

  if (loading || (movieIds.length > 0 && !currentRound && phase !== "done")) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-screen" style={{ background: "#0d0d0d" }}>
        <div className="text-center space-y-4">
          <div className="relative w-14 h-14 mx-auto">
            <div className="absolute inset-0 rounded-lg border-2 border-t-[#e8a000] border-r-[rgba(232,160,0,0.4)] border-b-transparent border-l-transparent animate-spin" />
            <div className="absolute inset-3 rounded-full animate-pulse" style={{ background: "rgba(232,160,0,0.1)" }} />
          </div>
          <p className="text-sm font-medium" style={{ color: "#777" }}>Loading films…</p>
        </div>
      </div>
    );
  }

  // ── Done ─────────────────────────────────────────────────────────────────

  if (phase === "done") {
    const maxScore = rounds.length * 100;
    const pct = Math.round((totalScore / maxScore) * 100);
    const grade =
      pct >= 90 ? { label: "Film Critic", sub: "Uncanny precision", color: "#4ade80" } :
      pct >= 75 ? { label: "Cinephile", sub: "Sharp instincts", color: "#e8a000" } :
      pct >= 55 ? { label: "Movie Buff", sub: "Solid effort", color: "#60a5fa" } :
      pct >= 35 ? { label: "Casual Viewer", sub: "Keep watching", color: "#fb923c" } :
                  { label: "Couch Potato", sub: "Those were rough", color: "#f87171" };

    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 animate-slide-up" style={{ background: "#0d0d0d" }}>
        <div className="max-w-lg w-full rounded-2xl p-6" style={{ background: "rgba(255,255,255,0.045)", backdropFilter: "blur(18px)", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 30px 80px rgba(0,0,0,0.38)" }}>
          <div className="text-center mb-6">
            <p className="text-[0.6rem] font-bold tracking-[0.18em] uppercase mb-3" style={{ color: "#e8a000" }}>
              {mode === "imdb" ? "IMDB Score" : mode === "rt" ? "Rotten Tomatoes" : "Double Down"}
            </p>
            <p className="text-2xl font-black mb-0.5" style={{ color: grade.color }}>{grade.label}</p>
            <p className="text-sm" style={{ color: "#777" }}>{grade.sub}</p>
            <p className="text-5xl font-black mt-4 text-[#f0f0f0]">
              {totalScore} <span className="text-xl font-normal" style={{ color: "#777" }}>/ {maxScore}</span>
            </p>
            <div className="mt-3 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
              <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${pct}%`, background: "#e8a000" }} />
            </div>
          </div>

          <div className="space-y-2 mb-6 max-h-60 overflow-y-auto">
            {rounds.map((r, i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl px-3 py-2.5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={r.movie.poster !== "N/A" ? r.movie.poster : ""} alt={r.movie.title} className="w-8 h-12 object-cover rounded" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate text-[#f0f0f0]">{r.movie.title}</p>
                  <p className="text-xs" style={{ color: "#555" }}>{r.movie.year}</p>
                </div>
                <div className="text-right">
                  {(mode === "imdb" || mode === "both") && (
                    <p className="text-xs" style={{ color: "#777" }}>
                      IMDB: <span style={{ color: "#e8a000" }} className="font-bold">{r.movie.imdbRating}</span>
                      <span style={{ color: "#555" }}> (you: {r.imdbGuess?.toFixed(1)})</span>
                    </p>
                  )}
                  {(mode === "rt" || mode === "both") && (
                    <p className="text-xs" style={{ color: "#777" }}>
                      RT: <span className="text-red-400 font-bold">{r.movie.rtRating}</span>
                      <span style={{ color: "#555" }}> (you: {r.rtGuess}%)</span>
                    </p>
                  )}
                </div>
                <span className="text-sm font-bold ml-2 w-10 text-right" style={{ color: (r.totalPoints ?? 0) >= 80 ? "#4ade80" : (r.totalPoints ?? 0) >= 50 ? "#e8a000" : "#f87171" }}>
                  {r.totalPoints}
                </span>
              </div>
            ))}
          </div>

          <div className="flex gap-3 mb-3">
            <button onClick={restartGame} className="flex-1 font-bold py-3 rounded-xl hover:opacity-85 transition-all" style={{ background: "#e8a000", color: "#111" }}>Play Again</button>
            <button onClick={() => router.push("/")} className="flex-1 font-bold py-3 rounded-xl hover:opacity-85 transition-all flex items-center justify-center gap-2" style={{ background: "transparent", color: "#f0f0f0", border: "1px solid rgba(255,255,255,0.09)" }}><HomeIcon /> Home</button>
          </div>
          <ShareButton text={buildShareText(mode, totalScore, maxScore, rounds)} className="w-full" />
        </div>
      </div>
    );
  }

  // ── Active round ──────────────────────────────────────────────────────────

  if (!currentRound) return null;
  const movie = currentRound.movie;
  const progress = ((currentIdx + 1) / movieIds.length) * 100;

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-6 max-w-2xl mx-auto w-full" style={{ background: "#0d0d0d" }}>
      {/* Header */}
      <div className="w-full mb-5">
        <div className="flex justify-between items-center mb-2">
          <button onClick={() => router.push("/")} className="text-sm font-medium hover:opacity-80 transition-opacity flex items-center gap-1.5" style={{ color: "#777" }}><HomeIcon /> Home</button>
          <div className="flex items-center gap-3">
            <span className="text-sm" style={{ color: "#777" }}>Film {currentIdx + 1} / {movieIds.length}</span>
            <span className="text-sm font-bold" style={{ color: "#e8a000" }}>{totalScore} pts</span>
          </div>
        </div>
        <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress}%`, background: "#e8a000" }} />
        </div>
      </div>

      {movieLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="animate-pulse text-sm" style={{ color: "#555" }}>Loading…</div>
        </div>
      ) : (
        <div className="w-full flex flex-col md:flex-row gap-6 animate-slide-up">
          {/* Poster */}
          <div className="w-full md:w-52 flex-shrink-0">
            <PosterImage src={movie.poster} title={movie.title} />
          </div>

          {/* Info + controls */}
          <div className="flex-1 flex flex-col">
            <div className="mb-4">
              <h2 className="text-2xl font-black leading-tight mb-2 text-[#f0f0f0]">{movie.title}</h2>
              <div className="flex flex-wrap gap-1.5 text-xs">
                {[movie.year, movie.runtime !== "N/A" ? movie.runtime : null, ...movie.genre.split(", ").slice(0, 2)].filter(Boolean).map((tag) => (
                  <span key={tag} className="rounded-full px-2.5 py-0.5" style={{ background: "rgba(255,255,255,0.06)", color: "#777" }}>{tag}</span>
                ))}
              </div>
              {movie.director !== "N/A" && (
                <p className="text-xs mt-2" style={{ color: "#555" }}>Dir. {movie.director}</p>
              )}
            </div>

            {phase === "guess" ? (
              <>
                <SliderInput mode={mode} imdbValue={imdbGuess} rtValue={rtGuess} onImdbChange={setImdbGuess} onRtChange={setRtGuess} />
                <button
                  onClick={submitGuess}
                  className="mt-6 w-full font-bold py-3 rounded-xl transition-all hover:opacity-85 active:scale-[0.99]"
                  style={{ background: "#e8a000", color: "#111" }}
                >
                  Lock In My Guess 🎯
                </button>
                <p className="text-center text-xs mt-2 hidden sm:block" style={{ color: "#444" }}>Space / Enter to submit</p>
              </>
            ) : (
              <div className="animate-pop">
                {/* Points */}
                {(() => {
                  const { label, color } = scoreLabel(currentRound.totalPoints ?? 0);
                  return (
                    <div className="text-center mb-4">
                      <span className="text-3xl font-black" style={{ color }}>+{currentRound.totalPoints}</span>
                      <span className="text-lg" style={{ color: "#777" }}> pts</span>
                      <p className="text-sm mt-0.5" style={{ color }}>{label}</p>
                    </div>
                  );
                })()}

                {/* Rating bars */}
                {(mode === "imdb" || mode === "both") && movie.imdbRating !== "N/A" && (
                  <RatingBar label="IMDB" guess={currentRound.imdbGuess ?? 5} actual={movie.imdbRating} color="#e8a000" />
                )}
                {(mode === "rt" || mode === "both") && movie.rtRating !== "N/A" && (
                  <RatingBar label="RT" guess={currentRound.rtGuess ?? 50} actual={movie.rtRating} color="#ef4444" />
                )}

                {movie.plot !== "N/A" && (
                  <p className="text-xs leading-relaxed italic mt-3" style={{ color: "#555" }}>"{movie.plot}"</p>
                )}

                <AutoNextButton
                  onNext={nextRound}
                  delay={4500}
                  label={currentIdx + 1 >= movieIds.length ? "See Final Score 🏆" : "Next Film →"}
                  isLast={false}
                />
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
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen" style={{ background: "#0d0d0d", color: "#777" }}>Loading…</div>
    }>
      <GameContent />
    </Suspense>
  );
}
