import type { CommandSpec } from '../args'
import { GLOBAL_FLAGS } from '../args'

const AUTOMATION_TARGET_FLAGS = [
  'repo',
  'workspace',
  'project',
  'host',
  'project-host-setup',
  'source-context',
  'workspace-mode',
  'base-branch'
]
const AUTOMATION_SCHEDULE_FLAGS = ['trigger', 'schedule', 'time', 'day', 'timezone']
const AUTOMATION_PRECHECK_FLAGS = ['precheck', 'precheck-timeout']
const AUTOMATION_STATE_FLAGS = [
  'enabled',
  'disabled',
  'missed-run-grace-minutes',
  'reuse-session',
  'fresh-session'
]

export const AUTOMATION_COMMAND_SPECS: CommandSpec[] = [
  {
    path: ['automations', 'list'],
    summary: 'List scheduled Nightshift automations',
    usage: 'nightshift automations list [--json]',
    allowedFlags: [...GLOBAL_FLAGS],
    examples: ['nightshift automations list', 'nightshift automations list --json']
  },
  {
    path: ['automations', 'show'],
    summary: 'Show one Nightshift automation',
    usage: 'nightshift automations show <id> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'id'],
    positionalArgs: ['id'],
    examples: [
      'nightshift automations show 2f9e...',
      'nightshift automations show --id 2f9e... --json'
    ]
  },
  {
    path: ['automations', 'create'],
    summary: 'Create a scheduled Nightshift automation',
    usage:
      'nightshift automations create --name <name> --trigger <preset|cron|rrule> --prompt <text> --provider <agent> [--precheck <command>] [--repo <selector>|--workspace <selector>|--project <id> [--host <id>]|--project-host-setup <id>] [--json]',
    allowedFlags: [
      ...GLOBAL_FLAGS,
      'name',
      'prompt',
      'provider',
      ...AUTOMATION_PRECHECK_FLAGS,
      ...AUTOMATION_TARGET_FLAGS,
      ...AUTOMATION_SCHEDULE_FLAGS,
      ...AUTOMATION_STATE_FLAGS
    ],
    notes: [
      'Trigger accepts hourly, daily, weekdays, weekly, a 5-field cron expression, or an RRULE string.',
      'When --repo is omitted, the CLI uses the enclosing Nightshift worktree when one can be resolved from cwd.',
      'Use --project with --host, or --project-host-setup, to run on a specific project host setup.',
      '--host runtime:<environment-id> targets that paired Nightshift server; use the id from `nightshift environment list`, not the environment name.',
      'Use --source-context with a JSON TaskSourceContext when task/provider data should come from a specific host/account; pass null on edit to clear it.',
      'Use --workspace to run in an existing worktree; otherwise the automation creates a new worktree per run.',
      'Use --precheck to run a bounded command before scheduled runs; exit code 0 continues, anything else records a skipped run.',
      'Use --reuse-session only with existing-workspace automations to submit later runs to the previous live automation session when it is still available. Use --fresh-session to disable reuse.'
    ],
    examples: [
      'nightshift automations create --name "Daily review" --trigger daily --prompt "Review open changes" --provider codex',
      'nightshift automations create --name "Weekday triage" --trigger "0 9 * * 1-5" --prompt "Triage issues" --provider claude --repo my-repo',
      'nightshift automations create --name "PR review" --trigger hourly --precheck "gh pr list --json number -q .[0].number" --prompt "Review requested PRs" --provider codex'
    ]
  },
  {
    path: ['automations', 'edit'],
    summary: 'Edit a Nightshift automation',
    usage:
      'nightshift automations edit <id> [--name <name>] [--trigger <preset|cron|rrule>] [--json]',
    allowedFlags: [
      ...GLOBAL_FLAGS,
      'id',
      'name',
      'prompt',
      'provider',
      ...AUTOMATION_PRECHECK_FLAGS,
      ...AUTOMATION_TARGET_FLAGS,
      ...AUTOMATION_SCHEDULE_FLAGS,
      ...AUTOMATION_STATE_FLAGS
    ],
    positionalArgs: ['id'],
    examples: [
      'nightshift automations edit 2f9e... --disabled',
      'nightshift automations edit --id 2f9e... --trigger "30 * * * *" --json'
    ]
  },
  {
    path: ['automations', 'remove'],
    destructive: true,
    summary: 'Remove a Nightshift automation and its run history',
    usage: 'nightshift automations remove <id> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'id'],
    positionalArgs: ['id'],
    examples: [
      'nightshift automations remove 2f9e...',
      'nightshift automations remove --id 2f9e... --json'
    ]
  },
  {
    path: ['automations', 'run'],
    summary: 'Run a Nightshift automation now',
    usage: 'nightshift automations run <id> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'id'],
    positionalArgs: ['id'],
    examples: [
      'nightshift automations run 2f9e...',
      'nightshift automations run --id 2f9e... --json'
    ]
  },
  {
    path: ['automations', 'runs'],
    summary: 'List automation run history',
    usage: 'nightshift automations runs [--id <automation-id>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'id'],
    examples: ['nightshift automations runs', 'nightshift automations runs --id 2f9e... --json']
  }
]
