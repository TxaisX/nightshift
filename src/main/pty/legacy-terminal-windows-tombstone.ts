// Why: kept beside the POSIX tombstone so the generated wrapper text for every platform lives
// in one place, and so the shim-dir module stays under the max-lines limit.
//
// Keep percent signs out of every emitted `rem` line. cmd expands variables inside rem, so a
// comment mentioning %CD% substitutes the working directory into itself. That is harmless at top
// level -- verified on Windows 11 that rem does not re-parse the result, so a cwd of
// `C:\x&pwned&rem` did not execute anything -- but rem handles separators differently inside a
// parenthesized block, and this script now has some.
//
// Keep both templates ASCII-only, comments included. cmd.exe tracks its position in a batch file
// in bytes but advances by decoded character count, so every extra UTF-8 byte shifts the whole
// file: two em dashes in comments made cmd drop the first four characters of every line and the
// script died with "The syntax of the command is incorrect."

const WIN32_PASSTHROUGH_WRAPPER = String.raw`@echo off
rem Why explicit: bare setlocal inherits the caller's delayed-expansion state, and a parent shell
rem started with /V:ON made every PATH entry undergo ! expansion inside the loops below. A literal
rem !CD! entry then became the current directory and a planted git.cmd ran (exit 66), and a
rem legitimate directory whose name contains ! stopped resolving (exit 127). Both proven on
rem Windows 11; both disappear when the wrapper pins its own state.
setlocal DisableDelayedExpansion
set "nightshift_real=%NIGHTSHIFT_REAL___NIGHTSHIFT_UPPER_COMMAND__%"
set "nightshift_wrapper_dir=%~dp0"
set "nightshift_legacy_wrapper_dir=%NIGHTSHIFT_ATTRIBUTION_SHIM_DIR%"
set "nightshift_clean_path="
rem Why: holds a single separator so the trailing-separator tests below need neither a literal
rem backslash before a quote (which breaks cmd parsing) nor a sentinel character (which would
rem corrupt any path containing it). Comparisons append a dot so the separator is never
rem adjacent to a closing quote, which would break the parser exactly as a literal would.
set "nightshift_sep=\"
rem Why a subroutine, not an "if defined ... " one-liner: cmd expands a whole line before it
rem evaluates the condition, so the substring syntax below still runs against an unset variable
rem and leaves the line mangled. A CALL body is only parsed once it is reached.
rem Why here: the value cannot change mid-run, so normalize once rather than per PATH entry.
set "nightshift_legacy_norm="
if defined nightshift_legacy_wrapper_dir call :nightshift_normalize_legacy_dir
rem Why: an empty PATH leaves the substitution below with an unbalanced quote, which
rem desynchronizes cmd parsing for the rest of the file. Skip the line entirely instead.
if not defined PATH goto :nightshift_path_walked
rem Why the variable: CALL re-expands its own command line, so a PATH entry naming the current
rem directory through a percent expression would become that directory before the rooted check
rem below ever saw it, and the cwd would then be searched for __NIGHTSHIFT_COMMAND__. Proven on
rem Windows 11. The expression is spelled out only in the TypeScript comment above: cmd expands
rem percent signs inside rem, so writing one here would substitute a path into the comment.
for %%P in ("%PATH:;=" "%") do (
  set "nightshift_entry=%%~P"
  call :nightshift_append_path
)
:nightshift_path_walked
set "PATH=%nightshift_clean_path%"
set "NIGHTSHIFT_ENABLE_GIT_ATTRIBUTION="
set "NIGHTSHIFT_GIT_COMMIT_TRAILER="
set "NIGHTSHIFT_GH_PR_FOOTER="
set "NIGHTSHIFT_GH_ISSUE_FOOTER="
set "NIGHTSHIFT_ATTRIBUTION_SHIM_DIR="
set "NIGHTSHIFT_ATTRIBUTION_BYPASS="
set "NIGHTSHIFT_REAL_GIT="
set "NIGHTSHIFT_REAL_GH="
if defined nightshift_real for %%G in ("%nightshift_real%") do if /I "%%~dpG"=="%~dp0" set "nightshift_real="
rem Why: a captured path may be relative, and both "if exist" and the invocation resolve it
rem against the current directory, so an inherited .\__NIGHTSHIFT_COMMAND__.exe would run from the repo.
set "nightshift_probe=%nightshift_real%"
if defined nightshift_real call :nightshift_check_rooted
if defined nightshift_real if not defined nightshift_rooted set "nightshift_real="
rem Why: clear a captured path that no longer exists, or the PATH walk below is skipped.
if defined nightshift_real if not exist "%nightshift_real%" set "nightshift_real="
if defined nightshift_real goto run
rem Why: an unqualified Windows command lookup searches the current directory before PATH, so a
rem repository-local __NIGHTSHIFT_COMMAND__.exe would win. Walk the cleaned PATH ourselves instead.
if not defined nightshift_clean_path goto :nightshift_candidates_walked
for %%P in ("%nightshift_clean_path:;=" "%") do (
  set "nightshift_entry=%%~P"
  call :nightshift_try_candidate
)
:nightshift_candidates_walked
if not defined nightshift_real (
  echo Nightshift compatibility wrapper could not locate __NIGHTSHIFT_COMMAND__ on PATH. 1>&2
  exit /b 127
)
:run
"%nightshift_real%" %*
exit /b %ERRORLEVEL%

:nightshift_normalize_legacy_dir
rem Why the rooted test first: full-path expansion resolves a relative value against the current
rem directory, so a
rem relative NIGHTSHIFT_ATTRIBUTION_SHIM_DIR would let the cwd decide which PATH entry counts as the
rem legacy directory and get a legitimate one skipped. Leaving the normalized value unset makes
rem the reject subroutine below a no-op, which is the safe outcome.
set "nightshift_probe=%nightshift_legacy_wrapper_dir%"
call :nightshift_check_rooted
if not defined nightshift_rooted exit /b
for %%G in ("%nightshift_legacy_wrapper_dir%") do set "nightshift_legacy_norm=%%~fG"
rem Why: full-path expansion preserves a trailing separator; normalize before comparing.
if "%nightshift_legacy_norm:~-1%."=="%nightshift_sep%." set "nightshift_legacy_norm=%nightshift_legacy_norm:~0,-1%"
exit /b

:nightshift_check_rooted
rem Why: tested in pure batch on purpose. An external tool invoked here would itself be resolved
rem from the current directory, reintroducing the very hijack this guard exists to prevent.
rem Why nightshift_probe rather than an argument: see the CALL re-expansion note above.
set "nightshift_rooted="
rem Why: an unset probe would leave the substring syntax below unexpanded and mangle the line.
if not defined nightshift_probe exit /b
if "%nightshift_probe:~0,2%"=="\\" set "nightshift_rooted=1"
if "%nightshift_probe:~1,2%"==":\" set "nightshift_rooted=1"
if "%nightshift_probe:~1,2%"==":/" set "nightshift_rooted=1"
exit /b

:nightshift_try_candidate
if defined nightshift_real exit /b
if not defined nightshift_entry exit /b
rem Why: a relative entry resolves against the current directory, same exposure as an empty one.
set "nightshift_probe=%nightshift_entry%"
call :nightshift_check_rooted
if not defined nightshift_rooted exit /b
for %%G in ("%nightshift_entry%") do set "nightshift_candidate_dir=%%~fG"
rem Why: full-path expansion preserves a trailing separator, so without normalizing, the
rem self-exclusion below misses a wrapper-dir entry spelled with one and the wrapper resolves
rem to itself, looping forever.
if "%nightshift_candidate_dir:~-1%."=="%nightshift_sep%." set "nightshift_candidate_dir=%nightshift_candidate_dir:~0,-1%"
rem Why: the script-dir operator is rebound to this label inside CALL, so compare against the
rem cached wrapper dir captured at top level.
if /I "%nightshift_candidate_dir%\"=="%nightshift_wrapper_dir%" exit /b
if exist "%nightshift_candidate_dir%\__NIGHTSHIFT_COMMAND__.exe" set "nightshift_real=%nightshift_candidate_dir%\__NIGHTSHIFT_COMMAND__.exe"
if not defined nightshift_real if exist "%nightshift_candidate_dir%\__NIGHTSHIFT_COMMAND__.cmd" set "nightshift_real=%nightshift_candidate_dir%\__NIGHTSHIFT_COMMAND__.cmd"
if not defined nightshift_real if exist "%nightshift_candidate_dir%\__NIGHTSHIFT_COMMAND__.bat" set "nightshift_real=%nightshift_candidate_dir%\__NIGHTSHIFT_COMMAND__.bat"
exit /b

:nightshift_append_path
if not defined nightshift_entry exit /b
rem Why: the exported PATH is inherited by the real git and anything it spawns, so a relative
rem entry left here lets the current directory select those tools instead.
set "nightshift_probe=%nightshift_entry%"
call :nightshift_check_rooted
if not defined nightshift_rooted exit /b
for %%G in ("%nightshift_entry%") do set "nightshift_path_entry_dir=%%~fG"
rem Why: full-path expansion preserves a trailing separator; normalize before comparing.
if "%nightshift_path_entry_dir:~-1%."=="%nightshift_sep%." set "nightshift_path_entry_dir=%nightshift_path_entry_dir:~0,-1%"
set "nightshift_path_entry_dir=%nightshift_path_entry_dir%\"
if /I "%nightshift_path_entry_dir%"=="%nightshift_wrapper_dir%" exit /b
set "nightshift_skip_entry="
if defined nightshift_legacy_wrapper_dir call :nightshift_reject_legacy_dir
if defined nightshift_skip_entry exit /b
if defined nightshift_clean_path (set "nightshift_clean_path=%nightshift_clean_path%;%nightshift_entry%") else set "nightshift_clean_path=%nightshift_entry%"
exit /b

:nightshift_reject_legacy_dir
rem Why: an unrooted legacy dir leaves this unset, and comparing against a bare separator could
rem only ever misfire.
if not defined nightshift_legacy_norm exit /b
if /I "%nightshift_path_entry_dir%"=="%nightshift_legacy_norm%\" set "nightshift_skip_entry=1"
exit /b
`

