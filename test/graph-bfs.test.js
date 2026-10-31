'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { shortestPath, shortestPathTrace } = require('../lib/graph-bfs');

// Undirected adjacency -> neighbors function.
function graph(adj) {
  const g = {};
  for (const [a, b] of adj) {
    (g[a] = g[a] || []).push(b);
    (g[b] = g[b] || []).push(a);
  }
  return (k) => g[k] || [];
}

test('same node is distance 0', async () => {
  assert.strictEqual(await shortestPath('a', 'a', graph([])), 0);
});

test('linear chain distance', async () => {
  const n = graph([['a', 'b'], ['b', 'c'], ['c', 'd']]);
  assert.strictEqual(await shortestPath('a', 'd', n), 3);
  assert.strictEqual(await shortestPath('a', 'b', n), 1);
});

test('symmetric (undirected)', async () => {
  const n = graph([['a', 'b'], ['b', 'c'], ['c', 'd']]);
  assert.strictEqual(await shortestPath('d', 'a', n), 3);
});

test('picks the shortest of multiple paths', async () => {
  // a-b-c-d (len3) and a-x-d (len2)
  const n = graph([['a', 'b'], ['b', 'c'], ['c', 'd'], ['a', 'x'], ['x', 'd']]);
  assert.strictEqual(await shortestPath('a', 'd', n), 2);
});

test('unreachable returns null', async () => {
  const n = graph([['a', 'b'], ['c', 'd']]);
  assert.strictEqual(await shortestPath('a', 'd', n), null);
});

test('respects maxDepth', async () => {
  const n = graph([['a', 'b'], ['b', 'c'], ['c', 'd'], ['d', 'e']]);
  assert.strictEqual(await shortestPath('a', 'e', n, { maxDepth: 3 }), null);
  assert.strictEqual(await shortestPath('a', 'e', n, { maxDepth: 4 }), 4);
});

test('handles cycles without hanging', async () => {
  const n = graph([['a', 'b'], ['b', 'c'], ['c', 'a'], ['c', 'd']]);
  assert.strictEqual(await shortestPath('a', 'd', n), 2);
});

test('works with async neighbors and object keys', async () => {
  const adj = { a: ['b'], b: ['a', 'c'], c: ['b'] };
  const neighbors = async (k) => (adj[k] || []).map((id) => ({ key: id }));
  assert.strictEqual(await shortestPath('a', 'c', neighbors), 2);
});

test('trace: reconstructs the path on a chain', async () => {
  const n = graph([['a', 'b'], ['b', 'c'], ['c', 'd']]);
  const r = await shortestPathTrace('a', 'd', n);
  assert.strictEqual(r.dist, 3);
  assert.deepStrictEqual(r.path, ['a', 'b', 'c', 'd']);
});

test('trace: same node', async () => {
  const r = await shortestPathTrace('a', 'a', graph([]));
  assert.deepStrictEqual(r, { dist: 0, path: ['a'] });
});

test('trace: picks a shortest path and endpoints are correct', async () => {
  const n = graph([['a', 'b'], ['b', 'c'], ['c', 'd'], ['a', 'x'], ['x', 'd']]);
  const r = await shortestPathTrace('a', 'd', n);
  assert.strictEqual(r.dist, 2);
  assert.strictEqual(r.path[0], 'a');
  assert.strictEqual(r.path[r.path.length - 1], 'd');
  assert.strictEqual(r.path.length, 3);
  // every consecutive pair must be an edge
  for (let i = 0; i < r.path.length - 1; i++) {
    assert.ok(n(r.path[i]).includes(r.path[i + 1]), 'edge ' + r.path[i] + '->' + r.path[i + 1]);
  }
});

test('trace: unreachable', async () => {
  const r = await shortestPathTrace('a', 'd', graph([['a', 'b'], ['c', 'd']]));
  assert.deepStrictEqual(r, { dist: null, path: null });
});

test('trace: path length matches dist+1 on bigger graph', async () => {
  const adj = [['hub1', 'bridge'], ['bridge', 'hub2']];
  for (let i = 0; i < 50; i++) { adj.push(['hub1', 'l1_' + i]); adj.push(['hub2', 'l2_' + i]); }
  const n = graph(adj);
  const r = await shortestPathTrace('l1_3', 'l2_9', n);
  assert.strictEqual(r.dist, 4);
  assert.strictEqual(r.path.length, 5);
  assert.strictEqual(r.path[0], 'l1_3');
  assert.strictEqual(r.path[4], 'l2_9');
});

