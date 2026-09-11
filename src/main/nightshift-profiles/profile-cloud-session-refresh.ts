import type { NightshiftCloudAuthConfig } from './profile-cloud-auth-config'
import type { ActiveNightshiftProfileState } from './profile-index-store'
import {
  clearNightshiftCloudSession,
  type NightshiftCloudSession,
  readNightshiftCloudSession,
  saveNightshiftCloudSessionIfCurrent
} from './profile-cloud-session-store'
import {
  isAmbiguousCloudRequestFailure,
  NightshiftCloudRequestError,
  refreshNightshiftCloudSession
} from './profile-cloud-client'
import { linkNightshiftProfileToCloud } from './profile-cloud-index'
import type { NightshiftCloudSessionExchangeResponse } from './profile-cloud-session-exchange'
import {
  AmbiguousRefreshReplayBlockedError,
  blocksAmbiguousRefreshReplay,
  forgetAmbiguousRefreshAttempt,
  recordAmbiguousRefreshAttempt,
  wasRefreshTokenAmbiguouslyAttempted
} from './profile-cloud-refresh-replay-guard'
import {
  captureCloudSessionMutation,
  cloudSessionIdentity,
  tombstoneCloudSession
} from './profile-cloud-session-mutation'
import { emitNightshiftCloudSessionInvalidated } from './profile-cloud-session-invalidation'

const CLOUD_SESSION_REFRESH_SKEW_MS = 60_000

export type FreshCloudSessionResult =
  | { status: 'found'; session: NightshiftCloudSession }
  | { status: 'reconnect-required' }

export type CloudSessionOperationResult<T> =
  | { status: 'ok'; value: T }
  | { status: 'reconnect-required' }

function shouldRefreshCloudSession(session: NightshiftCloudSession, now = Date.now()): boolean {
  return session.expiresAt <= now + CLOUD_SESSION_REFRESH_SKEW_MS
}

export function isNightshiftCloudAuthFailure(error: unknown): boolean {
  return (
    error instanceof NightshiftCloudRequestError &&
    (error.statusCode === 401 || error.statusCode === 403)
  )
}

const inflightCloudSessionRefreshes = new Map<string, Promise<NightshiftCloudSession>>()

class StaleCloudSessionMutationError extends Error {
  constructor() {
    super('stale_cloud_session_mutation')
  }
}

function cloudSessionRefreshKey(profileId: string, userDataPath: string): string {
  return `${userDataPath}\0${profileId}`
}

// Why: with refresh-token rotation, only the session that actually failed may
// clear the store; otherwise a loser of a concurrent refresh race would wipe
// the winner's freshly rotated session.
function clearCloudSessionIfUnchanged(
  profileId: string,
  userDataPath: string,
  failed: NightshiftCloudSession,
  active: ActiveNightshiftProfileState
): void {
  const current = readNightshiftCloudSession(profileId, userDataPath)
  if (current.status === 'found' && current.session.refreshToken !== failed.refreshToken) {
    return
  }
  // A session we were denied is not a session we may delete: the token we would be clearing might
  // not even be the one that failed, and `clearNightshiftCloudSession` unlinks the file outright.
  if (current.status === 'unreadable') {
    return
  }
  if (active.profile.cloud) {
    tombstoneCloudSession(
      cloudSessionIdentity(active.profile.id, active.profile.cloud),
      userDataPath
    )
  }
  clearNightshiftCloudSession(profileId, userDataPath)
  forgetAmbiguousRefreshAttempt(cloudSessionRefreshKey(profileId, userDataPath))
  // Why: the renderer cached auth status at startup; without this it keeps
  // showing "Connected" until the app restarts.
  emitNightshiftCloudSessionInvalidated()
}

