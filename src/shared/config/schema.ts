import { z } from 'zod'

/**
 * Forma da Configuração de um Perfil (RN-CFG-01).
 *
 * É a fonte única: os tipos TS saem daqui por inferência e o JSON Schema
 * publicado na pasta do Perfil é gerado a partir daqui
 * (`npm run schema:generate`). As descrições estão em PT-BR porque viram a
 * documentação que a IA do PO lê ao editar o arquivo.
 *
 * Este módulo só importa `zod`: o script de geração o carrega direto pelo Node,
 * sem bundler, e um import relativo sem extensão quebraria isso.
 *
 * Todo objeto é estrito — chave desconhecida é erro. É o que pega a chave
 * digitada errado pela IA, que de outro modo seria ignorada em silêncio.
 */

// ─── Blocos reutilizados ─────────────────────────────────────────────────────

/** Organização do Azure DevOps: um nome, nunca uma URL (RN-CFG-04). */
export const ORGANIZATION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9-]{0,49}$/

/** IDs de Produto, Grupo e Perfil de processo. Imutáveis depois de criados (RN-CFG-02). */
const ID_PATTERN = /^[A-Za-z][A-Za-z0-9_-]{0,31}$/

/**
 * Nome de referência de campo do Azure (`Contoso.Retrabalho`). O conjunto de
 * caracteres é fechado porque o valor entra na lista de campos das consultas.
 */
const FIELD_REF_PATTERN = /^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z0-9_]+)+$/

const id = (what: string): z.ZodString =>
  z
    .string()
    .regex(
      ID_PATTERN,
      `O ID de ${what} começa com letra e usa só letras, números, "_" ou "-" (até 32 caracteres).`
    )
    .describe(
      `ID de ${what}. Imutável depois de criado: os Dados de trabalho são guardados por ele.`
    )

const nonEmpty = z.string().trim().min(1, 'Não pode ser vazio.')

const color = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, 'Cor no formato hexadecimal "#RRGGBB".')
  .describe('Cor no formato hexadecimal "#RRGGBB".')

const fieldRef = z
  .string()
  .regex(
    FIELD_REF_PATTERN,
    'Use o nome de referência do campo no Azure (ex.: "Contoso.Retrabalho"), não o nome de exibição.'
  )

const stateList = (description: string): z.ZodArray<z.ZodString> =>
  z.array(nonEmpty).min(1, 'Informe pelo menos um estado.').describe(description)

const time = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Horário no formato "HH:MM", de 00:00 a 23:59.')

function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

// ─── Perfil de processo ──────────────────────────────────────────────────────

export const processProfileSchema = z
  .strictObject({
    workItemTypes: z
      .array(nonEmpty)
      .min(1)
      .describe(
        'Tipos de work item que contam nas métricas. Os nomes precisam bater exatamente com os do Azure. Tipo fora desta lista é ignorado.'
      ),
    plannableTypes: z
      .array(nonEmpty)
      .min(1)
      .describe(
        'Tipos que o time planeja e estima (Planning e Daily). Subconjunto de "workItemTypes".'
      ),
    developmentTypes: z
      .array(nonEmpty)
      .min(1)
      .describe(
        'Tipos que contam como construção de produto no indicador de foco em desenvolvimento. Subconjunto de "workItemTypes".'
      ),
    bugType: nonEmpty.describe('Tipo que representa um bug. Precisa estar em "workItemTypes".'),
    taskType: nonEmpty.describe('Tipo das tarefas filhas, mostradas na Daily.'),
    estimateField: fieldRef.describe(
      'Campo numérico com a estimativa do item. Scrum usa "Microsoft.VSTS.Scheduling.Effort"; Agile usa "Microsoft.VSTS.Scheduling.StoryPoints".'
    ),
    deliveredStates: stateList(
      'Estados que significam "entregue". Vale a primeira vez que o item entrou em qualquer um deles.'
    ),
    terminalStates: stateList(
      'Estados em que o item deixou de estar ativo: entregue, fechado ou removido. Deve conter todos os "deliveredStates".'
    ),
    removedStates: z
      .array(nonEmpty)
      .default([])
      .describe('Estados de item descartado, excluídos de todas as contagens.'),
    inProgressState: nonEmpty.describe(
      'Estado em que o desenvolvimento está acontecendo. O tempo de desenvolvimento é medido nele.'
    ),
    devDoneState: nonEmpty
      .nullable()
      .default(null)
      .describe(
        'Estado que encerra o desenvolvimento antes da entrega (ex.: "Tested", "Resolved"). Sem ele, o desenvolvimento termina na entrega.'
      ),
    testingState: nonEmpty
      .nullable()
      .default(null)
      .describe(
        'Estado em que o item está só aguardando teste. Na Daily, item nele não é tratado como estouro de sprint.'
      ),
    bugStateOrder: stateList(
      'Estados do bug na ordem do fluxo, para o gráfico de tempo por estado. O primeiro é o estado em que o bug nasce.'
    )
  })
  .describe('Regras de um processo de trabalho: quais tipos contam e o que cada estado significa.')

