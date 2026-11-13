import { readdirSync } from 'fs'
import { join, relative } from 'path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getUserDataDir, resetElectronMock, setEncryptionAvailable } from '../helpers/electron-mock'

vi.mock('electron', async () => (await import('../helpers/electron-mock')).electronMock)

const { createProfile } = await import('../../src/main/profile/profile-store')
const { hasPat, savePat } = await import('../../src/main/security/pat-store')

/**
 * RN-SEC-09: sem a cifragem do sistema operacional, o PAT não é guardado — nem
 * em texto puro, nem em arquivo provisório. Valor fictício.
 */
const FAKE_PAT = 'contoso-fake-pat'

function tree(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name)
    const path = relative(getUserDataDir(), full)
    return entry.isDirectory() ? [path + '/', ...tree(full)] : [path]
  })
}

describe('RN-SEC-09: sem cifragem, o PAT não é gravado', () => {
  beforeEach(() => {
    resetElectronMock()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('savePat recusa com ENCRYPTION_UNAVAILABLE e nenhum arquivo é criado', () => {
    const profile = createProfile({ name: 'Contoso', organization: 'contoso' })
    const before = tree(getUserDataDir())

    setEncryptionAvailable(false)
    expect(() => savePat(FAKE_PAT, profile.id)).toThrow(
      expect.objectContaining({ code: 'ENCRYPTION_UNAVAILABLE' })
    )

    expect(tree(getUserDataDir())).toEqual(before)
    expect(hasPat(profile.id)).toBe(false)
  })

  it('a recusa vem antes de qualquer outra checagem, mesmo sem Perfil', () => {
    setEncryptionAvailable(false)
    expect(() => savePat(FAKE_PAT)).toThrow(
      expect.objectContaining({ code: 'ENCRYPTION_UNAVAILABLE' })
    )
    expect(tree(getUserDataDir())).toEqual([])
  })
})
