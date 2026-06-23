'use strict';
// Minimal .env loader (no dependency). Reads ../.env.local then ../.env and sets
// any keys not already present in process.env. Lets `vercel env pull .env.local`
// feed TMDB_API_KEY to the scripts without an extra `source` / export step.
const fs = require('fs');
const path = require('path');

function loadEnv() {
  for (const name of ['.env.local', '.env']) {
    const file = path.join(__dirname, '..', name);
    if (!fs.existsSync(file)) continue;
    for (const raw of fs.readFileSync(file, 'utf8').split('\n')) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq < 0) continue;
      const key = line.slice(0, eq).trim();
      let val = line.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (key && process.env[key] === undefined) process.env[key] = val;
    }
  }
}

module.exports = { loadEnv };
