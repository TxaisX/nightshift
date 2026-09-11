import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { NightshiftOrgMembersRoster } from '../../shared/nightshift-profiles'
import { NightshiftCloudRequestError } from './profile-cloud-client'

const {
  runWithFreshNightshiftCloudSessionMock,
  listNightshiftCloudOrgMembersMock,
  inviteNightshiftCloudOrgMemberMock,
  revokeNightshiftCloudOrgInviteMock,
  changeNightshiftCloudOrgMemberRoleMock,
  removeNightshiftCloudOrgMemberMock
} = vi.hoisted(() => ({
  runWithFreshNightshiftCloudSessionMock: vi.fn(),
  listNightshiftCloudOrgMembersMock: vi.fn(),
  inviteNightshiftCloudOrgMemberMock: vi.fn(),
  revokeNightshiftCloudOrgInviteMock: vi.fn(),
  changeNightshiftCloudOrgMemberRoleMock: vi.fn(),
  removeNightshiftCloudOrgMemberMock: vi.fn()
}))

let userDataPath = ''

vi.mock('electron', () => ({
  app: { getPath: () => userDataPath }
}))

vi.mock('./profile-cloud-session-refresh', () => ({
  runWithFreshNightshiftCloudSessionMock,
  runWithFreshNightshiftCloudSession: runWithFreshNightshiftCloudSessionMock
}))

vi.mock('./profile-cloud-org-members-client', () => ({
  listNightshiftCloudOrgMembers: listNightshiftCloudOrgMembersMock,
  inviteNightshiftCloudOrgMember: inviteNightshiftCloudOrgMemberMock,
  revokeNightshiftCloudOrgInvite: revokeNightshiftCloudOrgInviteMock,
  changeNightshiftCloudOrgMemberRole: changeNightshiftCloudOrgMemberRoleMock,
  removeNightshiftCloudOrgMember: removeNightshiftCloudOrgMemberMock
}))

import {
  changeNightshiftProfileOrgMemberRole,
  inviteNightshiftProfileOrgMember,
  listNightshiftProfileOrgMembers,
  removeNightshiftProfileOrgMember,
  revokeNightshiftProfileOrgInvite
} from './profile-cloud-org-members-service'

const fakeSession = {
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  expiresAt: Date.now() + 3_600_000,
  capabilities: { flags: {}, refreshedAt: 1 }
}

// Why: mirror the real contract — invoke the operation with a live session and
// surface its resolved value; business 4xx are returned by the operation as
// values, never thrown, so the session layer never sees them.
function runOperationDirectly(): void {
  runWithFreshNightshiftCloudSessionMock.mockImplementation(
    async (
      _config: unknown,
      _active: unknown,
      _path: unknown,
      op: (session: unknown) => unknown
    ) => ({
      status: 'ok',
      value: await op(fakeSession)
    })
  )
}

function configureCloudEnv(): void {
  vi.stubEnv('NIGHTSHIFT_CLOUD_API_URL', 'https://nightshift-cloud.example')
  vi.stubEnv('NIGHTSHIFT_CLOUD_CLIENT_ID', 'desktop-client')
}

const roster: NightshiftOrgMembersRoster = {
  members: [{ userId: 'user-1', email: 'nina@example.com', role: 'owner' }],
  pendingInvites: [],
  viewerRole: 'owner',
  canManageMembers: true
}