test('large balanced graph stays cheap via bidirectional search', async () => {
  // Two stars joined by a bridge: hub1 - bridge - hub2, each hub has 200 leaves.
  const adj = [['hub1', 'bridge'], ['bridge', 'hub2']];
  for (let i = 0; i < 200; i++) { adj.push(['hub1', 'l1_' + i]); adj.push(['hub2', 'l2_' + i]); }
  const n = graph(adj);
  assert.strictEqual(await shortestPath('l1_5', 'l2_7', n), 4); // leaf-hub-bridge-hub-leaf
});

test('directed: with predecessors, a route that only exists backwards is not taken', async () => {
  // a's board shows only x; b's board shows y and a (but a's board doesn't show b).
  // Undirected, a-b looks like 1 hop; as played it's a → x → b.
  const out = { a: ['x', 'p', 'q'], x: ['b'], p: [], q: [], b: ['y', 'a'], y: [] };
  const nb = k => out[k] || [];
  const pred = k => Object.keys(out).filter(n => out[n].includes(k));
  assert.strictEqual((await shortestPathTrace('a', 'b', nb)).dist, 1, 'undirected finds the fake shortcut');
  const r = await shortestPathTrace('a', 'b', nb, { predecessors: pred });
  assert.deepStrictEqual(r.path, ['a', 'x', 'b']);
});

// Plain forward BFS over the real (directed) boards: the true minimum.
async function forwardBfs(a, b, nb, maxDepth) {
  const seen = new Set([a]);
  let frontier = [a];
  for (let d = 1; d <= maxDepth && frontier.length; d++) {
    const next = [];
    for (const k of frontier) for (const m of nb(k)) {
      if (m === b) return d;
      if (!seen.has(m)) { seen.add(m); next.push(m); }
    }
    frontier = next;
  }
  return null;
}

test('directed: lazy backward check finds playable routes, exact when boards are mutual', async () => {
  // Small seeded PRNG so the random graphs are the same every run.
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  for (let g = 0; g < 300; g++) {
    const n = 8 + Math.floor(rnd() * 12);
    const symmetric = g % 3 === 0;
    const out = {};
    for (let i = 0; i < n; i++) out['n' + i] = [];
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j || rnd() >= 0.2) continue;
        if (!out['n' + i].includes('n' + j)) out['n' + i].push('n' + j);
        if (symmetric && !out['n' + j].includes('n' + i)) out['n' + j].push('n' + i);
      }
    }
    const nb = k => out[k] || [];
    const truth = await forwardBfs('n0', 'n1', nb, 6);
    const r = await shortestPathTrace('n0', 'n1', async k => nb(k), { directed: true, concurrency: 4, maxDepth: 6 });
    if (symmetric) assert.strictEqual(r.dist, truth, 'graph ' + g);
    if (r.dist != null) {
      assert.ok(truth != null && r.dist >= truth, 'graph ' + g + ' never shorter than the real minimum');
      assert.strictEqual(r.path.length, r.dist + 1);
      assert.strictEqual(r.path[0], 'n0');
      assert.strictEqual(r.path[r.path.length - 1], 'n1');
      for (let i = 0; i < r.path.length - 1; i++) {
        assert.ok(nb(r.path[i]).includes(r.path[i + 1]), 'graph ' + g + ' edge ' + r.path[i] + '->' + r.path[i + 1]);
      }
    }
  }
});

test('directed: the one-way shortcut is not taken', async () => {
  const out = { a: ['x', 'p', 'q'], x: ['b', 'a'], p: [], q: [], b: ['y', 'a', 'x'], y: [] };
  const r = await shortestPathTrace('a', 'b', k => out[k] || [], { directed: true });
  assert.deepStrictEqual(r.path, ['a', 'x', 'b']);
});

test('directed: with superset candidates the search is exact', async () => {
  let seed = 11;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  for (let g = 0; g < 300; g++) {
    const n = 8 + Math.floor(rnd() * 12);
    const out = {};
    for (let i = 0; i < n; i++) {
      out['n' + i] = [];
      for (let j = 0; j < n; j++) if (i !== j && rnd() < 0.2) out['n' + i].push('n' + j);
    }
    const nb = k => out[k] || [];
    // Every edge into k, plus some noise that the lazy check has to reject.
    const cand = k => Object.keys(out).filter(c => nb(c).includes(k) || rnd() < 0.2);
    const truth = await forwardBfs('n0', 'n1', nb, 6);
    const r = await shortestPathTrace('n0', 'n1', nb, { directed: true, candidates: cand, concurrency: 3, maxDepth: 6 });
    assert.strictEqual(r.dist, truth, 'graph ' + g);
    if (r.path) for (let i = 0; i < r.path.length - 1; i++) assert.ok(nb(r.path[i]).includes(r.path[i + 1]));
  }
});
