import { execFileSync } from 'child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { dirname, join, resolve } from 'path'
import { afterEach, describe, expect, it } from 'vitest'
// @ts-expect-error -- script .mjs sem declaração de tipos
import { parseDenylist, verifyPush } from '../../scripts/verify-push.mjs'

// RN-SEC-32: para o GitHub só sai o que já é público por construção. Cada caso monta
// um repositório de verdade numa pasta temporária, com um remoto local, e pergunta à
// verificação se aquele push sairia.
//
// Os termos e a credencial são fictícios e montados em tempo de execução: este
// arquivo não tem termo de lista nenhuma nem forma de token.

const ROOT = resolve(__dirname, '../..')
const NOREPLY = '1+contoso@users.noreply.github.com'
const TERMS = parseDenylist(
  ['# termos de teste', 'Fabri' + 'kam', 'Custom\\.[A-Za-z]+ :: src/, !*.test.ts'].join('\n')
)

let dirs: string[] = []

afterEach(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
  dirs = []
})

function git(cwd: string, args: string[], email = NOREPLY): string {
  return execFileSync('git', ['-c', 'core.hooksPath=.sem-hooks', ...args], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'Contoso',
      GIT_AUTHOR_EMAIL: email,
      GIT_COMMITTER_NAME: 'Contoso',
      GIT_COMMITTER_EMAIL: email
    }
  })
}

function commit(
  cwd: string,
  files: Record<string, string | null>,
  message: string,
  email = NOREPLY
): string {
  for (const [path, content] of Object.entries(files)) {
    const full = join(cwd, path)
    if (content === null) {
      git(cwd, ['rm', '-q', path])
      continue
    }
    mkdirSync(dirname(full), { recursive: true })
    writeFileSync(full, content)
    git(cwd, ['add', path])
  }
  git(cwd, ['commit', '-q', '-m', message], email)
  return git(cwd, ['rev-parse', 'HEAD']).trim()
}

/** Clone com a raiz "pública" já no remoto, como o clone de publicação. */
function publicClone(): { cwd: string; remote: string; root: string } {
  const base = mkdtempSync(join(tmpdir(), 'po-push-'))
  dirs.push(base)
  const remote = join(base, 'remoto.git')
  const cwd = join(base, 'clone')
  mkdirSync(cwd)
  execFileSync('git', ['init', '-q', '--bare', remote])
  git(cwd, ['init', '-q', '-b', 'main'])
  git(cwd, ['config', 'core.autocrlf', 'false'])
  const root = commit(cwd, { 'README.md': '# Loja Online\n' }, 'Primeira versão pública')
  git(cwd, ['remote', 'add', 'origin', remote])
  git(cwd, ['push', '-q', 'origin', 'main'])
  return { cwd, remote, root }
}

function check(
  clone: { cwd: string; root: string },
  options: { terms?: unknown; allowWithoutList?: boolean } = {}
): string[] {
  const head = git(clone.cwd, ['rev-parse', 'HEAD']).trim()
  return verifyPush({
    cwd: clone.cwd,
    remote: 'origin',
    publicRoot: clone.root,
    updates: [
      { localRef: 'refs/heads/main', localSha: head, remoteRef: 'refs/heads/main', remoteSha: '0' }
    ],
    terms: 'terms' in options ? options.terms : TERMS,
    allowWithoutList: options.allowWithoutList ?? false
  })
}

