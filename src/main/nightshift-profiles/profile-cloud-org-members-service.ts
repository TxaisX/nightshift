import type {
  NightshiftProfileOrgInviteRevokeArgs,
  NightshiftProfileOrgMemberChangeRoleArgs,
  NightshiftProfileOrgMemberInviteArgs,
  NightshiftProfileOrgMemberMutationResult,
  NightshiftProfileOrgMemberRemoveArgs,
  NightshiftProfileOrgMembersListResult
} from '../../shared/nightshift-profiles'
import type { ActiveNightshiftProfileState } from './profile-index-store'
import { ensureActiveNightshiftProfile } from './profile-index-store'
import type { NightshiftCloudAuthConfig } from './profile-cloud-auth-config'
import {
  getNightshiftCloudAuthConfig,
  isNightshiftCloudDevAuthEnabled
} from './profile-cloud-auth-config'
import type { NightshiftCloudSession } from './profile-cloud-session-store'
import { NightshiftCloudRequestError } from './profile-cloud-client'
import { runWithFreshNightshiftCloudSession } from './profile-cloud-session-refresh'
import {
  changeNightshiftCloudOrgMemberRole,
  inviteNightshiftCloudOrgMember,
  listNightshiftCloudOrgMembers,
  removeNightshiftCloudOrgMember,
  revokeNightshiftCloudOrgInvite
} from './profile-cloud-org-members-client'
import {
  changeDevNightshiftCloudOrgMemberRole,
  inviteDevNightshiftCloudOrgMember,
  listDevNightshiftCloudOrgMembers,
  removeDevNightshiftCloudOrgMember,
  revokeDevNightshiftCloudOrgInvite
} from './profile-cloud-dev-org-members'

type OrgCallResult<T> =
  | { status: 'ok'; value: T }
  | { status: 'reconnect-required' }
  | { status: 'request-error'; error: NightshiftCloudRequestError }
  | { status: 'failed'; error: string }

// Why: only a 401 means the token itself is stale and should drive a session
// refresh/reconnect. 403/404/409/400 are business or permission outcomes the UI
// must interpret, so they are surfaced as values rather than thrown — otherwise
// runWithFreshNightshiftCloudSession would treat a 403 as an auth failure and burn a
// pointless token refresh + retry before giving up.
async function runOrgMemberCall<T>(
  config: NightshiftCloudAuthConfig,
  active: ActiveNightshiftProfileState,
  userDataPath: string,
  call: (session: NightshiftCloudSession) => Promise<T>
): Promise<OrgCallResult<T>> {
  try {
    const operation = await runWithFreshNightshiftCloudSession(
      config,
      active,
      userDataPath,
      async (session) => {
        try {
          return { ok: true as const, value: await call(session) }
        } catch (error) {
          if (error instanceof NightshiftCloudRequestError && error.statusCode !== 401) {
            return { ok: false as const, error }
          }
          throw error
        }
      }
    )
    if (operation.status !== 'ok') {
      return { status: 'reconnect-required' }
    }
    const outcome = operation.value
    return outcome.ok
      ? { status: 'ok', value: outcome.value }
      : { status: 'request-error', error: outcome.error }
  } catch (error) {
    return { status: 'failed', error: error instanceof Error ? error.message : String(error) }
  }
}

function mapMutationRequestError(
  error: NightshiftCloudRequestError
): NightshiftProfileOrgMemberMutationResult {
  switch (error.statusCode) {
    case 403:
      return { status: 'forbidden' }
    case 404:
      return { status: 'not-found' }
    case 409:
      return {
        status: 'conflict',
        reason: error.errorCode === 'already_member' ? 'already_member' : 'already_invited'
      }
    case 400:
      return {
        status: 'invalid',
        reason:
          error.errorCode === 'cannot_remove_self' ? 'cannot_remove_self' : 'cannot_change_own_role'
      }
    default:
      return { status: 'failed', error: error.message }
  }
}

function mapMutationResult(result: OrgCallResult<void>): NightshiftProfileOrgMemberMutationResult {
  switch (result.status) {
    case 'ok':
      return { status: 'ok' }
    case 'reconnect-required':
      return { status: 'reconnect-required' }
    case 'request-error':
      return mapMutationRequestError(result.error)
    case 'failed':
      return { status: 'failed', error: result.error }
  }
}

