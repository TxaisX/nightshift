import type { NightshiftProfileAuthStatus } from '../../shared/nightshift-profiles'
import type { ActiveNightshiftProfileState } from './profile-index-store'
import {
  getNightshiftCloudAuthConfig,
  isNightshiftCloudDevAuthEnabled
} from './profile-cloud-auth-config'
import { readNightshiftCloudSession } from './profile-cloud-session-store'

export function getNightshiftProfileAuthStatusFromProfile(
  active: ActiveNightshiftProfileState,
  userDataPath: string
): NightshiftProfileAuthStatus {
  const configState = getNightshiftCloudAuthConfig()
  const devAuthEnabled = isNightshiftCloudDevAuthEnabled()
  const configured = configState.configured || devAuthEnabled
  const cloud = active.profile.cloud
  if (!cloud) {
    return {
      activeProfileId: active.profile.id,
      configured,
      state: configured ? 'local' : 'unconfigured',
      persistence: 'none',
      setupMessage: configured ? undefined : configState.setupMessage
    }
  }

  const session = readNightshiftCloudSession(active.profile.id, userDataPath)
  if (!configured) {
    return {
      activeProfileId: active.profile.id,
      configured: false,
      state: 'unconfigured',
      persistence: session.status === 'found' ? session.persistence : 'none',
      cloud,
      credentialError:
        session.status === 'decrypt-failed' || session.status === 'unreadable'
          ? session.error
          : undefined,
      setupMessage: configState.setupMessage
    }
  }
  if (session.status === 'found') {
    return {
      activeProfileId: active.profile.id,
      configured,
      state: 'connected',
      persistence: session.persistence,
      cloud,
      organizations: session.session.organizations,
      capabilities: session.session.capabilities
    }
  }

  return {
    activeProfileId: active.profile.id,
    configured,
    state: 'reconnect-required',
    persistence: 'none',
    cloud,
    credentialError:
      session.status === 'decrypt-failed' || session.status === 'unreadable'
        ? session.error
        : undefined
  }
}
