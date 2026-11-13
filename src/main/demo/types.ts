import type { WorkItemUpdate } from '@shared/azure'
import type { StateCategory } from '@shared/discovery'

/**
 * Forma de um Cenário: uma Configuração fictícia, o estado do Azure fictício e o
 * "hoje" em que tudo é olhado. Serve à regressão das telas (T-23) e ao Perfil de
 * demonstração (T-24).
 *
 * Tudo aqui é dado puro: nada de rede, disco ou Electron.
 */

/** Uma iteração com datas, como o Azure a cadastra. */
export interface FakeIteration {
  id: string
  name: string
  /** Caminho no formato do WIQL: `Contoso\Loja\Sprint 3`. */
  path: string
  /** Meia-noite UTC, como o Azure devolve: `2026-09-21T00:00:00Z`. */
  startDate: string
  finishDate: string
}

export interface FakeTeam {
  id: string
  name: string
  /** IDs das iterações atribuídas ao time. */
  iterationIds: string[]
}

export interface FakeState {
  name: string
  category: StateCategory
}

export interface FakeWorkItemType {
  name: string
  referenceName: string
  states: FakeState[]
  /** Nomes de referência dos campos do tipo; a descoberta lê a estimativa daqui. */
  fields: string[]
  disabled?: boolean
}

/** O processo do projeto, como as rotas de tipo e categoria o devolvem. */
export interface FakeProcess {
  /** Nome do template, como o detalhe do projeto traz (`Scrum`, `Agile`...). */
  templateName: string
  types: FakeWorkItemType[]
  categories: {
    requirement: string[]
    bug: string | null
    task: string | null
    hidden: string[]
  }
}

export interface FakeField {
  name: string
  referenceName: string
  type: string
}

export interface FakeProject {
  id: string
  name: string
  process: FakeProcess
  defaultTeam: string
  teams: FakeTeam[]
  /** Áreas abaixo da raiz, no formato do WIQL: `Contoso\Loja\Checkout`. */
  areas: string[]
  iterations: FakeIteration[]
  /** Campos customizados do projeto. Os padrão o Azure fictício já conhece. */
  customFields: FakeField[]
}

export interface FakeWorkItem {
  id: number
  fields: Record<string, unknown>
  updates: WorkItemUpdate[]
}

export interface FakePerson {
  /** Storage key, como vem em `connectionData`. */
  id: string
  displayName: string
  uniqueName: string
  descriptor: string
}

export interface AzureState {
  organization: string
  /** Dono do PAT fictício: quem `connectionData` diz que está conectado. */
  user: FakePerson
  projects: FakeProject[]
  workItems: FakeWorkItem[]
}

export interface Scenario {
  /** Estável, em kebab-case: nomeia a pasta dos resultados aprovados. */
  id: string
  titulo: string
  /** Um parágrafo: o que este Cenário prova. */
  prova: string
  /** Regras de negócio que ele exercita. */
  regras: string[]
  /** Telas em que o Cenário tem o que provar. Todas rodam; estas são o foco. */
  telas: string[]
  /** O "hoje" do Cenário, em horário local: `2026-09-29T10:00:00`. */
  anchorDate: string
  /** A Configuração como está no arquivo, antes da validação. */
  config: Record<string, unknown>
  azure: AzureState
  /** Produtos e Grupos em que as telas são abertas. */
  selections: string[]
  /** Dados de trabalho do Perfil, pela chave de `planningKeys`. */
  workData?: Record<string, unknown>
}