// ─── Produto e Grupo ─────────────────────────────────────────────────────────

export const productSchema = z
  .strictObject({
    id: id('Produto'),
    name: nonEmpty.describe('Nome exibido nas telas.'),
    color: color,
    project: nonEmpty.describe('Nome do projeto no Azure DevOps onde os itens do Produto vivem.'),
    team: nonEmpty
      .optional()
      .describe(
        'Time do Azure que fornece as iterações. Sem ele, valem todas as iterações com datas cadastradas no projeto.'
      ),
    areaPaths: z
      .array(nonEmpty)
      .default([])
      .describe(
        'Area paths incluídos, com os filhos. Vazio significa o projeto inteiro. Use "\\\\" como separador no JSON.'
      ),
    excludedAreaPaths: z
      .array(nonEmpty)
      .default([])
      .describe(
        'Area paths excluídos, com os filhos (ex.: time de teste interno ou suporte). Medem-se só os itens do time de desenvolvimento.'
      ),
    processProfile: nonEmpty.describe('ID de um Perfil de processo definido em "processProfiles".'),
    cadence: z
      .enum(['sprints', 'continuous'])
      .default('sprints')
      .describe(
        '"sprints": o Produto tem iterações próprias no Azure. "continuous": fluxo sem iterações; os indicadores o medem pela janela de datas da Sprint unificada dos demais Produtos, e ele não aparece no Planning nem na Daily.'
      )
  })
  .describe('Unidade que o PO acompanha.')

export const groupSchema = z
  .strictObject({
    id: id('Grupo'),
    name: nonEmpty.describe('Nome exibido no filtro de produto.'),
    color: color.optional(),
    products: z
      .array(nonEmpty)
      .min(2, 'Um Grupo soma pelo menos dois Produtos.')
      .describe('IDs dos Produtos somados pelo Grupo.')
  })
  .describe('Soma nomeada de Produtos, vista como um todo nos indicadores.')

// ─── Demais seções ───────────────────────────────────────────────────────────

const customFieldsSchema = z
  .strictObject({
    reworkCount: fieldRef
      .nullable()
      .default(null)
      .describe('Campo numérico com quantas vezes o item voltou para retrabalho.'),
    effortFrontend: fieldRef
      .nullable()
      .default(null)
      .describe('Campo numérico com a estimativa de frontend, somada no Planning.'),
    effortBackend: fieldRef
      .nullable()
      .default(null)
      .describe('Campo numérico com a estimativa de backend, somada no Planning.'),
    effortQa: fieldRef
      .nullable()
      .default(null)
      .describe('Campo numérico com a estimativa de QA, somada no Planning.'),
    criticality: z
      .union([fieldRef, z.array(fieldRef).min(1)])
      .nullable()
      .default(null)
      .describe(
        'Campo de texto com a criticidade do bug. Uma lista é lida em ordem: vale o primeiro campo preenchido.'
      )
  })
  .default({
    reworkCount: null,
    effortFrontend: null,
    effortBackend: null,
    effortQa: null,
    criticality: null
  })
  .describe(
    'Campos customizados do Azure. Cada um é opcional: sem ele, o indicador que depende dele mostra um estado vazio dizendo o que configurar.'
  )

