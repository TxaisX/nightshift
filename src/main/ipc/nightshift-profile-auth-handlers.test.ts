import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  handlers,
  createCloudLinkedNightshiftProfileMock,
  connectCurrentNightshiftProfileMock,
  getCurrentNightshiftProfileAuthStatusMock,
  refreshCurrentNightshiftProfileAuthMock,
  selectCurrentNightshiftProfileOrgMock,
  signOutCurrentNightshiftProfileMock
} = vi.hoisted(() => ({
  handlers: new Map<string, (_event: unknown, args?: unknown) => unknown>(),
  createCloudLinkedNightshiftProfileMock: vi.fn(),
  connectCurrentNightshiftProfileMock: vi.fn(),
  getCurrentNightshiftProfileAuthStatusMock: vi.fn(),
  refreshCurrentNightshiftProfileAuthMock: vi.fn(),
  selectCurrentNightshiftProfileOrgMock: vi.fn(),
  signOutCurrentNightshiftProfileMock: vi.fn()
}))

vi.mock('electron', () => ({
  app: {
    exit: vi.fn(),
    relaunch: vi.fn()
  },
  ipcMain: {
    handle: vi.fn((channel: string, handler: (_event: unknown, args?: unknown) => unknown) => {
      handlers.set(channel, handler)
    })
  }
}))

vi.mock('../tray/system-tray', () => ({
  destroySystemTray: vi.fn()
}))

vi.mock('../nightshift-profiles/profile-index-store', () => ({
  createLocalNightshiftProfile: vi.fn(),
  getNightshiftProfileListState: vi.fn(),
  seedNewNightshiftProfileTelemetryConsent: vi.fn(),
  setActiveNightshiftProfile: vi.fn()
}))

vi.mock('../nightshift-profiles/profile-project-transfer', () => ({
  transferNightshiftProfileProject: vi.fn()
}))

vi.mock('../nightshift-profiles/profile-cloud-service', () => ({
  createCloudLinkedNightshiftProfile: createCloudLinkedNightshiftProfileMock,
  connectCurrentNightshiftProfile: connectCurrentNightshiftProfileMock,
  getCurrentNightshiftProfileAuthStatus: getCurrentNightshiftProfileAuthStatusMock,
  refreshCurrentNightshiftProfileAuth: refreshCurrentNightshiftProfileAuthMock,
  selectCurrentNightshiftProfileOrg: selectCurrentNightshiftProfileOrgMock,
  signOutCurrentNightshiftProfile: signOutCurrentNightshiftProfileMock
}))

import { registerNightshiftProfileHandlers } from './nightshift-profiles'
import { installFakeAppEnvironment } from '../../../config/scripts/vitest-host-ports-setup'

