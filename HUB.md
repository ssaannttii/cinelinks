# CineLinks suite — structure, naming & unification plan

A small family of daily cinephile games sharing one philosophy: a **Daily** shared
puzzle (same for everyone) + a **Practice** unlimited-training mode, with streaks,
emoji-grid sharing, and TMDB data.

## The games (Cine\* family)

| Game | Mechanic | Daily | Practice | Where |
|------|----------|-------|----------|-------|
| **CineLinks** | Connect actors/films/TV in fewest clicks | ✅ Today's Challenge | ✅ Practice (was "Random Game") | root (`/`) |
| **CineClue** | Guess the film from progressive clues | ✅ `/cineclue.html` | ✅ `/cineclue.html?practice=1` | root |
| **CineFrame** | Guess the film from a progressively-unblurred frame | ✅ `/cineframe.html` | ✅ `?practice=1` | root (shares CineClue's engine + pool) |
| **Rating games** (Higher or Lower · Career · Guess the Score) | Guess / compare ratings | ✅ Higher-or-Lower daily | Career, Guess the Score | mode pages on `cinerating.vercel.app/*`, **entered from the hub** |

> The CineRating standalone home (`cinerating.vercel.app/`) now **redirects to the
> hub** — the rating modes are surfaced as cards in the CineLinks hub and their
> in-game "Home" buttons return to the hub. There's no separate rating home anymore.
> (A full same-origin merge is still the deferred step below, for shared stats.)

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

## Accounts / cross-device sync (Google login) — recommended approach

**Can it be done?** Yes. **Should it be done now?** Not blindly — it needs your own
Google Cloud OAuth credentials, a per-user store, and a security pass. Design it as
an *optional, local-first sync layer* so it never breaks the current localStorage
flow and stays compatible with ongoing changes:

1. **Local-first stays the source of truth.** All games already persist to
   `localStorage` (`clStreak`, `clPlayed`, `cineclue*`, `cineframe*`). Login only
   *syncs* that blob — logged-out play keeps working exactly as today.
2. **Auth:** Google Identity Services (GIS) one-tap / "Sign in with Google" button
   → you get an ID token (JWT). Easiest managed option: **Supabase Auth** or
   **Firebase Auth** (handles Google OAuth, sessions, security for you). Pure GIS +
   your own verify endpoint also works but you maintain more.
3. **Storage:** a tiny serverless endpoint (`/api/sync`) that, given a verified user
   id, GETs/PUTs a JSON stats blob in the existing Upstash KV (`sync:<uid>` →
   `{clStreak, clPlayed, cineclue*, cineframe*}`). Merge strategy: take the max of
   each streak/best and union played-dates, so multiple devices reconcile cleanly.
4. **Schema-tolerant:** store an opaque versioned blob and merge field-by-field, so
   adding new games/keys later never breaks old synced data.
5. **Privacy:** only store game stats + the Google `sub` (no profile data needed);
   add a short privacy note and a "sign out / delete my data" action.

**Why deferred here:** it requires your Google Cloud project + OAuth consent screen,
choosing the auth provider, and a security review of token verification — decisions
and credentials only you can set up. The local-first design above means it can be
added later as a clean opt-in without reworking the games.

## Monetisation
Two options, both config-gated and already wired on every game page (set the value
to enable; empty = nothing renders):

- **Donations (`support.js`) — recommended primary.** Set `SUPPORT_URL` to your
  Ko-fi / Buy Me a Coffee / PayPal.me / GitHub Sponsors page. Shows a small "☕
  Support" pill. For an indie daily game this usually beats ads: no approval, no
  traffic minimums, no UX cost, higher goodwill.
- **Ads (`ads.js`) — optional.** Set `AD_CLIENT` + `AD_SLOT` (Google AdSense) for a
  bottom banner. Needs an approved AdSense account + ad unit; pays little at low
  traffic. The support pill auto-raises above the ad bar if both are enabled.
