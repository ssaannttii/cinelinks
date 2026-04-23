import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center min-h-screen px-4 text-center">
      {/* Hero */}
      <div className="animate-slide-up">
        <div className="mb-6 flex items-center justify-center gap-3">
          <span className="text-5xl">🎬</span>
        </div>
        <h1 className="text-5xl md:text-6xl font-black tracking-tight mb-4">
          Cine<span className="text-yellow-400">Rating</span>
        </h1>
        <p className="text-xl text-zinc-400 mb-2 max-w-md mx-auto">
          Think you know movies? Put your critic instincts to the test.
        </p>
        <p className="text-sm text-zinc-600 mb-12 max-w-xs mx-auto">
          Guess IMDB scores and Rotten Tomatoes percentages across 10 iconic films.
        </p>

        {/* Mode cards */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
          <Link href="/game?mode=imdb" className="group flex flex-col items-center gap-2 bg-zinc-900 border border-zinc-800 hover:border-yellow-400/60 hover:bg-zinc-800 rounded-2xl px-8 py-6 transition-all duration-200 w-full sm:w-56">
            <span className="text-3xl">⭐</span>
            <span className="font-bold text-lg text-yellow-400">IMDB Mode</span>
            <span className="text-zinc-400 text-sm">Guess the score from 0.0 to 10.0</span>
          </Link>

          <Link href="/game?mode=rt" className="group flex flex-col items-center gap-2 bg-zinc-900 border border-zinc-800 hover:border-red-400/60 hover:bg-zinc-800 rounded-2xl px-8 py-6 transition-all duration-200 w-full sm:w-56">
            <span className="text-3xl">🍅</span>
            <span className="font-bold text-lg text-red-400">Rotten Tomatoes</span>
            <span className="text-zinc-400 text-sm">Guess the Tomatometer %</span>
          </Link>

          <Link href="/game?mode=both" className="group flex flex-col items-center gap-2 bg-zinc-900 border border-zinc-800 hover:border-purple-400/60 hover:bg-zinc-800 rounded-2xl px-8 py-6 transition-all duration-200 w-full sm:w-56">
            <span className="text-3xl">🎯</span>
            <span className="font-bold text-lg text-purple-400">Double Down</span>
            <span className="text-zinc-400 text-sm">Guess both — max points, max pain</span>
          </Link>
        </div>

        {/* Scoring note */}
        <p className="text-xs text-zinc-600">
          10 films · Scored by accuracy · Closer = more points
        </p>

        {/* CineLinks link */}
        <a
          href="https://cinelinks.vercel.app"
          target="_blank"
          rel="noopener"
          className="mt-8 inline-block text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
        >
          Also try CineLinks — connect movies through cast & crew →
        </a>
      </div>
    </main>
  );
}
