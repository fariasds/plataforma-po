import { readdirSync, readFileSync } from 'fs'
import { extname, join, resolve } from 'path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  MAX_GOAL_DESCRIPTIONS_TOTAL_CHARS,
  MAX_GOAL_DESCRIPTION_CHARS,
  SPRINT_GOAL_INSTRUCTION,
  buildSprintGoalInput,
  descriptionBudget,
  htmlToText,
  pickGoalItem
} from '@shared/ai'
import type { UnifiedSprint } from '@shared/azure'
import { IPC_CHANNELS } from '@shared/ipc'
import { resetElectronMock } from '../helpers/electron-mock'

// RN-SEC-24: só os campos permitidos vão no pedido que o PO copia para a IA
// dele, redigidos e com prévia. A janela manda só IDs. Dados fictícios:
// organização `contoso`, Produto "Loja Online".

vi.mock('electron', async () => (await import('../helpers/electron-mock')).electronMock)

const { getPlanningData, fetchDescriptions } = vi.hoisted(() => ({
  getPlanningData: vi.fn(),
  fetchDescriptions: vi.fn()
}))
vi.mock('../../src/main/services/azure/planning', () => ({ getPlanningData }))
vi.mock('../../src/main/services/azure/descriptions', () => ({ fetchDescriptions }))
vi.mock('../../src/main/services/azure/scope', () => ({
  activeScope: () => ({ products: [{ id: 'loja', name: 'Loja Online' }] })
}))

const store = await import('../../src/main/profile/profile-store')
const { rememberSecret, REDACTED } = await import('../../src/main/security/redact')
const { buildSprintGoalRequest } = await import('../../src/main/services/ai/sprint-goal')

const ROOT = resolve(__dirname, '../..')

const SPRINT: UnifiedSprint = {
  key: '2026-10-05',
  label: 'Sprint 42',
  startDate: '2026-10-05',
  finishDate: '2026-10-16',
  iterations: {}
}

/** Um item como o Azure devolveria, com tudo o que NÃO pode sair. */
const RICH_ITEM = {
  id: 101,
  title: 'Checkout com Pix parcelado',
  state: 'Approved',
  product: 'loja',
  priority: 1,
  frontend: 5,
  backend: 8,
  qa: 3,
  total: 16,
  internalNote: 'Detalhe interno do cliente Fabrikam',
  assignedTo: 'Ana Souza <ana@contoso.example>',
  comments: ['conversa interna']
}

/** A descrição como o Azure guarda: HTML, com o que não deve seguir adiante. */
const DESCRIPTION_HTML =
  '<div>Como cliente, quero parcelar no Pix.</div><ul><li>Até 6 parcelas</li><li>Mínimo de R$&nbsp;50</li></ul>' +
  '<script>alert("x")</script><img src="https://evil.example/pixel.png"><a href="https://evil.example/doc">anexo</a>'
const DESCRIPTION_TEXT =
  'Como cliente, quero parcelar no Pix.\n- Até 6 parcelas\n- Mínimo de R$ 50\nanexo'

// Tokens falsos montados em tempo de execução: o arquivo não tem forma de token,
// e o hook de pre-commit (RN-SEC-28) não o barra.
const FAKE_AZURE_PAT = 'q'.repeat(26) + '2'.repeat(26)
const FAKE_NEW_AZURE_PAT = 'A'.repeat(76) + 'AZDO' + 'B1c2'
const FAKE_GITHUB = 'gh' + 'p_' + 'X'.repeat(36)
const FAKE_GITHUB_FINE = 'github' + '_pat_' + 'Y'.repeat(62)
const FAKE_BASIC = 'Basic ' + Buffer.from(':segredo-de-teste-contoso').toString('base64')
/** O PAT do Perfil ativo não tem forma conhecida: só a rede do valor conhecido o pega. */
const PROFILE_PAT = ['contoso', 'perfil', 'Z'.repeat(20)].join('-')

