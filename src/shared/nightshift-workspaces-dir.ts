// fork: NIGHTSHIFT_WORKSPACES_DIR overrides the stock <home>/nightshift/workspaces worktree root so worktrees
// can live off C: without hardcoding a drive in source. Safe in the renderer (no process there).
export function nightshiftWorkspacesDirOverride(): string | undefined {
  if (typeof process === 'undefined') {
    return undefined
  }
  const value = process.env.NIGHTSHIFT_WORKSPACES_DIR?.trim()
  return value ? value : undefined
}
