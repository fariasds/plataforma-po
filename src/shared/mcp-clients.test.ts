import { describe, expect, it } from 'vitest'
import { MCP_CLIENTS, clientSnippet, serverArgs, type McpLaunch } from './mcp-clients'

const packaged: McpLaunch = {
  command:
    'C:\\Users\\marina\\AppData\\Local\\Programs\\Plataforma do PO\\plataforma-po-desktop.exe',
  appArgs: [],
  profileId: 'fabrikam'
}

describe('trecho para conectar a IA do PO (RN-CFG-13)', () => {
  it('os argumentos prendem o servidor ao Perfil', () => {
    expect(serverArgs(packaged)).toEqual(['--mcp', '--perfil', 'fabrikam'])
    expect(serverArgs({ ...packaged, appArgs: ['D:\\app'] })).toEqual([
      'D:\\app',
      '--mcp',
      '--perfil',
      'fabrikam'
    ])
  })

  it('Claude Desktop e Cursor recebem mcpServers com o caminho exato', () => {
    for (const client of ['claude-desktop', 'cursor'] as const) {
      const parsed = JSON.parse(clientSnippet(client, packaged) as string)
      expect(parsed).toEqual({
        mcpServers: {
          'plataforma-po': { command: packaged.command, args: ['--mcp', '--perfil', 'fabrikam'] }
        }
      })
    }
  })

  it('VS Code recebe servers com type stdio', () => {
    const parsed = JSON.parse(clientSnippet('vscode', packaged) as string)
    expect(parsed.servers['plataforma-po']).toMatchObject({
      type: 'stdio',
      command: packaged.command
    })
  })

  it('Claude Code recebe um comando com o caminho entre aspas, por ter espaço', () => {
    expect(clientSnippet('claude-code', packaged)).toBe(
      `claude mcp add plataforma-po --scope user -- "${packaged.command}" --mcp --perfil fabrikam`
    )
  })

  it('ChatGPT e outras IAs na web não têm trecho: o app não tem servidor na internet', () => {
    expect(clientSnippet('other', packaged)).toBeNull()
  })

  it('nenhum trecho leva token: só o caminho, os argumentos e o Perfil', () => {
    for (const client of MCP_CLIENTS) {
      const snippet = clientSnippet(client, packaged) ?? ''
      expect(snippet).not.toMatch(/token|pat|password|secret/i)
    }
  })
})
