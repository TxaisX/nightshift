/**
 * Runs the generated POSIX commands through a real `/bin/sh`.
 *
 * The unit tests assert on command *text*, which is exactly the kind of test that stays
 * green while the shell it produces does not work — a quoting slip, a `case` pattern that
 * never matches, a `tar` invocation that silently captures nothing. These run the strings.
 */
import { execFileSync, spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  nightshiftdLivenessProbeCommand,
  NIGHTSHIFTD_PID_FILENAME,
  parseNightshiftdLiveness
} from './nightshiftd-remote-launch'
import {
  parseNightshiftdStopOutcome,
  stopNightshiftdCommand
} from './nightshiftd-remote-process-control'
import {
  captureNightshiftdStateSnapshotCommand,
  newestStateMtimeCommand,
  parseNewestStateMtimeSeconds,
  parseNightshiftdSnapshotCapture,
  parseNightshiftdSnapshotRestore,
  probeNightshiftdStateSnapshotCommand,
  restoreNightshiftdStateSnapshotCommand
} from './nightshiftd-state-snapshot'
import { getRemoteHostPlatform } from './ssh-remote-platform'

const host = getRemoteHostPlatform('linux-x64')
let root = ''
let dataDir = ''
let snapshotDir = ''
let versionDir = ''

function sh(command: string): string {
  return execFileSync('/bin/sh', ['-c', command], { encoding: 'utf8' })
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'nightshiftd-shell-'))
  dataDir = join(root, '.nightshift')
  snapshotDir = join(root, 'snapshots', 'pre-0.2.0+bb01-1000')
  versionDir = join(root, '.nightshift-remote', 'nightshiftd-0.2.0+bb01')
  mkdirSync(join(dataDir, 'profiles', 'p1'), { recursive: true })
  mkdirSync(join(dataDir, 'daemon'), { recursive: true })
  mkdirSync(versionDir, { recursive: true })
  writeFileSync(join(dataDir, 'nightshift-profile-index.json'), '{"v":"before"}')
  writeFileSync(join(dataDir, 'profiles', 'p1', 'nightshift-data.json'), '{"repos":"before"}')
  writeFileSync(join(dataDir, 'daemon', 'daemon.sock.token'), 'live-daemon-token')
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('state snapshot commands, run for real', () => {
  it('captures, then restores state the newer build overwrote', () => {
    expect(
      parseNightshiftdSnapshotCapture(
        sh(captureNightshiftdStateSnapshotCommand(host, dataDir, snapshotDir))
      )
    ).toBe('captured')
    expect(sh(probeNightshiftdStateSnapshotCommand(host, snapshotDir)).trim()).toBe('PRESENT')

    // The new version migrates the store and adds a file of its own.
    writeFileSync(join(dataDir, 'nightshift-profile-index.json'), '{"v":"migrated"}')
    writeFileSync(join(dataDir, 'profiles', 'p1', 'new-build-only.json'), '{}')

    expect(
      parseNightshiftdSnapshotRestore(
        sh(restoreNightshiftdStateSnapshotCommand(host, dataDir, snapshotDir))
      )
    ).toBe('restored')
    expect(readFileSync(join(dataDir, 'nightshift-profile-index.json'), 'utf8')).toBe(
      '{"v":"before"}'
    )
    // Removed before extraction, so the older build never sees a file it cannot interpret.
    expect(() => readFileSync(join(dataDir, 'profiles', 'p1', 'new-build-only.json'))).toThrow()
  })

  it('leaves the live daemon runtime dir untouched through capture and restore', () => {
    sh(captureNightshiftdStateSnapshotCommand(host, dataDir, snapshotDir))
    // The daemon is running across the rollback and rewrites its token; a restore that
    // reached <root>/daemon would break the fence that keeps its terminals adoptable.
    writeFileSync(join(dataDir, 'daemon', 'daemon.sock.token'), 'token-after-restart')
    sh(restoreNightshiftdStateSnapshotCommand(host, dataDir, snapshotDir))
    expect(readFileSync(join(dataDir, 'daemon', 'daemon.sock.token'), 'utf8')).toBe(
      'token-after-restart'
    )
  })

  it('reports EMPTY on a data root with nothing to lose, instead of an archive of nothing', () => {
    const emptyRoot = join(root, 'fresh')
    mkdirSync(emptyRoot)
    expect(
      parseNightshiftdSnapshotCapture(
        sh(captureNightshiftdStateSnapshotCommand(host, emptyRoot, snapshotDir))
      )
    ).toBe('empty')
    expect(sh(probeNightshiftdStateSnapshotCommand(host, snapshotDir)).trim()).toBe('ABSENT')
  })

  it('reports MISSING rather than claiming a restore it did not perform', () => {
    expect(
      parseNightshiftdSnapshotRestore(
        sh(restoreNightshiftdStateSnapshotCommand(host, dataDir, join(root, 'nope')))
      )
    ).toBe('missing')
  })

  it('reads a real mtime for the store', () => {
    const seconds = parseNewestStateMtimeSeconds(sh(newestStateMtimeCommand(host, dataDir)))
    expect(seconds).toBeGreaterThan(1_600_000_000)
    expect(seconds).toBeLessThanOrEqual(Math.floor(Date.now() / 1000) + 5)
  })

  it('survives a data root whose path contains a quote and a space', () => {
    const nasty = join(root, `it's a dir`)
    mkdirSync(join(nasty, 'profiles'), { recursive: true })
    writeFileSync(join(nasty, 'nightshift-profile-index.json'), '{"v":"quoted"}')
    expect(
      parseNightshiftdSnapshotCapture(
        sh(captureNightshiftdStateSnapshotCommand(host, nasty, snapshotDir))
      )
    ).toBe('captured')
    writeFileSync(join(nasty, 'nightshift-profile-index.json'), '{"v":"changed"}')
    expect(
      parseNightshiftdSnapshotRestore(
        sh(restoreNightshiftdStateSnapshotCommand(host, nasty, snapshotDir))
      )
    ).toBe('restored')
    expect(readFileSync(join(nasty, 'nightshift-profile-index.json'), 'utf8')).toBe(
      '{"v":"quoted"}'
    )
  })
})

