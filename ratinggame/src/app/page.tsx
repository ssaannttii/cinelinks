import Link from "next/link";

const NEW_MODES = [
  {
    href: "/versus",
    icon: "🆚",
    title: "Higher or Lower",
    subtitle: "Two movies. One is rated higher. Pick correctly.",
    color: "text-yellow-400",
    border: "hover:border-yellow-400/60",
    badge: "NEW",
    badgeColor: "bg-yellow-400 text-black",
  },
  {
    href: "/filmography",
    icon: "🎬",
    title: "Filmography Battle",
    subtitle: "4 films by the same director or actor — which is rated highest?",
    color: "text-purple-400",
    border: "hover:border-purple-400/60",
    badge: "NEW",
    badgeColor: "bg-purple-400 text-black",
  },
];

const CLASSIC_MODES = [
  {
    href: "/game?mode=imdb",
    icon: "⭐",
    title: "IMDB Score",
    subtitle: "Guess the score from 0.0 to 10.0",
    color: "text-yellow-400",
    border: "hover:border-yellow-400/40",
  },
  {
    href: "/game?mode=rt",
    icon: "🍅",
    title: "Rotten Tomatoes",
    subtitle: "Guess the Tomatometer %",
    color: "text-red-400",
    border: "hover:border-red-400/40",
  },
  {
    href: "/game?mode=both",
    icon: "🎯",
    title: "Double Down",
    subtitle: "Guess both — max points, max pain",
    color: "text-orange-400",
    border: "hover:border-orange-400/40",
  },
];

export default function Home() {
  return (
    <main className="flex flex-col items-center min-h-screen px-4 py-12">
      {/* Hero */}
      <div className="text-center mb-10 animate-slide-up">
        <div className="mb-4 text-5xl">🎬</div>
        <h1 className="text-5xl md:text-6xl font-black tracking-tight mb-3">
          Cine<span className="text-yellow-400">Rating</span>
        </h1>
        <p className="text-zinc-400 text-lg max-w-sm mx-auto">
          Think you know movies? Put your instincts to the test.
        </p>
      </div>

      {/* New modes — featured */}
      <div className="w-full max-w-2xl mb-4">
        <p className="text-xs text-zinc-600 uppercase tracking-widest mb-3 px-1">Featured</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {NEW_MODES.map((mode) => (
            <Link
              key={mode.href}
              href={mode.href}
              className={`group relative flex flex-col gap-2 bg-zinc-900 border border-zinc-800 ${mode.border} rounded-2xl px-6 py-5 transition-all duration-200 hover:bg-zinc-800`}
            >
              {mode.badge && (
                <span
                  className={`absolute top-3 right-3 text-[10px] font-black px-2 py-0.5 rounded-full ${mode.badgeColor}`}
                >
                  {mode.badge}
                </span>
              )}
              <span className="text-3xl">{mode.icon}</span>
              <span className={`font-bold text-lg ${mode.color}`}>{mode.title}</span>
              <span className="text-zinc-500 text-sm leading-snug">{mode.subtitle}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Classic modes */}
      <div className="w-full max-w-2xl mb-10">
        <p className="text-xs text-zinc-600 uppercase tracking-widest mb-3 px-1">Classic</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {CLASSIC_MODES.map((mode) => (
            <Link
              key={mode.href}
              href={mode.href}
              className={`group flex flex-col items-center gap-2 bg-zinc-900 border border-zinc-800 ${mode.border} rounded-2xl px-5 py-4 transition-all duration-200 hover:bg-zinc-800 text-center`}
            >
              <span className="text-2xl">{mode.icon}</span>
              <span className={`font-bold text-base ${mode.color}`}>{mode.title}</span>
              <span className="text-zinc-500 text-xs">{mode.subtitle}</span>
            </Link>
          ))}
        </div>
      </div>

      <p className="text-xs text-zinc-700">
        Powered by IMDB · Rotten Tomatoes ·{" "}
        <a
          href="https://cinelinks.vercel.app"
          target="_blank"
          rel="noopener"
          className="hover:text-zinc-500 transition-colors"
        >
          Also try CineLinks →
        </a>
      </p>
    </main>
  );
}
