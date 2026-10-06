import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'release/**',
      'node_modules/**',
      'test-results/**',
      'test-results-screens/**',
      'tests/output/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        chrome: 'readonly',
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        console: 'readonly',
        process: 'readonly',
      },
    },
    rules: {
      // Privacy and remote-code guard rails, enforced at the source level too
      // (scripts/audit-*.mjs check the built bundles).
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-restricted-properties': [
        'error',
        { object: 'chrome', property: 'sync', message: 'Never use chrome.storage.sync.' },
        { object: 'storage', property: 'sync', message: 'Never use chrome.storage.sync.' },
        { object: 'navigator', property: 'sendBeacon', message: 'No network requests.' },
        { property: 'innerHTML', message: 'Build DOM with h()/el(); never parse HTML strings.' },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'fetch', message: 'Huefinch makes no network requests.' },
        { name: 'XMLHttpRequest', message: 'Huefinch makes no network requests.' },
        { name: 'WebSocket', message: 'Huefinch makes no network requests.' },
        { name: 'EventSource', message: 'Huefinch makes no network requests.' },
        { name: 'localStorage', message: 'Use chrome.storage.local via shared/settings.ts.' },
        { name: 'sessionStorage', message: 'Use chrome.storage.local via shared/settings.ts.' },
        {
          name: 'indexedDB',
          message: 'Huefinch stores only its settings, in chrome.storage.local.',
        },
      ],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    // TypeScript already checks identifiers; no-undef only adds false positives.
    files: ['**/*.ts'],
    rules: { 'no-undef': 'off' },
  },
  {
    files: ['scripts/**', 'tests/**', '*.config.*'],
    languageOptions: {
      globals: {
        Buffer: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        URL: 'readonly',
        performance: 'readonly',
      },
    },
    rules: { 'no-restricted-globals': 'off', 'no-restricted-properties': 'off' },
  },
  {
    // The fixture "websites" used by the end-to-end tests run in a browser page.
    files: ['tests/fixtures/**/*.js'],
    languageOptions: {
      sourceType: 'script',
      globals: {
        location: 'readonly',
        history: 'readonly',
        addEventListener: 'readonly',
        requestAnimationFrame: 'readonly',
      },
    },
  },
);
