import { useAppStore } from '../../store'
import { EQUALIZE_PANES_EVENT } from '@/constants/terminal'
import { collectSplitRatioUpdates, tidyLayout } from '../pane-layout/tidy-layout'

/**
 * "Tidy": even out every split the user can see, in both trees that hold one.
 *
 * A workspace has two independent split trees, and they are easy to confuse:
 *
 * - The tab-group tree (`layoutByWorktree`) splits the workspace into side-by-side
 *   groups, each with its own tab bar.
 * - Each tab additionally owns a PaneManager holding the panes created by
 *   "Split Terminal Right" — the split most users actually make.
 *
 * Tidying only the first left the common case untouched, so the command looked
 * like it did nothing. It now does both: it replays even ratios through the
 * existing `setTabGroupSplitRatio` action, and broadcasts so each tab evens its
 * own panes. Both halves only resize; neither creates, removes or reorders a pane.
 */
export function useTidyLayoutCommand(worktreeId: string): () => void {
  const setTabGroupSplitRatio = useAppStore((state) => state.setTabGroupSplitRatio)

  return () => {
    // Why unconditional: a workspace can have panes to tidy inside a single tab
    // even when the group tree is a lone leaf, which is the usual shape.
    window.dispatchEvent(new Event(EQUALIZE_PANES_EVENT))

    const layout = useAppStore.getState().layoutByWorktree[worktreeId]
    if (!layout) {
      return
    }
    const tidied = tidyLayout(layout)
    for (const { path, ratio } of collectSplitRatioUpdates(tidied)) {
      setTabGroupSplitRatio(worktreeId, path, ratio)
    }
  }
}
