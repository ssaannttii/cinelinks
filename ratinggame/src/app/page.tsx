import Link from "next/link";

const NEW_MODES = [
  {
    href: "/versus",
    icon: "🆚",
    title: "Higher or Lower",
    subtitle: "Two movies. One is rated higher. Pick correctly.",
    gold: true,
    badge: "NEW",
  },
  {
    href: "/filmography",
    icon: "🎬",
    title: "Filmography Battle",
    subtitle: "4 films by the same director or actor — which is rated highest?",
    gold: false,
    badge: "NEW",
  },
  {
    href: "/career",
    icon: "🏆",
    title: "Career Mode",
    subtitle: "Rank 5 films by the same person from highest to lowest rated.",
    gold: false,
    badge: "NEW",
  },
];

const CLASSIC_MODES = [
  {
    href: "/game?mode=imdb",
    icon: "⭐",
    title: "IMDB Score",
    subtitle: "Guess the score from 0.0 to 10.0",
  },
  {
    href: "/game?mode=rt",
    icon: "🍅",
    title: "Rotten Tomatoes",
    subtitle: "Guess the Tomatometer %",
  },
  {
    href: "/game?mode=both",
    icon: "🎯",
    title: "Double Down",
    subtitle: "Guess both — max points, max pain",
  },
];

export default function Home() {
  return (
    <main
      className="flex flex-col items-center min-h-screen px-4 py-12"
      style={{ fontFamily: "var(--font-inter), -apple-system, sans-serif" }}
    >
      {/* Hero */}
      <div className="text-center mb-10 animate-slide-up">
        <p
          className="text-[0.6rem] font-bold tracking-[0.18em] uppercase mb-4"
          style={{ color: "#e8a000" }}
        >
          Movie Rating Games
        </p>
        <h1 className="text-5xl md:text-6xl font-black tracking-tight mb-3 text-[#f0f0f0]">
          Cine<span style={{ color: "#e8a000" }}>Rating</span>
        </h1>
        <p style={{ color: "#777" }} className="text-base max-w-xs mx-auto">
          Think you know movies? Put your instincts to the test.
        </p>
      </div>

      {/* Featured modes */}
      <div className="w-full max-w-2xl mb-4">
        <p
          className="text-[0.6rem] font-bold tracking-[0.18em] uppercase mb-3 px-1"
          style={{ color: "#555" }}
        >
          Featured
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {NEW_MODES.map((mode) => (
            <Link
              key={mode.href}
              href={mode.href}
              className="group relative flex flex-col gap-2 rounded-2xl px-6 py-5 transition-all duration-200 hover:-translate-y-0.5"
              style={{
                background: "rgba(255,255,255,0.045)",
                backdropFilter: "blur(18px)",
                border: "1px solid rgba(255,255,255,0.09)",
                boxShadow: "0 4px 24px rgba(0,0,0,0.2)",
              }}
            >
              {mode.badge && (
                <span
                  className="absolute top-3 right-3 text-[9px] font-black px-2 py-0.5 rounded-full"
                  style={{ background: "#e8a000", color: "#111" }}
                >
                  {mode.badge}
                </span>
              )}
              <span className="text-3xl">{mode.icon}</span>
              <span
                className="font-bold text-lg"
                style={{ color: mode.gold ? "#e8a000" : "#f0f0f0" }}
              >
                {mode.title}
              </span>
              <span className="text-sm leading-snug" style={{ color: "#777" }}>
                {mode.subtitle}
              </span>
            </Link>
          ))}
        </div>
      </div>

      {/* Classic modes */}
      <div className="w-full max-w-2xl mb-10">
        <p
          className="text-[0.6rem] font-bold tracking-[0.18em] uppercase mb-3 px-1"
          style={{ color: "#555" }}
        >
          Classic
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {CLASSIC_MODES.map((mode) => (
            <Link
              key={mode.href}
              href={mode.href}
              className="group flex flex-col items-center gap-2 rounded-2xl px-5 py-4 text-center transition-all duration-200 hover:-translate-y-0.5"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.07)",
              }}
            >
              <span className="text-2xl">{mode.icon}</span>
              <span className="font-bold text-sm text-[#f0f0f0]">{mode.title}</span>
              <span className="text-xs" style={{ color: "#777" }}>{mode.subtitle}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* CineLinks cross-link */}
      <div className="w-full max-w-2xl mb-8">
        <a
          href="https://cinelinks.vercel.app"
          target="_blank"
          rel="noopener"
          className="flex items-center gap-4 rounded-2xl px-6 py-4 transition-all duration-200 hover:-translate-y-0.5 group"
          style={{
            background: "rgba(232,160,0,0.07)",
            border: "1px solid rgba(232,160,0,0.25)",
            boxShadow: "0 4px 24px rgba(232,160,0,0.05)",
            textDecoration: "none",
          }}
        >
          <div
            className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-lg"
            style={{ background: "rgba(232,160,0,0.15)" }}
          >
            🔗
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm text-[#f0f0f0] leading-tight">Also try CineLinks</p>
            <p className="text-xs mt-0.5" style={{ color: "#777" }}>
              Six degrees of separation — connect any two films
            </p>
          </div>
          <span
            className="text-xs font-bold flex-shrink-0 group-hover:translate-x-0.5 transition-transform"
            style={{ color: "#e8a000" }}
          >
            →
          </span>
        </a>
      </div>

      <p className="text-xs" style={{ color: "#444" }}>
        Powered by IMDB · Rotten Tomatoes
      </p>
    </main>
  );
}
