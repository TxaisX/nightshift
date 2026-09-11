export const NIGHTSHIFT_EDITOR_SAVE_DIRTY_FILES_EVENT = 'nightshift:editor-save-dirty-files'
export const NIGHTSHIFT_EDITOR_PREPARE_HOT_EXIT_EVENT = 'nightshift:editor-prepare-hot-exit'

export type EditorSaveDirtyFilesDetail = {
  claim: () => void
  resolve: () => void
  reject: (message: string) => void
}

export type EditorPrepareHotExitDetail = EditorSaveDirtyFilesDetail
