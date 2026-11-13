import type { FakeWorkItem } from './types'

/**
 * O subconjunto de WIQL que os serviços de `services/azure/` escrevem, e só ele.
 *
 * Não é um interpretador de WIQL: os campos, os operadores e as combinações
 * aceitos são uma lista fechada, tirada do inventário da T-23. Consulta fora
 * dela falha com erro que mostra o trecho, porque responder vazio esconderia
 * justamente o caso que a regressão deveria pegar.
 */

export class UnsupportedWiqlError extends Error {
  constructor(detail: string, query: string) {
    super(`WIQL fora do que o Azure fictício conhece (${detail}):\n${query}`)
    this.name = 'UnsupportedWiqlError'
  }
}

// ─── Campos e operadores aceitos ─────────────────────────────────────────────

type Operator = '=' | 'IN' | 'NOT IN' | 'UNDER' | 'NOT UNDER' | '>=' | '<='

const TEXT = ['=', 'IN', 'NOT IN'] as const
const DATE = ['>=', '<='] as const

/** Campo → operadores que algum serviço usa com ele. */
const ALLOWED: Record<string, readonly Operator[]> = {
  'System.WorkItemType': TEXT,
  'System.State': TEXT,
  'System.TeamProject': ['='],
  'System.IterationPath': ['='],
  'System.AreaPath': ['UNDER', 'NOT UNDER'],
  'System.CreatedDate': DATE,
  'Microsoft.VSTS.Common.ClosedDate': DATE,
  'Microsoft.VSTS.Common.StateChangeDate': DATE
}

const ORDERABLE = new Set([
  'System.Id',
  'System.CreatedDate',
  'Microsoft.VSTS.Common.ClosedDate',
  'Microsoft.VSTS.Common.StateChangeDate'
])

// ─── Tokens ──────────────────────────────────────────────────────────────────

type Token =
  | { kind: 'field'; value: string }
  | { kind: 'string'; value: string }
  | { kind: 'word'; value: string }
  | { kind: 'op'; value: string }
  | { kind: '(' | ')' | ',' }

function tokenize(text: string, query: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  while (i < text.length) {
    const ch = text[i]
    if (/\s/.test(ch)) {
      i++
    } else if (ch === '[') {
      const end = text.indexOf(']', i)
      if (end < 0) throw new UnsupportedWiqlError('colchete sem fechar', query)
      tokens.push({ kind: 'field', value: text.slice(i + 1, end) })
      i = end + 1
    } else if (ch === "'") {
      let value = ''
      i++
      for (;;) {
        if (i >= text.length) throw new UnsupportedWiqlError('aspa sem fechar', query)
        if (text[i] === "'" && text[i + 1] === "'") {
          value += "'"
          i += 2
        } else if (text[i] === "'") {
          i++
          break
        } else {
          value += text[i++]
        }
      }
      tokens.push({ kind: 'string', value })
    } else if (ch === '(' || ch === ')' || ch === ',') {
      tokens.push({ kind: ch })
      i++
    } else if (text.startsWith('>=', i) || text.startsWith('<=', i)) {
      tokens.push({ kind: 'op', value: text.slice(i, i + 2) })
      i += 2
    } else if (ch === '=') {
      tokens.push({ kind: 'op', value: '=' })
      i++
    } else {
      const word = /^[A-Za-z]+/.exec(text.slice(i))
      if (!word) throw new UnsupportedWiqlError(`caractere "${ch}"`, query)
      tokens.push({ kind: 'word', value: word[0].toUpperCase() })
      i += word[0].length
    }
  }
  return tokens
}

// ─── Expressão ───────────────────────────────────────────────────────────────

type Predicate = (item: FakeWorkItem) => boolean

/** Comparação de texto do Azure: sem diferenciar maiúsculas. */
const same = (a: unknown, b: string): boolean =>
  typeof a === 'string' && a.toLowerCase() === b.toLowerCase()

function isUnder(path: unknown, root: string): boolean {
  if (typeof path !== 'string') return false
  const p = path.toLowerCase()
  const r = root.toLowerCase()
  return p === r || p.startsWith(`${r}\\`)
}

/**
 * Literal só com data compara o dia, como o WIQL faz sem `asOf` e sem hora. As
 * datas dos itens estão em horário local, então o dia é o começo da string.
 */
function compareDay(value: unknown, literal: string, op: '>=' | '<='): boolean {
  if (typeof value !== 'string') return false
  if (!/^\d{4}-\d{2}-\d{2}$/.test(literal)) {
    throw new Error(`Data com hora no WIQL não é usada pelos serviços: ${literal}`)
  }
  const day = value.slice(0, 10)
  return op === '>=' ? day >= literal : day <= literal
}

class Parser {
  private pos = 0

  constructor(
    private readonly tokens: Token[],
    private readonly query: string
  ) {}

  private peek(): Token | undefined {
    return this.tokens[this.pos]
  }

  private next(): Token {
    const token = this.tokens[this.pos++]
    if (!token) throw new UnsupportedWiqlError('fim inesperado', this.query)
    return token
  }

