import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type {
  NightshiftCloudCapabilities,
  NightshiftCloudOrgSummary,
  NightshiftProfileCloudSummary
} from '../../shared/nightshift-profiles'
import type { NightshiftCloudSessionExchangeResponse } from './profile-cloud-session-exchange'

const {
  beginNightshiftCloudPkceFlowMock,
  createNightshiftCloudProfileMock,
  exchangeNightshiftCloudAuthCodeMock,
  revokeNightshiftCloudSessionMock,
  selectNightshiftCloudOrgMock,
  safeStorageMock
} = vi.hoisted(() => ({
  beginNightshiftCloudPkceFlowMock: vi.fn(),
  createNightshiftCloudProfileMock: vi.fn(),
  exchangeNightshiftCloudAuthCodeMock: vi.fn(),
  revokeNightshiftCloudSessionMock: vi.fn(),
  selectNightshiftCloudOrgMock: vi.fn(),
  safeStorageMock: {
    decryptString: vi.fn((value: Buffer) => value.toString('utf-8')),
    encryptString: vi.fn((value: string) => Buffer.from(value, 'utf-8')),
    isEncryptionAvailable: vi.fn(() => true)
  }
}))

let userDataPath = ''

vi.mock('electron', () => ({
  app: {
    getPath: () => userDataPath
  },
  safeStorage: safeStorageMock
}))

vi.mock('./profile-cloud-pkce', () => ({
  beginNightshiftCloudPkceFlow: beginNightshiftCloudPkceFlowMock
}))

vi.mock('./profile-cloud-client', () => ({
  createNightshiftCloudProfile: createNightshiftCloudProfileMock,
  exchangeNightshiftCloudAuthCode: exchangeNightshiftCloudAuthCodeMock,
  revokeNightshiftCloudSession: revokeNightshiftCloudSessionMock,
  selectNightshiftCloudOrg: selectNightshiftCloudOrgMock
}))

import {
  connectCurrentNightshiftProfile,
  createCloudLinkedNightshiftProfile,
  getCurrentNightshiftProfileAuthStatus,
  selectCurrentNightshiftProfileOrg,
  signOutCurrentNightshiftProfile
} from './profile-cloud-service'

const cloudSummary: NightshiftProfileCloudSummary = {
  cloudProfileId: 'cloud-profile-1',
  userId: 'user-1',
  email: 'nina@example.com',
  displayName: 'Nina',
  linkedAt: 10
}

const capabilities: NightshiftCloudCapabilities = {
  flags: { share: true },
  refreshedAt: 11
}

const organizations: NightshiftCloudOrgSummary[] = [
  { orgId: 'org-1', name: 'Acme', role: 'Admin' },
  { orgId: 'org-2', name: 'Personal' }
]

function configureCloudEnv(): void {
  vi.stubEnv('NIGHTSHIFT_CLOUD_API_URL', 'https://nightshift-cloud.example')
  vi.stubEnv('NIGHTSHIFT_CLOUD_CLIENT_ID', 'desktop-client')
}

function futureExpiresAt(): number {
  return Date.now() + 3_600_000
}

function mockSuccessfulConnect(expiresAt = futureExpiresAt()): void {
  beginNightshiftCloudPkceFlowMock.mockResolvedValue({
    code: 'auth-code',
    codeVerifier: 'code-verifier',
    nonce: 'nonce',
    redirectUri: 'http://127.0.0.1:4100/auth/callback',
    state: 'state'
  })
  exchangeNightshiftCloudAuthCodeMock.mockResolvedValue({
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    expiresAt,
    cloud: cloudSummary,
    organizations,
    capabilities
  } satisfies NightshiftCloudSessionExchangeResponse)
}

