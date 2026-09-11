import type {
  ConnectCurrentNightshiftProfileResult,
  CreateCloudLinkedNightshiftProfileArgs,
  CreateCloudLinkedNightshiftProfileResult,
  NightshiftProfileAuthStatus,
  SelectNightshiftProfileOrgResult,
  SignOutCurrentNightshiftProfileResult
} from '../../shared/nightshift-profiles'
import { ensureActiveNightshiftProfile } from './profile-index-store'
import {
  getNightshiftCloudAuthConfig,
  isNightshiftCloudDevAuthEnabled
} from './profile-cloud-auth-config'
import {
  clearNightshiftCloudSession,
  readNightshiftCloudSession,
  saveNightshiftCloudSessionExchange
} from './profile-cloud-session-store'
import { cloudSessionIdentity, tombstoneCloudSession } from './profile-cloud-session-mutation'
import {
  createNightshiftCloudProfile,
  exchangeNightshiftCloudAuthCode,
  revokeNightshiftCloudSession
} from './profile-cloud-client'
import { beginNightshiftCloudPkceFlow } from './profile-cloud-pkce'
import {
  createCloudLinkedNightshiftProfileRecord,
  linkNightshiftProfileToCloud,
  unlinkNightshiftProfileFromCloud
} from './profile-cloud-index'
import { runWithFreshNightshiftCloudSession } from './profile-cloud-session-refresh'
import {
  connectDevNightshiftCloudProfile,
  createDevCloudLinkedNightshiftProfile,
  selectDevNightshiftCloudOrg
} from './profile-cloud-dev-service'
import { getNightshiftProfileAuthStatusFromProfile } from './profile-cloud-auth-status'
import { selectCloudOrgWithMutationFence } from './profile-cloud-org-selection'

export { refreshCurrentNightshiftProfileAuth } from './profile-cloud-capability-refresh'

function isUserCancelledAuthError(message: string): boolean {
  return message === 'nightshift_cloud_auth_timeout' || message === 'nightshift_cloud_auth_denied'
}

function activeAuth(
  active: ReturnType<typeof ensureActiveNightshiftProfile>,
  userDataPath: string
): NightshiftProfileAuthStatus {
  return getNightshiftProfileAuthStatusFromProfile(active, userDataPath)
}

export function getCurrentNightshiftProfileAuthStatus(
  userDataPath: string
): NightshiftProfileAuthStatus {
  return getNightshiftProfileAuthStatusFromProfile(
    ensureActiveNightshiftProfile(userDataPath),
    userDataPath
  )
}

