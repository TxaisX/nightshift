import { describe, expect, it } from 'vitest'

import {
  NIGHTSHIFTD_SNAPSHOT_EXCLUDED,
  NIGHTSHIFTD_SNAPSHOT_MEMBERS,
  captureNightshiftdStateSnapshotCommand,
  newestStateMtimeCommand,
  nightshiftdSnapshotDirName,
  parseNewestStateMtimeSeconds,
  parseNightshiftdSnapshotCapture,
  parseNightshiftdSnapshotRestore,
  restoreNightshiftdStateSnapshotCommand
} from './nightshiftd-state-snapshot'
import { getRemoteHostPlatform } from './ssh-remote-platform'

const posix = getRemoteHostPlatform('linux-x64')
const windows = getRemoteHostPlatform('win32-x64')
const ROOT = '/home/u/.nightshift'
const SNAP = '/home/u/.nightshift-remote/nightshiftd-state-snapshots/pre-0.2.0+bb01-1000'

describe('capturing the pre-activation snapshot', () => {
  it('captures the profile state a rollback needs', () => {
    const command = captureNightshiftdStateSnapshotCommand(posix, ROOT, SNAP)
    for (const member of NIGHTSHIFTD_SNAPSHOT_MEMBERS) {
      expect(command).toContain(`'${member}'`)
    }
  })

  // The live daemon owns <root>/daemon and outlives every restart. Restoring a stale copy of
  // its socket, PID record and token would break the fence that keeps its terminals adoptable.
  it.each(NIGHTSHIFTD_SNAPSHOT_EXCLUDED)('never captures %s', (excluded) => {
    expect(captureNightshiftdStateSnapshotCommand(posix, ROOT, SNAP)).not.toContain(`'${excluded}'`)
  })

  it.each(NIGHTSHIFTD_SNAPSHOT_EXCLUDED)('never removes or restores over %s', (excluded) => {
    expect(restoreNightshiftdStateSnapshotCommand(posix, ROOT, SNAP)).not.toContain(`'${excluded}'`)
  })

  it('writes the archive under a temp name and renames, so a killed deploy leaves no torn tar', () => {
    const command = captureNightshiftdStateSnapshotCommand(posix, ROOT, SNAP)
    expect(command).toContain('.partial')
    expect(command.indexOf('tar -C')).toBeLessThan(command.indexOf('mv '))
  })

  it.each([
    ['CAPTURED', 'captured'],
    ['EMPTY', 'empty'],
    ['tar: broken', 'failed'],
    ['', 'failed']
  ])('parses %s as %s', (output, expected) => {
    expect(parseNightshiftdSnapshotCapture(output)).toBe(expected)
  })

  it('keys the snapshot dir on both version and time, so a retry cannot overwrite one', () => {
    expect(nightshiftdSnapshotDirName('0.2.0+bb01', 1000)).not.toBe(
      nightshiftdSnapshotDirName('0.2.0+bb01', 2000)
    )
  })
})

describe('restoring the snapshot', () => {
  it('clears the members before extracting, so files the new build added do not survive', () => {
    const command = restoreNightshiftdStateSnapshotCommand(posix, ROOT, SNAP)
    expect(command.indexOf('rm -rf')).toBeLessThan(command.indexOf('tar -C'))
  })

  it('reports a missing archive instead of extracting nothing and claiming success', () => {
    expect(restoreNightshiftdStateSnapshotCommand(posix, ROOT, SNAP)).toContain('echo MISSING')
    expect(parseNightshiftdSnapshotRestore('MISSING')).toBe('missing')
    expect(parseNightshiftdSnapshotRestore('RESTORED')).toBe('restored')
    expect(parseNightshiftdSnapshotRestore('FAILED')).toBe('failed')
  })
})

describe('detecting writes since activation', () => {
  it.each([
    ['1700000000', 1_700_000_000],
    ['UNKNOWN', null],
    ['', null]
  ])('parses %s', (output, expected) => {
    expect(parseNewestStateMtimeSeconds(output)).toBe(expected)
  })

  it('looks at the same members the snapshot covers', () => {
    const command = newestStateMtimeCommand(posix, ROOT)
    for (const member of NIGHTSHIFTD_SNAPSHOT_MEMBERS) {
      expect(command).toContain(`'${member}'`)
    }
  })
})

describe('Windows hosts', () => {
  it.each([
    ['capture', () => captureNightshiftdStateSnapshotCommand(windows, ROOT, SNAP)],
    ['restore', () => restoreNightshiftdStateSnapshotCommand(windows, ROOT, SNAP)],
    ['mtime', () => newestStateMtimeCommand(windows, ROOT)]
  ])('refuses %s rather than emitting a POSIX command', (_label, build) => {
    expect(build).toThrow('nightshiftd to a Windows host is not implemented')
  })
})
