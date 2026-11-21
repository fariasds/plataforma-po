/**
 * Como o executável foi chamado (ADR 0010). Sem `--mcp`, é o app de sempre, com
 * janela. Com `--mcp`, é o servidor da IA do PO, preso ao Perfil de `--perfil`.
 *
 * Lógica pura sobre o `argv`, para o `index.ts` decidir antes de qualquer outra
 * coisa — inclusive da trava de instância única, que não vale para o servidor.
 */

export type LaunchMode =
  { mode: 'window' } | { mode: 'mcp'; profileId: string } | { mode: 'mcp-error'; message: string }

const PROFILE_FLAG = '--perfil'

export function launchMode(argv: readonly string[]): LaunchMode {
  if (!argv.includes('--mcp')) return { mode: 'window' }

  // Aceita "--perfil contoso" e "--perfil=contoso".
  const inline = argv.find((arg) => arg.startsWith(`${PROFILE_FLAG}=`))
  const index = argv.indexOf(PROFILE_FLAG)
  const profileId = inline
    ? inline.slice(PROFILE_FLAG.length + 1)
    : index >= 0
      ? argv[index + 1]
      : undefined

  if (!profileId || profileId.startsWith('--')) {
    return {
      mode: 'mcp-error',
      message:
        'Informe o Perfil: --mcp --perfil <id>. A tela "Conectar à sua IA" do app mostra o comando pronto.'
    }
  }
  return { mode: 'mcp', profileId }
}
