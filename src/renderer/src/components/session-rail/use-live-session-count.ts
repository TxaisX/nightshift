import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '@/store'
import { selectLivePtyIdsForWorktree } from '@/components/sidebar/worktree-card-status-inputs'
import { EMPTY_TABS } from '@/components/sidebar/WorktreeCardHelpers'
import { countLiveSessionsByWorktree } from './live-session-counts'

/**
 * Reactive live-session count for one worktree's sidebar row/badge.
 *
 * Reuses `selectLivePtyIdsForWorktree` (already scoped to this worktree's
 * tabs) instead of subscribing to the whole-app `ptyIdsByTabId` map, so a
 * pty change on another worktree does not re-render every row's badge.
 */
export function useLiveSessionCount(worktreeId: string): number {
  // Why optional: a badge must never crash the card that hosts it. Several
  // sidebar surfaces (and their tests) mount a card against a partial store
  // where `tabsByWorktree` is absent, which a bare index would throw on.
  const tabs = useAppStore((s) => s.tabsByWorktree?.[worktreeId] ?? EMPTY_TABS)
  const livePtyIdsByTabId = useAppStore(
    useShallow((s) => selectLivePtyIdsForWorktree(s, worktreeId))
  )
  return useMemo(
    () => countLiveSessionsByWorktree({ [worktreeId]: tabs }, livePtyIdsByTabId)[worktreeId] ?? 0,
    [worktreeId, tabs, livePtyIdsByTabId]
  )
}
