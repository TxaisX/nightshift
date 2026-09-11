import { describe, expect, it, vi } from 'vitest'
import { NightshiftRuntimeService } from './nightshift-runtime'

describe('structured native chat settings', () => {
  it('republishes mobile session tabs when the host visibility setting changes', () => {
    const settingsListeners: ((updates: Record<string, unknown>) => void)[] = []
    const runtime = new NightshiftRuntimeService({
      onSettingsChanged: vi.fn((listener) => {
        settingsListeners.push(listener as (updates: Record<string, unknown>) => void)
        return vi.fn()
      })
    } as never)
    const notify = vi.spyOn(runtime, 'notifyMobileSessionTabsChanged').mockImplementation(() => {})

    settingsListeners[0]?.({ compactWorktreeCards: true })
    expect(notify).not.toHaveBeenCalled()

    settingsListeners[0]?.({ experimentalStructuredNativeChat: true })
    expect(notify).toHaveBeenCalledTimes(1)
  })
})
