/**
 * Whether a worker-start failure means the outcome is genuinely unknown (vs. a clean rejection),
 * split out of `worker-topology.ts` to stay under the file's line budget. Pure move, no
 * behaviour change.
 */
export function isUnknownWorkerStartOutcome(error: unknown, stage: string): boolean {
  const code =
    error && typeof error === 'object' && typeof (error as { code?: unknown }).code === 'string'
      ? (error as { code: string }).code
      : ''
  if (code === 'operation_unknown') {
    return true
  }
  if (stage !== 'worktree_create') {
    return false
  }
  const message = error instanceof Error ? error.message : String(error)
  return /connection|disconnect|timed?\s*out|runtime changed|outcome unknown/i.test(message)
}
