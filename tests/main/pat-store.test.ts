import { readFileSync } from 'fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resetElectronMock, setEncryptionAvailable } from '../helpers/electron-mock'

vi.mock('electron', async () => (await import('../helpers/electron-mock')).electronMock)

const { clearPat, hasPat, loadPat, requirePat, savePat } =
  await import('../../src/main/security/pat-store')
const { createProfile } = await import('../../src/main/profile/profile-store')
const { secretPath } = await import('../../src/main/profile/paths')

// Um arquivo por Perfil, em segredos/<id>.bin. Valor fictício.
const FAKE_PAT = 'contoso-fake-pat'

describe('pat-store', () => {
  beforeEach(() => {
    resetElectronMock()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('sem Perfil, não há PAT e gravar é recusado', () => {
    expect(hasPat()).toBe(false)
    expect(loadPat()).toBeNull()
    expect(() => savePat(FAKE_PAT)).toThrow(expect.objectContaining({ code: 'PROFILE_MISSING' }))
  })

  it('sem arquivo, não há PAT', () => {
    createProfile({ name: 'Contoso', organization: 'contoso' })
    expect(hasPat()).toBe(false)
    expect(loadPat()).toBeNull()
    expect(() => requirePat()).toThrow(expect.objectContaining({ code: 'PAT_MISSING' }))
  })

  it('grava cifrado no Perfil ativo e lê de volta', () => {
    const { id } = createProfile({ name: 'Contoso', organization: 'contoso' })
    savePat(FAKE_PAT)
    expect(hasPat()).toBe(true)
    expect(readFileSync(secretPath(id), 'utf8')).not.toContain(FAKE_PAT)
    expect(loadPat()).toBe(FAKE_PAT)
    expect(requirePat()).toBe(FAKE_PAT)
  })

  it('cada Perfil tem o próprio token', () => {
    const first = createProfile({ name: 'Contoso', organization: 'contoso' })
    const second = createProfile({ name: 'Fabrikam', organization: 'fabrikam' })
    savePat(FAKE_PAT, first.id)
    expect(hasPat(first.id)).toBe(true)
    expect(hasPat(second.id)).toBe(false)
    // O ativo é o último criado.
    expect(loadPat()).toBeNull()
  })

  it('recusa gravar sem criptografia do sistema', () => {
    createProfile({ name: 'Contoso', organization: 'contoso' })
    setEncryptionAvailable(false)
    expect(() => savePat(FAKE_PAT)).toThrow(
      expect.objectContaining({ code: 'ENCRYPTION_UNAVAILABLE' })
    )
    expect(hasPat()).toBe(false)
  })

  it('clearPat apaga, e apagar de novo não falha', () => {
    createProfile({ name: 'Contoso', organization: 'contoso' })
    savePat(FAKE_PAT)
    clearPat()
    expect(hasPat()).toBe(false)
    expect(() => clearPat()).not.toThrow()
  })
})
