import { app, shell, session, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { APP_ID, WINDOW_BACKGROUND } from '@shared/app-info'
import { runSnapshot } from './dev/snapshot'
import { registerIpcHandlers } from './ipc'
import { isAllowedRendererRequest, openExternalIfAllowed } from './security/network-guard'
import { installConsoleRedaction, redact } from './security/redact'
import { externalLinkOrganization } from './services/azure/client'

// Antes de qualquer outra coisa: todo log do main sai sem o PAT (RN-SEC-19).
installConsoleRedaction()

let mainWindow: BrowserWindow | null = null

const ALLOWED_PERMISSIONS: ReadonlySet<string> = new Set(['clipboard-sanitized-write'])

function createWindow(): void {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    // Matches the Ant Design Layout body background, avoiding a white flash on open.
    backgroundColor: WINDOW_BACKGROUND,
    // Windows e Linux pegam o ícone da janela daqui — no `npm run dev` não há .exe
    // com o ícone embutido, e sem isto a barra de tarefas mostra o do Electron.
    // No macOS o Dock usa o .icns do pacote.
    ...(process.platform !== 'darwin' ? { icon } : {}),
    // Os padrões do Electron já são estes; ficam escritos porque são a garantia
    // da janela, e o teste da RN-SEC-29 os procura aqui.
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // A janela nunca abre outra janela; link externo vai ao navegador só se for da
  // organização no Azure (RN-SEC-21).
  mainWindow.webContents.setWindowOpenHandler((details) => {
    openExternalIfAllowed(details.url, externalLinkOrganization(), shell.openExternal)
    return { action: 'deny' }
  })

  // A navegação da própria janela é por hash e não dispara este evento; qualquer
  // outra tiraria o app da tela e é tratada como link externo.
  mainWindow.webContents.on('will-navigate', (event, url) => {
    event.preventDefault()
    openExternalIfAllowed(url, externalLinkOrganization(), shell.openExternal)
  })

  // In a packaged app there is no DevTools window to watch, so renderer errors
  // would vanish silently. Forwarding them to the main process log is the only
  // way to diagnose what a user reports from their machine.
  mainWindow.webContents.on('console-message', (event) => {
    if (event.level !== 'warning' && event.level !== 'error') return
    console.error(redact(`[renderer] ${event.message} (${event.sourceId}:${event.lineNumber})`))
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// Duas instâncias disputariam os arquivos do Perfil, e a última a gravar
// apagaria o que a outra escreveu. A segunda só traz para a frente a que já
// está aberta.
const hasSingleInstanceLock = app.requestSingleInstanceLock()
if (!hasSingleInstanceLock) {
  // Sair calado é o que confunde em desenvolvimento: o `npm run dev` termina
  // com sucesso, a janela antiga vem para a frente, e parece que o código novo
  // subiu — quando na verdade nada foi recarregado.
  console.warn(
    '[app] já existe uma instância aberta. Esta foi encerrada e a janela ' +
      'existente foi trazida para a frente — ela continua rodando o código ' +
      'anterior. Feche-a antes de subir de novo.'
  )
  app.quit()
}

app.on('second-instance', () => {
  if (!mainWindow) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
})

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  if (!hasSingleInstanceLock) return

  // Captura de referência dos dashboards (ver src/main/dev/snapshot.ts): roda
  // sem janela e encerra. Nunca no app empacotado.
  const snapshotDir = process.env.PO_SNAPSHOT_DIR
  if (!app.isPackaged && snapshotDir) {
    try {
      const { root, files } = await runSnapshot(snapshotDir)
      console.log(`[snapshot] ${files.length} arquivos em ${root}`)
    } catch (error) {
      console.error('[snapshot] falhou:', error instanceof Error ? error.message : error)
    }
    app.quit()
    return
  }

  // Set app user model id for windows
  electronApp.setAppUserModelId(APP_ID)

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Defesa em profundidade atrás da CSP: a janela não fala com a rede. O `fetch`
  // do main não passa por aqui — a barreira dele é o `client.ts` (RN-SEC-18).
  const devServerUrl = is.dev ? process.env['ELECTRON_RENDERER_URL'] : undefined
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    const allowed = isAllowedRendererRequest(details.url, devServerUrl)
    if (!allowed)
      console.warn(`[segurança] requisição da janela bloqueada (RN-SEC-18): ${details.url}`)
    callback({ cancel: !allowed })
  })

  // A janela não pede câmera, notificação, localização nem nada do tipo. A única
  // exceção é escrever na área de transferência: o Planning copia o pedido para
  // a IA do PO e o resumo da sprint (RN-SEC-29).
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(ALLOWED_PERMISSIONS.has(permission))
  })
  session.defaultSession.setPermissionCheckHandler((_webContents, permission) =>
    ALLOWED_PERMISSIONS.has(permission)
  )

  registerIpcHandlers()

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