  private isWord(value: string): boolean {
    const token = this.peek()
    return token?.kind === 'word' && token.value === value
  }

  private fail(detail: string): never {
    throw new UnsupportedWiqlError(detail, this.query)
  }

  parse(): Predicate {
    const predicate = this.or()
    if (this.pos < this.tokens.length) this.fail('sobra depois da condição')
    return predicate
  }

  private or(): Predicate {
    const parts = [this.and()]
    while (this.isWord('OR')) {
      this.pos++
      parts.push(this.and())
    }
    return parts.length === 1 ? parts[0] : (item) => parts.some((p) => p(item))
  }

  private and(): Predicate {
    const parts = [this.term()]
    while (this.isWord('AND')) {
      this.pos++
      parts.push(this.term())
    }
    return parts.length === 1 ? parts[0] : (item) => parts.every((p) => p(item))
  }

  private term(): Predicate {
    const token = this.peek()
    if (token?.kind === '(') {
      this.pos++
      const inner = this.or()
      if (this.next().kind !== ')') this.fail('parêntese sem fechar')
      return inner
    }
    // Só a exclusão de área usa NOT antes do campo: `NOT [System.AreaPath] UNDER`.
    if (this.isWord('NOT')) {
      this.pos++
      const field = this.field()
      if (!this.isWord('UNDER')) this.fail(`NOT antes de [${field}] sem UNDER`)
      this.pos++
      return this.atom(field, 'NOT UNDER')
    }
    const field = this.field()
    return this.atom(field, this.operator())
  }

  private field(): string {
    const token = this.next()
    if (token.kind !== 'field') this.fail('esperava um campo entre colchetes')
    if (!(token.value in ALLOWED)) this.fail(`campo [${token.value}]`)
    return token.value
  }

  private operator(): Operator {
    const token = this.next()
    if (token.kind === 'op') return token.value as Operator
    if (token.kind === 'word' && token.value === 'IN') return 'IN'
    if (token.kind === 'word' && token.value === 'UNDER') return 'UNDER'
    if (token.kind === 'word' && token.value === 'NOT' && this.isWord('IN')) {
      this.pos++
      return 'NOT IN'
    }
    return this.fail('operador')
  }

  private string(): string {
    const token = this.next()
    if (token.kind !== 'string') this.fail('esperava um texto entre aspas')
    return token.value
  }

  private list(): string[] {
    if (this.next().kind !== '(') this.fail('lista sem parêntese')
    const values = [this.string()]
    while (this.peek()?.kind === ',') {
      this.pos++
      values.push(this.string())
    }
    if (this.next().kind !== ')') this.fail('lista sem fechar')
    return values
  }

  private atom(field: string, op: Operator): Predicate {
    if (!ALLOWED[field].includes(op)) this.fail(`[${field}] com ${op}`)
    const value = (item: FakeWorkItem): unknown => item.fields[field]

    switch (op) {
      case '=': {
        const literal = this.string()
        return (item) => same(value(item), literal)
      }
      case 'IN':
      case 'NOT IN': {
        const values = this.list()
        const inside = (item: FakeWorkItem): boolean => values.some((v) => same(value(item), v))
        return op === 'IN' ? inside : (item) => !inside(item)
      }
      case 'UNDER':
      case 'NOT UNDER': {
        const root = this.string()
        return op === 'UNDER'
          ? (item) => isUnder(value(item), root)
          : (item) => !isUnder(value(item), root)
      }
      case '>=':
      case '<=': {
        const literal = this.string()
        return (item) => compareDay(value(item), literal, op)
      }
    }
  }
}

// ─── Consulta ────────────────────────────────────────────────────────────────

const SHAPE =
  /^\s*SELECT\s+\[System\.Id\]\s+FROM\s+WorkItems\s+WHERE\s+([\s\S]+?)\s+ORDER\s+BY\s+\[([^\]]+)\]\s+(ASC|DESC)\s*$/i

function sortKey(item: FakeWorkItem, field: string): string | number {
  const value = field === 'System.Id' ? item.id : item.fields[field]
  return typeof value === 'number' ? value : String(value ?? '')
}

/**
 * IDs dos itens que a consulta devolve, na ordem pedida. Empate desempata pelo
 * ID, para a resposta nunca oscilar.
 */
export function runWiql(query: string, items: readonly FakeWorkItem[]): number[] {
  const shape = SHAPE.exec(query)
  if (!shape) throw new UnsupportedWiqlError('forma SELECT … WHERE … ORDER BY', query)
  const [, where, orderField, direction] = shape
  if (!ORDERABLE.has(orderField)) throw new UnsupportedWiqlError(`ORDER BY [${orderField}]`, query)

  const predicate = new Parser(tokenize(where, query), query).parse()
  const sign = direction.toUpperCase() === 'DESC' ? -1 : 1

  return items
    .filter(predicate)
    .sort((a, b) => {
      const ka = sortKey(a, orderField)
      const kb = sortKey(b, orderField)
      if (ka < kb) return -sign
      if (ka > kb) return sign
      return a.id - b.id
    })
    .map((item) => item.id)
}
