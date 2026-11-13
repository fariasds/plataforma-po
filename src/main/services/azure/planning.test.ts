import { readFileSync } from 'fs'
import { resolve } from 'path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { UnifiedSprint } from '@shared/azure'
import { configurationSchema, type Configuration } from '@shared/config/schema'
import { AppError } from '@shared/errors'

// Planning contra respostas fictícias do Azure (organização `contoso`). O client
// é substituído: o teste vê exatamente o que o serviço pede e devolve o que o
// Azure devolveria, respeitando a lista de campos pedida.

let activeConfig: Configuration | null = null
vi.mock('../../profile/config-loader', () => ({ getActiveConfig: () => activeConfig }))

const postAzure = vi.fn<(path: string, body: { query: string }) => Promise<unknown>>()
const fetchAzure = vi.fn<(path: string) => Promise<unknown>>()
vi.mock('./client', () => ({
  postAzure: (path: string, body: { query: string }) => postAzure(path, body),
  fetchAzure: (path: string) => fetchAzure(path)
}))

const { getPlanningData, buildPlanningWiql } = await import('./planning')
const { getPlanningItem } = await import('./planning-item')
const { activeProduct } = await import('./scope')

const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(resolve('tests/fixtures/azure', name), 'utf8'))

interface RawItem {
  id: number
  fields: Record<string, unknown>
}
const WORK_ITEMS = (fixture('planning-workitems.json') as { value: RawItem[] }).value

/** O Azure só devolve os campos pedidos em `fields=`. */
function onlyRequested(item: RawItem, fields: string[]): RawItem {
  return {
    id: item.id,
    fields: Object.fromEntries(Object.entries(item.fields).filter(([k]) => fields.includes(k)))
  }
}

function fieldsOf(path: string): string[] {
  return new URL(path, 'https://dev.azure.com').searchParams.get('fields')!.split(',')
}

function fakeAzure(): void {
  postAzure.mockImplementation(async (_path, body) => {
    if (body.query.includes("UNDER 'Contoso\\Loja'")) return fixture('planning-wiql-loja.json')
    if (body.query.includes("UNDER 'Contoso\\App'")) return fixture('planning-wiql-app.json')
    return { workItems: [] }
  })
  fetchAzure.mockImplementation(async (path) => {
    const url = new URL(path, 'https://dev.azure.com')
    const fields = fieldsOf(path)
    const single = url.pathname.match(/workitems\/(\d+)$/)
    if (single) {
      const item = WORK_ITEMS.find((i) => i.id === Number(single[1]))!
      return onlyRequested(item, fields)
    }
    const ids = url.searchParams.get('ids')!.split(',').map(Number)
    return {
      value: WORK_ITEMS.filter((i) => ids.includes(i.id)).map((i) => onlyRequested(i, fields))
    }
  })
}

/** O exemplo fictício, com ajustes do caso de teste. */
function configWith(change: (raw: Record<string, unknown>) => void = () => {}): Configuration {
  const raw = JSON.parse(readFileSync(resolve('examples/exemplo-scrum.json'), 'utf8'))
  change(raw)
  return configurationSchema.parse(raw)
}

const WITH_EFFORT = (raw: Record<string, unknown>): void => {
  raw.customFields = {
    effortFrontend: 'Contoso.Frontend',
    effortBackend: 'Contoso.Backend',
    effortQa: 'Contoso.Qa'
  }
}

const SPRINT: UnifiedSprint = {
  key: '2026-10-05_2026-10-16',
  label: '05/10 – 16/10',
  startDate: '2026-10-05T00:00:00Z',
  finishDate: '2026-10-16T00:00:00Z',
  iterations: {
    loja: { id: 'i-loja', name: 'Sprint 7', path: 'Contoso\\Loja\\Sprint 7' },
    app: { id: 'i-app', name: 'Sprint 3', path: 'Contoso\\App\\Sprint 3' }
  }
}

beforeEach(() => {
  postAzure.mockReset()
  fetchAzure.mockReset()
  fakeAzure()
})

