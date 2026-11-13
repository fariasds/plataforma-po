import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppError, serializeError } from '@shared/errors'
import {
  installConsoleRedaction,
  redact,
  REDACTED,
  rememberSecret
} from '../../src/main/security/redact'

// RN-SEC-19: o PAT não aparece em log nem em erro serializado.
//
// Os valores abaixo são montados em partes para o próprio arquivo não disparar o
// hook de pre-commit — e não são tokens reais.

const AZURE_CLASSIC_PAT = 'abcdefghijklmnopqrstuvwxyz234567'.repeat(2).slice(0, 52)
const AZURE_NEW_PAT = 'A1b2C3d4'.repeat(10).slice(0, 76) + 'AZDO' + 'x9Y8'
const GITHUB_TOKEN = 'gh' + 'p_' + 'A1b2C3d4E5'.repeat(4).slice(0, 36)
const GITHUB_FINE = 'github' + '_pat_' + 'A1b2_C3d4E5'.repeat(6).slice(0, 62)
const BASIC = Buffer.from(`:${AZURE_CLASSIC_PAT}`).toString('base64')

// Fora de toda forma conhecida: só a rede do segredo conhecido o pega.
const KNOWN_PAT = ['FAKE', 'contoso', 'pat', 'Q'.repeat(24)].join('-')

describe('RN-SEC-19: redação de segredos', () => {
  it.each([
    ['PAT clássico do Azure', `token=${AZURE_CLASSIC_PAT};`, AZURE_CLASSIC_PAT],
    ['PAT novo do Azure', `x ${AZURE_NEW_PAT} y`, AZURE_NEW_PAT],
    ['token do GitHub', `usa ${GITHUB_TOKEN}`, GITHUB_TOKEN],
    ['token refinado do GitHub', `usa ${GITHUB_FINE}`, GITHUB_FINE],
    ['cabeçalho Basic', `falhou com Basic ${BASIC}`, BASIC],
    ['Authorization em JSON', `{"Authorization":"qualquer-coisa-123"}`, 'qualquer-coisa-123'],
    ['Authorization em texto', 'Authorization: segredo-curto', 'segredo-curto']
  ])('apaga %s', (_case, text, secret) => {
    const result = redact(text)
    expect(result).not.toContain(secret)
    expect(result).toContain(REDACTED)
  })

  it('apaga o PAT conhecido, cru e em base64, mesmo fora das formas', () => {
    const b64 = Buffer.from(`:${KNOWN_PAT}`).toString('base64')
    const text = `cru ${KNOWN_PAT} codificado ${b64}`
    expect(redact(text)).toContain(KNOWN_PAT)
    expect(redact(text, [KNOWN_PAT])).not.toContain(KNOWN_PAT)
    expect(redact(text, [KNOWN_PAT])).not.toContain(b64)
  })

  it('um PAT usado pelo cliente passa a ser apagado sem ser informado', () => {
    const pat = ['FAKE', 'lembrado', 'Z'.repeat(20)].join('-')
    rememberSecret(pat)
    expect(redact(`erro com ${pat}`)).toBe(`erro com ${REDACTED}`)
  })

  it('não mexe em texto comum', () => {
    const text = 'Azure DevOps respondeu 500 Internal Server Error em /_apis/projects.'
    expect(redact(text)).toBe(text)
  })

  it('um erro lançado com o PAT na mensagem sai redigido de serializeError', () => {
    const pat = ['FAKE', 'serializado', 'W'.repeat(20)].join('-')
    rememberSecret(pat)
    const plain = serializeError(new Error(`falhou com ${pat}`), (t) => redact(t))
    const app = serializeError(
      new AppError('AZURE_REQUEST_FAILED', `status Authorization: Basic ${BASIC}`),
      (t) => redact(t)
    )
    expect(plain).toEqual({ code: 'UNEXPECTED', message: `falhou com ${REDACTED}` })
    expect(app.code).toBe('AZURE_REQUEST_FAILED')
    expect(app.message).not.toContain(BASIC)
    expect(serializeError(`lançou texto ${AZURE_CLASSIC_PAT}`, redact).message).not.toContain(
      AZURE_CLASSIC_PAT
    )
  })
})

describe('RN-SEC-19: o console do main passa pela redação', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('texto, erro e objeto saem sem o segredo', () => {
    const written: string[] = []
    const methods = ['log', 'warn', 'error'] as const
    for (const method of methods) {
      vi.spyOn(console, method).mockImplementation((...args: unknown[]) => {
        written.push(args.map(String).join(' '))
      })
    }
    installConsoleRedaction()

    const pat = ['FAKE', 'console', 'V'.repeat(20)].join('-')
    rememberSecret(pat)
    console.log(`texto ${pat}`)
    console.error('falhou:', new Error(`erro ${pat}`, { cause: `causa ${pat}` }))
    console.warn({ headers: { Authorization: `Basic ${BASIC}` } })

    expect(written).toHaveLength(3)
    for (const line of written) {
      expect(line).not.toContain(pat)
      expect(line).not.toContain(BASIC)
    }
  })
})
