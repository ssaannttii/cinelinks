// Flat ESLint config. Intentionally light — this is a vanilla-JS project.
// Run with: npx eslint .   (after: npm i -D eslint @eslint/js)
import js from '@eslint/js';

const browser = {
  window: 'readonly', document: 'readonly', navigator: 'readonly', location: 'readonly',
  fetch: 'readonly', localStorage: 'readonly', sessionStorage: 'readonly',
  setTimeout: 'readonly', clearTimeout: 'readonly', setInterval: 'readonly', clearInterval: 'readonly',
  requestAnimationFrame: 'readonly', history: 'readonly', URL: 'readonly',
  URLSearchParams: 'readonly', Intl: 'readonly', console: 'readonly',
  atob: 'readonly', btoa: 'readonly', Image: 'readonly',
  matchMedia: 'readonly', performance: 'readonly',
  CineCredits: 'readonly', MergeStats: 'readonly', Media: 'readonly', Pool: 'readonly', Fx: 'readonly'
};
const node = {
  process: 'readonly', module: 'writable', require: 'readonly', __dirname: 'readonly',
  console: 'readonly', fetch: 'readonly', Buffer: 'readonly', URL: 'readonly',
  URLSearchParams: 'readonly', setTimeout: 'readonly'
};
const worker = {
  self: 'readonly', caches: 'readonly', fetch: 'readonly', URL: 'readonly',
  Promise: 'readonly', clients: 'readonly'
};

export default [
  { ignores: ['ratinggame/**', 'node_modules/**', '**/.next/**', '.claude/**', '**/*.json', '**/*.html', '_*.js'] },
  js.configs.recommended,

  // Node serverless functions + offline scripts
  {
    files: ['api/**/*.js', 'scripts/**/*.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'commonjs', globals: node },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
      'no-empty': ['warn', { allowEmptyCatch: true }]
    }
  },

  // Shared lib (UMD-style, runs in both browser and Node)
  {
    files: ['lib/**/*.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'script', globals: { ...browser, module: 'writable', globalThis: 'readonly' } }
  },

  // Browser scripts loaded by index.html. LANGS/I18N/DAILY_CHALLENGE_KEYS are
  // intentionally consumed by other scripts on the page.
  {
    files: ['i18n.js', 'daily-challenges.js', 'cineclue-pool.js', 'cineline-pool.js', 'ads.js', 'support.js', 'howto.js', 'auth.js', 'cookie.js', 'cineguess.js', 'home-art.js', 'daily-gallery.js', 'fx.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'script', globals: browser },
    rules: { 'no-unused-vars': 'off', 'no-empty': ['warn', { allowEmptyCatch: true }] }
  },

  // Service worker
  {
    files: ['sw.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'script', globals: worker }
  },

  // Tests
  {
    files: ['test/**/*.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'commonjs', globals: node }
  }
];
