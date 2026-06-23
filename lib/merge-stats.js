// Merge two CineLinks stats blobs into one. Used by the optional Google-login
// sync layer: the same logic runs in the browser (combine local + remote before
// rendering) and on the server (combine remote + pushed before storing), so two
// devices reconcile to the same result. Field-by-field & schema-tolerant: unknown
// keys are ignored, missing keys are fine, so adding new games later won't break
// already-synced data.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MergeStats = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // Streaks: keep the best of both. current = max current; best = max of every
  // current/best seen (a higher live streak on either device wins).
  function mergeStreak(a, b) {
    a = a || {}; b = b || {};
    var cur = Math.max(a.current | 0, b.current | 0);
    return { current: cur, best: Math.max(a.best | 0, b.best | 0, cur) };
  }

  // Played map (date -> fewest clicks): union, keeping the lower (better) score.
  function mergePlayed(a, b) {
    var out = {}, k;
    a = a || {}; b = b || {};
    for (k in a) if (Object.prototype.hasOwnProperty.call(a, k)) out[k] = a[k];
    for (k in b) {
      if (!Object.prototype.hasOwnProperty.call(b, k)) continue;
      if (out[k] == null || b[k] < out[k]) out[k] = b[k];
    }
    return out;
  }

  // Daily state (CineClue/CineFrame): keep the newer day; on the same day keep
  // the more complete outcome (solved > finished > in-progress).
  function mergeDayState(a, b) {
    if (!a) return b || null;
    if (!b) return a || null;
    if ((b.day | 0) > (a.day | 0)) return b;
    if ((a.day | 0) > (b.day | 0)) return a;
    var rank = function (s) { return (s && s.solved ? 2 : 0) + (s && s.finished ? 1 : 0); };
    return rank(b) > rank(a) ? b : a;
  }

  var STREAK_KEYS = ['clStreak', 'cineclueStreak', 'cineframeStreak'];
  var STATE_KEYS = ['cineclueState', 'cineframeState'];

  function merge(a, b) {
    a = a || {}; b = b || {};
    var out = {};
    STREAK_KEYS.forEach(function (k) { out[k] = mergeStreak(a[k], b[k]); });
    out.clPlayed = mergePlayed(a.clPlayed, b.clPlayed);
    STATE_KEYS.forEach(function (k) { out[k] = mergeDayState(a[k], b[k]); });
    return out;
  }

  // Keys that participate in sync (everything else in localStorage stays local).
  var SYNC_KEYS = STREAK_KEYS.concat(STATE_KEYS, ['clPlayed']);

  return { merge: merge, mergeStreak: mergeStreak, mergePlayed: mergePlayed, mergeDayState: mergeDayState, SYNC_KEYS: SYNC_KEYS };
}));
