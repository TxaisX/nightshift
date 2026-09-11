import {
  getSharedManagedScriptPath,
  wrapPosixHookCommand,
  wrapWindowsCmdHookCommand
} from '../agent-hooks/installer-utils'
import {
  buildPosixHookPayloadCapture,
  buildPosixHookSpoolLines
} from '../agent-hooks/hook-stdin-contract'
import {
  buildWindowsGrokHookScript,
  GROK_HOME_ENVELOPE_MAX_LENGTH
} from './windows-grok-hook-script'

export function getGrokManagedScriptFileName(): string {
  return process.platform === 'win32' ? 'grok-hook.cmd' : 'grok-hook.sh'
}

export function getGrokManagedScriptPath(): string {
  return getSharedManagedScriptPath(getGrokManagedScriptFileName())
}

export function getGrokManagedCommand(scriptPath: string): string {
  // A cmd-safe bare path avoids two extra Windows interpreters; POSIX can gate before spawning the
  // managed script because Nightshift injects NIGHTSHIFT_PANE_KEY only into panes it owns.
  return process.platform === 'win32'
    ? wrapWindowsCmdHookCommand(scriptPath)
    : wrapPosixHookCommand(scriptPath, {}, { requiredEnvVar: 'NIGHTSHIFT_PANE_KEY' })
}

export function getGrokManagedScript(target: 'local' | 'posix' = 'local'): string {
  if (target === 'local' && process.platform === 'win32') {
    return buildWindowsGrokHookScript()
  }

  return [
    '#!/bin/sh',
    ...buildPosixHookPayloadCapture(),
    ...buildPosixHookSpoolLines('grok'),
    'if [ -n "$NIGHTSHIFT_AGENT_HOOK_ENDPOINT" ] && [ -r "$NIGHTSHIFT_AGENT_HOOK_ENDPOINT" ]; then',
    '  . "$NIGHTSHIFT_AGENT_HOOK_ENDPOINT" 2>/dev/null || :',
    'fi',
    'if [ -z "$NIGHTSHIFT_AGENT_HOOK_PORT" ] || [ -z "$NIGHTSHIFT_AGENT_HOOK_TOKEN" ] || [ -z "$NIGHTSHIFT_PANE_KEY" ]; then',
    '  spool_hook_event',
    '  exit 0',
    'fi',
    'grok_home=',
    `if [ -n "\${GROK_HOME:-}" ] && [ "\${#GROK_HOME}" -le ${GROK_HOME_ENVELOPE_MAX_LENGTH} ]; then`,
    '  grok_home=$GROK_HOME',
    'fi',
    'printf \'%s\' "$payload" | curl -sS -X POST "http://127.0.0.1:${NIGHTSHIFT_AGENT_HOOK_PORT}/hook/grok" \\',
    '  --connect-timeout 0.5 --max-time 1.5 \\',
    '  -H "Content-Type: application/x-www-form-urlencoded" \\',
    '  -H "X-Nightshift-Agent-Hook-Token: ${NIGHTSHIFT_AGENT_HOOK_TOKEN}" \\',
    '  --data-urlencode "paneKey=${NIGHTSHIFT_PANE_KEY}" \\',
    '  --data-urlencode "tabId=${NIGHTSHIFT_TAB_ID}" \\',
    '  --data-urlencode "launchToken=${NIGHTSHIFT_AGENT_LAUNCH_TOKEN}" \\',
    '  --data-urlencode "worktreeId=${NIGHTSHIFT_WORKTREE_ID}" \\',
    '  --data-urlencode "env=${NIGHTSHIFT_AGENT_HOOK_ENV}" \\',
    '  --data-urlencode "version=${NIGHTSHIFT_AGENT_HOOK_VERSION}" \\',
    '  --data-urlencode "grokHome=${grok_home}" \\',
    '  --data-urlencode "payload@-" >/dev/null 2>&1 || spool_hook_event',
    'exit 0',
    ''
  ].join('\n')
}
