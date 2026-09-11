import type { TuiAgent } from '../../shared/tui-agent'
import { NightshiftRuntimeService } from './nightshift-runtime'
import { makeStore } from './runtime-rpc-worktree-store-fixtures'

export const AGENT_PROMPT_TEST_WORKTREE_PATH = '/tmp/worktree-a'
export const AGENT_PROMPT_TEST_WORKTREE_ID = 'repo-1::/tmp/worktree-a'

export async function createAgentPromptSubmissionRuntime(
  onWrite: (runtime: NightshiftRuntimeService, data: string, writeIndex: number) => void,
  launchAgent: TuiAgent = 'aider'
): Promise<{ runtime: NightshiftRuntimeService; handle: string; writes: string[] }> {
  const runtime = new NightshiftRuntimeService(makeStore() as never)
  const writes: string[] = []
  runtime.setPtyController({
    spawn: async () => ({ id: 'pty-prompt' }),
    write: (_ptyId, data) => {
      writes.push(data)
      onWrite(runtime, data, writes.length)
      return true
    },
    kill: () => true,
    getForegroundProcess: async () => null
  })
  const terminal = await runtime.createTerminal(`path:${AGENT_PROMPT_TEST_WORKTREE_PATH}`, {
    launchAgent
  })
  return { runtime, handle: terminal.handle, writes }
}
