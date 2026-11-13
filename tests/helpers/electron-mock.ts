import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

/**
 * Substituto de `electron` para testes do processo principal.
 *
 * Uso, no topo do arquivo de teste (o `vi.mock` é içado, por isso o import dinâmico):
 *
 *   vi.mock('electron', async () => (await import('../helpers/electron-mock')).electronMock)
 *
 * - `app.getPath` aponta para um diretório temporário, recriado por `resetElectronMock`.
 * - `safeStorage` cifra de forma reversível e marcada, para o teste distinguir texto
 *   cifrado de texto puro; `setEncryptionAvailable(false)` simula SO sem criptografia.
 */

const PREFIX = 'mock-encrypted:'

let userDataDir = mkdtempSync(join(tmpdir(), 'po-test-'))
let encryptionAvailable = true

export const electronMock = {
  // O aviso de estado do Perfil percorre as janelas; em teste não há nenhuma.
  BrowserWindow: {
    getAllWindows: (): unknown[] => []
  },
  app: {
    getPath: (): string => userDataDir,
    getVersion: (): string => '0.0.0-test',
    isPackaged: false
  },
  safeStorage: {
    isEncryptionAvailable: (): boolean => encryptionAvailable,
    encryptString: (plain: string): Buffer => {
      if (!encryptionAvailable) throw new Error('Encryption is not available')
      return Buffer.from(PREFIX + Buffer.from(plain, 'utf8').toString('base64'), 'utf8')
    },
    decryptString: (encrypted: Buffer): string => {
      const text = encrypted.toString('utf8')
      if (!text.startsWith(PREFIX)) throw new Error('Not encrypted by safeStorage mock')
      return Buffer.from(text.slice(PREFIX.length), 'base64').toString('utf8')
    }
  }
}

export function setEncryptionAvailable(available: boolean): void {
  encryptionAvailable = available
}

export function getUserDataDir(): string {
  return userDataDir
}

/** Apaga o diretório temporário, cria outro e religa a criptografia. */
export function resetElectronMock(): void {
  rmSync(userDataDir, { recursive: true, force: true })
  userDataDir = mkdtempSync(join(tmpdir(), 'po-test-'))
  encryptionAvailable = true
}
