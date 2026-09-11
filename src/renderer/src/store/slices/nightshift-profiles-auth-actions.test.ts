import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createTestStore } from './store-test-helpers'
import type {
  ConnectCurrentNightshiftProfileResult,
  CreateCloudLinkedNightshiftProfileResult,
  NightshiftProfileAuthStatus,
  NightshiftProfileListState,
  RefreshCurrentNightshiftProfileAuthResult,
  SelectNightshiftProfileOrgResult,
  SignOutCurrentNightshiftProfileResult
} from '../../../../shared/nightshift-profiles'

const listState: NightshiftProfileListState = {
  activeProfileId: 'local-default',
  profiles: [
    {
      id: 'local-default',
      name: 'Personal',
      avatar: { kind: 'initials', initials: 'P', color: 'neutral' },
      kind: 'local',
      createdAt: 1,
      updatedAt: 1,
      lastOpenedAt: 1
    }
  ]
}

const localAuthStatus: NightshiftProfileAuthStatus = {
  activeProfileId: 'local-default',
  configured: false,
  state: 'unconfigured',
  persistence: 'none'
}

const connectedCloud = {
  cloudProfileId: 'cloud-profile-1',
  userId: 'user-1',
  email: 'nina@example.com',
  linkedAt: 3
}

const connectedOrganizations = [
  { orgId: 'org-1', name: 'Acme', role: 'Admin' },
  { orgId: 'org-2', name: 'Personal' }
]

const connectedAuthStatus: NightshiftProfileAuthStatus = {
  activeProfileId: 'local-default',
  configured: true,
  state: 'connected',
  persistence: 'encrypted',
  cloud: connectedCloud,
  organizations: connectedOrganizations,
  capabilities: {
    flags: { share: true },
    refreshedAt: 4
  }
}

const nightshiftProfilesApi = {
  list: vi.fn(),
  authStatus: vi.fn(),
  createLocal: vi.fn(),
  createCloudLinked: vi.fn(),
  connectCurrent: vi.fn(),
  refreshAuth: vi.fn(),
  signOutCurrent: vi.fn(),
  selectOrg: vi.fn(),
  switchProfile: vi.fn(),
  transferProject: vi.fn()
}

