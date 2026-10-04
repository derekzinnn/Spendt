import js from '@eslint/js'
import { defineConfig, globalIgnores } from 'eslint/config'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default defineConfig([
  globalIgnores(['**/dist', '**/coverage', '**/node_modules', 'apps/api/src/generated']),

  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      ecmaVersion: 2023,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Express handlers and React event props legitimately receive async functions.
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { arguments: false, attributes: false } },
      ],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'smart'],
    },
  },

  // API: Node
  {
    files: ['apps/api/**/*.ts'],
    languageOptions: { globals: globals.node },
  },
  {
    // CLI scripts talk to the terminal on purpose
    files: ['apps/api/prisma/**/*.ts', 'apps/api/src/config/env.ts'],
    rules: { 'no-console': 'off' },
  },

  {
    // Tests assert on dynamic JSON from HTTP responses (`res.body` is `any`).
    files: ['**/*.test.ts', 'apps/api/src/test/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
    },
  },

  // Web: browser + React
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat['recommended-latest'], reactRefresh.configs.vite],
    languageOptions: { globals: globals.browser },
    rules: {
      // shadcn-style variant helpers and provider hooks live next to their component.
      'react-refresh/only-export-components': [
        'warn',
        {
          allowConstantExport: true,
          allowExportNames: [
            'buttonVariants',
            'badgeVariants',
            'inputClassName',
            'overlayClassName',
            'floatingMotion',
            'useMonth',
            'useTheme',
            'usePrivacy',
            'useQuickAdd',
          ],
        },
      ],
    },
  },

  // Plain JS config files are not part of any tsconfig
  {
    files: ['**/*.js'],
    extends: [js.configs.recommended, tseslint.configs.disableTypeChecked],
    languageOptions: { globals: globals.node },
  },
])
