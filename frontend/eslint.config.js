// @ts-check
const eslint = require('@eslint/js');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');

module.exports = tseslint.config(
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommendedTypeChecked,
      ...tseslint.configs.stylistic,
      ...angular.configs.tsRecommended,
    ],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: __dirname,
      },
    },
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        { type: 'attribute', prefix: 'fk', style: 'camelCase' },
      ],
      '@angular-eslint/component-selector': [
        'error',
        { type: 'element', prefix: 'fk', style: 'kebab-case' },
      ],

      // Every component is OnPush. The brief requires optimised rendering, and
      // one Default component in a signals app silently reintroduces
      // whole-tree checks.
      '@angular-eslint/prefer-on-push-component-change-detection': 'error',

      // `any` is banned outright. The two places it would otherwise be needed
      // (GSAP plugin registration, Three.js userData) are typed explicitly.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-call': 'warn',
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],

      // ── The architectural rule that matters most ─────────────────────────
      // Catalogue data must only ever be reached through a repository. If a
      // component imports `data/*.data` directly, swapping to a real CMS stops
      // being a one-line provider change. See docs/05 §5.2.
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/data/*.data', '**/data/*.data.ts'],
              message:
                'Catalogue data must be reached through a repository (PRODUCT_REPOSITORY, CATEGORY_REPOSITORY, …), not imported directly. See docs/05-technical-architecture.md §5.2.',
            },
          ],
        },
      ],
    },
  },

  // The data layer, SEO services and prerender config legitimately read the
  // source data directly — they are what everything else goes through.
  {
    files: [
      'src/app/data/**/*.ts',
      'src/app/core/seo/**/*.ts',
      'src/app/app.routes.server.ts',
      'scripts/**/*.mjs',
      '**/*.spec.ts',
    ],
    rules: { 'no-restricted-imports': 'off' },
  },

  {
    files: ['**/*.html'],
    extends: [
      ...angular.configs.templateRecommended,
      ...angular.configs.templateAccessibility,
    ],
    rules: {
      // Accessibility rules are errors, not warnings — the target is WCAG 2.2 AA
      // and a warning is a rule nobody fixes.
      '@angular-eslint/template/click-events-have-key-events': 'error',
      '@angular-eslint/template/interactive-supports-focus': 'error',
      '@angular-eslint/template/label-has-associated-control': 'error',
      '@angular-eslint/template/alt-text': 'error',
      '@angular-eslint/template/elements-content': 'error',
      '@angular-eslint/template/valid-aria': 'error',
      '@angular-eslint/template/no-positive-tabindex': 'error',
      '@angular-eslint/template/prefer-control-flow': 'error',
    },
  },
);
