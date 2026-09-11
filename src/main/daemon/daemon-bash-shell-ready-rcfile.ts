import { getPosixOmpShellWrapper } from '../pty/omp-shell-wrapper'
import { getPosixCodexShellLaunchPreflight } from '../pty/codex-shell-launch-preflight'
import { BASH_PROMPT_COMMAND_COMPOSITION_BLOCK } from '../bash-prompt-command-composition'
import { BASH_FEATURE_CHANNEL_BLOCK, SHELL_STARTUP_IDENTITY_MARKER_BLOCK } from '../shell-templates'

export function getDaemonBashShellReadyRcfileContent(): string {
  return `# Nightshift daemon bash shell-ready wrapper
${BASH_FEATURE_CHANNEL_BLOCK}
${SHELL_STARTUP_IDENTITY_MARKER_BLOCK}
# Why a plain variable: the channel is consumed and destroyed in these first
# lines, so nothing this shell later spawns can see or inherit the selection.
__nightshift_ready_marker=""
__nightshift_has_feature ready && __nightshift_ready_marker=1
unset _nightshift_shell_features
unset -f __nightshift_has_feature
[[ -f /etc/profile ]] && source /etc/profile
if [[ -f "$HOME/.bash_profile" ]]; then
  source "$HOME/.bash_profile"
elif [[ -f "$HOME/.bash_login" ]]; then
  source "$HOME/.bash_login"
elif [[ -f "$HOME/.profile" ]]; then
  source "$HOME/.profile"
fi
# Why: enable bracketed paste so Nightshift can deliver a multiline startup prompt as
# a single literal paste (ESC[200~…ESC[201~); without it, older readline builds
# treat each embedded newline as Enter and mangle the prompt into PS2
# continuation. Modern readline defaults this on; force it for the rest.
[[ $- == *i* ]] && bind 'set enable-bracketed-paste on' 2>/dev/null
__nightshift_restore_agent_teams_path() {
  [[ -n "\${NIGHTSHIFT_AGENT_TEAMS_SHIM_DIR:-}" ]] || return 0
  case "$PATH" in
    "\${NIGHTSHIFT_AGENT_TEAMS_SHIM_DIR}"|"\${NIGHTSHIFT_AGENT_TEAMS_SHIM_DIR}:"*) return 0 ;;
  esac
  export PATH="\${NIGHTSHIFT_AGENT_TEAMS_SHIM_DIR}:$PATH"
}
__nightshift_restore_agent_teams_path
# Why: user startup files may set the default OpenCode config after Nightshift's
# spawn env; restore the Nightshift-managed config dir before the first prompt.
[[ -n "\${NIGHTSHIFT_OPENCODE_CONFIG_DIR:-}" ]] && export OPENCODE_CONFIG_DIR="\${NIGHTSHIFT_OPENCODE_CONFIG_DIR}"
[[ -n "\${NIGHTSHIFT_MIMOCODE_HOME:-}" ]] && export MIMOCODE_HOME="\${NIGHTSHIFT_MIMOCODE_HOME}"
${getPosixOmpShellWrapper()}
# Why: Codex must keep using Nightshift's runtime CODEX_HOME after profile scripts.
[[ -n "\${NIGHTSHIFT_CODEX_HOME:-}" ]] && export CODEX_HOME="\${NIGHTSHIFT_CODEX_HOME}"
${getPosixCodexShellLaunchPreflight()}
# Why: emit OSC 133 C/D so terminal-command-lifecycle can drop stale agent
# status when the foreground command exits — mirrors the zsh daemon wrapper.
# Without this, bash users (default on most Linux distros) keep a stuck
# 'working' spinner after the CLI exits without a Stop/SessionEnd hook.
__nightshift_initializing_wrapper=1
__nightshift_osc133_precmd() {
  local exit_code=$?
  __nightshift_in_prompt_command=1
  if [[ -n "\${__nightshift_in_command:-}" ]]; then
    printf "\\033]133;D;%s\\007" "$exit_code"
    unset __nightshift_in_command
  fi
  printf "\\033]133;A\\007"
  return "$exit_code"
}
__nightshift_osc133_preexec() {
  if [[ -n "\${__nightshift_prompt_status_capture_command:-}" && "$BASH_COMMAND" == "$__nightshift_prompt_status_capture_command" ]]; then
    unset __nightshift_initial_prompt
    __nightshift_in_legacy_prompt_wrapper=1
    return 0
  fi
  if [[ -n "\${__nightshift_initializing_wrapper:-}\${__nightshift_in_debug_capture:-}\${__nightshift_initial_prompt:-}\${__nightshift_in_prompt_dispatch:-}\${__nightshift_in_legacy_prompt_wrapper:-}\${__nightshift_in_prompt_command:-}" ]]; then
    [[ -z "\${__nightshift_initializing_wrapper:-}\${__nightshift_in_debug_capture:-}" ]] || return 0
    if [[ -n "\${__nightshift_initial_prompt:-}" && "$BASH_COMMAND" == "__nightshift_osc133_precmd" ]]; then
      unset __nightshift_initial_prompt; return 0
    fi
    if [[ -n "\${__nightshift_in_prompt_dispatch:-}" ]]; then
      [[ -n "\${__nightshift_dispatching_user_prompt_command:-}" ]] || return 0
      if [[ "\${FUNCNAME[1]:-}" == "__nightshift_run_prompt_command_array" ]]; then
        case "$BASH_COMMAND" in
          '(( __nightshift_exit_code == 0 ))'|'__nightshift_restore_prompt_status "$__nightshift_exit_code"'|'eval "$__nightshift_prompt_part"'|'eval "$__nightshift_final_prompt_command"'|__nightshift_dispatching_user_prompt_command=*|__nightshift_osc133_precmd|__nightshift_osc133_epilogue) return 0 ;;
        esac
      fi
    elif [[ "\${FUNCNAME[1]:-}" == "__nightshift_run_prompt_command_array" || "$BASH_COMMAND" == "__nightshift_run_prompt_command_array" ]]; then
      return 0
    fi
    [[ -z "\${__nightshift_in_legacy_prompt_wrapper:-}" || -n "\${__nightshift_dispatching_user_prompt_command:-}" ]] || return 0
    if [[ -n "\${__nightshift_in_prompt_command:-}" && "$BASH_COMMAND" == "__nightshift_in_debug_capture=1" ]]; then
      return 0
    fi
  fi
  case "\${FUNCNAME[1]:-}" in
    __nightshift_osc133_*|__nightshift_restore_prompt_status|__bp_*) return 0 ;;
  esac
  case "$BASH_COMMAND" in
    __nightshift_osc133_precmd|__nightshift_osc133_epilogue) return 0 ;;
    # The prefix is only special while bash-preexec prompt hooks run.
    __bp_*) [[ -n "\${__nightshift_in_prompt_command:-}" ]] && return 0 ;;
  esac
  __nightshift_run_user_debug_trap
  # Why: a framework (bash-preexec/starship) may replace our DEBUG trap at the
  # first prompt; __nightshift_osc133_epilogue re-takes it each prompt and stores the
  # framework's trap here, so the framework's own preexec still runs while our
  # command-start C survives its re-arm.
  if [[ -n "\${__nightshift_chained_debug_trap:-}" ]]; then
    eval "$__nightshift_chained_debug_trap" || true
  fi
  [[ -z "\${__nightshift_in_prompt_command:-}" ]] || return 0
  # Why: a chained trap can invoke us more than once for a single command, so
  # emit C only on the first fire (the __nightshift_in_command gate), and never for a
  # prompt-time hook — ours or bash-preexec's __bp_* helpers.
  [[ -z "\${__nightshift_in_command:-}" ]] || return 0
  printf "\\033]133;C\\007"
  __nightshift_in_command=1
}
# Why: adopt the latest user trap before Nightshift retakes lifecycle ownership.
__nightshift_osc133_epilogue() {
  unset __nightshift_in_prompt_command
  __nightshift_adopt_outer_debug_trap
  trap '__nightshift_osc133_preexec' DEBUG
  # Readline renders PS1 after entering raw mode; prompt hooks still run in cooked mode.
  if [[ -n "$__nightshift_ready_marker" ]]; then
    PS1="\${PS1-}"'\\[\\e]777;nightshift-shell-ready\\a\\]'
    __nightshift_ready_marker=""
  fi
}
${BASH_PROMPT_COMMAND_COMPOSITION_BLOCK}
__nightshift_prepend_prompt_command "__nightshift_osc133_precmd"
__nightshift_append_prompt_command '__nightshift_in_debug_capture=1; __nightshift_prompt_had_functrace=""; if [[ -o functrace ]]; then __nightshift_prompt_had_functrace=1; set +T; fi; __nightshift_outer_debug_trap_spec="$(trap -p DEBUG)"; [[ -z "$__nightshift_prompt_had_functrace" ]] || set -T; unset __nightshift_prompt_had_functrace __nightshift_in_debug_capture'
__nightshift_append_prompt_command "__nightshift_osc133_epilogue"
__nightshift_had_functrace=""
[[ -o functrace ]] && __nightshift_had_functrace=1
set +T
__nightshift_debug_trap_spec="$(trap -p DEBUG)"
[[ -z "$__nightshift_had_functrace" ]] || set -T
if [[ -n "$__nightshift_debug_trap_spec" && "$__nightshift_debug_trap_spec" != "trap -- '__nightshift_osc133_preexec' DEBUG" ]]; then
  __nightshift_debug_trap_command="\${__nightshift_debug_trap_spec#trap -- }"
  __nightshift_debug_trap_command="\${__nightshift_debug_trap_command% DEBUG}"
  eval "__nightshift_user_debug_trap=$__nightshift_debug_trap_command"
fi
unset __nightshift_debug_trap_spec __nightshift_debug_trap_command __nightshift_had_functrace
unset -f __nightshift_normalize_prompt_command_part __nightshift_normalize_prompt_command __nightshift_prepend_prompt_command __nightshift_append_prompt_command
unset __nightshift_prompt_command_normalized
# Why: arm DEBUG after wrapper setup; otherwise bash treats our own rcfile
# commands as a foreground command and emits a fake C/D before the first prompt.
__nightshift_initial_prompt=1
trap '__nightshift_osc133_preexec' DEBUG
unset __nightshift_initializing_wrapper
`
}
