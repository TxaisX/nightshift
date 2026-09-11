import { describe, expect, it } from 'vitest'
import {
  appendNightshiftRpcOutput,
  resolveNightshiftCliCommand,
  resolveNightshiftCliInvocation
} from './live-remote-freeze-rpc.mjs'

describe('live remote freeze RPC', () => {
  it('resolves the Nightshift CLI for managed, dev, Linux, and default runtimes', () => {
    expect(
      resolveNightshiftCliCommand({ env: { NIGHTSHIFT_CLI_COMMAND: 'custom-nightshift' } })
    ).toBe('custom-nightshift')
    expect(resolveNightshiftCliCommand({ env: { NIGHTSHIFT_DEV_REPO_ROOT: '/repo' } })).toBe(
      'nightshift-dev'
    )
    expect(resolveNightshiftCliCommand({ env: {}, platform: 'linux' })).toBe('nightshift-ide')
    expect(resolveNightshiftCliCommand({ env: {}, platform: 'win32' })).toBe('nightshift')
  })

  it('bypasses the Windows dev cmd shim with the built Node CLI', () => {
    const invocation = resolveNightshiftCliInvocation({
      env: {
        APPDATA: 'C:\\Users\\dev\\AppData\\Roaming',
        NIGHTSHIFT_CLI_COMMAND: 'C:\\repo\\out\\bin\\nightshift-dev.cmd',
        NIGHTSHIFT_DEV_REPO_ROOT: 'C:\\repo'
      },
      platform: 'win32',
      nodeExecutable: 'C:\\Program Files\\nodejs\\node.exe'
    })

    expect(invocation).toMatchObject({
      command: 'C:\\Program Files\\nodejs\\node.exe',
      prefixArgs: ['C:\\repo\\out\\cli\\index.js'],
      env: {
        NIGHTSHIFT_USER_DATA_PATH: 'C:\\Users\\dev\\AppData\\Roaming\\nightshift-dev',
        NIGHTSHIFT_DEV_CLI_INVOCATION: '1',
        NIGHTSHIFT_APP_EXECUTABLE: 'C:\\repo\\node_modules\\electron\\dist\\electron.exe',
        NIGHTSHIFT_APP_EXECUTABLE_NEEDS_APP_ROOT: '1'
      }
    })
  })

  it('caps combined asynchronous output before retaining the overflow chunk', () => {
    const first = appendNightshiftRpcOutput('', '1234', 0, 5)
    expect(first).toEqual({ output: '1234', bytes: 4, exceeded: false })

    const overflow = appendNightshiftRpcOutput(first.output, '67', first.bytes, 5)
    expect(overflow).toEqual({ output: '1234', bytes: 6, exceeded: true })
  })
})
