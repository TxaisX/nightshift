/**
 * E2E tests for splitting terminal panes and the stable UUID leaf identity each
 * split pane carries into its PTY binding, NIGHTSHIFT_PANE_KEY, and context menu.
 *
 * User Prompt:
 * - terminal panes can be split
 */

import { test, expect } from './helpers/nightshift-app'
import {
  UUID_RE,
  discoverActivePtyId,
  execInTerminal,
  countVisibleTerminalPanes,
  splitActiveTerminalPane,
  waitForPaneIdentitySnapshot,
  waitForTerminalOutput,
  waitForPaneCount
} from './helpers/terminal'
import { openTerminalContextMenu } from './helpers/terminal-pane-title-actions'
import { registerTerminalPaneMountReadiness } from './helpers/terminal-pane-mount-readiness'

// Why: keep the suite serial so the headful pane tests never ask Playwright to
// open multiple visible Electron windows at once.
test.describe.configure({ mode: 'serial' })
test.describe('Terminal Panes', () => {
  registerTerminalPaneMountReadiness()

  /**
   * User Prompt:
   * - terminal panes can be split
   */
  test('can split terminal pane right', async ({ nightshiftPage }) => {
    const paneCountBefore = await countVisibleTerminalPanes(nightshiftPage)

    await splitActiveTerminalPane(nightshiftPage, 'vertical')
    await waitForPaneCount(nightshiftPage, paneCountBefore + 1)

    const paneCountAfter = await countVisibleTerminalPanes(nightshiftPage)
    expect(paneCountAfter).toBe(paneCountBefore + 1)
  })

  /**
   * User Prompt:
   * - terminal panes can be split
   */
  test('can split terminal pane down', async ({ nightshiftPage }) => {
    const paneCountBefore = await countVisibleTerminalPanes(nightshiftPage)

    await splitActiveTerminalPane(nightshiftPage, 'horizontal')
    await waitForPaneCount(nightshiftPage, paneCountBefore + 1)

    const paneCountAfter = await countVisibleTerminalPanes(nightshiftPage)
    expect(paneCountAfter).toBe(paneCountBefore + 1)
  })

  test('split panes persist PTY bindings by stable UUID leaf id', async ({ nightshiftPage }) => {
    const paneCountBefore = await countVisibleTerminalPanes(nightshiftPage)

    await splitActiveTerminalPane(nightshiftPage, 'vertical')
    await waitForPaneCount(nightshiftPage, paneCountBefore + 1)

    const snapshot = await waitForPaneIdentitySnapshot(nightshiftPage, paneCountBefore + 1)
    const leafIds = snapshot.panes.map((pane) => pane.leafId)
    const ptyIds = snapshot.panes.map((pane) => pane.ptyId)

    expect(new Set(leafIds).size).toBe(leafIds.length)
    expect(new Set(ptyIds).size).toBe(ptyIds.length)
    expect(Object.keys(snapshot.ptyIdsByLeafId).sort()).toEqual([...leafIds].sort())
    expect(Object.keys(snapshot.ptyIdsByLeafId).every((leafId) => UUID_RE.test(leafId))).toBe(true)
    expect(
      snapshot.panes.some(
        (pane) =>
          String(pane.numericPaneId) === pane.leafId || `pane:${pane.numericPaneId}` === pane.leafId
      )
    ).toBe(false)
  })

  test('terminal process receives NIGHTSHIFT_PANE_KEY with the active UUID leaf id', async ({
    nightshiftPage
  }) => {
    const snapshot = await waitForPaneIdentitySnapshot(nightshiftPage, 1)
    const activeLeafId = snapshot.activeLeafId ?? snapshot.panes[0]?.leafId
    if (!activeLeafId) {
      throw new Error('No active pane leaf id found')
    }

    const expectedPaneKey = `${snapshot.tabId}:${activeLeafId}`
    const ptyId = await discoverActivePtyId(nightshiftPage)
    const marker = `NIGHTSHIFT_PANE_KEY_E2E_${Date.now()}`

    await execInTerminal(nightshiftPage, ptyId, `printf '${marker}=%s\\n' "$NIGHTSHIFT_PANE_KEY"`)
    await waitForTerminalOutput(nightshiftPage, `${marker}=${expectedPaneKey}`)

    expect(activeLeafId).toMatch(UUID_RE)
  })

  test('terminal context menu copies the stable pane ID', async ({ nightshiftPage }) => {
    const snapshot = await waitForPaneIdentitySnapshot(nightshiftPage, 1)
    const leafId = snapshot.panes[0]?.leafId
    if (!leafId) {
      throw new Error('No terminal pane leaf id found')
    }
    const expectedPaneKey = `${snapshot.tabId}:${leafId}`

    await openTerminalContextMenu(nightshiftPage)
    await nightshiftPage.getByText('Copy Pane ID', { exact: true }).click()

    await expect
      .poll(() => nightshiftPage.evaluate(() => window.api.ui.readClipboardText()), {
        timeout: 3_000
      })
      .toBe(expectedPaneKey)
    await expect(nightshiftPage.getByText('Pane ID copied', { exact: true })).toBeVisible()
    expect(leafId).toMatch(UUID_RE)
  })
})
