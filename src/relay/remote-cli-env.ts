export function pickRemoteCliEnv(env: NodeJS.ProcessEnv): Record<string, string> {
  const picked: Record<string, string> = {}
  for (const key of [
    'NIGHTSHIFT_TERMINAL_HANDLE',
    'NIGHTSHIFT_WORKTREE_ID',
    'NIGHTSHIFT_PANE_KEY',
    'NIGHTSHIFT_AGENT_LAUNCH_TOKEN',
    'NIGHTSHIFT_WORKSPACE_ID',
    'NIGHTSHIFT_USER_DATA_PATH',
    'PATH',
    'Path'
  ]) {
    const value = env[key]
    if (typeof value === 'string') {
      picked[key] = value
    }
  }
  return picked
}
