import type {
  NightshiftCloudCapabilities,
  NightshiftCloudOrgSummary,
  NightshiftProfileCloudSummary
} from '../../shared/nightshift-profiles'

export type NightshiftCloudSessionExchangeResponse = {
  accessToken: string
  refreshToken: string
  expiresAt: number
  cloud: NightshiftProfileCloudSummary
  organizations?: NightshiftCloudOrgSummary[]
  capabilities: NightshiftCloudCapabilities
}
