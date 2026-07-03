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

  function readTester() {
    try { return localStorage.getItem(TESTER_KEY) === '1'; } catch (_) { return false; }
  }

  function writeTester(on) {
    try { localStorage.setItem(TESTER_KEY, on ? '1' : '0'); } catch (_) { /* noop */ }
  }

  function applyTesterQuery() {
    try {
      var url = new URL(window.location.href);
      var v = url.searchParams.get(TESTER_QUERY);
      if (v == null) return;
      var on = !/^(0|false|off|no)$/i.test(String(v));
      writeTester(on);
      url.searchParams.delete(TESTER_QUERY);
      window.history.replaceState(null, '', url.pathname + url.search + url.hash);
    } catch (_) { /* noop */ }
  }

  function isTester() {
    return readTester();
  }

  applyTesterQuery();

  window.CineInternal = window.CineInternal || {};
  window.CineInternal.isTester = isTester;
  window.CineInternal.setTester = function (on) { writeTester(!!on); };

  function Track(name, props) {
    try {
      if (isTester()) return;
      window.va('event', { name: String(name), data: props || {} });
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

  // One "visit" event per UTC day, tagged new-vs-returning, so retention is
  // measurable without any backend. Stored locally; purely additive.
  try {
    var KEY = 'cl_lastVisit';
    var today = new Date().toISOString().slice(0, 10);
    var last = null; try { last = localStorage.getItem(KEY); } catch (_) {}
    if (last !== today) {
      try { localStorage.setItem(KEY, today); } catch (_) {}
      Track('visit', { returning: last ? 1 : 0, path: location.pathname });
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
