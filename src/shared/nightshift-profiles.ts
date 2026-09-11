import { NIGHTSHIFT_BROWSER_PARTITION } from './constants'
import type { ExecutionHostId } from './execution-host'

export const NIGHTSHIFT_PROFILE_INDEX_SCHEMA_VERSION = 1
export const DEFAULT_LOCAL_NIGHTSHIFT_PROFILE_ID = 'local-default'
export const DEFAULT_LOCAL_NIGHTSHIFT_PROFILE_NAME = 'Personal'
/** Main -> renderer push when the stored auth status changed without the renderer asking. */
export const NIGHTSHIFT_PROFILE_AUTH_STATUS_CHANGED_CHANNEL = 'nightshiftProfiles:authStatusChanged'
const LEGACY_NIGHTSHIFT_BROWSER_SESSION_PARTITION_PREFIX = 'persist:nightshift-browser-session-'

export type NightshiftProfileAvatar = {
  kind: 'initials'
  initials: string
  color: 'neutral'
}

export type NightshiftProfileKind = 'local' | 'cloud-linked'

export type NightshiftProfileCloudSummary = {
  cloudProfileId: string
  userId: string
  email: string
  displayName?: string
  activeOrgId?: string
  activeOrgName?: string
  linkedAt: number
}

export type NightshiftCloudOrgSummary = {
  orgId: string
  name: string
  role?: string
}

export type NightshiftCloudCapabilityFlags = Record<string, boolean>

export type NightshiftCloudCapabilities = {
  flags: NightshiftCloudCapabilityFlags
  refreshedAt: number
}

export type NightshiftCloudSessionPersistence =
  | 'none'
  | 'encrypted'
  | 'memory-only'
  | 'dev-plaintext'

export type NightshiftProfileAuthState =
  | 'local'
  | 'unconfigured'
  | 'connected'
  | 'reconnect-required'

export type NightshiftProfileAuthStatus = {
  activeProfileId: string
  configured: boolean
  state: NightshiftProfileAuthState
  persistence: NightshiftCloudSessionPersistence
  cloud?: NightshiftProfileCloudSummary
  organizations?: NightshiftCloudOrgSummary[]
  capabilities?: NightshiftCloudCapabilities
  credentialError?: string
  setupMessage?: string
}

export type NightshiftProfileSummary = {
  id: string
  name: string
  avatar: NightshiftProfileAvatar
  kind: NightshiftProfileKind
  createdAt: number
  updatedAt: number
  lastOpenedAt: number
  cloud?: NightshiftProfileCloudSummary
}

export type NightshiftProfileIndex = {
  schemaVersion: number
  activeProfileId: string
  profiles: NightshiftProfileSummary[]
}

export type NightshiftProfileListState = {
  activeProfileId: string
  profiles: NightshiftProfileSummary[]
}

export type NightshiftProfileListResult = NightshiftProfileListState & {
  // Why: gates the full multi-profile switcher UI; default builds show a
  // single-profile account menu instead.
  multiProfileUi: boolean
}

export type CreateLocalNightshiftProfileArgs = {
  name?: string
}

export type CreateLocalNightshiftProfileResult = NightshiftProfileListState & {
  profile: NightshiftProfileSummary
}

export type CreateCloudLinkedNightshiftProfileArgs = {
  orgId?: string
  name?: string
}

export type SwitchNightshiftProfileArgs = {
  profileId: string
}

export type SwitchNightshiftProfileResult = {
  status: 'already-active' | 'relaunching'
}

export type TransferNightshiftProfileProjectMode = 'move' | 'copy'

export type TransferNightshiftProfileProjectArgs = {
  sourceProfileId: string
  targetProfileId: string
  repoId: string
  mode: TransferNightshiftProfileProjectMode
}

export type FindNightshiftProfileProjectsByPathArgs = {
  path: string
  connectionId?: string | null
  executionHostId?: ExecutionHostId | null
  excludeProfileId?: string | null
}

export type NightshiftProfileProjectPresence = {
  profileId: string
  profileName: string
  profileKind: NightshiftProfileKind
  repoId: string
  repoName: string
}

export type FindNightshiftProfileProjectsByPathResult = {
  projects: NightshiftProfileProjectPresence[]
}

export type TransferNightshiftProfileProjectResult =
  | {
      status: 'transferred'
      mode: TransferNightshiftProfileProjectMode
      sourceProfileId: string
      targetProfileId: string
      sourceRepoId: string
      targetRepoId: string
      targetProjectId: string | null
      willRelaunch?: boolean
    }
  | {
      status: 'duplicate-target'
      sourceProfileId: string
      targetProfileId: string
      sourceRepoId: string
      duplicateRepoId: string
    }

export type ConnectCurrentNightshiftProfileResult =
  | {
      status: 'connected'
      auth: NightshiftProfileAuthStatus
      activeProfileId: string
      profiles: NightshiftProfileSummary[]
    }
  | {
      status: 'unconfigured'
      auth: NightshiftProfileAuthStatus
    }
  | {
      status: 'cancelled'
      auth: NightshiftProfileAuthStatus
    }
  | {
      status: 'failed'
      auth: NightshiftProfileAuthStatus
      error: string
    }

