import type { ProcessProfile } from './config/schema'

/**
 * O que o main descobre na organização do Azure para o assistente de
 * Configuração montar Produtos e Perfis de processo sem o PO digitar nomes.
 * Só leitura: tudo aqui sai de GETs.
 */

export interface DiscoveredProject {
  id: string
  name: string
  /** Nome do processo do projeto (`Scrum`, `Agile` ou um herdado). `null` se o Azure não disse. */
  process: string | null
  /** Time padrão do projeto, sugestão natural para o campo "team" do Produto. */
  defaultTeam: string | null
}

export interface DiscoveredTeam {
  id: string
  name: string
}

/** Nó da árvore de áreas. `path` já está no formato que a Configuração usa (`Projeto\Área`). */
export interface DiscoveredArea {
  name: string
  path: string
  children: DiscoveredArea[]
}

/**
 * Categoria de estado do Azure. É ela, e não o nome do estado, que permite
 * sugerir estados de entrega e terminais em processos customizados.
 */
export type StateCategory = 'Proposed' | 'InProgress' | 'Resolved' | 'Completed' | 'Removed'

export interface DiscoveredState {
  name: string
  /** `null` quando o Azure devolve uma categoria que o app não conhece. */
  category: StateCategory | null
}

export interface DiscoveredWorkItemType {
  name: string
  referenceName: string
  /** Estados na ordem em que o Azure os lista, que é a do fluxo. */
  states: DiscoveredState[]
  /** Campo de estimativa padrão do Azure presente no tipo (Effort, Story Points ou Size). */
  estimateField: string | null
}

/** Papel do tipo segundo as categorias de tipo do processo (`Microsoft.*Category`). */
export interface DiscoveredTypeCategories {
  /** Tipos do backlog de requisitos (PBI, User Story, …). */
  requirement: string[]
  bug: string | null
  task: string | null
}

export interface DiscoveredProcess {
  /** Só os tipos visíveis: os da categoria oculta (Test Plan, Code Review…) ficam de fora. */
  workItemTypes: DiscoveredWorkItemType[]
  categories: DiscoveredTypeCategories
}

/**
 * Processo descoberto mais o Perfil de processo sugerido a partir das categorias.
 * `suggestion` é `null` quando o projeto não tem tipo de requisito visível.
 */
export interface ProcessDiscovery extends DiscoveredProcess {
  suggestion: ProcessProfile | null
}

export interface DiscoveredField {
  name: string
  referenceName: string
  /** Tipo de dado do Azure: `string`, `integer`, `double`, `dateTime`… */
  type: string
}
