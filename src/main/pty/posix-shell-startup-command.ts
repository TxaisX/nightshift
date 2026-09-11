import { basename, win32 as pathWin32 } from 'node:path'

export const POSIX_SHELL_STARTUP_COMMAND_ENV = 'NIGHTSHIFT_POSIX_SHELL_STARTUP_COMMAND'

export function supportsPosixShellStartupCommand(shellPath: string): boolean {
  const shellName = pathWin32.basename(basename(shellPath)).toLowerCase()
  return shellName === 'bash' || shellName === 'zsh' || shellName === 'fish'
}

export function getBashStartupCommandPromptBlock(): string {
  return `if [[ \${${POSIX_SHELL_STARTUP_COMMAND_ENV}+present} == present ]]; then
  __nightshift_remove_startup_command_prompt_hook() {
    local __nightshift_item
    local -a __nightshift_remaining=()
    if (( BASH_VERSINFO[0] > 5 || (BASH_VERSINFO[0] == 5 && BASH_VERSINFO[1] >= 1) )); then
      for __nightshift_item in "\${PROMPT_COMMAND[@]+"\${PROMPT_COMMAND[@]}"}"; do
        [[ "$__nightshift_item" == "__nightshift_run_startup_command" ]] || __nightshift_remaining+=("$__nightshift_item")
      done
      PROMPT_COMMAND=("\${__nightshift_remaining[@]+"\${__nightshift_remaining[@]}"}")
    else
      for __nightshift_item in "\${__nightshift_prompt_command_suffix[@]+"\${__nightshift_prompt_command_suffix[@]}"}"; do
        [[ "$__nightshift_item" == "__nightshift_run_startup_command" ]] || __nightshift_remaining+=("$__nightshift_item")
      done
      __nightshift_prompt_command_suffix=("\${__nightshift_remaining[@]+"\${__nightshift_remaining[@]}"}")
    fi
  }
  __nightshift_run_startup_command() {
    local __nightshift_command="$${POSIX_SHELL_STARTUP_COMMAND_ENV}" __nightshift_status
    unset ${POSIX_SHELL_STARTUP_COMMAND_ENV}
    __nightshift_remove_startup_command_prompt_hook
    unset -f __nightshift_remove_startup_command_prompt_hook
    builtin history -s "$__nightshift_command" 2>/dev/null || true
    builtin printf '%s\n' "$__nightshift_command"
    eval "$__nightshift_command"
    __nightshift_status=$?
    unset -f __nightshift_run_startup_command
    return "$__nightshift_status"
  }
  __nightshift_append_prompt_command "__nightshift_run_startup_command"
fi`
}
