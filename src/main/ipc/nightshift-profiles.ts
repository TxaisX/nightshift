import { app, ipcMain } from 'electron'
import type { Store } from '../persistence'
import { relaunchApp, type AppRelaunchReason } from '../app-relaunch'
import type {
  CreateLocalNightshiftProfileArgs,
  CreateLocalNightshiftProfileResult,
  CreateCloudLinkedNightshiftProfileArgs,
  CreateCloudLinkedNightshiftProfileResult,
  FindNightshiftProfileProjectsByPathArgs,
  FindNightshiftProfileProjectsByPathResult,
  NightshiftProfileListResult,
  RefreshCurrentNightshiftProfileAuthResult,
  SwitchNightshiftProfileArgs,
  SwitchNightshiftProfileResult,
  TransferNightshiftProfileProjectArgs,
  TransferNightshiftProfileProjectResult,
  ConnectCurrentNightshiftProfileResult,
  NightshiftProfileAuthStatus,
  SelectNightshiftProfileOrgArgs,
  SelectNightshiftProfileOrgResult,
  SignOutCurrentNightshiftProfileResult
} from '../../shared/nightshift-profiles'
import {
  createLocalNightshiftProfile,
  getNightshiftProfileListState,
  seedNewNightshiftProfileTelemetryConsent,
  setActiveNightshiftProfile
} from '../nightshift-profiles/profile-index-store'
import {
  cloudSessionIdentity,
  recordCloudSessionIdentityMutation
} from '../nightshift-profiles/profile-cloud-session-mutation'
import { getProfileUserDataPath } from '../nightshift-profiles/profile-storage-paths'
import { isMultiProfileUiEnabled } from '../nightshift-profiles/profile-ui-scope'
import { transferNightshiftProfileProject } from '../nightshift-profiles/profile-project-transfer'
import { findNightshiftProfileProjectsByPath } from '../nightshift-profiles/profile-project-presence'
import { flushActiveProfileBeforeFileMutation } from '../nightshift-profiles/profile-persistence-deadline'
import {
  createCloudLinkedProfileArgsFromUnknown,
  findProjectsByPathArgsFromUnknown,
  orgIdFromUnknown,
  profileIdFromArgs,
  transferProjectArgsFromUnknown
} from './nightshift-profile-handler-args'
import {
  createCloudLinkedNightshiftProfile,
  connectCurrentNightshiftProfile,
  getCurrentNightshiftProfileAuthStatus,
  refreshCurrentNightshiftProfileAuth,
  selectCurrentNightshiftProfileOrg,
  signOutCurrentNightshiftProfile
} from '../nightshift-profiles/profile-cloud-service'
import { registerNightshiftProfileOrgMemberHandlers } from './nightshift-profile-org-members-handlers'
import { onNightshiftCloudSessionInvalidated } from '../nightshift-profiles/profile-cloud-session-invalidation'
import { broadcastNightshiftProfileAuthStatusChanged } from './nightshift-profile-auth-status-broadcast'

type RegisterNightshiftProfileHandlersOptions = {
  onBeforeRelaunch?: () => void | Promise<void>
  onAuthMutation?: () => void
  onBeforeSignOut?: () => void
}

async function runBeforeProfileRelaunch(
  onBeforeRelaunch?: () => void | Promise<void>
): Promise<void> {
  try {
    await onBeforeRelaunch?.()
  } catch (error) {
    console.warn(
      '[nightshift-profiles] Pre-relaunch cleanup failed; continuing profile switch:',
      error instanceof Error ? error.name : typeof error
    )
  }
}

function scheduleProfileRelaunch(reason: Extract<AppRelaunchReason, `profile-${string}`>): void {
  setTimeout(() => {
    relaunchApp(reason)
    // Why: app.quit() (not app.exit) so before-quit/will-quit still run —
    // renderer scrollback capture, PTY kill, stats flush, and daemon final
    // checkpoints must not be skipped on a profile switch.
    app.quit()
  }, 150)
}

