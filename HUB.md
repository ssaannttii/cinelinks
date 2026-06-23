# CineLinks suite — structure, naming & unification plan

A small family of daily cinephile games sharing one philosophy: a **Daily** shared
puzzle (same for everyone) + a **Practice** unlimited-training mode, with streaks,
emoji-grid sharing, and TMDB data.

## The games (Cine\* family)

| Game | Mechanic | Daily | Practice | Where |
|------|----------|-------|----------|-------|
| **CineLinks** | Connect actors/films/TV in fewest clicks | ✅ Today's Challenge | ✅ Practice (was "Random Game") | root (`/`) |
| **CineClue** | Guess the film from progressive clues | ✅ `/cineclue.html` | ✅ `/cineclue.html?practice=1` | root |
| **CineRating** | Guess / compare ratings | ✅ Higher-or-Lower daily | the other modes | `cinerating.vercel.app` (Next.js) |
| **CineFrame** *(planned)* | Guess the film from a progressively-unblurred frame | ✅ | ✅ | root (reuses CineClue engine) |

### Naming decisions
- **Vocabulary:** every game uses **Daily** (the shared puzzle of the day) and
  **Practice** (replayable training, no streak). Standardised across the suite.
- **The visual game is "CineFrame", not "Framed".** "Framed" is an existing,
  well-known game — avoid the clash and stay in the `Cine*` family. It shows a
  blurred movie still/backdrop that sharpens with each wrong guess. It reuses the
  CineClue engine (daily pool, autocomplete, streak, share, persistence); the only
  new bits are the `movie/{id}/images` TMDB endpoint and the blur reveal.

## Shared history / stats
`/stats.html` aggregates streaks & history from `localStorage`. It can read **only
same-origin** games (CineLinks + CineClue, both served from the root deploy).
CineRating lives on a different origin, so its stats are **not** readable from here.
That is the main reason to unify domains (below).

## Unifying everything under one domain (the real merge)

Goal: serve the rating games under `cinelinks.vercel.app/...` so the whole suite is
one origin → **shared stats**, one nav, one "site". Recommended approach **without
rewriting** the Next.js app into vanilla:

1. In `ratinggame/next.config.ts` set `basePath: '/rating'` (and `assetPrefix` if
   needed). The CineRating app now lives at `/rating/versus`, `/rating/game`, etc.
2. Keep CineRating as its own Vercel project/deploy, OR add it as a second deploy.
3. In the **root** project's `vercel.json`, add a rewrite that proxies the subpath
   to the CineRating deployment:
   ```json
   { "rewrites": [
     { "source": "/rating/:path*", "destination": "https://cinerating.vercel.app/rating/:path*" }
   ] }
   ```
   Now `cinelinks.vercel.app/rating/...` serves the rating app from the **same
   origin** → its `localStorage` is shared with CineLinks/CineClue, and `stats.html`
   can include it.
4. Update cross-links to use `/rating/...` instead of the external domain.

**Why it's not done blind here:** sub-path proxying of a Next.js app (asset URLs,
client routing, the daily seed, image domains) only really proves out on a live
deploy. Do it as a focused step where each route can be checked after deploying,
then flip the cross-links and extend `stats.html` to read the rating keys.

A heavier alternative (single deploy: host the static games inside the Next app via
`public/`) is possible but a bigger restructure; the rewrite approach gets ~all the
benefit (one origin, shared stats) with far less risk.
