import { existsSync, lstatSync, realpathSync } from 'fs'
import { isAbsolute, join, relative, resolve } from 'path'

/**
 * Onde a IA do PO pode gravar (RN-SEC-38): dentro da pasta de trabalho do Produto
 * que ela nomeia, nas pastas do processo, em arquivo de texto. A pasta é a que o PO
 * escolheu pelo diálogo do sistema (RN-SEC-36); daqui, o servidor só decide se o
 * caminho relativo que a IA mandou cabe nela.
 */

/** As pastas do processo rule-first em que a IA escreve (ADR 0013). */
export const WRITABLE_DIRS = ['features', 'oportunidades', 'bugs', 'catalogo'] as const

/** Texto que o PO abre no editor: Markdown, o BPMN do draw.io e texto puro. */
const WRITABLE_EXTENSIONS = ['.md', '.drawio', '.txt']

export const MAX_WRITE_BYTES = 1024 * 1024

/** Caractere que o Windows não aceita em nome de arquivo, e os de controle. */
// eslint-disable-next-line no-control-regex
const UNSAFE = /[<>:"|?*\u0000-\u001f]/

function refuse(reason: string): never {
  throw new Error(`Nada foi gravado: ${reason}`)
}

function inside(child: string, parent: string): boolean {
  const rel = relative(parent, child)
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}

/**
 * O caminho absoluto em que gravar, ou erro. Recusa caminho absoluto, `..`, ponto
 * no começo de qualquer parte (`.absorcao.json`, `.git`), pasta fora das do
 * processo, extensão que não é de texto e qualquer link simbólico no caminho.
 */
export function workspaceTarget(root: string, relPath: unknown): string {
  if (typeof relPath !== 'string' || relPath.trim() === '' || relPath.length > 300) {
    refuse('informe o caminho do arquivo, relativo à pasta de trabalho.')
  }
  const raw = relPath.trim()
  if (isAbsolute(raw) || /^[a-zA-Z]:/.test(raw) || raw.startsWith('/') || raw.startsWith('\\')) {
    refuse('o caminho é relativo à pasta de trabalho, nunca absoluto.')
  }
  const segments = raw.split(/[\\/]+/)
  for (const segment of segments) {
    if (segment === '' || segment === '.' || segment === '..') {
      refuse('o caminho não pode ter "..", "." nem barra repetida.')
    }
    if (segment.startsWith('.'))
      refuse(`"${segment}" começa com ponto: é arquivo do app ou do sistema.`)
    if (UNSAFE.test(segment)) refuse(`"${segment}" tem caractere que o Windows não aceita.`)
  }
  if (!(WRITABLE_DIRS as readonly string[]).includes(segments[0]) || segments.length < 2) {
    refuse(`grave dentro de ${WRITABLE_DIRS.map((d) => `${d}/`).join(', ')}.`)
  }
  const name = segments[segments.length - 1].toLowerCase()
  if (!WRITABLE_EXTENSIONS.some((ext) => name.endsWith(ext))) {
    refuse(`só arquivo de texto: ${WRITABLE_EXTENSIONS.join(', ')}.`)
  }

  const base = realpathSync.native(root)
  const target = resolve(base, ...segments)
  if (!inside(target, base)) refuse('o caminho sai da pasta de trabalho.')
  // Nenhuma parte do caminho que já existe pode ser link: ele levaria para fora.
  let current = base
  for (const segment of segments) {
    current = join(current, segment)
    if (!existsSync(current)) break
    if (lstatSync(current).isSymbolicLink()) refuse(`"${segment}" é um link simbólico.`)
  }
  if (existsSync(target) && !lstatSync(target).isFile()) refuse('o caminho é uma pasta.')
  return target
}

/** O conteúdo que a IA manda: texto, até 1 MB. */
export function assertWriteContent(content: unknown): string {
  if (typeof content !== 'string') refuse('o conteúdo precisa ser texto.')
  if (Buffer.byteLength(content, 'utf8') > MAX_WRITE_BYTES) refuse('o arquivo passa de 1 MB.')
  return content
}
