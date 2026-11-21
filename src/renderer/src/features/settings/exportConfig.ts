import type { Configuration } from '@shared/config/schema'
import { templateFrom } from '@shared/config/template'

/** Entrega o JSON pelo diálogo de download da janela. */
function download(content: unknown, fileName: string): void {
  const blob = new Blob([JSON.stringify(content, null, 2) + '\n'], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  // O download já pegou o conteúdo; a URL não serve para mais nada.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

/**
 * Salva uma cópia da Configuração em uso, para um colega da mesma organização.
 *
 * Sem PAT por construção: a Configuração não tem onde guardá-lo, e a validação
 * recusa qualquer valor com forma de token (RN-CFG-05). É a última versão
 * válida — um arquivo quebrado no disco não é exportado.
 */
export function exportConfiguration(config: Configuration): void {
  download(config, `configuracao-${config.organization}.json`)
}

/**
 * Salva o Modelo de processo (RN-CFG-10), para um PO de outra empresa: sem
 * organização, Produtos, Grupos, Squads nem cor de destaque. O nome do arquivo
 * também não leva a organização.
 */
export function exportTemplate(config: Configuration): void {
  download(templateFrom(config), 'modelo-de-processo.json')
}