const criticalityLevelSchema = z.strictObject({
  name: nonEmpty.describe('Nome do nível exibido nas telas (ex.: "Alta").'),
  matches: z
    .array(nonEmpty)
    .min(1)
    .describe(
      'Prefixos do valor do campo de criticidade que caem neste nível, sem diferenciar maiúsculas (ex.: "alta" casa "Alta SLA - 16h").'
    ),
  color: color.optional()
})

const holidaySchema = z.union([
  z
    .strictObject({
      date: z.iso.date('Data no formato "AAAA-MM-DD".'),
      name: nonEmpty
    })
    .describe('Feriado de data única (ex.: emenda).'),
  z
    .strictObject({
      monthDay: z
        .string()
        .regex(
          /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/,
          'Dia e mês no formato "MM-DD" (ex.: "08-12").'
        )
        .refine((monthDay) => {
          const [month, day] = monthDay.split('-').map(Number)
          // Ano bissexto de referência: 29/02 é uma data recorrente legítima.
          return day <= new Date(2024, month, 0).getDate()
        }, 'Esse dia não existe nesse mês.'),
      name: nonEmpty
    })
    .describe('Feriado que se repete todo ano na mesma data (ex.: municipal).')
])

const calendarSchema = z
  .strictObject({
    country: z
      .enum(['BR'])
      .optional()
      .describe(
        'País cujos feriados nacionais são calculados pelo app. Por enquanto só "BR". Para outro país, omita e liste os feriados nacionais em "extraHolidays".'
      ),
    extraHolidays: z
      .array(holidaySchema)
      .default([])
      .describe('Feriados além dos nacionais: estaduais, municipais e emendas.'),
    workingHours: z
      .array(z.strictObject({ start: time, end: time }))
      .min(1)
      .describe(
        'Faixas do expediente, em ordem e sem sobreposição. O intervalo de almoço fica de fora. Toda duração é medida em horas úteis dentro destas faixas.'
      ),
    productiveHoursPerDay: z
      .number()
      .positive()
      .max(24)
      .describe(
        'Horas de trabalho efetivo por pessoa por dia, usadas para converter estimativa em dias. Menor ou igual à soma do expediente.'
      )
  })
  .describe('Calendário de trabalho: feriados e expediente.')

const storyPointsSchema = z
  .record(
    z.string().regex(/^\d+(\.\d+)?$/, 'A chave é a quantidade de pontos (ex.: "3").'),
    z.number().positive()
  )
  .describe(
    'Conversão de pontos de complexidade em horas. Valores fora da tabela são interpolados entre os vizinhos ou extrapolados pelo último trecho.'
  )

const bugPercentSchema = z.number().min(0).max(100)

