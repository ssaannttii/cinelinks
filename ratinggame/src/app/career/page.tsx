"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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

interface Person {
  name: string;
  type: "director" | "actor";
  wikipediaSlug: string;
  movieIds: string[];
}

type Phase = "loading" | "playing" | "revealed";

const MOVIE_COUNT = 5;

function buildShareText(name: string, score: number, total: number, correctOrder: Movie[], userOrder: Movie[]) {
  const emojis = correctOrder.map((m, i) => (userOrder[i]?.imdbId === m.imdbId ? "🟩" : "🟥")).join("");
  return `CineRating: Career Mode\n${name}\n${score}/${total} ${emojis}\nhttps://cinerating.vercel.app/career`;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function CareerPage() {
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>("loading");
  const [person, setPerson] = useState<Person | null>(null);
  const [personPhoto, setPersonPhoto] = useState<string | null>(null);
  const [movies, setMovies] = useState<Movie[]>([]);
  const [order, setOrder] = useState<Movie[]>([]);       // user's live ordering
  const [correctOrder, setCorrectOrder] = useState<Movie[]>([]); // sorted highest → lowest
  const [score, setScore] = useState(0);

  // Drag state
  const dragSrcIdx = useRef<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  // Tap-to-swap state (mobile)
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  // ── Data fetching ─────────────────────────────────────────────────────────

  const fetchMovie = useCallback(async (id: string): Promise<Movie> => {
    const res = await fetch(`/api/movie?id=${id}`);
    return res.json();
  }, []);

  const initGame = useCallback(async () => {
    setPhase("loading");
    setPersonPhoto(null);
    setSelectedIdx(null);
    setDragOverIdx(null);
    dragSrcIdx.current = null;

    const res = await fetch(`/api/filmography?count=1&movies=${MOVIE_COUNT}`);
    const data = await res.json();
    const p: Person = data.challenges[0];
    setPerson(p);

    // Fetch photo in background (non-blocking)
    fetch(`/api/person-photo?slug=${p.wikipediaSlug}`)
      .then((r) => r.json())
      .then((d) => setPersonPhoto(d.photoUrl ?? null))
      .catch(() => {});

    // Fetch all movies concurrently
    const fetched = await Promise.all(
      p.movieIds.slice(0, MOVIE_COUNT).map(fetchMovie)
    );
    const valid = fetched.filter(
      (m) => m?.title && m?.imdbRating && m.imdbRating !== "N/A"
    );

    // Fisher-Yates shuffle for initial display
    const shuffled = [...valid];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    setMovies(valid);
    setOrder(shuffled);
    setPhase("playing");
  }, [fetchMovie]);

  useEffect(() => { initGame(); }, [initGame]);

  // ── Drag handlers ─────────────────────────────────────────────────────────

  const handleDragStart = (idx: number) => {
    dragSrcIdx.current = idx;
    setSelectedIdx(null);
  };

  const handleDragOver = (e: React.DragEvent, targetIdx: number) => {
    e.preventDefault();
    setDragOverIdx(targetIdx);
    const src = dragSrcIdx.current;
    if (src === null || src === targetIdx) return;
    setOrder((prev) => {
      const next = [...prev];
      const [item] = next.splice(src, 1);
      next.splice(targetIdx, 0, item);
      return next;
    });
    dragSrcIdx.current = targetIdx;
  };

  const handleDragEnd = () => {
    dragSrcIdx.current = null;
    setDragOverIdx(null);
  };

  // ── Tap-to-swap (mobile) ──────────────────────────────────────────────────

  const handleTap = (idx: number) => {
    if (selectedIdx === null) {
      setSelectedIdx(idx);
    } else if (selectedIdx === idx) {
      setSelectedIdx(null);
    } else {
      const from = selectedIdx;
      setOrder((prev) => {
        const next = [...prev];
        [next[from], next[idx]] = [next[idx], next[from]];
        return next;
      });
      setSelectedIdx(null);
    }
  };

  // ── Confirm ───────────────────────────────────────────────────────────────

  const handleConfirm = () => {
    const sorted = [...movies].sort(
      (a, b) => (parseFloat(b.imdbRating) || 0) - (parseFloat(a.imdbRating) || 0)
    );
    setCorrectOrder(sorted);
    const s = order.filter((m, i) => sorted[i]?.imdbId === m.imdbId).length;
    setScore(s);
    setPhase("revealed");
  };

  // ── Loading ───────────────────────────────────────────────────────────────

  if (phase === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0d0d0d" }}>
        <div className="text-center space-y-4">
          <div className="relative w-14 h-14 mx-auto">
            <div className="absolute inset-0 rounded-lg border-2 border-t-[#e8a000] border-r-[rgba(232,160,0,0.4)] border-b-transparent border-l-transparent animate-spin" />
            <div className="absolute inset-3 rounded-full animate-pulse" style={{ background: "rgba(232,160,0,0.1)" }} />
          </div>
          <p className="text-sm font-medium" style={{ color: "#777" }}>Loading career…</p>
        </div>
      </div>
    );
  }

  if (!person || order.length === 0) return null;

  // ── Grade ─────────────────────────────────────────────────────────────────

  const total = order.length;
  const grade =
    score === total     ? { label: "Cinephile Oracle",     sub: "Perfect order — are you sure you didn't cheat?", color: "text-purple-400" } :
    score >= total - 1  ? { label: "Ranking Shark",        sub: "One swap away from perfect",                     color: "text-[#e8a000]"  } :
    score >= total - 2  ? { label: "Pretty Dialed In",     sub: "More right than wrong",                          color: "text-green-400"  } :
    score >= total - 3  ? { label: "Mixed Signals",        sub: "Gut feeling needs recalibrating",                color: "text-blue-400"   } :
                          { label: "Random Order Energy",  sub: "The films had other opinions",                   color: "text-[#777]"     };

  const displayOrder = phase === "revealed" ? correctOrder : order;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col px-4 py-6 max-w-lg mx-auto" style={{ background: "#0d0d0d" }}>

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <button
          onClick={() => router.push("/")}
          className="text-sm font-medium hover:opacity-80 transition-opacity"
          style={{ color: "#777" }}
        >
          ← Back
        </button>
        <p className="text-[0.6rem] font-bold tracking-[0.18em] uppercase" style={{ color: "#e8a000" }}>
          Career Mode
        </p>
        <div className="w-14" />
      </div>

      {/* Person card */}
      <div
        key={person.name}
        className="flex items-center gap-4 rounded-2xl p-4 mb-5 animate-slide-left"
        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
      >
        <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0" style={{ background: "#1a1a1a" }}>
          {personPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={personPhoto} alt={person.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-2xl opacity-30">🎬</div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-black text-lg text-[#f0f0f0] leading-tight">{person.name}</p>
          <p className="text-xs mt-0.5 capitalize" style={{ color: "#555" }}>{person.type}</p>
          {phase === "playing" && (
            <p className="text-xs mt-2" style={{ color: "#777" }}>
              Rank from <span style={{ color: "#e8a000" }}>highest rated</span> to lowest
            </p>
          )}
          {phase === "revealed" && (
            <p className={`text-sm font-bold mt-1 ${grade.color}`}>
              {grade.label} — {score}/{total}
            </p>
          )}
        </div>
      </div>

      {/* Movie list */}
      <div className="flex flex-col gap-2 mb-5">
        {displayOrder.map((movie, idx) => {
          const wasCorrect =
            phase === "revealed" && order[idx]?.imdbId === movie.imdbId;
          const isDragging =
            phase === "playing" && dragSrcIdx.current === idx;
          const isDragTarget =
            phase === "playing" && dragOverIdx === idx && dragSrcIdx.current !== idx;
          const isTapped = phase === "playing" && selectedIdx === idx;

          let borderColor = "rgba(255,255,255,0.07)";
          if (isTapped)      borderColor = "rgba(232,160,0,0.7)";
          else if (isDragTarget) borderColor = "rgba(232,160,0,0.45)";
          else if (phase === "revealed")
            borderColor = wasCorrect ? "rgba(34,197,94,0.55)" : "rgba(255,255,255,0.05)";

          return (
            <div
              key={movie.imdbId}
              draggable={phase === "playing"}
              onDragStart={() => handleDragStart(idx)}
              onDragOver={(e) => phase === "playing" && handleDragOver(e, idx)}
              onDragEnd={handleDragEnd}
              onClick={() => phase === "playing" && handleTap(idx)}
              className={[
                "flex items-center gap-3 rounded-xl overflow-hidden border transition-all duration-200 animate-card-in select-none",
                phase === "playing" ? "cursor-grab active:cursor-grabbing" : "",
                isDragging ? "opacity-30 scale-[0.97]" : "",
                wasCorrect ? "shadow-[0_0_18px_rgba(34,197,94,0.12)]" : "",
              ].filter(Boolean).join(" ")}
              style={{
                background: isTapped
                  ? "rgba(232,160,0,0.06)"
                  : "rgba(255,255,255,0.03)",
                borderColor,
                borderWidth: "1px",
                animationDelay: `${idx * 60}ms`,
              }}
            >
              {/* Rank number */}
              <div
                className="flex-shrink-0 w-9 flex items-center justify-center self-stretch"
                style={{ background: "rgba(0,0,0,0.2)" }}
              >
                <span className="text-sm font-black" style={{ color: "#444" }}>{idx + 1}</span>
              </div>

              {/* Poster */}
              <div
                className="flex-shrink-0 w-10 h-14 rounded-lg overflow-hidden"
                style={{ background: "#1a1a1a" }}
              >
                {movie.poster && movie.poster !== "N/A" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={movie.poster}
                    alt={movie.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-lg opacity-20">🎬</div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0 py-3">
                <p className="font-bold text-sm leading-tight text-[#f0f0f0] line-clamp-2">
                  {movie.title}
                </p>
                <p className="text-xs mt-0.5" style={{ color: "#555" }}>{movie.year}</p>
                {phase === "revealed" && (
                  <p
                    className="text-sm font-black mt-1.5"
                    style={{ color: wasCorrect ? "#4ade80" : "#e8a000" }}
                  >
                    ⭐ {parseFloat(movie.imdbRating).toFixed(1)}
                    {wasCorrect && (
                      <span className="text-xs font-normal ml-1.5 text-green-400">✓ correct</span>
                    )}
                  </p>
                )}
              </div>

              {/* Drag handle */}
              {phase === "playing" && (
                <div className="flex-shrink-0 pr-3 flex flex-col gap-1 opacity-30">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="w-4 h-px rounded-full" style={{ background: "#aaa" }} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Tap hint */}
      {phase === "playing" && selectedIdx !== null && (
        <p className="text-center text-xs mb-2 animate-pulse" style={{ color: "#e8a000" }}>
          Tap another card to swap it
        </p>
      )}

      {/* Action slot — fixed height to prevent jump */}
      <div style={{ minHeight: 64 }}>
        {phase === "playing" && (
          <button
            onClick={handleConfirm}
            className="w-full font-bold py-4 rounded-xl transition-all hover:opacity-85 active:scale-[0.98]"
            style={{ background: "#e8a000", color: "#111" }}
          >
            Lock it in →
          </button>
        )}

        {phase === "revealed" && (
          <div className="space-y-3">
            <p className="text-center text-sm" style={{ color: "#777" }}>{grade.sub}</p>
            <div className="flex gap-3">
              <button
                onClick={initGame}
                className="flex-1 font-bold py-3 rounded-xl hover:opacity-85 transition-all"
                style={{ background: "#e8a000", color: "#111" }}
              >
                Next Person
              </button>
              <button
                onClick={() => router.push("/")}
                className="flex-1 font-bold py-3 rounded-xl hover:opacity-85 transition-all"
                style={{
                  background: "transparent",
                  color: "#f0f0f0",
                  border: "1px solid rgba(255,255,255,0.09)",
                }}
              >
                Home
              </button>
            </div>
            <ShareButton
              text={buildShareText(person.name, score, total, correctOrder, order)}
              className="w-full"
            />
          </div>
        )}
      </div>
    </div>
  );
}
