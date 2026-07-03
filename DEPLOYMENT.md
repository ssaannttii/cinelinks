# CineLinks deployment runbook

Production URL: https://cinelinks.vercel.app

Vercel project: `ssaannttiis-projects/cinelinks`

## Pre-deploy checks

Run these from the repo root:

```sh
npm run verify
```

This covers:

- Root unit tests.
- Root ESLint.
- `ratinggame` ESLint.
- `ratinggame` production build.

For a faster root-only pass:

```sh
npm test
npm run lint
```

## Deploy

The normal production path is either a push to `main` or:

```sh
npx vercel deploy --prod
```

After deployment:

```sh
npm run smoke:prod
```

You can point the smoke test at a preview URL:

```sh
npm run smoke:prod -- https://your-preview.vercel.app
```

If you only want the lightweight checks and want to skip the cold-start-heavy depth
function:

```sh
npm run smoke:prod -- --skip-depth
```

## Internal tester mode

Use this on your own devices before playing/testing production:

```txt
https://cinelinks.vercel.app/?cl_tester=1
```

It stores a local `cl_internalTester=1` flag in that browser. While active:

- Vercel Analytics is not loaded.
- `Track(...)` custom events are ignored.
- Daily score POSTs and Top Trumps rival-deck POSTs are skipped, so your tests do
  not pollute shared aggregates.

Disable it on a device with:

```txt
https://cinelinks.vercel.app/?cl_tester=0
```

This flag is per browser/device. For cross-device sync of real game progress, use
Google sign-in; for analytics exclusion, open the tester URL once on each device.

## Private beta link

For friends or early testers, use:

```txt
https://cinelinks.vercel.app/beta.html
```

That stores a local `cl_beta=1` flag and then sends them to `/?beta=1`. Beta users
see the obvious BETA badge and lightweight feedback button, and analytics events
include `beta: 1` so they can be filtered separately from normal traffic.

Tester mode wins over beta mode: if your browser has `cl_tester=1`, feedback and
analytics still no-op even if you open the beta link.

Beta feedback is stored in KV through `/api/feedback` and can be reviewed from:

```txt
https://cinelinks.vercel.app/admin.html
```

Unlock with `ADMIN_PASSWORD`; the feedback panel shows 14-day button counts and
the latest compact votes.

## Native function gotcha

`api/depth` uses `onnxruntime-node` and `sharp`. It must be built by Vercel's Linux
builder so the deployed function contains Linux native binaries.

Avoid `vercel build --prod && vercel deploy --prebuilt --prod` from macOS for the
normal production deploy. It can upload macOS-native artifacts and make `api/depth`
return 500 even if the static site works.

The project needs this production env var on Vercel:

```txt
VERCEL_SUPPORT_LARGE_FUNCTIONS=1
```

Without it, Vercel can reject `api/depth` with:

```txt
The Vercel Function "api/depth" exceeds the maximum uncompressed size limit of 250mb.
```

If deployment fails, inspect the exact logs:

```sh
npx vercel ls --yes
npx vercel inspect <deployment-url> --logs
```

Useful runtime check:

```sh
curl -sS --max-time 90 -o /tmp/cinelinks_depth.jpg \
  -w '%{http_code} %{content_type} %{size_download} %{time_total}\n' \
  'https://cinelinks.vercel.app/api/depth?im=bjiHEhuiwhIygzjczbTPAA07cGc.jpg'
```

Expected: `200 image/jpeg`.

## Environment variables

Required for full production behavior:

- `ADMIN_PASSWORD`
- `TMDB_API_KEY`
- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`
- `KV_REDIS_URL`
- `KV_URL`
- `KV_REST_API_READ_ONLY_TOKEN`
- `VERCEL_SUPPORT_LARGE_FUNCTIONS=1`

Optional:

- `GOOGLE_CLIENT_ID`, until Google sync is activated client-side.

## Rating game deploy order

The root project rewrites `/rating/*` to `https://cinerating.vercel.app/rating/*`.
When changing `ratinggame`, deploy the CineRating project first, then deploy this
root project so the rewrite points at a compatible build.

Verify:

```sh
open https://cinelinks.vercel.app/rating/versus
```

Watch for missing `/rating/_next/...` or `/rating/api/...` requests.
