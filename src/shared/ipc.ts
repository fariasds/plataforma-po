import type { SprintGoalRequest } from './ai'
import type { SerializedError } from './errors'
import type { Configuration } from './config/schema'
import type { ConfigurationIssue } from './config/validate'
import type { AzureUserProfile, UnifiedSprint } from './azure'
import type {
  DiscoveredArea,
  DiscoveredField,
  DiscoveredProject,
  DiscoveredTeam,
  ProcessDiscovery
} from './discovery'
import type {
  BugAnalysisResult,
  DailyResult,
  PlanningLookupItem,
  PlanningResult,
  SprintDeliveryResult,
  TeamPerformanceResult
} from './dashboards'

/**
 * Wire names for each method of `IpcApi`. The `satisfies` clause makes the map
 * exhaustive and exact: a method without a channel (or a channel without a
 * method) is a compile error.
 * Declared below `IpcApi`, which it depends on — see the bottom of this file.
 */
export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS]

/**
 * Handlers never reject across the wire: they resolve with this envelope.
 * Electron mangles thrown errors ("Error invoking remote method ..."), losing the
 * original message and any error code. The preload unwraps this and rethrows a
 * proper Error, so the renderer sees clean failures in TanStack Query.
 */
export type IpcResult<T> = { ok: true; data: T } | { ok: false; error: SerializedError }

// --- Perfil ---------------------------------------------------------------

/**
 * - `no-profile`: nenhum Perfil nesta máquina.
 * - `needs-pat`: o Perfil existe, mas sem PAT guardado.
 * - `invalid-config`: a Configuração nunca foi válida desde que o app abriu.
 * - `ready`: há Configuração em uso. Com `errors` preenchido, o arquivo atual
 *   está quebrado e o app segue com a última versão válida (RN-CFG-07).
 */
export type ProfileStatus = 'no-profile' | 'needs-pat' | 'invalid-config' | 'ready'

/**
 * `demo` é o Perfil de demonstração (RN-GLB-15): Azure fictício, sem PAT e sem
 * rede (RN-SEC-27). A janela só lê o tipo para mostrar a faixa e esconder o que
 * não se aplica; quem decide o caminho dos dados é o main.
 */
export type ProfileKind = 'azure' | 'demo'

export interface ProfileState {
  status: ProfileStatus
  /** `dir` é a pasta que o app abre para o PO; o PAT não está nela (RN-CFG-06). */
  profile: { id: string; name: string; dir: string; kind: ProfileKind } | null
  /** A Configuração em uso: a última versão válida. */
  config: Configuration | null
  /** Problemas do arquivo como está no disco agora. */
  errors: ConfigurationIssue[]
  /**
   * Já existe um Perfil com Azure de verdade? A v1 tem no máximo um: com ele,
   * a demonstração oferece voltar para ele, e não criar outro (RN-GLB-15).
   */
  hasAzureProfile: boolean
}

/** O PAT entra junto porque o Perfil só nasce se o token funcionar. */
export interface CreateProfileRequest {
  name: string
  organization: string
  pat: string
}

export type ImportConfigResult =
  | { saved: true; removed: { products: string[]; groups: string[] } }
  | { saved: false; issues: ConfigurationIssue[] }

/**
 * The clean, domain-level API the renderer codes against (see `ipc/client.ts`).
 * Adding a capability starts here: one method, then handler + bridge binding.
 */
export interface IpcApi {
  /** Is there a PAT stored on this machine? */
  hasPat(): Promise<boolean>
  /**
   * Validates the PAT against Azure DevOps and, only if it works, stores it
   * encrypted. Rejects with `AZURE_UNAUTHORIZED` / `AZURE_UNREACHABLE` otherwise.
   *
   * There is deliberately no `loadPat`: the PAT has no reason to reach the
   * renderer. It goes in, and from then on only the main process reads it.
   */
  savePat(pat: string): Promise<void>
  /** Deletes the stored PAT. */
  clearPat(): Promise<void>

  // --- Perfil -------------------------------------------------------------

  getProfileState(): Promise<ProfileState>
  /**
   * Valida o PAT no Azure, cria o Perfil com a Configuração inicial e guarda o
   * token cifrado. Se o token não funciona, nada é criado.
   */
  createProfile(input: CreateProfileRequest): Promise<ProfileState>
  /** Valida antes de gravar; um JSON recusado não chega ao disco. */
  importConfig(json: string): Promise<ImportConfigResult>
  /** Abre a pasta do Perfil ativo no gerenciador de arquivos. */
  openProfileFolder(): Promise<void>
  /** `null` quando a chave nunca foi gravada. */
  readWorkData(key: string): Promise<unknown>
  writeWorkData(key: string, value: unknown): Promise<void>

  // --- Perfil de demonstração (RN-GLB-15, RN-SEC-27) ----------------------
  //
  // Sem parâmetro, de propósito: nada que venha da janela escolhe o caminho dos
  // dados. Entrar na demonstração muda o Perfil ativo, e é ele que o main lê.

  /** Torna ativa a demonstração, criando-a na primeira vez. */
  startDemo(): Promise<ProfileState>
  /** Apaga os Dados de trabalho da demonstração e regrava a Configuração do Cenário. */
  restoreDemo(): Promise<ProfileState>
  /** Sai da demonstração para o Perfil com o Azure de verdade. */
  leaveDemo(): Promise<ProfileState>

