# CineLinks suite — structure, naming & unification plan

A small family of daily cinephile games sharing one philosophy: a **Daily** shared
puzzle (same for everyone) + a **Practice** unlimited-training mode, with streaks,
emoji-grid sharing, and TMDB data.

## The games (Cine\* family)

| Game | Mechanic | Daily | Practice | Where |
|------|----------|-------|----------|-------|
| **CineLinks** | Connect actors/films/TV in fewest clicks | ✅ Today's Challenge | ✅ Practice (was "Random Game") | root (`/`) |
| **CineClue** | Guess the film (or TV series) from progressive clues | ✅ `/cineclue.html` | ✅ `/cineclue.html?practice=1` | root |
| **CineFrame** | Guess the film/series from a progressively-unblurred frame | ✅ `/cineframe.html` | ✅ `?practice=1` | root (shares CineClue's engine + pool) |

> **Movies + TV:** CineClue & CineFrame now handle both. Pool entries are movie ids
> (numbers) or TV ids tagged `"tv:<id>"`; `lib/media.js` normalises the TMDB
> movie/tv differences (title vs name, release vs first-air date, Director vs
> Creator, credits vs aggregate_credits) and is unit-tested. Add/curate shows in
> `scripts/build-clue-pool.js` (the `TV` array) so regenerating keeps them.
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

## Accounts / cross-device sync (Google login) — BUILT, dormant until you add a client ID

The optional, local-first sync layer is **implemented and shipped disabled**. The
games keep working exactly as before with no login; signing in only *syncs* the
same `localStorage` stats across devices.

**Pieces (already in the repo):**
- `auth.js` — client. Loads Google Identity Services, shows a "Sign in with Google"
  pill (top-right), and on sign-in pulls + merges + pushes the stats blob. Returning
  users are re-authed silently. Gated by a `CLIENT_ID` constant (empty = nothing
  renders, no GIS loaded).
- `api/sync.js` — serverless. Verifies the Google ID token (checks `aud`/`iss`/`exp`
  via Google's tokeninfo) and GETs/PUTs a per-account JSON blob in Upstash KV at
  `sync:<google-sub>`. Returns `501 sync_disabled` until `GOOGLE_CLIENT_ID` is set.
- `lib/merge-stats.js` — shared, order-independent merge (max streaks, union played
  dates keeping fewest clicks, newer/more-complete daily state). Runs both in the
  browser (local+remote) and on the server (stored+pushed). Unit-tested
  (`test/merge-stats.test.js`). Schema-tolerant: unknown keys ignored, so new games
  won't break old synced data.
- Only game stats + the Google `sub` are stored — no profile data. Sign-out clears
  the local session and disables auto-select.

**To activate (one-time, only you can do this):**
1. In Google Cloud → APIs & Services → Credentials, create an **OAuth 2.0 Client ID**
   of type **Web application**. Add your origins to "Authorized JavaScript origins"
   (`https://cinelinks.vercel.app`, and `http://localhost:3000` for local). The
   client ID is **public** (not a secret).
2. Paste that client ID into `auth.js` (`var CLIENT_ID = '...'`).
3. Set the **same** value as the `GOOGLE_CLIENT_ID` env var on the Vercel project
   (used server-side to verify the token's `aud`). Redeploy.
4. Done — the sign-in pill appears and sync turns on. (Optional later: a "delete my
   synced data" action that does `DEL sync:<sub>`.)

**Not done for you:** creating the OAuth client + consent screen needs your Google
account, and the client ID/redirect origins are yours to own — so those two steps
stay manual. Everything else is wired and tested.

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
