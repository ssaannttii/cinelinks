// Depth-map coverage guard: the card detail view ships a pre-computed depth map
// (/depth/<poster basename>) for every entity the games can hand out as a prize
// card. This test re-derives that entity list from the LIVE pool files (offline)
// and fails when pools/sets gained entries whose depth maps were never generated,
// so "I added a pool and forgot the 3D maps" is caught by `npm test`, not by a
// flat-looking card in production.
//
// Fix a failure with:  npm run depth:collect && npm run depth:build
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { collectIds } = require('../scripts/collect-depth-posters');

const ROOT = path.join(__dirname, '..');
const posters = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts', 'depth-posters.json'), 'utf8'));

test('every pool/set entity has been through the depth pipeline', () => {
  const resolved = new Set(posters.map(p => p.key));
  const missing = collectIds().filter(k => !resolved.has(k));
  assert.deepStrictEqual(missing, [],
    missing.length + ' pool entities missing from scripts/depth-posters.json — run: npm run depth:collect && npm run depth:build');
});

test('every resolved poster has its depth map on disk', () => {
  const missing = posters
    .map(p => p.img.replace(/^\//, ''))
    .filter(base => !fs.existsSync(path.join(ROOT, 'depth', base)));
  assert.deepStrictEqual(missing.slice(0, 10), [],
    missing.length + ' depth maps missing under /depth — run: npm run depth:build');
});