beforeEach(() => {
  resetElectronMock()
  getPlanningData.mockReset()
  getPlanningData.mockResolvedValue({ items: [RICH_ITEM] })
  fetchDescriptions.mockReset()
  fetchDescriptions.mockResolvedValue(new Map([[101, DESCRIPTION_HTML]]))
  store.createProfile({ name: 'Contoso', organization: 'contoso' })
})

describe('RN-SEC-24: só os campos permitidos vão no pedido', () => {
  it('um item cheio vira seis campos', () => {
    const picked = pickGoalItem(RICH_ITEM, 'Loja Online', DESCRIPTION_TEXT)
    expect(Object.keys(picked).sort()).toEqual([
      'description',
      'id',
      'priority',
      'product',
      'state',
      'title'
    ])
  })

  it('o pedido não carrega pessoa, comentário, pontos nem campo desconhecido', async () => {
    const { text, items } = await buildSprintGoalRequest('loja', SPRINT, [101])
    const json = text.slice(text.indexOf('['))
    expect(JSON.parse(json)).toEqual([
      {
        id: 101,
        titulo: 'Checkout com Pix parcelado',
        estado: 'Approved',
        produto: 'Loja Online',
        prioridade: 1,
        descricao: DESCRIPTION_TEXT
      }
    ])
    expect(items).toEqual([pickGoalItem(RICH_ITEM, 'Loja Online', DESCRIPTION_TEXT)])
    expect(text).not.toMatch(/Fabrikam|Ana Souza|contoso\.example|conversa interna/)
  })

  it('o texto copiado é exatamente a instrução e os itens que a prévia mostra', async () => {
    const { text, items } = await buildSprintGoalRequest('loja', SPRINT, [101])
    expect(text).toBe(
      `${SPRINT_GOAL_INSTRUCTION}\n\nItens (JSON):\n${buildSprintGoalInput(items)}\n`
    )
  })

  it('o que não está na sprint fica fora, e a prévia diz quantos', async () => {
    const { items, missingIds } = await buildSprintGoalRequest('loja', SPRINT, [101, 999])
    expect(items.map((item) => item.id)).toEqual([101])
    expect(missingIds).toEqual([999])
  })

  it('da descrição vai só o texto: sem marcação, script, nem endereço de link ou imagem', async () => {
    const [item] = (await buildSprintGoalRequest('loja', SPRINT, [101])).items
    expect(item.description).toBe(DESCRIPTION_TEXT)
    expect(item.description).not.toMatch(/<|>|alert|evil\.example/)
  })

  it('a descrição só é buscada para os itens que vão no pedido', async () => {
    await buildSprintGoalRequest('loja', SPRINT, [101, 999])
    expect(fetchDescriptions).toHaveBeenCalledExactlyOnceWith([101])
  })

  it('descrição enorme é cortada no limite por item', () => {
    expect(htmlToText('x'.repeat(50_000), MAX_GOAL_DESCRIPTION_CHARS)).toHaveLength(
      MAX_GOAL_DESCRIPTION_CHARS
    )
    // Com muitos itens, cada um recebe uma fatia para o pedido inteiro caber no teto.
    expect(descriptionBudget(300) * 300).toBeLessThanOrEqual(MAX_GOAL_DESCRIPTIONS_TOTAL_CHARS)
    expect(descriptionBudget(4)).toBe(MAX_GOAL_DESCRIPTION_CHARS)
  })

  it('a janela manda só IDs: lista vazia, ID inválido ou texto são recusados', async () => {
    for (const ids of [[], [0], [-1], [1.5], ['101'], [{ title: 'texto livre' }]]) {
      await expect(buildSprintGoalRequest('loja', SPRINT, ids as number[])).rejects.toMatchObject({
        code: 'AI_INVALID_REQUEST'
      })
    }
    expect(getPlanningData).not.toHaveBeenCalled()
  })
})

