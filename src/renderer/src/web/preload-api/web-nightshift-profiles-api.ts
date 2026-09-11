import type { PreloadApi } from '../../../../preload/api-types'
import {
  DEFAULT_LOCAL_NIGHTSHIFT_PROFILE_ID,
  createDefaultLocalNightshiftProfile
} from '../../../../shared/nightshift-profiles'
import { noopUnsubscribe } from './web-storage'

export function createWebNightshiftProfilesApi(): Partial<PreloadApi> {
  const webNightshiftProfileAuthStatus = () =>
    Promise.resolve({
      activeProfileId: DEFAULT_LOCAL_NIGHTSHIFT_PROFILE_ID,
      configured: false,
      state: 'unconfigured' as const,
      persistence: 'none' as const,
      setupMessage: 'Nightshift Cloud sign-in is not available in the browser fallback.'
    })
  return {
    nightshiftProfiles: {
      list: () =>
        Promise.resolve({
          activeProfileId: DEFAULT_LOCAL_NIGHTSHIFT_PROFILE_ID,
          profiles: [createDefaultLocalNightshiftProfile(0)],
          multiProfileUi: false
        }),
      authStatus: webNightshiftProfileAuthStatus,
      onAuthStatusChanged: () => noopUnsubscribe,
      createLocal: () =>
        Promise.resolve({
          activeProfileId: DEFAULT_LOCAL_NIGHTSHIFT_PROFILE_ID,
          profiles: [createDefaultLocalNightshiftProfile(0)],
          profile: createDefaultLocalNightshiftProfile(0)
        }),
      createCloudLinked: async () => ({
        status: 'unconfigured',
        auth: await webNightshiftProfileAuthStatus()
      }),
      switchProfile: () => Promise.resolve({ status: 'already-active' }),
      transferProject: (args) =>
        Promise.resolve({
          status: 'duplicate-target',
          sourceProfileId: args.sourceProfileId,
          targetProfileId: args.targetProfileId,
          sourceRepoId: args.repoId,
          duplicateRepoId: args.repoId
        }),
      findProjectProfiles: async () => ({ projects: [] }),
      connectCurrent: async () => ({
        status: 'unconfigured',
        auth: await webNightshiftProfileAuthStatus()
      }),
      refreshAuth: async () => ({
        status: 'unconfigured',
        auth: await webNightshiftProfileAuthStatus()
      }),
      signOutCurrent: async () => ({
        status: 'signed-out',
        auth: await webNightshiftProfileAuthStatus(),
        activeProfileId: DEFAULT_LOCAL_NIGHTSHIFT_PROFILE_ID,
        profiles: [createDefaultLocalNightshiftProfile(0)]
      }),
      selectOrg: async () => ({
        status: 'unconfigured',
        auth: await webNightshiftProfileAuthStatus()
      }),
      orgMembersList: async () => ({ status: 'unconfigured' }),
      orgMemberInvite: async () => ({ status: 'unconfigured' }),
      orgInviteRevoke: async () => ({ status: 'unconfigured' }),
      orgMemberChangeRole: async () => ({ status: 'unconfigured' }),
      orgMemberRemove: async () => ({ status: 'unconfigured' })
    }
  }
}
