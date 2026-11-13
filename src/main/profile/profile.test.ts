import { existsSync, readdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { validateConfiguration } from '@shared/config/validate'
import type { ProfileState } from '@shared/ipc'
import { getUserDataDir, resetElectronMock } from '../../../tests/helpers/electron-mock'

vi.mock('electron', async () => (await import('../../../tests/helpers/electron-mock')).electronMock)

const { createProfile, getActiveProfile, listProfiles } = await import('./profile-store')
const {
  getActiveConfig,
  getProfileState,
  importConfiguration,
  onProfileStateChanged,
  reloadProfileState,
  resetConfigLoader
} = await import('./config-loader')
const { readWorkData, workDataKey, writeWorkData } = await import('./work-data')
const { savePat } = await import('../security/pat-store')
const { configPath, workDataDir } = await import('./paths')

// Valores fictícios (organização `contoso`).
const FAKE_PAT = 'contoso-fake-pat'
const example = readFileSync('examples/exemplo-scrum.json', 'utf8')

function createReadyProfile(): string {
  const { id } = createProfile({ name: 'Contoso', organization: 'contoso' })
  savePat(FAKE_PAT, id)
  return id
}

function writeConfig(id: string, content: string): void {
  writeFileSync(configPath(id), content)
}

beforeEach(() => {
  resetConfigLoader()
  resetElectronMock()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  resetConfigLoader()
})

describe('profile-store', () => {
  it('sem perfis.json, não há Perfil', () => {
    expect(getActiveProfile()).toBeNull()
    expect(getProfileState().status).toBe('no-profile')
  })

  it('createProfile gera uma Configuração válida, com Scrum e nenhum Produto', () => {
    const profile = createProfile({ name: 'Contoso', organization: 'contoso' })
    const raw = JSON.parse(readFileSync(configPath(profile.id), 'utf8'))
    const result = validateConfiguration(raw)

    expect(result.ok, JSON.stringify(result)).toBe(true)
    expect(raw.organization).toBe('contoso')
    expect(raw.products).toEqual([])
    expect(Object.keys(raw.processProfiles)).toEqual(['scrum'])
  })

  it('copia o template e torna o Perfil ativo', () => {
    const profile = createProfile({ name: 'Contoso', organization: 'contoso' })
    expect(readdirSync(profile.dir).sort()).toEqual(
      ['AGENTS.md', 'configuracao.json', 'configuracao.schema.json', 'dados'].sort()
    )
    expect(readFileSync(join(profile.dir, 'configuracao.schema.json'), 'utf8')).toBe(
      readFileSync('resources/profile-template/configuracao.schema.json', 'utf8')
    )
    expect(getActiveProfile()?.id).toBe(profile.id)
  })

  it('gera IDs em slug e distintos para o mesmo nome', () => {
    const first = createProfile({ name: 'Loja Online — Açaí', organization: 'contoso' })
    const second = createProfile({ name: 'Loja Online — Açaí', organization: 'contoso' })
    expect(first.id).toBe('loja-online-acai')
    expect(second.id).toBe('loja-online-acai-2')
    expect(listProfiles()).toHaveLength(2)
    expect(getActiveProfile()?.id).toBe(second.id)
  })

  it('recusa organização em forma de URL sem criar pasta nenhuma', () => {
    expect(() =>
      createProfile({ name: 'Contoso', organization: 'https://dev.azure.com/contoso' })
    ).toThrow(expect.objectContaining({ code: 'PROFILE_INVALID' }))
    expect(readdirSync(getUserDataDir())).toEqual([])
  })

  it('perfis.json corrompido é erro, não ausência', () => {
    writeFileSync(join(getUserDataDir(), 'perfis.json'), '{ quebrado')
    expect(() => getActiveProfile()).toThrow(expect.objectContaining({ code: 'PROFILE_CORRUPT' }))
  })
})

describe('config-loader', () => {
  it('Perfil sem PAT fica em needs-pat', () => {
    createProfile({ name: 'Contoso', organization: 'contoso' })
    expect(reloadProfileState().status).toBe('needs-pat')
  })

  it('carrega a Configuração válida', () => {
    const id = createReadyProfile()
    writeConfig(id, example)
    const state = reloadProfileState()
    expect(state.status).toBe('ready')
    expect(state.errors).toEqual([])
    expect(state.config?.products.map((p) => p.id)).toEqual(['loja', 'app'])
    expect(getActiveConfig()?.organization).toBe('contoso')
  })

  it('RN-CFG-07: arquivo inválido mantém a última versão válida e publica os erros', () => {
    const id = createReadyProfile()
    writeConfig(id, example)
    reloadProfileState()

    writeConfig(id, example.replace('"Loja Online"', '""'))
    const state = reloadProfileState()

    expect(state.status).toBe('ready')
    expect(state.errors.map((e) => e.path)).toContain('products[0].name')
    expect(state.config?.products[0].name).toBe('Loja Online')
    expect(getActiveConfig()?.products[0].name).toBe('Loja Online')
  })

  it('sem nenhuma versão válida, o estado é invalid-config', () => {
    const id = createReadyProfile()
    writeConfig(id, '{ "version": 2 }')
    resetConfigLoader()
    const state = reloadProfileState()
    expect(state.status).toBe('invalid-config')
    expect(state.config).toBeNull()
    expect(state.errors.length).toBeGreaterThan(0)
  })

  it('JSON quebrado aponta a posição sem repetir o conteúdo', () => {
    const id = createReadyProfile()
    const marker = 'trecho-que-nao-pode-vazar'
    writeConfig(id, `{ "version": 1, "organization": "${marker}" "x": 1 }`)
    resetConfigLoader()
    const state = reloadProfileState()
    expect(state.errors).toHaveLength(1)
    expect(state.errors[0].message).toMatch(/não é um JSON válido/)
    expect(JSON.stringify(state)).not.toContain(marker)
  })

  it('recarrega sozinho quando o arquivo muda, e volta ao normal quando é corrigido', async () => {
    const id = createReadyProfile()
    writeConfig(id, example)
    reloadProfileState()

    const seen: ProfileState[] = []
    onProfileStateChanged((state) => seen.push(state))

    writeConfig(id, example.replace('"Loja Online"', '""'))
    await vi.waitFor(() => expect(seen.at(-1)?.errors.length).toBeGreaterThan(0), {
      timeout: 5000
    })
    expect(seen.at(-1)?.config?.products[0].name).toBe('Loja Online')

    writeConfig(id, example.replace('"Loja Online"', '"Loja Nova"'))
    await vi.waitFor(() => expect(seen.at(-1)?.config?.products[0].name).toBe('Loja Nova'), {
      timeout: 5000
    })
    expect(seen.at(-1)?.errors).toEqual([])
  })

  it('importConfig recusa JSON inválido sem gravar', () => {
    const id = createReadyProfile()
    const before = readFileSync(configPath(id), 'utf8')
    const result = importConfiguration(example.replace('"contoso"', '"https://x.example"'))
    expect(result.saved).toBe(false)
    expect(readFileSync(configPath(id), 'utf8')).toBe(before)
  })

  it('importConfig grava o JSON válido e aponta os IDs que sumiram', () => {
    const id = createReadyProfile()
    writeConfig(id, example)
    reloadProfileState()

    const renamed = example
      .replace('"id": "loja"', '"id": "loja2"')
      .replace('["loja", "app"]', '["loja2", "app"]')
    const result = importConfiguration(renamed)

    expect(result).toEqual({ saved: true, removed: { products: ['loja'], groups: [] } })
    expect(getActiveConfig()?.products[0].id).toBe('loja2')
  })
})

describe('work-data', () => {
  it('grava e lê de volta; chave nunca gravada é null', () => {
    const id = createReadyProfile()
    expect(readWorkData(id, 'planning:loja')).toBeNull()
    writeWorkData(id, 'planning:loja', { itens: [1, 2] })
    expect(readWorkData(id, 'planning:loja')).toEqual({ itens: [1, 2] })
    // Nada de temporário deixado para trás.
    expect(readdirSync(workDataDir(id))).toEqual(['planning%3Aloja.json'])
  })

  it.each(['../x', '..', 'a/b', 'a\\b', 'C:x', 'Loja', '', 'a'.repeat(121), 'a.json'])(
    'recusa a chave %j',
    (key) => {
      const id = createReadyProfile()
      expect(() => writeWorkData(id, key, 1)).toThrow(
        expect.objectContaining({ code: 'WORK_DATA_INVALID_KEY' })
      )
      expect(() => readWorkData(id, key)).toThrow(
        expect.objectContaining({ code: 'WORK_DATA_INVALID_KEY' })
      )
    }
  )

  it('recusa valor acima de 1 MB', () => {
    const id = createReadyProfile()
    expect(() => writeWorkData(id, 'grande', 'x'.repeat(1024 * 1024))).toThrow(
      expect.objectContaining({ code: 'WORK_DATA_INVALID_VALUE' })
    )
    expect(existsSync(join(workDataDir(id), 'grande.json'))).toBe(false)
  })

  it('RN-CFG-08: a chave de Produto usa o ID', () => {
    expect(workDataKey('capacity', 'LojaOnline')).toBe('capacity:lojaonline')
    expect(() => workDataKey('capacity', '../x')).toThrow(
      expect.objectContaining({ code: 'WORK_DATA_INVALID_KEY' })
    )
  })
})
