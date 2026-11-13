import { registerAiHandlers } from './ai-handlers'
import { registerAzureHandlers } from './azure-handlers'
import { registerDemoHandlers } from './demo-handlers'
import { registerDiscoveryHandlers } from './discovery-handlers'
import { registerPatHandlers } from './pat-handlers'
import { registerProfileHandlers } from './profile-handlers'

/**
 * Single entry point for IPC registration, called once on app ready.
 * New domains register their handlers from here.
 */
export function registerIpcHandlers(): void {
  registerPatHandlers()
  registerProfileHandlers()
  registerDemoHandlers()
  registerAzureHandlers()
  registerDiscoveryHandlers()
  registerAiHandlers()
}
