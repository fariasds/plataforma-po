/**
 * Os prompts do processo rule-first que o servidor MCP oferece (ADR 0014). O texto
 * de cada um vem com o app, em `resources/mcp/rule-first/`, e o PO pode trocá-lo por
 * um arquivo na pasta do Perfil, `instrucoes/<nome>.md`. A IA propõe a troca; quem
 * aplica é o PO, na janela (RN-FLX-26).
 */

export interface PromptArgument {
  name: string
  description: string
  required: boolean
}

export interface RuleFirstPrompt {
  name: string
  title: string
  description: string
  arguments: PromptArgument[]
}

const PRODUCT: PromptArgument = {
  name: 'produto',
  description: 'ID do Produto, como está na Configuração.',
  required: true
}

export const RULE_FIRST_PROMPTS = [
  {
    name: 'resumir_feedback',
    title: 'Resumir um feedback',
    description: 'A dor e a solicitação de um feedback de cliente, prontas para o ticket.',
    arguments: [
      PRODUCT,
      { name: 'feedback', description: 'ID do feedback no Azure.', required: false }
    ]
  },
  {
    name: 'encaixar_oportunidade',
    title: 'Encaixar uma oportunidade',
    description: 'Em qual Feature aberta a oportunidade entra, ou se ela pede uma Feature nova.',
    arguments: [
      PRODUCT,
      {
        name: 'oportunidade',
        description: 'ID do feedback, ou a dor em uma frase.',
        required: false
      }
    ]
  },
  {
    name: 'discovery',
    title: 'Discovery de uma Feature',
    description:
      'Problema, Decisões, Requisitos, Plano de PBIs e PBIs de design, com checkpoint em cada passo.',
    arguments: [
      PRODUCT,
      { name: 'feature', description: 'ID da Feature no Azure, ou a pasta.', required: false }
    ]
  },
  {
    name: 'quebra',
    title: 'Quebra de uma Feature',
    description:
      'Regras candidatas, revisão do plano, PBIs de desenvolvimento e gravação no catálogo.',
    arguments: [
      PRODUCT,
      { name: 'feature', description: 'ID da Feature no Azure, ou a pasta.', required: true }
    ]
  },
  {
    name: 'analisar_bug',
    title: 'Analisar um bug',
    description: 'Veredito, criticidade e regras afetadas, numa passada, contra o catálogo.',
    arguments: [PRODUCT, { name: 'bug', description: 'ID do bug no Azure.', required: false }]
  },
  {
    name: 'reescrever_bug',
    title: 'Reescrever um bug no padrão',
    description: 'O relato completo do bug: ambiente, passos, atual, esperado e impacto.',
    arguments: [PRODUCT, { name: 'bug', description: 'ID do bug no Azure.', required: false }]
  }
] as const satisfies readonly RuleFirstPrompt[]

export type RuleFirstPromptName = (typeof RULE_FIRST_PROMPTS)[number]['name']

export function isRuleFirstPrompt(name: unknown): name is RuleFirstPromptName {
  return RULE_FIRST_PROMPTS.some((prompt) => prompt.name === name)
}

/** O teto de uma instrução: muito acima de qualquer roteiro útil. */
export const MAX_INSTRUCTION_BYTES = 100 * 1024

/** O que a janela mostra de cada instrução, na Configuração. */
export interface InstructionState {
  name: RuleFirstPromptName
  title: string
  /** O PO trocou o texto de fábrica por um dele. */
  overridden: boolean
  /** O texto em uso. */
  current: string
  /** O que a IA propôs e o PO ainda não aplicou, ou `null`. */
  proposal: string | null
}
