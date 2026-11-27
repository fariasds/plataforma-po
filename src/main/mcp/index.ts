import { existsSync } from 'fs'
import agentsTemplate from '../../../resources/profile-template/AGENTS.md?raw'
import schemaTemplate from '../../../resources/profile-template/configuracao.schema.json?raw'
import configurePrompt from '../../../resources/mcp/configurar-plataforma.md?raw'
import { configPath } from '../profile/paths'
import type { McpPrompt, McpResource, McpServerSpec } from './protocol'
import { RULE_FIRST_PROMPTS } from '@shared/flow-prompts'
import { currentInstruction } from '../flow/instructions'
import { flowTools } from './flow-tools'
import { configurationTools, currentConfiguration } from './tools'

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

/** O que o PO informou ao escolher o prompt, para a IA começar dali. */
function request(args: Record<string, string>): string {
  const lines = Object.entries(args)
    .filter(([, value]) => value.trim() !== '')
    .map(([name, value]) => `- ${name}: ${value.trim().slice(0, 200)}`)
  return lines.length > 0 ? `\n\n## O pedido\n\n${lines.join('\n')}\n` : ''
}

/** Os prompts do processo rule-first, com o texto em uso no Perfil (ADR 0014). */
function ruleFirstPrompts(profileId: string): McpPrompt[] {
  return RULE_FIRST_PROMPTS.map((prompt) => ({
    name: prompt.name,
    title: prompt.title,
    description: prompt.description,
    arguments: prompt.arguments.map((arg) => ({ ...arg })),
    get: (args) => ({
      description: prompt.title,
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: currentInstruction(profileId, prompt.name) + request(args)
          }
        }
      ]
    })
  }))
}

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
      'Servidor da Plataforma do PO, preso a um Perfil. Ele lê a Configuração e grava propostas, que o PO revisa e aplica no app. Não tem acesso ao Azure DevOps nem ao token (PAT): nunca peça o token ao PO. Para configurar do zero, use o prompt configurar_plataforma. ' +
      'No fluxo do PO (Discovery, quebra, bugs, oportunidades), use os prompts do processo e as ferramentas listar_features, ler_feature, validar_feature, ler_retrato, buscar_regra, ler_catalogo e gravar_arquivo. O retrato do Azure tem data: diga-a ao PO.',
    tools: [
      ...configurationTools(profileId),
      ...flowTools(profileId, () => currentConfiguration(profileId))
    ],
    prompts: [...PROMPTS, ...ruleFirstPrompts(profileId)],
    resources: RESOURCES
  }
}
