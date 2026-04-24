"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  onNext: () => void;
  delay?: number; // ms
  label: string;
  endLabel?: string; // label override on last round
  isLast?: boolean;
}

export default function AutoNextButton({
  onNext,
  delay = 3000,
  label,
  endLabel,
  isLast = false,
}: Props) {
  const [cancelled, setCancelled] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());
  const pauseRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const firedRef = useRef(false);
  const onNextRef = useRef(onNext);
  onNextRef.current = onNext;

  // Pause when tab is hidden so we don't advance while user isn't watching
  useEffect(() => {
    const onVis = () => {
      if (document.hidden) {
        pauseRef.current = Date.now();
      } else if (pauseRef.current !== null) {
        startRef.current += Date.now() - pauseRef.current;
        pauseRef.current = null;
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  useEffect(() => {
    if (cancelled) return;

    timerRef.current = setInterval(() => {
      if (document.hidden || pauseRef.current !== null) return;
      const el = Date.now() - startRef.current;
      setElapsed(el);
      if (el >= delay && !firedRef.current) {
        firedRef.current = true;
        clearInterval(timerRef.current!);
        onNextRef.current();
      }
    }, 40);

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [cancelled, delay]);

  const handleCancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (timerRef.current) clearInterval(timerRef.current);
    setCancelled(true);
  };

  const handleClick = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    firedRef.current = true;
    onNextRef.current();
  };

  const progress = cancelled ? 1 : Math.min(elapsed / delay, 1);
  const r = 9;
  const circ = 2 * Math.PI * r;
  const dashoffset = circ * (1 - progress);
  const displayLabel = isLast ? (endLabel ?? label) : label;

  return (
    <div className="flex gap-2 mt-4 w-full">
      <button
        onClick={handleClick}
        className="flex-1 flex items-center justify-between gap-3 font-bold py-3 px-4 rounded-xl transition-all hover:opacity-90 active:scale-[0.98]"
        style={{
          background: "rgba(255,255,255,0.06)",
          color: "#f0f0f0",
          border: "1px solid rgba(255,255,255,0.09)",
        }}
      >
        <span>{displayLabel}</span>
        {!cancelled && (
          <svg
            width="22"
            height="22"
            className="flex-shrink-0"
            style={{ transform: "rotate(-90deg)" }}
          >
            <circle
              cx="11" cy="11" r={r}
              fill="none"
              stroke="rgba(255,255,255,0.1)"
              strokeWidth="2.5"
            />
            <circle
              cx="11" cy="11" r={r}
              fill="none"
              stroke="#e8a000"
              strokeWidth="2.5"
              strokeDasharray={circ}
              strokeDashoffset={dashoffset}
              strokeLinecap="round"
            />
          </svg>
        )}
      </button>

      {!cancelled && (
        <button
          onClick={handleCancel}
          title="Cancel auto-advance"
          className="w-11 rounded-xl flex items-center justify-center text-sm transition-all hover:opacity-80"
          style={{
            background: "rgba(255,255,255,0.04)",
            color: "#666",
            border: "1px solid rgba(255,255,255,0.06)",
            flexShrink: 0,
          }}
        >
          ✕
        </button>
      )}
    </div>
  );
}
