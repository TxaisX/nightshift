type NightshiftCloudSessionInvalidationListener = () => void

const listeners = new Set<NightshiftCloudSessionInvalidationListener>()

/**
 * Fires when an auth failure (revoked or rotated-away refresh token) clears a
 * stored cloud session. Never fires for an explicit user sign-out, which already
 * hands the fresh auth status back to its caller.
 */
export function onNightshiftCloudSessionInvalidated(
  listener: NightshiftCloudSessionInvalidationListener
): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function emitNightshiftCloudSessionInvalidated(): void {
  for (const listener of listeners) {
    try {
      listener()
    } catch (error) {
      console.warn(
        '[nightshift-profiles] Cloud session invalidation listener failed:',
        error instanceof Error ? error.message : String(error)
      )
    }
  }
}
