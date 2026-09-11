import { isFolderRepo } from '../../../../../../shared/repo-kind'
import type { NightshiftRuntimeService } from '../../../../nightshift-runtime'
import { OrchestrationError } from '../../../../orchestration/orchestration-error'

export async function assertOrchestrationWorktreeCreationSupported(args: {
  runtime: NightshiftRuntimeService
  repoSelector: string
  existingPlacement: string
}): Promise<void> {
  if (!isFolderRepo(await args.runtime.showRepo(args.repoSelector))) {
    return
  }
  throw new OrchestrationError(
    'invalid_argument',
    `Folder projects cannot create orchestration worktrees; use ${args.existingPlacement}.`
  )
}
