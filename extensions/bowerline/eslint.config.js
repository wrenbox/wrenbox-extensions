import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/**', 'dist-e2e/**', 'release/**', 'node_modules/**', 'test-results/**'],
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
        console: 'readonly',
        process: 'readonly',
      },
    },
    rules: {
      // Privacy and remote-code guard rails, enforced at the source level too.
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-restricted-properties': [
        'error',
        { object: 'chrome', property: 'sync', message: 'Never use chrome.storage.sync.' },
        { object: 'navigator', property: 'sendBeacon', message: 'No network beacons.' },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'XMLHttpRequest', message: 'No network requests outside the PDF loader.' },
        { name: 'WebSocket', message: 'No network connections.' },
        { name: 'EventSource', message: 'No network connections.' },
        { name: 'localStorage', message: 'Use chrome.storage.local via shared/settings.ts.' },
        { name: 'indexedDB', message: 'Only the service worker database module opens IndexedDB.' },
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
        crypto: 'readonly',
      },
    },
    rules: { 'no-restricted-globals': 'off' },
  },
  {
    files: ['src/background/db.ts'],
    rules: { 'no-restricted-globals': 'off' },
  },
);
