# CineLinks

CineLinks is a tiny movie-linking game: start from an actor, movie, or TV show, then click through cast, directors, filmographies, and credits until you reach the target in as few steps as possible.

It is inspired by the classic "six degrees" idea, but tuned for fast movie-night play: daily challenges, random games, shareable links, and a final route recap that shows the path you took.

## How It Works

1. Start at the given movie, actor, or TV show.
2. Pick a connected person or title from the available credits.
3. Keep moving through the network until you reach the goal.
4. Compare your route against an estimated optimal distance.

## Features

- Daily and random challenges.
- Movie, actor, director, and TV show navigation.
- TV cast expansion using aggregate credits for a wider set of recurring performers.
- Shareable challenge URLs.
- Debug links for sharing the exact current step.
- Visual route timeline on the win screen.
- TMDB-backed artwork for posters and portraits.
- Small serverless TMDB proxy so the API key is never exposed in the browser.

## Tech Stack

- Plain HTML, CSS, and JavaScript.
- Vercel serverless function in `api/tmdb.js`.
- TMDB API for metadata, credits, posters, and portraits.

## Running Locally

This project expects a TMDB API key in the environment:

```sh
TMDB_API_KEY=your_key_here
```

The app is designed for Vercel, where `/api/tmdb` proxies the allowed TMDB endpoints. For local development, run it with a Vercel-compatible dev server so the API route is available.

```sh
vercel dev
```

Then open the local URL printed by Vercel.

## Deployment

Deploy on Vercel and set the `TMDB_API_KEY` environment variable in the project settings.

## Notes

CineLinks uses data and images from TMDB, but is not endorsed or certified by TMDB.
