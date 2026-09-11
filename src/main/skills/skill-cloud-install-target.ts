import type { SkillInstallDestination } from '../../shared/skill-install-contract'
import type { NightshiftRuntimeService } from '../runtime/nightshift-runtime'

export async function classifySkillCloudInstallTarget(
  runtime: NightshiftRuntimeService,
  input: { environmentId?: string; destination: SkillInstallDestination }
): Promise<'local' | 'remote'> {
  return input.environmentId || (await runtime.skillInstallDestinationUsesSsh(input.destination))
    ? 'remote'
    : 'local'
}