const POWERSHELL_PASSTHROUGH_WRAPPER = String.raw`$ErrorActionPreference = 'Stop'
$commandName = '__NIGHTSHIFT_COMMAND__'
$realCommand = [Environment]::GetEnvironmentVariable('NIGHTSHIFT_REAL___NIGHTSHIFT_UPPER_COMMAND__')
$wrapperDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$legacyWrapperDir = $env:NIGHTSHIFT_ATTRIBUTION_SHIM_DIR
# Why both separators: the rooted-path test below accepts forward slashes, so a directory
# spelled with a trailing / would miss this lexical exclusion and the wrapper could recurse.
$wrapperDirs = @($wrapperDir, $legacyWrapperDir) | Where-Object { $_ } | ForEach-Object { $_.TrimEnd('\', '/') }
$env:PATH = (($env:PATH -split ';') | Where-Object {
  $pathEntry = $_
  # Why: the exported PATH is inherited by the real command and anything it spawns.
  $pathEntry -and ($pathEntry -match '^([A-Za-z]:[\\/]|\\\\)') -and -not ($wrapperDirs | Where-Object {
    [string]::Equals($_, $pathEntry.TrimEnd('\', '/'), [StringComparison]::OrdinalIgnoreCase)
  })
}) -join ';'
'NIGHTSHIFT_ENABLE_GIT_ATTRIBUTION', 'NIGHTSHIFT_GIT_COMMIT_TRAILER', 'NIGHTSHIFT_GH_PR_FOOTER', 'NIGHTSHIFT_GH_ISSUE_FOOTER', 'NIGHTSHIFT_ATTRIBUTION_SHIM_DIR', 'NIGHTSHIFT_REAL_GIT', 'NIGHTSHIFT_REAL_GH', 'NIGHTSHIFT_ATTRIBUTION_BYPASS' | ForEach-Object { Remove-Item "Env:$_" -ErrorAction SilentlyContinue }
# Why: a captured value may be relative, and Test-Path plus invocation resolve it against the cwd.
if ($realCommand -and $realCommand -notmatch '^([A-Za-z]:[\\/]|\\\\)') { $realCommand = $null }
if ($realCommand) {
  try {
    $capturedDir = Split-Path -Parent ([IO.Path]::GetFullPath($realCommand))
    if ([string]::Equals($capturedDir.TrimEnd('\', '/'), $wrapperDir.TrimEnd('\', '/'), [StringComparison]::OrdinalIgnoreCase)) {
      $realCommand = $null
    }
  } catch {
    $realCommand = $null
  }
}
if (-not $realCommand -or -not (Test-Path -LiteralPath $realCommand)) {
  # Why: resolve only against the cleaned PATH directories. Ambient lookup could pick up a
  # repository-local git.exe/gh.exe from the current directory.
  $realCommand = $null
  foreach ($dir in ($env:PATH -split ';')) {
    if (-not $dir) { continue }
    # Why: a relative entry resolves against the current directory, same exposure as an empty one.
    # IsPathRooted is not enough: it accepts drive-relative 'C:foo', which resolves against the
    # current directory on that drive. IsPathFullyQualified is absent on Windows PowerShell 5.1,
    # so match the same prefixes the cmd wrapper accepts.
    if ($dir -notmatch '^([A-Za-z]:[\\/]|\\\\)') { continue }
    if ($wrapperDirs | Where-Object { [string]::Equals($_, $dir.TrimEnd('\', '/'), [StringComparison]::OrdinalIgnoreCase) }) { continue }
    foreach ($ext in @('.exe', '.cmd', '.bat')) {
      $candidate = Join-Path $dir "$commandName$ext"
      if (Test-Path -LiteralPath $candidate -PathType Leaf) { $realCommand = $candidate; break }
    }
    if ($realCommand) { break }
  }
}
if (-not $realCommand) {
  [Console]::Error.WriteLine("Nightshift compatibility wrapper could not locate $commandName on PATH.")
  exit 127
}
& $realCommand @args
exit $LASTEXITCODE
`

function renderWindowsWrapper(template: string, command: string, upperCommand: string): string {
  return template
    .replaceAll('__NIGHTSHIFT_UPPER_COMMAND__', upperCommand)
    .replaceAll('__NIGHTSHIFT_COMMAND__', command)
}

// Why: cmd locates `call :label` targets by byte offset and that lookup is unreliable in
// LF-only files — the same script worked at 2.4 KB and failed with "cannot find the batch label"
// once it grew. Emit CRLF, which is what cmd expects.
function toCrlf(text: string): string {
  return text.replaceAll('\r\n', '\n').replaceAll('\n', '\r\n')
}

export function renderLegacyTerminalWindowsCmdTombstone(command: 'git' | 'gh'): string {
  return toCrlf(renderWindowsWrapper(WIN32_PASSTHROUGH_WRAPPER, command, command.toUpperCase()))
}

export function renderLegacyTerminalWindowsPowerShellTombstone(command: 'git' | 'gh'): string {
  return toCrlf(
    renderWindowsWrapper(POWERSHELL_PASSTHROUGH_WRAPPER, command, command.toUpperCase())
  )
}