export type CreateCloudLinkedNightshiftProfileResult =
  | {
      status: 'created'
      auth: NightshiftProfileAuthStatus
      activeProfileId: string
      profiles: NightshiftProfileSummary[]
      profile: NightshiftProfileSummary
    }
  | {
      status: 'unconfigured' | 'reconnect-required'
      auth: NightshiftProfileAuthStatus
    }
  | {
      status: 'failed'
      auth: NightshiftProfileAuthStatus
      error: string
    }

export type SignOutCurrentNightshiftProfileResult = {
  status: 'signed-out'
  auth: NightshiftProfileAuthStatus
  activeProfileId: string
  profiles: NightshiftProfileSummary[]
}

export type SelectNightshiftProfileOrgArgs = {
  orgId: string
}

export type SelectNightshiftProfileOrgResult =
  | {
      status: 'selected'
      auth: NightshiftProfileAuthStatus
      activeProfileId: string
      profiles: NightshiftProfileSummary[]
    }
  | {
      status: 'unconfigured' | 'reconnect-required'
      auth: NightshiftProfileAuthStatus
    }
  | {
      status: 'failed'
      auth: NightshiftProfileAuthStatus
      error: string
    }

export type RefreshCurrentNightshiftProfileAuthResult =
  | {
      status: 'refreshed'
      auth: NightshiftProfileAuthStatus
      activeProfileId: string
      profiles: NightshiftProfileSummary[]
    }
  | {
      status: 'local' | 'unconfigured' | 'reconnect-required'
      auth: NightshiftProfileAuthStatus
    }
  | {
      status: 'failed'
      auth: NightshiftProfileAuthStatus
      error: string
    }

// Why: organization roles are a fixed server-side enum; the desktop UI mirrors
// exactly these three so role selects can't drift from what the API accepts.
export type NightshiftOrgRole = 'owner' | 'admin' | 'member'

export type NightshiftOrgMember = {
  // Why: null for teammates provisioned server-side who never signed into Nightshift;
  // mutation actions are disabled for them since the API keys on a real userId.
  userId: string | null
  email: string
  displayName?: string
  role: NightshiftOrgRole
}

export type NightshiftOrgPendingInvite = {
  email: string
  role: NightshiftOrgRole
  createdAt: number
}

export type NightshiftOrgMembersRoster = {
  members: NightshiftOrgMember[]
  pendingInvites: NightshiftOrgPendingInvite[]
  viewerRole: NightshiftOrgRole
  canManageMembers: boolean
}

export type NightshiftProfileOrgMembersListArgs = {
  orgId: string
}

export type NightshiftProfileOrgMemberInviteArgs = {
  orgId: string
  email: string
  role: NightshiftOrgRole
}

export type NightshiftProfileOrgInviteRevokeArgs = {
  orgId: string
  email: string
}

export type NightshiftProfileOrgMemberChangeRoleArgs = {
  orgId: string
  userId: string
  role: NightshiftOrgRole
}

export type NightshiftProfileOrgMemberRemoveArgs = {
  orgId: string
  userId: string
}

export type NightshiftProfileOrgMembersListResult =
  | { status: 'ok'; roster: NightshiftOrgMembersRoster }
  | { status: 'unconfigured' | 'reconnect-required' }
  | { status: 'failed'; error: string }

export type NightshiftOrgInviteConflictReason = 'already_member' | 'already_invited'
export type NightshiftOrgMutationInvalidReason = 'cannot_change_own_role' | 'cannot_remove_self'

export type NightshiftProfileOrgMemberMutationResult =
  | { status: 'ok' }
  | { status: 'unconfigured' | 'reconnect-required' | 'forbidden' | 'not-found' }
  | { status: 'conflict'; reason: NightshiftOrgInviteConflictReason }
  | { status: 'invalid'; reason: NightshiftOrgMutationInvalidReason }
  | { status: 'failed'; error: string }

export function createDefaultLocalNightshiftProfile(now: number): NightshiftProfileSummary {
  return {
    id: DEFAULT_LOCAL_NIGHTSHIFT_PROFILE_ID,
    name: DEFAULT_LOCAL_NIGHTSHIFT_PROFILE_NAME,
    avatar: { kind: 'initials', initials: 'P', color: 'neutral' },
    kind: 'local',
    createdAt: now,
    updatedAt: now,
    lastOpenedAt: now
  }
}

function profilePartitionHash(value: string): string {
  let hash = 2166136261
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

export function getNightshiftProfileBrowserPartitionSegment(profileId: string): string {
  const safe = profileId.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 48) || 'profile'
  return `${safe}-${profilePartitionHash(profileId)}`
}

export function getNightshiftProfileBrowserDefaultPartition(profileId: string): string {
  if (profileId === DEFAULT_LOCAL_NIGHTSHIFT_PROFILE_ID) {
    return NIGHTSHIFT_BROWSER_PARTITION
  }
  return `persist:nightshift-profile-${getNightshiftProfileBrowserPartitionSegment(profileId)}-browser-default`
}

export function getNightshiftProfileBrowserSessionPartition(
  profileId: string,
  browserSessionProfileId: string
): string {
  if (profileId === DEFAULT_LOCAL_NIGHTSHIFT_PROFILE_ID) {
    return `${LEGACY_NIGHTSHIFT_BROWSER_SESSION_PARTITION_PREFIX}${browserSessionProfileId}`
  }
  return `persist:nightshift-profile-${getNightshiftProfileBrowserPartitionSegment(
    profileId
  )}-browser-session-${browserSessionProfileId}`
}
