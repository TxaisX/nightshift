import {
  buildWindowsHookStdinDrainEpilogue,
  WINDOWS_HOOK_STDIN_DRAIN_LABEL,
  WINDOWS_HOOK_STDIN_READER
} from '../agent-hooks/hook-stdin-contract'
import {
  CLAUDE_STATUSLINE_MIN_POST_INTERVAL_SECONDS,
  CLAUDE_STATUSLINE_PATHNAME
} from '../../shared/claude-statusline-rate-limits'

const STATUSLINE_CLEANUP_LABEL = 'nightshift_statusline_cleanup'
const STATUSLINE_PROBE_LABEL = 'nightshift_statusline_probe'

// Why: Claude Code pipes `rate_limits` to the statusLine command on every turn; forwarding
// it gives Nightshift live usage without spending the OAuth usage endpoint's tight budget.
// Emits no stdout so the in-terminal status line stays visually unchanged.
export function getManagedStatusLineScript(target: 'local' | 'posix' = 'local'): string {
  if (target === 'local' && process.platform === 'win32') {
    return [
      '@echo off',
      'setlocal',
      // Why: a backgrounded session's statusline runs in a daemon worker that inherited the
      // dispatching pane's env, so NIGHTSHIFT_PANE_KEY names a pane it does not run in (#9236).
      // Why exit, not the drain label: a worker is outside a Nightshift pane, so reading stdin to
      // EOF can block forever (#11549). This gates before stdin is owned, per that contract.
      'if not "%CLAUDE_JOB_DIR%"=="" exit /b 0',
      // Why: pane key is static PTY env (the endpoint file never sets it), so it can gate before stdin is consumed.
      `if "%NIGHTSHIFT_PANE_KEY%"=="" goto :${WINDOWS_HOOK_STDIN_DRAIN_LABEL}`,
      // Why: current keys end in a UUID; replacing the legacy delimiter also keeps surviving numeric-pane keys filename-safe.
      'set "NIGHTSHIFT_STATUSLINE_PANE_ID=%NIGHTSHIFT_PANE_KEY:~-36%"',
      'set "NIGHTSHIFT_STATUSLINE_PANE_ID=%NIGHTSHIFT_STATUSLINE_PANE_ID::=_%"',
      // Why: cmd has no builtin stdin capture, so buffer the payload in a per-pane temp file
      // (%RANDOM% collides across same-second cmd spawns) to guard before any curl spawn.
      'set "NIGHTSHIFT_STATUSLINE_PAYLOAD_FILE=%TEMP%\\nightshift-claude-statusline-%NIGHTSHIFT_STATUSLINE_PANE_ID%.tmp"',
      `${WINDOWS_HOOK_STDIN_READER} >"%NIGHTSHIFT_STATUSLINE_PAYLOAD_FILE%" 2>nul`,
      // Why: an all-builtin seconds-of-day throttle avoids spawning findstr+curl on every streaming tick.
      'set "NIGHTSHIFT_STATUSLINE_STAMP_FILE=%TEMP%\\nightshift-claude-statusline-last-%NIGHTSHIFT_STATUSLINE_PANE_ID%.tmp"',
      'set "NIGHTSHIFT_STATUSLINE_NOW="',
      'set "NIGHTSHIFT_STATUSLINE_TIME=%TIME: =0%"',
      'for /f "tokens=1-3 delims=:.," %%a in ("%NIGHTSHIFT_STATUSLINE_TIME%") do set /a "NIGHTSHIFT_STATUSLINE_NOW=(1%%a %% 100)*3600+(1%%b %% 100)*60+(1%%c %% 100)" 2>nul',
      'set "NIGHTSHIFT_STATUSLINE_LAST="',
      'set "NIGHTSHIFT_STATUSLINE_ELAPSED="',
      'if exist "%NIGHTSHIFT_STATUSLINE_STAMP_FILE%" set /p NIGHTSHIFT_STATUSLINE_LAST=<"%NIGHTSHIFT_STATUSLINE_STAMP_FILE%"',
      'if defined NIGHTSHIFT_STATUSLINE_LAST for /f "delims=0123456789" %%d in ("%NIGHTSHIFT_STATUSLINE_LAST%") do set "NIGHTSHIFT_STATUSLINE_LAST="',
      'if defined NIGHTSHIFT_STATUSLINE_NOW if defined NIGHTSHIFT_STATUSLINE_LAST set /a "NIGHTSHIFT_STATUSLINE_ELAPSED=NIGHTSHIFT_STATUSLINE_NOW-NIGHTSHIFT_STATUSLINE_LAST" 2>nul',
      `if not defined NIGHTSHIFT_STATUSLINE_ELAPSED goto :${STATUSLINE_PROBE_LABEL}`,
      `if %NIGHTSHIFT_STATUSLINE_ELAPSED% GEQ 0 if %NIGHTSHIFT_STATUSLINE_ELAPSED% LSS ${CLAUDE_STATUSLINE_MIN_POST_INTERVAL_SECONDS} goto :${STATUSLINE_CLEANUP_LABEL}`,
      `:${STATUSLINE_PROBE_LABEL}`,
      // Why: rate_limits appears only for Claude.ai-subscriber sessions after the first API response; the
      // statusline ticks ~3x/sec during streaming, so skip the endpoint call and curl spawn otherwise.
      // Why: \" is the MSVC argv escape — findstr sees the quoted JSON key, so a cwd containing rate_limits can't false-match (POSIX guard parity).
      '"%SystemRoot%\\System32\\findstr.exe" /c:\\"rate_limits\\" "%NIGHTSHIFT_STATUSLINE_PAYLOAD_FILE%" >nul 2>nul',
      `if errorlevel 1 goto :${STATUSLINE_CLEANUP_LABEL}`,
      // Why: call the endpoint file to refresh port/token — a PTY that survived a Nightshift restart carries stale env; falls through to PTY env if missing.
      'if defined NIGHTSHIFT_AGENT_HOOK_ENDPOINT if exist "%NIGHTSHIFT_AGENT_HOOK_ENDPOINT%" call "%NIGHTSHIFT_AGENT_HOOK_ENDPOINT%" 2>nul',
      `if "%NIGHTSHIFT_AGENT_HOOK_PORT%"=="" goto :${STATUSLINE_CLEANUP_LABEL}`,
      `if "%NIGHTSHIFT_AGENT_HOOK_TOKEN%"=="" goto :${STATUSLINE_CLEANUP_LABEL}`,
      // Why: stamp only when a post is certain, so skipped ticks (no rate_limits, missing port/token) never push the next allowed post out.
      'if defined NIGHTSHIFT_STATUSLINE_NOW (>"%NIGHTSHIFT_STATUSLINE_STAMP_FILE%" echo %NIGHTSHIFT_STATUSLINE_NOW%)',
      // Why: pre-build the field from an always-defined variable so an unset CLAUDE_CONFIG_DIR posts
      // empty (matching POSIX and the null attribution snapshot), never a literal %VAR% token.
      'set "NIGHTSHIFT_STATUSLINE_CONFIG_DIR_FIELD=configDir="',
      'if defined CLAUDE_CONFIG_DIR set "NIGHTSHIFT_STATUSLINE_CONFIG_DIR_FIELD=configDir=%CLAUDE_CONFIG_DIR%"',
      [
        '"%SystemRoot%\\System32\\curl.exe" -sS -X POST',
        `"http://127.0.0.1:%NIGHTSHIFT_AGENT_HOOK_PORT%${CLAUDE_STATUSLINE_PATHNAME}"`,
        '--connect-timeout 0.5 --max-time 1.5',
        '-H "Content-Type: application/x-www-form-urlencoded"',
        '-H "X-Nightshift-Agent-Hook-Token: %NIGHTSHIFT_AGENT_HOOK_TOKEN%"',
        '--data-urlencode "paneKey=%NIGHTSHIFT_PANE_KEY%"',
        '--data-urlencode "%NIGHTSHIFT_STATUSLINE_CONFIG_DIR_FIELD%"',
        '--data-urlencode "env=%NIGHTSHIFT_AGENT_HOOK_ENV%"',
        '--data-urlencode "version=%NIGHTSHIFT_AGENT_HOOK_VERSION%"',
        '--data-urlencode "payload@%NIGHTSHIFT_STATUSLINE_PAYLOAD_FILE%"',
        '>nul 2>&1'
      ].join(' '),
      `:${STATUSLINE_CLEANUP_LABEL}`,
      'del "%NIGHTSHIFT_STATUSLINE_PAYLOAD_FILE%" >nul 2>nul',
      'exit /b 0',
      ...buildWindowsHookStdinDrainEpilogue(),
      ''
    ].join('\r\n')
  }

  return [
    '#!/bin/sh',
    // Why: this runs on every statusline tick; builtin capture avoids replacing curl churn with cat churn.
    'payload=',
    'while IFS= read -r nightshift_statusline_line || [ -n "$nightshift_statusline_line" ]; do',
    '  payload="${payload}${nightshift_statusline_line}\n"',
    'done',
    'payload=${payload%?}',
    'if [ -z "$payload" ]; then',
    '  exit 0',
    'fi',
    // Why: a backgrounded session's statusline runs in a daemon worker that inherited the
    // dispatching pane's env, so NIGHTSHIFT_PANE_KEY names a pane it does not run in (#9236).
    // Placed after capture: POSIX hooks own stdin first, or the agent sees EPIPE (#8110).
    'if [ -n "$CLAUDE_JOB_DIR" ]; then',
    '  exit 0',
    'fi',
    // Why: rate_limits appears only for Claude.ai-subscriber sessions after the first API response; skip the post (and its curl spawn) otherwise.
    'case "$payload" in',
    '  *\'"rate_limits"\'*) ;;',
    '  *) exit 0 ;;',
    'esac',
    'if [ -n "$NIGHTSHIFT_AGENT_HOOK_ENDPOINT" ] && [ -r "$NIGHTSHIFT_AGENT_HOOK_ENDPOINT" ]; then',
    '  . "$NIGHTSHIFT_AGENT_HOOK_ENDPOINT" 2>/dev/null || :',
    'fi',
    'if [ -z "$NIGHTSHIFT_AGENT_HOOK_PORT" ] || [ -z "$NIGHTSHIFT_AGENT_HOOK_TOKEN" ] || [ -z "$NIGHTSHIFT_PANE_KEY" ]; then',
    '  exit 0',
    'fi',
    // Why: the stable leaf UUID avoids path-unsafe and overlong user-supplied tab ids.
    'nightshift_statusline_pane_id=${NIGHTSHIFT_PANE_KEY##*:}',
    // Why: pre-migration numeric leaf ids were tab-local, so include a safe tab id to avoid cross-pane throttle collisions after upgrade.
    'case "$nightshift_statusline_pane_id" in',
    "  ''|*[!0-9]*) ;;",
    '  *)',
    '    nightshift_statusline_tab_id=${NIGHTSHIFT_PANE_KEY%:*}',
    '    case "$nightshift_statusline_tab_id" in',
    "      ''|*[!A-Za-z0-9._-]*) ;;",
    '      *) nightshift_statusline_pane_id="${nightshift_statusline_tab_id}_${nightshift_statusline_pane_id}" ;;',
    '    esac',
    '    ;;',
    'esac',
    'nightshift_statusline_stamp="${TMPDIR:-/tmp}/nightshift-claude-statusline-last-${nightshift_statusline_pane_id}"',
    // Why: the payload clock keeps throttled ticks free of subprocesses; date is only a schema-drift fallback.
    'nightshift_statusline_now=',
    'case "$payload" in',
    '  *\'"total_duration_ms"\'*)',
    '    nightshift_statusline_duration=${payload#*\'"total_duration_ms"\'}',
    '    nightshift_statusline_duration=${nightshift_statusline_duration#*:}',
    '    nightshift_statusline_duration=${nightshift_statusline_duration#"${nightshift_statusline_duration%%[![:space:]]*}"}',
    '    nightshift_statusline_duration=${nightshift_statusline_duration%%[!0-9]*}',
    '    case "$nightshift_statusline_duration" in',
    '      0|[1-9]|[1-9][0-9]*)',
    '        if [ "${#nightshift_statusline_duration}" -le 15 ]; then',
    '          nightshift_statusline_now=$((nightshift_statusline_duration / 1000))',
    '        fi',
    '        ;;',
    '    esac',
    '    ;;',
    'esac',
    'if [ -z "$nightshift_statusline_now" ]; then',
    '  nightshift_statusline_now=$(date +%s 2>/dev/null) || nightshift_statusline_now=',
    'fi',
    // Why: leading zeros read as octal inside $(( )), and a bad constant (008) is FATAL in dash —
    // the script would die before rewriting the stamp, wedging the pane dark. Allow-list canonical
    // decimals so any malformed value fails open to posting instead.
    'case "$nightshift_statusline_now" in 0|[1-9]|[1-9][0-9]*) ;; *) nightshift_statusline_now= ;; esac',
    'if [ -n "$nightshift_statusline_now" ] && [ -f "$nightshift_statusline_stamp" ]; then',
    '  nightshift_statusline_last=',
    '  IFS= read -r nightshift_statusline_last <"$nightshift_statusline_stamp" 2>/dev/null || :',
    '  case "$nightshift_statusline_last" in 0|[1-9]|[1-9][0-9]*) ;; *) nightshift_statusline_last= ;; esac',
    '  if [ "${#nightshift_statusline_last}" -gt 15 ]; then nightshift_statusline_last=; fi',
    '  if [ -n "$nightshift_statusline_last" ]; then',
    '    nightshift_statusline_elapsed=$((nightshift_statusline_now - nightshift_statusline_last))',
    `    if [ "$nightshift_statusline_elapsed" -ge 0 ] && [ "$nightshift_statusline_elapsed" -lt ${CLAUDE_STATUSLINE_MIN_POST_INTERVAL_SECONDS} ]; then`,
    '      exit 0',
    '    fi',
    '  fi',
    'fi',
    'if [ -n "$nightshift_statusline_now" ]; then',
    '  printf \'%s\' "$nightshift_statusline_now" >"$nightshift_statusline_stamp" 2>/dev/null || :',
    'fi',
    `printf '%s' "$payload" | curl -sS -X POST "http://127.0.0.1:\${NIGHTSHIFT_AGENT_HOOK_PORT}${CLAUDE_STATUSLINE_PATHNAME}" \\`,
    '  --connect-timeout 0.5 --max-time 1.5 \\',
    '  -H "Content-Type: application/x-www-form-urlencoded" \\',
    '  -H "X-Nightshift-Agent-Hook-Token: ${NIGHTSHIFT_AGENT_HOOK_TOKEN}" \\',
    '  --data-urlencode "paneKey=${NIGHTSHIFT_PANE_KEY}" \\',
    '  --data-urlencode "configDir=${CLAUDE_CONFIG_DIR}" \\',
    '  --data-urlencode "env=${NIGHTSHIFT_AGENT_HOOK_ENV}" \\',
    '  --data-urlencode "version=${NIGHTSHIFT_AGENT_HOOK_VERSION}" \\',
    '  --data-urlencode "payload@-" >/dev/null 2>&1 || true',
    'exit 0',
    ''
  ].join('\n')
}
