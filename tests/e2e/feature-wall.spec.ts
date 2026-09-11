import { test, expect } from './helpers/nightshift-app'
import { getStoreState, waitForSessionReady } from './helpers/store'
import type { ElectronApplication } from '@stablyai/playwright-test'

async function openFeatureTourFromMenu(electronApp: ElectronApplication): Promise<void> {
  await electronApp.evaluate(({ BrowserWindow, Menu }) => {
    const featureTourItem = Menu.getApplicationMenu()
      ?.items.find((item) => item.label === 'Help')
      ?.submenu?.items.find((item) => item.label === 'Explore Nightshift')

    if (!featureTourItem) {
      throw new Error('Explore Nightshift menu item was not registered')
    }

    const window = BrowserWindow.getAllWindows()[0]
    featureTourItem.click(featureTourItem, window, {
      triggeredByAccelerator: false,
      shiftKey: false,
      metaKey: false,
      ctrlKey: false,
      altKey: false
    } as Electron.KeyboardEvent)
  })
}

test.describe('Feature tour modal', () => {
  test.beforeEach(async ({ nightshiftPage }) => {
    await waitForSessionReady(nightshiftPage)
  })

  test('opens from the Help menu and renders the workflow rail', async ({
    electronApp,
    nightshiftPage
  }) => {
    await openFeatureTourFromMenu(electronApp)

    await expect(
      nightshiftPage.getByRole('dialog', { name: 'Get to know Nightshift' })
    ).toBeVisible({
      timeout: 10_000
    })
    await expect(
      nightshiftPage.getByText('Reopen any time from Help > Explore Nightshift.')
    ).toBeVisible()

    // Five workflow rows in the rail.
    const rail = nightshiftPage.getByRole('navigation', { name: 'Workflows' })
    await expect(rail.getByRole('tab')).toHaveCount(5)
    await expect(rail.getByRole('tab', { name: /Workspaces/i })).toHaveAttribute(
      'aria-selected',
      'true'
    )

    await expect(nightshiftPage.locator('[data-ws-id]')).toHaveCount(3)

    // ArrowDown moves selection through the rail.
    await rail.getByRole('tab', { name: /Workspaces/i }).focus()
    await nightshiftPage.keyboard.press('ArrowDown')
    await expect(rail.getByRole('tab', { name: /Tasks/i })).toHaveAttribute('aria-selected', 'true')
    await nightshiftPage.keyboard.press('ArrowDown')
    await expect(rail.getByRole('tab', { name: /Agents/i })).toHaveAttribute(
      'aria-selected',
      'true'
    )

    await rail.getByRole('tab', { name: /Workbench/i }).click()
    await rail.getByRole('button', { name: /Browser/i }).click()
    await expect(
      nightshiftPage.getByText(
        "Run your app in Nightshift's browser, send selected UI elements to agents, and let your agents interact with your webpage."
      )
    ).toBeVisible()
    await expect(nightshiftPage.getByRole('heading', { name: 'Browser Use skill' })).toBeVisible()
    await expect(
      nightshiftPage.getByText(
        "Enables agents to navigate and verify pages in Nightshift's browser."
      )
    ).toBeVisible()
    await expect(nightshiftPage.getByRole('heading', { name: 'CLI skill' })).toHaveCount(0)
    await expect(
      nightshiftPage.getByText('With the Nightshift CLI skill', { exact: false })
    ).toHaveCount(0)
  })

  test('shows unified task copy without leaving the walkthrough', async ({ nightshiftPage }) => {
    await nightshiftPage.evaluate(() => {
      const store = window.__store
      if (!store) {
        throw new Error('window.__store is not available')
      }
      store.setState({
        preflightStatus: {
          git: { installed: true },
          gh: { installed: true, authenticated: false },
          glab: { installed: false, authenticated: false },
          bitbucket: { configured: false, authenticated: false, account: null },
          azureDevOps: {
            configured: false,
            authenticated: false,
            account: null,
            baseUrl: null,
            tokenConfigured: false
          },
          gitea: {
            configured: false,
            authenticated: false,
            account: null,
            baseUrl: null,
            tokenConfigured: false
          }
        },
        preflightStatusChecked: true,
        preflightStatusLoading: false,
        linearStatus: { connected: false, viewer: null },
        linearStatusChecked: true
      })
      store.getState().openModal('feature-wall', { source: 'help_menu' })
    })

    await expect(
      nightshiftPage.getByRole('dialog', { name: 'Get to know Nightshift' })
    ).toBeVisible({
      timeout: 10_000
    })
    await nightshiftPage
      .getByRole('navigation', { name: 'Workflows' })
      .getByRole('tab', { name: /Tasks/i })
      .click()
    await expect(
      nightshiftPage.getByText('Start work directly from GitHub or Linear.')
    ).toBeVisible()
    await expect(nightshiftPage.getByText('Connect GitHub or Linear once')).toHaveCount(0)
    await expect(
      nightshiftPage.getByRole('dialog', { name: 'Get to know Nightshift' })
    ).toBeVisible()
    await expect
      .poll(async () => getStoreState<string>(nightshiftPage, 'activeView'))
      .not.toBe('settings')
  })

  test('continue advances through workflow substeps before the next workflow', async ({
    nightshiftPage
  }) => {
    await nightshiftPage.evaluate(() => {
      const store = window.__store
      if (!store) {
        throw new Error('window.__store is not available')
      }
      store.getState().openModal('feature-wall', { source: 'help_menu' })
    })

    const rail = nightshiftPage.getByRole('navigation', { name: 'Workflows' })
    const continueButton = nightshiftPage.getByRole('button', { name: /^Continue/ })

    await continueButton.click()
    await expect(rail.getByRole('tab', { name: /Tasks/i })).toHaveAttribute('aria-selected', 'true')

    await continueButton.click()
    await expect(rail.getByRole('tab', { name: /Agents/i })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    await expect(rail.getByRole('button', { name: /Visibility/i })).toHaveAttribute(
      'aria-current',
      'step'
    )

    await continueButton.click()
    await expect(rail.getByRole('button', { name: /Orchestration/i })).toHaveAttribute(
      'aria-current',
      'step'
    )
    await expect(rail.getByRole('tab', { name: /Workbench/i })).toHaveAttribute(
      'aria-selected',
      'false'
    )

    await continueButton.click()
    await expect(rail.getByRole('button', { name: /Usage/i })).toHaveAttribute(
      'aria-current',
      'step'
    )

    await continueButton.click()
    await expect(rail.getByRole('tab', { name: /Workbench/i })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    await expect(rail.getByRole('button', { name: /Terminal/i })).toHaveAttribute(
      'aria-current',
      'step'
    )
  })

  test('does not pre-check configured workflows until the user visits them', async ({
    nightshiftPage,
    electronApp
  }) => {
    await electronApp.evaluate(
      ({ ipcMain }, preflightStatus) => {
        ipcMain.removeHandler('preflight:check')
        ipcMain.handle('preflight:check', () => preflightStatus)
        ipcMain.removeHandler('linear:status')
        ipcMain.handle('linear:status', () => ({ connected: false, viewer: null }))
        ipcMain.removeHandler('jira:status')
        ipcMain.handle('jira:status', () => ({ connected: false, viewer: null }))
      },
      {
        git: { installed: true },
        gh: { installed: true, authenticated: true },
        glab: { installed: false, authenticated: false },
        bitbucket: { configured: false, authenticated: false, account: null },
        azureDevOps: {
          configured: false,
          authenticated: false,
          account: null,
          baseUrl: null,
          tokenConfigured: false
        },
        gitea: {
          configured: false,
          authenticated: false,
          account: null,
          baseUrl: null,
          tokenConfigured: false
        }
      }
    )
    await nightshiftPage.evaluate(async () => {
      for (const key of [
        'nightshift.featureWall.visitedWorkflows.v1',
        'nightshift.featureWall.visitedAgentSteps.v1',
        'nightshift.featureWall.visitedWorkbenchSteps.v1',
        'nightshift.featureWall.visitedReviewSteps.v1',
        'nightshift.featureWall.completedWorkflows.v1',
        'nightshift.featureWall.completedAgentSteps.v1',
        'nightshift.featureWall.completedWorkbenchSteps.v1',
        'nightshift.featureWall.completedReviewSteps.v1'
      ]) {
        localStorage.removeItem(key)
      }
      const store = window.__store
      if (!store) {
        throw new Error('window.__store is not available')
      }
      // Seed through the status actions so each result gets the current execution context.
      await Promise.all([
        store.getState().refreshPreflightStatus({ force: true }),
        store.getState().checkLinearConnection(true),
        store.getState().checkJiraConnection()
      ])
      store.getState().openModal('feature-wall', { source: 'help_menu' })
    })

    const rail = nightshiftPage.getByRole('navigation', { name: 'Workflows' })
    const workspacesTab = rail.locator('[data-feature-wall-workflow-id="workspaces"]')
    const tasksTab = rail.locator('[data-feature-wall-workflow-id="tasks"]')
    await expect(workspacesTab.locator('[aria-label="Completed"]')).toHaveCount(1)
    await expect(tasksTab.locator('[aria-label="Completed"]')).toHaveCount(0)
    await tasksTab.click()
    await expect(tasksTab.locator('[aria-label="Completed"]')).toHaveCount(1)
    await expect(workspacesTab.locator('[aria-label="Completed"]')).toHaveCount(1)
  })

  test('keeps persisted completed setup-backed substeps checked when reopened', async ({
    nightshiftPage
  }) => {
    await nightshiftPage.evaluate(() => {
      localStorage.setItem(
        'nightshift.featureWall.completedAgentSteps.v1',
        JSON.stringify(['orchestration'])
      )
      localStorage.setItem(
        'nightshift.featureWall.completedWorkbenchSteps.v1',
        JSON.stringify(['browser'])
      )
      const store = window.__store
      if (!store) {
        throw new Error('window.__store is not available')
      }
      store.getState().openModal('feature-wall', { source: 'help_menu' })
    })

    const rail = nightshiftPage.getByRole('navigation', { name: 'Workflows' })

    await rail.getByRole('tab', { name: /Agents/i }).click()
    await expect(
      rail.getByRole('button', { name: /Orchestration/i }).locator('[aria-label="Completed"]')
    ).toHaveCount(1)

    await rail.getByRole('tab', { name: /Workbench/i }).click()
    await expect(
      rail.getByRole('button', { name: /Browser/i }).locator('[aria-label="Completed"]')
    ).toHaveCount(1)
  })
})
