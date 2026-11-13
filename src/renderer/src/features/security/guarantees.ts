/**
 * O que a tela Segurança promete, e a prova de cada promessa. Toda regra citada
 * aqui precisa existir em `docs/regras-de-negocio/` e todo arquivo de prova
 * precisa existir no repositório: `guarantees.test.ts`, ao lado,
 * confere, para a tela nunca prometer o que o código não prova.
 */
export interface Guarantee {
  key:
    | 'network'
    | 'encryption'
    | 'ui'
    | 'readOnly'
    | 'logs'
    | 'config'
    | 'links'
    | 'noProcess'
    | 'window'
    | 'installer'
  rules: readonly string[]
  /** Caminhos no repositório: o teste, ou a esteira quando a prova não é teste. */
  proof: readonly string[]
}

export const GUARANTEES: readonly Guarantee[] = [
  {
    key: 'network',
    rules: ['RN-SEC-18'],
    proof: ['tests/security/rn-sec-18-fronteira-de-rede.test.ts']
  },
  {
    key: 'encryption',
    rules: ['RN-SEC-09', 'RN-CFG-06'],
    proof: [
      'tests/security/rn-sec-09-cifragem-obrigatoria.test.ts',
      'tests/security/rn-cfg-06-segredo-fora-do-perfil.test.ts'
    ]
  },
  {
    key: 'ui',
    rules: ['RN-SEC-10'],
    proof: [
      'tests/security/rn-sec-10-contrato-ipc.test.ts',
      'tests/security/rn-sec-10-envelopes-sem-pat.test.ts'
    ]
  },
  {
    key: 'readOnly',
    rules: ['RN-SEC-20'],
    proof: ['tests/security/rn-sec-20-somente-leitura.test.ts']
  },
  { key: 'logs', rules: ['RN-SEC-19'], proof: ['tests/security/rn-sec-19-redacao.test.ts'] },
  {
    key: 'config',
    rules: ['RN-CFG-04', 'RN-CFG-05'],
    proof: [
      'tests/security/rn-cfg-04-organizacao-por-nome.test.ts',
      'tests/security/rn-cfg-05-sem-segredo.test.ts'
    ]
  },
  {
    key: 'links',
    rules: ['RN-SEC-21'],
    proof: ['tests/security/rn-sec-21-links-externos.test.ts']
  },
  {
    key: 'noProcess',
    rules: ['RN-SEC-23', 'RN-SEC-24'],
    proof: [
      'tests/security/rn-sec-23-fronteira-de-processo.test.ts',
      'tests/security/rn-sec-24-dado-minimo-para-ia.test.ts'
    ]
  },
  {
    key: 'window',
    rules: ['RN-SEC-29', 'RN-SEC-30'],
    proof: [
      'tests/security/rn-sec-29-janela-endurecida.test.ts',
      'tests/security/rn-sec-30-varredura-electron.test.ts'
    ]
  },
  { key: 'installer', rules: ['RN-SEC-22'], proof: ['.github/workflows/release.yml'] }
]

/** Os limites que a tela declara, na ordem em que aparecem. */
export const LIMITS = ['malware', 'session', 'scope', 'ai', 'signing', 'updates'] as const

/** Os comandos de conferência que a tela oferece para copiar. */
export const VERIFY_HASH_COMMAND =
  '(Get-FileHash .\\plataforma-po-desktop-{version}-setup.exe -Algorithm SHA256).Hash.ToLower()'
export const VERIFY_TESTS_COMMAND = 'npm ci && npm run verify:security && npm run verify:electron'
