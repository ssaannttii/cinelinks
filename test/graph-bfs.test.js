'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { shortestPath } = require('../lib/graph-bfs');

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

test('large balanced graph stays cheap via bidirectional search', async () => {
  // Two stars joined by a bridge: hub1 - bridge - hub2, each hub has 200 leaves.
  const adj = [['hub1', 'bridge'], ['bridge', 'hub2']];
  for (let i = 0; i < 200; i++) { adj.push(['hub1', 'l1_' + i]); adj.push(['hub2', 'l2_' + i]); }
  const n = graph(adj);
  assert.strictEqual(await shortestPath('l1_5', 'l2_7', n), 4); // leaf-hub-bridge-hub-leaf
});
