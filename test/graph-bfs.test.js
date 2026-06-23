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
