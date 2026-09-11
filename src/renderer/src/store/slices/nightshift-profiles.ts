import type { StateCreator } from 'zustand'
import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import type {
  NightshiftProfileAuthStatus,
  NightshiftProfileSummary,
  SwitchNightshiftProfileResult,
  TransferNightshiftProfileProjectArgs,
  TransferNightshiftProfileProjectResult
} from '../../../../shared/nightshift-profiles'
import type { AppState } from '../types'
import {
  createNightshiftProfilesAuthActions,
  type NightshiftProfilesAuthActions
} from './nightshift-profiles-auth-actions'

export type NightshiftProfilesSlice = NightshiftProfilesAuthActions & {
  nightshiftProfiles: NightshiftProfileSummary[]
  activeNightshiftProfileId: string | null
  nightshiftProfileAuthStatus: NightshiftProfileAuthStatus | null
  nightshiftProfilesMultiProfileUi: boolean
  nightshiftProfilesLoading: boolean
  nightshiftProfileSwitching: boolean
  nightshiftProfileConnecting: boolean
  fetchNightshiftProfiles: () => Promise<void>
  fetchNightshiftProfileAuthStatus: () => Promise<NightshiftProfileAuthStatus | null>
  createLocalNightshiftProfile: (name?: string) => Promise<NightshiftProfileSummary | null>
  switchNightshiftProfile: (profileId: string) => Promise<SwitchNightshiftProfileResult | null>
  transferNightshiftProfileProject: (
    args: TransferNightshiftProfileProjectArgs
  ) => Promise<TransferNightshiftProfileProjectResult | null>
}

export const createNightshiftProfilesSlice: StateCreator<
  AppState,
  [],
  [],
  NightshiftProfilesSlice
> = (set, get, api) => ({
  nightshiftProfiles: [],
  activeNightshiftProfileId: null,
  nightshiftProfileAuthStatus: null,
  nightshiftProfilesMultiProfileUi: false,
  nightshiftProfilesLoading: false,
  nightshiftProfileSwitching: false,
  nightshiftProfileConnecting: false,

  fetchNightshiftProfiles: async () => {
    set({ nightshiftProfilesLoading: true })
    try {
      const [state, authStatus] = await Promise.all([
        window.api.nightshiftProfiles.list(),
        window.api.nightshiftProfiles.authStatus()
      ])
      set({
        activeNightshiftProfileId: state.activeProfileId,
        nightshiftProfiles: state.profiles,
        nightshiftProfilesMultiProfileUi: state.multiProfileUi,
        nightshiftProfileAuthStatus: authStatus,
        nightshiftProfilesLoading: false
      })
    } catch (err) {
      console.error('Failed to fetch Nightshift profiles:', err)
      set({ nightshiftProfilesLoading: false })
    }
  },

  fetchNightshiftProfileAuthStatus: async () => {
    try {
      const authStatus = await window.api.nightshiftProfiles.authStatus()
      set({ nightshiftProfileAuthStatus: authStatus })
      return authStatus
    } catch (err) {
      console.error('Failed to fetch Nightshift profile auth status:', err)
      return null
    }
  },

  createLocalNightshiftProfile: async (name) => {
    try {
      const state = await window.api.nightshiftProfiles.createLocal({ name })
      set({
        activeNightshiftProfileId: state.activeProfileId,
        nightshiftProfiles: state.profiles
      })
      void get().fetchNightshiftProfileAuthStatus()
      return state.profile
    } catch (err) {
      console.error('Failed to create Nightshift profile:', err)
      toast.error(
        translate('auto.store.slices.nightshift.profiles.612f7f6861', 'Failed to create profile'),
        {
          description: err instanceof Error ? err.message : String(err)
        }
      )
      return null
    }
  },

  ...createNightshiftProfilesAuthActions(set, get, api),

  switchNightshiftProfile: async (profileId) => {
    if (!profileId || profileId === get().activeNightshiftProfileId) {
      return { status: 'already-active' }
    }
    set({ nightshiftProfileSwitching: true })
    try {
      const result = await window.api.nightshiftProfiles.switchProfile({ profileId })
      if (result?.status !== 'relaunching') {
        // Why: only a relaunch may keep the switcher locked; a stale
        // "already-active" answer would otherwise disable it forever.
        set({ nightshiftProfileSwitching: false })
      }
      return result
    } catch (err) {
      console.error('Failed to switch Nightshift profile:', err)
      set({ nightshiftProfileSwitching: false })
      toast.error(
        translate('auto.store.slices.nightshift.profiles.7d4bc516ee', 'Failed to switch profile'),
        {
          description: err instanceof Error ? err.message : String(err)
        }
      )
      return null
    }
  },

  transferNightshiftProfileProject: async (args) => {
    try {
      const result = await window.api.nightshiftProfiles.transferProject(args)
      if (result.status === 'duplicate-target') {
        toast.error(
          translate(
            'auto.store.slices.nightshift.profiles.f518e89aa5',
            'Project already exists in that profile'
          )
        )
      }
      if (result.status === 'transferred' && result.willRelaunch) {
        set({ nightshiftProfileSwitching: true })
      }
      return result
    } catch (err) {
      console.error('Failed to transfer Nightshift profile project:', err)
      toast.error(
        translate('auto.store.slices.nightshift.profiles.f03ae7f27b', 'Failed to transfer project'),
        {
          description: err instanceof Error ? err.message : String(err)
        }
      )
      return null
    }
  }
})
