---
name: nightshift-emulator
description: >-
  iOS Simulator control from inside Nightshift, with the live device view in Nightshift's
  emulator pane. Use when driving a booted Apple Simulator on macOS: taps,
  gestures, typing, hardware buttons, rotation, and the accessibility tree, or
  when an iOS change needs simulator evidence. For an Android device or emulator
  use the Android emulator skill; build and install the app with xcodebuild or
  simctl first.
license: Apache-2.0
---

# Nightshift Emulator

This discovery stub loads the version-matched guide from the Nightshift executable used for this session.

Prefer Nightshift over raw `serve-sim` or direct `simctl` for simulator control inside Nightshift; it
handles device scoping, helper lifecycle, and worktree context.

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
NIGHTSHIFT skills get nightshift-emulator
```

Prefer `--json`. Use the selected executable's `--help` for commands or flags the guide does
not cover. If a command reports that Nightshift is not running, start it with `NIGHTSHIFT open --json`
and retry. If `skills get` is unknown, explain that updating Nightshift restores the guide; use
`--help` for read-only discovery and do not guess unsupported commands.
