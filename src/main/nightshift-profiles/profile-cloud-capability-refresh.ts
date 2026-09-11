import type { RefreshCurrentNightshiftProfileAuthResult } from '../../shared/nightshift-profiles'
import {
  getNightshiftCloudAuthConfig,
  isNightshiftCloudDevAuthEnabled
} from './profile-cloud-auth-config'
import { getNightshiftProfileAuthStatusFromProfile } from './profile-cloud-auth-status'
import { refreshNightshiftCloudCapabilities } from './profile-cloud-client'
import { linkNightshiftProfileToCloud } from './profile-cloud-index'
import { ensureActiveNightshiftProfile, getNightshiftProfileListState } from './profile-index-store'
import { refreshDevNightshiftCloudProfile } from './profile-cloud-dev-service'
import {
  captureCloudSessionMutation,
  cloudSessionIdentity,
  recordCloudSessionIdentityMutationIfCurrent
} from './profile-cloud-session-mutation'
import { runWithFreshNightshiftCloudSession } from './profile-cloud-session-refresh'
import {
  readNightshiftCloudSession,
  saveNightshiftCloudSessionIfCurrent
} from './profile-cloud-session-store'

export async function refreshCurrentNightshiftProfileAuth(
  userDataPath: string
): Promise<RefreshCurrentNightshiftProfileAuthResult> {
  const active = ensureActiveNightshiftProfile(userDataPath)
  const auth = () => getNightshiftProfileAuthStatusFromProfile(active, userDataPath)
  if (!active.profile.cloud) {
    return { status: 'local', auth: auth() }
  }
  if (isNightshiftCloudDevAuthEnabled()) {
    const result = refreshDevNightshiftCloudProfile(active, userDataPath)
    if (result.status !== 'updated') {
      return { status: 'reconnect-required', auth: auth() }
    }
    return {
      status: 'refreshed',
      auth: auth(),
      activeProfileId: result.list.activeProfileId,
      profiles: result.list.profiles
    }
  }
  const configState = getNightshiftCloudAuthConfig()
  if (!configState.configured) {
    return { status: 'unconfigured', auth: auth() }
  }
  try {
    const identity = cloudSessionIdentity(active.profile.id, active.profile.cloud)
    let mutationSnapshot = captureCloudSessionMutation(identity, userDataPath)
    const operation = await runWithFreshNightshiftCloudSession(
      configState.config,
      active,
      userDataPath,
      (session) => refreshNightshiftCloudCapabilities(configState.config, session)
    )
    if (operation.status !== 'ok') {
      return { status: 'reconnect-required', auth: auth() }
    }
    const refresh = operation.value
    if (refresh.cloud) {
      const refreshedIdentity = cloudSessionIdentity(active.profile.id, refresh.cloud)
      if (
        refreshedIdentity.cloudUserId !== identity.cloudUserId ||
        refreshedIdentity.cloudProfileId !== identity.cloudProfileId
      ) {
        throw new Error('nightshift_cloud_identity_changed_during_capability_refresh')
      }
      if (refreshedIdentity.organizationId !== identity.organizationId) {
        const advanced = recordCloudSessionIdentityMutationIfCurrent(
          refreshedIdentity,
          userDataPath,
          mutationSnapshot
        )
        if (!advanced) {
          return { status: 'reconnect-required', auth: auth() }
        }
        mutationSnapshot = advanced
      }
    }
    const session = readNightshiftCloudSession(active.profile.id, userDataPath)
    if (session.status !== 'found') {
      return { status: 'reconnect-required', auth: auth() }
    }
    if (
      saveNightshiftCloudSessionIfCurrent(
        active.profile.id,
        userDataPath,
        {
          ...session.session,
          organizations: refresh.organizations ?? session.session.organizations,
          capabilities: refresh.capabilities
        },
        mutationSnapshot
      ) === null
    ) {
      return { status: 'reconnect-required', auth: auth() }
    }
    const list = refresh.cloud
      ? linkNightshiftProfileToCloud(active.profile.id, refresh.cloud, userDataPath)
      : getNightshiftProfileListState(userDataPath)
    return {
      status: 'refreshed',
      auth: getNightshiftProfileAuthStatusFromProfile(
        ensureActiveNightshiftProfile(userDataPath),
        userDataPath
      ),
      activeProfileId: list.activeProfileId,
      profiles: list.profiles
    }
  } catch (error) {
    return {
      status: 'failed',
      auth: auth(),
      error: error instanceof Error ? error.message : String(error)
    }
  }
}