describe('nightshift profile auth actions slice', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    nightshiftProfilesApi.authStatus.mockResolvedValue(localAuthStatus)
    vi.stubGlobal('window', {
      api: {
        nightshiftProfiles: nightshiftProfilesApi
      }
    })
  })

  it('connects the current profile and stores returned cloud metadata', async () => {
    const connectedProfiles = [
      {
        ...listState.profiles[0],
        kind: 'cloud-linked' as const,
        cloud: connectedAuthStatus.cloud
      }
    ]
    const result: ConnectCurrentNightshiftProfileResult = {
      status: 'connected',
      auth: connectedAuthStatus,
      activeProfileId: 'local-default',
      profiles: connectedProfiles
    }
    nightshiftProfilesApi.connectCurrent.mockResolvedValue(result)
    const store = createTestStore()

    const pending = store.getState().connectCurrentNightshiftProfile()

    expect(store.getState().nightshiftProfileConnecting).toBe(true)
    await expect(pending).resolves.toEqual(result)
    expect(store.getState().nightshiftProfileConnecting).toBe(false)
    expect(store.getState().nightshiftProfileAuthStatus).toEqual(connectedAuthStatus)
    expect(store.getState().nightshiftProfiles).toEqual(connectedProfiles)
  })

  it('refreshes current profile auth and stores fresh capability flags', async () => {
    const refreshedAuthStatus: NightshiftProfileAuthStatus = {
      ...connectedAuthStatus,
      capabilities: {
        flags: { share: false, team: true },
        refreshedAt: 8
      }
    }
    const result: RefreshCurrentNightshiftProfileAuthResult = {
      status: 'refreshed',
      auth: refreshedAuthStatus,
      activeProfileId: 'local-default',
      profiles: [
        {
          ...listState.profiles[0],
          kind: 'cloud-linked',
          cloud: refreshedAuthStatus.cloud
        }
      ]
    }
    nightshiftProfilesApi.refreshAuth.mockResolvedValue(result)
    const store = createTestStore()

    await expect(store.getState().refreshCurrentNightshiftProfileAuth()).resolves.toEqual(result)
    expect(nightshiftProfilesApi.refreshAuth).toHaveBeenCalledOnce()
    expect(store.getState().nightshiftProfileAuthStatus).toEqual(refreshedAuthStatus)
    expect(store.getState().nightshiftProfiles).toEqual(result.profiles)
  })

  it('creates a cloud-linked profile and stores the returned profile list', async () => {
    const cloudProfile = {
      id: 'cloud-acme',
      name: 'Acme',
      avatar: { kind: 'initials' as const, initials: 'A', color: 'neutral' as const },
      kind: 'cloud-linked' as const,
      createdAt: 5,
      updatedAt: 5,
      lastOpenedAt: 5,
      cloud: {
        ...connectedCloud,
        cloudProfileId: 'cloud-profile-2',
        activeOrgId: 'org-1',
        activeOrgName: 'Acme'
      }
    }
    const result: CreateCloudLinkedNightshiftProfileResult = {
      status: 'created',
      auth: connectedAuthStatus,
      activeProfileId: 'local-default',
      profiles: [...listState.profiles, cloudProfile],
      profile: cloudProfile
    }
    nightshiftProfilesApi.createCloudLinked.mockResolvedValue(result)
    const store = createTestStore()

    await expect(
      store.getState().createCloudLinkedNightshiftProfile({ orgId: 'org-1', name: 'Acme' })
    ).resolves.toEqual(result)
    expect(nightshiftProfilesApi.createCloudLinked).toHaveBeenCalledWith({
      orgId: 'org-1',
      name: 'Acme'
    })
    expect(store.getState().nightshiftProfiles).toEqual(result.profiles)
  })

  it('signs out the current profile without dropping local profile data', async () => {
    const result: SignOutCurrentNightshiftProfileResult = {
      status: 'signed-out',
      auth: localAuthStatus,
      activeProfileId: 'local-default',
      profiles: listState.profiles
    }
    nightshiftProfilesApi.signOutCurrent.mockResolvedValue(result)
    const store = createTestStore()

    await expect(store.getState().signOutCurrentNightshiftProfile()).resolves.toEqual(result)
    expect(store.getState().nightshiftProfileAuthStatus).toEqual(localAuthStatus)
    expect(store.getState().nightshiftProfiles).toEqual(listState.profiles)
  })

  it('selects a cloud organization and refreshes auth state', async () => {
    const selectedAuthStatus: NightshiftProfileAuthStatus = {
      ...connectedAuthStatus,
      cloud: {
        ...connectedCloud,
        activeOrgId: 'org-1',
        activeOrgName: 'Acme'
      }
    }
    const result: SelectNightshiftProfileOrgResult = {
      status: 'selected',
      auth: selectedAuthStatus,
      activeProfileId: 'local-default',
      profiles: [
        {
          ...listState.profiles[0],
          kind: 'cloud-linked',
          cloud: selectedAuthStatus.cloud
        }
      ]
    }
    nightshiftProfilesApi.selectOrg.mockResolvedValue(result)
    const store = createTestStore()

    await expect(store.getState().selectNightshiftProfileOrg('org-1')).resolves.toEqual(result)
    expect(nightshiftProfilesApi.selectOrg).toHaveBeenCalledWith({ orgId: 'org-1' })
    expect(store.getState().nightshiftProfileAuthStatus).toEqual(selectedAuthStatus)
    expect(store.getState().nightshiftProfileAuthStatus?.organizations).toEqual(
      connectedOrganizations
    )
  })
})
