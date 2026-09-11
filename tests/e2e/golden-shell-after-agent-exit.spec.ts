import { expect, test } from './helpers/nightshift-app'
import {
  configureGoldenStubAgent,
  getGoldenStubAgentLaunchEnv,
  GOLDEN_STUB_EXIT_MARKER,
  launchGoldenStubAgentFromNewTab
} from './helpers/golden-stub-agent'
import { ensureTerminalVisible, waitForActiveWorktree, waitForSessionReady } from './helpers/store'
import { waitForRestoredTerminalInputReady } from './helpers/restored-terminal-input-readiness'
import {
  focusActiveTerminalInput,
  waitForActivePanePtyId,
  waitForTerminalOutput
} from './helpers/terminal'

test.use({ launchEnv: getGoldenStubAgentLaunchEnv() })

// Why: xterm renders the typed command itself, so `echo after-agent` would
// satisfy waitForTerminalOutput even if the shell never ran it. Splitting the
// marker keeps it out of the input, so a match proves real shell execution.
function buildSplitMarkerEcho(prefix: string, suffix: string): { command: string; marker: string } {
  const command =
    process.platform === 'win32'
      ? `Write-Output ('${prefix}' + '${suffix}')`
      : `echo "${prefix}""${suffix}"`
  return { command, marker: `${prefix}${suffix}` }
}

test('opens a clean live shell after an agent exits', async ({ nightshiftPage }) => {
  await waitForSessionReady(nightshiftPage)
  await waitForActiveWorktree(nightshiftPage)
  await ensureTerminalVisible(nightshiftPage)
  await configureGoldenStubAgent(nightshiftPage)
  await launchGoldenStubAgentFromNewTab(nightshiftPage)

  await nightshiftPage.keyboard.type('exit')
  await nightshiftPage.keyboard.press('Enter')
  await waitForTerminalOutput(nightshiftPage, GOLDEN_STUB_EXIT_MARKER, 15_000)

  const tabsBeforeShell = await nightshiftPage.locator('[data-testid="sortable-tab"]').count()
  await nightshiftPage.getByRole('button', { name: 'New tab' }).click({ force: true })
  await nightshiftPage
    .getByRole('menuitem', { name: /New Terminal/i })
    .first()
    .click({ force: true })
  await expect(nightshiftPage.locator('[data-testid="sortable-tab"]')).toHaveCount(
    tabsBeforeShell + 1
  )
  const shellPtyId = await waitForActivePanePtyId(nightshiftPage)
  // Why: a bound ptyId only means the pane exists; the renderer transport can
  // still drop keystrokes until it connects, which would strand the markers.
  expect(await waitForRestoredTerminalInputReady(nightshiftPage, shellPtyId)).toBe(true)

  const afterAgent = buildSplitMarkerEcho('after-', 'agent')
  await focusActiveTerminalInput(nightshiftPage)
  await nightshiftPage.keyboard.type(afterAgent.command)
  await nightshiftPage.keyboard.press('Enter')
  await waitForTerminalOutput(nightshiftPage, afterAgent.marker, 15_000)

  const afterShiftEnter = buildSplitMarkerEcho('after-shift-', 'enter')
  await nightshiftPage.keyboard.press('Shift+Enter')
  await nightshiftPage.keyboard.type(afterShiftEnter.command)
  await nightshiftPage.keyboard.press('Enter')
  await waitForTerminalOutput(nightshiftPage, afterShiftEnter.marker, 15_000)
  await expect(nightshiftPage.locator('[data-testid="sortable-tab"]')).toHaveCount(
    tabsBeforeShell + 1
  )
})
