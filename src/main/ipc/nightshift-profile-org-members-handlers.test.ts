import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  handlers,
  listNightshiftProfileOrgMembersMock,
  inviteNightshiftProfileOrgMemberMock,
  revokeNightshiftProfileOrgInviteMock,
  changeNightshiftProfileOrgMemberRoleMock,
  removeNightshiftProfileOrgMemberMock
} = vi.hoisted(() => ({
  handlers: new Map<string, (_event: unknown, args?: unknown) => unknown>(),
  listNightshiftProfileOrgMembersMock: vi.fn(),
  inviteNightshiftProfileOrgMemberMock: vi.fn(),
  revokeNightshiftProfileOrgInviteMock: vi.fn(),
  changeNightshiftProfileOrgMemberRoleMock: vi.fn(),
  removeNightshiftProfileOrgMemberMock: vi.fn()
}))

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn((channel: string, handler: (_event: unknown, args?: unknown) => unknown) => {
      handlers.set(channel, handler)
    })
  }
}))

vi.mock('../nightshift-profiles/profile-storage-paths', () => ({
  getProfileUserDataPath: () => '/tmp/nightshift-user-data'
}))

vi.mock('../nightshift-profiles/profile-cloud-org-members-service', () => ({
  listNightshiftProfileOrgMembers: listNightshiftProfileOrgMembersMock,
  inviteNightshiftProfileOrgMember: inviteNightshiftProfileOrgMemberMock,
  revokeNightshiftProfileOrgInvite: revokeNightshiftProfileOrgInviteMock,
  changeNightshiftProfileOrgMemberRole: changeNightshiftProfileOrgMemberRoleMock,
  removeNightshiftProfileOrgMember: removeNightshiftProfileOrgMemberMock
}))

import { registerNightshiftProfileOrgMemberHandlers } from './nightshift-profile-org-members-handlers'

function invoke(channel: string, args?: unknown): unknown {
  const handler = handlers.get(channel)
  if (!handler) {
    throw new Error(`No handler for ${channel}`)
  }
  return handler({}, args)
}

describe('registerNightshiftProfileOrgMemberHandlers', () => {
  beforeEach(() => {
    handlers.clear()
    listNightshiftProfileOrgMembersMock.mockReset().mockResolvedValue({ status: 'ok', roster: {} })
    inviteNightshiftProfileOrgMemberMock.mockReset().mockResolvedValue({ status: 'ok' })
    revokeNightshiftProfileOrgInviteMock.mockReset().mockResolvedValue({ status: 'ok' })
    changeNightshiftProfileOrgMemberRoleMock.mockReset().mockResolvedValue({ status: 'ok' })
    removeNightshiftProfileOrgMemberMock.mockReset().mockResolvedValue({ status: 'ok' })
    registerNightshiftProfileOrgMemberHandlers()
  })

  it('registers all five org-member channels', () => {
    expect([...handlers.keys()].sort()).toEqual(
      [
        'nightshiftProfiles:orgInviteRevoke',
        'nightshiftProfiles:orgMemberChangeRole',
        'nightshiftProfiles:orgMemberInvite',
        'nightshiftProfiles:orgMemberRemove',
        'nightshiftProfiles:orgMembersList'
      ].sort()
    )
  })

  it('forwards a valid invite to the service with a trimmed email', async () => {
    await invoke('nightshiftProfiles:orgMemberInvite', {
      orgId: 'org-1',
      email: '  new@example.com  ',
      role: 'admin'
    })
    expect(inviteNightshiftProfileOrgMemberMock).toHaveBeenCalledWith('/tmp/nightshift-user-data', {
      orgId: 'org-1',
      email: 'new@example.com',
      role: 'admin'
    })
  })

  it('rejects an invite with a missing org id', async () => {
    await expect(
      invoke('nightshiftProfiles:orgMemberInvite', { email: 'a@b.com', role: 'member' })
    ).rejects.toThrow('invalid_nightshift_profile_org_selection')
    expect(inviteNightshiftProfileOrgMemberMock).not.toHaveBeenCalled()
  })

  it('rejects an invite with an unknown role', async () => {
    await expect(
      invoke('nightshiftProfiles:orgMemberInvite', {
        orgId: 'org-1',
        email: 'a@b.com',
        role: 'root'
      })
    ).rejects.toThrow('invalid_nightshift_org_role')
  })

  it('rejects a role change with a blank user id', async () => {
    await expect(
      invoke('nightshiftProfiles:orgMemberChangeRole', {
        orgId: 'org-1',
        userId: '  ',
        role: 'admin'
      })
    ).rejects.toThrow('invalid_nightshift_org_member_user')
  })

  it('forwards remove and revoke with validated args', async () => {
    await invoke('nightshiftProfiles:orgMemberRemove', { orgId: 'org-1', userId: 'user-2' })
    expect(removeNightshiftProfileOrgMemberMock).toHaveBeenCalledWith('/tmp/nightshift-user-data', {
      orgId: 'org-1',
      userId: 'user-2'
    })
    await invoke('nightshiftProfiles:orgInviteRevoke', { orgId: 'org-1', email: 'gone@b.com' })
    expect(revokeNightshiftProfileOrgInviteMock).toHaveBeenCalledWith('/tmp/nightshift-user-data', {
      orgId: 'org-1',
      email: 'gone@b.com'
    })
  })
})