// Why: support cannot otherwise tell a genuine revocation from a sign-out we
// caused ourselves by resending a refresh token whose first attempt never
// answered. Never log the token itself.
function warnIfPossibleRefreshReplay(
  profileId: string,
  userDataPath: string,
  failed: NightshiftCloudSession,
  error: unknown
): void {
  if (!(error instanceof NightshiftCloudRequestError) || error.statusCode !== 401) {
    return
  }
  const key = cloudSessionRefreshKey(profileId, userDataPath)
  if (!wasRefreshTokenAmbiguouslyAttempted(key, failed.refreshToken)) {
    return
  }
  console.warn(
    '[nightshift-cloud] nightshift_cloud_refresh_possible_replay: refresh rejected 401 for a token whose earlier attempt never answered'
  )
}

type CloudSessionRefreshAttempt =
  | { status: 'refreshed'; response: NightshiftCloudSessionExchangeResponse }
  | { status: 'rotated-elsewhere'; session: NightshiftCloudSession }

function isRetryableCloudRefreshRejection(error: unknown): boolean {
  return error instanceof NightshiftCloudRequestError && error.statusCode >= 500
}

async function attemptCloudSessionRefresh(
  key: string,
  config: NightshiftCloudAuthConfig,
  active: ActiveNightshiftProfileState,
  userDataPath: string,
  session: NightshiftCloudSession
): Promise<CloudSessionRefreshAttempt> {
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await refreshNightshiftCloudSession(config, session)
      forgetAmbiguousRefreshAttempt(key)
      return { status: 'refreshed', response }
    } catch (error) {
      const ambiguous = isAmbiguousCloudRequestFailure(error)
      if (ambiguous) {
        recordAmbiguousRefreshAttempt(key, session.refreshToken)
      }
      // Only a status line proves the server rejected this token without
      // rotating it, so a definitive 5xx is the only failure worth retrying.
      const retryable = !ambiguous && attempt === 0 && isRetryableCloudRefreshRejection(error)
      if (!ambiguous && !retryable) {
        throw error
      }
      // Another caller may have rotated the stored session while this attempt
      // was in flight; that result is the one to use, and the token this attempt
      // held is no longer ours to send again.
      const current = readNightshiftCloudSession(active.profile.id, userDataPath)
      if (current.status === 'found' && current.session.refreshToken !== session.refreshToken) {
        return { status: 'rotated-elsewhere', session: current.session }
      }
      if (ambiguous) {
        throw error
      }
    }
  }
}

async function refreshStoredCloudSession(
  config: NightshiftCloudAuthConfig,
  active: ActiveNightshiftProfileState,
  userDataPath: string,
  session: NightshiftCloudSession
): Promise<NightshiftCloudSession> {
  // Why: refresh tokens rotate, so concurrent refreshes must single-flight;
  // a second POST with the same refresh token can trip server reuse detection
  // and revoke the whole token family.
  const key = cloudSessionRefreshKey(active.profile.id, userDataPath)
  const inflight = inflightCloudSessionRefreshes.get(key)
  if (inflight) {
    return inflight
  }
  const task = (async () => {
    const current = readNightshiftCloudSession(active.profile.id, userDataPath)
    if (current.status === 'found' && current.session.refreshToken !== session.refreshToken) {
      // Another caller already rotated this session; reuse its result.
      return current.session
    }
    if (!active.profile.cloud) {
      throw new StaleCloudSessionMutationError()
    }
    if (blocksAmbiguousRefreshReplay(key, session.refreshToken)) {
      throw new AmbiguousRefreshReplayBlockedError()
    }
    const expectedIdentity = cloudSessionIdentity(active.profile.id, active.profile.cloud)
    const snapshot = captureCloudSessionMutation(expectedIdentity, userDataPath)
    const attempt = await attemptCloudSessionRefresh(key, config, active, userDataPath, session)
    if (attempt.status === 'rotated-elsewhere') {
      return attempt.session
    }
    const refreshed = attempt.response
    const refreshedIdentity = cloudSessionIdentity(active.profile.id, refreshed.cloud)
    if (
      refreshedIdentity.cloudUserId !== expectedIdentity.cloudUserId ||
      refreshedIdentity.cloudProfileId !== expectedIdentity.cloudProfileId ||
      refreshedIdentity.organizationId !== expectedIdentity.organizationId
    ) {
      throw new StaleCloudSessionMutationError()
    }
    const nextSession = {
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken,
      expiresAt: refreshed.expiresAt,
      organizations: refreshed.organizations,
      capabilities: refreshed.capabilities
    }
    if (
      saveNightshiftCloudSessionIfCurrent(
        active.profile.id,
        userDataPath,
        nextSession,
        snapshot
      ) === null
    ) {
      throw new StaleCloudSessionMutationError()
    }
    linkNightshiftProfileToCloud(active.profile.id, refreshed.cloud, userDataPath)
    return nextSession
  })()
  inflightCloudSessionRefreshes.set(key, task)
  try {
    return await task
  } finally {
    inflightCloudSessionRefreshes.delete(key)
  }
}

