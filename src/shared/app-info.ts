/**
 * Identidade do app em um lugar só. O main, o renderer e o `electron-builder.yml`
 * (que repete os valores, porque yml não importa TS) leem daqui.
 */

export const APP_NAME = 'Plataforma do PO'
export const APP_ID = 'io.github.fariasds.plataforma-po'
export const APP_DESCRIPTION = 'Dashboard para Product Owners no Azure DevOps'

/**
 * Fundo da janela. Mora aqui, e não no tema, porque o main precisa dele antes de
 * o renderer existir: com a mesma cor do layout, a janela não pisca branca ao abrir.
 */
export const WINDOW_BACKGROUND = '#F4F5F7'

/**
 * Repositório público de onde saem as Releases (RN-SEC-22). Fixo no código, e não
 * na Configuração, porque decide para onde vai a consulta de versão (RN-SEC-33) e
 * que link de download abre no navegador (RN-SEC-21).
 */
export const PUBLIC_REPOSITORY = 'fariasds/plataforma-po'

/**
 * Começo do nome do instalador: o `name` do `package.json`, que o `artifactName`
 * do `electron-builder.yml` usa como `${name}-${version}-setup.exe`.
 */
export const INSTALLER_BASENAME = 'plataforma-po-desktop'
