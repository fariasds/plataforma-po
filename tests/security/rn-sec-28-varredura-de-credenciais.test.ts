import { execFileSync } from 'child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join, resolve } from 'path'
import { afterEach, describe, expect, it } from 'vitest'

// RN-SEC-28: nenhuma credencial entra no repositório. A mesma varredura roda no
// hook de pre-commit e no CI, em todos os arquivos de todo PR.
//
// Os tokens são montados em tempo de execução: este arquivo não tem forma de
// token, e a própria varredura não o barra.

const ROOT = resolve(__dirname, '../..')
const SCRIPT = join(ROOT, 'scripts/scan-secrets.mjs')

const SHAPES: Array<[string, string]> = [
  ['PAT clássico do Azure DevOps', 'q'.repeat(26) + '2'.repeat(26)],
  ['PAT do Azure DevOps', 'A'.repeat(76) + 'AZ' + 'DO' + 'B1c2'],
  ['token do GitHub', 'gh' + 'p_' + 'X'.repeat(36)],
  ['token granular do GitHub', 'github' + '_pat_' + 'Y'.repeat(62)],
  ['cabeçalho Basic', 'Ba' + 'sic ' + Buffer.from(':segredo-de-teste-contoso').toString('base64')],
  ['Authorization literal', 'Author' + 'ization: ' + 'Z'.repeat(30)]
]

let dirs: string[] = []

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'po-scan-'))
  dirs.push(dir)
  return dir
}

function scan(args: string[], cwd = ROOT): { code: number; output: string } {
  try {
    const output = execFileSync(process.execPath, [SCRIPT, ...args], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    })
    return { code: 0, output }
  } catch (error) {
    const failure = error as { status: number; stdout: string; stderr: string }
    return { code: failure.status, output: `${failure.stdout}${failure.stderr}` }
  }
}

afterEach(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
  dirs = []
})

describe('RN-SEC-28: a varredura acha cada forma', () => {
  it.each(SHAPES)('%s num arquivo qualquer', (_name, secret) => {
    const dir = tempDir()
    writeFileSync(join(dir, 'notas.md'), `# Rascunho\n\nconfig = "${secret}"\n`)

    const { code, output } = scan([dir])
    expect(code).toBe(1)
    expect(output).toContain('notas.md:3')
    // O log do CI é público: o valor nunca aparece na saída.
    expect(output).not.toContain(secret)
  })

  it('acha em subpasta e em qualquer extensão', () => {
    const dir = tempDir()
    mkdirSync(join(dir, 'src', 'deep'), { recursive: true })
    writeFileSync(join(dir, 'src', 'deep', 'cfg.json'), `{"v":"${SHAPES[2][1]}"}`)
    expect(scan([dir]).code).toBe(1)
  })

  it('barra arquivo de credencial pelo nome, qualquer que seja o conteúdo', () => {
    for (const name of ['.env', '.env.local', 'pat.bin']) {
      const dir = tempDir()
      writeFileSync(join(dir, name), 'nada com forma de token')
      expect(scan([dir]).code).toBe(1)
    }
  })

  it('não confunde hash de package-lock nem texto comum com token', () => {
    const dir = tempDir()
    writeFileSync(
      join(dir, 'package-lock.json'),
      '{"integrity": "sha512-' + 'aB3+/'.repeat(17) + 'Q=="}\n'
    )
    writeFileSync(join(dir, 'README.md'), 'O cabeçalho Basic leva o PAT codificado.\n')
    expect(scan([dir])).toEqual({ code: 0, output: '' })
  })
})

describe('RN-SEC-28: o repositório está limpo', () => {
  it('não acha nada nos arquivos do repositório atual', () => {
    const { code, output } = scan([])
    expect(output).toBe('')
    expect(code).toBe(0)
  })
})

describe('RN-SEC-28: a barreira está ligada nos dois lugares', () => {
  it('o CI roda a varredura em todos os arquivos, em todo PR', () => {
    const ci = readFileSync(join(ROOT, '.github/workflows/ci.yml'), 'utf8')
    expect(ci).toMatch(/^on:\s*\n\s+pull_request:/m)
    // Sem argumento: o repositório inteiro, não só o que o PR mudou.
    expect(ci).toMatch(/^\s+run:\s*node scripts\/scan-secrets\.mjs\s*$/m)
  })

  it('o hook de pre-commit chama a mesma varredura nas linhas do stage', () => {
    const hook = readFileSync(join(ROOT, '.githooks/pre-commit'), 'utf8')
    expect(hook).toMatch(
      /scan="\$\(cd "\$\(dirname "\$0"\)\/\.\." && pwd\)\/scripts\/scan-secrets\.mjs"/
    )
    expect(hook).toMatch(/node "\$scan" --staged/)
  })
})