describe('Nightshift cloud profile service', () => {
  beforeEach(() => {
    userDataPath = mkdtempSync(join(tmpdir(), 'nightshift-cloud-service-'))
    beginNightshiftCloudPkceFlowMock.mockReset()
    createNightshiftCloudProfileMock.mockReset()
    exchangeNightshiftCloudAuthCodeMock.mockReset()
    revokeNightshiftCloudSessionMock.mockReset()
    selectNightshiftCloudOrgMock.mockReset()
    safeStorageMock.decryptString.mockReset()
    safeStorageMock.encryptString.mockReset()
    safeStorageMock.isEncryptionAvailable.mockReset()
    safeStorageMock.decryptString.mockImplementation((value: Buffer) => value.toString('utf-8'))
    safeStorageMock.encryptString.mockImplementation((value: string) => Buffer.from(value, 'utf-8'))
    safeStorageMock.isEncryptionAvailable.mockReturnValue(true)
    revokeNightshiftCloudSessionMock.mockResolvedValue(undefined)
    vi.unstubAllEnvs()
    vi.stubEnv('NIGHTSHIFT_CLOUD_API_URL', '')
    vi.stubEnv('NIGHTSHIFT_CLOUD_CLIENT_ID', '')
  })

  afterEach(() => {
    rmSync(userDataPath, { recursive: true, force: true })
    vi.unstubAllEnvs()
  })

  it('reports local unconfigured auth without cloud setup', () => {
    expect(getCurrentNightshiftProfileAuthStatus(userDataPath)).toMatchObject({
      activeProfileId: 'local-default',
      configured: false,
      state: 'unconfigured',
      persistence: 'none'
    })
  })

  it('connects the active local profile without replacing its local profile ID', async () => {
    configureCloudEnv()
    mockSuccessfulConnect()

    const result = await connectCurrentNightshiftProfile(userDataPath)

    if (result.status !== 'connected') {
      throw new Error(`Expected connected result, got ${result.status}`)
    }
    expect(result.activeProfileId).toBe('local-default')
    expect(result.profiles[0]).toMatchObject({
      id: 'local-default',
      kind: 'cloud-linked',
      cloud: cloudSummary
    })
    expect(exchangeNightshiftCloudAuthCodeMock).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ localProfileId: 'local-default', nonce: 'nonce' })
    )
    expect(getCurrentNightshiftProfileAuthStatus(userDataPath)).toMatchObject({
      state: 'connected',
      persistence: 'encrypted',
      cloud: cloudSummary,
      organizations,
      capabilities
    })
  })

  it('treats provider-denied sign-in as a cancelled connect attempt', async () => {
    configureCloudEnv()
    beginNightshiftCloudPkceFlowMock.mockRejectedValue(new Error('nightshift_cloud_auth_denied'))

    const result = await connectCurrentNightshiftProfile(userDataPath)

    expect(result.status).toBe('cancelled')
    expect(exchangeNightshiftCloudAuthCodeMock).not.toHaveBeenCalled()
    expect(getCurrentNightshiftProfileAuthStatus(userDataPath)).toMatchObject({
      state: 'local',
      persistence: 'none'
    })
  })

  it('does not report a saved cloud session as connected when cloud config is unavailable', async () => {
    configureCloudEnv()
    mockSuccessfulConnect()
    await connectCurrentNightshiftProfile(userDataPath)
    vi.stubEnv('NIGHTSHIFT_CLOUD_API_URL', '')
    vi.stubEnv('NIGHTSHIFT_CLOUD_CLIENT_ID', '')

    expect(getCurrentNightshiftProfileAuthStatus(userDataPath)).toMatchObject({
      configured: false,
      state: 'unconfigured',
      persistence: 'encrypted',
      cloud: cloudSummary,
      setupMessage: 'Nightshift Cloud sign-in is not configured for this build.'
    })
    expect(getCurrentNightshiftProfileAuthStatus(userDataPath).organizations).toBeUndefined()
    expect(getCurrentNightshiftProfileAuthStatus(userDataPath).capabilities).toBeUndefined()
  })

  it('signs out by removing cloud metadata while keeping the local profile', async () => {
    configureCloudEnv()
    mockSuccessfulConnect()
    await connectCurrentNightshiftProfile(userDataPath)

    const result = await signOutCurrentNightshiftProfile(userDataPath)

    expect(result.status).toBe('signed-out')
    expect(result.activeProfileId).toBe('local-default')
    expect(result.profiles[0]).toMatchObject({ id: 'local-default', kind: 'local' })
    expect(result.profiles[0]?.cloud).toBeUndefined()
    expect(getCurrentNightshiftProfileAuthStatus(userDataPath)).toMatchObject({
      state: 'local',
      persistence: 'none'
    })
    expect(revokeNightshiftCloudSessionMock).toHaveBeenCalledOnce()
  })

  it('creates a new empty cloud-linked profile with its own cloud session', async () => {
    configureCloudEnv()
    mockSuccessfulConnect()
    await connectCurrentNightshiftProfile(userDataPath)
    createNightshiftCloudProfileMock.mockResolvedValue({
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
      expiresAt: 1000,
      cloud: {
        ...cloudSummary,
        cloudProfileId: 'cloud-profile-2',
        activeOrgId: 'org-1',
        activeOrgName: 'Acme'
      },
      organizations,
      capabilities: { flags: { share: true, team: true }, refreshedAt: 13 }
    } satisfies NightshiftCloudSessionExchangeResponse)

    const result = await createCloudLinkedNightshiftProfile(userDataPath, {
      orgId: 'org-1',
      name: 'Acme'
    })

    if (result.status !== 'created') {
      throw new Error(`Expected created result, got ${result.status}`)
    }
    expect(result.profile).toMatchObject({
      id: expect.stringMatching(/^cloud-/),
      name: 'Acme',
      kind: 'cloud-linked',
      cloud: expect.objectContaining({ cloudProfileId: 'cloud-profile-2' })
    })
    expect(createNightshiftCloudProfileMock).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ accessToken: 'access-token' }),
      { orgId: 'org-1', name: 'Acme' }
    )
  })

  it('selects an organization for a connected profile', async () => {
    configureCloudEnv()
    mockSuccessfulConnect()
    await connectCurrentNightshiftProfile(userDataPath)
    const orgCloudSummary = {
      ...cloudSummary,
      activeOrgId: 'org-1',
      activeOrgName: 'Acme'
    }
    selectNightshiftCloudOrgMock.mockResolvedValue({
      cloud: orgCloudSummary,
      organizations,
      capabilities: { flags: { share: true, sso: true }, refreshedAt: 12 }
    })

    const result = await selectCurrentNightshiftProfileOrg(userDataPath, 'org-1')

    expect(result.status).toBe('selected')
    expect(selectNightshiftCloudOrgMock).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ accessToken: 'access-token' }),
      'org-1'
    )
    expect(getCurrentNightshiftProfileAuthStatus(userDataPath).cloud).toMatchObject({
      activeOrgId: 'org-1',
      activeOrgName: 'Acme'
    })
    expect(getCurrentNightshiftProfileAuthStatus(userDataPath).organizations).toEqual(organizations)
  })
})
