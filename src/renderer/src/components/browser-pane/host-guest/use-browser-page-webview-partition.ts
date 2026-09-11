import { useAppStore } from '@/store'
import { NIGHTSHIFT_BROWSER_PARTITION } from '../../../../../shared/constants'
import { getNightshiftProfileBrowserDefaultPartition } from '../../../../../shared/nightshift-profiles'

export function useBrowserPageWebviewPartition({
  sessionProfileId,
  sessionPartition
}: {
  sessionProfileId: string | null
  sessionPartition: string | null
}): string {
  const browserSessionProfiles = useAppStore((s) => s.browserSessionProfiles)
  const activeNightshiftProfileId = useAppStore((s) => s.activeNightshiftProfileId)
  const fallbackBrowserPartition = activeNightshiftProfileId
    ? getNightshiftProfileBrowserDefaultPartition(activeNightshiftProfileId)
    : null
  const defaultSessionProfile = browserSessionProfiles.find((p) => p.id === 'default') ?? null
  const sessionProfile = sessionProfileId
    ? (browserSessionProfiles.find((p) => p.id === sessionProfileId) ?? null)
    : defaultSessionProfile
  return (
    sessionPartition ??
    sessionProfile?.partition ??
    defaultSessionProfile?.partition ??
    fallbackBrowserPartition ??
    NIGHTSHIFT_BROWSER_PARTITION
  )
}
