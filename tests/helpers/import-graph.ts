import { existsSync, readdirSync, readFileSync } from 'fs'
import { dirname, join, relative, resolve } from 'path'

/**
 * O grafo de imports do servidor MCP, para as barreiras RN-SEC-34 e RN-SEC-35:
 * todo arquivo do app que o servidor alcança, por qualquer intermediário.
 */

const ROOT = resolve(__dirname, '../..')
const MCP_DIR = 'src/main/mcp'

/** Comentário que cita `safeStorage` não abre o cofre; só o código conta. */
export function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1')
}

const IMPORT = /(?:from\s*|import\s*\(\s*|require\s*\(\s*|^\s*import\s+)['"]([^'"]+)['"]/gm

export function toRepoPath(file: string): string {
  return relative(ROOT, file).replace(/\\/g, '/')
}

/** Resolve um import do app para o arquivo; pacote de fora devolve `null`. */
function resolveImport(from: string, spec: string): string | null {
  const clean = spec.replace(/\?raw$|\?asset$/, '')
  let base: string
  if (clean.startsWith('@shared/')) base = join(ROOT, 'src/shared', clean.slice('@shared/'.length))
  else if (clean.startsWith('.')) base = resolve(dirname(from), clean)
  else return null
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts')]) {
    if (existsSync(candidate) && !readdirSafe(candidate)) return candidate
  }
  return null
}

function readdirSafe(path: string): boolean {
  try {
    readdirSync(path)
    return true
  } catch {
    return false
  }
}

/** Todos os arquivos do app que o servidor alcança, a partir de `src/main/mcp/`. */
export function reachableFrom(entries: string[]): string[] {
  const seen = new Set<string>()
  const queue = [...entries]
  while (queue.length > 0) {
    const file = queue.pop() as string
    if (seen.has(file)) continue
    seen.add(file)
    if (!/\.tsx?$/.test(file)) continue
    const source = readFileSync(file, 'utf8')
    for (const match of source.matchAll(IMPORT)) {
      const target = resolveImport(file, match[1])
      if (target && !seen.has(target)) queue.push(target)
    }
  }
  return [...seen].map(toRepoPath).sort()
}

export function mcpEntries(): string[] {
  return readdirSync(join(ROOT, MCP_DIR))
    .filter((name) => /\.ts$/.test(name) && !/\.test\.ts$/.test(name))
    .map((name) => join(ROOT, MCP_DIR, name))
}
