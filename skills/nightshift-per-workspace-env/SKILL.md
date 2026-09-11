---
name: nightshift-per-workspace-env
description: >-
  Set up, review, debug, or validate a Nightshift per-workspace environment recipe: the
  on-demand, disposable runtime (cloud sandbox, VM, SSH host, or local container)
  Nightshift creates fresh for each workspace. Use to stand up a new recipe end to end,
  fix an `environmentRecipes` entry in `nightshift.yaml`, scaffold provider lifecycle
  scripts, or resolve an `nightshift vm recipe doctor` failure. Use `nightshift-cli` for
  ordinary worktree and workspace creation with no recipe involved.
---

# Per-Workspace Environments

This discovery stub loads the version-matched guide from the Nightshift executable used for this session.

## Resolve the CLI for this session

Choose the executable once and reuse it for every later command:

- If the `NIGHTSHIFT_CLI_COMMAND` environment variable is set, use its value. Nightshift exports this
  for managed WSL sessions.
- Otherwise, in a dev checkout whose session exposes `NIGHTSHIFT_DEV_REPO_ROOT`, use `nightshift-dev`.
- Otherwise, on Linux outside a Nightshift-managed terminal, use `nightshift-ide`. Never run bare
  `nightshift` there — outside Nightshift's terminals it normally resolves to the
  GNOME Orca screen reader (`/usr/bin/orca`) and starts speech on the user's machine.
- Otherwise, use `nightshift`.

Below, `NIGHTSHIFT` is a placeholder for the executable you resolved. Substitute it before
running anything; do not create a shell variable or run `NIGHTSHIFT` literally. This works the
same way in POSIX shells, PowerShell, and cmd.exe.

If the selected executable cannot run, report its exact error and stop. Do not fall through
to another executable, which could silently target a different Nightshift build.

## Load the version-matched guide before running Nightshift commands

```text
NIGHTSHIFT skills get nightshift-per-workspace-env
```

Prefer `--json`. Use the selected executable's `--help` for commands or flags the guide does
not cover. If a command reports that Nightshift is not running, start it with `NIGHTSHIFT open --json`
and retry. If `skills get` is unknown, explain that updating Nightshift restores the guide; use
`--help` for read-only discovery and do not guess unsupported commands.
