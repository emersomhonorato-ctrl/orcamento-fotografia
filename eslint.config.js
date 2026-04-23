import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores([
    'dist',
    '.vercel/**',
    'public/assets/**',
    'src/App-backup.jsx',
    'src/App-dashboard-backup.jsx',
    'src/App-funcionando.jsx',
    'src/App-funil-backup.jsx',
    'src/App-funil-clicavel-backup.jsx',
    'src/App-funil-visual-backup.jsx',
    'src/App-orcamento-itens-backup.jsx',
    'src/App-STABLE-FUNIL-VISUAL.jsx',
    'src/App-status-backup.jsx',
    'src/components/MetricCard.jsx',
    'src/data/defaults.js',
    'tmp_fix_storage.js',
  ]),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
      'react-refresh/only-export-components': 'off',
    },
  },
])
