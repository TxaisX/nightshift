import { expect, test } from './helpers/nightshift-app'
import {
  configureGoldenStubAgent,
  getGoldenStubAgentLaunchEnv,
  launchGoldenStubAgentFromNewTab
} from './helpers/golden-stub-agent'
import { ensureTerminalVisible, waitForActiveWorktree, waitForSessionReady } from './helpers/store'
import { focusActiveTerminalInput, getTerminalContent } from './helpers/terminal'

test.use({ launchEnv: getGoldenStubAgentLaunchEnv() })

test('launches an agent TUI with a live multiline composer', async ({ nightshiftPage }) => {
  await waitForSessionReady(nightshiftPage)
  await waitForActiveWorktree(nightshiftPage)
  await ensureTerminalVisible(nightshiftPage)
  await configureGoldenStubAgent(nightshiftPage)
  await launchGoldenStubAgentFromNewTab(nightshiftPage)

  const activeTab = nightshiftPage.locator('[data-testid="sortable-tab"][data-active="true"]')
  await expect(activeTab).toHaveAttribute('data-tab-title', /Codex|Golden Stub Agent/i)

  await focusActiveTerminalInput(nightshiftPage)
  await nightshiftPage.keyboard.type('hello from e2e')
  await nightshiftPage.keyboard.press('Shift+Enter')
  await nightshiftPage.keyboard.type('second line')

  await expect
    .poll(() => getTerminalContent(nightshiftPage), { timeout: 10_000 })
    .toContain('> hello from e2e\r\n  second line')
  expect(await getTerminalContent(nightshiftPage)).not.toContain('GOLDEN_STUB_AGENT_SUBMITTED')
})
