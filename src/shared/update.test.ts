import { describe, expect, it } from 'vitest'
import {
  isNewerVersion,
  parseVersion,
  readLatestRelease,
  releaseLinkUrl,
  toUpdateCheck
} from './update'

// RN-GLB-18: quando a faixa de versão nova aparece.

describe('isNewerVersion', () => {
  it.each([
    ['1.2.0', '1.1.0', true],
    ['1.10.0', '1.9.3', true],
    ['2.0.0', '1.99.99', true],
    ['1.1.1', '1.1.0', true],
    ['1.1.0', '1.1.0', false],
    ['1.0.9', '1.1.0', false],
    ['1.2.0-beta', '1.1.0', false],
    ['1.2', '1.1.0', false],
    ['1.2.0', '0.0.0-test', false]
  ])('%s é mais nova que %s? %s', (candidate, installed, expected) => {
    expect(isNewerVersion(candidate, installed)).toBe(expected)
  })

  it('recusa zero à esquerda e espaço', () => {
    expect(parseVersion('01.2.0')).toBeNull()
    expect(parseVersion(' 1.2.0')).toBeNull()
  })
})

describe('readLatestRelease', () => {
  it('lê a versão e se o instalador dela está anexado', () => {
    expect(
      readLatestRelease({
        tag_name: 'v1.2.0',
        assets: [{ name: 'plataforma-po-desktop-1.2.0-setup.exe' }, { name: 'laudo.sha256' }]
      })
    ).toEqual({ version: '1.2.0', hasInstaller: true })
  })

  it('instalador de outra versão não conta', () => {
    expect(
      readLatestRelease({
        tag_name: 'v1.2.0',
        assets: [{ name: 'plataforma-po-desktop-1.1.0-setup.exe' }]
      })
    ).toEqual({ version: '1.2.0', hasInstaller: false })
  })

  it.each([
    null,
    'texto',
    {},
    { tag_name: 3 },
    { tag_name: 'v1.2.0', draft: true },
    { tag_name: 'v1.2.0', prerelease: true }
  ])('fora do formato: %j', (body) => {
    expect(readLatestRelease(body)).toBeNull()
  })
})

describe('toUpdateCheck', () => {
  it('sem resposta, não sabe', () => {
    expect(toUpdateCheck('1.1.0', null)).toEqual({ status: 'unknown', installed: '1.1.0' })
  })

  it('versão igual ou mais antiga não avisa', () => {
    expect(toUpdateCheck('1.2.0', { version: '1.1.0', hasInstaller: true }).status).toBe(
      'up-to-date'
    )
  })

  it('versão mais nova avisa', () => {
    expect(toUpdateCheck('1.1.0', { version: '1.2.0', hasInstaller: true })).toEqual({
      status: 'available',
      installed: '1.1.0',
      latest: '1.2.0',
      hasInstaller: true
    })
  })
})

describe('releaseLinkUrl', () => {
  it('monta a página e o instalador da versão', () => {
    expect(releaseLinkUrl('release', '1.2.0')).toBe(
      'https://github.com/fariasds/plataforma-po/releases/tag/v1.2.0'
    )
    expect(releaseLinkUrl('installer', '1.2.0')).toBe(
      'https://github.com/fariasds/plataforma-po/releases/download/v1.2.0/plataforma-po-desktop-1.2.0-setup.exe'
    )
  })
})