const capacityDefaultsSchema = z
  .strictObject({
    frontDevs: z.number().min(0).describe('Pessoas de frontend (aceita fração).'),
    backDevs: z.number().min(0).describe('Pessoas de backend (aceita fração).'),
    sprintDays: z.int().min(1).describe('Dias úteis de uma sprint.'),
    frontBugPercent: bugPercentSchema
      .optional()
      .describe('Percentual da capacidade de frontend reservado para bugs.'),
    backBugPercent: bugPercentSchema
      .optional()
      .describe('Percentual da capacidade de backend reservado para bugs.'),
    bugPercent: bugPercentSchema
      .optional()
      .describe(
        'Formato antigo: percentual único para as duas disciplinas. Vale só para a que não tiver o próprio campo; prefira frontBugPercent e backBugPercent.'
      )
  })
  // Arquivos anteriores à separação por disciplina (RN-PLN-15) só têm `bugPercent`:
  // recusá-los derrubaria a Configuração de todo PO na atualização.
  .superRefine((value, ctx) => {
    for (const key of ['frontBugPercent', 'backBugPercent'] as const) {
      if (value[key] === undefined && value.bugPercent === undefined) {
        ctx.addIssue({
          code: 'custom',
          path: [key],
          message: 'Informe o percentual reservado para bugs desta disciplina.'
        })
      }
    }
  })
  .transform(({ bugPercent, ...rest }) => ({
    ...rest,
    frontBugPercent: rest.frontBugPercent ?? bugPercent ?? 0,
    backBugPercent: rest.backBugPercent ?? bugPercent ?? 0
  }))
  .describe('Valores iniciais do painel de capacidade do Planning.')

// ─── Configuração ────────────────────────────────────────────────────────────

const configurationShape = z.strictObject({
  $schema: z
    .string()
    .optional()
    .describe('Caminho do JSON Schema, para o editor oferecer autocompletar.'),
  version: z.literal(1).describe('Versão do formato da Configuração.'),
  organization: z
    .string()
    .regex(
      ORGANIZATION_PATTERN,
      'Informe só o nome da organização (o que vem depois de "dev.azure.com/"), sem URL, ponto ou barra. O endereço é sempre montado pelo app, para o PAT nunca ser enviado a outro servidor.'
    )
    .describe(
      'Nome da organização no Azure DevOps, nunca uma URL. O app sempre fala com "dev.azure.com/<organização>".'
    ),
  appearance: z
    .strictObject({ accentColor: color.describe('Cor de destaque da interface.') })
    .optional(),
  processProfiles: z
    .record(
      z.string().regex(ID_PATTERN, 'ID de Perfil de processo inválido.'),
      processProfileSchema
    )
    .refine(
      (profiles) => Object.keys(profiles).length > 0,
      'Defina pelo menos um Perfil de processo.'
    )
    .describe('Perfis de processo, indexados pelo ID.'),
  // Sem mínimo: o Perfil recém-criado nasce sem Produtos (T-06) e o PO os
  // acrescenta depois. Os indicadores mostram estado vazio enquanto isso.
  products: z
    .array(productSchema)
    .describe('Os Produtos acompanhados. Um Perfil recém-criado começa com a lista vazia.'),
  groups: z.array(groupSchema).default([]),
  customFields: customFieldsSchema,
  criticality: z
    .array(criticalityLevelSchema)
    .default([])
    .describe(
      'Níveis de criticidade de bug, do mais para o menos grave. O prazo de SLA vem do "Due Date" de cada bug no Azure, não daqui.'
    ),
  recurrentBugTag: nonEmpty
    .nullable()
    .default(null)
    .describe(
      'Marcador no título que identifica bug reincidente (ex.: "[reincidente]"), sem diferenciar maiúsculas. Sem ele, a reincidência não é medida.'
    ),
  calendar: calendarSchema,
  storyPoints: storyPointsSchema,
  capacityDefaults: capacityDefaultsSchema
})

type ConfigurationShape = z.output<typeof configurationShape>

