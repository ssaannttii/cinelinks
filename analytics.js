// Thin, dependency-free funnel instrumentation for the CineLinks suite. Loads
// Vercel Web Analytics and wraps custom events (window.va) so the rest of the code
// can call a single Track(name, props). Everything is wrapped so it can never
// throw, and it no-ops gracefully if analytics is blocked or disabled.
//
// Custom events show up in Vercel → Analytics. (Custom events may require the
// project's analytics plan to allow them; if not, these are harmless no-ops.)
(function () {
  'use strict';
  var TESTER_KEY = 'cl_internalTester';
  var TESTER_QUERY = 'cl_tester';
  var BETA_KEY = 'cl_beta';
  var BETA_QUERY = 'beta';

  function readTester() {
    try { return localStorage.getItem(TESTER_KEY) === '1'; } catch (_) { return false; }
  }

  function writeTester(on) {
    try { localStorage.setItem(TESTER_KEY, on ? '1' : '0'); } catch (_) { /* noop */ }
  }

  function readFlag(key) {
    try { return localStorage.getItem(key) === '1'; } catch (_) { return false; }
  }

  function writeFlag(key, on) {
    try { localStorage.setItem(key, on ? '1' : '0'); } catch (_) { /* noop */ }
  }

  function applyBooleanQuery(param, key, keepInUrl) {
    try {
      var url = new URL(window.location.href);
      var v = url.searchParams.get(param);
      if (v == null) return;
      var on = !/^(0|false|off|no)$/i.test(String(v));
      writeFlag(key, on);
      if (!keepInUrl) {
        url.searchParams.delete(param);
        window.history.replaceState(null, '', url.pathname + url.search + url.hash);
      }
    } catch (_) { /* noop */ }
  }

  function isTester() {
    return readTester();
  }

  applyBooleanQuery(TESTER_QUERY, TESTER_KEY, false);
  applyBooleanQuery(BETA_QUERY, BETA_KEY, true);

  window.CineInternal = window.CineInternal || {};
  window.CineInternal.isTester = isTester;
  window.CineInternal.setTester = function (on) { writeTester(!!on); };
  window.CineInternal.isBeta = function () { return readFlag(BETA_KEY); };
  window.CineInternal.setBeta = function (on) { writeFlag(BETA_KEY, !!on); };

  // ── Shared context ────────────────────────────────────────────────────────
  // Attached to EVERY event. Without these, the existing events could tell us
  // what happened but never for whom: a completion rate is not actionable until
  // you can split it by new-vs-returning, device and locale.
  var DAY_MS = 86400000;
  function dayNum(iso) {
    var t = Date.parse(String(iso) + 'T00:00:00Z');
    return isNaN(t) ? null : Math.floor(t / DAY_MS);
  }
  function get(k) { try { return localStorage.getItem(k); } catch (_) { return null; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (_) { /* noop */ } }

  var TODAY = new Date().toISOString().slice(0, 10);
  var firstVisit = get('cl_firstVisit') || TODAY;
  if (!get('cl_firstVisit')) set('cl_firstVisit', TODAY);
  var lastVisit = get('cl_lastVisit');
  // Days since this player's FIRST ever visit — the cohort axis. The old code
  // only knew "have you ever been here before", which cannot separate a player
  // returning on day 1 from one drifting back after a month.
  var dayIndex = (dayNum(TODAY) != null && dayNum(firstVisit) != null)
    ? dayNum(TODAY) - dayNum(firstVisit) : 0;
  var daysSinceLast = (lastVisit && dayNum(lastVisit) != null)
    ? dayNum(TODAY) - dayNum(lastVisit) : -1;
  var visitDays = parseInt(get('cl_visitDays'), 10) || 0;

  function deviceClass() {
    try {
      var sc = window.screen || {};
      var w = Math.min(sc.width || 0, sc.height || 0);
      if (!w) return 'unknown';
      return w < 600 ? 'mobile' : (w < 900 ? 'tablet' : 'desktop');
    } catch (_) { return 'unknown'; }
  }
  function locale() {
    try { return localStorage.getItem('clLang') || (navigator.language || 'unknown'); }
    catch (_) { return 'unknown'; }
  }

  // Reassigned by the impression/abandon block below, once it knows the mode.
  // Declared here so Track can call it unconditionally.
  var noteEvent = function () {};

  var CTX = null;
  function context() {
    if (!CTX) {
      CTX = {
        day_index: dayIndex,
        visit_days: visitDays,
        new_player: dayIndex === 0 ? 1 : 0,
        device: deviceClass(),
        locale: locale()
      };
    }
    return CTX;
  }

  function Track(name, props) {
    try {
      if (isTester()) return;
      var data = {}, c = context(), k;
      for (k in c) if (Object.prototype.hasOwnProperty.call(c, k)) data[k] = c[k];
      if (props) for (k in props) if (Object.prototype.hasOwnProperty.call(props, k)) data[k] = props[k];
      window.va('event', { name: String(name), data: data });
      noteEvent(String(name));
    } catch (_) { /* noop */ }
  }
  window.Track = Track;

  if (!isTester()) {
    // Vercel's queue shim — calls before the insights script loads are queued.
    window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };
    try {
      var s = document.createElement('script');
      s.defer = true;
      s.src = '/_vercel/insights/script.js';
      document.head.appendChild(s);
    } catch (_) { /* noop */ }
  } else {
    window.va = function () {};
  }

  // One "visit" event per UTC day. Stored locally; no backend needed.
  try {
    if (lastVisit !== TODAY) {
      visitDays += 1;
      set('cl_lastVisit', TODAY);
      set('cl_visitDays', String(visitDays));
      CTX = null; // visitDays just changed
      Track('visit', {
        returning: lastVisit ? 1 : 0,
        days_since_last: daysSinceLast,
        path: location.pathname,
        beta: window.CineInternal.isBeta() ? 1 : 0
      });
      // Classic cohort retention. `returning` alone answered "ever came back?",
      // which is not D1/D7 — these fire only on the exact cohort day, so the
      // rate is (players emitting retained_dN) / (players in that cohort).
      if (dayIndex === 1) Track('retained_d1', {});
      if (dayIndex === 7) Track('retained_d7', {});
      if (dayIndex === 30) Track('retained_d30', {});
      if (window.CineInternal.isBeta()) Track('beta_visit', { path: location.pathname, returning: lastVisit ? 1 : 0 });
    }
  } catch (_) { /* noop */ }

  // ── Per-mode impression / abandon ─────────────────────────────────────────
  // Nine of the ten modes only ever emitted "<mode>_complete". With no
  // denominator you cannot tell a mode people bounce off from one nobody opens,
  // which is exactly the decision this data is supposed to inform. Deriving the
  // mode from the path instruments all of them without touching ten files.
  try {
    var completed = false;
    var openedAt = Date.now();
    var file = (location.pathname.split('/').pop() || 'index.html').replace(/\.html$/, '');
    var MODE = file === '' || file === 'index' ? 'cinelinks' : (/^cine/.test(file) ? file : null);

    // Any *_complete (cl_complete, cineclue_complete, …) closes the loop.
    noteEvent = function (name) {
      if (/_complete$/.test(name)) completed = true;
    };

    if (MODE) {
      Track('game_view', { mode: MODE });
      var reported = false;
      var finish = function () {
        if (reported || completed) return;
        reported = true;
        Track('game_abandon', { mode: MODE, secs: Math.round((Date.now() - openedAt) / 1000) });
      };
      // visibilitychange fires reliably on mobile, where pagehide often doesn't.
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'hidden') finish();
      });
      window.addEventListener('pagehide', finish);
    }
  } catch (_) { /* noop */ }

  document.addEventListener('click', function (e) {
    try {
      var el = e.target && e.target.closest && e.target.closest('button,a');
      if (!el) return;
      var txt = (el.textContent || '').toLowerCase();
      var id = String(el.id || '').toLowerCase();
      var cls = String(el.className || '').toLowerCase();
      if (id.indexOf('share') >= 0 || cls.indexOf('share') >= 0 || txt.indexOf('share') >= 0) {
        Track('share_click', { path: location.pathname, id: el.id || '', href: el.getAttribute('href') || '' });
      }
    } catch (_) { /* noop */ }
  }, true);
})();
