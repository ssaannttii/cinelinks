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
  wikipediaSlug: string;
  movieIds: string[];
}

type Phase = "loading" | "choosing" | "revealing" | "done";

interface RoundResult {
  correct: boolean;
  personName: string;
  personPhoto: string | null;
  winnerTitle: string;
  winnerRating: string;
  pickedTitle: string;
}

const ROUNDS = 10;

// ── Helpers ───────────────────────────────────────────────────────────────────

function ordinal(n: number) {
  return ["1st", "2nd", "3rd", "4th"][n] ?? `${n + 1}th`;
}

// ── Person Photo ──────────────────────────────────────────────────────────────

function PersonAvatar({ photo, name, size = 80 }: { photo: string | null; name: string; size?: number }) {
  if (photo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photo}
        alt={name}
        style={{ width: size, height: size }}
        className="rounded-full object-cover border-2 border-[#e8a000]/40 shadow-lg"
      />
    );
  }
  // Fallback: initials
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("");
  return (
    <div
      style={{ width: size, height: size }}
      className="rounded-full bg-[#1a1a1a] border-2 border-[#e8a000]/30 flex items-center justify-center text-[#e8a000] font-black text-xl"
    >
      {initials}
    </div>
  );
}

// ── Component ────────────────────────────────────────────────────────────────

