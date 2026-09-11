import { BrowserWindow } from 'electron'
import { NIGHTSHIFT_PROFILE_AUTH_STATUS_CHANGED_CHANNEL } from '../../shared/nightshift-profiles'

export function broadcastNightshiftProfileAuthStatusChanged(): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (window.isDestroyed()) {
      continue
    }
    try {
      window.webContents.send(NIGHTSHIFT_PROFILE_AUTH_STATUS_CHANGED_CHANNEL)
    } catch {
      // A renderer can disappear between isDestroyed() and send().
    }
  }
}
