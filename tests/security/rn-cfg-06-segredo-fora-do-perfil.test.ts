import { existsSync, readdirSync, readFileSync } from 'fs'
import { extname, join, relative } from 'path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getUserDataDir, resetElectronMock } from '../helpers/electron-mock'

vi.mock('electron', async () => (await import('../helpers/electron-mock')).electronMock)

const { createProfile } = await import('../../src/main/profile/profile-store')
const { secretPath } = await import('../../src/main/profile/paths')
const { writeWorkData } = await import('../../src/main/profile/work-data')
const { loadPat, savePat } = await import('../../src/main/security/pat-store')

/**
 * RN-CFG-06: o PAT mora fora da pasta do Perfil. A pasta é a que o app abre
 * para o PO e para a IA dele — nada nela pode conter o segredo, nem cifrado.
 * Valor fictício.
 */
const FAKE_PAT = 'contoso-fake-pat-rn-cfg-06'

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name)
    return entry.isDirectory() ? files(full) : [full]
  })
}

describe('RN-CFG-06: o segredo fica fora da pasta do Perfil', () => {
  beforeEach(() => {
    resetElectronMock()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('depois de createProfile e savePat, a pasta do Perfil não tem .bin nem o PAT', () => {
    const profile = createProfile({ name: 'Contoso', organization: 'contoso' })
    savePat(FAKE_PAT, profile.id)
    writeWorkData(profile.id, 'capacity:loja', { frontDevs: 2 })

    // O PAT foi mesmo guardado — senão a varredura abaixo passaria à toa.
    expect(loadPat(profile.id)).toBe(FAKE_PAT)
    const encrypted = readFileSync(secretPath(profile.id))

    const inside = files(profile.dir)
    expect(inside.length).toBeGreaterThan(0)
    expect(inside.filter((file) => extname(file) === '.bin')).toEqual([])
    for (const file of inside) {
      const content = readFileSync(file)
      expect(content.includes(FAKE_PAT), relative(profile.dir, file)).toBe(false)
      expect(content.includes(encrypted), relative(profile.dir, file)).toBe(false)
    }
  })

  it('o arquivo do segredo não está dentro de nenhuma pasta de Perfil', () => {
    const profile = createProfile({ name: 'Contoso', organization: 'contoso' })
    savePat(FAKE_PAT, profile.id)

    const secret = secretPath(profile.id)
    expect(existsSync(secret)).toBe(true)
    const fromProfiles = relative(join(getUserDataDir(), 'perfis'), secret)
    expect(fromProfiles.startsWith('..')).toBe(true)
  })
})
