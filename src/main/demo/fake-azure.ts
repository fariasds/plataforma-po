import { AppError } from '@shared/errors'
import { contentHash } from '@shared/flow-catalog'
import { runWiql } from './wiql'
import type { AzureState, FakeField, FakeIteration, FakeProject, FakeWorkItem } from './types'

/**
 * Azure DevOps fictício: recebe exatamente o que `services/azure/client.ts`
 * receberia (rota, corpo) e responde no formato da API real, a partir do estado
 * de um Cenário.
 *
 * As rotas são as do inventário da T-23 e nenhuma outra. **Pedido desconhecido
 * falha alto**, com a rota no erro: quando um serviço passar a pedir algo novo,
 * a regressão quebra até alguém ensinar o Azure fictício. Como alguns serviços
 * engolem a falha de uma rota (o histórico de bug, por exemplo, vira lista
 * vazia), todo erro também fica em `errors`, e a regressão exige a lista vazia.
 *
 * Lógica pura: sem rede, sem disco, sem Electron e sem PAT.
 */

export class UnknownAzureRequestError extends Error {
  constructor(detail: string) {
    super(`Azure fictício: ${detail}`)
    this.name = 'UnknownAzureRequestError'
  }
}

/** Campos que todo projeto tem, com o tipo que a rota de campos devolve. */
const STANDARD_FIELDS: FakeField[] = [
  ['ID', 'System.Id', 'integer'],
  ['Title', 'System.Title', 'string'],
  ['State', 'System.State', 'string'],
  ['Work Item Type', 'System.WorkItemType', 'string'],
  ['Iteration Path', 'System.IterationPath', 'treePath'],
  ['Area Path', 'System.AreaPath', 'treePath'],
  ['Team Project', 'System.TeamProject', 'string'],
  ['Created Date', 'System.CreatedDate', 'dateTime'],
  ['Changed Date', 'System.ChangedDate', 'dateTime'],
  ['Assigned To', 'System.AssignedTo', 'identity'],
  ['Parent', 'System.Parent', 'integer'],
  ['Description', 'System.Description', 'html'],
  ['Closed Date', 'Microsoft.VSTS.Common.ClosedDate', 'dateTime'],
  ['State Change Date', 'Microsoft.VSTS.Common.StateChangeDate', 'dateTime'],
  ['Priority', 'Microsoft.VSTS.Common.Priority', 'integer'],
  ['Due Date', 'Microsoft.VSTS.Scheduling.DueDate', 'dateTime'],
  ['Effort', 'Microsoft.VSTS.Scheduling.Effort', 'double'],
  ['Story Points', 'Microsoft.VSTS.Scheduling.StoryPoints', 'double'],
  ['Size', 'Microsoft.VSTS.Scheduling.Size', 'double']
].map(([name, referenceName, type]) => ({ name, referenceName, type }))

const API = '7.1'
const GRAPH_API = '7.1-preview.1'
/** O Azure recusa mais que isso numa leitura em lote. */
const MAX_BATCH = 200

/** Avatar fictício: um PNG de 1×1 transparente, igual para todos. */
const AVATAR_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='

export interface FakeAzureCall {
  method: 'GET' | 'POST' | 'PUT' | 'GRAPH' | 'AVATAR'
  path: string
}

export interface FakeAzure {
  /** Todo pedido recebido, na ordem. */
  calls: FakeAzureCall[]
  /** Todo pedido que o Azure fictício recusou, mesmo que o serviço tenha engolido o erro. */
  errors: string[]
  fetchAzure<T>(path: string): Promise<T>
  postAzure<T>(path: string, body: unknown): Promise<T>
  fetchGraph<T>(path: string): Promise<{ body: T; continuation: string | null }>
  fetchAzureAvatar(url: string): Promise<string | null>
  fetchAvatarByDescriptor(descriptor: string): Promise<string | null>
  /** A página com o ETag (o resumo do conteúdo), ou `null` se ela não existe. */
  fetchWikiPage(path: string): Promise<{ content: string; etag: string | null } | null>
  /** Grava a página; com ETag diferente do atual, recusa como o Azure (412). */
  putWikiPage(path: string, content: string, etag: string | null): Promise<void>
}

// ─── Leitura do pedido ───────────────────────────────────────────────────────

