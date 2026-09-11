import { browserSessionRegistry } from './browser-session-registry'
import type { BrowserSessionRegistryProfileOptions } from './browser-session-registry'
import { collectOrphanedBrowserRoutePartitionStorage } from './browser-route-partition-storage-runtime'
import { configureRouteSessionsForNightshiftProfile } from './browser-route-session-runtime'
import { configurePairedRuntimeBrowserClientHostsForNightshiftProfile } from './paired-runtime-browser-client-host-runtime'

let initialized = false

export function initializeBrowserSessionsForApp(
  activeProfile?: BrowserSessionRegistryProfileOptions & {
    listLocalSshTargetIds?: () => string[]
  }
): void {
  if (initialized) {
    return
  }

  if (activeProfile) {
    browserSessionRegistry.configureForNightshiftProfile(activeProfile)
    configureRouteSessionsForNightshiftProfile({
      nightshiftProfileId: activeProfile.nightshiftProfileId,
      profileDirectory: activeProfile.profileDirectory
    })
    configurePairedRuntimeBrowserClientHostsForNightshiftProfile({
      nightshiftProfileId: activeProfile.nightshiftProfileId
    })
    void collectOrphanedBrowserRoutePartitionStorage(activeProfile.listLocalSshTargetIds).catch(
      (error) => {
        console.warn('[browser-route-partition] orphan collection failed:', error)
      }
    )
  }

  // Why: cookie replay must happen before the first session.fromPartition()
  // call, otherwise Chromium opens the stale live cookie DB before import.
  browserSessionRegistry.applyPendingCookieImport()
  browserSessionRegistry.initializeBrowserSessionsFromPersistedState()
  initialized = true
}
