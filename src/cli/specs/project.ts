import type { CommandSpec } from '../args'
import { GLOBAL_FLAGS } from '../args'

export const PROJECT_COMMAND_SPECS: CommandSpec[] = [
  {
    path: ['project', 'list'],
    summary: 'List durable projects known to Nightshift',
    usage: 'nightshift project list [--json]',
    allowedFlags: [...GLOBAL_FLAGS],
    examples: ['nightshift project list', 'nightshift project list --json']
  },
  {
    path: ['project', 'setups'],
    summary: 'List project host setups',
    usage: 'nightshift project setups [--project <id>] [--host <host-id>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'project', 'host'],
    notes: [
      'A setup means a project is available on a host at a concrete filesystem path.',
      '--host runtime:<environment-id> runs the command on that paired Nightshift server instead of filtering this runtime; unknown environment ids are rejected rather than answered with an empty list.',
      'Run `nightshift environment list` to see the environment ids that runtime:<environment-id> accepts. It matches ids only, never environment names.',
      "A routed --host runtime:<id> also lists that server's own local-stamped setups, because both spellings name the machine the command reached."
    ],
    examples: [
      'nightshift project setups',
      'nightshift project setups --project github:TxaisX/nightshift',
      'nightshift project setups --host local',
      'nightshift project setups --host runtime:03ef704c-b180-4b10-998d-e28fbd5de9a3'
    ]
  },
  {
    path: ['project', 'setup-existing-folder'],
    summary: 'Make a project available on a host by importing an existing folder',
    usage:
      'nightshift project setup-existing-folder --project <id> --host <host-id> --path <path> [--kind git|folder] [--display-name <name>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'project', 'host', 'path', 'kind', 'display-name'],
    notes: [
      'For remote runtimes, --path must be an absolute path on the remote server.',
      '--host runtime:<environment-id> targets that paired Nightshift server; use the id from `nightshift environment list`, not the environment name.',
      'SSH targets are set up through the desktop UI because the desktop client owns SSH connections.'
    ],
    examples: [
      'nightshift project setup-existing-folder --project github:TxaisX/nightshift --host local --path ~/nightshift',
      'nightshift project setup-existing-folder --project github:TxaisX/nightshift --host runtime:03ef704c-b180-4b10-998d-e28fbd5de9a3 --path /home/me/nightshift --kind git --json'
    ]
  },
  {
    path: ['project', 'setup-clone'],
    summary: 'Make a project available on a host by cloning a repository',
    usage:
      'nightshift project setup-clone --project <id> --host <host-id> --url <clone-url> --destination <path> [--display-name <name>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'project', 'host', 'url', 'destination', 'display-name'],
    notes: [
      'For remote runtimes, --destination must be an absolute parent directory on the remote server.',
      '--host runtime:<environment-id> targets that paired Nightshift server; use the id from `nightshift environment list`, not the environment name.',
      'SSH targets are cloned through the desktop UI because the desktop client owns SSH connections.'
    ],
    examples: [
      'nightshift project setup-clone --project github:TxaisX/nightshift --host local --url https://github.com/TxaisX/nightshift.git --destination ~/src',
      'nightshift project setup-clone --project github:TxaisX/nightshift --host runtime:03ef704c-b180-4b10-998d-e28fbd5de9a3 --url https://github.com/TxaisX/nightshift.git --destination /srv --json'
    ]
  },
  {
    path: ['project', 'setup-create'],
    summary: 'Create independent project host setup metadata',
    usage:
      'nightshift project setup-create --project <id> --host <host-id> [--setup-id <id>] [--path <path>] [--kind git|folder] [--display-name <name>] [--worktree-base-path <path>] [--git-username <name>] [--state ready|not-set-up|setting-up|error|unsupported] [--method imported-existing-folder|cloned|provisioned] [--json]',
    allowedFlags: [
      ...GLOBAL_FLAGS,
      'project',
      'host',
      'setup-id',
      'path',
      'kind',
      'display-name',
      'worktree-base-path',
      'git-username',
      'state',
      'method'
    ],
    notes: [
      'Creates setup metadata without registering a repo compatibility record.',
      '--host runtime:<environment-id> targets that paired Nightshift server; use the id from `nightshift environment list`, not the environment name.',
      'Use setup-existing-folder when Nightshift should import and manage an actual checkout path now.'
    ],
    examples: [
      'nightshift project setup-create --project github:TxaisX/nightshift --host runtime:03ef704c-b180-4b10-998d-e28fbd5de9a3 --state setting-up --method provisioned --json'
    ]
  },
  {
    path: ['project', 'setup-update'],
    summary: 'Update project host setup metadata',
    usage:
      'nightshift project setup-update --setup <setup-id> [--display-name <name>] [--path <path>] [--worktree-base-path <path>] [--git-username <name>] [--kind git|folder] [--state ready|not-set-up|setting-up|error|unsupported] [--method legacy-repo|imported-existing-folder|cloned|provisioned] [--json]',
    allowedFlags: [
      ...GLOBAL_FLAGS,
      'setup',
      'display-name',
      'path',
      'worktree-base-path',
      'git-username',
      'kind',
      'state',
      'method'
    ],
    notes: [
      'Repo-backed setups mirror safe fields onto the repo record.',
      'Path and availability state changes are only supported for independent setup records.'
    ],
    examples: [
      'nightshift project setup-update --setup github:TxaisX/nightshift::gpu --display-name "GPU VM"',
      'nightshift project setup-update --setup github:TxaisX/nightshift::gpu --path /srv/nightshift --state ready --json'
    ]
  },
  {
    path: ['project', 'setup-delete'],
    destructive: true,
    summary: 'Remove a project host setup',
    usage: 'nightshift project setup-delete --setup <setup-id> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'setup'],
    notes: [
      'Independent setups are removed directly.',
      'Repo-backed setups remove the registered repo compatibility record.'
    ],
    examples: ['nightshift project setup-delete --setup github:TxaisX/nightshift::gpu --json']
  }
]
