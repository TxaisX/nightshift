import type { CommandSpec } from '../args'
import { GLOBAL_FLAGS } from '../args'

export const DIAGNOSTICS_COMMAND_SPECS: CommandSpec[] = [
  {
    path: ['diagnostics', 'memory'],
    summary: 'Collect a memory snapshot for Nightshift and managed terminals',
    usage: 'nightshift diagnostics memory [--json]',
    allowedFlags: [...GLOBAL_FLAGS],
    notes: [
      'Runs the same host process sweep used by the Resource Usage popover, so call it when you need a point-in-time diagnostic rather than a cheap heartbeat.'
    ],
    examples: ['nightshift diagnostics memory --json']
  }
]
