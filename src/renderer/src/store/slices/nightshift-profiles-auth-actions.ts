import type { StateCreator } from 'zustand'
import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import type {
  ConnectCurrentNightshiftProfileResult,
  CreateCloudLinkedNightshiftProfileResult,
  RefreshCurrentNightshiftProfileAuthResult,
  SelectNightshiftProfileOrgResult,
  SignOutCurrentNightshiftProfileResult
} from '../../../../shared/nightshift-profiles'
import type { AppState } from '../types'

export type NightshiftProfilesAuthActions = {
  createCloudLinkedNightshiftProfile: (args: {
    orgId?: string
    name?: string
  }) => Promise<CreateCloudLinkedNightshiftProfileResult | null>
  connectCurrentNightshiftProfile: () => Promise<ConnectCurrentNightshiftProfileResult | null>
  refreshCurrentNightshiftProfileAuth: () => Promise<RefreshCurrentNightshiftProfileAuthResult | null>
  signOutCurrentNightshiftProfile: () => Promise<SignOutCurrentNightshiftProfileResult | null>
  selectNightshiftProfileOrg: (orgId: string) => Promise<SelectNightshiftProfileOrgResult | null>
}

// Why a separate module: the cloud-auth actions share the profiles slice's
// state keys but form their own cohesive surface (connect/refresh/sign-out/
// org selection), and the combined slice file exceeded the repo line budget.
export const createNightshiftProfilesAuthActions: StateCreator<
  AppState,
  [],
  [],
  NightshiftProfilesAuthActions
> = (set, get) => ({
  createCloudLinkedNightshiftProfile: async (args) => {
    try {
      const result = await window.api.nightshiftProfiles.createCloudLinked(args)
      set({
        nightshiftProfileAuthStatus: result.auth,
        ...(result.status === 'created'
          ? {
              activeNightshiftProfileId: result.activeProfileId,
              nightshiftProfiles: result.profiles
            }
          : {})
      })
      if (result.status === 'created') {
        toast.success(
          translate('auto.store.slices.nightshift.profiles.319d7cf39b', 'Cloud profile created')
        )
      } else if (result.status === 'reconnect-required') {
        toast.error(
          translate('auto.store.slices.nightshift.profiles.d6e764e7db', 'Reconnect this profile')
        )
      } else if (result.status === 'failed') {
        toast.error(
          translate(
            'auto.store.slices.nightshift.profiles.f0c9e11a6d',
            'Failed to create cloud profile'
          ),
          { description: result.error }
        )
      }
      return result
    } catch (err) {
      console.error('Failed to create Nightshift cloud profile:', err)
      toast.error(
        translate(
          'auto.store.slices.nightshift.profiles.f0c9e11a6d',
          'Failed to create cloud profile'
        ),
        {
          description: err instanceof Error ? err.message : String(err)
        }
      )
      return null
    }
  },

  connectCurrentNightshiftProfile: async () => {
    if (get().nightshiftProfileConnecting) {
      return null
    }
    set({ nightshiftProfileConnecting: true })
    try {
      const result = await window.api.nightshiftProfiles.connectCurrent()
      set({
        nightshiftProfileConnecting: false,
        nightshiftProfileAuthStatus: result.auth,
        ...(result.status === 'connected'
          ? {
              activeNightshiftProfileId: result.activeProfileId,
              nightshiftProfiles: result.profiles
            }
          : {})
      })
      if (result.status === 'unconfigured') {
        toast.error(
          translate(
            'auto.store.slices.nightshift.profiles.8b8fa73174',
            'Nightshift Cloud sign-in is not configured'
          ),
          {
            description: result.auth.setupMessage
          }
        )
      } else if (result.status === 'failed') {
        toast.error(
          translate(
            'auto.store.slices.nightshift.profiles.33290e88ed',
            'Failed to connect profile'
          ),
          { description: result.error }
        )
      } else if (result.status === 'connected') {
        toast.success(
          translate('auto.store.slices.nightshift.profiles.9fcb07a796', 'Profile connected')
        )
      }
      return result
    } catch (err) {
      console.error('Failed to connect Nightshift profile:', err)
      set({ nightshiftProfileConnecting: false })
      toast.error(
        translate('auto.store.slices.nightshift.profiles.33290e88ed', 'Failed to connect profile'),
        {
          description: err instanceof Error ? err.message : String(err)
        }
      )
      return null
    }
  },

  refreshCurrentNightshiftProfileAuth: async () => {
    try {
      const result = await window.api.nightshiftProfiles.refreshAuth()
      set({
        nightshiftProfileAuthStatus: result.auth,
        ...(result.status === 'refreshed'
          ? {
              activeNightshiftProfileId: result.activeProfileId,
              nightshiftProfiles: result.profiles
            }
          : {})
      })
      if (result.status === 'reconnect-required') {
        toast.error(
          translate('auto.store.slices.nightshift.profiles.d6e764e7db', 'Reconnect this profile')
        )
      } else if (result.status === 'failed') {
        toast.error(
          translate(
            'auto.store.slices.nightshift.profiles.2f6c78a039',
            'Failed to refresh profile auth'
          ),
          { description: result.error }
        )
      }
      return result
    } catch (err) {
      console.error('Failed to refresh Nightshift profile auth:', err)
      toast.error(
        translate(
          'auto.store.slices.nightshift.profiles.2f6c78a039',
          'Failed to refresh profile auth'
        ),
        {
          description: err instanceof Error ? err.message : String(err)
        }
      )
      return null
    }
  },

  signOutCurrentNightshiftProfile: async () => {
    try {
      const result = await window.api.nightshiftProfiles.signOutCurrent()
      set({
        activeNightshiftProfileId: result.activeProfileId,
        nightshiftProfiles: result.profiles,
        nightshiftProfileAuthStatus: result.auth
      })
      toast.success(
        translate('auto.store.slices.nightshift.profiles.a37b5e6d37', 'Signed out of profile')
      )
      return result
    } catch (err) {
      console.error('Failed to sign out of Nightshift profile:', err)
      toast.error(
        translate('auto.store.slices.nightshift.profiles.83600521e7', 'Failed to sign out'),
        {
          description: err instanceof Error ? err.message : String(err)
        }
      )
      return null
    }
  },

  selectNightshiftProfileOrg: async (orgId) => {
    try {
      const result = await window.api.nightshiftProfiles.selectOrg({ orgId })
      set({
        nightshiftProfileAuthStatus: result.auth,
        ...(result.status === 'selected'
          ? {
              activeNightshiftProfileId: result.activeProfileId,
              nightshiftProfiles: result.profiles
            }
          : {})
      })
      if (result.status === 'reconnect-required') {
        toast.error(
          translate('auto.store.slices.nightshift.profiles.d6e764e7db', 'Reconnect this profile')
        )
      } else if (result.status === 'failed') {
        toast.error(
          translate(
            'auto.store.slices.nightshift.profiles.76deec8f58',
            'Failed to switch organization'
          ),
          { description: result.error }
        )
      }
      return result
    } catch (err) {
      console.error('Failed to switch Nightshift profile org:', err)
      toast.error(
        translate(
          'auto.store.slices.nightshift.profiles.76deec8f58',
          'Failed to switch organization'
        ),
        {
          description: err instanceof Error ? err.message : String(err)
        }
      )
      return null
    }
  }
})
