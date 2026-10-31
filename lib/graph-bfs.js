// Bidirectional BFS shortest path on an implicit, unweighted, undirected graph.
//
// Why bidirectional: the CineLinks graph branches by ~40-50 per node, so a plain
// BFS to depth d touches ~b^d nodes (and one TMDB request each). Searching from
// both ends and meeting in the middle touches ~2·b^(d/2) — for b=45, d=4 that's
// ~4k vs ~4M. This is the difference between a feasible offline precompute and not.
//
// `neighbors(key)` returns an array of neighbor keys (strings) or objects with a
// `.key`; it may be async. Nodes are identified by string keys (e.g. "movie:155").
// Returns the shortest distance (number of hops) or null if unreachable within
// `maxDepth`. By default the graph is treated as undirected, so the same
// neighbors() is used for both search directions.
//
// opts.predecessors(key): for a DIRECTED graph, the nodes that have an edge INTO
// key. The backward search then only walks edges that exist forward, so any path
// found can actually be played start→end. (CineLinks boards are truncated top-N
// lists, so "A's board shows B" does not imply "B's board shows A".)
(function (root) {
  'use strict';

  function keyOf(n) { return typeof n === 'string' ? n : (n && n.key); }

  async function shortestPath(startKey, endKey, neighbors, opts) {
    opts = opts || {};
    const maxDepth = opts.maxDepth || 6;
    if (startKey === endKey) return 0;

    // dist maps: key -> distance from that side's origin.
    const fwd = new Map([[startKey, 0]]);
    const bwd = new Map([[endKey, 0]]);
    let fwdFrontier = [startKey];
    let bwdFrontier = [endKey];
    let fwdDepth = 0;
    let bwdDepth = 0;

    while (fwdFrontier.length && bwdFrontier.length) {
      // Always expand the smaller frontier — keeps the work balanced and minimal.
      const expandFwd = fwdFrontier.length <= bwdFrontier.length;
      if (expandFwd ? (fwdDepth + bwdDepth + 1 > maxDepth) : (fwdDepth + bwdDepth + 1 > maxDepth)) {
        return null;
      }

      const frontier = expandFwd ? fwdFrontier : bwdFrontier;
      const thisSide = expandFwd ? fwd : bwd;
      const otherSide = expandFwd ? bwd : fwd;
      const nextDepth = (expandFwd ? fwdDepth : bwdDepth) + 1;
      const next = [];
      let best = null;

      const expand = expandFwd ? neighbors : (opts.predecessors || neighbors);
      for (const nk of frontier) {
        let ns;
        try { ns = await expand(nk); } catch { ns = []; }
        for (const m of ns || []) {
          const mk = keyOf(m);
          if (mk == null) continue;
          if (otherSide.has(mk)) {
            // Frontiers meet: total path = this new depth + other side's depth.
            const total = nextDepth + otherSide.get(mk);
            if (best == null || total < best) best = total;
          }
          if (!thisSide.has(mk)) { thisSide.set(mk, nextDepth); next.push(mk); }
        }
      }

      if (best != null) return best;

      if (expandFwd) { fwdFrontier = next; fwdDepth = nextDepth; }
      else { bwdFrontier = next; bwdDepth = nextDepth; }
    }

    return null;
  }

  // Run fn over items with at most `limit` in flight; results keep input order so
  // the search stays deterministic however the requests interleave.
  async function mapLimit(items, limit, fn) {
    const out = new Array(items.length);
    let next = 0;
    async function worker() {
      while (next < items.length) {
        const j = next++;
        try { out[j] = await fn(items[j]); } catch { out[j] = []; }
      }
    }
    const n = Math.max(1, Math.min(limit, items.length));
    await Promise.all(Array.from({ length: n }, worker));
    return out;
  }

  // Same search but also reconstructs one shortest path. Returns
  // { dist, path } where path is an array of keys from start to end (inclusive),
  // or { dist: null, path: null } if unreachable within maxDepth.
  //
  // opts.directed: neighbors() are one-way edges and the backward search checks
  // them lazily. Walking back from x it takes every c in opts.candidates(x) — a
  // superset of the nodes whose edges point at x — and only confirms c -> x (one
  // neighbors(c) call) when c is about to be expanded or is a meeting point,
  // instead of fetching every candidate's board one layer early: ~b^d rather
  // than ~b^(d+1) requests on the backward side. With true superset candidates
  // the result is exact; without opts.candidates it falls back to neighbors(x),
  // i.e. mutual edges only, which can only make the distance longer.
  // opts.concurrency: how many neighbors() calls run at once (default 1).
  async function shortestPathTrace(startKey, endKey, neighbors, opts) {
    opts = opts || {};
    const maxDepth = opts.maxDepth || 6;
    const limit = opts.concurrency || 1;
    const mutual = !!opts.directed && !opts.predecessors;
    if (startKey === endKey) return { dist: 0, path: [startKey] };

    const fwd = new Map([[startKey, 0]]);
    const bwd = new Map([[endKey, 0]]);
    const fwdParent = new Map([[startKey, null]]);
    const bwdParent = new Map([[endKey, null]]);
    // directed mode: backward node -> the candidate parents its board must show.
    const pending = new Map();
    const checks = new Map();
    let fwdFrontier = [startKey];
    let bwdFrontier = [endKey];
    let fwdDepth = 0;
    let bwdDepth = 0;

    async function out(k) {
      let ns;
      try { ns = await neighbors(k); } catch { ns = []; }
      return (ns || []).map(keyOf).filter((x) => x != null);
    }

    // Is backward node c really on the board-graph? Keeps the first candidate
    // parent (in discovery order) that c's own board lists; drops c otherwise.
    function confirm(c) {
      if (!pending.has(c)) return Promise.resolve(bwd.has(c));
      if (!checks.has(c)) {
        checks.set(c, out(c).then((ns) => {
          const p = pending.get(c).find((x) => ns.indexOf(x) !== -1);
          pending.delete(c);
          checks.delete(c);
          if (p !== undefined) { bwdParent.set(c, p); return true; }
          bwd.delete(c); bwdParent.delete(c);
          return false;
        }));
      }
      return checks.get(c);
    }

    // Path through the edge a -> b, a on the forward side and b on the backward.
    function build(a, b) {
      const left = [];
      for (let c = a; c != null; c = fwdParent.get(c)) left.push(c);
      left.reverse();
      for (let c = b; c != null; c = bwdParent.get(c)) left.push(c);
      return left;
    }

    while (fwdFrontier.length && bwdFrontier.length) {
      const expandFwd = fwdFrontier.length <= bwdFrontier.length;
      if (fwdDepth + bwdDepth + 1 > maxDepth) return { dist: null, path: null };

      const thisSide = expandFwd ? fwd : bwd;
      const otherSide = expandFwd ? bwd : fwd;
      const thisParent = expandFwd ? fwdParent : bwdParent;
      const nextDepth = (expandFwd ? fwdDepth : bwdDepth) + 1;
      let frontier = expandFwd ? fwdFrontier : bwdFrontier;
      if (!expandFwd && mutual) {
        const ok = await mapLimit(frontier, limit, confirm);
        frontier = frontier.filter((_, i) => ok[i] === true);
      }

      const back = mutual ? (opts.candidates || out) : (opts.predecessors || out);
      const expand = expandFwd ? out : back;
      const lists = await mapLimit(frontier, limit, async (k) => (await expand(k) || []).map(keyOf).filter((x) => x != null));
      const next = [];
      const meets = [];

      frontier.forEach((nk, i) => {
        for (const mk of lists[i]) {
          if (otherSide.has(mk)) {
            meets.push(expandFwd
              ? { a: nk, b: mk, total: nextDepth + otherSide.get(mk) }
              : { a: mk, b: nk, total: nextDepth + otherSide.get(mk) });
          }
          if (!thisSide.has(mk)) {
            thisSide.set(mk, nextDepth); thisParent.set(mk, nk); next.push(mk);
            if (!expandFwd && mutual) pending.set(mk, [nk]);
          } else if (!expandFwd && pending.has(mk) && thisSide.get(mk) === nextDepth) {
            pending.get(mk).push(nk);
          }
        }
      });

      // A forward hop is always real; a backward hop needs its edge checked.
      meets.sort((x, y) => x.total - y.total);
      for (const m of meets) {
        const ok = expandFwd ? await confirm(m.b)
          : !mutual || (await out(m.a)).indexOf(m.b) !== -1;
        if (ok) return { dist: m.total, path: build(m.a, m.b) };
      }

      if (expandFwd) { fwdFrontier = next; fwdDepth = nextDepth; }
      else { bwdFrontier = next; bwdDepth = nextDepth; }
    }

    return { dist: null, path: null };
  }

  const api = { shortestPath: shortestPath, shortestPathTrace: shortestPathTrace };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CineBFS = api;
})(typeof window !== 'undefined' ? window : globalThis);
