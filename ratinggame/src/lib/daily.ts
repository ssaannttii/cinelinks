// Shared daily-completion marker for the four rating modes.
//
// The main site's "day complete" tracker reads ONE localStorage key
// (`cinerating_daily`, same origin thanks to the /rating/* proxy) and needs to
// know WHICH modes were played — finishing one mode must not mark the whole
// rating hub done. Every mode calls markRatingDaily('<mode>') on completion and
// the key accumulates { date, modes: { versus:1, career:1, game:1, toptrumps:1 } }.
//
// Date key: the suite's daily rolls over on Europe/Madrid midnight
// (DAILY_TIME_ZONE in index.html), NOT UTC — using UTC here made the home badge
// disagree with the games for two hours every night.

export type RatingMode = "versus" | "career" | "game" | "toptrumps";

export function madridDayKey(): string {
  try {
    const p = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" })
      .formatToParts(new Date())
      .reduce((o: Record<string, string>, x) => { if (x.type !== "literal") o[x.type] = x.value; return o; }, {});
    return `${p.year}${p.month}${p.day}`;
  } catch {
    const n = new Date();
    return `${n.getUTCFullYear()}${String(n.getUTCMonth() + 1).padStart(2, "0")}${String(n.getUTCDate()).padStart(2, "0")}`;
  }
}

export function markRatingDaily(mode: RatingMode, extra?: Record<string, unknown>) {
  try {
    const td = madridDayKey();
    const raw = JSON.parse(localStorage.getItem("cinerating_daily") || "null") || {};
    const sameDay = raw.date === td;
    const modes = { ...(sameDay && raw.modes ? raw.modes : {}), [mode]: 1 };
    localStorage.setItem("cinerating_daily", JSON.stringify({ ...(sameDay ? raw : {}), ...(extra || {}), date: td, modes }));
  } catch { /* noop */ }
}

export function ratingDailyState(): { date?: string; modes?: Record<string, 1> } & Record<string, unknown> {
  try { return JSON.parse(localStorage.getItem("cinerating_daily") || "null") || {}; } catch { return {}; }
}

// The collection engine (vanilla /collection.js, injected in layout.tsx — same
// origin through the proxy) — typed loosely so modes can grant cards on wins.
declare global {
  interface Window {
    Collection?: {
      add: (items: Array<Record<string, unknown>>) => Array<Record<string, unknown>>;
      reveal?: (cards: Array<Record<string, unknown>>) => void;
    };
    CineInternal?: {
      isTester?: () => boolean;
    };
  }
}
