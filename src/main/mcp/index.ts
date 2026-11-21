import { existsSync } from 'fs'
import agentsTemplate from '../../../resources/profile-template/AGENTS.md?raw'
import schemaTemplate from '../../../resources/profile-template/configuracao.schema.json?raw'
import configurePrompt from '../../../resources/mcp/configurar-plataforma.md?raw'
import { configPath } from '../profile/paths'
import type { McpPrompt, McpResource, McpServerSpec } from './protocol'
import { configurationTools } from './tools'

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

/**
 * O roteiro que conduz a configuração: as perguntas, o porquê de cada uma e onde
 * achar a resposta no Azure. O texto mora em `resources/mcp/`, ao lado das regras
 * que ele explica; mudou a regra, muda o roteiro.
 */
export const PROMPTS: McpPrompt[] = [
  {
    name: 'configurar_plataforma',
    title: 'Configurar a Plataforma do PO',
    description:
      'Monta a Configuração com o PO, uma pergunta de cada vez, explicando por que cada informação é necessária e onde achá-la no Azure DevOps.',
    get: () => ({
      description: 'Configurar a Plataforma do PO',
      messages: [{ role: 'user', content: { type: 'text', text: configurePrompt } }]
    })
  }
]

export const RESOURCES: McpResource[] = [
  {
    uri: 'plataforma-po://configuracao/instrucoes',
    name: 'instrucoes',
    title: 'Instruções da Configuração',
    description: 'Vocabulário, o que é cada seção, o que nunca fazer e receitas.',
    mimeType: 'text/markdown',
    read: () => agentsTemplate
  },
  {
    uri: 'plataforma-po://configuracao/schema',
    name: 'schema',
    title: 'JSON Schema da Configuração',
    description: 'A forma de configuracao.json, com a descrição de cada campo.',
    mimeType: 'application/schema+json',
    read: () => schemaTemplate
  }
]

export function buildServerSpec(profileId: string, version: string): McpServerSpec {
  assertMcpProfile(profileId)
  return {
    name: SERVER_NAME,
    title: 'Plataforma do PO',
    version,
    instructions:
      'Servidor da Plataforma do PO, preso a um Perfil. Ele lê a Configuração e grava propostas, que o PO revisa e aplica no app. Não tem acesso ao Azure DevOps nem ao token (PAT): nunca peça o token ao PO. Para configurar do zero, use o prompt configurar_plataforma.',
    tools: configurationTools(profileId),
    prompts: PROMPTS,
    resources: RESOURCES
  }
}
