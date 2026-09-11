export const BASH_PROMPT_COMMAND_COMPOSITION_BLOCK = `__nightshift_normalize_prompt_command_part() {
  local __nightshift_value="$1" __nightshift_output_name="$2" __nightshift_character __nightshift_chunk
  local __nightshift_value_length=\${#1} __nightshift_suffix_length=0 __nightshift_backslash_length=0
  local __nightshift_output_length __nightshift_scan_start
  while (( __nightshift_value_length - __nightshift_suffix_length >= 1024 )); do
    __nightshift_scan_start=$(( __nightshift_value_length - __nightshift_suffix_length - 1024 ))
    __nightshift_chunk="\${__nightshift_value:__nightshift_scan_start:1024}"
    case "$__nightshift_chunk" in
      *[!$' \\t\\n;']*) break ;;
      *) __nightshift_suffix_length=$(( __nightshift_suffix_length + 1024 )) ;;
    esac
  done
  while (( __nightshift_suffix_length < __nightshift_value_length )); do
    __nightshift_character="\${__nightshift_value: -__nightshift_suffix_length - 1:1}"
    case "$__nightshift_character" in
      ' '|$'\\t'|$'\\n'|';') __nightshift_suffix_length=$(( __nightshift_suffix_length + 1 )) ;;
      *) break ;;
    esac
  done
  __nightshift_output_length=$(( \${#__nightshift_value} - __nightshift_suffix_length ))
  while (( __nightshift_output_length - __nightshift_backslash_length >= 1024 )); do
    __nightshift_scan_start=$(( __nightshift_output_length - __nightshift_backslash_length - 1024 ))
    __nightshift_chunk="\${__nightshift_value:__nightshift_scan_start:1024}"
    case "$__nightshift_chunk" in
      *[!\\\\]*) break ;;
      *) __nightshift_backslash_length=$(( __nightshift_backslash_length + 1024 )) ;;
    esac
  done
  while (( __nightshift_backslash_length < __nightshift_output_length )); do
    __nightshift_character="\${__nightshift_value:__nightshift_output_length - __nightshift_backslash_length - 1:1}"
    [[ "$__nightshift_character" == '\\' ]] || break
    __nightshift_backslash_length=$(( __nightshift_backslash_length + 1 ))
  done
  # Preserve the first separator when an odd backslash run escapes it.
  if (( __nightshift_suffix_length > 0 && __nightshift_backslash_length % 2 == 1 )); then
    __nightshift_suffix_length=$(( __nightshift_suffix_length - 1 ))
    __nightshift_backslash_length=0
  fi
  __nightshift_output_length=$(( \${#__nightshift_value} - __nightshift_suffix_length ))
  __nightshift_value="\${__nightshift_value:0:__nightshift_output_length}"
  # Bash 4.4-5.0 scalar prompt evaluation preserves an odd terminal backslash.
  if (( __nightshift_suffix_length == 0 && ((BASH_VERSINFO[0] == 4 && BASH_VERSINFO[1] >= 4) || (BASH_VERSINFO[0] == 5 && BASH_VERSINFO[1] == 0)) && __nightshift_backslash_length % 2 == 1 )); then
    __nightshift_value="$__nightshift_value\\\\"
  fi
  printf -v "$__nightshift_output_name" '%s' "$__nightshift_value"
}
__nightshift_restore_prompt_status() {
  return "$1"
}
__nightshift_update_user_debug_trap() {
  local __nightshift_debug_trap_spec="$1" __nightshift_unchanged_debug_trap_spec="$2"
  local __nightshift_debug_trap_command
  [[ "$__nightshift_debug_trap_spec" != "$__nightshift_unchanged_debug_trap_spec" ]] || return 0
  [[ "$__nightshift_debug_trap_spec" != "trap -- '__nightshift_osc133_preexec' DEBUG" ]] || return 0
  if [[ -z "$__nightshift_debug_trap_spec" ]]; then
    __nightshift_user_debug_trap=""
    unset __nightshift_chained_debug_trap
    return 0
  fi
  __nightshift_debug_trap_command="\${__nightshift_debug_trap_spec#trap -- }"
  __nightshift_debug_trap_command="\${__nightshift_debug_trap_command% DEBUG}"
  eval "__nightshift_user_debug_trap=$__nightshift_debug_trap_command"
  unset __nightshift_chained_debug_trap
}
__nightshift_run_user_debug_trap() {
  if [[ -n "\${__nightshift_user_debug_trap:-}" ]]; then
    eval "$__nightshift_user_debug_trap" || true
  fi
}
__nightshift_adopt_outer_debug_trap() {
  local __nightshift_debug_trap_spec="\${__nightshift_outer_debug_trap_spec:-}"
  unset __nightshift_outer_debug_trap_spec
  __nightshift_update_user_debug_trap "$__nightshift_debug_trap_spec" "trap -- '__nightshift_osc133_preexec' DEBUG"
}
__nightshift_run_prompt_command_array() {
  local __nightshift_exit_code="\${__nightshift_prompt_status:-$?}" __nightshift_prompt_part __nightshift_prompt_index __nightshift_user_count
  local __nightshift_suffix_part
  local __nightshift_final_prompt_command
  local __nightshift_in_prompt_dispatch=1 __nightshift_dispatching_user_prompt_command=""
  unset __nightshift_prompt_status
  __nightshift_adopt_outer_debug_trap
  trap '__nightshift_osc133_preexec' DEBUG
  for __nightshift_prompt_part in "\${__nightshift_prompt_command_prefix[@]+"\${__nightshift_prompt_command_prefix[@]}"}"; do
    if (( __nightshift_exit_code == 0 )); then
      eval "$__nightshift_prompt_part"
    else
      __nightshift_restore_prompt_status "$__nightshift_exit_code" || eval "$__nightshift_prompt_part"
    fi
  done
  __nightshift_user_count=0
  for __nightshift_prompt_part in "\${__nightshift_prompt_command_array[@]+"\${__nightshift_prompt_command_array[@]}"}"; do
    __nightshift_user_count=$(( __nightshift_user_count + 1 ))
  done
  for (( __nightshift_prompt_index = 0; __nightshift_prompt_index + 1 < __nightshift_user_count; __nightshift_prompt_index++ )); do
    __nightshift_prompt_part="\${__nightshift_prompt_command_array[__nightshift_prompt_index]}"
    __nightshift_dispatching_user_prompt_command=1
    if (( __nightshift_exit_code == 0 )); then
      eval "$__nightshift_prompt_part"
    else
      __nightshift_restore_prompt_status "$__nightshift_exit_code" || eval "$__nightshift_prompt_part"
    fi
    __nightshift_dispatching_user_prompt_command=""
  done
  if (( __nightshift_user_count > 0 )); then
    __nightshift_prompt_part="\${__nightshift_prompt_command_array[__nightshift_user_count - 1]}"
    # Why: keep the final user hook and Nightshift suffixes in one status-preserving eval.
    __nightshift_final_prompt_command='eval "$__nightshift_prompt_part"'
    for __nightshift_suffix_part in "\${__nightshift_prompt_command_suffix[@]+"\${__nightshift_prompt_command_suffix[@]}"}"; do
      __nightshift_final_prompt_command+=$'\\n'"$__nightshift_suffix_part"
    done
    __nightshift_dispatching_user_prompt_command=1
    if (( __nightshift_exit_code == 0 )); then
      eval "$__nightshift_final_prompt_command"
    else
      __nightshift_restore_prompt_status "$__nightshift_exit_code" || eval "$__nightshift_final_prompt_command"
    fi
    __nightshift_dispatching_user_prompt_command=""
  else
    for __nightshift_prompt_part in "\${__nightshift_prompt_command_suffix[@]+"\${__nightshift_prompt_command_suffix[@]}"}"; do
      if (( __nightshift_exit_code == 0 )); then
        eval "$__nightshift_prompt_part"
      else
        __nightshift_restore_prompt_status "$__nightshift_exit_code" || eval "$__nightshift_prompt_part"
      fi
    done
  fi
  return "$__nightshift_exit_code"
}
__nightshift_finish_legacy_prompt_dispatch() {
  local __nightshift_suffix_part
  if [[ -n "\${__nightshift_in_prompt_command:-}" ]]; then
    for __nightshift_suffix_part in "\${__nightshift_prompt_command_suffix[@]+"\${__nightshift_prompt_command_suffix[@]}"}"; do
      eval "$__nightshift_suffix_part"
    done
  fi
  trap '__nightshift_osc133_preexec' DEBUG
  unset __nightshift_in_legacy_prompt_wrapper
}
__nightshift_normalize_prompt_command() {
  [[ -z "\${__nightshift_prompt_command_normalized:-}" ]] || return 0
  local __nightshift_prompt_part
  local -a __nightshift_normalized=()
  for __nightshift_prompt_part in "\${PROMPT_COMMAND[@]+"\${PROMPT_COMMAND[@]}"}"; do
    __nightshift_normalize_prompt_command_part "$__nightshift_prompt_part" __nightshift_prompt_part
    [[ -n "$__nightshift_prompt_part" ]] && __nightshift_normalized+=("$__nightshift_prompt_part")
  done
  __nightshift_prompt_command_normalized=1
  if (( BASH_VERSINFO[0] > 5 || (BASH_VERSINFO[0] == 5 && BASH_VERSINFO[1] >= 1) )); then
    PROMPT_COMMAND=("\${__nightshift_normalized[@]+"\${__nightshift_normalized[@]}"}")
  else
    __nightshift_prompt_command_array=("\${__nightshift_normalized[@]+"\${__nightshift_normalized[@]}"}")
    __nightshift_prompt_command_prefix=()
    __nightshift_prompt_command_suffix=()
    unset PROMPT_COMMAND
    # Why: PID scope distinguishes legacy prompt dispatch from ordinary user command text.
    __nightshift_prompt_status_variable="__nightshift_prompt_status_$$"
    __nightshift_prompt_status_capture_command="$__nightshift_prompt_status_variable=\\$?"
    __nightshift_prompt_status_value="\\\${$__nightshift_prompt_status_variable}"
    PROMPT_COMMAND="$__nightshift_prompt_status_capture_command; __nightshift_prompt_status=$__nightshift_prompt_status_value"'; __nightshift_prompt_had_functrace=""; if [[ -o functrace ]]; then __nightshift_prompt_had_functrace=1; set +T; fi; __nightshift_outer_debug_trap_spec="$(trap -p DEBUG)"; [[ -z "$__nightshift_prompt_had_functrace" ]] || set -T; unset __nightshift_prompt_had_functrace; __nightshift_run_prompt_command_array; __nightshift_finish_legacy_prompt_dispatch'
  fi
}
__nightshift_prepend_prompt_command() {
  local command="$1"
  __nightshift_normalize_prompt_command
  if (( BASH_VERSINFO[0] > 5 || (BASH_VERSINFO[0] == 5 && BASH_VERSINFO[1] >= 1) )); then
    PROMPT_COMMAND=("$command" "\${PROMPT_COMMAND[@]+"\${PROMPT_COMMAND[@]}"}")
  else
    __nightshift_prompt_command_prefix=("$command" "\${__nightshift_prompt_command_prefix[@]+"\${__nightshift_prompt_command_prefix[@]}"}")
  fi
}
__nightshift_append_prompt_command() {
  local command="$1"
  __nightshift_normalize_prompt_command
  if (( BASH_VERSINFO[0] > 5 || (BASH_VERSINFO[0] == 5 && BASH_VERSINFO[1] >= 1) )); then
    PROMPT_COMMAND+=("$command")
  else
    __nightshift_prompt_command_suffix+=("$command")
  fi
}`
