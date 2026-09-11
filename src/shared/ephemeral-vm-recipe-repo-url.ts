import { stripCredentialsFromMessage } from './git-remote-error'
import type { NightshiftVmRecipe } from './nightshift-yaml-hook-types'

export function getProvisionedRootRecipeRepoUrl(
  checkoutMode: NightshiftVmRecipe['checkoutMode'],
  remoteUrl: string | undefined
): string | undefined {
  if (checkoutMode !== 'provisioned-root' || !remoteUrl) {
    return undefined
  }
  return stripCredentialsFromMessage(remoteUrl)
}
