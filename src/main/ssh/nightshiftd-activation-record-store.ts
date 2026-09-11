/**
 * Reading the activation record off a host.
 *
 * Split out from the deploy driver because the rollback path needs it too, and because an
 * unreadable record must fail loudly in both: treating "I cannot parse this" as "nothing is
 * activated" would deploy over a live install and lose its rollback target.
 */
import type { SshConnection } from './ssh-connection'
import { execCommand } from './ssh-relay-deploy-helpers'
import { RELAY_REMOTE_DIR } from './relay-protocol'
import {
  NIGHTSHIFTD_ACTIVATION_FILENAME,
  emptyNightshiftdActivationRecord,
  parseNightshiftdActivationRecord,
  type NightshiftdActivationRecord
} from './nightshiftd-activation-record'
import { joinRemotePath, type RemoteHostPlatform } from './ssh-remote-platform'

export function nightshiftdActivationPath(host: RemoteHostPlatform, remoteHome: string): string {
  return joinRemotePath(host, remoteHome, RELAY_REMOTE_DIR, NIGHTSHIFTD_ACTIVATION_FILENAME)
}

export async function readNightshiftdActivationRecord(options: {
  conn: SshConnection
  host: RemoteHostPlatform
  remoteHome: string
  signal?: AbortSignal
}): Promise<NightshiftdActivationRecord> {
  const path = nightshiftdActivationPath(options.host, options.remoteHome)
  const raw = await execCommand(options.conn, `cat ${shellQuote(path)} 2>/dev/null || true`, {
    wrapCommand: options.host.commandDialect !== 'powershell',
    signal: options.signal
  }).catch(() => '')
  const parsed = parseNightshiftdActivationRecord(raw)
  if (parsed.state === 'ok') {
    return parsed.record
  }
  if (parsed.state === 'unreadable') {
    // Why throw: an unreadable record is not an empty one. Treating it as empty would
    // activate over a live install and orphan its rollback target.
    throw new Error(`Cannot read this host's nightshiftd activation record: ${parsed.reason}`)
  }
  return emptyNightshiftdActivationRecord()
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'\\''`)}'`
}
