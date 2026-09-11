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
  refreshNightshiftCloudCapabilitiesMock,
  refreshNightshiftCloudSessionMock,
  NightshiftCloudRequestErrorMock,
  safeStorageMock
} = vi.hoisted(() => ({
  beginNightshiftCloudPkceFlowMock: vi.fn(),
  createNightshiftCloudProfileMock: vi.fn(),
  exchangeNightshiftCloudAuthCodeMock: vi.fn(),
  refreshNightshiftCloudCapabilitiesMock: vi.fn(),
  refreshNightshiftCloudSessionMock: vi.fn(),
  NightshiftCloudRequestErrorMock: class NightshiftCloudRequestError extends Error {
    constructor(public readonly statusCode: number) {
      super(`nightshift_cloud_request_failed_${statusCode}`)
      this.name = 'NightshiftCloudRequestError'
    }
  },
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
  NightshiftCloudRequestError: NightshiftCloudRequestErrorMock,
  isAmbiguousCloudRequestFailure: (error: unknown) =>
    !(error instanceof NightshiftCloudRequestErrorMock),
  createNightshiftCloudProfile: createNightshiftCloudProfileMock,
  exchangeNightshiftCloudAuthCode: exchangeNightshiftCloudAuthCodeMock,
  refreshNightshiftCloudCapabilities: refreshNightshiftCloudCapabilitiesMock,
  refreshNightshiftCloudSession: refreshNightshiftCloudSessionMock,
  revokeNightshiftCloudSession: vi.fn(),
  selectNightshiftCloudOrg: vi.fn()
}))

import {
  connectCurrentNightshiftProfile,
  createCloudLinkedNightshiftProfile,
  getCurrentNightshiftProfileAuthStatus,
  refreshCurrentNightshiftProfileAuth
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

function futureExpiresAt(): number {
  return Date.now() + 3_600_000
}

function configureCloudEnv(): void {
  vi.stubEnv('NIGHTSHIFT_CLOUD_API_URL', 'https://nightshift-cloud.example')
  vi.stubEnv('NIGHTSHIFT_CLOUD_CLIENT_ID', 'desktop-client')
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

describe('Nightshift cloud profile service session refresh', () => {
  beforeEach(() => {
    userDataPath = mkdtempSync(join(tmpdir(), 'nightshift-cloud-service-refresh-'))
    beginNightshiftCloudPkceFlowMock.mockReset()
    createNightshiftCloudProfileMock.mockReset()
    exchangeNightshiftCloudAuthCodeMock.mockReset()
    refreshNightshiftCloudCapabilitiesMock.mockReset()
    refreshNightshiftCloudSessionMock.mockReset()
    safeStorageMock.decryptString.mockReset()
    safeStorageMock.encryptString.mockReset()
    safeStorageMock.isEncryptionAvailable.mockReset()
    safeStorageMock.decryptString.mockImplementation((value: Buffer) => value.toString('utf-8'))
    safeStorageMock.encryptString.mockImplementation((value: string) => Buffer.from(value, 'utf-8'))
    safeStorageMock.isEncryptionAvailable.mockReturnValue(true)
    vi.unstubAllEnvs()
    vi.stubEnv('NIGHTSHIFT_CLOUD_API_URL', '')
    vi.stubEnv('NIGHTSHIFT_CLOUD_CLIENT_ID', '')
  })

  afterEach(() => {
    rmSync(userDataPath, { recursive: true, force: true })
    vi.unstubAllEnvs()
  })

  it('refreshes an expired access token before creating cloud profiles', async () => {
    configureCloudEnv()
    mockSuccessfulConnect(Date.now() - 1_000)
    await connectCurrentNightshiftProfile(userDataPath)
    refreshNightshiftCloudSessionMock.mockResolvedValue({
      accessToken: 'rotated-access-token',
      refreshToken: 'rotated-refresh-token',
      expiresAt: futureExpiresAt(),
      cloud: cloudSummary,
      organizations,
      capabilities
    } satisfies NightshiftCloudSessionExchangeResponse)
    createNightshiftCloudProfileMock.mockResolvedValue({
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
      expiresAt: futureExpiresAt(),
      cloud: {
        ...cloudSummary,
        cloudProfileId: 'cloud-profile-2',
        activeOrgId: 'org-1',
        activeOrgName: 'Acme'
      },
      organizations,
      capabilities
    } satisfies NightshiftCloudSessionExchangeResponse)

    const result = await createCloudLinkedNightshiftProfile(userDataPath, {
      orgId: 'org-1',
      name: 'Acme'
    })

    expect(result.status).toBe('created')
    expect(refreshNightshiftCloudSessionMock).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ refreshToken: 'refresh-token' })
    )
    expect(createNightshiftCloudProfileMock).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ accessToken: 'rotated-access-token' }),
      { orgId: 'org-1', name: 'Acme' }
    )
  })

  it('refreshes capability flags for the connected profile', async () => {
    configureCloudEnv()
    mockSuccessfulConnect()
    await connectCurrentNightshiftProfile(userDataPath)
    refreshNightshiftCloudCapabilitiesMock.mockResolvedValue({
      capabilities: {
        flags: { share: false, team: true },
        refreshedAt: 25
      }
    })

    const result = await refreshCurrentNightshiftProfileAuth(userDataPath)

    expect(result.status).toBe('refreshed')
    expect(refreshNightshiftCloudCapabilitiesMock).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ accessToken: 'access-token' })
    )
    expect(getCurrentNightshiftProfileAuthStatus(userDataPath).capabilities).toEqual({
      flags: { share: false, team: true },
      refreshedAt: 25
    })
  })

  it('clears stale active org metadata when capability refresh returns no active org', async () => {
    configureCloudEnv()
    mockSuccessfulConnect()
    exchangeNightshiftCloudAuthCodeMock.mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresAt: futureExpiresAt(),
      cloud: { ...cloudSummary, activeOrgId: 'org-1', activeOrgName: 'Acme' },
      organizations,
      capabilities
    } satisfies NightshiftCloudSessionExchangeResponse)
    await connectCurrentNightshiftProfile(userDataPath)
    refreshNightshiftCloudCapabilitiesMock.mockResolvedValue({
      cloud: cloudSummary,
      organizations: [],
      capabilities: {
        flags: { share: false },
        refreshedAt: 31
      }
    })

    const result = await refreshCurrentNightshiftProfileAuth(userDataPath)
    const status = getCurrentNightshiftProfileAuthStatus(userDataPath)

    expect(result.status).toBe('refreshed')
    expect(status.cloud?.activeOrgId).toBeUndefined()
    expect(status.cloud?.activeOrgName).toBeUndefined()
    expect(status.organizations).toEqual([])
    expect(status.capabilities).toEqual({
      flags: { share: false },
      refreshedAt: 31
    })
  })

  it('requires reconnect when an expired refresh token is rejected', async () => {
    configureCloudEnv()
    mockSuccessfulConnect(Date.now() - 1_000)
    await connectCurrentNightshiftProfile(userDataPath)
    refreshNightshiftCloudSessionMock.mockRejectedValue(new NightshiftCloudRequestErrorMock(401))

    const result = await refreshCurrentNightshiftProfileAuth(userDataPath)

    expect(result.status).toBe('reconnect-required')
    expect(getCurrentNightshiftProfileAuthStatus(userDataPath)).toMatchObject({
      state: 'reconnect-required',
      persistence: 'none',
      cloud: cloudSummary
    })
  })
})