describe('RN-SEC-32: publicação só da história pública', () => {
  it('commit limpo, de autor noreply, passa', () => {
    const clone = publicClone()
    commit(clone.cwd, { 'src/loja.ts': 'export const nome = "Loja Online"\n' }, 'Loja: nome')
    expect(check(clone)).toEqual([])
  })

  it('termo que entrou num commit e saiu no seguinte continua barrado, sem ser mostrado', () => {
    const clone = publicClone()
    commit(clone.cwd, { 'docs/notas.md': 'cliente ' + 'Fabri' + 'kam\n' }, 'Notas')
    commit(clone.cwd, { 'docs/notas.md': 'cliente fictício\n' }, 'Notas sem o nome')
    const problems = check(clone)
    expect(problems).toHaveLength(1)
    expect(problems[0]).toMatch(/docs\/notas\.md:1: termo nº 1 da lista/)
    expect(problems.join('\n')).not.toMatch(new RegExp('Fabri' + 'kam', 'i'))
  })

  it('termo na mensagem do commit é barrado', () => {
    const clone = publicClone()
    commit(clone.cwd, { 'src/a.ts': 'export {}\n' }, 'Ajuste pedido pela ' + 'fabri' + 'kam')
    expect(check(clone)).toEqual([expect.stringMatching(/mensagem do commit, linha 1: termo nº 1/)])
  })

  it('termo com escopo vale só dentro do escopo', () => {
    const fora = publicClone()
    commit(fora.cwd, { 'tests/campo.test.ts': 'const f = "Custom.Esforco"\n' }, 'Teste')
    expect(check(fora)).toEqual([])

    const dentro = publicClone()
    commit(dentro.cwd, { 'src/campo.ts': 'const f = "Custom.Esforco"\n' }, 'Campo')
    expect(check(dentro)).toEqual([expect.stringMatching(/src\/campo\.ts:1: termo nº 2/)])
  })

  it('linha com forma de credencial é barrada', () => {
    const clone = publicClone()
    commit(clone.cwd, { 'src/token.ts': `const t = "${'gh' + 'p_' + 'X'.repeat(36)}"\n` }, 'Token')
    expect(check(clone)).toEqual([
      expect.stringMatching(/src\/token\.ts:1: forma de credencial: token do GitHub/)
    ])
  })

  it('autor com email pessoal é barrado', () => {
    const clone = publicClone()
    commit(clone.cwd, { 'src/a.ts': 'export {}\n' }, 'Ajuste', 'pessoa@contoso.com')
    const problems = check(clone)
    expect(problems).toContainEqual(expect.stringMatching(/autor não é um endereço noreply/))
    expect(problems).toContainEqual(expect.stringMatching(/committer não é um endereço noreply/))
  })

  it('caminho que só existe no privado é barrado, qualquer que seja o conteúdo', () => {
    const clone = publicClone()
    commit(clone.cwd, { 'perfis-privados/perfil.json': '{}\n' }, 'Perfil')
    commit(clone.cwd, { 'docs/plano-x/PLANO.md': 'ok\n' }, 'Plano')
    const problems = check(clone)
    expect(problems).toContainEqual(
      expect.stringMatching(/perfis-privados\/perfil\.json não pode ser público/)
    )
    expect(problems).toContainEqual(
      expect.stringMatching(/docs\/plano-x\/PLANO\.md não pode ser público/)
    )
  })

  it('clone que guarda outra história não publica nada, nem branch limpa', () => {
    const clone = publicClone()
    git(clone.cwd, ['checkout', '-q', '--orphan', 'privada'])
    git(clone.cwd, ['rm', '-q', '-rf', '.'])
    commit(clone.cwd, { 'segredo.md': 'história privada\n' }, 'Início privado')
    git(clone.cwd, ['checkout', '-q', 'main'])
    commit(clone.cwd, { 'src/a.ts': 'export {}\n' }, 'Ajuste limpo')
    expect(check(clone)).toEqual([expect.stringMatching(/guarda 1 história\(s\) além da pública/)])
  })

  it('merge com história alheia é barrado mesmo depois de apagar a branch dela', () => {
    const clone = publicClone()
    git(clone.cwd, ['checkout', '-q', '--orphan', 'alheia'])
    git(clone.cwd, ['rm', '-q', '-rf', '.'])
    commit(clone.cwd, { 'outro.md': 'outra história\n' }, 'Outra raiz')
    git(clone.cwd, ['checkout', '-q', 'main'])
    git(clone.cwd, ['merge', '-q', '--allow-unrelated-histories', '-m', 'Junta', 'alheia'])
    git(clone.cwd, ['branch', '-q', '-D', 'alheia'])
    expect(check(clone)).not.toEqual([])
  })

  it('sem lista de termos o push é recusado; quem contribui pode abrir mão explicitamente', () => {
    const clone = publicClone()
    commit(clone.cwd, { 'src/a.ts': 'export {}\n' }, 'Ajuste')
    expect(check(clone, { terms: null })).toEqual([
      expect.stringMatching(/lista de termos não foi encontrada/)
    ])
    expect(check(clone, { terms: null, allowWithoutList: true })).toEqual([])
  })

  it('o hook de pre-push barra o push de verdade, e o remoto não recebe nada', () => {
    const clone = publicClone()
    const lista = join(clone.cwd, '..', 'lista.txt')
    writeFileSync(lista, 'Fabri' + 'kam\n')
    commit(clone.cwd, { 'docs/notas.md': 'cliente ' + 'Fabri' + 'kam\n' }, 'Notas')
    const before = git(clone.remote, ['rev-parse', 'main']).trim()

    let failed = false
    try {
      execFileSync(
        'git',
        ['-c', `core.hooksPath=${join(ROOT, '.githooks')}`, 'push', '-q', 'origin', 'main'],
        {
          cwd: clone.cwd,
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
          env: { ...process.env, PO_NEUTRAL_DENYLIST: lista }
        }
      )
    } catch {
      failed = true
    }
    expect(failed).toBe(true)
    expect(git(clone.remote, ['rev-parse', 'main']).trim()).toBe(before)
  })
})
