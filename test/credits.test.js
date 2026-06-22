'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { filterPersonCredits, isUsableCredit, AWARD_RE } = require('../lib/credits');

const YEAR = 2024;

test('keeps movies, drops people-type and award TV shows', () => {
  const d = { cast: [
    { media_type: 'movie', id: 1, title: 'Big Hit', vote_count: 5000, release_date: '2010-01-01' },
    { media_type: 'tv', id: 2, name: 'The Oscars', vote_count: 9000, first_air_date: '2015-01-01' },
    { media_type: 'tv', id: 3, name: 'Real Drama', vote_count: 800, first_air_date: '2018-01-01' },
    { media_type: 'person', id: 4, name: 'nope' }
  ] };
  const out = filterPersonCredits(d, { currentYear: YEAR });
  const ids = out.map((m) => m.id);
  assert.ok(ids.includes(1), 'movie kept');
  assert.ok(ids.includes(3), 'normal tv kept');
  assert.ok(!ids.includes(2), 'award show dropped');
  assert.ok(!ids.includes(4), 'person dropped');
});

test('drops talk/news genres', () => {
  const d = { cast: [
    { media_type: 'tv', id: 10, name: 'Late Night', genre_ids: [10767], vote_count: 9999, first_air_date: '2016-01-01' },
    { media_type: 'tv', id: 11, name: 'Keeper', vote_count: 100, first_air_date: '2016-01-01' }
  ] };
  const ids = filterPersonCredits(d, { currentYear: YEAR }).map((m) => m.id);
  assert.deepStrictEqual(ids, [11]);
});

test('dedupes by media_type+id', () => {
  const d = { cast: [
    { media_type: 'movie', id: 1, title: 'A', vote_count: 100, release_date: '2010-01-01' },
    { media_type: 'movie', id: 1, title: 'A dup', vote_count: 100, release_date: '2010-01-01' }
  ] };
  assert.strictEqual(filterPersonCredits(d, { currentYear: YEAR }).length, 1);
});

test('filters low-vote unless recent, and sorts by votes with recency boost', () => {
  const d = { cast: [
    { media_type: 'movie', id: 1, title: 'Old Obscure', vote_count: 5, release_date: '2000-01-01' },
    { media_type: 'movie', id: 2, title: 'Old Hit', vote_count: 500, release_date: '2005-01-01' },
    { media_type: 'movie', id: 3, title: 'Brand New', vote_count: 3, release_date: String(YEAR) + '-01-01' }
  ] };
  const out = filterPersonCredits(d, { currentYear: YEAR });
  const ids = out.map((m) => m.id);
  assert.ok(!ids.includes(1), 'old obscure dropped');
  assert.ok(ids.includes(2) && ids.includes(3), 'hit and recent kept');
  assert.strictEqual(out[0].id, 3, 'recent gets boosted to top');
});

test('director mode uses crew Director jobs', () => {
  const d = {
    cast: [{ media_type: 'movie', id: 99, title: 'Acted', vote_count: 9000, release_date: '2010-01-01' }],
    crew: [
      { media_type: 'movie', id: 50, title: 'Directed', job: 'Director', vote_count: 9000, release_date: '2012-01-01' },
      { media_type: 'movie', id: 51, title: 'Produced', job: 'Producer', vote_count: 9000, release_date: '2012-01-01' }
    ]
  };
  const ids = filterPersonCredits(d, { isDirector: true, currentYear: YEAR }).map((m) => m.id);
  assert.deepStrictEqual(ids, [50]);
});

test('output node shape', () => {
  const d = { cast: [{ media_type: 'tv', id: 7, name: 'Show', vote_count: 5000, first_air_date: '2019-06-01' }] };
  const n = filterPersonCredits(d, { currentYear: YEAR })[0];
  assert.deepStrictEqual(n, { name: 'Show', type: 'tv', id: 7, img: undefined, yearLabel: '2019', sub: '2019 · TV' });
});

test('AWARD_RE and isUsableCredit basics', () => {
  assert.ok(AWARD_RE.test('Primetime Emmy Awards'));
  assert.ok(!AWARD_RE.test('Emmanuelle'));
  assert.ok(isUsableCredit({ media_type: 'movie', id: 1 }));
  assert.ok(!isUsableCredit({ media_type: 'tv', id: 2, name: 'The Golden Globe Awards' }));
});
