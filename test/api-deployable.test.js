// Every module an API handler requires must actually ship.
//
// This exists because of a real outage. .gitignore carried a blanket `_*.js`
// rule, so when api/_cors.js was created, `git add -A` skipped it silently. The
// commit succeeded, the whole local suite passed — the file was right there on
// disk — and production returned FUNCTION_INVOCATION_FAILED on every handler
// that required it: /api/tmdb, /api/daily, /api/score and /api/img all 500'd.
// The visible symptom was cards being won with no poster, three layers away from
// the cause.
//
// Existing-on-disk is therefore NOT the property worth testing. Being tracked by
// git is, because that is what Vercel deploys.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const API = path.join(ROOT, 'api');

const tracked = new Set(
  execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' })
    .split('\n').filter(Boolean)
);

const handlers = fs.readdirSync(API).filter(f => f.endsWith('.js'));

test('every local module required by an api handler is tracked by git', () => {
  const missing = [];
  for (const file of handlers) {
    const src = fs.readFileSync(path.join(API, file), 'utf8');
    for (const m of src.matchAll(/require\(['"](\.[^'"]+)['"]\)/g)) {
      let rel = m[1];
      if (!/\.js$/.test(rel)) rel += '.js';
      const resolved = path.posix.join('api', rel).replace(/^api\/\.\//, 'api/');
      if (!tracked.has(resolved)) missing.push(file + ' requires ' + m[1] + ' -> ' + resolved);
    }
  }
  assert.deepStrictEqual(missing, [],
    'untracked module(s) — these exist locally but will NOT deploy:\n  ' + missing.join('\n  '));
});

test('every module required by an api handler exists on disk', () => {
  const broken = [];
  for (const file of handlers) {
    const src = fs.readFileSync(path.join(API, file), 'utf8');
    for (const m of src.matchAll(/require\(['"](\.[^'"]+)['"]\)/g)) {
      let rel = m[1];
      if (!/\.js$/.test(rel)) rel += '.js';
      if (!fs.existsSync(path.join(API, rel))) broken.push(file + ' -> ' + m[1]);
    }
  }
  assert.deepStrictEqual(broken, [], 'missing module(s): ' + broken.join(', '));
});

test('every api handler can actually be loaded', () => {
  // Catches MODULE_NOT_FOUND and top-level throws the same way Vercel would on
  // a cold start, instead of finding out from a 500 in production.
  for (const file of handlers) {
    assert.doesNotThrow(() => require(path.join(API, file)), file + ' throws on require');
  }
});

test('the underscore-helper convention is intact', () => {
  // Underscore-prefixed files are helpers, not routes; Vercel counts only the
  // rest against the Hobby 12-function cap.
  const routes = handlers.filter(f => !f.startsWith('_'));
  assert.ok(routes.length <= 12,
    'Vercel Hobby allows 12 serverless functions, found ' + routes.length + ': ' + routes.join(', '));
});
