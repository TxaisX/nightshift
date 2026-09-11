import type { FsChangedPayload } from '../../../shared/filesystem-entry-types'

export const NIGHTSHIFT_WORKTREE_FILE_CHANGE_EVENT = 'nightshift:worktree-file-change'

export type WorktreeFileChangeEventDetail = {
  payload: FsChangedPayload
  runtimeEnvironmentId: string | null
}
