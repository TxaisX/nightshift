import { NIGHTSHIFT_BROWSER_BLANK_URL } from '../../shared/constants'
import { normalizeBrowserNavigationUrl } from '../../shared/browser-url'
import { BrowserManagerEventForwarding } from './browser-manager-event-forwarding'

export abstract class BrowserManagerFinal extends BrowserManagerEventForwarding {
  protected openLinkInNightshiftTab(
    browserTabId: string,
    rawUrl: string,
    activate?: boolean
  ): boolean {
    const renderer = this.resolveRendererForBrowserTab(browserTabId)
    if (!renderer) {
      return false
    }
    const normalizedUrl = normalizeBrowserNavigationUrl(rawUrl)
    if (!normalizedUrl || normalizedUrl === NIGHTSHIFT_BROWSER_BLANK_URL) {
      return false
    }
    // Why: only the renderer owns Nightshift's worktree/tab model; main forwards a validated URL, never letting guest content mutate it.
    renderer.send('browser:open-link-in-nightshift-tab', {
      browserPageId: browserTabId,
      url: normalizedUrl,
      ...(activate === false ? { activate: false } : {})
    })
    return true
  }
}
