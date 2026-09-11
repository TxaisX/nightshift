# Nightshift

Run a team of AI coding agents in parallel on Windows, each in its own git worktree.

Nightshift is a desktop workspace for agent-driven development. Point it at a repository, launch
the agent CLIs you already have on your PATH, and every session gets an isolated worktree, its own
terminals, and a status you can read at a glance.

## What it does

- **Isolated sessions.** Each agent works in its own git worktree, so parallel sessions never fight
  over the same checkout.
- **Any agent on your PATH.** Claude Code, Codex, Gemini CLI, Copilot, OpenCode, Aider and others
  are detected automatically. Nightshift launches them and bills through your own accounts; it
  bundles no models and no keys.
- **One-click launch.** The `+` menu lists only the agents actually installed on the machine, so a
  new agent terminal is one click, or one keystroke once you bind a shortcut.
- **Launch a shape, not a prompt.** Solo, Pair, Workbench and Swarm open several sessions at once
  and give each a distinct role, with a lineup you review before anything is created.
- **Live status.** Managed hooks report whether each agent is working, waiting on you, or done.
- **Automations.** Run a prompt on a schedule, hourly, daily or on a cron expression.
- **Orchestration.** A first-class CLI creates runs and tasks, starts worker sessions from inside
  another agent, dispatches work between them, and carries messages in per-run mailboxes.
- **Everything in one window.** Terminals, an editor, a browser and diff review sit side by side.

## Build (Windows 11)

Requirements: Node 24 with `corepack enable` (pnpm is pinned by `packageManager`), Visual Studio
2022 Build Tools with the C++ workload (not 2026 — node-gyp cannot detect VS 18), Python 3, and
Windows long paths enabled. Clone with `core.autocrlf=false`; CRLF breaks linting.

```
pnpm install
pnpm dev                 # development instance
pnpm run build:win       # unsigned NSIS installer in dist/
```

The installer is unsigned, so SmartScreen will warn: choose More info, then Run anyway.

Install a fresh build from **PowerShell**, never Git Bash, which rewrites `/S` into a path and
silently drops the installer into its interactive UI:

```
Start-Process dist\nightshift-windows-setup.exe -ArgumentList '/S','/currentuser' -Wait
```

Close any editor window holding the repository or the install folder first. An update moves every
installed file aside and aborts if one is locked. `config/scripts/windows-who-locks.ps1 -Path <file>`
names the process holding it.

## Command line

The shipped CLI lives at `%LOCALAPPDATA%\Programs\nightshift\resources\bin\nightshift.cmd`.

```
nightshift status
nightshift repo add --path <repo>
nightshift worktree create --name x --repo path:<repo> --agent claude --prompt "..."
nightshift terminal create --worktree name:x --command claude --focus
nightshift orchestration run-create
```

`nightshift --help` lists every command; `nightshift orchestration --full` documents the
orchestration surface.

## Configuration

- `NIGHTSHIFT_WORKSPACES_DIR` overrides where worktrees are created.
- Keyboard shortcuts are user-owned in `~/.nightshift/keybindings.json`.

### Shortcuts that ship unbound

A number of commands deliberately ship with no key assigned, so they never steal
a chord you already use. They are on menus and in the shortcut list, and you bind
the ones you want. Among the most useful:

| Command | What it does |
| --- | --- |
| Toggle Agent Dashboard | One view of every agent and what it is doing |
| Toggle Workspace Board | The board view of your workspaces |
| Equalize pane sizes | Evens up panes you have split inside a tab |
| New agent tab | Opens a tab already running your default agent |
| Toggle Quick Commands menu | The per-workspace command palette |
| Open Tasks | The task list |

Assign them in the shortcut list, or add them under the `platforms` block of
`~/.nightshift/keybindings.json`, for example:

```json
{
  "version": 1,
  "platforms": {
    "win32": {
      "dashboard.toggle": ["Mod+Alt+D"],
      "terminal.equalizePaneSizes": ["Mod+Shift+U"]
    }
  }
}
```

`Mod` is Ctrl on Windows and Linux, Command on macOS. The app validates the file
on load and reports conflicts rather than silently dropping a binding.

## License

MIT. See [LICENSE](LICENSE).
