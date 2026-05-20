import { createRequire } from 'module';

// eslint-config-next 16 ships native flat-config arrays. Pull them through
// require so we don't need a top-level await for the json/cjs interop.
const require = createRequire(import.meta.url);
const nextCoreWebVitals = require('eslint-config-next/core-web-vitals');
const nextTypescript = require('eslint-config-next/typescript');

const config = [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'functions/node_modules/**',
      'functions/tripshistory/node_modules/**',
      'functions/tripshistory/dist/**',
      'public/sw.js',
      'next-env.d.ts',
      '.vercel/**',
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // New in eslint-config-next 16. Flags many legitimate patterns
      // (init/guard setState inside useEffect). Demote to warn so the build
      // doesn't block on a stylistic concern — revisit when migrating to
      // useSyncExternalStore / external sync patterns.
      'react-hooks/set-state-in-effect': 'warn',
      // Third-party interop (Leaflet dynamic imports, etc.) legitimately
      // needs `any` in places. Surface as warning, not blocker.
      '@typescript-eslint/no-explicit-any': 'warn',
      // React 19 compiler-analysis rules from eslint-plugin-react-hooks
      // v6. These flag patterns the new React Compiler can't optimize
      // (refs during render, impure functions, components inside render).
      // They require real refactors — track as warnings, not errors.
      'react-hooks/refs': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/static-components': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
    },
  },
  {
    // Cloud Functions are plain CommonJS — must come AFTER the next configs
    // so its overrides win. Disables TS rules that don't apply to plain JS.
    files: ['functions/**/*.js'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
];

export default config;
