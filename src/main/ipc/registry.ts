import { ipcMain } from 'electron'
import { serializeError } from '@shared/errors'
import { IPC_CHANNELS, type IpcApi, type IpcResult } from '@shared/ipc'
import { redact } from '../security/redact'

/** Implementation expected for a given `IpcApi` method — sync or async. */
type Handler<K extends keyof IpcApi> = (
  ...args: Parameters<IpcApi[K]>
) => Awaited<ReturnType<IpcApi[K]>> | Promise<Awaited<ReturnType<IpcApi[K]>>>

/**
 * Registers the main-side implementation of an `IpcApi` method: arguments and
 * return type are checked against the shared contract, so main, preload and
 * renderer cannot drift apart.
 *
 * The handler never rejects across the wire — failures come back as
 * `{ ok: false, error }`, preserving the message and the error code.
 */
export function handle<K extends keyof IpcApi>(method: K, handler: Handler<K>): void {
  const channel = IPC_CHANNELS[method]

  ipcMain.handle(
    channel,
    async (_event, ...args): Promise<IpcResult<Awaited<ReturnType<IpcApi[K]>>>> => {
      try {
        return { ok: true, data: await handler(...(args as Parameters<IpcApi[K]>)) }
      } catch (error) {
        // The main process console is the only place this is visible — keep it.
        console.error(`[ipc] ${channel} failed:`, error)
        return { ok: false, error: serializeError(error, (text) => redact(text)) }
      }
    }
  )
}
