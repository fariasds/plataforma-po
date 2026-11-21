import { existsSync } from 'fs'
import { configPath } from '../profile/paths'
import type { McpServerSpec } from './protocol'

/**
 * O servidor MCP da Plataforma do PO (ADR 0010). Ele só conhece a pasta do Perfil
 * em que foi preso: não faz rede, não lê o PAT (RN-SEC-34) e não importa nada do
 * caminho do Azure. As barreiras são conferidas em `tests/security/`.
 */

export const SERVER_NAME = 'plataforma-po'

/** O Perfil precisa existir: um ID errado não pode criar pasta nem arquivo. */
export function assertMcpProfile(profileId: string): void {
  // `configPath` recusa qualquer coisa que não seja um ID de Perfil (`..`, barra).
  if (!existsSync(configPath(profileId))) {
    throw new Error(
      `O Perfil "${profileId}" não existe nesta máquina. Confira o comando na tela "Conectar à sua IA" do app.`
    )
  }
}

export function buildServerSpec(profileId: string, version: string): McpServerSpec {
  assertMcpProfile(profileId)
  return {
    name: SERVER_NAME,
    title: 'Plataforma do PO',
    version,
    instructions:
      'Servidor da Plataforma do PO, preso a um Perfil. Ele não tem acesso ao Azure DevOps nem ao token (PAT): nunca peça o token ao PO.',
    tools: [],
    prompts: [],
    resources: []
  }
}
