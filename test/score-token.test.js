'use strict';
const test = require('node:test');
const assert = require('node:assert');
const score = require('../api/score');

const SECRET = 'test-secret-123';
const DATE = '2026-06-22';

// Enough elapsed time for the plausibility floor (max(2000ms, clicks*400ms)).
function oldEnough(clicks) {
  return Date.now() - Math.max(2000, clicks * 400) - 1000;
}

test('valid token verifies', () => {
  const token = score.__mintToken(DATE, SECRET, oldEnough(5));
  const v = score.verifyToken(token, DATE, 5, SECRET);
  assert.ok(v.ok, v.reason);
});

test('tampered signature is rejected', () => {
  const token = score.__mintToken(DATE, SECRET, oldEnough(5));
  const bad = token.slice(0, -2) + (token.endsWith('aa') ? 'bb' : 'aa');
  assert.strictEqual(score.verifyToken(bad, DATE, 5, SECRET).ok, false);
});

test('wrong secret is rejected', () => {
  const token = score.__mintToken(DATE, SECRET, oldEnough(5));
  assert.strictEqual(score.verifyToken(token, DATE, 5, 'other-secret').ok, false);
});

test('date mismatch is rejected', () => {
  const token = score.__mintToken(DATE, SECRET, oldEnough(5));
  assert.strictEqual(score.verifyToken(token, '2026-06-21', 5, SECRET).ok, false);
});

test('fresh token (too fast) is rejected', () => {
  const token = score.__mintToken(DATE, SECRET, Date.now());
  const v = score.verifyToken(token, DATE, 10, SECRET);
  assert.strictEqual(v.ok, false);
  assert.strictEqual(v.reason, 'too fast');
});

test('expired token is rejected', () => {
  const token = score.__mintToken(DATE, SECRET, Date.now() - 13 * 3600e3);
  const v = score.verifyToken(token, DATE, 5, SECRET);
  assert.strictEqual(v.ok, false);
  assert.strictEqual(v.reason, 'expired token');
});

test('issueToken produces a token verifiable only after wait window', () => {
  const token = score.issueToken(DATE, SECRET);
  assert.match(token, /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  // Immediately after issue it should be "too fast", proving the floor works.
  assert.strictEqual(score.verifyToken(token, DATE, 3, SECRET).reason, 'too fast');
});
