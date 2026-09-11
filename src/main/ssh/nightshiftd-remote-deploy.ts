/**
 * Installing nightshiftd on a host and, only if it proves itself, making it the active one.
 *
 * The install half is the relay's transaction, parameterized: the same per-version lock,
 * staged SFTP write, `.install-complete` sentinel and stale-lock recovery, under
 * `nightshiftd-<version>/` instead of `relay-<version>/`. That is what §02 marks reusable.
 *
 * The activation half has no relay equivalent, because the relay has no notion of a version
 * being *selected*. Bytes landing in a versioned directory neither picks a version nor rolls
 * one back; the activation record does, and it is written only after the candidate publishes
 * a health payload that survives `evaluateNightshiftdActivation`. A rejected candidate leaves the
 * previous version running and its own bytes on disk — nothing is lost, and a retry costs no
 * upload.
 */
import type { SshConnection } from './ssh-connection'
import { execCommand } from './ssh-relay-deploy-helpers'
import { NIGHTSHIFTD_INSTALL_MODEL } from './remote-install-model'
import { acquireInstallLock } from './ssh-relay-install-lock'
import { uploadRelayDirectory, writeRelayFile } from './ssh-relay-install-transfers'
import {
  abandonInstall,
  computeRemoteInstallDir,
  finalizeInstall,
  isRemoteInstallComplete,
  readLocalFullVersion
} from './ssh-relay-versioned-install'
import { RELAY_REMOTE_DIR } from './relay-protocol'
import {
  NIGHTSHIFTD_STATE_SNAPSHOT_DIR,
  serializeNightshiftdActivationRecord,
  withActivatedVersion,
  type NightshiftdActivationRecord,
  type NightshiftdStateSnapshot
} from './nightshiftd-activation-record'
import {
  nightshiftdActivationPath,
  readNightshiftdActivationRecord
} from './nightshiftd-activation-record-store'
import {
  evaluateNightshiftdActivation,
  type NightshiftdActivationVerdict
} from './nightshiftd-activation-gate'
import { planNightshiftdUpdate, type NightshiftdTerminalCensus } from './nightshiftd-update-plan'
import {
  NIGHTSHIFTD_LOG_FILENAME,
  nightshiftdLaunchCommand,
  parseNightshiftdReadinessOutput,
  readNightshiftdReadinessCommand,
  type NightshiftdLaunchSpec
} from './nightshiftd-remote-launch'
import {
  captureNightshiftdStateSnapshotCommand,
  nightshiftdSnapshotDirName,
  parseNightshiftdSnapshotCapture
} from './nightshiftd-state-snapshot'
import {
  nightshiftdStopFreedTheHost,
  parseNightshiftdStopOutcome,
  stopNightshiftdCommand
} from './nightshiftd-remote-process-control'
import { joinRemotePath, type RemoteHostPlatform } from './ssh-remote-platform'
import { computeLocalNightshiftdBuildHash } from './nightshiftd-local-build-hash'

export type NightshiftdDeployOptions = {
  conn: SshConnection
  host: RemoteHostPlatform
  remoteHome: string
  /** Local `out/nightshiftd`, containing the artifacts and the `.version` marker. */
  localNightshiftdDir: string
  nodePath: string
  userDataDir: string
  bindHost: string
  port: number
  /**
   * Live-terminal counts, supplied by the caller from the runtime it is already connected
   * to. Not probed here: counting the daemon's sessions needs its protocol, and a deploy
   * that guessed zero from silence would be the "loss of contact means death" mistake.
   */
  census: NightshiftdTerminalCensus
  force?: boolean
  readinessTimeoutMs?: number
  now?: () => Date
  sleep?: (ms: number) => Promise<void>
  signal?: AbortSignal
}

export type NightshiftdDeployResult =
  | {
      outcome: 'installed-and-activated'
      fullVersion: string
      verdict: NightshiftdActivationVerdict
    }
  | { outcome: 'already-active'; fullVersion: string }
  | { outcome: 'installed-not-activated'; fullVersion: string; code: string; reason: string }

const DEFAULT_READINESS_TIMEOUT_MS = 90_000
const READINESS_POLL_MS = 500
const STOP_WAIT_SECONDS = 20

function exec(
  options: NightshiftdDeployOptions,
  command: string,
  signal = options.signal
): Promise<string> {
  return execCommand(options.conn, command, {
    wrapCommand: options.host.commandDialect !== 'powershell',
    signal
  })
}

function baseDir(options: NightshiftdDeployOptions): string {
  return joinRemotePath(options.host, options.remoteHome, RELAY_REMOTE_DIR)
}