  // --- Dashboards: one call per screen ------------------------------------
  //
  // `selectionId` é o ID de um Produto ou de um Grupo da Configuração em uso. ID
  // que não existe nela resolve com o erro `SELECTION_UNKNOWN`.

  /** Sprints unificadas de todos os Produtos com cadência por sprint, mais nova primeiro. */
  getSprints(limit?: number, preferFuture?: boolean): Promise<UnifiedSprint[]>
  getSprintDelivery(selectionId: string, sprint: UnifiedSprint): Promise<SprintDeliveryResult>
  getTeamPerformance(selectionId: string, sprints: UnifiedSprint[]): Promise<TeamPerformanceResult>
  getBugAnalysis(
    selectionId: string,
    sprints: UnifiedSprint[],
    selectedSprint: UnifiedSprint
  ): Promise<BugAnalysisResult>
  getPlanning(selectionId: string, sprint: UnifiedSprint): Promise<PlanningResult>
  /** Looks up one work item by ID, for pulling leftovers into the plan. */
  getPlanningItem(id: number): Promise<PlanningLookupItem>
  /** Estado da sprint corrente item a item, para a daily. */
  getDaily(selectionId: string, sprint: UnifiedSprint): Promise<DailyResult>

  /**
   * Nome e foto de quem é dono do PAT, segundo o próprio Azure DevOps. `null`
   * quando o Azure não responde com uma identidade — a tela cai para as iniciais.
   */
  getCurrentUser(): Promise<AzureUserProfile | null>

  // --- Descoberta no Azure (base do assistente de Configuração) -----------
  //
  // Só leitura. Funcionam sem Configuração válida: bastam o Perfil, a
  // organização escrita no arquivo e o PAT guardado. `project` é nome ou ID.

  /** Projetos que o PAT enxerga, com o processo e o time padrão de cada um. */
  discoverProjects(): Promise<DiscoveredProject[]>
  discoverTeams(project: string): Promise<DiscoveredTeam[]>
  /** Raiz da árvore de áreas do projeto, com os caminhos no formato da Configuração. */
  discoverAreas(project: string): Promise<DiscoveredArea>
  /** Tipos, estados com categoria e o Perfil de processo sugerido. */
  discoverProcess(project: string): Promise<ProcessDiscovery>
  /** Campos acrescentados pelo processo, para mapear em `customFields`. */
  discoverFields(project: string): Promise<DiscoveredField[]>

  // --- IA do PO (ADR 0007) ------------------------------------------------
  //
  // A janela manda IDs de itens e recebe o texto que o PO copia para a IA dele.
  // O app não executa IA nem fala com serviço de IA (RN-SEC-23, RN-SEC-24).

  /** O pedido do objetivo da sprint, já redigido, e os itens que vão nele. */
  buildSprintGoalRequest(
    selectionId: string,
    sprint: UnifiedSprint,
    itemIds: number[]
  ): Promise<SprintGoalRequest>
}

/**
 * What `window.api` actually exposes: the same methods, still wrapped in the
 * envelope. Unwrapping happens in the renderer, not the preload, because custom
 * error classes do not survive the contextBridge — plain data does.
 * Derived from `IpcApi` so the two can never drift.
 */
export type IpcBridge = {
  [K in keyof IpcApi]: (
    ...args: Parameters<IpcApi[K]>
  ) => Promise<IpcResult<Awaited<ReturnType<IpcApi[K]>>>>
} & IpcSubscriptions

export const IPC_CHANNELS = {
  hasPat: 'pat:has',
  savePat: 'pat:save',
  clearPat: 'pat:clear',
  getProfileState: 'profile:state',
  createProfile: 'profile:create',
  importConfig: 'profile:import-config',
  openProfileFolder: 'profile:open-folder',
  readWorkData: 'profile:work-data-read',
  writeWorkData: 'profile:work-data-write',
  startDemo: 'demo:start',
  restoreDemo: 'demo:restore',
  leaveDemo: 'demo:leave',
  getSprints: 'azure:sprints',
  getSprintDelivery: 'azure:sprint-delivery',
  getTeamPerformance: 'azure:team-performance',
  getBugAnalysis: 'azure:bug-analysis',
  getPlanning: 'azure:planning',
  getPlanningItem: 'azure:planning-item',
  getDaily: 'azure:daily',
  getCurrentUser: 'azure:current-user',
  discoverProjects: 'discovery:projects',
  discoverTeams: 'discovery:teams',
  discoverAreas: 'discovery:areas',
  discoverProcess: 'discovery:process',
  discoverFields: 'discovery:fields',
  buildSprintGoalRequest: 'ai:sprint-goal-request'
} as const satisfies Record<keyof IpcApi, string>

// --- Events (main → renderer) --------------------------------------------

/**
 * Pushes from the main process. Unlike `IpcApi`, these are not request/response:
 * the renderer subscribes and the main process sends whenever it needs to.
 */
export const IPC_EVENTS = {
  profileStateChanged: 'profile:state-changed'
} as const

/** Cada assinatura devolve a função que a cancela. */
export interface IpcSubscriptions {
  /** A Configuração mudou no disco, ou o Perfil ou o PAT mudaram. */
  onProfileStateChanged(listener: (state: ProfileState) => void): () => void
}
