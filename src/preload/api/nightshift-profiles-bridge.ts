import { ipcRenderer } from 'electron'
import type { PreloadApi } from '../api-types'
import { NIGHTSHIFT_PROFILE_AUTH_STATUS_CHANGED_CHANNEL } from '../../shared/nightshift-profiles'

export const nightshiftProfilesApi = {
  list: () => ipcRenderer.invoke('nightshiftProfiles:list'),
  authStatus: () => ipcRenderer.invoke('nightshiftProfiles:authStatus'),
  onAuthStatusChanged: (callback: () => void): (() => void) => {
    const listener = (): void => callback()
    ipcRenderer.on(NIGHTSHIFT_PROFILE_AUTH_STATUS_CHANGED_CHANNEL, listener)
    return () =>
      ipcRenderer.removeListener(NIGHTSHIFT_PROFILE_AUTH_STATUS_CHANGED_CHANNEL, listener)
  },
  createLocal: (args) => ipcRenderer.invoke('nightshiftProfiles:createLocal', args),
  createCloudLinked: (args) => ipcRenderer.invoke('nightshiftProfiles:createCloudLinked', args),
  switchProfile: (args) => ipcRenderer.invoke('nightshiftProfiles:switch', args),
  transferProject: (args) => ipcRenderer.invoke('nightshiftProfiles:transferProject', args),
  findProjectProfiles: (args) => ipcRenderer.invoke('nightshiftProfiles:findProjectProfiles', args),
  connectCurrent: () => ipcRenderer.invoke('nightshiftProfiles:connectCurrent'),
  refreshAuth: () => ipcRenderer.invoke('nightshiftProfiles:refreshAuth'),
  signOutCurrent: () => ipcRenderer.invoke('nightshiftProfiles:signOutCurrent'),
  selectOrg: (args) => ipcRenderer.invoke('nightshiftProfiles:selectOrg', args),
  orgMembersList: (args) => ipcRenderer.invoke('nightshiftProfiles:orgMembersList', args),
  orgMemberInvite: (args) => ipcRenderer.invoke('nightshiftProfiles:orgMemberInvite', args),
  orgInviteRevoke: (args) => ipcRenderer.invoke('nightshiftProfiles:orgInviteRevoke', args),
  orgMemberChangeRole: (args) => ipcRenderer.invoke('nightshiftProfiles:orgMemberChangeRole', args),
  orgMemberRemove: (args) => ipcRenderer.invoke('nightshiftProfiles:orgMemberRemove', args)
} satisfies PreloadApi['nightshiftProfiles']