describe('Planning — Grupo com dois Produtos', () => {
  beforeEach(() => {
    activeConfig = configWith(WITH_EFFORT)
  })

  it('consulta cada Produto na sua iteração e soma os dois', async () => {
    const result = await getPlanningData('digital', SPRINT)

    expect(result.items.map((i) => [i.id, i.product])).toEqual([
      [301, 'loja'],
      [302, 'loja'],
      [401, 'app']
    ])
    expect(result.totals).toEqual({ frontend: 10, backend: 8, qa: 5, geral: 24 })

    const queries = postAzure.mock.calls.map(([, body]) => body.query)
    expect(queries[0]).toContain("[System.IterationPath] = 'Contoso\\Loja\\Sprint 7'")
    expect(queries[1]).toContain("[System.IterationPath] = 'Contoso\\App\\Sprint 3'")
  })

  it('a consulta usa os tipos planejáveis, os estados removidos e as áreas da Configuração', () => {
    const wiql = buildPlanningWiql(activeProduct('loja'), 'Contoso\\Loja\\Sprint 7')

    expect(wiql).toContain("[System.WorkItemType] IN ('Product Backlog Item')")
    expect(wiql).toContain("[System.State] NOT IN ('Removed')")
    expect(wiql).toContain("[System.TeamProject] = 'Contoso'")
    expect(wiql).toContain("AND ([System.AreaPath] UNDER 'Contoso\\Loja')")
    expect(wiql).toContain("AND NOT [System.AreaPath] UNDER 'Contoso\\Loja\\QA'")
  })

  it('Produto sem iteração na sprint não contribui', async () => {
    const onlyStore = { ...SPRINT, iterations: { loja: SPRINT.iterations.loja } }
    const result = await getPlanningData('digital', onlyStore)

    expect(postAzure).toHaveBeenCalledTimes(1)
    expect(result.items.every((i) => i.product === 'loja')).toBe(true)
  })

  it('lê os campos de esforço configurados e a estimativa do Perfil de processo', async () => {
    const { items } = await getPlanningData('loja', SPRINT)

    expect(items[0]).toMatchObject({ frontend: 3, backend: 5, qa: 2, total: 8, priority: 1 })
    // Campo pedido e ausente no item é "não estimado", não zero (RN-PLN-03).
    expect(items[1]).toMatchObject({ frontend: 2, backend: null, qa: null, total: 3 })
  })

  it('seleção desconhecida é erro, nunca lista vazia', async () => {
    await expect(getPlanningData('nao-existe', SPRINT)).rejects.toThrow(AppError)
  })

  it('texto com aspas não quebra a consulta', () => {
    const wiql = buildPlanningWiql(activeProduct('loja'), "Contoso\\Loja\\Sprint d'Oeste")
    expect(wiql).toContain("= 'Contoso\\Loja\\Sprint d''Oeste'")
  })
})

describe('Planning — Produto sem campos de esforço', () => {
  beforeEach(() => {
    activeConfig = configWith()
  })

  it('não pede campo de esforço ao Azure e devolve as partes vazias', async () => {
    const { items, totals } = await getPlanningData('loja', SPRINT)

    const requested = fieldsOf(fetchAzure.mock.calls[0][0])
    expect(requested.some((f) => f.startsWith('Contoso.'))).toBe(false)
    expect(requested).toContain('Microsoft.VSTS.Scheduling.Effort')

    expect(items.map((i) => [i.frontend, i.backend, i.qa])).toEqual([
      [null, null, null],
      [null, null, null]
    ])
    expect(totals).toEqual({ frontend: 0, backend: 0, qa: 0, geral: 11 })
  })
})

describe('Item remanescente', () => {
  beforeEach(() => {
    activeConfig = configWith(WITH_EFFORT)
  })

  it('acha o Produto pela área, mesmo com dois Produtos no mesmo projeto', async () => {
    await expect(getPlanningItem(401)).resolves.toMatchObject({
      id: 401,
      product: 'app',
      frontend: 5,
      backend: 3,
      qa: 3
    })
    await expect(getPlanningItem(302)).resolves.toMatchObject({ product: 'loja' })
  })

  it('item em área excluída é recusado, com os Produtos configurados na mensagem', async () => {
    await expect(getPlanningItem(501)).rejects.toThrow(/Loja Online, App Mobile/)
  })

  it('sem campos de esforço, as partes chegam vazias', async () => {
    activeConfig = configWith()
    await expect(getPlanningItem(301)).resolves.toMatchObject({
      frontend: null,
      backend: null,
      qa: null
    })
  })
})
