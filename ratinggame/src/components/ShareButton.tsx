"use client";

import { useState } from "react";

interface Props {
  text: string;
  className?: string;
}

export default function ShareButton({ text, className = "" }: Props) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ text });
      } else {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // silently fail
      }
    }
  };

  return (
    <button
      onClick={handleShare}
      className={`font-bold py-3 rounded-xl transition-all hover:opacity-85 active:scale-[0.98] ${className}`}
      style={{
        background: copied ? "rgba(34,197,94,0.15)" : "rgba(232,160,0,0.12)",
        color: copied ? "#4ade80" : "#e8a000",
        border: copied ? "1px solid rgba(34,197,94,0.3)" : "1px solid rgba(232,160,0,0.3)",
      }}
    >
      {copied ? "✓ Copied!" : "Share Result"}
    </button>
  );
}
