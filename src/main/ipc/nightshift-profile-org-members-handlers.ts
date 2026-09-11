import { ipcMain } from 'electron'
import type {
  NightshiftOrgRole,
  NightshiftProfileOrgInviteRevokeArgs,
  NightshiftProfileOrgMemberChangeRoleArgs,
  NightshiftProfileOrgMemberInviteArgs,
  NightshiftProfileOrgMemberMutationResult,
  NightshiftProfileOrgMemberRemoveArgs,
  NightshiftProfileOrgMembersListArgs,
  NightshiftProfileOrgMembersListResult
} from '../../shared/nightshift-profiles'
import { getProfileUserDataPath } from '../nightshift-profiles/profile-storage-paths'
import {
  changeNightshiftProfileOrgMemberRole,
  inviteNightshiftProfileOrgMember,
  listNightshiftProfileOrgMembers,
  removeNightshiftProfileOrgMember,
  revokeNightshiftProfileOrgInvite
} from '../nightshift-profiles/profile-cloud-org-members-service'

function orgMembersScopedArgs(args: unknown): { orgId: string; record: Record<string, unknown> } {
  if (!args || typeof args !== 'object') {
    throw new Error('invalid_nightshift_profile_org_selection')
  }
  const record = args as Record<string, unknown>
  const orgId = typeof record.orgId === 'string' ? record.orgId.trim() : ''
  if (!orgId) {
    throw new Error('invalid_nightshift_profile_org_selection')
  }
  return { orgId, record }
}

function orgRoleFromUnknown(value: unknown): NightshiftOrgRole {
  if (value === 'owner' || value === 'admin' || value === 'member') {
    return value
  }
  throw new Error('invalid_nightshift_org_role')
}

function orgEmailFromUnknown(value: unknown): string {
  const email = typeof value === 'string' ? value.trim() : ''
  if (!email) {
    throw new Error('invalid_nightshift_org_member_email')
  }
  return email
}

function orgUserIdFromUnknown(value: unknown): string {
  const userId = typeof value === 'string' ? value.trim() : ''
  if (!userId) {
    throw new Error('invalid_nightshift_org_member_user')
  }
  return userId
}

function orgMemberInviteArgsFromUnknown(args: unknown): NightshiftProfileOrgMemberInviteArgs {
  const { orgId, record } = orgMembersScopedArgs(args)
  return { orgId, email: orgEmailFromUnknown(record.email), role: orgRoleFromUnknown(record.role) }
}

function orgInviteRevokeArgsFromUnknown(args: unknown): NightshiftProfileOrgInviteRevokeArgs {
  const { orgId, record } = orgMembersScopedArgs(args)
  return { orgId, email: orgEmailFromUnknown(record.email) }
}

function orgMemberChangeRoleArgsFromUnknown(
  args: unknown
): NightshiftProfileOrgMemberChangeRoleArgs {
  const { orgId, record } = orgMembersScopedArgs(args)
  return {
    orgId,
    userId: orgUserIdFromUnknown(record.userId),
    role: orgRoleFromUnknown(record.role)
  }
}

function orgMemberRemoveArgsFromUnknown(args: unknown): NightshiftProfileOrgMemberRemoveArgs {
  const { orgId, record } = orgMembersScopedArgs(args)
  return { orgId, userId: orgUserIdFromUnknown(record.userId) }
}

export function registerNightshiftProfileOrgMemberHandlers(): void {
  ipcMain.handle(
    'nightshiftProfiles:orgMembersList',
    async (
      _event,
      rawArgs: NightshiftProfileOrgMembersListArgs
    ): Promise<NightshiftProfileOrgMembersListResult> =>
      listNightshiftProfileOrgMembers(getProfileUserDataPath(), orgMembersScopedArgs(rawArgs).orgId)
  )

  ipcMain.handle(
    'nightshiftProfiles:orgMemberInvite',
    async (
      _event,
      rawArgs: NightshiftProfileOrgMemberInviteArgs
    ): Promise<NightshiftProfileOrgMemberMutationResult> =>
      inviteNightshiftProfileOrgMember(
        getProfileUserDataPath(),
        orgMemberInviteArgsFromUnknown(rawArgs)
      )
  )

  ipcMain.handle(
    'nightshiftProfiles:orgInviteRevoke',
    async (
      _event,
      rawArgs: NightshiftProfileOrgInviteRevokeArgs
    ): Promise<NightshiftProfileOrgMemberMutationResult> =>
      revokeNightshiftProfileOrgInvite(
        getProfileUserDataPath(),
        orgInviteRevokeArgsFromUnknown(rawArgs)
      )
  )

  ipcMain.handle(
    'nightshiftProfiles:orgMemberChangeRole',
    async (
      _event,
      rawArgs: NightshiftProfileOrgMemberChangeRoleArgs
    ): Promise<NightshiftProfileOrgMemberMutationResult> =>
      changeNightshiftProfileOrgMemberRole(
        getProfileUserDataPath(),
        orgMemberChangeRoleArgsFromUnknown(rawArgs)
      )
  )

  ipcMain.handle(
    'nightshiftProfiles:orgMemberRemove',
    async (
      _event,
      rawArgs: NightshiftProfileOrgMemberRemoveArgs
    ): Promise<NightshiftProfileOrgMemberMutationResult> =>
      removeNightshiftProfileOrgMember(
        getProfileUserDataPath(),
        orgMemberRemoveArgsFromUnknown(rawArgs)
      )
  )
}