export async function listNightshiftProfileOrgMembers(
  userDataPath: string,
  orgId: string
): Promise<NightshiftProfileOrgMembersListResult> {
  const active = ensureActiveNightshiftProfile(userDataPath)
  if (isNightshiftCloudDevAuthEnabled()) {
    return { status: 'ok', roster: listDevNightshiftCloudOrgMembers(orgId) }
  }
  const configState = getNightshiftCloudAuthConfig()
  if (!configState.configured) {
    return { status: 'unconfigured' }
  }
  const result = await runOrgMemberCall(configState.config, active, userDataPath, (session) =>
    listNightshiftCloudOrgMembers(configState.config, session, orgId)
  )
  switch (result.status) {
    case 'ok':
      return { status: 'ok', roster: result.value }
    case 'reconnect-required':
      return { status: 'reconnect-required' }
    case 'request-error':
      return { status: 'failed', error: result.error.message }
    case 'failed':
      return { status: 'failed', error: result.error }
  }
}

export async function inviteNightshiftProfileOrgMember(
  userDataPath: string,
  args: NightshiftProfileOrgMemberInviteArgs
): Promise<NightshiftProfileOrgMemberMutationResult> {
  const active = ensureActiveNightshiftProfile(userDataPath)
  if (isNightshiftCloudDevAuthEnabled()) {
    return inviteDevNightshiftCloudOrgMember(args)
  }
  const configState = getNightshiftCloudAuthConfig()
  if (!configState.configured) {
    return { status: 'unconfigured' }
  }
  return mapMutationResult(
    await runOrgMemberCall(configState.config, active, userDataPath, (session) =>
      inviteNightshiftCloudOrgMember(configState.config, session, args)
    )
  )
}

export async function revokeNightshiftProfileOrgInvite(
  userDataPath: string,
  args: NightshiftProfileOrgInviteRevokeArgs
): Promise<NightshiftProfileOrgMemberMutationResult> {
  const active = ensureActiveNightshiftProfile(userDataPath)
  if (isNightshiftCloudDevAuthEnabled()) {
    return revokeDevNightshiftCloudOrgInvite(args)
  }
  const configState = getNightshiftCloudAuthConfig()
  if (!configState.configured) {
    return { status: 'unconfigured' }
  }
  return mapMutationResult(
    await runOrgMemberCall(configState.config, active, userDataPath, (session) =>
      revokeNightshiftCloudOrgInvite(configState.config, session, args)
    )
  )
}

export async function changeNightshiftProfileOrgMemberRole(
  userDataPath: string,
  args: NightshiftProfileOrgMemberChangeRoleArgs
): Promise<NightshiftProfileOrgMemberMutationResult> {
  const active = ensureActiveNightshiftProfile(userDataPath)
  if (isNightshiftCloudDevAuthEnabled()) {
    return changeDevNightshiftCloudOrgMemberRole(args)
  }
  const configState = getNightshiftCloudAuthConfig()
  if (!configState.configured) {
    return { status: 'unconfigured' }
  }
  return mapMutationResult(
    await runOrgMemberCall(configState.config, active, userDataPath, (session) =>
      changeNightshiftCloudOrgMemberRole(configState.config, session, args)
    )
  )
}

export async function removeNightshiftProfileOrgMember(
  userDataPath: string,
  args: NightshiftProfileOrgMemberRemoveArgs
): Promise<NightshiftProfileOrgMemberMutationResult> {
  const active = ensureActiveNightshiftProfile(userDataPath)
  if (isNightshiftCloudDevAuthEnabled()) {
    return removeDevNightshiftCloudOrgMember(args)
  }
  const configState = getNightshiftCloudAuthConfig()
  if (!configState.configured) {
    return { status: 'unconfigured' }
  }
  return mapMutationResult(
    await runOrgMemberCall(configState.config, active, userDataPath, (session) =>
      removeNightshiftCloudOrgMember(configState.config, session, args)
    )
  )
}
