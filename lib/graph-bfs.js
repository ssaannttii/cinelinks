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
// `maxDepth`. The graph is treated as undirected, so the same neighbors() is used
// for both search directions.
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

      for (const nk of frontier) {
        let ns;
        try { ns = await neighbors(nk); } catch { ns = []; }
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

  const api = { shortestPath: shortestPath };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CineBFS = api;
})(typeof window !== 'undefined' ? window : globalThis);
