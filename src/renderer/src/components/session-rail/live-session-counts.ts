import { tabHasLivePty } from '@/lib/tab-has-live-pty'

// Why: "live session" means a terminal tab with a running PTY — matches what
// BridgeMind's count badge counts (any tab, agent or plain terminal), not just
// agent-hook-reporting rows. A closed/dead tab has no ptyId entry and drops
// out on its own once removed from tabsByWorktree, so no extra filtering of
// tab identity is needed here beyond the live-PTY check.

/**
 * Pure derivation of "how many live terminal sessions does each worktree
 * have right now" from the two store maps that already carry this
 * information. Callers subscribe to those maps and pass slices through; this
 * function does no store/React work so it can be unit tested directly.
 *
 * Worktrees with zero live sessions are omitted from the result — callers
 * that want to show "no badge" for an idle worktree can just check
 * `counts[worktreeId] === undefined`.
 */
export function countLiveSessionsByWorktree(
  tabsByWorktree: Record<string, readonly { id: string }[] | undefined>,
  ptyIdsByTabId: Record<string, string[] | undefined>
): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const [worktreeId, tabs] of Object.entries(tabsByWorktree)) {
    let count = 0
    for (const tab of tabs ?? []) {
      if (tabHasLivePty(ptyIdsByTabId as Record<string, string[]>, tab.id)) {
        count += 1
      }
    }
    if (count > 0) {
      counts[worktreeId] = count
    }
  }
  return counts
}
