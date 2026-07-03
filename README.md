# 🎬 CineLinks

Connect actors, movies, and TV shows in as few clicks as possible.

**[Play at cinelinks.vercel.app](https://cinelinks.vercel.app)**

---

Data and images from [TMDB](https://www.themoviedb.org/). This product uses the TMDB API but is not endorsed or certified by TMDB.

## Admin

`/admin.html` manages daily challenge overrides. Set `ADMIN_PASSWORD`, `TMDB_API_KEY`, `KV_REST_API_URL`, and `KV_REST_API_TOKEN` in Vercel.

## Operations

Before deploying, run `npm run verify`. After production deploys, run
`npm run smoke:prod`. The full deploy checklist and native-function notes live in
[`DEPLOYMENT.md`](DEPLOYMENT.md).