export async function connectCurrentNightshiftProfile(
  userDataPath: string
): Promise<ConnectCurrentNightshiftProfileResult> {
  const active = ensureActiveNightshiftProfile(userDataPath)
  if (isNightshiftCloudDevAuthEnabled()) {
    const list = connectDevNightshiftCloudProfile(active, userDataPath)
    return {
      status: 'connected',
      auth: getCurrentNightshiftProfileAuthStatus(userDataPath),
      activeProfileId: list.activeProfileId,
      profiles: list.profiles
    }
  }

  const configState = getNightshiftCloudAuthConfig()
  if (!configState.configured) {
    return {
      status: 'unconfigured',
      auth: activeAuth(active, userDataPath)
    }
  }

  try {
    const code = await beginNightshiftCloudPkceFlow(configState.config, active.profile.id)
    const exchange = await exchangeNightshiftCloudAuthCode(configState.config, {
      ...code,
      localProfileId: active.profile.id
    })
    saveNightshiftCloudSessionExchange(active.profile.id, userDataPath, exchange)
    const list = linkNightshiftProfileToCloud(active.profile.id, exchange.cloud, userDataPath)
    return {
      status: 'connected',
      auth: getCurrentNightshiftProfileAuthStatus(userDataPath),
      activeProfileId: list.activeProfileId,
      profiles: list.profiles
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (isUserCancelledAuthError(message)) {
      return {
        status: 'cancelled',
        auth: getCurrentNightshiftProfileAuthStatus(userDataPath)
      }
    }
    return {
      status: 'failed',
      auth: getCurrentNightshiftProfileAuthStatus(userDataPath),
      error: message
    }
  }
}

export async function signOutCurrentNightshiftProfile(
  userDataPath: string
): Promise<SignOutCurrentNightshiftProfileResult> {
  const active = ensureActiveNightshiftProfile(userDataPath)
  const configState = getNightshiftCloudAuthConfig()
  const session = readNightshiftCloudSession(active.profile.id, userDataPath)
  if (active.profile.cloud) {
    // Why: persist the destructive fence before logout network I/O so a
    // refresh already in flight cannot save after explicit sign-out.
    tombstoneCloudSession(
      cloudSessionIdentity(active.profile.id, active.profile.cloud),
      userDataPath
    )
  }
  if (!isNightshiftCloudDevAuthEnabled() && configState.configured && session.status === 'found') {
    await revokeNightshiftCloudSession(configState.config, session.session).catch(() => undefined)
  }
  clearNightshiftCloudSession(active.profile.id, userDataPath)
  const list = unlinkNightshiftProfileFromCloud(active.profile.id, userDataPath)
  return {
    status: 'signed-out',
    auth: getCurrentNightshiftProfileAuthStatus(userDataPath),
    activeProfileId: list.activeProfileId,
    profiles: list.profiles
  }
}

export async function createCloudLinkedNightshiftProfile(
  userDataPath: string,
  args: CreateCloudLinkedNightshiftProfileArgs
): Promise<CreateCloudLinkedNightshiftProfileResult> {
  const active = ensureActiveNightshiftProfile(userDataPath)
  if (isNightshiftCloudDevAuthEnabled()) {
    const result = createDevCloudLinkedNightshiftProfile(active, userDataPath, args)
    if (result.status !== 'created') {
      return { status: 'reconnect-required', auth: activeAuth(active, userDataPath) }
    }
    return {
      status: 'created',
      auth: getCurrentNightshiftProfileAuthStatus(userDataPath),
      activeProfileId: result.list.activeProfileId,
      profiles: result.list.profiles,
      profile: result.list.profile
    }
  }

  const configState = getNightshiftCloudAuthConfig()
  if (!configState.configured) {
    return { status: 'unconfigured', auth: activeAuth(active, userDataPath) }
  }
  try {
    const operation = await runWithFreshNightshiftCloudSession(
      configState.config,
      active,
      userDataPath,
      (session) => createNightshiftCloudProfile(configState.config, session, args)
    )
    if (operation.status !== 'ok') {
      return { status: 'reconnect-required', auth: activeAuth(active, userDataPath) }
    }
    const created = operation.value
    const list = createCloudLinkedNightshiftProfileRecord(
      created.cloud,
      { name: args.name },
      userDataPath
    )
    saveNightshiftCloudSessionExchange(list.profile.id, userDataPath, created)
    return {
      status: 'created',
      auth: getCurrentNightshiftProfileAuthStatus(userDataPath),
      activeProfileId: list.activeProfileId,
      profiles: list.profiles,
      profile: list.profile
    }
  } catch (error) {
    return {
      status: 'failed',
      auth: getCurrentNightshiftProfileAuthStatus(userDataPath),
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

export async function selectCurrentNightshiftProfileOrg(
  userDataPath: string,
  orgId: string
): Promise<SelectNightshiftProfileOrgResult> {
  const active = ensureActiveNightshiftProfile(userDataPath)
  if (isNightshiftCloudDevAuthEnabled()) {
    const result = selectDevNightshiftCloudOrg(active, userDataPath, orgId)
    if (result.status !== 'updated') {
      return { status: 'reconnect-required', auth: activeAuth(active, userDataPath) }
    }
    return {
      status: 'selected',
      auth: getCurrentNightshiftProfileAuthStatus(userDataPath),
      activeProfileId: result.list.activeProfileId,
      profiles: result.list.profiles
    }
  }

  const configState = getNightshiftCloudAuthConfig()
  if (!configState.configured) {
    return { status: 'unconfigured', auth: activeAuth(active, userDataPath) }
  }
  try {
    const list = await selectCloudOrgWithMutationFence({
      config: configState.config,
      active,
      userDataPath,
      orgId
    })
    if (!list) {
      return { status: 'reconnect-required', auth: activeAuth(active, userDataPath) }
    }
    return {
      status: 'selected',
      auth: getCurrentNightshiftProfileAuthStatus(userDataPath),
      activeProfileId: list.activeProfileId,
      profiles: list.profiles
    }
  } catch (error) {
    return {
      status: 'failed',
      auth: getCurrentNightshiftProfileAuthStatus(userDataPath),
      error: error instanceof Error ? error.message : String(error)
    }
  }
}
