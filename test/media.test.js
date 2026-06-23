const { test } = require('node:test');
const assert = require('node:assert');
const Media = require('../lib/media');

test('parseEntry handles movie ids, tv tags and objects', () => {
  assert.deepStrictEqual(Media.parseEntry(862), { type: 'movie', id: 862 });
  assert.deepStrictEqual(Media.parseEntry('862'), { type: 'movie', id: 862 });
  assert.deepStrictEqual(Media.parseEntry('tv:1396'), { type: 'tv', id: 1396 });
  assert.deepStrictEqual(Media.parseEntry('TV:1399'), { type: 'tv', id: 1399 });
  assert.deepStrictEqual(Media.parseEntry({ id: 5, type: 'tv' }), { type: 'tv', id: 5 });
  assert.deepStrictEqual(Media.parseEntry({ id: 5 }), { type: 'movie', id: 5 });
});

test('title/year read the right fields per medium', () => {
  const movie = { title: 'Toy Story', release_date: '1995-11-22' };
  const tv = { name: 'Breaking Bad', original_name: 'Breaking Bad', first_air_date: '2008-01-20' };
  assert.strictEqual(Media.title(movie, 'movie'), 'Toy Story');
  assert.strictEqual(Media.year(movie, 'movie'), '1995');
  assert.strictEqual(Media.title(tv, 'tv'), 'Breaking Bad');
  assert.strictEqual(Media.year(tv, 'tv'), '2008');
  assert.strictEqual(Media.title(null, 'tv'), '');
  assert.strictEqual(Media.year(null, 'movie'), '');
});

test('lengthLabel: minutes for movies, seasons for TV', () => {
  assert.strictEqual(Media.lengthLabel({ runtime: 142 }, 'movie'), '142 min');
  assert.strictEqual(Media.lengthLabel({ number_of_seasons: 5 }, 'tv'), '5 seasons');
  assert.strictEqual(Media.lengthLabel({ number_of_seasons: 1 }, 'tv'), '1 season');
  assert.strictEqual(Media.lengthLabel({}, 'movie'), '');
});

test('makers: Director from crew (movie) vs created_by (tv)', () => {
  const credits = { crew: [{ job: 'Director', name: 'Frank Darabont' }, { job: 'Writer', name: 'X' }] };
  assert.deepStrictEqual(Media.makers({}, credits, 'movie'), ['Frank Darabont']);
  const tvDetail = { created_by: [{ name: 'Vince Gilligan' }, { name: 'Person Two' }, { name: 'Third' }] };
  assert.deepStrictEqual(Media.makers(tvDetail, {}, 'tv'), ['Vince Gilligan', 'Person Two']);
  assert.strictEqual(Media.makerLabel('tv'), 'Creator');
  assert.strictEqual(Media.makerLabel('movie'), 'Director');
});

test('TMDB path builders branch on type', () => {
  assert.strictEqual(Media.detailPath('movie', 862), 'movie/862');
  assert.strictEqual(Media.detailPath('tv', 1396), 'tv/1396');
  assert.strictEqual(Media.creditsPath('movie', 1), 'movie/1/credits');
  assert.strictEqual(Media.creditsPath('tv', 1), 'tv/1/aggregate_credits');
  assert.strictEqual(Media.keywordsPath('tv', 1), 'tv/1/keywords');
  assert.strictEqual(Media.imagesPath('tv', 1), 'tv/1/images');
});

test('searchMap normalises movie and tv results, drops people', () => {
  assert.deepStrictEqual(
    Media.searchMap({ media_type: 'movie', id: 1, title: 'Heat', release_date: '1995-12-15', poster_path: '/a.jpg' }),
    { id: 1, type: 'movie', title: 'Heat', year: '1995', poster: '/a.jpg' });
  assert.deepStrictEqual(
    Media.searchMap({ media_type: 'tv', id: 2, name: 'The Wire', first_air_date: '2002-06-02', poster_path: '/b.jpg' }),
    { id: 2, type: 'tv', title: 'The Wire', year: '2002', poster: '/b.jpg' });
  assert.strictEqual(Media.searchMap({ media_type: 'person', id: 3, name: 'Someone' }), null);
  assert.strictEqual(Media.searchMap(null), null);
});

test('sameTarget compares id AND type', () => {
  assert.ok(Media.sameTarget({ id: 5, type: 'tv' }, { id: 5, type: 'tv' }));
  assert.ok(!Media.sameTarget({ id: 5, type: 'tv' }, { id: 5, type: 'movie' }));
  assert.ok(Media.sameTarget({ id: 7 }, { id: 7, type: 'movie' })); // default type = movie
  assert.ok(!Media.sameTarget({ id: 7 }, { id: 8 }));
});
