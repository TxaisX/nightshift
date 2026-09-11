import { describe, expect, it } from 'vitest'
import { isAgentHookEndpointFileName, parseAgentHookEndpointFile } from './agent-hook-endpoint-file'

describe('agent hook endpoint files', () => {
  it('recognizes POSIX and Windows endpoint file names', () => {
    expect(isAgentHookEndpointFileName('endpoint.env')).toBe(true)
    expect(isAgentHookEndpointFileName('endpoint.cmd')).toBe(true)
    expect(isAgentHookEndpointFileName('endpoint.ps1')).toBe(false)
  })

  it('parses POSIX endpoint.env contents', () => {
    expect(
      parseAgentHookEndpointFile(
        [
          'NIGHTSHIFT_AGENT_HOOK_PORT=12345',
          'NIGHTSHIFT_AGENT_HOOK_TOKEN=token-123',
          'NIGHTSHIFT_AGENT_HOOK_ENV=production',
          'NIGHTSHIFT_AGENT_HOOK_VERSION=1'
        ].join('\n')
      )
    ).toEqual({
      port: '12345',
      token: 'token-123',
      env: 'production',
      version: '1'
    })
  })

  it('parses Windows endpoint.cmd contents', () => {
    expect(
      parseAgentHookEndpointFile(
        [
          'set NIGHTSHIFT_AGENT_HOOK_PORT=54321',
          'set NIGHTSHIFT_AGENT_HOOK_TOKEN=token-abc',
          'set NIGHTSHIFT_AGENT_HOOK_ENV=development',
          'set NIGHTSHIFT_AGENT_HOOK_VERSION=1'
        ].join('\r\n')
      )
    ).toEqual({
      port: '54321',
      token: 'token-abc',
      env: 'development',
      version: '1'
    })
  })

  it('preserves equals signs in endpoint values', () => {
    expect(
      parseAgentHookEndpointFile(
        [
          'NIGHTSHIFT_AGENT_HOOK_PORT=12345',
          'NIGHTSHIFT_AGENT_HOOK_TOKEN=token=with=equals',
          'NIGHTSHIFT_AGENT_HOOK_ENV=production',
          'NIGHTSHIFT_AGENT_HOOK_VERSION=1'
        ].join('\n')
      ).token
    ).toBe('token=with=equals')
  })

  it('throws when required endpoint fields are missing', () => {
    expect(() => parseAgentHookEndpointFile('NIGHTSHIFT_AGENT_HOOK_PORT=12345')).toThrow(
      'Agent hook endpoint file is missing required fields'
    )
  })
})
