import type { AgentHookSource } from '../../shared/agent-hook-relay'
import { NIGHTSHIFT_HOOK_RAW_JSON_TRANSPORT } from '../../shared/agent-hook-types'

export function buildPosixAgentHookPostCommand(
  source: AgentHookSource,
  options: { curlCommand?: string; indent?: string } = {}
): string[] {
  const curlCommand = options.curlCommand ?? 'curl'
  const indent = options.indent ?? '  '
  return [
    `if [ "\${NIGHTSHIFT_AGENT_HOOK_TRANSPORT:-}" = "${NIGHTSHIFT_HOOK_RAW_JSON_TRANSPORT}" ] && command -v base64 >/dev/null 2>&1 && command -v tr >/dev/null 2>&1; then`,
    `  nightshift_hook_metadata=$(printf '%s\\037%s\\037%s\\037%s\\037%s\\037%s' "$NIGHTSHIFT_PANE_KEY" "$NIGHTSHIFT_TAB_ID" "$NIGHTSHIFT_AGENT_LAUNCH_TOKEN" "$NIGHTSHIFT_WORKTREE_ID" "$NIGHTSHIFT_AGENT_HOOK_ENV" "$NIGHTSHIFT_AGENT_HOOK_VERSION" | base64 | tr -d '\\n') && \\`,
    `  [ -n "$nightshift_hook_metadata" ] && \\`,
    `  printf '%s' "$payload" | ${curlCommand} -sS -X POST "http://127.0.0.1:\${NIGHTSHIFT_AGENT_HOOK_PORT}/hook/${source}" \\`,
    `  ${indent}--connect-timeout "\${connect_timeout:-0.5}" --max-time "\${max_time:-1.5}" \\`,
    `  ${indent}--noproxy "127.0.0.1" \\`,
    `  ${indent}-H "Content-Type: application/json" \\`,
    `  ${indent}-H "X-Nightshift-Agent-Hook-Token: \${NIGHTSHIFT_AGENT_HOOK_TOKEN}" \\`,
    `  ${indent}-H "X-Nightshift-Agent-Hook-Meta-Encoding: base64" \\`,
    `  ${indent}-H "X-Nightshift-Agent-Hook-Meta: \${nightshift_hook_metadata}" \\`,
    `  ${indent}--data-binary @-`,
    'else',
    `  printf '%s' "$payload" | ${curlCommand} -sS -X POST "http://127.0.0.1:\${NIGHTSHIFT_AGENT_HOOK_PORT}/hook/${source}" \\`,
    `  ${indent}--connect-timeout "\${connect_timeout:-0.5}" --max-time "\${max_time:-1.5}" \\`,
    `  ${indent}--noproxy "127.0.0.1" \\`,
    `  ${indent}-H "Content-Type: application/x-www-form-urlencoded" \\`,
    `  ${indent}-H "X-Nightshift-Agent-Hook-Token: \${NIGHTSHIFT_AGENT_HOOK_TOKEN}" \\`,
    `  ${indent}--data-urlencode "paneKey=\${NIGHTSHIFT_PANE_KEY}" \\`,
    `  ${indent}--data-urlencode "tabId=\${NIGHTSHIFT_TAB_ID}" \\`,
    `  ${indent}--data-urlencode "launchToken=\${NIGHTSHIFT_AGENT_LAUNCH_TOKEN}" \\`,
    `  ${indent}--data-urlencode "worktreeId=\${NIGHTSHIFT_WORKTREE_ID}" \\`,
    `  ${indent}--data-urlencode "env=\${NIGHTSHIFT_AGENT_HOOK_ENV}" \\`,
    `  ${indent}--data-urlencode "version=\${NIGHTSHIFT_AGENT_HOOK_VERSION}" \\`,
    `  ${indent}--data-urlencode "payload@-"`,
    'fi'
  ]
}
