// Guard against re-introducing DOM-XSS through shared challenge links.
//
// Node names arrive from the URL (?sn= / ?en= / ?cn= in gameParamsFromUrl), so a
// crafted link can put arbitrary text into a node's `name`. normalizeNode does not
// escape it. That text used to be interpolated straight into an innerHTML toast:
//
//   this._showToast(`Dead end - ... <strong>${nodeName}</strong> ...`)
//
// which let a shared link inject markup into the player's page. The fix builds the
// toast from real text nodes (_showToastNamed), so the name can never be parsed as
// HTML. These tests fail if anyone wires an untrusted name back into HTML.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

test('no template literal interpolates a node name into HTML', () => {
  // Any `${...name...}` sitting next to an HTML tag inside a template literal.
  const bad = html.match(/`[^`]*<[a-z][^`]*\$\{[^}]*\b(nodeName|node\.name|item\.name|\.name)\b[^}]*\}[^`]*`/g) || [];
  assert.deepStrictEqual(bad, [], 'node name interpolated into an HTML string:\n' + bad.join('\n'));
});

test('the dead-end toast goes through the text-node path', () => {
  assert.ok(
    html.includes("_showToastNamed('deadEndToast'"),
    'dead-end toast should call _showToastNamed, which renders the name as a text node'
  );
  assert.ok(
    /_showToastNamed\([\s\S]{0,900}?textContent\s*=/.test(html),
    '_showToastNamed must assign the name via textContent, never innerHTML'
  );
});

test('connection cards are real buttons, not click-handling divs', () => {
  // The core game action must be reachable by keyboard and announced as an action.
  // Anchor on the definition, not the call sites that appear earlier in the file.
  const at = html.indexOf('_makeCard(item) {');
  assert.ok(at > 0, 'could not locate the _makeCard definition');
  const makeCard = html.slice(at, at + 2600);
  assert.ok(
    /createElement\('button'\)/.test(makeCard),
    'connection cards must be <button> elements (keyboard + screen reader access)'
  );
  assert.ok(
    /setAttribute\('aria-label'/.test(makeCard),
    'connection cards must carry an accessible name'
  );
});
