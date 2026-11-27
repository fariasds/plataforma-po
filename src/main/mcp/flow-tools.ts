import { existsSync, lstatSync, readFileSync, statSync } from 'fs'
import { join } from 'path'
import type { Configuration } from '@shared/config/schema'
import { ARTIFACT_FILES } from '@shared/flow-artifacts'
import type { BoardFeature } from '@shared/flow-board'
import { MAX_INSTRUCTION_BYTES, isRuleFirstPrompt, RULE_FIRST_PROMPTS } from '@shared/flow-prompts'
import { flowBoard, storedSnapshot } from '../flow/board'
import { productCatalog, productOf } from '../flow/catalog-files'
import { FEATURES_DIR } from '../flow/feature-folders'
import { opportunitiesView } from '../flow/opportunities'
import { writeFileAtomic } from '../profile/atomic-write'
import { instructionProposalPath } from '../profile/paths'
import { getWorkFolder } from '../profile/work-folders'
import { toolError, type McpTool, type ToolResult } from './protocol'
import { assertWriteContent, workspaceTarget, WRITABLE_DIRS } from './workspace'

/**
 * As ferramentas do fluxo do PO (ADR 0011, ADR 0013, ADR 0014). Leem o retrato que a
 * janela gravou, a pasta de trabalho e o catálogo, pelo mesmo código da janela
 * (RN-FLX-17). Gravam só na pasta de trabalho do Produto (RN-SEC-38) e a proposta de
 * instrução (RN-SEC-35). Não falam com o Azure (RN-SEC-34).
 */

function text(value: string): ToolResult {
  return { content: [{ type: 'text', text: value }] }
}

function json(value: unknown): string {
  return JSON.stringify(value, null, 2)
}

const MAX_READ_BYTES = 1024 * 1024
const MAX_MATCHES = 15

/** Os argumentos comuns: o Produto e, quando a ferramenta pede, a Feature. */
const PRODUCT_ARG = {
  produto: { type: 'string', description: 'ID do Produto, como está na Configuração.' }
}
const FEATURE_ARG = {
  feature: {
    type: 'string',
    description: 'ID da Feature no Azure ("4102" ou "#4102") ou o nome da pasta em features/.'
  }
}

function productArg(args: Record<string, unknown>): string {
  if (typeof args.produto !== 'string' || args.produto.trim() === '') {
    throw new Error('Informe o ID do Produto no argumento "produto".')
  }
  return args.produto.trim()
}

/** A data do retrato, que a IA deve dizer ao PO (RN-FLX-02). */
function snapshotLine(takenAt: string | null): string {
  return takenAt
    ? `Retrato do Azure tirado em ${takenAt}. Diga esta data ao PO: o que mudou no Azure depois dela não está aqui.`
    : 'Ainda não há retrato do Azure para este Produto. Peça ao PO para abrir a tela Features no app, que lê o Azure.'
}

