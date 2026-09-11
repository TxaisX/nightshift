/**
 * End-to-end coverage for the Automations runs surface.
 *
 * The test intentionally does not depend on seeded run history: a fresh E2E
 * profile may have no automations, but the Runs navigation and empty state must
 * still be usable.
 */

import { test, expect } from './helpers/nightshift-app'
import { waitForSessionReady } from './helpers/store'

test('opens the runs dashboard and returns to automations', async ({ nightshiftPage }) => {
  await waitForSessionReady(nightshiftPage)

  await nightshiftPage.evaluate(() => {
    const store = window.__store
    if (!store) {
      throw new Error('window.__store is not available')
    }
    store.getState().openAutomationsPage()
  })

  const runsButton = nightshiftPage.getByRole('button', { name: 'Runs' })
  await expect(runsButton).toBeVisible()
  await runsButton.click()

  await expect(
    nightshiftPage.getByRole('navigation', { name: 'Automations breadcrumb' })
  ).toBeVisible()
  await expect(nightshiftPage.getByText('Successful · 24h')).toBeVisible()
  await expect(nightshiftPage.getByText('Failed · 24h')).toBeVisible()
  await expect(nightshiftPage.getByText('Successful · 7d')).toBeVisible()
  await expect(nightshiftPage.getByText('Failed · 7d')).toBeVisible()
  await expect(nightshiftPage.getByRole('button', { name: 'Filters' })).toBeVisible()
  await expect(nightshiftPage.getByRole('button', { name: 'Refresh runs' })).toBeVisible()
  await expect(nightshiftPage.getByText('Automation', { exact: true })).toBeVisible()
  await expect(nightshiftPage.getByText('Triggered', { exact: true })).toBeVisible()
  await expect(nightshiftPage.getByText('Status', { exact: true })).toBeVisible()

  await nightshiftPage
    .getByRole('navigation', { name: 'Automations breadcrumb' })
    .getByRole('button', { name: 'Automations' })
    .click()
  await expect(nightshiftPage.getByRole('heading', { name: 'Automations' })).toBeVisible()
  await expect(runsButton).toBeVisible()
})
