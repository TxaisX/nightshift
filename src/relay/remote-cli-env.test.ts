import { describe, expect, it } from 'vitest'
import { pickRemoteCliEnv } from './remote-cli-env'

describe('pickRemoteCliEnv', () => {
  it('forwards SSH Nightshift terminal and worktree context for remote CLI calls', () => {
    expect(
      pickRemoteCliEnv({
        NIGHTSHIFT_TERMINAL_HANDLE: 'term_ssh',
        NIGHTSHIFT_WORKTREE_ID: 'repo::remote',
        NIGHTSHIFT_PANE_KEY: 'pane-1',
        NIGHTSHIFT_AGENT_LAUNCH_TOKEN: 'launch-secret',
        NIGHTSHIFT_WORKSPACE_ID: 'workspace-1',
        NIGHTSHIFT_USER_DATA_PATH: '/tmp/nightshift',
        PATH: '/usr/bin',
        SECRET_TOKEN: 'nope'
      })
    ).toEqual({
      NIGHTSHIFT_TERMINAL_HANDLE: 'term_ssh',
      NIGHTSHIFT_WORKTREE_ID: 'repo::remote',
      NIGHTSHIFT_PANE_KEY: 'pane-1',
      NIGHTSHIFT_AGENT_LAUNCH_TOKEN: 'launch-secret',
      NIGHTSHIFT_WORKSPACE_ID: 'workspace-1',
      NIGHTSHIFT_USER_DATA_PATH: '/tmp/nightshift',
      PATH: '/usr/bin'
    })
  })
})
