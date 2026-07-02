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

const API_KEY = process.env.TMDB_API_KEY; // checked in main() — collectIds() needs no key

const ROOT = path.join(__dirname, '..');

// A named `const X = [ … ];` block from a game file (so persons in neighbouring
// arrays can't be mis-read as movies — CineGroup keeps both shapes side by side).
function sliceBlock(txt, marker) {
  const s = txt.indexOf(marker); if (s < 0) return '';
  const e = txt.indexOf('];', s); return e < 0 ? '' : txt.slice(s, e);
}
function collectIds() {
  const ids = new Set(); // "type:id"
  const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
  // 1. daily-challenges.js endpoints (CineLinks goals)
  for (const m of read('daily-challenges.js').matchAll(/(movie|person|tv):(\d+)/g)) ids.add(m[1] + ':' + m[2]);
  // 2. shared clue pool — CineClue/Frame/Cast targets (bare numbers = movies, 'tv:<id>' = TV)
  const clue = read('cineclue-pool.js');
  const arr = clue.slice(clue.indexOf('['), clue.lastIndexOf(']') + 1);
  for (const m of arr.matchAll(/'tv:(\d+)'/g)) ids.add('tv:' + m[1]);
  for (const m of arr.matchAll(/(?:^|[\s,[])(\d{2,9})(?=[\s,\]])/gm)) ids.add('movie:' + m[1]);
  // 3. curated set members in collection.js (forgeable)
  for (const m of read('collection.js').matchAll(/\{ id: (\d+), type: '(movie|person|tv)'/g)) ids.add(m[2] + ':' + m[1]);
  // 4. CineLine deck pool (all correctly-placed films are granted)
  const line = read('cineline-pool.js');
  const larr = line.slice(line.indexOf('['), line.lastIndexOf(']') + 1);
  for (const m of larr.matchAll(/(?:^|[\s,[])(\d{2,9})(?=\s*,)/gm)) ids.add('movie:' + m[1]);
  // 5. CineReel curated actor pool (the guessed actor is the prize)
  for (const m of read('cinereel.html').matchAll(/\{id:(\d+),name:/g)) ids.add('person:' + m[1]);
  // 6. CineGroup baked film pools (saga/theme tiles are granted on a win; the
  //    actor/director-group tiles come from live TMDB fetches and can't be
  //    enumerated offline — those fall back to procedural depth)
  const grp = read('cinegroup.html');
  for (const m of sliceBlock(grp, 'const SAGAS').matchAll(/\[(\d{2,9}),"/g)) ids.add('movie:' + m[1]);
  for (const m of sliceBlock(grp, 'const THEMES').matchAll(/\[(\d{2,9}),"/g)) ids.add('movie:' + m[1]);
  return [...ids];
}

async function tmdb(p) {
  const url = 'https://api.themoviedb.org/3/' + p + (p.includes('?') ? '&' : '?') + 'api_key=' + API_KEY;
  const r = await fetch(url);
  if (!r.ok) return null;
  return r.json();
}

async function main() {
  if (!API_KEY) { console.error('TMDB_API_KEY missing — run: npm run env:pull'); process.exit(1); }
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

// Exported so test/depth-coverage.test.js can verify (offline) that every pool
// entity has been through the depth pipeline; run directly to refresh the list.
module.exports = { collectIds };
if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