export default function FilmographyPage() {
  const router = useRouter();

  const cacheRef = useRef<Record<string, Movie>>({});
  const fetchingRef = useRef<Set<string>>(new Set());
  const challengesRef = useRef<Challenge[]>([]);
  const photoCache = useRef<Record<string, string | null>>({});

  const [phase, setPhase] = useState<Phase>("loading");
  const [round, setRound] = useState(0);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [personPhoto, setPersonPhoto] = useState<string | null>(null);
  const [movies, setMovies] = useState<Movie[]>([]);
  const [picked, setPicked] = useState<number | null>(null);
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

  const fetchPersonPhoto = useCallback(async (slug: string): Promise<string | null> => {
    if (slug in photoCache.current) return photoCache.current[slug];
    try {
      const res = await fetch(`/api/person-photo?slug=${encodeURIComponent(slug)}`);
      const data = await res.json();
      photoCache.current[slug] = data.photo ?? null;
      return photoCache.current[slug];
    } catch {
      photoCache.current[slug] = null;
      return null;
    }
  }, []);

  const loadRound = useCallback(
    async (idx: number) => {
      const ch = challengesRef.current[idx];
      if (!ch) return;

      setPhase("loading");
      setChallenge(ch);
      setPicked(null);
      setPersonPhoto(null);

      const [fetched, photo] = await Promise.all([
        Promise.all(ch.movieIds.map((id) => fetchMovie(id))),
        fetchPersonPhoto(ch.wikipediaSlug),
      ]);

      setMovies(fetched);
      setPersonPhoto(photo);
      setPhase("choosing");

      // Prefetch next round in background
      const next = challengesRef.current[idx + 1];
      if (next) {
        next.movieIds.forEach((id) => fetchMovie(id));
        fetchPersonPhoto(next.wikipediaSlug);
      }
    },
    [fetchMovie, fetchPersonPhoto]
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
        personPhoto,
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
    setPersonPhoto(null);
    initGame();
  };

  // ── Render: Loading ───────────────────────────────────────────────────────

  if (phase === "loading" && !challenge) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0d0d0d" }}>
        <div className="text-center space-y-4">
          <div className="relative w-14 h-14 mx-auto">
            <div className="absolute inset-0 rounded-lg border-2 border-transparent border-t-[#e8a000] border-r-[rgba(232,160,0,0.4)] animate-spin" />
            <div className="absolute inset-3 rounded-full bg-[rgba(232,160,0,0.1)] animate-pulse" />
          </div>
          <p className="text-[#777] text-sm font-medium">Loading filmography…</p>
        </div>
      </div>
    );
  }

  // ── Render: Done ──────────────────────────────────────────────────────────

  if (phase === "done") {
    const grade =
      score >= 9
        ? { label: "Film Archivist", sub: "You know every frame", color: "text-purple-400" }
        : score >= 7
        ? { label: "Cinephile", sub: "A true connoisseur", color: "text-[#e8a000]" }
        : score >= 5
        ? { label: "Movie Buff", sub: "Not bad at all", color: "text-green-400" }
        : { label: "Casual Viewer", sub: "Keep watching", color: "text-[#777]" };

    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12" style={{ background: "#0d0d0d" }}>
        <div
          className="max-w-md w-full rounded-2xl p-6"
          style={{
            background: "rgba(255,255,255,0.045)",
            backdropFilter: "blur(18px)",
            border: "1px solid rgba(255,255,255,0.1)",
            boxShadow: "0 30px 80px rgba(0,0,0,0.38)",
          }}
        >
          <div className="text-center mb-6">
            <p className="text-xs font-bold tracking-[0.18em] uppercase text-[#e8a000] mb-3">Filmography Battle</p>
            <p className={`text-2xl font-black mb-0.5 ${grade.color}`}>{grade.label}</p>
            <p className="text-[#777] text-sm">{grade.sub}</p>
            <p className="text-6xl font-black mt-4 text-white">
              {score}
              <span className="text-[#777] text-2xl font-normal"> / {ROUNDS}</span>
            </p>
          </div>

          <div className="space-y-2 mb-6 max-h-64 overflow-y-auto">
            {results.map((r, i) => (
              <div
                key={i}
                className="flex items-start gap-3 rounded-xl px-3 py-2.5 text-xs"
                style={{
                  background: r.correct ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)",
                  border: r.correct ? "1px solid rgba(34,197,94,0.2)" : "1px solid rgba(239,68,68,0.2)",
                }}
              >
                <span className={`font-bold mt-0.5 flex-shrink-0 ${r.correct ? "text-green-400" : "text-red-400"}`}>
                  {r.correct ? "✓" : "✗"}
                </span>
                {r.personPhoto && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={r.personPhoto}
                    alt={r.personName}
                    className="w-7 h-7 rounded-full object-cover flex-shrink-0 border border-[rgba(255,255,255,0.1)]"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <span className="text-[#777]">{r.personName}:</span>{" "}
                  <span className="text-[#e8a000] font-semibold">{r.winnerTitle}</span>{" "}
                  <span className="text-[#555]">({r.winnerRating})</span>
                  {!r.correct && (
                    <p className="text-[#555] mt-0.5">
                      You picked: <span className="text-[#999]">{r.pickedTitle}</span>
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleRestart}
              className="flex-1 font-bold py-3 rounded-xl transition-all hover:opacity-85 hover:-translate-y-px"
              style={{ background: "#e8a000", color: "#111" }}
            >
              Play Again
            </button>
            <button
              onClick={() => router.push("/")}
              className="flex-1 font-bold py-3 rounded-xl transition-all hover:opacity-85"
              style={{ background: "transparent", color: "#f0f0f0", border: "1px solid rgba(255,255,255,0.09)" }}
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
  const ranked = [...ratings.map((r, i) => ({ r, i }))]
    .sort((a, b) => b.r - a.r)
    .map((x) => x.i);
  const rankOf = (idx: number) => ranked.indexOf(idx);

  const progress = ((round + 1) / ROUNDS) * 100;
  const typeLabel = challenge.type === "director" ? "DIRECTOR" : "ACTOR";

  return (
    <div
      className="min-h-screen flex flex-col px-4 py-4 max-w-2xl mx-auto w-full"
      style={{ background: "#0d0d0d" }}
    >
      {/* Header */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <button
            onClick={() => router.push("/")}
            className="text-[#777] hover:text-[#f0f0f0] text-sm transition-colors font-medium"
          >
            ← Back
          </button>
          <div className="flex items-center gap-3">
            <span className="text-sm text-[#777]">
              {round + 1} / {ROUNDS}
            </span>
            <span className="text-sm font-bold text-[#e8a000]">{score} ✓</span>
          </div>
        </div>
        <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${progress}%`, background: "#e8a000" }}
          />
        </div>
      </div>

      {/* Person card */}
      <div
        className="rounded-2xl px-5 py-4 mb-4 flex items-center gap-4"
        style={{
          background: "rgba(255,255,255,0.045)",
          border: "1px solid rgba(255,255,255,0.09)",
          backdropFilter: "blur(18px)",
        }}
      >
        <PersonAvatar photo={personPhoto} name={challenge.name} size={72} />
        <div className="flex-1 min-w-0">
          <p className="text-[0.6rem] font-bold tracking-[0.18em] uppercase text-[#e8a000] mb-0.5">{typeLabel}</p>
          <h2 className="text-xl font-black leading-tight text-[#f0f0f0] truncate">{challenge.name}</h2>
          <p className="text-[#777] text-xs mt-1">
            Which film has the highest{" "}
            <span className="text-[#e8a000] font-semibold">IMDB rating</span>?
          </p>
        </div>
      </div>

      {/* 2×2 Movie grid */}
      {phase === "loading" ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-[#555] animate-pulse text-sm">Loading films…</div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 flex-1">
          {movies.map((movie, idx) => {
            const isWinner = phase === "revealing" && idx === winnerIdx;
            const isPicked = picked === idx;
            const isCorrect = isPicked && idx === winnerIdx;
            const isWrong = isPicked && idx !== winnerIdx;
            const rank = rankOf(idx);

            let borderColor = "rgba(255,255,255,0.09)";
            if (phase === "choosing") borderColor = "rgba(255,255,255,0.09)";
            if (isCorrect) borderColor = "rgba(34,197,94,0.7)";
            if (isWrong) borderColor = "rgba(239,68,68,0.6)";
            if (!isPicked && isWinner && phase === "revealing") borderColor = "rgba(34,197,94,0.4)";

            return (
              <button
                key={movie.imdbId}
                onClick={() => handlePick(idx)}
                disabled={phase !== "choosing"}
                className={[
                  "flex flex-col rounded-2xl overflow-hidden border transition-all duration-200 text-left",
                  phase === "choosing" ? "hover:scale-[1.02] cursor-pointer" : "cursor-default",
                  !isPicked && phase === "revealing" && !isWinner ? "opacity-40" : "",
                ].filter(Boolean).join(" ")}
                style={{
                  borderColor,
                  background: "rgba(255,255,255,0.03)",
                  borderWidth: "1px",
                }}
              >
                {/* Poster */}
                <div className="relative" style={{ height: 170, background: "#181818" }}>
                  {movie.poster && movie.poster !== "N/A" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={movie.poster}
                      alt={movie.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-4xl opacity-30">🎬</span>
                    </div>
                  )}

                  {/* Reveal overlay */}
                  {phase === "revealing" && (
                    <div
                      className="absolute inset-0 flex flex-col items-center justify-center animate-pop"
                      style={{
                        background: isWinner
                          ? "rgba(5,46,22,0.92)"
                          : "rgba(13,13,13,0.88)",
                      }}
                    >
                      <p
                        className="text-3xl font-black"
                        style={{ color: isWinner ? "#e8a000" : "#555" }}
                      >
                        ⭐ {movie.imdbRating}
                      </p>
                      <p
                        className="text-xs font-bold mt-1"
                        style={{ color: isWinner ? "#e8a000" : "#444" }}
                      >
                        {ordinal(rank)}
                      </p>
                      {isCorrect && (
                        <p className="text-green-400 text-xs font-bold mt-1">✓ Correct!</p>
                      )}
                      {isWrong && (
                        <p className="text-red-400 text-xs font-bold mt-1">✗ Wrong</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-2.5 flex-1" style={{ background: "rgba(255,255,255,0.02)" }}>
                  <p className="font-bold text-xs leading-tight line-clamp-2 text-[#f0f0f0]">{movie.title}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: "#555" }}>{movie.year}</p>
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
          className="mt-4 w-full font-bold py-3 rounded-xl transition-all hover:opacity-85 hover:-translate-y-px"
          style={{ background: "rgba(255,255,255,0.06)", color: "#f0f0f0", border: "1px solid rgba(255,255,255,0.09)" }}
        >
          {round + 1 >= ROUNDS ? "See Results 🏆" : "Next →"}
        </button>
      )}
    </div>
  );
}