interface ParsedPath {
  segments: string[]
  query: URLSearchParams
}

function parsePath(path: string): ParsedPath {
  if (!path.startsWith('/')) throw new UnknownAzureRequestError(`rota sem barra inicial: ${path}`)
  const [pathname, search = ''] = path.split('?')
  return {
    segments: pathname.split('/').slice(1).map(decodeURIComponent),
    query: new URLSearchParams(search)
  }
}

/** Confere a versão e recusa parâmetro que a rota não conhece. */
function checkQuery(
  path: string,
  query: URLSearchParams,
  allowed: readonly string[],
  version = API
): void {
  if (query.get('api-version') !== version) {
    throw new UnknownAzureRequestError(`api-version diferente de ${version} em ${path}`)
  }
  for (const key of query.keys()) {
    if (key !== 'api-version' && !allowed.includes(key)) {
      throw new UnknownAzureRequestError(`parâmetro "${key}" não previsto em ${path}`)
    }
  }
}

function matches(segments: string[], pattern: readonly (string | null)[]): string[] | null {
  if (segments.length !== pattern.length) return null
  const captured: string[] = []
  for (let i = 0; i < pattern.length; i++) {
    if (pattern[i] === null) captured.push(segments[i])
    else if (pattern[i] !== segments[i]) return null
  }
  return captured
}

// ─── Respostas ───────────────────────────────────────────────────────────────

interface ClassificationNode {
  identifier: string
  name: string
  path: string
  attributes?: { startDate: string; finishDate: string }
  children?: ClassificationNode[]
}

/**
 * Árvore como a rota de classification nodes devolve: o caminho do nó tem o grupo
 * da estrutura (`\Contoso\Iteration\Loja`), que o serviço tira.
 */
function classificationTree(
  project: string,
  structure: 'Iteration' | 'Area',
  paths: readonly string[],
  leaves: ReadonlyMap<string, FakeIteration> = new Map()
): ClassificationNode {
  const root: ClassificationNode = {
    identifier: `${structure.toLowerCase()}-${project}`,
    name: project,
    path: `\\${project}\\${structure}`
  }
  for (const full of paths) {
    const parts = full.split('\\')
    if (parts[0].toLowerCase() !== project.toLowerCase()) {
      throw new UnknownAzureRequestError(`caminho "${full}" fora do projeto ${project}`)
    }
    let node = root
    for (let i = 1; i < parts.length; i++) {
      node.children ??= []
      let child = node.children.find((c) => c.name === parts[i])
      if (!child) {
        child = {
          identifier: `${structure.toLowerCase()}-${parts.slice(0, i + 1).join('-')}`,
          name: parts[i],
          path: `${node.path}\\${parts[i]}`
        }
        node.children.push(child)
      }
      node = child
    }
    const leaf = leaves.get(full)
    if (leaf) {
      node.identifier = leaf.id
      node.attributes = { startDate: leaf.startDate, finishDate: leaf.finishDate }
    }
  }
  return root
}

function pick(item: FakeWorkItem, fields: string[]): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const field of fields) {
    // O Azure omite o campo vazio em vez de mandar `null`.
    const value = field === 'System.Id' ? item.id : item.fields[field]
    if (value !== undefined && value !== null && value !== '') result[field] = value
  }
  return result
}

function page<T>(all: T[], query: URLSearchParams): { count: number; value: T[] } {
  const top = Number(query.get('$top') ?? all.length)
  const skip = Number(query.get('$skip') ?? 0)
  const value = all.slice(skip, skip + top)
  return { count: value.length, value }
}

// ─── Roteador ────────────────────────────────────────────────────────────────

