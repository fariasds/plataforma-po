/**
 * O que o PO cola na IA dele para conectá-la ao app (RN-CFG-13). O main diz onde
 * está o executável e qual é o Perfil; daqui sai o trecho pronto para cada cliente
 * de IA. Lógica pura, para o trecho ser provado por teste.
 */

/** Como o cliente de IA inicia o servidor MCP: o executável, os argumentos e o Perfil. */
export interface McpLaunch {
  /** Caminho do executável do app nesta máquina. */
  command: string
  /** Argumentos que vêm antes do `--mcp`: em desenvolvimento, a pasta do app. */
  appArgs: string[]
  profileId: string
}

export const MCP_CLIENTS = ['claude-desktop', 'claude-code', 'cursor', 'vscode', 'other'] as const

export type McpClient = (typeof MCP_CLIENTS)[number]

/** O nome do servidor na IA do PO, o mesmo em todo cliente. */
export const MCP_SERVER_KEY = 'plataforma-po'

export function serverArgs(launch: McpLaunch): string[] {
  return [...launch.appArgs, '--mcp', '--perfil', launch.profileId]
}

/**
 * Aspas do PowerShell, o terminal padrão do Windows, só onde precisa (caminho
 * com espaço, como "Plataforma do PO"). Entre aspas simples, o PowerShell não
 * interpreta nada: nem `$`, nem crase, nem barra invertida. O único caractere
 * especial é a própria aspa simples, escrita dobrada; com isso o escape é
 * completo, e um nome de usuário como O'Brien no caminho continua certo.
 */
export function powershellQuote(value: string): string {
  return /^[\w.:\\/-]+$/.test(value) ? value : `'${value.replace(/'/g, "''")}'`
}

function jsonSnippet(root: string, entry: Record<string, unknown>): string {
  return JSON.stringify({ [root]: { [MCP_SERVER_KEY]: entry } }, null, 2)
}

/**
 * O trecho para o cliente, ou `null` para quem não tem MCP local (o ChatGPT só
 * se conecta a servidores na internet, e o app não tem servidor).
 */
export function clientSnippet(client: McpClient, launch: McpLaunch): string | null {
  const args = serverArgs(launch)
  switch (client) {
    case 'claude-desktop':
    case 'cursor':
      return jsonSnippet('mcpServers', { command: launch.command, args })
    case 'vscode':
      return jsonSnippet('servers', { type: 'stdio', command: launch.command, args })
    case 'claude-code':
      return [
        'claude mcp add',
        MCP_SERVER_KEY,
        '--scope user --',
        powershellQuote(launch.command),
        ...args.map(powershellQuote)
      ].join(' ')
    case 'other':
      return null
  }
}