export async function readFreshNightshiftCloudSession(
  config: NightshiftCloudAuthConfig,
  active: ActiveNightshiftProfileState,
  userDataPath: string
): Promise<FreshCloudSessionResult> {
  const session = readNightshiftCloudSession(active.profile.id, userDataPath)
  if (session.status !== 'found') {
    return { status: 'reconnect-required' }
  }
  if (!shouldRefreshCloudSession(session.session)) {
    return { status: 'found', session: session.session }
  }
  try {
    return {
      status: 'found',
      session: await refreshStoredCloudSession(config, active, userDataPath, session.session)
    }
  } catch (error) {
    if (isNightshiftCloudAuthFailure(error)) {
      warnIfPossibleRefreshReplay(active.profile.id, userDataPath, session.session, error)
      clearCloudSessionIfUnchanged(active.profile.id, userDataPath, session.session, active)
      return { status: 'reconnect-required' }
    }
    throw error
  }
}

export async function forceRefreshNightshiftCloudSession(
  config: NightshiftCloudAuthConfig,
  active: ActiveNightshiftProfileState,
  userDataPath: string,
  session: NightshiftCloudSession
): Promise<FreshCloudSessionResult> {
  try {
    return {
      status: 'found',
      session: await refreshStoredCloudSession(config, active, userDataPath, session)
    }
  } catch (error) {
    if (isNightshiftCloudAuthFailure(error)) {
      warnIfPossibleRefreshReplay(active.profile.id, userDataPath, session, error)
      clearCloudSessionIfUnchanged(active.profile.id, userDataPath, session, active)
      return { status: 'reconnect-required' }
    }
    throw error
  }
}

export async function runWithFreshNightshiftCloudSession<T>(
  config: NightshiftCloudAuthConfig,
  active: ActiveNightshiftProfileState,
  userDataPath: string,
  operation: (session: NightshiftCloudSession) => Promise<T>
): Promise<CloudSessionOperationResult<T>> {
  const session = await readFreshNightshiftCloudSession(config, active, userDataPath)
  if (session.status !== 'found') {
    return { status: 'reconnect-required' }
  }
  try {
    return { status: 'ok', value: await operation(session.session) }
  } catch (error) {
    if (!isNightshiftCloudAuthFailure(error)) {
      throw error
    }
    const refreshed = await forceRefreshNightshiftCloudSession(
      config,
      active,
      userDataPath,
      session.session
    )
    if (refreshed.status !== 'found') {
      return { status: 'reconnect-required' }
    }
    try {
      return { status: 'ok', value: await operation(refreshed.session) }
    } catch (retryError) {
      // Why: a 401 after a successful refresh means the session itself is
      // rejected. A 403 is an authorization (permission) failure — signing
      // the user out for it would destroy a valid session, so let it surface
      // as a failed operation instead.
      if (retryError instanceof NightshiftCloudRequestError && retryError.statusCode === 401) {
        clearCloudSessionIfUnchanged(active.profile.id, userDataPath, refreshed.session, active)
        return { status: 'reconnect-required' }
      }
      throw retryError
    }
  }
}
