import js from '@eslint/js'
import { defineConfig, globalIgnores } from 'eslint/config'
import jsxA11y from 'eslint-plugin-jsx-a11y'
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
    extends: [
      reactHooks.configs.flat['recommended-latest'],
      reactRefresh.configs.vite,
      // Keeps the accessibility rules of CLAUDE.md enforced instead of remembered.
      jsxA11y.flatConfigs.recommended,
    ],
    languageOptions: { globals: globals.browser },
    rules: {
      // Every autoFocus here is inside something the person just opened (a dialog, a sheet,
      // a cell editor) — focus belongs there, and nothing moves under anyone on page load.
      'jsx-a11y/no-autofocus': 'off',
      // Our form primitives render a real control inside, so a label around them does
      // associate — the rule just can't see through the component. Switch is NOT in this
      // list on purpose: Radix renders a <button role="switch">, which a <label> cannot
      // name. Use <SwitchField>, which wires aria-labelledby.
      'jsx-a11y/label-has-associated-control': [
        'error',
        { controlComponents: ['AmountInput', 'Input', 'NativeSelect', 'ColorPicker'] },
      ],
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
