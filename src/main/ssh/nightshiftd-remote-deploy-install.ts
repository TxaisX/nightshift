/**
 * Pre-activation steps for `deployNightshiftd`: getting the candidate's bytes onto the host,
 * and snapshotting the data root before anything about to run is stopped. Split out of
 * `nightshiftd-remote-deploy.ts` to stay under the file's line budget; behaviour is unchanged,
 * this is a pure move.
 */
import { execCommand } from './ssh-relay-deploy-helpers'
import { NIGHTSHIFTD_INSTALL_MODEL } from './remote-install-model'
import { acquireInstallLock } from './ssh-relay-install-lock'
import { uploadRelayDirectory, writeRelayFile } from './ssh-relay-install-transfers'
import {
  abandonInstall,
  finalizeInstall,
  isRemoteInstallComplete
} from './ssh-relay-versioned-install'
import { RELAY_REMOTE_DIR } from './relay-protocol'
import {
  NIGHTSHIFTD_STATE_SNAPSHOT_DIR,
  type NightshiftdStateSnapshot
} from './nightshiftd-activation-record'
import {
  captureNightshiftdStateSnapshotCommand,
  nightshiftdSnapshotDirName,
  parseNightshiftdSnapshotCapture
} from './nightshiftd-state-snapshot'
import { joinRemotePath } from './ssh-remote-platform'
import type { NightshiftdDeployOptions } from './nightshiftd-remote-deploy'

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
export async function installNightshiftdBundle(
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

export async function captureSnapshot(
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
