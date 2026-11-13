import { contextBridge, ipcRenderer } from 'electron'
import {
  IPC_CHANNELS,
  IPC_EVENTS,
  type IpcBridge,
  type IpcResult,
  type ProfileState
} from '@shared/ipc'

function invoke<T>(channel: string, ...args: unknown[]): Promise<IpcResult<T>> {
  return ipcRenderer.invoke(channel, ...args)
}

/**
 * The only channels the renderer can reach. `ipcRenderer` itself is never
 * exposed — the renderer cannot invent a channel name.
 */
const api: IpcBridge = {
  hasPat: () => invoke(IPC_CHANNELS.hasPat),
  savePat: (pat) => invoke(IPC_CHANNELS.savePat, pat),
  clearPat: () => invoke(IPC_CHANNELS.clearPat),

  getProfileState: () => invoke(IPC_CHANNELS.getProfileState),
  createProfile: (input) => invoke(IPC_CHANNELS.createProfile, input),
  importConfig: (json) => invoke(IPC_CHANNELS.importConfig, json),
  openProfileFolder: () => invoke(IPC_CHANNELS.openProfileFolder),
  readWorkData: (key) => invoke(IPC_CHANNELS.readWorkData, key),
  writeWorkData: (key, value) => invoke(IPC_CHANNELS.writeWorkData, key, value),
  startDemo: () => invoke(IPC_CHANNELS.startDemo),
  restoreDemo: () => invoke(IPC_CHANNELS.restoreDemo),
  leaveDemo: () => invoke(IPC_CHANNELS.leaveDemo),

  getSprints: (limit, preferFuture) => invoke(IPC_CHANNELS.getSprints, limit, preferFuture),
  getSprintDelivery: (project, sprint) => invoke(IPC_CHANNELS.getSprintDelivery, project, sprint),
  getTeamPerformance: (project, sprints) =>
    invoke(IPC_CHANNELS.getTeamPerformance, project, sprints),
  getBugAnalysis: (project, sprints, selectedSprint) =>
    invoke(IPC_CHANNELS.getBugAnalysis, project, sprints, selectedSprint),
  getPlanning: (project, sprint) => invoke(IPC_CHANNELS.getPlanning, project, sprint),
  getPlanningItem: (id) => invoke(IPC_CHANNELS.getPlanningItem, id),
  getDaily: (project, sprint) => invoke(IPC_CHANNELS.getDaily, project, sprint),
  getCurrentUser: () => invoke(IPC_CHANNELS.getCurrentUser),

  discoverProjects: () => invoke(IPC_CHANNELS.discoverProjects),
  discoverTeams: (project) => invoke(IPC_CHANNELS.discoverTeams, project),
  discoverAreas: (project) => invoke(IPC_CHANNELS.discoverAreas, project),
  discoverProcess: (project) => invoke(IPC_CHANNELS.discoverProcess, project),
  discoverFields: (project) => invoke(IPC_CHANNELS.discoverFields, project),

  buildSprintGoalRequest: (selection, sprint, itemIds) =>
    invoke(IPC_CHANNELS.buildSprintGoalRequest, selection, sprint, itemIds),

  // O listener recebe só o estado, nunca o `event` do Electron: ele carrega o
  // `sender`, que daria à janela um caminho de volta ao ipcRenderer.
  onProfileStateChanged: (listener) => {
    const forward = (_event: Electron.IpcRendererEvent, state: ProfileState): void =>
      listener(state)
    ipcRenderer.on(IPC_EVENTS.profileStateChanged, forward)
    return () => {
      ipcRenderer.removeListener(IPC_EVENTS.profileStateChanged, forward)
    }
  }
}

// `api` é a única coisa que a janela recebe (RN-SEC-29). O `electronAPI` do
// toolkit, que vinha do modelo do electron-vite, daria à janela um
// `ipcRenderer` que chama qualquer canal. Sem isolamento de contexto não se
// expõe nada: pendurar a ponte no `window` a deixaria alcançável por qualquer
// script da página.
if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('api', api)
} else {
  console.error(
    '[segurança] janela sem isolamento de contexto; a ponte não foi exposta (RN-SEC-29)'
  )
}
