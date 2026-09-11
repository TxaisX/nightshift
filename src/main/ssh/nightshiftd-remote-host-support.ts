/**
 * Which hosts the nightshiftd launch/lifecycle path actually supports, declared rather than
 * discovered at runtime.
 *
 * The install transaction is host-agnostic — it is the relay's, and the relay runs on
 * Windows. The launch, liveness and stop path is not: it uses `nohup`, a redirected stdout,
 * `kill -0` and `ps`. Emitting a PowerShell-shaped approximation of that would produce a
 * deploy that reports success on a host where nothing is running.
 */
import { isWindowsRemoteHost, type RemoteHostPlatform } from './ssh-remote-platform'

export class NightshiftdRemoteLaunchUnsupportedError extends Error {
  readonly code = 'nightshiftd_remote_launch_unsupported_host'
  constructor(hostLabel: string) {
    super(
      `Deploying nightshiftd to a ${hostLabel} host is not implemented. The install transaction is ` +
        'host-agnostic, but the launch and readiness path is POSIX-only: it uses nohup, a ' +
        'redirected stdout and `kill -0` liveness. Use the relay for this host.'
    )
    this.name = 'NightshiftdRemoteLaunchUnsupportedError'
  }
}

export function assertPosixNightshiftdHost(host: RemoteHostPlatform): void {
  if (isWindowsRemoteHost(host)) {
    throw new NightshiftdRemoteLaunchUnsupportedError('Windows')
  }
}

/** PID of the launched nightshiftd, written into its own version dir at launch. */
export const NIGHTSHIFTD_PID_FILENAME = '.nightshiftd-pid'

/**
 * A shell function answering whether a PID is a *running* process.
 *
 * `kill -0` alone is not that question. It succeeds for a zombie — a process that has
 * exited but whose parent has not reaped it — so a stop loop built on it reports
 * `STILL_RUNNING` for a process that is already gone, and GC reports a dead version dir as
 * in use. Verified against a real zombie on macOS; the `ps` state check is what separates
 * the two.
 *
 * A host without `ps` yields an empty state, which falls through to "alive" — the safe
 * direction for both callers.
 */
export function posixProcessAliveShellFunction(): string {
  return (
    'nightshiftd_alive() { kill -0 "$1" 2>/dev/null || return 1; ' +
    'case "$(ps -o stat= -p "$1" 2>/dev/null)" in Z*) return 1;; esac; return 0; };'
  )
}