describe('liveness and stop commands, run for real', () => {
  it('reports UNKNOWN with no pid file, and DEAD for a pid that has exited', () => {
    expect(parseNightshiftdLiveness(sh(nightshiftdLivenessProbeCommand(host, versionDir)))).toBe(
      'UNKNOWN'
    )
    writeFileSync(join(versionDir, NIGHTSHIFTD_PID_FILENAME), 'not-a-pid')
    expect(parseNightshiftdLiveness(sh(nightshiftdLivenessProbeCommand(host, versionDir)))).toBe(
      'UNKNOWN'
    )
    // A pid that has certainly exited: our own `sh` child from the line above.
    const exited = Number(sh('sh -c "echo $$"').trim())
    writeFileSync(join(versionDir, NIGHTSHIFTD_PID_FILENAME), String(exited))
    expect(parseNightshiftdLiveness(sh(nightshiftdLivenessProbeCommand(host, versionDir)))).toBe(
      'DEAD'
    )
  })

  it('reports LIVE for a running process and stops it with SIGTERM', async () => {
    const child = spawn('/bin/sh', ['-c', 'sleep 30'], { stdio: 'ignore' })
    try {
      writeFileSync(join(versionDir, NIGHTSHIFTD_PID_FILENAME), String(child.pid))
      expect(parseNightshiftdLiveness(sh(nightshiftdLivenessProbeCommand(host, versionDir)))).toBe(
        'LIVE'
      )

      const exited = new Promise<NodeJS.Signals | null>((resolve) =>
        child.once('exit', (_code, signal) => resolve(signal))
      )
      expect(
        parseNightshiftdStopOutcome(
          sh(stopNightshiftdCommand(host, versionDir, { waitSeconds: 10 }))
        )
      ).toBe('stopped')
      expect(await exited).toBe('SIGTERM')
      expect(parseNightshiftdLiveness(sh(nightshiftdLivenessProbeCommand(host, versionDir)))).toBe(
        'DEAD'
      )
    } finally {
      child.kill('SIGKILL')
    }
  })

  // `kill -0` succeeds on a zombie, so a probe built on it alone calls an exited process
  // live: the stop loop would time out on a process that is already gone, and GC would keep
  // a dead version dir forever. Verified as a real macOS behaviour, not a hypothetical.
  it('reports a zombie as DEAD, not as a running process', () => {
    const child = spawn('/bin/sh', ['-c', 'exit 0'], { stdio: 'ignore' })
    try {
      writeFileSync(join(versionDir, NIGHTSHIFTD_PID_FILENAME), String(child.pid))
      // Block the event loop so Node never reaps it; the process is now a zombie.
      sh('sleep 1')
      expect(sh(`ps -o stat= -p ${child.pid} || echo GONE`).trim()).toMatch(/^Z/)
      expect(sh(`kill -0 ${child.pid} 2>/dev/null && echo LIVE || echo DEAD`).trim()).toBe('LIVE')
      expect(parseNightshiftdLiveness(sh(nightshiftdLivenessProbeCommand(host, versionDir)))).toBe(
        'DEAD'
      )
      expect(
        parseNightshiftdStopOutcome(
          sh(stopNightshiftdCommand(host, versionDir, { waitSeconds: 1 }))
        )
      ).toBe('already-exited')
    } finally {
      child.unref()
    }
  })

  it('reports ALREADY_EXITED for a stale pid file rather than signalling a stranger', () => {
    const exited = Number(sh('sh -c "echo $$"').trim())
    writeFileSync(join(versionDir, NIGHTSHIFTD_PID_FILENAME), String(exited))
    expect(
      parseNightshiftdStopOutcome(sh(stopNightshiftdCommand(host, versionDir, { waitSeconds: 1 })))
    ).toBe('already-exited')
  })

  it('reports NO_PID when the version dir was never launched', () => {
    expect(
      parseNightshiftdStopOutcome(sh(stopNightshiftdCommand(host, versionDir, { waitSeconds: 1 })))
    ).toBe('no-pid')
  })
})
