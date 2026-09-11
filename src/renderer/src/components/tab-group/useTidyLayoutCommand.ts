import { useAppStore } from '../../store'
import { collectSplitRatioUpdates, tidyLayout } from '../pane-layout/tidy-layout'

/**
 * "Tidy" for a worktree's split layout: reads the current layout tree,
 * computes even-share ratios for every split (pure `tidyLayout`), then
 * replays them through the existing `setTabGroupSplitRatio` store action —
 * one call per split node. No new store action needed: a tidy only ever
 * resizes existing splits, never restructures the tree.
 */
export function useTidyLayoutCommand(worktreeId: string): () => void {
  const setTabGroupSplitRatio = useAppStore((state) => state.setTabGroupSplitRatio)

  return () => {
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
