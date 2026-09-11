// Why: the pty IPC suites force darwin and rewrite a dozen agent-home env vars per test;
// this scope captures the real values once and puts them back afterwards.
export function createPtyIpcProcessEnvScope() {
  const savedOpenCodeConfigDir = process.env.OPENCODE_CONFIG_DIR
  const savedNightshiftOpenCodeConfigDir = process.env.NIGHTSHIFT_OPENCODE_CONFIG_DIR
  const savedNightshiftOpenCodeSourceConfigDir = process.env.NIGHTSHIFT_OPENCODE_SOURCE_CONFIG_DIR
  const savedPiAgentDir = process.env.PI_CODING_AGENT_DIR
  const savedNightshiftPiAgentDir = process.env.NIGHTSHIFT_PI_CODING_AGENT_DIR
  const savedNightshiftPiSourceAgentDir = process.env.NIGHTSHIFT_PI_SOURCE_AGENT_DIR
  const savedNightshiftCodexHome = process.env.NIGHTSHIFT_CODEX_HOME
  const savedNightshiftOmpAgentDir = process.env.NIGHTSHIFT_OMP_CODING_AGENT_DIR
  const savedNightshiftOmpSourceAgentDir = process.env.NIGHTSHIFT_OMP_SOURCE_AGENT_DIR
  const savedNightshiftOmpStatusExtension = process.env.NIGHTSHIFT_OMP_STATUS_EXTENSION
  const savedPrimeAgentDir = process.env.PRIME_AGENT_CODING_AGENT_DIR
  const savedNightshiftPrimeAgentSourceDir = process.env.NIGHTSHIFT_PRIME_AGENT_SOURCE_AGENT_DIR
  const savedNightshiftPrimeAgentStatusExtension =
    process.env.NIGHTSHIFT_PRIME_AGENT_STATUS_EXTENSION
  const savedNightshiftClaudeAgentStatusSettings =
    process.env.NIGHTSHIFT_CLAUDE_AGENT_STATUS_SETTINGS
  const savedProcessPlatform = Object.getOwnPropertyDescriptor(process, 'platform')
  const savedDisableMacosLoginShell = process.env.NIGHTSHIFT_DISABLE_MACOS_LOGIN_SHELL
  const savedNightshiftUserDataPath = process.env.NIGHTSHIFT_USER_DATA_PATH

  function applyTestEnvDefaults() {
    // Why: most PTY spawn tests assert POSIX shell behavior; Windows cases opt into win32 explicitly below.
    Object.defineProperty(process, 'platform', {
      configurable: true,
      value: 'darwin'
    })
    // Why: forced darwin makes the TCC login(1) wrapper rewrite every asserted argv; its own test below re-enables it.
    process.env.NIGHTSHIFT_DISABLE_MACOS_LOGIN_SHELL = '1'
    delete process.env.OPENCODE_CONFIG_DIR
    delete process.env.NIGHTSHIFT_OPENCODE_SOURCE_CONFIG_DIR
    delete process.env.NIGHTSHIFT_OPENCODE_CONFIG_DIR
    delete process.env.NIGHTSHIFT_AGENT_HOOK_ENDPOINT
    delete process.env.NIGHTSHIFT_CLAUDE_AGENT_STATUS_SETTINGS
    delete process.env.PI_CODING_AGENT_DIR
    delete process.env.NIGHTSHIFT_PI_SOURCE_AGENT_DIR
    delete process.env.NIGHTSHIFT_PI_CODING_AGENT_DIR
    delete process.env.NIGHTSHIFT_CODEX_HOME
    delete process.env.NIGHTSHIFT_OMP_SOURCE_AGENT_DIR
    delete process.env.NIGHTSHIFT_OMP_CODING_AGENT_DIR
    delete process.env.NIGHTSHIFT_OMP_STATUS_EXTENSION
    delete process.env.PRIME_AGENT_CODING_AGENT_DIR
    delete process.env.NIGHTSHIFT_PRIME_AGENT_SOURCE_AGENT_DIR
    delete process.env.NIGHTSHIFT_PRIME_AGENT_STATUS_EXTENSION
  }

  function restoreProcessEnv() {
    if (savedProcessPlatform) {
      Object.defineProperty(process, 'platform', savedProcessPlatform)
    }
    if (savedDisableMacosLoginShell !== undefined) {
      process.env.NIGHTSHIFT_DISABLE_MACOS_LOGIN_SHELL = savedDisableMacosLoginShell
    } else {
      delete process.env.NIGHTSHIFT_DISABLE_MACOS_LOGIN_SHELL
    }
    if (savedNightshiftUserDataPath !== undefined) {
      process.env.NIGHTSHIFT_USER_DATA_PATH = savedNightshiftUserDataPath
    } else {
      delete process.env.NIGHTSHIFT_USER_DATA_PATH
    }
    if (savedOpenCodeConfigDir !== undefined) {
      process.env.OPENCODE_CONFIG_DIR = savedOpenCodeConfigDir
    } else {
      delete process.env.OPENCODE_CONFIG_DIR
    }
    if (savedNightshiftOpenCodeConfigDir !== undefined) {
      process.env.NIGHTSHIFT_OPENCODE_CONFIG_DIR = savedNightshiftOpenCodeConfigDir
    } else {
      delete process.env.NIGHTSHIFT_OPENCODE_CONFIG_DIR
    }
    if (savedNightshiftOpenCodeSourceConfigDir !== undefined) {
      process.env.NIGHTSHIFT_OPENCODE_SOURCE_CONFIG_DIR = savedNightshiftOpenCodeSourceConfigDir
    } else {
      delete process.env.NIGHTSHIFT_OPENCODE_SOURCE_CONFIG_DIR
    }
    if (savedPiAgentDir !== undefined) {
      process.env.PI_CODING_AGENT_DIR = savedPiAgentDir
    } else {
      delete process.env.PI_CODING_AGENT_DIR
    }
    if (savedNightshiftPiAgentDir !== undefined) {
      process.env.NIGHTSHIFT_PI_CODING_AGENT_DIR = savedNightshiftPiAgentDir
    } else {
      delete process.env.NIGHTSHIFT_PI_CODING_AGENT_DIR
    }
    if (savedNightshiftPiSourceAgentDir === undefined) {
      delete process.env.NIGHTSHIFT_PI_SOURCE_AGENT_DIR
    } else {
      process.env.NIGHTSHIFT_PI_SOURCE_AGENT_DIR = savedNightshiftPiSourceAgentDir
    }
    if (savedNightshiftCodexHome === undefined) {
      delete process.env.NIGHTSHIFT_CODEX_HOME
    } else {
      process.env.NIGHTSHIFT_CODEX_HOME = savedNightshiftCodexHome
    }
    if (savedNightshiftOmpAgentDir !== undefined) {
      process.env.NIGHTSHIFT_OMP_CODING_AGENT_DIR = savedNightshiftOmpAgentDir
    } else {
      delete process.env.NIGHTSHIFT_OMP_CODING_AGENT_DIR
    }
    if (savedNightshiftOmpSourceAgentDir !== undefined) {
      process.env.NIGHTSHIFT_OMP_SOURCE_AGENT_DIR = savedNightshiftOmpSourceAgentDir
    } else {
      delete process.env.NIGHTSHIFT_OMP_SOURCE_AGENT_DIR
    }
    if (savedNightshiftOmpStatusExtension !== undefined) {
      process.env.NIGHTSHIFT_OMP_STATUS_EXTENSION = savedNightshiftOmpStatusExtension
    } else {
      delete process.env.NIGHTSHIFT_OMP_STATUS_EXTENSION
    }
    if (savedPrimeAgentDir !== undefined) {
      process.env.PRIME_AGENT_CODING_AGENT_DIR = savedPrimeAgentDir
    } else {
      delete process.env.PRIME_AGENT_CODING_AGENT_DIR
    }
    if (savedNightshiftPrimeAgentSourceDir !== undefined) {
      process.env.NIGHTSHIFT_PRIME_AGENT_SOURCE_AGENT_DIR = savedNightshiftPrimeAgentSourceDir
    } else {
      delete process.env.NIGHTSHIFT_PRIME_AGENT_SOURCE_AGENT_DIR
    }
    if (savedNightshiftPrimeAgentStatusExtension !== undefined) {
      process.env.NIGHTSHIFT_PRIME_AGENT_STATUS_EXTENSION = savedNightshiftPrimeAgentStatusExtension
    } else {
      delete process.env.NIGHTSHIFT_PRIME_AGENT_STATUS_EXTENSION
    }
    if (savedNightshiftClaudeAgentStatusSettings === undefined) {
      delete process.env.NIGHTSHIFT_CLAUDE_AGENT_STATUS_SETTINGS
    } else {
      process.env.NIGHTSHIFT_CLAUDE_AGENT_STATUS_SETTINGS = savedNightshiftClaudeAgentStatusSettings
    }
  }

  return { applyTestEnvDefaults, restoreProcessEnv }
}
