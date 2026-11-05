// end-screen.js draws the same final panel on all nine game pages. Its pure parts
// decide two things worth pinning down: how a game's emoji run becomes drawn
// squares, and what the gold button offers next (next trio game, bonus pack,
// practice), which is what keeps a session going after a daily.
const { test } = require('node:test');
const assert = require('node:assert');
const ES = require('../end-screen.js');

// a trio stub: slots and their done flags, in the shape lib/trio.js returns
function trio(slots, done) {
  return {
    MODES: { cl: { n: 'CineLinks', h: '/?daily=1' }, line: { n: 'CineLine', h: '/cineline.html' }, grid: { n: 'CineGrid', h: '/cinegrid.html' }, clue: { n: 'CineClue', h: '/cineclue.html' } },
    progress: () => ({ slots: slots, done: done.slice(), count: done.filter(Boolean).length, next: done.indexOf(false) }),
    slotOf: (mode, s) => { let i = s.indexOf(mode); if (i < 0 && ['clue', 'frame', 'cast'].includes(mode)) i = s.indexOf('guess'); return i; },
    slotMode: (k) => (k === 'guess' ? 'clue' : k)
  };
}

test('emoji runs become rows of squares, anything else is ignored', () => {
  assert.deepStrictEqual(ES.rows('🟩🟨🟥\n⬛🟦🟪'), [['g', 'y', 'r'], ['k', 'b', 'p']]);
  assert.deepStrictEqual(ES.rows('CineGroup #12 ✗\n🟩🟩'), [['g', 'g']]);
  assert.deepStrictEqual(ES.rows(''), []);
  assert.deepStrictEqual(ES.rows(null), []);
});

test('headlines lose their trailing emoji', () => {
  assert.strictEqual(ES.plain('Solved it! 🎬'), 'Solved it!');
  assert.strictEqual(ES.plain(': masterful 🔥'), ': masterful');
  assert.strictEqual(ES.plain('Perfect grid! 🎯'), 'Perfect grid!');
});

test('practice offers another round and a way to the daily', () => {
  const p = ES.plan({ mode: 'line', practice: true, again: { label: 'New deck', href: 'cineline.html?practice=1&n=1' } }, trio(['cl', 'line', 'grid'], [false, false, false]), { path: '/cineline.html' });
  assert.strictEqual(p.trio, null);
  assert.strictEqual(p.go.label, 'New deck');
  assert.strictEqual(p.go.to, 'again');
  assert.strictEqual(p.more.href, '/cineline.html');
});

test('a finished daily counts itself done and points at the next open trio game', () => {
  // the game's state may be saved a tick after the screen is drawn: done[1] is still false
  const p = ES.plan({ mode: 'line' }, trio(['cl', 'line', 'grid'], [true, false, false]), { path: '/cineline.html' });
  assert.deepStrictEqual(p.trio.done, [true, true, false]);
  assert.strictEqual(p.trio.count, 2);
  assert.strictEqual(p.go.href, '/cinegrid.html');
  assert.strictEqual(p.go.to, 'grid');
  assert.strictEqual(p.more.href, '/cineline.html?practice=1');
});

test('a guess game fills the guess slot', () => {
  const p = ES.plan({ mode: 'cast' }, trio(['cl', 'guess', 'grid'], [true, false, true]), { path: '/cinecast.html' });
  assert.deepStrictEqual(p.trio.done, [true, true, true]);
});

test('a game outside today\'s trio still points at the trio', () => {
  const p = ES.plan({ mode: 'reel' }, trio(['cl', 'line', 'grid'], [false, true, true]), { path: '/cinereel.html' });
  assert.strictEqual(p.trio.mine, -1);
  assert.strictEqual(p.trio.count, 2);
  assert.strictEqual(p.go.href, '/?daily=1');
});

test('a complete trio sends the player home for the bonus pack until it is paid', () => {
  const t = trio(['cl', 'line', 'grid'], [true, false, true]);
  const unpaid = ES.plan({ mode: 'line' }, t, { path: '/cineline.html', paid: false });
  assert.strictEqual(unpaid.go.href, '/');
  assert.strictEqual(unpaid.go.to, 'home');
  const paid = ES.plan({ mode: 'line' }, t, { path: '/cineline.html', paid: true });
  assert.strictEqual(paid.go.to, 'practice');
  assert.strictEqual(paid.go.href, '/cineline.html?practice=1');
  assert.strictEqual(paid.more, null);
});

test('without the trio the screen still offers practice', () => {
  const p = ES.plan({ mode: 'line' }, null, { path: '/cineline.html' });
  assert.strictEqual(p.trio, null);
  assert.strictEqual(p.go.to, 'practice');
});
