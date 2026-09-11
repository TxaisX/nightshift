import { describe, expect, it } from 'vitest'
import {
  bindHostIsNetworkExposed,
  describeNightshiftdBindExposure,
  NIGHTSHIFTD_LOOPBACK_BIND_HOST,
  NightshiftdBindAddressError,
  resolveNightshiftdBindHost
} from './nightshiftd-bind-address'

describe('resolveNightshiftdBindHost', () => {
  it('defaults to loopback when the operator asked for nothing', () => {
    expect(resolveNightshiftdBindHost()).toBe(NIGHTSHIFTD_LOOPBACK_BIND_HOST)
    expect(NIGHTSHIFTD_LOOPBACK_BIND_HOST).toBe('127.0.0.1')
  })

  it('accepts literal IPv4 and IPv6 addresses, including explicit wide binds', () => {
    expect(resolveNightshiftdBindHost('0.0.0.0')).toBe('0.0.0.0')
    expect(resolveNightshiftdBindHost('10.1.2.3')).toBe('10.1.2.3')
    expect(resolveNightshiftdBindHost('::1')).toBe('::1')
    expect(resolveNightshiftdBindHost('localhost')).toBe('127.0.0.1')
    expect(resolveNightshiftdBindHost(' 127.0.0.1 ')).toBe('127.0.0.1')
  })

  it('refuses hostnames, because DNS would decide which interface got bound', () => {
    expect(() => resolveNightshiftdBindHost('internal.example')).toThrow(
      NightshiftdBindAddressError
    )
    expect(() => resolveNightshiftdBindHost('')).toThrow(NightshiftdBindAddressError)
    expect(() => resolveNightshiftdBindHost('0.0.0.0:80')).toThrow(NightshiftdBindAddressError)
  })
})

describe('bindHostIsNetworkExposed', () => {
  it('separates local-only addresses from network-reachable ones', () => {
    expect(bindHostIsNetworkExposed('127.0.0.1')).toBe(false)
    expect(bindHostIsNetworkExposed('127.5.5.5')).toBe(false)
    expect(bindHostIsNetworkExposed('::1')).toBe(false)
    expect(bindHostIsNetworkExposed('0.0.0.0')).toBe(true)
    expect(bindHostIsNetworkExposed('::')).toBe(true)
    expect(bindHostIsNetworkExposed('10.1.2.3')).toBe(true)
  })

  it('says out loud when a deployment is reachable from the network', () => {
    expect(describeNightshiftdBindExposure('0.0.0.0')).toContain('reachable from the network')
    expect(describeNightshiftdBindExposure('127.0.0.1')).toContain('local only')
  })
})
