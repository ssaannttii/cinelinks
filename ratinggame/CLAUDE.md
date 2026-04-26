# CineRating — Context for Claude

## Git workflow
- Sandbox commits, **Santi pushes via Fork**
- Never push from sandbox (proxy blocks GitHub)
- If commit fails with HEAD.lock: Santi runs `rm -f .git/HEAD.lock .git/index.lock` in Terminal

## Stack
Next.js 14 App Router · TypeScript · Tailwind CSS · Vercel

## APIs
- `/api/movie?id=IMDB_ID` — fetches movie data from OMDB
- `/api/session?count=N` — returns `{ pairs: [MovieStub, MovieStub][] }` via `pickBalancedPairs`
- `/api/filmography?count=N&movies=N` — returns `{ challenges }` with person + movieIds
- `/api/person-photo?slug=Wikipedia_Slug` — Wikipedia REST API photo

## Game modes
| Route | Description |
|---|---|
| `/versus` | Higher or Lower — pick which of 2 films is rated higher |
| `/filmography` | Filmography Battle — 4 films, pick the highest rated |
| `/career` | Career Mode — drag/tap-rank 5 films by same person |
| `/game` | Classic — guess the IMDB/RT score |

## Key files
- `src/lib/movies.ts` — full movie pool, tier system (T1/T2/T3), `pickBalancedPairs`, Fisher-Yates shuffle
- `src/lib/filmography.ts` — 34-person pool (directors + actors, prestige + popular), Fisher-Yates shuffle
- `src/app/globals.css` — custom keyframes: `cardIn`, `slideInLeft`, `slideUp`
- `src/components/AutoNextButton.tsx` — countdown auto-advance button
- `src/components/ShareButton.tsx` — copy-to-clipboard share

## Movie pool design
- **Tier 1** (~8.3+ IMDB): classic masterpieces — hard pairs
- **Tier 2** (~7.0–8.2): solid films — medium pairs  
- **Tier 3** (~5.5–6.9): popular/fun films — easier pairs
- `pickBalancedPairs(n)`: 35% T1, 45% T2, 20% T3 — same-tier pairing only

## Filmography pool (34 people)
Directors: Nolan, Tarantino, Spielberg, Scorsese, Kubrick, Fincher, Miyazaki, Coen Bros, Ridley Scott, Cameron, Villeneuve, Wes Anderson, Cuarón, Bong Joon-ho, Sofia Coppola, Park Chan-wook, Kurosawa, Edgar Wright, Kathryn Bigelow, Tim Burton

Actors: DiCaprio, Tom Hanks, Brad Pitt, De Niro, Nicholson, Joaquin Phoenix, Meryl Streep, Blanchett, Denzel, DDL, Morgan Freeman, Cillian Murphy, Ryan Gosling, Natalie Portman, Jake Gyllenhaal, Tom Cruise, Will Smith, RDJ, Keanu Reeves

## Design tokens
- Background: `#0d0d0d`
- Gold accent: `#e8a000`
- Text primary: `#f0f0f0`
- Text muted: `#777`
- Cards: `rgba(255,255,255,0.045)` + `border: rgba(255,255,255,0.09)`
