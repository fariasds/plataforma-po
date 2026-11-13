/**
 * Textos de ajuda das telas, indexados pelo ID da regra de negócio.
 *
 * A fonte de verdade é `docs/regras-de-negocio/`. O que a tela mostra é o
 * **resumo** que cabe num balão — não a regra inteira — e ele mora com os demais
 * textos da interface, em `i18n/pt-BR.ts` (`help.rules`). Ao mudar uma regra no
 * documento, revise o resumo correspondente lá.
 *
 * O ID é o elo entre os três lugares: a documentação, o resumo e o código que
 * implementa o cálculo.
 *
 * **Critério para existir uma ajuda:** o cálculo contraria a intuição. Indicador
 * cujo nome já explica o número não recebe "?" — ícone que aparece em tudo vira
 * mobília e ninguém clica.
 */
import { t } from '../i18n'
import type { ptBR } from '../i18n/pt-BR'

export interface HelpRule {
  /** Título do balão — normalmente o nome do elemento na tela. */
  title: string
  /** Explicação curta de como o número é obtido. Duas ou três frases. */
  text: string
}

export type HelpRuleId = keyof typeof ptBR.help.rules

export function helpRule(id: HelpRuleId): HelpRule {
  return { title: t(`help.rules.${id}.title`), text: t(`help.rules.${id}.text`) }
}