/** Install the bytes under `nightshiftd-<version>/`, using the relay's install transaction. */
async function installNightshiftdBundle(
  options: NightshiftdDeployOptions,
  fullVersion: string,
  remoteDir: string
): Promise<void> {
  if (
    await isRemoteInstallComplete(
      options.conn,
      NIGHTSHIFTD_INSTALL_MODEL,
      remoteDir,
      options.host,
      {
        signal: options.signal
      }
    )
  ) {
    return
  }
  await acquireInstallLock(options.conn, remoteDir, options.host, { signal: options.signal })
  try {
    // Re-probe under the lock: a sibling deploy may have finished while we waited.
    if (
      await isRemoteInstallComplete(
        options.conn,
        NIGHTSHIFTD_INSTALL_MODEL,
        remoteDir,
        options.host,
        {
          signal: options.signal
        }
      )
    ) {
      return
    }
    await uploadRelayDirectory(options.conn, options.localNightshiftdDir, remoteDir, options.host, {
      signal: options.signal
    })
    await writeRelayFile(
      options.conn,
      options.host,
      joinRemotePath(options.host, remoteDir, NIGHTSHIFTD_INSTALL_MODEL.versionFilename),
      fullVersion,
      { signal: options.signal }
    )
    await finalizeInstall(options.conn, remoteDir, options.host, { signal: options.signal })
  } catch (error) {
    // Leave a recoverable partial rather than a dir that probes complete.
    await abandonInstall(options.conn, remoteDir, options.host)
    throw error
  }
}

async function captureSnapshot(
  options: NightshiftdDeployOptions,
  fullVersion: string,
  outgoingVersion: string | null,
  takenAt: Date
): Promise<NightshiftdStateSnapshot | null> {
  const dirName = nightshiftdSnapshotDirName(fullVersion, takenAt.getTime())
  const snapshotDir = joinRemotePath(
    options.host,
    baseDir(options),
    NIGHTSHIFTD_STATE_SNAPSHOT_DIR,
    dirName
  )
  const capture = parseNightshiftdSnapshotCapture(
    await exec(
      options,
      captureNightshiftdStateSnapshotCommand(options.host, options.userDataDir, snapshotDir)
    )
  )
  if (capture === 'failed') {
    throw new Error(
      `Could not snapshot ${options.userDataDir} before activating ${fullVersion}. Nightshift's ` +
        'persisted state carries no schema version, so without a snapshot a rollback has no ' +
        'way back. Refusing to activate.'
    )
  }
  if (capture === 'empty') {
    // Nothing on the host to lose: a first deployment. Rollback will correctly report that
    // it has no snapshot, rather than restoring an archive of nothing over a populated root.
    return null
  }
  return {
    dirName,
    takenBeforeVersion: fullVersion,
    readableByVersion: outgoingVersion,
    takenAt: takenAt.toISOString()
  }
}

async function launchAndAwaitReadiness(
  options: NightshiftdDeployOptions,
  spec: NightshiftdLaunchSpec
): Promise<ReturnType<typeof parseNightshiftdReadinessOutput>> {
  await exec(options, nightshiftdLaunchCommand(options.host, spec))
  const deadline = Date.now() + (options.readinessTimeoutMs ?? DEFAULT_READINESS_TIMEOUT_MS)
  const sleep = options.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)))
  let last = parseNightshiftdReadinessOutput('')
  while (Date.now() < deadline) {
    options.signal?.throwIfAborted()
    last = parseNightshiftdReadinessOutput(
      await exec(options, readNightshiftdReadinessCommand(options.host, spec.remoteInstallDir))
    )
    if (last.state !== 'pending') {
      return last
    }
    await sleep(READINESS_POLL_MS)
  }
  return last
}

/**
 * Put the previous version back after a rejected candidate.
 *
 * Why this exists at all: activating means swapping which process owns the data root and the
 * port, so the incumbent has to stop before the candidate can start. A gate that rejected
 * and returned would leave the host with nothing running — a careful deploy causing the
 * outage it was being careful about. The returned sentence goes into the caller's reason so
 * the operator learns the host's actual state, not just why the candidate failed.
 */
