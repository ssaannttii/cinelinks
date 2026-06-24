const { test } = require('node:test');
const assert = require('node:assert');
const P = require('../lib/pool');

test('discoverMovie builds a valid path with the quality gate', () => {
  assert.strictEqual(
    P.discoverMovie({ page: 5, minVotes: 1000, from: 1990, to: 1999 }),
    'discover/movie&sort_by=vote_count.desc&include_adult=false&vote_count.gte=1000&page=5&primary_release_date.gte=1990-01-01&primary_release_date.lte=1999-12-31'
  );
  // defaults
  assert.strictEqual(P.discoverMovie(), 'discover/movie&sort_by=vote_count.desc&include_adult=false&vote_count.gte=700&page=1');
});

test('discoverTv uses first_air_date and a tv path', () => {
  const p = P.discoverTv({ page: 2, minVotes: 250 });
  assert.ok(p.startsWith('discover/tv&'));
  assert.ok(p.includes('vote_count.gte=250'));
  assert.ok(p.includes('page=2'));
});

test('randInt stays within 1..n', () => {
  for (let i = 0; i < 200; i++) {
    const r = P.randInt(40);
    assert.ok(Number.isInteger(r) && r >= 1 && r <= 40, 'got ' + r);
  }
  assert.strictEqual(P.randInt(1), 1);
});

test('decadeMovie windows a single decade with a release-date range', () => {
  const p = P.decadeMovie(1970);
  assert.ok(p.includes('primary_release_date.gte=1970-01-01'));
  assert.ok(p.includes('primary_release_date.lte=1979-12-31'));
  assert.ok(p.includes('vote_count.gte=400'));
});

test('DECADES spans 1930s–2020s', () => {
  assert.strictEqual(P.DECADES[0], 1930);
  assert.strictEqual(P.DECADES[P.DECADES.length - 1], 2020);
  assert.strictEqual(P.DECADES.length, 10);
});
