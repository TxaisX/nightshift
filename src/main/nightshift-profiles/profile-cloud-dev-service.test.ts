import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const {
  beginNightshiftCloudPkceFlowMock,
  exchangeNightshiftCloudAuthCodeMock,
  revokeNightshiftCloudSessionMock,
  safeStorageMock
} = vi.hoisted(() => ({
  beginNightshiftCloudPkceFlowMock: vi.fn(),
  exchangeNightshiftCloudAuthCodeMock: vi.fn(),
  revokeNightshiftCloudSessionMock: vi.fn(),
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
  createNightshiftCloudProfile: vi.fn(),
  exchangeNightshiftCloudAuthCode: exchangeNightshiftCloudAuthCodeMock,
  refreshNightshiftCloudCapabilities: vi.fn(),
  refreshNightshiftCloudSession: vi.fn(),
  revokeNightshiftCloudSession: revokeNightshiftCloudSessionMock,
  selectNightshiftCloudOrg: vi.fn()
}))

import {
  connectCurrentNightshiftProfile,
  createCloudLinkedNightshiftProfile,
  getCurrentNightshiftProfileAuthStatus,
  selectCurrentNightshiftProfileOrg,
  signOutCurrentNightshiftProfile
} from './profile-cloud-service'

describe('Nightshift cloud dev auth service', () => {
  beforeEach(() => {
    userDataPath = mkdtempSync(join(tmpdir(), 'nightshift-cloud-dev-auth-'))
    beginNightshiftCloudPkceFlowMock.mockReset()
    exchangeNightshiftCloudAuthCodeMock.mockReset()
    revokeNightshiftCloudSessionMock.mockReset()
    safeStorageMock.decryptString.mockReset()
    safeStorageMock.encryptString.mockReset()
    safeStorageMock.isEncryptionAvailable.mockReset()
    safeStorageMock.decryptString.mockImplementation((value: Buffer) => value.toString('utf-8'))
    safeStorageMock.encryptString.mockImplementation((value: string) => Buffer.from(value, 'utf-8'))
    safeStorageMock.isEncryptionAvailable.mockReturnValue(true)
    vi.unstubAllEnvs()
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('NIGHTSHIFT_CLOUD_DEV_AUTH', '1')
    vi.stubEnv('NIGHTSHIFT_CLOUD_API_URL', '')
    vi.stubEnv('NIGHTSHIFT_CLOUD_CLIENT_ID', '')
  })

  afterEach(() => {
    rmSync(userDataPath, { recursive: true, force: true })
    vi.unstubAllEnvs()
  })

  it('connects the active profile without PKCE or cloud endpoints', async () => {
    expect(getCurrentNightshiftProfileAuthStatus(userDataPath)).toMatchObject({
      configured: true,
      state: 'local'
    })

    const result = await connectCurrentNightshiftProfile(userDataPath)

    expect(result.status).toBe('connected')
    expect(beginNightshiftCloudPkceFlowMock).not.toHaveBeenCalled()
    expect(exchangeNightshiftCloudAuthCodeMock).not.toHaveBeenCalled()
    expect(getCurrentNightshiftProfileAuthStatus(userDataPath)).toMatchObject({
      configured: true,
      state: 'connected',
      persistence: 'encrypted',
      cloud: {
        cloudProfileId: 'dev-cloud-local-default',
        email: 'dev@nightshift.local'
      },
      capabilities: {
        flags: expect.objectContaining({ 'share.create': true })
      }
    })
    expect(getCurrentNightshiftProfileAuthStatus(userDataPath).organizations).toHaveLength(2)
  })

  it('selects dev organizations and creates org-scoped cloud profiles locally', async () => {
    await connectCurrentNightshiftProfile(userDataPath)

    const selected = await selectCurrentNightshiftProfileOrg(userDataPath, 'dev-acme')
    const created = await createCloudLinkedNightshiftProfile(userDataPath, {
      orgId: 'dev-acme',
      name: 'Acme Dev'
    })

    expect(selected.status).toBe('selected')
    expect(getCurrentNightshiftProfileAuthStatus(userDataPath).cloud).toMatchObject({
      activeOrgId: 'dev-acme',
      activeOrgName: 'Acme Dev'
    })
    expect(created.status).toBe('created')
    if (created.status === 'created') {
      expect(created.profile).toMatchObject({
        name: 'Acme Dev',
        kind: 'cloud-linked',
        cloud: expect.objectContaining({
          activeOrgId: 'dev-acme',
          activeOrgName: 'Acme Dev'
        })
      })
    }
  })

  it('signs out locally without calling the cloud logout endpoint', async () => {
    await connectCurrentNightshiftProfile(userDataPath)

    const result = await signOutCurrentNightshiftProfile(userDataPath)

    expect(result.status).toBe('signed-out')
    expect(revokeNightshiftCloudSessionMock).not.toHaveBeenCalled()
    expect(getCurrentNightshiftProfileAuthStatus(userDataPath)).toMatchObject({
      configured: true,
      state: 'local',
      persistence: 'none'
    })
  })
})