/** RN-CFG-03: as referências internas precisam fechar. */
function checkReferences(config: ConfigurationShape, ctx: z.RefinementCtx): void {
  const issue = (path: PropertyKey[], message: string): void =>
    ctx.addIssue({ code: 'custom', path, message })

  const productIds = new Set<string>()
  config.products.forEach((product, i) => {
    if (productIds.has(product.id)) {
      issue(['products', i, 'id'], `ID de Produto repetido: "${product.id}".`)
    }
    productIds.add(product.id)
    if (!(product.processProfile in config.processProfiles)) {
      issue(
        ['products', i, 'processProfile'],
        `O Perfil de processo "${product.processProfile}" não existe em "processProfiles".`
      )
    }
  })

  const groupIds = new Set<string>()
  config.groups.forEach((group, i) => {
    if (groupIds.has(group.id) || productIds.has(group.id)) {
      issue(
        ['groups', i, 'id'],
        `ID de Grupo repetido ou igual ao de um Produto: "${group.id}". Os dois aparecem no mesmo filtro.`
      )
    }
    groupIds.add(group.id)
    group.products.forEach((ref, j) => {
      if (!productIds.has(ref)) {
        issue(['groups', i, 'products', j], `O Grupo cita o Produto "${ref}", que não existe.`)
      }
    })
    if (new Set(group.products).size !== group.products.length) {
      issue(['groups', i, 'products'], 'O Grupo cita o mesmo Produto mais de uma vez.')
    }
  })

  for (const [profileId, profile] of Object.entries(config.processProfiles)) {
    const base = ['processProfiles', profileId]
    const types = new Set(profile.workItemTypes)
    for (const key of ['plannableTypes', 'developmentTypes'] as const) {
      profile[key].forEach((type, j) => {
        if (!types.has(type)) {
          issue(
            [...base, key, j],
            `"${type}" não está em "workItemTypes" deste Perfil de processo.`
          )
        }
      })
    }
    if (!types.has(profile.bugType)) {
      issue([...base, 'bugType'], `"${profile.bugType}" não está em "workItemTypes".`)
    }
    const terminal = new Set(profile.terminalStates)
    profile.deliveredStates.forEach((state, j) => {
      if (!terminal.has(state)) {
        issue(
          [...base, 'deliveredStates', j],
          `"${state}" significa entregue, então também precisa estar em "terminalStates".`
        )
      }
    })
  }

  const workingHours = config.calendar.workingHours
  let previousEnd = -1
  let workingMinutes = 0
  workingHours.forEach((range, i) => {
    const start = minutesOf(range.start)
    const end = minutesOf(range.end)
    if (end <= start) {
      issue(['calendar', 'workingHours', i], 'O fim da faixa precisa ser depois do início.')
    } else if (start < previousEnd) {
      issue(
        ['calendar', 'workingHours', i],
        'As faixas do expediente precisam estar em ordem e sem sobreposição.'
      )
    }
    previousEnd = Math.max(previousEnd, end)
    workingMinutes += Math.max(0, end - start)
  })
  if (config.calendar.productiveHoursPerDay * 60 > workingMinutes) {
    issue(
      ['calendar', 'productiveHoursPerDay'],
      'As horas produtivas não podem passar das horas do expediente.'
    )
  }

  if (Object.keys(config.storyPoints).length < 2) {
    issue(
      ['storyPoints'],
      'A tabela de pontos precisa de pelo menos duas entradas para interpolar.'
    )
  }
}

export const configurationSchema = configurationShape
  .superRefine(checkReferences)
  .describe(
    'Configuração de um Perfil da Plataforma do PO. Nunca contém o PAT: ele é guardado cifrado, fora desta pasta.'
  )

/** Configuração já validada, com os valores padrão aplicados. */
export type Configuration = z.output<typeof configurationSchema>
/** Configuração como escrita no arquivo, antes dos padrões. */
export type ConfigurationInput = z.input<typeof configurationSchema>
export type ProcessProfile = z.output<typeof processProfileSchema>
export type Product = z.output<typeof productSchema>
export type ProductGroup = z.output<typeof groupSchema>

/**
 * JSON Schema publicado na pasta do Perfil, já serializado. O script de geração
 * grava exatamente isto, e um teste compara com o arquivo versionado.
 */
export function renderConfigurationJsonSchema(): string {
  const schema = z.toJSONSchema(configurationSchema, { io: 'input', unrepresentable: 'any' })
  return JSON.stringify({ title: 'Configuração da Plataforma do PO', ...schema }, null, 2) + '\n'
}
