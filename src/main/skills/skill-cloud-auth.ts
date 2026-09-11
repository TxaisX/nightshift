import type { SkillCloudOperation, SkillCloudOptions } from '../../shared/skill-cloud-contract'
import { ensureActiveNightshiftProfile } from '../nightshift-profiles/profile-index-store'
import { getNightshiftCloudAuthConfig } from '../nightshift-profiles/profile-cloud-auth-config'
import { runWithFreshNightshiftCloudSession } from '../nightshift-profiles/profile-cloud-session-refresh'
import {
  allowsArtifactCloudAuthOverride,
  resolveArtifactCloudApiUrl
} from '../artifacts/artifact-cloud-config'

export async function runSkillCloudOperation<T>(input: {
  userDataPath: string
  options: SkillCloudOptions
  operation(token: string, apiUrl: string): Promise<T>
}): Promise<SkillCloudOperation<T>> {
  const apiUrl = resolveArtifactCloudApiUrl(input.options.apiUrl)
  const active = ensureActiveNightshiftProfile(input.userDataPath)
  const stamp = {
    profileId: active.profile.id,
    userId: active.profile.cloud?.userId,
    cloudProfileId: active.profile.cloud?.cloudProfileId,
    organizationId: active.profile.cloud?.activeOrgId ?? ''
  }
  const assertCurrent = () => {
    const current = ensureActiveNightshiftProfile(input.userDataPath)
    if (
      current.profile.id !== stamp.profileId ||
      current.profile.cloud?.userId !== stamp.userId ||
      current.profile.cloud?.cloudProfileId !== stamp.cloudProfileId ||
      (current.profile.cloud?.activeOrgId ?? '') !== stamp.organizationId
    ) {
      throw new Error('The signed-in Nightshift account changed during the skill request.')
    }
  }
  const override =
    input.options.authToken?.trim() || process.env.NIGHTSHIFT_CLOUD_AUTH_TOKEN?.trim()
  if (override) {
    if (!allowsArtifactCloudAuthOverride()) {
      throw new Error('Skill authentication overrides are available only in development builds.')
    }
    const value = await input.operation(override, apiUrl)
    assertCurrent()
    return { status: 'ok', value }
  }
  const config = getNightshiftCloudAuthConfig()
  if (!config.configured) {
    return { status: 'unconfigured', message: config.setupMessage }
  }
  const result = await runWithFreshNightshiftCloudSession(
    config.config,
    active,
    input.userDataPath,
    async (session) => {
      const value = await input.operation(session.accessToken, apiUrl)
      assertCurrent()
      return value
    }
  )
  return result.status === 'ok'
    ? { status: 'ok', value: result.value }
    : { status: 'reconnect-required' }
}
