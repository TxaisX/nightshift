import type {
  CreateCloudLinkedNightshiftProfileArgs,
  NightshiftProfileListState
} from '../../shared/nightshift-profiles'
import type { ActiveNightshiftProfileState } from './profile-index-store'
import {
  createCloudLinkedNightshiftProfileRecord,
  linkNightshiftProfileToCloud
} from './profile-cloud-index'
import {
  readNightshiftCloudSession,
  saveNightshiftCloudSessionExchange
} from './profile-cloud-session-store'
import { createDevNightshiftCloudSession } from './profile-cloud-dev-auth'

type DevProfileListResult = NightshiftProfileListState

type DevCreateProfileResult =
  | {
      status: 'created'
      list: ReturnType<typeof createCloudLinkedNightshiftProfileRecord>
    }
  | { status: 'reconnect-required' }

type DevMutationResult =
  | {
      status: 'updated'
      list: DevProfileListResult
    }
  | { status: 'reconnect-required' }

export function connectDevNightshiftCloudProfile(
  active: ActiveNightshiftProfileState,
  userDataPath: string
): DevProfileListResult {
  const session = createDevNightshiftCloudSession({ localProfileId: active.profile.id })
  saveNightshiftCloudSessionExchange(active.profile.id, userDataPath, session)
  return linkNightshiftProfileToCloud(active.profile.id, session.cloud, userDataPath)
}

export function createDevCloudLinkedNightshiftProfile(
  active: ActiveNightshiftProfileState,
  userDataPath: string,
  args: CreateCloudLinkedNightshiftProfileArgs
): DevCreateProfileResult {
  if (readNightshiftCloudSession(active.profile.id, userDataPath).status !== 'found') {
    return { status: 'reconnect-required' }
  }
  const session = createDevNightshiftCloudSession({ orgId: args.orgId })
  const list = createCloudLinkedNightshiftProfileRecord(
    session.cloud,
    { name: args.name },
    userDataPath
  )
  saveNightshiftCloudSessionExchange(list.profile.id, userDataPath, session)
  return { status: 'created', list }
}

export function refreshDevNightshiftCloudProfile(
  active: ActiveNightshiftProfileState,
  userDataPath: string
): DevMutationResult {
  if (
    !active.profile.cloud ||
    readNightshiftCloudSession(active.profile.id, userDataPath).status !== 'found'
  ) {
    return { status: 'reconnect-required' }
  }
  const session = createDevNightshiftCloudSession({
    localProfileId: active.profile.id,
    cloudProfileId: active.profile.cloud.cloudProfileId,
    orgId: active.profile.cloud.activeOrgId
  })
  saveNightshiftCloudSessionExchange(active.profile.id, userDataPath, session)
  return {
    status: 'updated',
    list: linkNightshiftProfileToCloud(active.profile.id, session.cloud, userDataPath)
  }
}

export function selectDevNightshiftCloudOrg(
  active: ActiveNightshiftProfileState,
  userDataPath: string,
  orgId: string
): DevMutationResult {
  if (
    !active.profile.cloud ||
    readNightshiftCloudSession(active.profile.id, userDataPath).status !== 'found'
  ) {
    return { status: 'reconnect-required' }
  }
  const session = createDevNightshiftCloudSession({
    localProfileId: active.profile.id,
    cloudProfileId: active.profile.cloud.cloudProfileId,
    orgId
  })
  saveNightshiftCloudSessionExchange(active.profile.id, userDataPath, session)
  return {
    status: 'updated',
    list: linkNightshiftProfileToCloud(active.profile.id, session.cloud, userDataPath)
  }
}
