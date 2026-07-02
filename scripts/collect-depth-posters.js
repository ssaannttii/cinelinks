'use strict';
/* Collect every poster/profile image basename the games can hand out as a card
 * from the curated pools, so build-depth-maps.py can pre-compute a depth map for
 * each. Covers: daily-challenges.js endpoints (CineLinks goals), the shared clue
 * pool (CineClue/Frame/Cast targets), and the curated set members in collection.js.
 * Path cards outside these pools simply fall back to the procedural depth.
 *
 * Usage: node scripts/collect-depth-posters.js   → writes scripts/depth-posters.json
 * Needs TMDB_API_KEY (npm run env:pull).
 */
const fs = require('fs');
const path = require('path');
const { loadEnv } = require('./load-env');
loadEnv();

const API_KEY = process.env.TMDB_API_KEY;
if (!API_KEY) { console.error('TMDB_API_KEY missing — run: npm run env:pull'); process.exit(1); }

const ROOT = path.join(__dirname, '..');

function collectIds() {
  const ids = new Set(); // "type:id"
  // 1. daily-challenges.js endpoints
  const daily = fs.readFileSync(path.join(ROOT, 'daily-challenges.js'), 'utf8');
  for (const m of daily.matchAll(/(movie|person|tv):(\d+)/g)) ids.add(m[1] + ':' + m[2]);
  // 2. shared clue pool (bare numbers = movies, 'tv:<id>' strings = TV)
  const clue = fs.readFileSync(path.join(ROOT, 'cineclue-pool.js'), 'utf8');
  const arr = clue.slice(clue.indexOf('['), clue.lastIndexOf(']') + 1);
  for (const m of arr.matchAll(/'tv:(\d+)'/g)) ids.add('tv:' + m[1]);
  for (const m of arr.matchAll(/(?:^|[\s,[])(\d{2,9})(?=[\s,\]])/gm)) ids.add('movie:' + m[1]);
  // 3. curated set members in collection.js
  const coll = fs.readFileSync(path.join(ROOT, 'collection.js'), 'utf8');
  for (const m of coll.matchAll(/\{ id: (\d+), type: '(movie|person|tv)'/g)) ids.add(m[2] + ':' + m[1]);
  return [...ids];
}

async function tmdb(p) {
  const url = 'https://api.themoviedb.org/3/' + p + (p.includes('?') ? '&' : '?') + 'api_key=' + API_KEY;
  const r = await fetch(url);
  if (!r.ok) return null;
  return r.json();
}

async function main() {
  const ids = collectIds();
  console.log('entities:', ids.length);
  const out = [];
  let done = 0;
  const queue = ids.slice();
  await Promise.all(Array.from({ length: 8 }, async () => {
    while (queue.length) {
      const key = queue.pop();
      const [type, id] = key.split(':');
      const d = await tmdb(type + '/' + id).catch(() => null);
      const img = d && (d.poster_path || d.profile_path);
      if (img) out.push({ key, img });
      if (++done % 100 === 0) console.log(done + '/' + ids.length);
    }
  }));
  out.sort((a, b) => a.key.localeCompare(b.key));
  fs.writeFileSync(path.join(__dirname, 'depth-posters.json'), JSON.stringify(out, null, 1));
  console.log('with image:', out.length, '→ scripts/depth-posters.json');
}
main().catch(e => { console.error(e); process.exit(1); });
