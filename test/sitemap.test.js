// Sitemap / robots consistency.
//
// The sitemap listed 9 of the 17 root pages and had drifted: cinecode.html (a
// live game linked from three places) and privacy.html (linked from eleven) were
// missing. This guard fails when a new indexable page is added and the sitemap
// isn't updated — the kind of omission nobody notices for months.
//
// The inverse matters just as much: pages that are deliberately excluded must
// STAY excluded. cineplot.html is a tombstone that canonicals and 0-second
// redirects to cineclue, so listing it would ask Google to index a redirect.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const sitemap = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
const robots = fs.readFileSync(path.join(ROOT, 'robots.txt'), 'utf8');

const listed = new Set(
  (sitemap.match(/<loc>([^<]+)<\/loc>/g) || [])
    .map(l => l.replace(/<\/?loc>/g, '').replace(/^https?:\/\/[^/]+\//, ''))
    .map(p => p || 'index.html')
);

const pages = fs.readdirSync(ROOT).filter(f => f.endsWith('.html'));

function isExcluded(file) {
  const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const noindex = /<meta[^>]*name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(html);
  const disallowed = new RegExp('^Disallow:\\s*/' + file.replace('.', '\\.'), 'm').test(robots);
  return noindex || disallowed;
}

test('every indexable page is in the sitemap', () => {
  const missing = pages.filter(f => !isExcluded(f) && !listed.has(f));
  assert.deepStrictEqual(missing, [],
    'indexable pages missing from sitemap.xml: ' + missing.join(', '));
});

test('no excluded page leaks into the sitemap', () => {
  const leaked = pages.filter(f => isExcluded(f) && listed.has(f));
  assert.deepStrictEqual(leaked, [],
    'noindex/disallowed pages listed in sitemap.xml: ' + leaked.join(', '));
});

test('every sitemap entry points at a page that exists', () => {
  const ghosts = [...listed].filter(p => !fs.existsSync(path.join(ROOT, p)));
  assert.deepStrictEqual(ghosts, [], 'sitemap lists missing files: ' + ghosts.join(', '));
});

test('the merged CinePlot page stays a tombstone, not an indexed route', () => {
  const html = fs.readFileSync(path.join(ROOT, 'cineplot.html'), 'utf8');
  assert.match(html, /rel=["']canonical["'][^>]*cineclue/, 'cineplot must canonical to cineclue');
  assert.ok(!listed.has('cineplot.html'), 'cineplot.html must not be in the sitemap');
});
