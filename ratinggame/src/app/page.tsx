import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "CineRating — movie rating games",
  description: "Four ways to test your movie taste: Higher or Lower, Career Mode, Guess the Score, and Top Trumps.",
};

// Rating-games hub. The main hub lives at cinelinks.vercel.app; this groups the
// four rating modes under one landing so they share a home of their own too.
const MODES: { href: string; icon: string; name: string; desc: string; accent: string }[] = [
  { href: "/versus?mode=daily", icon: "⚖️", name: "Higher or Lower", desc: "Which film is rated higher?", accent: "122,166,232" },
  { href: "/career", icon: "📈", name: "Career Mode", desc: "Rank 5 films by rating", accent: "159,174,90" },
  { href: "/game", icon: "🎯", name: "Guess the Score", desc: "Guess IMDb & Rotten Tomatoes", accent: "216,122,160" },
  { href: "/toptrumps", icon: "🃏", name: "Top Trumps", desc: "Movie card battle vs the CPU", accent: "181,138,214" },
];

export default function RatingHub() {
  return (
    <main style={{ maxWidth: 460, margin: "0 auto", padding: "54px 16px 48px" }}>
      <a href="https://cinelinks.vercel.app" style={{ position: "fixed", top: 13, left: 13, zIndex: 50, display: "inline-flex", alignItems: "center", gap: 5, color: "var(--mut)", textDecoration: "none", fontSize: ".78rem", fontWeight: 700, background: "rgba(20,20,20,.6)", border: "1px solid var(--bdr)", borderRadius: 999, padding: "7px 13px", backdropFilter: "blur(8px)" }}>
        ← CineLinks
      </a>
      <div className="text-center" style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: "2rem", fontWeight: 800, letterSpacing: "-.02em" }}>Cine<span style={{ color: "var(--gold)" }}>Rating</span></h1>
        <p style={{ color: "var(--mut)", fontSize: ".88rem", marginTop: 4 }}>How well do you know movie ratings?</p>
      </div>
      <div className="flex flex-col gap-3">
        {MODES.map((m) => (
          <Link key={m.href} href={m.href} style={{
            display: "flex", alignItems: "center", gap: 14, textDecoration: "none", color: "var(--txt)",
            background: `linear-gradient(150deg, rgba(${m.accent},.13), rgba(255,255,255,.02))`,
            border: `1px solid rgba(${m.accent},.28)`, borderRadius: 14, padding: 16,
          }}>
            <span style={{ width: 46, height: 46, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 12, fontSize: "1.5rem", background: `rgba(${m.accent},.18)` }}>{m.icon}</span>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: "block", fontWeight: 800, fontSize: "1rem" }}>{m.name}</span>
              <span style={{ display: "block", color: "var(--mut)", fontSize: ".8rem", marginTop: 1 }}>{m.desc}</span>
            </span>
            <span style={{ marginLeft: "auto", color: "var(--mut)" }}>→</span>
          </Link>
        ))}
      </div>
    </main>
  );
}