describe('RN-SEC-24: credencial dentro do conteúdo sai redigida', () => {
  it.each([
    ['PAT clássico do Azure', FAKE_AZURE_PAT],
    ['PAT novo do Azure', FAKE_NEW_AZURE_PAT],
    ['token do GitHub', FAKE_GITHUB],
    ['token granular do GitHub', FAKE_GITHUB_FINE],
    ['cabeçalho Basic', FAKE_BASIC]
  ])('%s no título e na descrição', async (_case, secret) => {
    getPlanningData.mockResolvedValue({
      items: [{ ...RICH_ITEM, title: `Ajustar integração ${secret}` }]
    })
    fetchDescriptions.mockResolvedValue(new Map([[101, `<p>Use o token ${secret} no teste.</p>`]]))

    const { text, items } = await buildSprintGoalRequest('loja', SPRINT, [101])
    expect(text).not.toContain(secret)
    expect(JSON.stringify(items)).not.toContain(secret)
    expect(items[0].title).toContain(REDACTED)
    expect(items[0].description).toContain(REDACTED)
  })

  it('o valor de um Authorization: sai, o rótulo fica', async () => {
    fetchDescriptions.mockResolvedValue(
      new Map([[101, `<p>${'Author' + 'ization'}: segredo-de-teste-contoso</p>`]])
    )
    const { text } = await buildSprintGoalRequest('loja', SPRINT, [101])
    expect(text).not.toContain('segredo-de-teste-contoso')
    expect(text).toContain(`Authorization: ${REDACTED}`)
  })

  it('o PAT do Perfil ativo sai, cru e em base64, mesmo sem forma conhecida', async () => {
    // É o que o cliente do Azure faz a cada chamada (RN-SEC-19).
    rememberSecret(PROFILE_PAT)
    const encoded = Buffer.from(`:${PROFILE_PAT}`).toString('base64')
    getPlanningData.mockResolvedValue({ items: [{ ...RICH_ITEM, title: `Teste ${PROFILE_PAT}` }] })
    fetchDescriptions.mockResolvedValue(new Map([[101, `<p>Cabeçalho ${encoded}</p>`]]))

    const { text } = await buildSprintGoalRequest('loja', SPRINT, [101])
    expect(text).not.toContain(PROFILE_PAT)
    expect(text).not.toContain(encoded)
  })

  it('um token escrito com entidade HTML não escapa: a redação vem depois da conversão', async () => {
    const entity = FAKE_GITHUB.replace('_', '&#95;')
    fetchDescriptions.mockResolvedValue(new Map([[101, `<p>${entity}</p>`]]))

    const { text, items } = await buildSprintGoalRequest('loja', SPRINT, [101])
    expect(text).not.toContain(FAKE_GITHUB)
    expect(items[0].description).toBe(REDACTED)
  })
})

describe('RN-SEC-24: o app não envia o pedido a lugar nenhum', () => {
  function sourceFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) return sourceFiles(full)
      return ['.ts', '.tsx'].includes(extname(entry.name)) ? [full] : []
    })
  }

  it('o código da IA não lê o PAT nem abre conexão', () => {
    for (const file of sourceFiles(join(ROOT, 'src/main/services/ai'))) {
      const source = readFileSync(file, 'utf8')
      expect(source).not.toMatch(/security\/pat-store|\bfetch\s*\(|net\.request|https?:\/\//)
    }
  })

  it('o contrato de IPC da IA é um canal só, que devolve texto', () => {
    const aiChannels = Object.entries(IPC_CHANNELS).filter(([, channel]) =>
      channel.startsWith('ai:')
    )
    expect(aiChannels).toEqual([['buildSprintGoalRequest', 'ai:sprint-goal-request']])
  })

  it('não existe consentimento por Perfil: nada liga envio de dados', () => {
    expect(Object.keys(store)).not.toContain('setAiSettings')
    expect(Object.keys(store)).not.toContain('getAiSettings')
  })
})
