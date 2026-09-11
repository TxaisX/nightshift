import { expect, test } from './helpers/nightshift-app'
import { openFileExplorer } from './helpers/file-explorer'
import { pressShortcut } from './helpers/shortcuts'
import { waitForActiveWorktree, waitForSessionReady } from './helpers/store'

test('Explorer-opened Markdown accepts the find shortcut without a document click', async ({
  nightshiftPage
}) => {
  await waitForSessionReady(nightshiftPage)
  await waitForActiveWorktree(nightshiftPage)
  await openFileExplorer(nightshiftPage)

  const readmeRow = nightshiftPage
    .locator('[data-file-explorer-row]')
    .filter({ hasText: 'README.md' })
  await expect(readmeRow).toBeVisible({ timeout: 10_000 })
  await readmeRow.focus()
  await readmeRow.click()

  await expect(nightshiftPage.locator('.rich-markdown-editor')).toBeVisible({ timeout: 25_000 })
  await pressShortcut(nightshiftPage, 'f')

  await expect(
    nightshiftPage.getByRole('textbox', { name: 'Find in rich markdown editor' })
  ).toBeVisible()
})