export function registerNightshiftProfileHandlers(
  store: Store,
  options: RegisterNightshiftProfileHandlersOptions = {}
): void {
  ipcMain.handle('nightshiftProfiles:list', (): NightshiftProfileListResult => ({
    ...getNightshiftProfileListState(),
    multiProfileUi: isMultiProfileUiEnabled()
  }))

  ipcMain.handle('nightshiftProfiles:authStatus', (): NightshiftProfileAuthStatus =>
    getCurrentNightshiftProfileAuthStatus(getProfileUserDataPath())
  )

  // Why: a background refresh can revoke the session with no renderer request in
  // flight, so push the change instead of waiting for the next pane to ask.
  // Why not options.onAuthMutation: that hook drives the relay coordinator, which
  // is the caller that just failed the refresh — re-entering it here would be a loop.
  onNightshiftCloudSessionInvalidated(broadcastNightshiftProfileAuthStatusChanged)

  ipcMain.handle(
    'nightshiftProfiles:createLocal',
    (_event, args?: CreateLocalNightshiftProfileArgs): CreateLocalNightshiftProfileResult => {
      const result = createLocalNightshiftProfile(args)
      seedNewNightshiftProfileTelemetryConsent(result.profile.id, store.getSettings().telemetry)
      return result
    }
  )

  ipcMain.handle(
    'nightshiftProfiles:switch',
    async (_event, args: SwitchNightshiftProfileArgs): Promise<SwitchNightshiftProfileResult> => {
      const profileId = profileIdFromArgs(args)
      const current = getNightshiftProfileListState()
      if (profileId === current.activeProfileId) {
        return { status: 'already-active' }
      }

      const activeProfile = current.profiles.find(
        (profile) => profile.id === current.activeProfileId
      )
      if (activeProfile?.cloud) {
        // Why: profile selection changes the expected identity synchronously;
        // stale refresh saves must fail even before relaunch teardown finishes.
        recordCloudSessionIdentityMutation(
          cloudSessionIdentity(activeProfile.id, activeProfile.cloud),
          getProfileUserDataPath()
        )
      }
      // Why: the current profile must be persisted before the global index
      // points startup at the target profile.
      await flushActiveProfileBeforeFileMutation(store)
      await runBeforeProfileRelaunch(options.onBeforeRelaunch)
      setActiveNightshiftProfile(profileId)

      scheduleProfileRelaunch('profile-switch')

      return { status: 'relaunching' }
    }
  )

  ipcMain.handle(
    'nightshiftProfiles:transferProject',
    async (
      _event,
      rawArgs: TransferNightshiftProfileProjectArgs
    ): Promise<TransferNightshiftProfileProjectResult> => {
      const args = transferProjectArgsFromUnknown(rawArgs)
      const current = getNightshiftProfileListState()
      if (args.targetProfileId === current.activeProfileId) {
        throw new Error('active_target_nightshift_profile_transfer_requires_relaunch')
      }
      if (args.mode === 'move' && args.sourceProfileId === current.activeProfileId) {
        // Why: transfer before any relaunch side effect so a duplicate-target
        // or validation failure cannot strand the app in a quitting state.
        await flushActiveProfileBeforeFileMutation(store)
        const result = transferNightshiftProfileProject(args, getProfileUserDataPath())
        if (result.status === 'transferred') {
          store.freezeWrites()
          await runBeforeProfileRelaunch(options.onBeforeRelaunch)
          setActiveNightshiftProfile(args.targetProfileId)
          scheduleProfileRelaunch('profile-transfer')
          return { ...result, willRelaunch: true }
        }
        return result
      }
      await flushActiveProfileBeforeFileMutation(store)
      return transferNightshiftProfileProject(args, getProfileUserDataPath())
    }
  )

  ipcMain.handle(
    'nightshiftProfiles:findProjectProfiles',
    (
      _event,
      rawArgs: FindNightshiftProfileProjectsByPathArgs
    ): FindNightshiftProfileProjectsByPathResult =>
      findNightshiftProfileProjectsByPath(
        findProjectsByPathArgsFromUnknown(rawArgs),
        getProfileUserDataPath()
      )
  )

  ipcMain.handle(
    'nightshiftProfiles:connectCurrent',
    async (): Promise<ConnectCurrentNightshiftProfileResult> => {
      const result = await connectCurrentNightshiftProfile(getProfileUserDataPath())
      if (result.status === 'connected') {
        options.onAuthMutation?.()
      }
      return result
    }
  )

  ipcMain.handle(
    'nightshiftProfiles:createCloudLinked',
    async (
      _event,
      rawArgs?: CreateCloudLinkedNightshiftProfileArgs
    ): Promise<CreateCloudLinkedNightshiftProfileResult> => {
      const result = await createCloudLinkedNightshiftProfile(
        getProfileUserDataPath(),
        createCloudLinkedProfileArgsFromUnknown(rawArgs)
      )
      if (result.status === 'created') {
        seedNewNightshiftProfileTelemetryConsent(result.profile.id, store.getSettings().telemetry)
        options.onAuthMutation?.()
      }
      return result
    }
  )

  ipcMain.handle(
    'nightshiftProfiles:refreshAuth',
    async (): Promise<RefreshCurrentNightshiftProfileAuthResult> => {
      const result = await refreshCurrentNightshiftProfileAuth(getProfileUserDataPath())
      if (result.status === 'refreshed') {
        options.onAuthMutation?.()
      }
      return result
    }
  )

  ipcMain.handle(
    'nightshiftProfiles:signOutCurrent',
    async (): Promise<SignOutCurrentNightshiftProfileResult> => {
      options.onBeforeSignOut?.()
      return signOutCurrentNightshiftProfile(getProfileUserDataPath())
    }
  )

  ipcMain.handle(
    'nightshiftProfiles:selectOrg',
    async (
      _event,
      rawArgs: SelectNightshiftProfileOrgArgs
    ): Promise<SelectNightshiftProfileOrgResult> => {
      const result = await selectCurrentNightshiftProfileOrg(
        getProfileUserDataPath(),
        orgIdFromUnknown(rawArgs)
      )
      if (result.status === 'selected') {
        options.onAuthMutation?.()
      }
      return result
    }
  )

  registerNightshiftProfileOrgMemberHandlers()
}
