import { test, expect } from './helpers/nightshift-app'
import { getStoreState, waitForSessionReady } from './helpers/store'

test.describe('usage overview', () => {
  test.beforeEach(async ({ nightshiftPage }) => {
    await waitForSessionReady(nightshiftPage)
  })

  test('Stats & Usage opens on the combined overview with provider controls', async ({
    nightshiftPage
  }) => {
    await nightshiftPage.evaluate(() => {
      const state = window.__store!.getState()
      state.openSettingsPage()
    })

    await expect
      .poll(async () => getStoreState<string>(nightshiftPage, 'activeView'), { timeout: 5_000 })
      .toBe('settings')
    await nightshiftPage.getByRole('button', { name: 'Stats & Usage' }).click()
    await expect(nightshiftPage.getByRole('heading', { name: 'Usage Analytics' })).toBeVisible()
    const providerDropdown = nightshiftPage.getByTestId('usage-provider-select')
    await expect(providerDropdown).toHaveAttribute(
      'aria-label',
      'Usage analytics provider: Overview'
    )
    await expect(nightshiftPage.getByTestId('usage-overview-pane')).toBeVisible()
    await expect(nightshiftPage.getByRole('heading', { name: 'Usage Overview' })).toBeVisible()
    await expect(nightshiftPage.getByRole('heading', { name: 'Providers' })).toBeVisible()
    await expect(nightshiftPage.getByRole('button', { name: 'Enable Claude' })).toBeVisible()
    await expect(nightshiftPage.getByRole('button', { name: 'Enable Codex' })).toBeVisible()
    await expect(nightshiftPage.getByRole('button', { name: 'Enable OpenCode' })).toBeVisible()

    await providerDropdown.click()
    await nightshiftPage.getByRole('menuitem', { name: 'Codex', exact: true }).click()
    await expect(
      nightshiftPage.getByRole('heading', { name: 'Codex Usage Tracking' })
    ).toBeVisible()
    await expect(providerDropdown).toHaveAttribute('aria-label', 'Usage analytics provider: Codex')

    await providerDropdown.click()
    await nightshiftPage.getByRole('menuitem', { name: 'OpenCode', exact: true }).click()
    await expect(
      nightshiftPage.getByRole('heading', { name: 'OpenCode Usage Tracking' })
    ).toBeVisible()
    await expect(providerDropdown).toHaveAttribute(
      'aria-label',
      'Usage analytics provider: OpenCode'
    )
  })
})
