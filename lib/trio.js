// Today's trio, shared by the home and every game page.
//
// "Day complete" = CineLinks + two games picked by the UTC day. The home used to
// be the only page that knew the trio, so after a win on CineCode nothing could
// say "next: CineChain"; now any page can. Same for every player on a given UTC
// day; the guess family (Clue/Frame/Cast) enters as ONE slot.
//
// Reads the games' own saved state from localStorage (never writes it). Done
// rules match index.html metaItems(), which still drives the streak.
(function (root) {
  'use strict';
  var POOL = ['line', 'reel', 'code', 'grid', 'chain', 'grp', 'guess'];
  var GUESS = ['clue', 'frame', 'cast'];
  var MODES = {
    cl: { n: 'CineLinks', h: '/?daily=1', p: '/?practice=1' },
    line: { n: 'CineLine', h: '/cineline.html' },
    grp: { n: 'CineGroup', h: '/cinegroup.html' },
    chain: { n: 'CineChain', h: '/cinechain.html' },
    code: { n: 'CineCode', h: '/cinecode.html' },
    grid: { n: 'CineGrid', h: '/cinegrid.html' },
    reel: { n: 'CineReel', h: '/cinereel.html' },
    clue: { n: 'CineClue', h: '/cineclue.html' },
    frame: { n: 'CineFrame', h: '/cineframe.html' },
    cast: { n: 'CineCast', h: '/cinecast.html' }
  };
  var STATE_KEY = {
    clue: 'cineclueState', frame: 'cineframeState', cast: 'cinecastState', line: 'cinelineState',
    reel: 'cinereelState', code: 'cinecodeState', grid: 'cinegridState', chain: 'cinechainState', grp: 'cinegroupState'
  };

  function udNow() { var n = new Date(); return Math.floor(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()) / 86400000); }
  function today(ud) {
    if (ud == null) ud = udNow();
    var n = POOL.length, i = ud % n, j = (i + 1 + Math.floor(ud / n) % (n - 1)) % n;   // two distinct, pairing drifts week to week
    return ['cl', POOL[i], POOL[j]];
  }
  function guessKey(ud) { return GUESS[(ud == null ? udNow() : ud) % 3]; }
  function slotMode(k, ud) { return k === 'guess' ? guessKey(ud) : k; }

  // CineLinks keys its daily by the Madrid date (index.html DAILY_TIME_ZONE)
  function dailyKey() {
    try {
      var p = {};
      new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' })
        .formatToParts(new Date()).forEach(function (x) { p[x.type] = x.value; });
      return p.year + '-' + p.month + '-' + p.day;
    } catch (_) { return new Date().toISOString().slice(0, 10); }
  }
  function ls(k) { try { return JSON.parse(root.localStorage.getItem(k)); } catch (_) { return null; } }

  // { done, s } for one mode today; s = the game's saved state (or { clicks } for CineLinks)
  function result(mode) {
    if (mode === 'cl') {
      var key = dailyKey(), played = ls('clPlayed') || {}, c = null;
      if (played[key] != null) c = played[key];
      else { var r = ls('clDailyResult'); if (r && r.date === key) c = r.clicks; }
      return { done: c != null, s: { clicks: c } };
    }
    var sk = STATE_KEY[mode]; if (!sk) return { done: false, s: null };
    var s = ls(sk), ud = udNow();
    return { done: !!(s && s.day === ud && s.finished), s: s };
  }
  function slotDone(k) {
    if (k === 'guess') return GUESS.some(function (g) { return result(g).done; });
    return result(k).done;
  }
  // The slot's mode as played: a guess slot counts whichever guess game was finished.
  function slotPlayed(k, ud) {
    if (k !== 'guess') return k;
    var hit = GUESS.filter(function (g) { return result(g).done; })[0];
    return hit || guessKey(ud);
  }
  // The trio's slot this page fills, or -1 (a guess page fills the guess slot).
  function slotOf(mode, slots) {
    slots = slots || today();
    var i = slots.indexOf(mode);
    if (i < 0 && GUESS.indexOf(mode) >= 0) i = slots.indexOf('guess');
    return i;
  }
  function progress(ud) {
    var slots = today(ud), done = slots.map(slotDone);
    var next = done.indexOf(false);
    return {
      slots: slots, done: done, count: done.filter(Boolean).length, next: next,
      modes: slots.map(function (k) { return slotPlayed(k, ud); })
    };
  }

  var api = { POOL: POOL, GUESS: GUESS, MODES: MODES, udNow: udNow, today: today, guessKey: guessKey, slotMode: slotMode, dailyKey: dailyKey, result: result, slotDone: slotDone, slotPlayed: slotPlayed, slotOf: slotOf, progress: progress };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Trio = api;
})(typeof window !== 'undefined' ? window : globalThis);
