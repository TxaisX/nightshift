import { useEffect } from 'react'
import { EQUALIZE_PANES_EVENT } from '@/constants/terminal'
import type { PaneManager } from '@/lib/pane-manager/pane-manager'

/**
 * Let a "tidy" command reach the split sizes inside this tab.
 *
 * Why: the panes a user creates with "Split Terminal Right" live in this tab's own
 * PaneManager, not in the worktree's tab-group layout tree. A menu command has no
 * handle on that manager, so tidying broadcasts and each pane evens itself out.
 */
export function useTerminalEqualizeSync(managerRef: React.RefObject<PaneManager | null>): void {
  useEffect(() => {
    const onEqualize = (): void => {
      const manager = managerRef.current
      // A single-pane tab has nothing to even out; skip rather than churn the layout.
      if (!manager || manager.getPanes().length < 2) {
        return
      }
      manager.equalizePaneSizes()
    }
    window.addEventListener(EQUALIZE_PANES_EVENT, onEqualize)
    return () => {
      window.removeEventListener(EQUALIZE_PANES_EVENT, onEqualize)
    }
  }, [managerRef])
}
