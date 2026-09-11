// Why: split out of nightshift-profiles.ts to keep that file under the max-lines budget.

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
