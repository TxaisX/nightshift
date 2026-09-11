import type { Page } from '@stablyai/playwright-test'
import { expect } from '@stablyai/playwright-test'
import { rmSync } from 'node:fs'
import { ensureTerminalVisible, getActiveWorktreeId, switchToWorktree } from './helpers/store'
import {
  resolveActiveTabId,
  sendToTerminal,
  waitForActivePanePtyId,
  waitForActiveTerminalManager
} from './helpers/terminal'
import { readActiveScreen } from './helpers/alt-screen-frame'
import type {
  HiddenPressureDeps,
  HiddenPressureMainSnapshot,
  HiddenPressurePane
} from './artificial-opencode-hidden-pressure-scenario'

// Why: replaces the old waitForMainPtyPressureBacklog premise — the Phase-4
// gate drops hidden bytes in main, so renderer-delivery pressure never builds;
// readiness is the gate reporting one pane's worth of dropped output.
export async function waitForMainHiddenDeliveryDrops<
  TMainPressure extends HiddenPressureMainSnapshot
>(
  nightshiftPage: Page,
  deps: { readMainPtyPressureDebug: (page: Page) => Promise<TMainPressure | null> },
  pressureOutputChars: number
): Promise<void> {
  await expect
    .poll(
      async () =>
        (await deps.readMainPtyPressureDebug(nightshiftPage))?.hiddenDeliveryDroppedChars ?? 0,
      { timeout: 30_000, message: 'Main hidden-delivery gate did not drop hidden PTY output' }
    )
    .toBeGreaterThanOrEqual(pressureOutputChars)
}

export async function measureHiddenOutputRestoreLatency(
  nightshiftPage: Page,
  worktreeId: string,
  runId: string
): Promise<number> {
  const restoreStart = performance.now()
  await switchToWorktree(nightshiftPage, worktreeId)
  // Why resolve rather than read activeTabId: after a worktree switch the active tab can
  // still be the previous worktree's, or a non-terminal one; this picks the worktree's own.
  const tabId = (await resolveActiveTabId(nightshiftPage)) ?? ''
  await expect
    .poll(async () => (await readActiveScreen(nightshiftPage, tabId))?.rows.join('\n') ?? '', {
      timeout: 20_000,
      // One-second backoff can dominate the measured restore latency.
      intervals: [50],
      message: 'No restored output from main buffer on return (or no active terminal pane)'
    })
    .toContain(`OPENCODE_PRESSURE_DONE_${runId}_`)
  return performance.now() - restoreStart
}

export async function startHiddenPressureCommands({
  hiddenPanes,
  nightshiftPage,
  pressureOutputChars,
  pressureScriptPath,
  pressureStartDelayMs
}: {
  hiddenPanes: HiddenPressurePane[]
  nightshiftPage: Page
  pressureOutputChars: number
  pressureScriptPath: string
  pressureStartDelayMs: number
}): Promise<void> {
  await Promise.all(
    hiddenPanes.map((pane, paneIndex) =>
      sendToTerminal(
        nightshiftPage,
        pane.ptyId,
        `node ${JSON.stringify(pressureScriptPath)} ${paneIndex} ${pressureOutputChars} ${pressureStartDelayMs}\r`
      )
    )
  )
}

export async function switchToTypingWorkspace(
  nightshiftPage: Page,
  worktreeId: string
): Promise<void> {
  await switchToWorktree(nightshiftPage, worktreeId)
  await expect.poll(() => getActiveWorktreeId(nightshiftPage), { timeout: 10_000 }).toBe(worktreeId)
  await ensureTerminalVisible(nightshiftPage)
  await waitForActiveTerminalManager(nightshiftPage, 30_000)
}

export async function cleanupHiddenPressureScenario<
  TMeasurement,
  TDebug,
  TScheduler,
  TMainPressure,
  TAckGate
>({
  deps,
  firstWorktreeId,
  hiddenPanes,
  nightshiftPage,
  pressureScriptPath,
  secondWorktreeId,
  typingScriptPath
}: {
  deps: HiddenPressureDeps<TMeasurement, TDebug, TScheduler, TMainPressure, TAckGate>
  firstWorktreeId: string
  hiddenPanes: HiddenPressurePane[]
  nightshiftPage: Page
  pressureScriptPath: string
  secondWorktreeId: string
  typingScriptPath: string
}): Promise<void> {
  await deps.releaseTerminalAckGate(nightshiftPage)
  await switchToWorktree(nightshiftPage, firstWorktreeId).catch(() => undefined)
  await waitForActivePanePtyId(nightshiftPage)
    .then((ptyId) => sendToTerminal(nightshiftPage, ptyId, '\x03'))
    .catch(() => undefined)
  await switchToWorktree(nightshiftPage, secondWorktreeId).catch(() => undefined)
  await Promise.all(
    hiddenPanes.map((pane) =>
      sendToTerminal(nightshiftPage, pane.ptyId, '\x03').catch(() => undefined)
    )
  )
  rmSync(typingScriptPath, { force: true })
  rmSync(pressureScriptPath, { force: true })
}