async function restoreIncumbent(
  options: NightshiftdDeployOptions,
  record: NightshiftdActivationRecord,
  candidateDir: string
): Promise<string> {
  const stopped = parseNightshiftdStopOutcome(
    await exec(
      options,
      stopNightshiftdCommand(options.host, candidateDir, { waitSeconds: STOP_WAIT_SECONDS })
    )
  )
  if (!nightshiftdStopFreedTheHost(stopped)) {
    return `The candidate itself did not stop (${stopped}); the host may still be serving the rejected build.`
  }
  if (!record.active) {
    return 'No previous version was active, so this host is now serving nothing.'
  }
  const incumbentDir = computeRemoteInstallDir(
    NIGHTSHIFTD_INSTALL_MODEL,
    options.remoteHome,
    record.active
  )
  const parsed = await launchAndAwaitReadiness(options, {
    remoteInstallDir: incumbentDir,
    nodePath: options.nodePath,
    fullVersion: record.active,
    userDataDir: options.userDataDir,
    bindHost: options.bindHost,
    port: options.port
  })
  return parsed.state === 'ready'
    ? `nightshiftd ${record.active} was restarted and is serving again.`
    : `nightshiftd ${record.active} was relaunched but has not published readiness; this host may be down.`
}

/**
 * Install, then activate only on a green cross-process health verdict.
 *
 * Every early return past the install leaves the bytes on disk and the previous version
 * serving, which is why they all report `installed-not-activated` rather than throwing: a
 * refusal to switch is a successful outcome of a deploy that was asked to be careful.
 */
export async function deployNightshiftd(
  options: NightshiftdDeployOptions
): Promise<NightshiftdDeployResult> {
  const now = options.now ?? ((): Date => new Date())
  const fullVersion = readLocalFullVersion(options.localNightshiftdDir)
  const remoteDir = computeRemoteInstallDir(
    NIGHTSHIFTD_INSTALL_MODEL,
    options.remoteHome,
    fullVersion
  )
  const record = await readNightshiftdActivationRecord(options)

  await installNightshiftdBundle(options, fullVersion, remoteDir)

  const plan = planNightshiftdUpdate({
    record,
    candidateVersion: fullVersion,
    census: options.census,
    ...(options.force !== undefined ? { force: options.force } : {})
  })
  if (plan.action === 'noop') {
    return { outcome: 'already-active', fullVersion }
  }
  if (plan.action === 'defer') {
    return {
      outcome: 'installed-not-activated',
      fullVersion,
      code: plan.code,
      reason: plan.reason
    }
  }

  const snapshot = record.active
    ? await captureSnapshot(options, fullVersion, record.active, now())
    : null

  if (record.active) {
    const outgoingDir = computeRemoteInstallDir(
      NIGHTSHIFTD_INSTALL_MODEL,
      options.remoteHome,
      record.active
    )
    const stopped = parseNightshiftdStopOutcome(
      await exec(
        options,
        stopNightshiftdCommand(options.host, outgoingDir, {
          waitSeconds: STOP_WAIT_SECONDS
        })
      )
    )
    if (!nightshiftdStopFreedTheHost(stopped)) {
      return {
        outcome: 'installed-not-activated',
        fullVersion,
        code: 'nightshiftd_outgoing_stop_incomplete',
        reason:
          `nightshiftd ${record.active} did not exit within ${STOP_WAIT_SECONDS}s of SIGTERM ` +
          `(${stopped}). It is still holding the data root and the port, so the candidate ` +
          'cannot start. Not escalating to SIGKILL: that skips the shutdown that releases ' +
          'the instance lock, and the successor would then refuse to start.'
      }
    }
  }

  const parsed = await launchAndAwaitReadiness(options, {
    remoteInstallDir: remoteDir,
    nodePath: options.nodePath,
    fullVersion,
    userDataDir: options.userDataDir,
    bindHost: options.bindHost,
    port: options.port
  })
  const verdict = evaluateNightshiftdActivation(
    parsed.state === 'ready' ? parsed.readiness : null,
    {
      buildHash: computeLocalNightshiftdBuildHash(options.localNightshiftdDir),
      fullVersion
    }
  )
  if (verdict.decision === 'reject') {
    const restored = await restoreIncumbent(options, record, remoteDir)
    return {
      outcome: 'installed-not-activated',
      fullVersion,
      code: verdict.code,
      reason:
        `${verdict.reason} Candidate stderr is at ` +
        `${joinRemotePath(options.host, remoteDir, NIGHTSHIFTD_LOG_FILENAME)}. ${restored}`
    }
  }

  await writeRelayFile(
    options.conn,
    options.host,
    nightshiftdActivationPath(options.host, options.remoteHome),
    serializeNightshiftdActivationRecord(
      withActivatedVersion(record, fullVersion, snapshot, now())
    ),
    { signal: options.signal }
  )
  return { outcome: 'installed-and-activated', fullVersion, verdict }
}
