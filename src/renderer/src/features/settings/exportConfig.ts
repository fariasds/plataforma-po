import type { Configuration } from '@shared/config/schema'

/**
 * Salva uma cópia da Configuração em uso pelo diálogo de download da janela.
 *
 * Sem PAT por construção: a Configuração não tem onde guardá-lo, e a validação
 * recusa qualquer valor com forma de token (RN-CFG-05). É a última versão
 * válida — um arquivo quebrado no disco não é exportado.
 */
export function exportConfiguration(config: Configuration): void {
  const blob = new Blob([JSON.stringify(config, null, 2) + '\n'], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `configuracao-${config.organization}.json`
  link.click()
  // O download já pegou o conteúdo; a URL não serve para mais nada.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