function findFeature(features: BoardFeature[], wanted: unknown): BoardFeature {
  if (typeof wanted !== 'string' || wanted.trim() === '') {
    throw new Error('Informe a Feature no argumento "feature": o ID do Azure ou a pasta.')
  }
  const value = wanted.trim().replace(/^#/, '')
  const found = features.find(
    (f) => (f.featureId !== null && String(f.featureId) === value) || f.slug === value
  )
  if (!found) throw new Error(`Não achei a Feature "${wanted}" neste Produto. Use listar_features.`)
  return found
}

function readSmall(file: string): string | null {
  if (!existsSync(file)) return null
  const stat = lstatSync(file)
  if (!stat.isFile() || stat.size > MAX_READ_BYTES) return null
  return readFileSync(file, 'utf8')
}

function workFolderOf(profileId: string, productId: string): string {
  const root = getWorkFolder(profileId, productId)
  if (root === null || !existsSync(root) || !statSync(root).isDirectory()) {
    throw new Error(
      'Este Produto não tem pasta de trabalho, ou ela sumiu. Peça ao PO para escolher a pasta na tela Features do app.'
    )
  }
  return root
}

/** O trecho de uma regra no texto da página: do título até o próximo título. */
function ruleBlock(page: string, line: number): string {
  const lines = page.split(/\r?\n/)
  const end = lines.findIndex((l, i) => i >= line && /^#{1,3}\s/.test(l))
  return lines
    .slice(line - 1, end < 0 ? undefined : end)
    .join('\n')
    .trimEnd()
}

export function flowTools(profileId: string, configuration: () => Configuration | null): McpTool[] {
  const config = (): Configuration => {
    const value = configuration()
    if (!value) {
      throw new Error(
        'A Configuração do Perfil tem erros ou não existe. Use ler_configuracao para ver o que corrigir.'
      )
    }
    return value
  }

  return [
    {
      name: 'listar_features',
      title: 'Listar as Features do Produto',
      description:
        'Cada Feature do Produto com a Fase, o estado no Azure e quantas pendências tem, calculadas da pasta de trabalho e do retrato do Azure.',
      inputSchema: {
        type: 'object',
        properties: PRODUCT_ARG,
        required: ['produto'],
        additionalProperties: false
      },
      readOnly: true,
      call: (args) => {
        const board = flowBoard(config(), profileId, productArg(args))
        const features = board.features.map((f) => ({
          feature: f.featureId !== null ? `#${f.featureId}` : null,
          pasta: f.slug,
          titulo: f.title,
          fase: f.phase,
          estadoNoAzure: f.azureState,
          pendencias: f.pendencies.length,
          paradaHaDias: f.staleDays
        }))
        return text(
          `${snapshotLine(board.snapshotTakenAt)}\nPasta de trabalho: ${board.workFolder}.\n\n${json(features)}`
        )
      }
    },
    {
      name: 'ler_feature',
      title: 'Ler uma Feature',
      description:
        'A Fase, o checklist, as pendências e o texto do README, do Brief, das Decisões e do Plano de PBIs de uma Feature.',
      inputSchema: {
        type: 'object',
        properties: { ...PRODUCT_ARG, ...FEATURE_ARG },
        required: ['produto', 'feature'],
        additionalProperties: false
      },
      readOnly: true,
      call: (args) => {
        const productId = productArg(args)
        const board = flowBoard(config(), profileId, productId)
        const feature = findFeature(board.features, args.feature)
        const parts = [snapshotLine(board.snapshotTakenAt), json(feature)]
        if (feature.slug !== null) {
          const dir = join(workFolderOf(profileId, productId), FEATURES_DIR, feature.slug)
          for (const file of Object.values(ARTIFACT_FILES)) {
            const content = readSmall(join(dir, file))
            parts.push(`--- features/${feature.slug}/${file}\n${content ?? '(não existe)'}`)
          }
        }
        return text(parts.join('\n\n'))
      }
    },
    {
      name: 'validar_feature',
      title: 'Validar uma Feature',
      description:
        'O checklist de Pronta para quebra, as pendências e as divergências com o Azure, as mesmas que a tela do app mostra. Rode antes de dizer que um passo fechou.',
      inputSchema: {
        type: 'object',
        properties: { ...PRODUCT_ARG, ...FEATURE_ARG },
        required: ['produto', 'feature'],
        additionalProperties: false
      },
      readOnly: true,
      call: (args) => {
        const board = flowBoard(config(), profileId, productArg(args))
        const f = findFeature(board.features, args.feature)
        return text(
          json({
            fase: f.phase,
            checklist: f.checklist,
            pendencias: f.pendencies,
            divergencias: f.divergences,
            aConfirmarNoAzure: f.reconciliation
          })
        )
      }
    },
    {
      name: 'listar_oportunidades',
      title: 'Listar as oportunidades',
      description:
        'Os feedbacks do Azure, as oportunidades da conversa (em oportunidades/) e os bugs "A validar", com o encaixe de cada um e o que o PO faz no Azure para fechar o encaixe.',
      inputSchema: {
        type: 'object',
        properties: PRODUCT_ARG,
        required: ['produto'],
        additionalProperties: false
      },
      readOnly: true,
      call: (args) => {
        const view = opportunitiesView(config(), profileId, productArg(args))
        const note = view.feedbackConfigured
          ? ''
          : '\nO Produto não declara feedback na Configuração: as oportunidades vêm só da conversa e dos bugs.'
        return text(`${snapshotLine(view.snapshotTakenAt)}${note}\n\n${json(view.opportunities)}`)
      }
    },
    {
      name: 'ler_retrato',
      title: 'Ler o retrato do Azure',
      description:
        'O que o app leu do Azure para o Produto: Features, filhos, feedbacks e bugs, com a data em que foi lido. A descrição já vem em texto puro, sem segredos.',
      inputSchema: {
        type: 'object',
        properties: {
          ...PRODUCT_ARG,
          colecao: {
            type: 'string',
            enum: ['features', 'filhos', 'feedbacks', 'bugs'],
            description: 'Só uma parte do retrato. Sem ela, vem tudo.'
          }
        },
        required: ['produto'],
        additionalProperties: false
      },
      readOnly: true,
      call: (args) => {
        const product = productOf(config(), productArg(args))
        const snapshot = storedSnapshot(profileId, product.id)
        if (!snapshot) return toolError(snapshotLine(null))
        const pick = {
          features: snapshot.features,
          filhos: snapshot.children,
          feedbacks: snapshot.feedbacks,
          bugs: snapshot.bugs
        }
        const part =
          typeof args.colecao === 'string' && args.colecao in pick
            ? pick[args.colecao as keyof typeof pick]
            : pick
        return text(`${snapshotLine(snapshot.takenAt)}\n\n${json(part)}`)
      }
    },
    {
      name: 'buscar_regra',
      title: 'Buscar regra no catálogo',
      description:
        'Regras de negócio pelo ID ou por um trecho do texto, no catálogo do Produto e nos que ele consulta. Devolve o texto inteiro de cada regra.',
      inputSchema: {
        type: 'object',
        properties: {
          ...PRODUCT_ARG,
          termo: { type: 'string', description: 'O ID (RN-DOC-045) ou um trecho do texto.' }
        },
        required: ['produto', 'termo'],
        additionalProperties: false
      },
      readOnly: true,
      call: (args) => {
        const cfg = config()
        const productId = productArg(args)
        const term = typeof args.termo === 'string' ? args.termo.trim() : ''
        if (term.length < 2)
          return toolError('Informe o ID da regra ou um trecho com 2 letras ou mais.')
        const own = productCatalog(cfg, profileId, productId)
        if (!own.product.catalog)
          return toolError('Este Produto não declara catálogo na Configuração.')
        const catalogs = [
          own,
          ...own.product.catalog.consults.map((id) => productCatalog(cfg, profileId, id))
        ]
        const lower = term.toLowerCase()
        const matches: Array<Record<string, unknown>> = []
        for (const catalog of catalogs) {
          for (const rule of catalog.index.rules.values()) {
            const block = ruleBlock(catalog.files[rule.file] ?? '', rule.line)
            const hit = rule.id.toLowerCase() === lower || block.toLowerCase().includes(lower)
            if (hit && matches.length < MAX_MATCHES) {
              matches.push({
                id: rule.id,
                produto: catalog.product.id,
                consultado: catalog.product.id !== own.product.id,
                pagina: rule.file,
                texto: block
              })
            }
          }
        }
        if (matches.length === 0) return text(`Nenhuma regra com "${term}".`)
        const more =
          matches.length === MAX_MATCHES
            ? `\nMostrando as primeiras ${MAX_MATCHES}: refine o termo.`
            : ''
        return text(json(matches) + more)
      }
    },
    {
      name: 'ler_catalogo',
      title: 'Ler o catálogo',
      description:
        'Sem "pagina", as páginas do catálogo e as regras de cada uma. Com "pagina", o texto inteiro dela.',
      inputSchema: {
        type: 'object',
        properties: {
          ...PRODUCT_ARG,
          pagina: {
            type: 'string',
            description: 'O arquivo da página em catalogo/ (ex.: "Cupons.md").'
          }
        },
        required: ['produto'],
        additionalProperties: false
      },
      readOnly: true,
      call: (args) => {
        const catalog = productCatalog(config(), profileId, productArg(args))
        if (!catalog.product.catalog)
          return toolError('Este Produto não declara catálogo na Configuração.')
        if (typeof args.pagina === 'string' && args.pagina.trim() !== '') {
          const content = catalog.files[args.pagina.trim()]
          return content === undefined
            ? toolError(
                `A página "${args.pagina}" não está no catálogo. Use ler_catalogo sem "pagina".`
              )
            : text(content)
        }
        return text(
          json(
            catalog.index.pages.map((page) => ({
              pagina: page.file,
              titulo: page.title,
              regras: page.rules.map((r) => `${r.id} · ${r.title}`)
            }))
          )
        )
      }
    },
    {
      name: 'gravar_arquivo',
      title: 'Gravar um arquivo na pasta de trabalho',
      description: `Grava um arquivo de texto na pasta de trabalho do Produto, em ${WRITABLE_DIRS.map((d) => `${d}/`).join(', ')}. O caminho é relativo à pasta. Substitui o arquivo, se ele existe: leia antes.`,
      inputSchema: {
        type: 'object',
        properties: {
          ...PRODUCT_ARG,
          caminho: {
            type: 'string',
            description:
              'Relativo à pasta de trabalho (ex.: "features/pagamento-pix/discovery/brief.md").'
          },
          conteudo: { type: 'string', description: 'O texto inteiro do arquivo.' }
        },
        required: ['produto', 'caminho', 'conteudo'],
        additionalProperties: false
      },
      readOnly: false,
      call: (args) => {
        const product = productOf(config(), productArg(args))
        const root = workFolderOf(profileId, product.id)
        const content = assertWriteContent(args.conteudo)
        writeFileAtomic(workspaceTarget(root, args.caminho), content)
        return text(
          `Gravado em ${String(args.caminho).trim()}. O app recalcula a Fase e as pendências quando o PO abrir ou atualizar a tela.`
        )
      }
    },
    {
      name: 'propor_instrucao',
      title: 'Propor uma instrução do processo',
      description: `Propõe um texto novo para uma das instruções do processo (${RULE_FIRST_PROMPTS.map((p) => p.name).join(', ')}). O PO revisa e aplica na Configuração do app; até lá, vale a atual.`,
      inputSchema: {
        type: 'object',
        properties: {
          instrucao: {
            type: 'string',
            enum: RULE_FIRST_PROMPTS.map((p) => p.name),
            description: 'O nome do prompt.'
          },
          texto: { type: 'string', description: 'O texto inteiro da instrução, em Markdown.' }
        },
        required: ['instrucao', 'texto'],
        additionalProperties: false
      },
      readOnly: false,
      call: (args) => {
        if (!isRuleFirstPrompt(args.instrucao)) {
          return toolError(
            `Instrução desconhecida. Use uma destas: ${RULE_FIRST_PROMPTS.map((p) => p.name).join(', ')}.`
          )
        }
        const value = typeof args.texto === 'string' ? args.texto : ''
        if (value.trim() === '' || Buffer.byteLength(value, 'utf8') > MAX_INSTRUCTION_BYTES) {
          return toolError('O texto precisa ter conteúdo e até 100 KB.')
        }
        writeFileAtomic(instructionProposalPath(profileId, args.instrucao), value)
        return text(
          'Proposta gravada. Peça ao PO para abrir a Configuração no app, revisar e aplicar. Até lá, vale a instrução atual.'
        )
      }
    }
  ]
}
