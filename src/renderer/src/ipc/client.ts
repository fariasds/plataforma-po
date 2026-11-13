import { AppError } from '@shared/errors'
import type { IpcApi, IpcResult, IpcSubscriptions } from '@shared/ipc'

/**
 * Turns the envelope from the preload into a normal promise:
 * resolves with the data, or throws an `AppError` carrying the original code.
 * Rebuilding the error here (renderer world) is what keeps `code` intact.
 */
async function unwrap<T>(pending: Promise<IpcResult<T>>): Promise<T> {
  const result = await pending
  if (!result.ok) {
    throw new AppError(result.error.code, result.error.message)
  }
  return result.data
}

/** The main process, as a plain async API. Only hooks in `ipc/` should touch it. */
export const ipc: IpcApi = {
  hasPat: () => unwrap(window.api.hasPat()),
  savePat: (pat) => unwrap(window.api.savePat(pat)),
  clearPat: () => unwrap(window.api.clearPat()),

  getProfileState: () => unwrap(window.api.getProfileState()),
  createProfile: (input) => unwrap(window.api.createProfile(input)),
  importConfig: (json) => unwrap(window.api.importConfig(json)),
  openProfileFolder: () => unwrap(window.api.openProfileFolder()),
  readWorkData: (key) => unwrap(window.api.readWorkData(key)),
  writeWorkData: (key, value) => unwrap(window.api.writeWorkData(key, value)),
  startDemo: () => unwrap(window.api.startDemo()),
  restoreDemo: () => unwrap(window.api.restoreDemo()),
  leaveDemo: () => unwrap(window.api.leaveDemo()),

  getSprints: (limit, preferFuture) => unwrap(window.api.getSprints(limit, preferFuture)),
  getSprintDelivery: (project, sprint) => unwrap(window.api.getSprintDelivery(project, sprint)),
  getTeamPerformance: (project, sprints) => unwrap(window.api.getTeamPerformance(project, sprints)),
  getBugAnalysis: (project, sprints, selectedSprint) =>
    unwrap(window.api.getBugAnalysis(project, sprints, selectedSprint)),
  getPlanning: (project, sprint) => unwrap(window.api.getPlanning(project, sprint)),
  getPlanningItem: (id) => unwrap(window.api.getPlanningItem(id)),
  getDaily: (project, sprint) => unwrap(window.api.getDaily(project, sprint)),
  getCurrentUser: () => unwrap(window.api.getCurrentUser()),

  discoverProjects: () => unwrap(window.api.discoverProjects()),
  discoverTeams: (project) => unwrap(window.api.discoverTeams(project)),
  discoverAreas: (project) => unwrap(window.api.discoverAreas(project)),
  discoverProcess: (project) => unwrap(window.api.discoverProcess(project)),
  discoverFields: (project) => unwrap(window.api.discoverFields(project)),

  buildSprintGoalRequest: (selection, sprint, itemIds) =>
    unwrap(window.api.buildSprintGoalRequest(selection, sprint, itemIds))
}

/** Avisos do main. Como `ipc`, só os hooks em `ipc/` deveriam assinar. */
export const ipcEvents: IpcSubscriptions = {
  onProfileStateChanged: (listener) => window.api.onProfileStateChanged(listener)
}
