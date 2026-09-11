import { describe, expect, it, vi } from 'vitest'
import {
  allowsPlaintextNightshiftCloudSession,
  getNightshiftCloudAuthConfig,
  isNightshiftCloudDevAuthEnabled
} from './profile-cloud-auth-config'

vi.mock('electron', () => ({
  app: {
    isPackaged: false
  }
}))

describe('Nightshift cloud auth config', () => {
  it('reports unconfigured without both API URL and client ID', () => {
    expect(getNightshiftCloudAuthConfig({})).toEqual({
      configured: false,
      setupMessage: 'Nightshift Cloud sign-in is not configured for this build.'
    })
  })

  it('builds default desktop auth endpoints from the API URL', () => {
    const state = getNightshiftCloudAuthConfig({
      NIGHTSHIFT_CLOUD_API_URL: 'https://nightshift-cloud.example/',
      NIGHTSHIFT_CLOUD_CLIENT_ID: 'desktop-client'
    })

    expect(state).toEqual({
      configured: true,
      config: {
        apiBaseUrl: 'https://nightshift-cloud.example',
        authorizeEndpoint: 'https://nightshift-cloud.example/v1/desktop/auth/authorize',
        sessionEndpoint: 'https://nightshift-cloud.example/v1/desktop/auth/session',
        refreshEndpoint: 'https://nightshift-cloud.example/v1/desktop/auth/refresh',
        capabilitiesEndpoint: 'https://nightshift-cloud.example/v1/desktop/auth/capabilities',
        profileEndpoint: 'https://nightshift-cloud.example/v1/desktop/auth/profile',
        orgEndpoint: 'https://nightshift-cloud.example/v1/desktop/auth/org',
        logoutEndpoint: 'https://nightshift-cloud.example/v1/desktop/auth/logout',
        relayTokenEndpoint: 'https://nightshift-cloud.example/v1/desktop/auth/relay-token',
        relayDirectorUrl: 'https://relay.nightshift.invalid',
        clientId: 'desktop-client',
        scope: 'openid profile email offline_access'
      }
    })
  })

  it('uses first-party production endpoints without runtime env in packaged builds', () => {
    expect(getNightshiftCloudAuthConfig({}, true)).toEqual({
      configured: true,
      config: {
        apiBaseUrl: 'https://login.nightshift.invalid',
        authorizeEndpoint: 'https://login.nightshift.invalid/v1/desktop/auth/authorize',
        sessionEndpoint: 'https://login.nightshift.invalid/v1/desktop/auth/session',
        refreshEndpoint: 'https://login.nightshift.invalid/v1/desktop/auth/refresh',
        capabilitiesEndpoint: 'https://login.nightshift.invalid/v1/desktop/auth/capabilities',
        profileEndpoint: 'https://login.nightshift.invalid/v1/desktop/auth/profile',
        orgEndpoint: 'https://login.nightshift.invalid/v1/desktop/auth/org',
        logoutEndpoint: 'https://login.nightshift.invalid/v1/desktop/auth/logout',
        relayTokenEndpoint: 'https://login.nightshift.invalid/v1/desktop/auth/relay-token',
        relayDirectorUrl: 'https://relay.nightshift.invalid',
        clientId: 'nightshift-desktop',
        scope: 'openid profile email offline_access'
      }
    })
  })

  it('allows loopback HTTP endpoints for local desktop auth development', () => {
    const state = getNightshiftCloudAuthConfig({
      NIGHTSHIFT_CLOUD_API_URL: 'http://localhost:4100',
      NIGHTSHIFT_CLOUD_CLIENT_ID: 'desktop-client'
    })

    expect(state.configured).toBe(true)
  })

  it('rejects loopback HTTP endpoints in packaged builds', () => {
    expect(
      getNightshiftCloudAuthConfig(
        {
          NIGHTSHIFT_CLOUD_API_URL: 'http://localhost:4100',
          NIGHTSHIFT_CLOUD_CLIENT_ID: 'desktop-client'
        },
        true
      )
    ).toMatchObject({ configured: false })

    const httpsState = getNightshiftCloudAuthConfig(
      {
        NIGHTSHIFT_CLOUD_API_URL: 'https://nightshift-cloud.example',
        NIGHTSHIFT_CLOUD_CLIENT_ID: 'desktop-client'
      },
      true
    )
    expect(httpsState.configured).toBe(true)
  })

  it('rejects non-HTTPS non-loopback API URLs', () => {
    expect(
      getNightshiftCloudAuthConfig({
        NIGHTSHIFT_CLOUD_API_URL: 'http://nightshift-cloud.example',
        NIGHTSHIFT_CLOUD_CLIENT_ID: 'desktop-client'
      })
    ).toMatchObject({ configured: false })
  })

  it('allows dev plaintext sessions only outside production', () => {
    expect(
      allowsPlaintextNightshiftCloudSession({
        NIGHTSHIFT_CLOUD_ALLOW_PLAINTEXT_SESSION: '1',
        NODE_ENV: 'development'
      })
    ).toBe(true)
    expect(
      allowsPlaintextNightshiftCloudSession({
        NIGHTSHIFT_CLOUD_ALLOW_PLAINTEXT_SESSION: '1',
        NODE_ENV: 'production'
      })
    ).toBe(false)
  })

  it('ignores dev flags in packaged builds even without NODE_ENV', () => {
    // Why: packaged main bundles never define NODE_ENV, so packaged-ness must
    // gate the escape hatches on its own.
    expect(
      allowsPlaintextNightshiftCloudSession({ NIGHTSHIFT_CLOUD_ALLOW_PLAINTEXT_SESSION: '1' }, true)
    ).toBe(false)
    expect(isNightshiftCloudDevAuthEnabled({ NIGHTSHIFT_CLOUD_DEV_AUTH: '1' }, true)).toBe(false)
  })

  it('allows local dev auth only outside production', () => {
    expect(
      isNightshiftCloudDevAuthEnabled({
        NIGHTSHIFT_CLOUD_DEV_AUTH: '1',
        NODE_ENV: 'development'
      })
    ).toBe(true)
    expect(
      isNightshiftCloudDevAuthEnabled({
        NIGHTSHIFT_CLOUD_DEV_AUTH: '1',
        NODE_ENV: 'production'
      })
    ).toBe(false)
  })
})
