import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AgentHookServer, _internals } from './server'
import { makePaneKey } from '../../shared/stable-pane-id'

const { getCohortAtEmitMock, trackMock } = vi.hoisted(() => ({
  getCohortAtEmitMock: vi.fn(),
  trackMock: vi.fn()
}))

vi.mock('../telemetry/client', () => ({ track: trackMock }))
vi.mock('../telemetry/cohort-classifier', () => ({ getCohortAtEmit: getCohortAtEmitMock }))

beforeEach(() => {
  _internals.resetCachesForTests()
  trackMock.mockReset()
  getCohortAtEmitMock.mockReset()
  getCohortAtEmitMock.mockReturnValue({ nth_repo_added: 2 })
})

afterEach(() => {
  vi.restoreAllMocks()
})

// Why: a valid terminal-leaf UUID, varied only in the last group, so 30+ panes are cheap to mint.
function leafId(n: number): string {
  return `00000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`
}

describe('status-change listener dedupe (STA perf fix)', () => {
  it('does not re-notify status-change subscribers for a repeated identical working event', () => {
    const server = new AgentHookServer()
    const spy = vi.fn()
    server.subscribeStatusChanges(spy)

    // Seed ~30 unrelated panes so the per-notify snapshot walk has real width, matching the
    // many-worktrees-many-agents shape the audit measured.
    for (let i = 0; i < 30; i++) {
      server.ingestRemote(
        {
          paneKey: makePaneKey(`seed-tab-${i}`, leafId(i)),
          worktreeId: `wt-${i}`,
          payload: { state: 'working', agentType: 'claude' }
        },
        `conn-seed-${i}`
      )
    }
    spy.mockClear()

    const targetPane = makePaneKey('target-tab', leafId(999))
    const workingToolEvent = {
      paneKey: targetPane,
      worktreeId: 'wt-target',
      hookEventName: 'PostToolUse',
      payload: { state: 'working' as const, agentType: 'claude' as const, toolName: 'Bash' }
    }

    // First post is a real transition (no previous status for this pane) and must notify.
    // Second post is byte-for-byte identical and must be swallowed, not re-broadcast.
    server.ingestRemote(workingToolEvent, 'conn-target')
    server.ingestRemote(workingToolEvent, 'conn-target')

    expect(spy).toHaveBeenCalledTimes(1)
  })
})
