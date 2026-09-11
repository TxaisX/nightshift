import type { PairingOffer } from './pairing'
import { encrypt } from './e2ee-crypto'
import { serializeRemoteRuntimePayload } from './remote-runtime-memory-limits'
import { remoteRuntimeClientCapabilities } from './remote-runtime-client-capabilities'
import type { RuntimeCapability } from './protocol-version'

// Why: split out of remote-runtime-request-connection.ts to keep that file under the max-lines budget.
export function buildRemoteRuntimeAuthFrame(
  pairing: PairingOffer,
  additionalClientCapabilities: readonly RuntimeCapability[],
  sharedKey: Uint8Array
): string {
  return encrypt(
    serializeRemoteRuntimePayload({
      type: 'e2ee_auth',
      deviceToken: pairing.deviceToken,
      clientCapabilities: remoteRuntimeClientCapabilities(additionalClientCapabilities)
    }),
    sharedKey
  )
}