describe('registerNightshiftProfileHandlers auth channels', () => {
  beforeEach(() => {
    // Why the port and per-test: userData resolves through AppEnvironment now, and
    // the global setup's beforeEach reinstates its own fake before this runs.
    installFakeAppEnvironment({ getPath: () => '/tmp/nightshift-user-data' })
    handlers.clear()
    createCloudLinkedNightshiftProfileMock.mockReset()
    connectCurrentNightshiftProfileMock.mockReset()
    getCurrentNightshiftProfileAuthStatusMock.mockReset()
    refreshCurrentNightshiftProfileAuthMock.mockReset()
    selectCurrentNightshiftProfileOrgMock.mockReset()
    signOutCurrentNightshiftProfileMock.mockReset()
  })

  it('returns auth status for the current profile', async () => {
    const status = {
      activeProfileId: 'local-default',
      configured: false,
      state: 'unconfigured',
      persistence: 'none'
    }
    getCurrentNightshiftProfileAuthStatusMock.mockReturnValue(status)
    registerNightshiftProfileHandlers({
      flush: vi.fn(),
      freezeWrites: vi.fn(),
      getSettings: () => ({})
    } as never)

    await expect(
      Promise.resolve(handlers.get('nightshiftProfiles:authStatus')?.(null))
    ).resolves.toBe(status)
    expect(getCurrentNightshiftProfileAuthStatusMock).toHaveBeenCalledWith(
      '/tmp/nightshift-user-data'
    )
  })

  it('connects and signs out the current profile through the cloud service', async () => {
    const connectResult = { status: 'unconfigured', auth: { activeProfileId: 'local-default' } }
    const signOutResult = { status: 'signed-out', auth: { activeProfileId: 'local-default' } }
    connectCurrentNightshiftProfileMock.mockResolvedValue(connectResult)
    signOutCurrentNightshiftProfileMock.mockResolvedValue(signOutResult)
    registerNightshiftProfileHandlers({
      flush: vi.fn(),
      freezeWrites: vi.fn(),
      getSettings: () => ({})
    } as never)

    await expect(
      Promise.resolve(handlers.get('nightshiftProfiles:connectCurrent')?.(null))
    ).resolves.toBe(connectResult)
    await expect(
      Promise.resolve(handlers.get('nightshiftProfiles:signOutCurrent')?.(null))
    ).resolves.toBe(signOutResult)
    expect(connectCurrentNightshiftProfileMock).toHaveBeenCalledWith('/tmp/nightshift-user-data')
    expect(signOutCurrentNightshiftProfileMock).toHaveBeenCalledWith('/tmp/nightshift-user-data')
  })

  it('refreshes profile auth through the cloud service', async () => {
    const refreshResult = { status: 'refreshed', auth: { activeProfileId: 'local-default' } }
    refreshCurrentNightshiftProfileAuthMock.mockResolvedValue(refreshResult)
    registerNightshiftProfileHandlers({
      flush: vi.fn(),
      freezeWrites: vi.fn(),
      getSettings: () => ({})
    } as never)

    await expect(
      Promise.resolve(handlers.get('nightshiftProfiles:refreshAuth')?.(null))
    ).resolves.toBe(refreshResult)
    expect(refreshCurrentNightshiftProfileAuthMock).toHaveBeenCalledWith(
      '/tmp/nightshift-user-data'
    )
  })

  it('validates organization selection before calling the cloud service', async () => {
    const selectResult = { status: 'selected', auth: { activeProfileId: 'local-default' } }
    selectCurrentNightshiftProfileOrgMock.mockResolvedValue(selectResult)
    registerNightshiftProfileHandlers({
      flush: vi.fn(),
      freezeWrites: vi.fn(),
      getSettings: () => ({})
    } as never)

    await expect(
      Promise.resolve(handlers.get('nightshiftProfiles:selectOrg')?.(null, { orgId: ' org-1 ' }))
    ).resolves.toBe(selectResult)
    expect(selectCurrentNightshiftProfileOrgMock).toHaveBeenCalledWith(
      '/tmp/nightshift-user-data',
      'org-1'
    )

    await expect(
      Promise.resolve(handlers.get('nightshiftProfiles:selectOrg')?.(null, { orgId: ' ' }))
    ).rejects.toThrow('invalid_nightshift_profile_org_selection')
  })

  it('creates cloud-linked profiles with trimmed optional args', async () => {
    const createResult = {
      status: 'created',
      auth: { activeProfileId: 'local-default' },
      activeProfileId: 'local-default',
      profiles: [],
      profile: { id: 'cloud-1' }
    }
    createCloudLinkedNightshiftProfileMock.mockResolvedValue(createResult)
    registerNightshiftProfileHandlers({
      flush: vi.fn(),
      freezeWrites: vi.fn(),
      getSettings: () => ({})
    } as never)

    await expect(
      Promise.resolve(
        handlers.get('nightshiftProfiles:createCloudLinked')?.(null, {
          orgId: ' org-1 ',
          name: ' Acme '
        })
      )
    ).resolves.toBe(createResult)
    expect(createCloudLinkedNightshiftProfileMock).toHaveBeenCalledWith(
      '/tmp/nightshift-user-data',
      {
        orgId: 'org-1',
        name: 'Acme'
      }
    )
  })
})