export function createFakeAzure(state: AzureState): FakeAzure {
  const calls: FakeAzureCall[] = []
  const errors: string[] = []
  const byId = new Map(state.workItems.map((item) => [item.id, item]))
  // Cópia: a publicação grava aqui, e o Cenário (constante do módulo) fica intacto.
  const wikis = structuredClone(state.wikis ?? [])

  function project(name: string): FakeProject {
    const found = state.projects.find(
      (p) => p.name.toLowerCase() === name.toLowerCase() || p.id === name
    )
    if (!found) throw new UnknownAzureRequestError(`projeto "${name}" não existe`)
    return found
  }

  /** Campos que existem: os padrão mais os customizados do projeto, ou de todos. */
  function knownFields(scope: FakeProject | null): Set<string> {
    const custom = (scope ? [scope] : state.projects).flatMap((p) => p.customFields)
    return new Set([...STANDARD_FIELDS, ...custom].map((f) => f.referenceName.toLowerCase()))
  }

  function requestedFields(raw: string | null, scope: FakeProject | null, path: string): string[] {
    if (!raw) throw new UnknownAzureRequestError(`leitura de itens sem "fields" em ${path}`)
    const fields = raw.split(',')
    const known = knownFields(scope)
    const unknown = fields.filter((f) => !known.has(f.toLowerCase()))
    // O Azure real recusa a requisição inteira (400) por um campo só.
    if (unknown.length > 0) {
      throw new UnknownAzureRequestError(`campo inexistente ${unknown.join(', ')} em ${path}`)
    }
    return fields
  }

  function item(id: number, path: string): FakeWorkItem {
    const found = byId.get(id)
    if (!found) throw new UnknownAzureRequestError(`work item ${id} não existe (${path})`)
    return found
  }

  const workItemUrl = (id: number): string =>
    `https://dev.azure.com/${state.organization}/_apis/wit/workItems/${id}`

  /** Pai, filhos e "Related" do item, como o `$expand=relations` do Azure devolve. */
  function relationsOf(found: FakeWorkItem): unknown[] {
    const relation = (rel: string, id: number): unknown => ({
      rel,
      url: workItemUrl(id),
      attributes: { isLocked: false }
    })
    const parent = found.fields['System.Parent']
    const children = state.workItems.filter((w) => w.fields['System.Parent'] === found.id)
    const related = new Set([
      ...(found.related ?? []),
      ...state.workItems.filter((w) => w.related?.includes(found.id)).map((w) => w.id)
    ])
    return [
      ...(typeof parent === 'number'
        ? [relation('System.LinkTypes.Hierarchy-Reverse', parent)]
        : []),
      ...children.map((child) => relation('System.LinkTypes.Hierarchy-Forward', child.id)),
      ...[...related].map((id) => relation('System.LinkTypes.Related', id))
    ]
  }

  function workItemsBatch(
    path: string,
    query: URLSearchParams,
    scope: FakeProject | null
  ): unknown {
    checkQuery(path, query, ['ids', 'fields', 'errorPolicy', '$expand'])
    const expand = query.get('$expand')
    if (expand !== null) {
      // O Azure real recusa "fields" junto com "$expand": com ele, vêm todos os campos.
      if (expand !== 'relations')
        throw new UnknownAzureRequestError(`$expand "${expand}" não previsto`)
      if (query.has('fields')) {
        throw new UnknownAzureRequestError(`"fields" junto com "$expand" em ${path}`)
      }
    }
    const ids = (query.get('ids') ?? '').split(',').map(Number)
    if (ids.length === 0 || ids.some((id) => !Number.isSafeInteger(id) || id <= 0)) {
      throw new UnknownAzureRequestError(`lista de IDs inválida em ${path}`)
    }
    if (ids.length > MAX_BATCH) {
      throw new UnknownAzureRequestError(`${ids.length} IDs numa leitura só (máximo ${MAX_BATCH})`)
    }
    const omit = query.get('errorPolicy')
    if (omit !== null && omit !== 'omit') {
      throw new UnknownAzureRequestError(`errorPolicy "${omit}" não previsto`)
    }
    const fields = expand ? null : requestedFields(query.get('fields'), scope, path)
    const value = ids.map((id) => {
      const found = byId.get(id)
      if (!found) {
        if (omit) return null
        throw new UnknownAzureRequestError(`work item ${id} não existe (${path})`)
      }
      if (!fields) {
        const all = pick(found, ['System.Id', ...Object.keys(found.fields)])
        return { id, rev: found.updates.length, fields: all, relations: relationsOf(found) }
      }
      return { id, rev: found.updates.length, fields: pick(found, fields) }
    })
    return { count: value.length, value }
  }

  function updates(id: string, path: string, query: URLSearchParams): unknown {
    checkQuery(path, query, [])
    const found = item(Number(id), path)
    return { count: found.updates.length, value: found.updates }
  }

  function wikiPage(projectName: string, wikiName: string, query: URLSearchParams): unknown {
    project(projectName)
    const wiki = wikis.find(
      (w) =>
        w.name.toLowerCase() === wikiName.toLowerCase() &&
        w.project.toLowerCase() === projectName.toLowerCase()
    )
    if (!wiki) throw new UnknownAzureRequestError(`wiki "${wikiName}" não existe em ${projectName}`)
    const pagePath = query.get('path') ?? '/'
    const recursion = query.get('recursionLevel')
    const withContent = query.get('includeContent') === 'true'
    const under = (p: string, root: string): boolean =>
      root === '/' || p === root || p.startsWith(`${root}/`)
    const exists = wiki.pages.some((p) => under(p.path, pagePath))
    if (!exists)
      throw new UnknownAzureRequestError(`página "${pagePath}" não existe na wiki ${wikiName}`)
    // Página "pai" sem conteúdo próprio existe na árvore do Azure mesmo sem estar na lista.
    const build = (p: string, depth: number): unknown => {
      const own = wiki.pages.find((page) => page.path === p)
      const children = [
        ...new Set(
          wiki.pages
            .filter((page) => page.path.startsWith(`${p === '/' ? '' : p}/`))
            .map((page) => {
              const rest = page.path.slice((p === '/' ? '' : p).length + 1).split('/')[0]
              return `${p === '/' ? '' : p}/${rest}`
            })
        )
      ].sort()
      const node: Record<string, unknown> = {
        path: p,
        order: 0,
        isParentPage: children.length > 0,
        gitItemPath: `${p.replace(/ /g, '-')}.md`,
        url: `https://dev.azure.com/${state.organization}/${projectName}/_apis/wiki/wikis/${wikiName}/pages${p}`
      }
      if (withContent && depth === 0) node.content = own?.content ?? ''
      if (recursion === 'full' || (recursion === 'oneLevel' && depth === 0)) {
        node.subPages = children.map((child) => build(child, depth + 1))
      }
      return node
    }
    if (recursion !== null && recursion !== 'full' && recursion !== 'oneLevel') {
      throw new UnknownAzureRequestError(`recursionLevel "${recursion}" não previsto`)
    }
    return build(pagePath, 0)
  }

  function processType(
    p: FakeProject,
    name: string,
    path: string
  ): FakeProject['process']['types'][number] {
    const type = p.process.types.find((t) => t.name.toLowerCase() === name.toLowerCase())
    if (!type) throw new UnknownAzureRequestError(`tipo "${name}" não existe em ${path}`)
    return type
  }

  function categories(p: FakeProject): unknown {
    const { requirement, bug, task, hidden } = p.process.categories
    const category = (referenceName: string, names: string[]): unknown => ({
      referenceName,
      name: referenceName.replace('Microsoft.', '').replace('Category', ''),
      defaultWorkItemType: names[0] ? { name: names[0] } : null,
      workItemTypes: names.map((name) => ({ name }))
    })
    const value = [
      category('Microsoft.RequirementCategory', requirement),
      category('Microsoft.BugCategory', bug ? [bug] : []),
      category('Microsoft.TaskCategory', task ? [task] : []),
      category('Microsoft.HiddenCategory', hidden)
    ]
    return { count: value.length, value }
  }

  function get(path: string): unknown {
    const { segments, query } = parsePath(path)
    let m: string[] | null

    // Organização
    if (matches(segments, ['_apis', 'connectionData'])) {
      if ([...query.keys()].length > 0) throw new UnknownAzureRequestError(`parâmetro em ${path}`)
      const { user } = state
      return {
        authenticatedUser: {
          id: user.id,
          providerDisplayName: user.displayName,
          subjectDescriptor: user.descriptor
        }
      }
    }
    if (matches(segments, ['_apis', 'projects'])) {
      checkQuery(path, query, ['$top', '$skip'])
      return page(
        state.projects.map(({ id, name }) => ({ id, name, state: 'wellFormed' })),
        query
      )
    }
    if ((m = matches(segments, ['_apis', 'projects', null]))) {
      checkQuery(path, query, ['includeCapabilities'])
      const p = project(m[0])
      return {
        id: p.id,
        name: p.name,
        capabilities: { processTemplate: { templateName: p.process.templateName } },
        defaultTeam: { name: p.defaultTeam }
      }
    }
    if ((m = matches(segments, ['_apis', 'projects', null, 'teams']))) {
      checkQuery(path, query, ['$top', '$skip'])
      return page(
        project(m[0]).teams.map(({ id, name }) => ({ id, name })),
        query
      )
    }

    // Work items
    if (matches(segments, ['_apis', 'wit', 'workitems'])) return workItemsBatch(path, query, null)
    if ((m = matches(segments, [null, '_apis', 'wit', 'workitems']))) {
      return workItemsBatch(path, query, project(m[0]))
    }
    if ((m = matches(segments, ['_apis', 'wit', 'workitems', null, 'updates']))) {
      return updates(m[0], path, query)
    }
    if ((m = matches(segments, [null, '_apis', 'wit', 'workitems', null, 'updates']))) {
      project(m[0])
      return updates(m[1], path, query)
    }
    if ((m = matches(segments, ['_apis', 'wit', 'workitems', null]))) {
      checkQuery(path, query, ['fields'])
      const found = item(Number(m[0]), path)
      return {
        id: found.id,
        rev: found.updates.length,
        fields: pick(found, requestedFields(query.get('fields'), null, path))
      }
    }

    // Wiki: a árvore de páginas e o conteúdo de uma página.
    if ((m = matches(segments, [null, '_apis', 'wiki', 'wikis', null, 'pages']))) {
      checkQuery(path, query, ['path', 'recursionLevel', 'includeContent'])
      return wikiPage(m[0], m[1], query)
    }

    // Projeto: campos, processo e árvores
    if ((m = matches(segments, [null, '_apis', 'wit', 'fields']))) {
      checkQuery(path, query, [])
      const value = [...STANDARD_FIELDS, ...project(m[0]).customFields]
      return { count: value.length, value }
    }
    if ((m = matches(segments, [null, '_apis', 'wit', 'workitemtypes']))) {
      checkQuery(path, query, [])
      const value = project(m[0]).process.types.map((t) => ({
        name: t.name,
        referenceName: t.referenceName,
        isDisabled: t.disabled ?? false,
        fields: t.fields.map((referenceName) => ({ referenceName }))
      }))
      return { count: value.length, value }
    }
    if ((m = matches(segments, [null, '_apis', 'wit', 'workitemtypecategories']))) {
      checkQuery(path, query, [])
      return categories(project(m[0]))
    }
    if ((m = matches(segments, [null, '_apis', 'wit', 'workitemtypes', null, 'states']))) {
      checkQuery(path, query, [])
      const value = processType(project(m[0]), m[1], path).states
      return { count: value.length, value }
    }
    if ((m = matches(segments, [null, '_apis', 'wit', 'classificationnodes', 'areas']))) {
      checkQuery(path, query, ['$depth'])
      const p = project(m[0])
      return classificationTree(p.name, 'Area', p.areas)
    }
    if ((m = matches(segments, [null, '_apis', 'wit', 'classificationnodes', 'iterations']))) {
      checkQuery(path, query, ['$depth'])
      const p = project(m[0])
      return classificationTree(
        p.name,
        'Iteration',
        p.iterations.map((it) => it.path),
        new Map(p.iterations.map((it) => [it.path, it]))
      )
    }
    if ((m = matches(segments, [null, null, '_apis', 'work', 'teamsettings', 'iterations']))) {
      checkQuery(path, query, [])
      const p = project(m[0])
      const team = p.teams.find((t) => t.name.toLowerCase() === m![1].toLowerCase())
      if (!team) throw new UnknownAzureRequestError(`time "${m[1]}" não existe em ${p.name}`)
      const value = p.iterations
        .filter((it) => team.iterationIds.includes(it.id))
        .map((it) => ({
          id: it.id,
          name: it.name,
          path: it.path,
          attributes: { startDate: it.startDate, finishDate: it.finishDate }
        }))
      return { count: value.length, value }
    }

    throw new UnknownAzureRequestError(`GET não previsto: ${path}`)
  }

  function post(path: string, body: unknown): unknown {
    const { segments, query } = parsePath(path)
    const m = matches(segments, [null, '_apis', 'wit', 'wiql'])
    if (!m) throw new UnknownAzureRequestError(`POST não previsto: ${path}`)
    checkQuery(path, query, [])
    project(m[0])
    const text = (body as { query?: unknown } | null)?.query
    if (typeof text !== 'string') throw new UnknownAzureRequestError(`WIQL sem "query" em ${path}`)
    const workItems = runWiql(text, state.workItems).map((id) => ({
      id,
      url: `https://dev.azure.com/${state.organization}/_apis/wit/workItems/${id}`
    }))
    return { queryType: 'flat', workItems }
  }

  function graph(path: string): unknown {
    const { segments, query } = parsePath(path)
    const m = matches(segments, ['_apis', 'graph', 'descriptors', null])
    if (!m) throw new UnknownAzureRequestError(`Graph não previsto: ${path}`)
    checkQuery(path, query, [], GRAPH_API)
    if (m[0] !== state.user.id) throw new UnknownAzureRequestError(`identidade ${m[0]} não existe`)
    return { value: state.user.descriptor }
  }

  /** A página de wiki que a rota pede, para ler com ETag ou para gravar. */
  function wikiTarget(
    path: string,
    allowed: readonly string[]
  ): {
    wiki: (typeof wikis)[number]
    path: string
    existing: { path: string; content: string } | undefined
  } {
    const { segments, query } = parsePath(path)
    const m = matches(segments, [null, '_apis', 'wiki', 'wikis', null, 'pages'])
    if (!m) throw new UnknownAzureRequestError(`rota de página não prevista: ${path}`)
    checkQuery(path, query, allowed)
    project(m[0])
    const wiki = wikis.find(
      (w) =>
        w.name.toLowerCase() === m[1].toLowerCase() &&
        w.project.toLowerCase() === m[0].toLowerCase()
    )
    if (!wiki) throw new UnknownAzureRequestError(`wiki "${m[1]}" não existe em ${m[0]}`)
    const pagePath = query.get('path') ?? ''
    return { wiki, path: pagePath, existing: wiki.pages.find((p) => p.path === pagePath) }
  }

  /** Registra, e só então lança: o serviço pode engolir, a lista não esquece. */
  function guard<T>(call: FakeAzureCall, task: () => unknown): Promise<T> {
    calls.push(call)
    try {
      // Cópia: o serviço não pode alterar o estado do Cenário por referência.
      return Promise.resolve(structuredClone(task()) as T)
    } catch (error) {
      errors.push(`${call.method} ${call.path}: ${error instanceof Error ? error.message : error}`)
      return Promise.reject(error)
    }
  }

  const avatar = `data:image/png;base64,${AVATAR_PNG}`

  return {
    calls,
    errors,
    fetchAzure: (path) => guard({ method: 'GET', path }, () => get(path)),
    postAzure: (path, body) => guard({ method: 'POST', path }, () => post(path, body)),
    fetchGraph: (path) =>
      guard({ method: 'GRAPH', path }, () => ({ body: graph(path), continuation: null })),
    fetchAzureAvatar: (url) =>
      guard({ method: 'AVATAR', path: url }, () => {
        const prefix = `https://dev.azure.com/${state.organization}/_apis/GraphProfile/MemberAvatars/`
        if (!url.startsWith(prefix))
          throw new UnknownAzureRequestError(`avatar fora da organização: ${url}`)
        return avatar
      }),
    fetchWikiPage: (path) =>
      guard({ method: 'GET', path }, () => {
        const page = wikiTarget(path, ['path', 'includeContent'])
        return page.existing
          ? { content: page.existing.content, etag: `"${contentHash(page.existing.content)}"` }
          : null
      }),
    putWikiPage: (path, content, etag) =>
      guard({ method: 'PUT', path }, () => {
        const page = wikiTarget(path, ['path'])
        const current = page.existing ? `"${contentHash(page.existing.content)}"` : null
        if (current !== etag) {
          throw new AppError(
            'CATALOG_CONFLICT',
            `A página ${page.path} mudou na wiki: absorva de novo.`
          )
        }
        if (page.existing) page.existing.content = content
        else page.wiki.pages.push({ path: page.path, content })
        return undefined
      }),
    fetchAvatarByDescriptor: (descriptor) =>
      guard({ method: 'AVATAR', path: descriptor }, () => {
        if (descriptor !== state.user.descriptor) {
          throw new UnknownAzureRequestError(`descriptor ${descriptor} não existe`)
        }
        return avatar
      })
  }
}
