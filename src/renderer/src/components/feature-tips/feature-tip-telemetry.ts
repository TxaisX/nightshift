import { track } from '@/lib/telemetry'
import type { EventProps } from '../../../../shared/telemetry-events'

export type NightshiftCliFeatureTipSource = EventProps<'nightshift_cli_feature_tip_shown'>['source']
export type NightshiftCliFeatureTipSetupResult =
  EventProps<'nightshift_cli_feature_tip_setup_result'>['result']
export type CmdJPaletteFeatureTipSource = EventProps<'cmd_j_palette_feature_tip_shown'>['source']

export function getNightshiftCliFeatureTipTelemetrySource(
  value: unknown
): NightshiftCliFeatureTipSource {
  return value === 'app_open' ? 'app_open' : 'manual'
}

export function trackNightshiftCliFeatureTipShown(source: NightshiftCliFeatureTipSource): void {
  track('nightshift_cli_feature_tip_shown', { source })
}

export function trackNightshiftCliFeatureTipSetupClicked(
  source: NightshiftCliFeatureTipSource
): void {
  track('nightshift_cli_feature_tip_setup_clicked', { source })
}

export function trackNightshiftCliFeatureTipSetupResult(
  source: NightshiftCliFeatureTipSource,
  result: NightshiftCliFeatureTipSetupResult
): void {
  track('nightshift_cli_feature_tip_setup_result', { source, result })
}

export function trackCmdJPaletteFeatureTipShown(source: CmdJPaletteFeatureTipSource): void {
  track('cmd_j_palette_feature_tip_shown', { source })
}

export function trackCmdJPaletteFeatureTipAcknowledged(source: CmdJPaletteFeatureTipSource): void {
  track('cmd_j_palette_feature_tip_acknowledged', { source })
}
