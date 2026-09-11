import type { CommandSpec } from '../args'
import { GLOBAL_FLAGS } from '../args'

export const AGENT_HOOK_COMMAND_SPECS: CommandSpec[] = [
  {
    path: ['agent', 'hooks', 'prepare-codex'],
    summary: 'Repair Nightshift-managed Codex hook trust before a shell launch',
    usage: 'nightshift agent hooks prepare-codex',
    allowedFlags: [...GLOBAL_FLAGS]
  },
  {
    path: ['agent', 'hooks', 'status'],
    summary: 'Show whether Nightshift-managed agent status hooks are enabled',
    usage: 'nightshift agent hooks status [--json]',
    allowedFlags: [...GLOBAL_FLAGS],
    examples: ['nightshift agent hooks status', 'nightshift agent hooks status --json']
  },
  {
    path: ['agent', 'hooks', 'off'],
    summary: 'Disable Nightshift-managed agent status hooks and remove local hook entries',
    usage: 'nightshift agent hooks off [--json]',
    allowedFlags: [...GLOBAL_FLAGS],
    examples: ['nightshift agent hooks off']
  },
  {
    path: ['agent', 'hooks', 'on'],
    summary: 'Enable Nightshift-managed agent status hooks',
    usage: 'nightshift agent hooks on [--json]',
    allowedFlags: [...GLOBAL_FLAGS],
    examples: ['nightshift agent hooks on']
  }
]
