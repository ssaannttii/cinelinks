// Thin, dependency-free funnel instrumentation for the CineLinks suite. Wraps
// Vercel Web Analytics custom events (window.va) so the rest of the code can call
// a single Track(name, props). Everything is wrapped so it can never throw, and
// it no-ops gracefully if analytics isn't loaded (e.g. local/dev or ad-blocked).
//
// Custom events show up in Vercel → Analytics. (Custom events may require the
// project's analytics plan to allow them; if not, these are harmless no-ops.)
(function () {
  'use strict';
  // Vercel's queue shim — calls before the insights script loads are queued.
  window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };

  function Track(name, props) {
    try { window.va('event', { name: String(name), data: props || {} }); } catch (_) { /* noop */ }
  }
  window.Track = Track;

  // One "visit" event per UTC day, tagged new-vs-returning, so retention is
  // measurable without any backend. Stored locally; purely additive.
  try {
    var KEY = 'cl_lastVisit';
    var today = new Date().toISOString().slice(0, 10);
    var last = null; try { last = localStorage.getItem(KEY); } catch (_) {}
    if (last !== today) {
      try { localStorage.setItem(KEY, today); } catch (_) {}
      Track('visit', { returning: last ? 1 : 0 });
    }
  } catch (_) { /* noop */ }
})();
