// @ts-nocheck -- mechanically split from NightshiftRuntimeService; behavior is covered by AST equivalence and characterization tests.
import { NightshiftRuntimeWithRecordPtyWorktree } from './nightshift-runtime-record-pty-worktree'
import type { ResolvedWorktree } from './runtime-worktree-path-identity'

export class NightshiftRuntimeWithRefreshPtyWorktreeRecordsFromController extends NightshiftRuntimeWithRecordPtyWorktree {
  /** Synchronizes PTY tracking records with running daemon sessions, querying their foreground agent states. */
  protected async refreshPtyWorktreeRecordsFromController(
    resolvedWorktrees: ResolvedWorktree[],
    targetWorktreeId: string | null = null,
    deadline?: number
  ): Promise<Set<string> | null> {
    const inventory = await this.refreshPtyWorktreeRecordsWithControllerInventory(
      resolvedWorktrees,
      targetWorktreeId,
      deadline
    )
    return inventory ? new Set(inventory.livePtyIds) : null
  }
}
