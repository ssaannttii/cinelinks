'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { difficultyLevel, difficultyI18nKey, LEVELS } = require('../lib/difficulty');

test('par -> difficulty level thresholds', () => {
  assert.strictEqual(difficultyLevel(1), 'easy');
  assert.strictEqual(difficultyLevel(2), 'easy');
  assert.strictEqual(difficultyLevel(3), 'medium');
  assert.strictEqual(difficultyLevel(4), 'hard');
  assert.strictEqual(difficultyLevel(5), 'expert');
  assert.strictEqual(difficultyLevel(9), 'expert');
});

test('null / non-positive par is unknown', () => {
  assert.strictEqual(difficultyLevel(null), 'unknown');
  assert.strictEqual(difficultyLevel(0), 'unknown');
  assert.strictEqual(difficultyLevel(undefined), 'unknown');
});

test('i18n key mapping', () => {
  assert.strictEqual(difficultyI18nKey(2), 'diffEasy');
  assert.strictEqual(difficultyI18nKey(3), 'diffMedium');
  assert.strictEqual(difficultyI18nKey(4), 'diffHard');
  assert.strictEqual(difficultyI18nKey(6), 'diffExpert');
  assert.strictEqual(difficultyI18nKey(null), null);
});

test('LEVELS ordered', () => {
  assert.deepStrictEqual(LEVELS, ['easy', 'medium', 'hard', 'expert']);
});
