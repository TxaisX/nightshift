import { describe, expect, it } from 'vitest'
import {
  getTuiAgentDetectionProbeCommands,
  KNOWN_TUI_AGENT_DETECTION_COMMANDS,
  resolveDetectedTuiAgentIds
} from './tui-agent-detection-commands'

describe('tui agent detection commands', () => {
  it('requires Claude before reporting Claude Agent Teams', () => {
    const commands = KNOWN_TUI_AGENT_DETECTION_COMMANDS.filter(
      (command) => command.id === 'claude-agent-teams'
    )

    expect(commands).toEqual([
      {
        id: 'claude-agent-teams',
        cmd: 'nightshift',
        requiredCommands: ['claude'],
        unsupportedRuntimes: ['win32', 'wsl']
      },
      {
        id: 'claude-agent-teams',
        cmd: 'nightshift-dev',
        requiredCommands: ['claude'],
        unsupportedRuntimes: ['win32', 'wsl']
      },
      {
        id: 'claude-agent-teams',
        cmd: 'nightshift-ide',
        requiredCommands: ['claude'],
        unsupportedRuntimes: ['win32', 'wsl']
      }
    ])
    expect(getTuiAgentDetectionProbeCommands(commands, 'linux')).toEqual([
      'nightshift',
      'claude',
      'nightshift-dev',
      'nightshift-ide'
    ])
    expect(resolveDetectedTuiAgentIds(commands, new Set(['nightshift']), 'linux')).toEqual([])
    expect(
      resolveDetectedTuiAgentIds(commands, new Set(['nightshift', 'claude']), 'linux')
    ).toEqual(['claude-agent-teams'])
    expect(getTuiAgentDetectionProbeCommands(commands, 'win32')).toEqual([])
    expect(
      resolveDetectedTuiAgentIds(commands, new Set(['nightshift', 'claude']), 'win32')
    ).toEqual([])
    expect(getTuiAgentDetectionProbeCommands(commands, 'wsl')).toEqual([])
    expect(
      resolveDetectedTuiAgentIds(commands, new Set(['nightshift-ide', 'claude']), 'wsl')
    ).toEqual([])
  })
})
