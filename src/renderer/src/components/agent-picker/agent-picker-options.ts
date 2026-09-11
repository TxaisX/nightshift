import { orderTabLaunchAgents } from '../tab-bar/tab-agent-launch-options'
import type { TuiAgent } from '../../../../shared/tui-agent'

/**
 * Ordered list of agents the full-pane picker renders: default agent first
 * (when detected and enabled), then the rest in catalog order. Disabled and
 * undetected agents are excluded. Thin wrapper over `orderTabLaunchAgents` —
 * the tab-bar dropdown already implements this exact rule.
 */
export function getAgentPickerOptions(
  detected: readonly TuiAgent[],
  defaultAgent: TuiAgent | 'blank' | null | undefined,
  disabled?: Iterable<unknown> | null
): TuiAgent[] {
  return orderTabLaunchAgents(defaultAgent, detected, disabled)
}
