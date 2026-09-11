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
  selectNightshiftCloudOrgMock,
  NightshiftCloudRequestErrorMock,
  safeStorageMock
} = vi.hoisted(() => ({
  beginNightshiftCloudPkceFlowMock: vi.fn(),
  createNightshiftCloudProfileMock: vi.fn(),
  exchangeNightshiftCloudAuthCodeMock: vi.fn(),
  refreshNightshiftCloudCapabilitiesMock: vi.fn(),
  refreshNightshiftCloudSessionMock: vi.fn(),
  selectNightshiftCloudOrgMock: vi.fn(),
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
  selectNightshiftCloudOrg: selectNightshiftCloudOrgMock
}))

import {
  connectCurrentNightshiftProfile,
  createCloudLinkedNightshiftProfile,
  getCurrentNightshiftProfileAuthStatus,
  refreshCurrentNightshiftProfileAuth,
  selectCurrentNightshiftProfileOrg
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

function mockSuccessfulConnect(): void {
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
    expiresAt: futureExpiresAt(),
    cloud: cloudSummary,
    organizations,
    capabilities
  } satisfies NightshiftCloudSessionExchangeResponse)
}

function mockSuccessfulSessionRefresh(): void {
  refreshNightshiftCloudSessionMock.mockResolvedValue({
    accessToken: 'rotated-access-token',
    refreshToken: 'rotated-refresh-token',
    expiresAt: futureExpiresAt(),
    cloud: cloudSummary,
    organizations,
    capabilities
  } satisfies NightshiftCloudSessionExchangeResponse)
}

describe('Nightshift cloud profile auth-failure retry', () => {
  beforeEach(() => {
    userDataPath = mkdtempSync(join(tmpdir(), 'nightshift-cloud-service-auth-retry-'))
    beginNightshiftCloudPkceFlowMock.mockReset()
    createNightshiftCloudProfileMock.mockReset()
    exchangeNightshiftCloudAuthCodeMock.mockReset()
    refreshNightshiftCloudCapabilitiesMock.mockReset()
    refreshNightshiftCloudSessionMock.mockReset()
    selectNightshiftCloudOrgMock.mockReset()
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

  it('refreshes and retries cloud profile creation after an auth failure', async () => {
    configureCloudEnv()
    mockSuccessfulConnect()
    mockSuccessfulSessionRefresh()
    await connectCurrentNightshiftProfile(userDataPath)
    createNightshiftCloudProfileMock
      .mockRejectedValueOnce(new NightshiftCloudRequestErrorMock(401))
      .mockResolvedValue({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresAt: futureExpiresAt(),
        cloud: { ...cloudSummary, cloudProfileId: 'cloud-profile-2' },
        organizations,
        capabilities
      } satisfies NightshiftCloudSessionExchangeResponse)

    const result = await createCloudLinkedNightshiftProfile(userDataPath, { name: 'Acme' })

    expect(result.status).toBe('created')
    expect(createNightshiftCloudProfileMock).toHaveBeenNthCalledWith(
      2,
      expect.any(Object),
      expect.objectContaining({ accessToken: 'rotated-access-token' }),
      { name: 'Acme' }
    )
  })

  it('refreshes and retries capability refresh after an auth failure', async () => {
    configureCloudEnv()
    mockSuccessfulConnect()
    mockSuccessfulSessionRefresh()
    await connectCurrentNightshiftProfile(userDataPath)
    refreshNightshiftCloudCapabilitiesMock
      .mockRejectedValueOnce(new NightshiftCloudRequestErrorMock(403))
      .mockResolvedValue({
        capabilities: {
          flags: { share: false },
          refreshedAt: 26
        } satisfies NightshiftCloudCapabilities
      })

    const result = await refreshCurrentNightshiftProfileAuth(userDataPath)

    expect(result.status).toBe('refreshed')
    expect(refreshNightshiftCloudCapabilitiesMock).toHaveBeenNthCalledWith(
      2,
      expect.any(Object),
      expect.objectContaining({ accessToken: 'rotated-access-token' })
    )
    expect(getCurrentNightshiftProfileAuthStatus(userDataPath).capabilities).toEqual({
      flags: { share: false },
      refreshedAt: 26
    })
  })

  it('requires reconnect when a retried capability refresh is still unauthorized', async () => {
    configureCloudEnv()
    mockSuccessfulConnect()
    mockSuccessfulSessionRefresh()
    await connectCurrentNightshiftProfile(userDataPath)
    refreshNightshiftCloudCapabilitiesMock
      .mockRejectedValueOnce(new NightshiftCloudRequestErrorMock(401))
      .mockRejectedValueOnce(new NightshiftCloudRequestErrorMock(401))

    const result = await refreshCurrentNightshiftProfileAuth(userDataPath)

    expect(result.status).toBe('reconnect-required')
    expect(getCurrentNightshiftProfileAuthStatus(userDataPath)).toMatchObject({
      state: 'reconnect-required',
      persistence: 'none',
      cloud: cloudSummary
    })
  })

  it('refreshes and retries organization selection after an auth failure', async () => {
    configureCloudEnv()
    mockSuccessfulConnect()
    mockSuccessfulSessionRefresh()
    await connectCurrentNightshiftProfile(userDataPath)
    selectNightshiftCloudOrgMock
      .mockRejectedValueOnce(new NightshiftCloudRequestErrorMock(401))
      .mockResolvedValue({
        cloud: { ...cloudSummary, activeOrgId: 'org-1', activeOrgName: 'Acme' },
        organizations,
        capabilities
      })

    const result = await selectCurrentNightshiftProfileOrg(userDataPath, 'org-1')

    expect(result.status).toBe('selected')
    expect(selectNightshiftCloudOrgMock).toHaveBeenNthCalledWith(
      2,
      expect.any(Object),
      expect.objectContaining({ accessToken: 'rotated-access-token' }),
      'org-1'
    )
  })
})
