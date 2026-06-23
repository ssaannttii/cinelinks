// Single source of truth for mapping a par (minimum clicks) to a difficulty.
// Used by the game (index.html win screen) AND the difficulty CLI so the labels
// can never drift apart. Thresholds: <=2 easy, 3 medium, 4 hard, >=5 expert.
(function (root) {
  'use strict';

  function difficultyLevel(par) {
    if (par == null || !(par > 0)) return 'unknown';
    if (par <= 2) return 'easy';
    if (par === 3) return 'medium';
    if (par === 4) return 'hard';
    return 'expert';
  }

  var I18N_KEY = { easy: 'diffEasy', medium: 'diffMedium', hard: 'diffHard', expert: 'diffExpert', unknown: null };
  function difficultyI18nKey(par) { return I18N_KEY[difficultyLevel(par)]; }

  var api = { difficultyLevel: difficultyLevel, difficultyI18nKey: difficultyI18nKey, LEVELS: ['easy', 'medium', 'hard', 'expert'] };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CineDifficulty = api;
})(typeof window !== 'undefined' ? window : globalThis);
