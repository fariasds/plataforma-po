import { defineConfig } from 'eslint/config'
import tseslint from '@electron-toolkit/eslint-config-ts'
import eslintConfigPrettier from '@electron-toolkit/eslint-config-prettier'
import eslintPluginReact from 'eslint-plugin-react'
import eslintPluginReactHooks from 'eslint-plugin-react-hooks'
import eslintPluginReactRefresh from 'eslint-plugin-react-refresh'

/** Props e campos de objeto cujo valor vai para a tela. */
const TEXT_PROPS =
  '/^(title|label|placeholder|description|extra|help|hint|text|emptyText|tooltip|message|aria-label)$/'

export default defineConfig(
  // .claude/worktrees: o app desktop cria as worktrees das sessões dentro do repo.
  // docs/plano-open-source: ferramenta do plano, que não vai para o repo público.
  {
    ignores: [
      '**/node_modules',
      '**/dist',
      '**/out',
      '.claude/worktrees/**',
      'docs/plano-open-source/**'
    ]
  },
  tseslint.configs.recommended,
  eslintPluginReact.configs.flat.recommended,
  eslintPluginReact.configs.flat['jsx-runtime'],
  {
    settings: {
      react: {
        version: 'detect'
      }
    }
  },
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': eslintPluginReactHooks,
      'react-refresh': eslintPluginReactRefresh
    },
    rules: {
      ...eslintPluginReactHooks.configs.recommended.rules,
      ...eslintPluginReactRefresh.configs.vite.rules
    }
  },
  // Texto da interface sai de `src/renderer/src/i18n/pt-BR.ts`, por `t()`. As duas
  // regras cobrem o que se escreve sem pensar: texto solto no JSX e texto em prop
  // ou campo de objeto que vai para a tela (`title`, `label`, `placeholder`…).
  {
    files: ['src/renderer/src/**/*.tsx'],
    rules: {
      'react/jsx-no-literals': [
        'error',
        {
          noStrings: true,
          ignoreProps: true,
          // Pontuação que cola em valores, não frase: "#123", "3/5", "40%", "A · B".
          allowedStrings: ['#', '/', '%', '·', '—']
        }
      ],
      'no-restricted-syntax': [
        'error',
        // Só o valor direto: a chave em template dentro de `t()` não é texto de tela.
        ...[
          `JSXAttribute[name.name=${TEXT_PROPS}] > Literal`,
          `JSXAttribute[name.name=${TEXT_PROPS}] > JSXExpressionContainer > Literal`,
          `JSXAttribute[name.name=${TEXT_PROPS}] > JSXExpressionContainer > TemplateLiteral > TemplateElement`,
          `Property[key.name=${TEXT_PROPS}] > Literal`,
          `Property[key.name=${TEXT_PROPS}] > TemplateLiteral > TemplateElement`
        ].map((node) => ({
          selector: `${node}[${node.endsWith('Literal') ? 'value' : 'value.raw'}=/[A-Za-zÀ-ÿ]{2}/]`,
          message: 'Texto da interface vem de t(), não de literal (src/renderer/src/i18n).'
        }))
      ]
    }
  },
  eslintConfigPrettier
)
