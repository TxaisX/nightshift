import { expect, test } from './helpers/nightshift-app'
import { ensureTerminalVisible, waitForActiveWorktree, waitForSessionReady } from './helpers/store'
import { crashGuestRenderer } from './browser-guest-runtime-oracle'
import { observeBrowserLoadingSurface } from './browser-loading-surface-oracle'

test('browser host follows the theme before content and preserves the webpage canvas', async ({
  nightshiftPage,
  electronApp
}, testInfo) => {
  await waitForSessionReady(nightshiftPage)
  await ensureTerminalVisible(nightshiftPage)
  await waitForActiveWorktree(nightshiftPage)
  const observations = await observeBrowserLoadingSurface(
    nightshiftPage,
    (name) => testInfo.outputPath(name),
    async (id) => {
      await crashGuestRenderer(electronApp, id)
    }
  )
  expect(observations.filter((entry) => !entry.pass)).toEqual([])
})
