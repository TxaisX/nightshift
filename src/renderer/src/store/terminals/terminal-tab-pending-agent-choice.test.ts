import { describe, expect, it } from 'vitest'
import { createTerminalTabPresentationActions } from './terminal-tab-presentation'
import type { TerminalTab } from '../../../../shared/terminal-tab-types'
import type { TerminalStoreGet, TerminalStoreSet } from './terminal-state'

function makeTab(id: string, overrides: Partial<TerminalTab> = {}): TerminalTab {
  return {
    id,
    ptyId: null,
    worktreeId: 'wt-1',
    title: 'Terminal 1',
    customTitle: null,
    color: null,
    sortOrder: 0,
    createdAt: 0,
    ...overrides
  }
}

/** Minimal set/get harness standing in for the zustand store slice, scoped to
 *  the one field `resolveTabPendingAgentChoice` reads and writes. */
function makeHarness(tabsByWorktree: Record<string, TerminalTab[]>) {
  let state = { tabsByWorktree }
  const get = (() => state) as unknown as TerminalStoreGet
  const set = ((updater: (s: typeof state) => Partial<typeof state>) => {
    state = { ...state, ...updater(state) }
  }) as unknown as TerminalStoreSet
  return { get, set, read: () => state }
}

describe('resolveTabPendingAgentChoice (pending-agent-choice tab state transition)', () => {
  it('clears the pending flag without touching the rest of the tab', () => {
    const harness = makeHarness({ 'wt-1': [makeTab('tab-1', { pendingAgentChoice: true })] })
    const actions = createTerminalTabPresentationActions(harness.set, harness.get)

    actions.resolveTabPendingAgentChoice('tab-1')

    const resolved = harness.read().tabsByWorktree['wt-1'][0]
    expect(resolved.pendingAgentChoice).toBeUndefined()
    expect(resolved).toEqual(makeTab('tab-1'))
  })

  it('is a no-op for a tab that was never pending', () => {
    const harness = makeHarness({ 'wt-1': [makeTab('tab-1')] })
    const actions = createTerminalTabPresentationActions(harness.set, harness.get)

    actions.resolveTabPendingAgentChoice('tab-1')

    expect(harness.read().tabsByWorktree['wt-1'][0]).toEqual(makeTab('tab-1'))
  })

  it('is a no-op for an unknown tab id', () => {
    const harness = makeHarness({ 'wt-1': [makeTab('tab-1', { pendingAgentChoice: true })] })
    const actions = createTerminalTabPresentationActions(harness.set, harness.get)

    actions.resolveTabPendingAgentChoice('does-not-exist')

    expect(harness.read().tabsByWorktree['wt-1'][0].pendingAgentChoice).toBe(true)
  })
})
