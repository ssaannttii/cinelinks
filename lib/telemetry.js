// Turns the first-party daily counters (tm:day:YYYY-MM-DD hashes, written by
// api/feedback.js handleTrack) into the numbers worth deciding on. Pure, so the
// admin API and the tests share one definition of "D1" and "finish rate".
//
// days: [{ date: 'YYYY-MM-DD', c: { field: count } }], any order.

function n(c, k) { return (c && +c[k]) || 0; }

function shiftDate(iso, delta) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

// Classic cohort retention. retained_dN fires on the exact Nth day after a
// player's first visit, so day X's retained_dN pairs with day X-N's new visits.
// Only pairs where BOTH days are inside the window count, or a short window
// would divide this week's returns by nobody.
function retention(byDate, lag) {
  let num = 0, den = 0;
  Object.keys(byDate).forEach((date) => {
    const cohort = byDate[shiftDate(date, -lag)];
    if (!cohort) return;
    num += n(byDate[date], 'retained_d' + lag);
    den += n(cohort, 'visit|new');
  });
  return { num, den, rate: den ? num / den : null };
}

function summarize(days) {
  const byDate = {};
  (days || []).forEach((d) => { if (d && d.date) byDate[d.date] = d.c || {}; });

  const totals = { visits: 0, newPlayers: 0, mobile: 0, desktop: 0, tablet: 0 };
  const modes = {};
  const events = {};
  Object.keys(byDate).forEach((date) => {
    const c = byDate[date];
    totals.visits += n(c, 'visit');
    totals.newPlayers += n(c, 'visit|new');
    totals.mobile += n(c, 'visit|mobile');
    totals.desktop += n(c, 'visit|desktop');
    totals.tablet += n(c, 'visit|tablet');
    Object.keys(c).forEach((field) => {
      const [name, dim] = field.split('|');
      if (!dim) { events[name] = (events[name] || 0) + n(c, field); return; }
      if ((name === 'game_view' || name === 'game_abandon') && dim !== 'new') {
        const m = modes[dim] || (modes[dim] = { mode: dim, views: 0, abandons: 0 });
        if (name === 'game_view') m.views += n(c, field); else m.abandons += n(c, field);
      }
    });
  });

  // game_abandon only fires when a view ends WITHOUT a *_complete, so whatever
  // didn't abandon finished. An approximation (a tab left open counts as neither),
  // but the same one for every mode, which is what a comparison needs.
  const modeList = Object.keys(modes).map((k) => {
    const m = modes[k];
    m.finishRate = m.views ? Math.max(0, m.views - m.abandons) / m.views : null;
    return m;
  }).sort((a, b) => b.views - a.views);

  const eventList = Object.keys(events).map((name) => ({ name, count: events[name] }))
    .sort((a, b) => b.count - a.count);

  return { totals, d1: retention(byDate, 1), d7: retention(byDate, 7), modes: modeList, events: eventList };
}

module.exports = { summarize, shiftDate };
