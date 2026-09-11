import { expect, test } from './helpers/nightshift-app'

test.use({ dismissOnboarding: false, seedTestRepo: false })
test.skip(process.platform !== 'win32', 'Fresh-profile fsync regression is Windows-only')

test('fresh Windows profile reaches onboarding @windows-fresh-startup-golden', async ({
  nightshiftPage
}) => {
  await expect(
    nightshiftPage.getByRole('heading', { name: /Pick your default agent/i })
  ).toBeVisible({
    timeout: 30_000
  })
})
