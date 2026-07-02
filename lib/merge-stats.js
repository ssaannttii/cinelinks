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

  // Card-collection blob (cl_collection). Union every owned card and keep the BEST
  // copy of each (most copies, highest rarity, earliest collected, any shine), then
  // re-derive XP from the union so two devices that collected different cards end up
  // with BOTH sets and the combined progress — a card or a level is never lost.
  var CARD_XP = { common: 10, rare: 25, elite: 50, legendary: 100 }, DUPE_XP = 5; // must match XP in collection.js
  var CARD_TIER = { common: 0, rare: 1, elite: 2, legendary: 3 };
  function mergeCard(x, y) {
    if (!x) return y;
    if (!y) return x;
    var no = Math.min(x.no || Infinity, y.no || Infinity);
    if (!isFinite(no)) no = x.no || y.no || 0;
    var first = (x.first && y.first) ? (x.first < y.first ? x.first : y.first) : (x.first || y.first || '');
    var out = {
      id: x.id != null ? x.id : y.id,
      type: x.type || y.type,
      name: x.name || y.name || '',
      img: x.img || y.img || '',
      rarity: (CARD_TIER[y.rarity] > CARD_TIER[x.rarity]) ? y.rarity : x.rarity,
      n: Math.max(x.n | 0 || 1, y.n | 0 || 1),
      first: first,
      no: no,
      isNew: (x.isNew || y.isNew) ? 1 : 0,
      shine: (x.shine || y.shine) ? 1 : 0
    };
    // card.imgc (canonical-poster flag) is deliberately NOT merged: after a sync each
    // device re-verifies once, so a localised poster can never masquerade as canonical.
    // Union the per-language title cache (i18n) so a device that fetched a localised
    // title doesn't lose it when reconciling with one that hasn't.
    var im = Object.assign({}, x.i18n, y.i18n);
    if (Object.keys(im).length) out.i18n = im;
    return out;
  }
  // Union of two {id: 'YYYY-MM-DD'} maps keeping the EARLIEST date per key (ISO dates
  // compare lexically). Used for claimed sets and unlocked achievements so neither
  // device's history is lost on sync.
  function unionEarliest(a, b) {
    var out = {}, k;
    a = a || {}; b = b || {};
    for (k in a) if (Object.prototype.hasOwnProperty.call(a, k)) out[k] = a[k];
    for (k in b) {
      if (!Object.prototype.hasOwnProperty.call(b, k)) continue;
      if (out[k] == null || b[k] < out[k]) out[k] = b[k];
    }
    return out;
  }
  // Latest of two ISO dates (pity clocks: the most recent elite/legendary anywhere
  // restarts the countdown, so the later date wins).
  function laterDate(x, y) { if (!x) return y || null; if (!y) return x; return x > y ? x : y; }
  function mergeCollection(a, b) {
    if (!a || typeof a !== 'object') return b || null;
    if (!b || typeof b !== 'object') return a || null;
    var ac = a.cards || {}, bc = b.cards || {}, cards = {}, keys = {}, k;
    for (k in ac) if (Object.prototype.hasOwnProperty.call(ac, k)) keys[k] = 1;
    for (k in bc) if (Object.prototype.hasOwnProperty.call(bc, k)) keys[k] = 1;
    var maxNo = 0, xp = 0;
    for (k in keys) {
      if (!Object.prototype.hasOwnProperty.call(keys, k)) continue;
      var c = mergeCard(ac[k], bc[k]);
      cards[k] = c;
      if ((c.no | 0) > maxNo) maxNo = c.no | 0;
      xp += (CARD_XP[c.rarity] || 10) + Math.max(0, (c.n | 0) - 1) * DUPE_XP;
    }
    var out = {
      v: Math.max(a.v | 0, b.v | 0) || 1,
      cards: cards,
      xp: Math.max(xp, a.xp | 0, b.xp | 0),           // never below either device's stored XP
      seen: Math.max(a.seen | 0, b.seen | 0),
      dust: Math.max(a.dust | 0, b.dust | 0),
      seq: Math.max(a.seq | 0, b.seq | 0, maxNo),
      mv: Math.max(a.mv | 0, b.mv | 0)
    };
    // Progress records beyond the cards themselves (previously dropped here — a sync
    // used to silently wipe claimed sets, achievement dates and the pity clocks).
    var sd = unionEarliest(a.setsDone, b.setsDone);
    if (Object.keys(sd).length) out.setsDone = sd;
    var ach = unionEarliest(a.achievements, b.achievements);
    if (Object.keys(ach).length) out.achievements = ach;
    var pe = laterDate(a.pityE, b.pityE); if (pe) out.pityE = pe;
    var pl = laterDate(a.pityL, b.pityL); if (pl) out.pityL = pl;
    return out;
  }

  var STREAK_KEYS = ['clStreak', 'cineclueStreak', 'cineframeStreak', 'cinecastStreak', 'cineplotStreak', 'cinelineStreak'];
  var STATE_KEYS = ['cineclueState', 'cineframeState', 'cinecastState', 'cineplotState', 'cinelineState'];

  function merge(a, b) {
    a = a || {}; b = b || {};
    var out = {};
    STREAK_KEYS.forEach(function (k) { out[k] = mergeStreak(a[k], b[k]); });
    out.clPlayed = mergePlayed(a.clPlayed, b.clPlayed);
    STATE_KEYS.forEach(function (k) { out[k] = mergeDayState(a[k], b[k]); });
    out.cl_collection = mergeCollection(a.cl_collection, b.cl_collection);
    return out;
  }

  // Keys that participate in sync (everything else in localStorage stays local).
  var SYNC_KEYS = STREAK_KEYS.concat(STATE_KEYS, ['clPlayed', 'cl_collection']);

  return { merge: merge, mergeStreak: mergeStreak, mergePlayed: mergePlayed, mergeDayState: mergeDayState, mergeCollection: mergeCollection, SYNC_KEYS: SYNC_KEYS };
}));
