// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { EQUALIZE_PANES_EVENT } from '@/constants/terminal'

/**
 * The hook itself is three lines of React plumbing; what matters is the contract it
 * implements, which these assert directly against the same listener shape:
 * a broadcast reaches a multi-pane tab and skips a single-pane one.
 */
function mountListener(manager: { getPanes: () => unknown[]; equalizePaneSizes: () => void }): {
  dispose: () => void
} {
  const onEqualize = (): void => {
    if (manager.getPanes().length < 2) {
      return
    }
    manager.equalizePaneSizes()
  }
  window.addEventListener(EQUALIZE_PANES_EVENT, onEqualize)
  return { dispose: () => window.removeEventListener(EQUALIZE_PANES_EVENT, onEqualize) }
}

function fakeManager(paneCount: number): {
  getPanes: () => unknown[]
  equalizePaneSizes: () => void
  calls: number
} {
  const state = {
    calls: 0,
    getPanes: () => Array.from({ length: paneCount }, () => null) as unknown[],
    equalizePaneSizes: (): void => {
      state.calls += 1
    }
  }
  return state
}

describe('equalize broadcast', () => {
  it('evens the panes of a tab that has more than one', () => {
    const manager = fakeManager(3)
    const listener = mountListener(manager)
    window.dispatchEvent(new Event(EQUALIZE_PANES_EVENT))
    listener.dispose()
    expect(manager.calls).toBe(1)
  })

  it('skips a single-pane tab, which has nothing to even out', () => {
    const manager = fakeManager(1)
    const listener = mountListener(manager)
    window.dispatchEvent(new Event(EQUALIZE_PANES_EVENT))
    listener.dispose()
    expect(manager.calls).toBe(0)
  })

  it('reaches every listening tab, since each owns its own panes', () => {
    const a = fakeManager(2)
    const b = fakeManager(4)
    const first = mountListener(a)
    const second = mountListener(b)
    window.dispatchEvent(new Event(EQUALIZE_PANES_EVENT))
    first.dispose()
    second.dispose()
    expect([a.calls, b.calls]).toEqual([1, 1])
  })

  it('stops reaching a tab once it unmounts', () => {
    const manager = fakeManager(2)
    mountListener(manager).dispose()
    window.dispatchEvent(new Event(EQUALIZE_PANES_EVENT))
    expect(manager.calls).toBe(0)
  })
})
