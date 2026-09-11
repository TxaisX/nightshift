import { test, expect } from './helpers/nightshift-app'
import { getFirstWslDistro, useWslRuntimeForActiveProject } from './helpers/wsl-golden-stub-agent'
import { ensureTerminalVisible, waitForActiveWorktree, waitForSessionReady } from './helpers/store'
import {
  execInTerminal,
  waitForActivePanePtyId,
  waitForActiveTerminalManager,
  waitForTerminalOutput
} from './helpers/terminal'

test.describe('Windows terminal env and shell identity', () => {
  test.beforeEach(async ({ nightshiftPage }) => {
    await waitForSessionReady(nightshiftPage)
    await waitForActiveWorktree(nightshiftPage)
    await ensureTerminalVisible(nightshiftPage)
  })

  test('dev terminal preserves parent PATH so PATH commands resolve', async ({
    nightshiftPage
  }) => {
    await waitForActiveTerminalManager(nightshiftPage)

    const ptyId = await waitForActivePanePtyId(nightshiftPage)
    const marker = `__NIGHTSHIFT_E2E_NODE_PATH_${Date.now()}__`

    // Why: before the dev PATH fallback, daemon-spawned PTYs could get PATH set
    // to only Nightshift's dev CLI bin. A real terminal command catches that failure.
    await execInTerminal(nightshiftPage, ptyId, `node -e "console.log('${marker}')"`)

    await waitForTerminalOutput(nightshiftPage, marker, 15_000)
  })

  test('native Windows tab icons stay pinned to the effective shell at tab creation', async ({
    nightshiftPage
  }) => {
    test.skip(process.platform !== 'win32', 'Windows shell icons only render on Windows')

    const tabIds = await nightshiftPage.evaluate(() => {
      const store = window.__store
      if (!store) {
        throw new Error('Store unavailable')
      }
      const state = store.getState()
      const worktreeId = state.activeWorktreeId
      if (!worktreeId) {
        throw new Error('No active worktree')
      }

      // Native project ownership makes a global WSL shell fall back to PowerShell.
      store.setState({
        settings: { ...state.settings!, terminalWindowsShell: 'wsl.exe' }
      })
      const fallbackTab = store.getState().createTab(worktreeId, undefined, undefined, {
        activate: false
      })

      store.setState({
        settings: { ...store.getState().settings!, terminalWindowsShell: 'cmd.exe' }
      })
      const cmdTab = store.getState().createTab(worktreeId, undefined, undefined, {
        activate: false
      })

      return { fallbackTabId: fallbackTab.id, cmdTabId: cmdTab.id }
    })

    const tabSnapshot = await nightshiftPage.evaluate(({ fallbackTabId, cmdTabId }) => {
      const state = window.__store!.getState()
      const tabs = Object.values(state.tabsByWorktree).flat()
      return {
        fallbackShell: tabs.find((tab) => tab.id === fallbackTabId)?.shellOverride,
        cmdShell: tabs.find((tab) => tab.id === cmdTabId)?.shellOverride
      }
    }, tabIds)

    expect(tabSnapshot).toEqual({
      fallbackShell: 'powershell.exe',
      cmdShell: 'cmd.exe'
    })

    const fallbackTab = nightshiftPage.locator(
      `[data-testid="sortable-tab"][data-tab-id="${tabIds.fallbackTabId}"]`
    )
    const cmdTab = nightshiftPage.locator(
      `[data-testid="sortable-tab"][data-tab-id="${tabIds.cmdTabId}"]`
    )
    await expect(fallbackTab).toBeVisible()
    await expect(cmdTab).toBeVisible()

    await expect(fallbackTab.locator('[data-shell-icon]')).toHaveAttribute(
      'data-shell-icon',
      'powershell.exe'
    )
    await expect(cmdTab.locator('[data-shell-icon]')).toHaveAttribute('data-shell-icon', 'cmd.exe')
  })

  test('WSL project tab icons retain runtime ownership across global shell changes', async ({
    nightshiftPage
  }) => {
    test.skip(process.platform !== 'win32', 'WSL shell icons require Windows')
    const distro = await getFirstWslDistro(nightshiftPage)
    test.skip(!distro, 'WSL icon coverage requires an installed distro')
    await useWslRuntimeForActiveProject(nightshiftPage, distro!)

    const tabIds = await nightshiftPage.evaluate(async () => {
      const store = window.__store!
      const worktreeId = store.getState().activeWorktreeId!
      const ids: string[] = []
      for (const shell of ['powershell.exe', 'cmd.exe'] as const) {
        await store.getState().updateSettings({ terminalWindowsShell: shell })
        ids.push(
          store.getState().createTab(worktreeId, undefined, undefined, { activate: false }).id
        )
      }
      return ids
    })
    const shells = await nightshiftPage.evaluate((ids) => {
      const tabs = Object.values(window.__store!.getState().tabsByWorktree).flat()
      return ids.map((id) => tabs.find((tab) => tab.id === id)?.shellOverride)
    }, tabIds)
    expect(shells).toEqual(['wsl.exe', 'wsl.exe'])
    for (const id of tabIds) {
      const tab = nightshiftPage.locator(`[data-testid="sortable-tab"][data-tab-id="${id}"]`)
      await expect(tab).toBeVisible()
      await expect(tab.locator('[data-shell-icon]')).toHaveAttribute('data-shell-icon', 'wsl.exe')
    }
  })
})