describe('Nightshift cloud org members service (configured)', () => {
  beforeEach(() => {
    userDataPath = mkdtempSync(join(tmpdir(), 'nightshift-org-members-'))
    runWithFreshNightshiftCloudSessionMock.mockReset()
    listNightshiftCloudOrgMembersMock.mockReset()
    inviteNightshiftCloudOrgMemberMock.mockReset()
    revokeNightshiftCloudOrgInviteMock.mockReset()
    changeNightshiftCloudOrgMemberRoleMock.mockReset()
    removeNightshiftCloudOrgMemberMock.mockReset()
    vi.unstubAllEnvs()
    vi.stubEnv('NIGHTSHIFT_CLOUD_DEV_AUTH', '')
    vi.stubEnv('NIGHTSHIFT_CLOUD_API_URL', '')
    vi.stubEnv('NIGHTSHIFT_CLOUD_CLIENT_ID', '')
  })

  afterEach(() => {
    rmSync(userDataPath, { recursive: true, force: true })
    vi.unstubAllEnvs()
  })

  it('reports unconfigured when cloud sign-in is not set up', async () => {
    await expect(listNightshiftProfileOrgMembers(userDataPath, 'org-1')).resolves.toEqual({
      status: 'unconfigured'
    })
    expect(runWithFreshNightshiftCloudSessionMock).not.toHaveBeenCalled()
  })

  it('returns the roster from the client', async () => {
    configureCloudEnv()
    runOperationDirectly()
    listNightshiftCloudOrgMembersMock.mockResolvedValue(roster)

    await expect(listNightshiftProfileOrgMembers(userDataPath, 'org-1')).resolves.toEqual({
      status: 'ok',
      roster
    })
    expect(listNightshiftCloudOrgMembersMock).toHaveBeenCalledWith(
      expect.any(Object),
      fakeSession,
      'org-1'
    )
  })

  it('maps a 409 already_member invite conflict', async () => {
    configureCloudEnv()
    runOperationDirectly()
    inviteNightshiftCloudOrgMemberMock.mockRejectedValue(
      new NightshiftCloudRequestError(409, 'already_member')
    )

    await expect(
      inviteNightshiftProfileOrgMember(userDataPath, {
        orgId: 'org-1',
        email: 'a@b.com',
        role: 'member'
      })
    ).resolves.toEqual({ status: 'conflict', reason: 'already_member' })
  })

  it('maps a 403 role change to forbidden', async () => {
    configureCloudEnv()
    runOperationDirectly()
    changeNightshiftCloudOrgMemberRoleMock.mockRejectedValue(new NightshiftCloudRequestError(403))

    await expect(
      changeNightshiftProfileOrgMemberRole(userDataPath, {
        orgId: 'org-1',
        userId: 'user-2',
        role: 'admin'
      })
    ).resolves.toEqual({ status: 'forbidden' })
  })

  it('maps a 400 cannot_remove_self to an invalid result', async () => {
    configureCloudEnv()
    runOperationDirectly()
    removeNightshiftCloudOrgMemberMock.mockRejectedValue(
      new NightshiftCloudRequestError(400, 'cannot_remove_self')
    )

    await expect(
      removeNightshiftProfileOrgMember(userDataPath, { orgId: 'org-1', userId: 'user-1' })
    ).resolves.toEqual({ status: 'invalid', reason: 'cannot_remove_self' })
  })

  it('maps a 404 revoke to not-found', async () => {
    configureCloudEnv()
    runOperationDirectly()
    revokeNightshiftCloudOrgInviteMock.mockRejectedValue(new NightshiftCloudRequestError(404))

    await expect(
      revokeNightshiftProfileOrgInvite(userDataPath, { orgId: 'org-1', email: 'gone@b.com' })
    ).resolves.toEqual({ status: 'not-found' })
  })

  it('reports reconnect-required when the session layer cannot refresh', async () => {
    configureCloudEnv()
    runWithFreshNightshiftCloudSessionMock.mockResolvedValue({ status: 'reconnect-required' })

    await expect(listNightshiftProfileOrgMembers(userDataPath, 'org-1')).resolves.toEqual({
      status: 'reconnect-required'
    })
  })
})

describe('Nightshift cloud org members service (dev auth)', () => {
  beforeEach(() => {
    userDataPath = mkdtempSync(join(tmpdir(), 'nightshift-org-members-dev-'))
    runWithFreshNightshiftCloudSessionMock.mockReset()
    vi.unstubAllEnvs()
    vi.stubEnv('NIGHTSHIFT_CLOUD_DEV_AUTH', '1')
  })

  afterEach(() => {
    rmSync(userDataPath, { recursive: true, force: true })
    vi.unstubAllEnvs()
  })

  it('serves an in-memory roster the caller can manage', async () => {
    const result = await listNightshiftProfileOrgMembers(userDataPath, 'dev-list-org')
    if (result.status !== 'ok') {
      throw new Error(`Expected ok, got ${result.status}`)
    }
    expect(result.roster.canManageMembers).toBe(true)
    expect(result.roster.viewerRole).toBe('owner')
    expect(result.roster.members[0]).toMatchObject({ role: 'owner' })
    expect(result.roster.members.some((member) => member.userId === null)).toBe(true)
    expect(result.roster.pendingInvites.length).toBeGreaterThan(0)
    expect(runWithFreshNightshiftCloudSessionMock).not.toHaveBeenCalled()
  })

  it('mutates the dev roster across invite and revoke', async () => {
    const orgId = 'dev-mutate-org'
    await expect(
      inviteNightshiftProfileOrgMember(userDataPath, {
        orgId,
        email: 'fresh@nightshift.local',
        role: 'member'
      })
    ).resolves.toEqual({ status: 'ok' })

    const afterInvite = await listNightshiftProfileOrgMembers(userDataPath, orgId)
    if (afterInvite.status !== 'ok') {
      throw new Error('expected ok')
    }
    expect(
      afterInvite.roster.pendingInvites.some((i) => i.email === 'fresh@nightshift.local')
    ).toBe(true)

    await expect(
      inviteNightshiftProfileOrgMember(userDataPath, {
        orgId,
        email: 'fresh@nightshift.local',
        role: 'member'
      })
    ).resolves.toEqual({ status: 'conflict', reason: 'already_invited' })

    await expect(
      revokeNightshiftProfileOrgInvite(userDataPath, { orgId, email: 'fresh@nightshift.local' })
    ).resolves.toEqual({ status: 'ok' })
    await expect(
      revokeNightshiftProfileOrgInvite(userDataPath, { orgId, email: 'fresh@nightshift.local' })
    ).resolves.toEqual({ status: 'not-found' })
  })

  it('blocks changing the dev owner (self) role', async () => {
    const orgId = 'dev-self-org'
    const list = await listNightshiftProfileOrgMembers(userDataPath, orgId)
    if (list.status !== 'ok') {
      throw new Error('expected ok')
    }
    const self = list.roster.members.find((member) => member.role === 'owner')
    await expect(
      changeNightshiftProfileOrgMemberRole(userDataPath, {
        orgId,
        userId: self?.userId ?? 'dev-user',
        role: 'member'
      })
    ).resolves.toEqual({ status: 'invalid', reason: 'cannot_change_own_role' })
  })
})
