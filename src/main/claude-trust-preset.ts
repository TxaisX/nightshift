import { existsSync, readFileSync, realpathSync } from 'node:fs'
import { resolve } from 'node:path'
import { writeFileAtomically } from './codex-accounts/fs-utils'
import { ClaudeRuntimePathResolver } from './claude-accounts/runtime-paths'

/**
 * Claude Code keeps per-project trust in `.claude.json` (inside CLAUDE_CONFIG_DIR when that is
 * set, else in the home directory) under `projects["<absolute path>"].hasTrustDialogAccepted`.
 * Pre-writing it skips the "Do you trust this folder?" menu that otherwise holds a launch
 * prompt hostage on every fresh worktree. Fork addition: upstream ships presets for Cursor,
 * Copilot and Codex only.
 *
 * ponytail: plain read-modify-write; a Claude session writing the same file in the same
 * millisecond could lose that write. Add a lock like the Codex preset if it ever bites.
 */
export function markClaudeProjectTrusted(workspacePath: string): void {
  let absPath = resolve(workspacePath)
  try {
    // Why: Claude keys the entry on process.cwd(), which Windows reports with the on-disk casing.
    absPath = realpathSync.native(absPath)
  } catch {
    // Keep the resolved path when the directory is not there yet.
  }
  const configPath = new ClaudeRuntimePathResolver().getRuntimePaths().configPath
  let config: Record<string, unknown> = {}
  try {
    if (existsSync(configPath)) {
      const parsed: unknown = JSON.parse(readFileSync(configPath, 'utf-8'))
      if (parsed && typeof parsed === 'object') {
        config = parsed as Record<string, unknown>
      }
    }
  } catch {
    // Why: a corrupted config is the user's to fix; never overwrite it from a side effect.
    return
  }
  const projects =
    config.projects && typeof config.projects === 'object'
      ? (config.projects as Record<string, Record<string, unknown>>)
      : {}
  const existing = projects[absPath]
  if (existing?.hasTrustDialogAccepted === true) {
    return
  }
  projects[absPath] = { allowedTools: [], ...existing, hasTrustDialogAccepted: true }
  config.projects = projects
  writeFileAtomically(configPath, `${JSON.stringify(config, null, 2)}\n`)
}
