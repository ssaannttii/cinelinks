// Accessibility guards for the dialogs and the game's live region.
//
// Three dialogs in index.html (archive, creator, streak calendar) only toggled a
// CSS class: no focus trap, no focus restore, and Escape closed just one of them.
// Keyboard users could tab straight through them into the page behind. Separately,
// nothing in the file announced state changes, so a screen-reader player got no
// feedback at all after making a move.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const i18nSrc = fs.readFileSync(path.join(ROOT, 'i18n.js'), 'utf8');
const { LANGS, I18N } = new Function(i18nSrc + '; return { LANGS: LANGS, I18N: I18N };')();

const DIALOGS = ['archiveModal', 'creatorModal', 'streakModal'];

test('every dialog declares role and aria-modal', () => {
  for (const id of DIALOGS) {
    const tag = html.match(new RegExp('<div[^>]*id="' + id + '"[^>]*>'))
             || html.match(new RegExp('<div[^>]*id=\'' + id + '\'[^>]*>'));
    assert.ok(tag, 'no markup found for ' + id);
    assert.match(tag[0], /role="dialog"/, id + ' needs role="dialog"');
    assert.match(tag[0], /aria-modal="true"/, id + ' needs aria-modal="true"');
  }
});

test('every dialog traps focus on open', () => {
  // One fxTrapFocus call per dialog opener, plus the ones already in place.
  const calls = (html.match(/fxTrapFocus\(/g) || []).length;
  assert.ok(calls >= 4, 'expected a focus trap per dialog, found ' + calls + ' calls');
  // Anchor on each definition — call sites appear earlier in the file.
  for (const [fn, def] of [['openArchive', 'openArchive() {'], ['openStreakModal', 'function openStreakModal() {']]) {
    const at = html.indexOf(def);
    assert.ok(at > 0, 'could not locate the ' + fn + ' definition');
    assert.match(html.slice(at, at + 700), /fxTrapFocus/, fn + ' must trap focus');
  }
});

test('the live region exists and is polite', () => {
  const el = html.match(/<div[^>]*id="gameStatus"[^>]*>/);
  assert.ok(el, 'no #gameStatus live region');
  assert.match(el[0], /role="status"/);
  assert.match(el[0], /aria-live="polite"/);
  assert.match(el[0], /class="sr-only"/);
  // sr-only must hide visually WITHOUT display:none, which would hide it from
  // assistive tech as well and defeat the whole point.
  const rule = html.match(/\.sr-only\{[^}]*\}/);
  assert.ok(rule, 'no .sr-only rule');
  assert.ok(!/display:\s*none/.test(rule[0]), '.sr-only must not use display:none');
});

test('the game announces board changes, dead ends and wins', () => {
  assert.match(html, /_announce\(t\('a11yBoard'/, 'board changes must be announced');
  assert.match(html, /_announce\(t\('deadEndToast'/, 'dead ends must be announced');
  assert.match(html, /_announce\(t\('a11yWin'/, 'wins must be announced');
  // textContent, never innerHTML: node names reach this from shared URLs.
  const at = html.indexOf('_announce(msg)');
  assert.ok(at > 0, 'no _announce helper');
  const body = html.slice(at, at + 500);
  assert.ok(!/innerHTML/.test(body), '_announce must not use innerHTML');
});

test('announcement strings exist in every language', () => {
  for (const lang of Object.keys(LANGS)) {
    const d = I18N[lang];
    for (const k of ['a11yBoard', 'a11yGoalInSight', 'a11yWin']) {
      assert.ok(d[k], lang + ' is missing ' + k);
    }
    assert.match(String(d.a11yBoard('Dune', 12, 3)), /Dune/, lang + ': a11yBoard drops the node name');
    // Singular and plural must actually differ, or the count reads wrong aloud.
    assert.notStrictEqual(String(d.a11yWin(1)), String(d.a11yWin(4)), lang + ': a11yWin ignores plurals');
  }
});
