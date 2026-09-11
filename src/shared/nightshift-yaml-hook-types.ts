export type SetupRunPolicy = 'ask' | 'run-by-default' | 'skip-by-default'
export type SetupAgentStartupPolicy = 'start-immediately' | 'wait-for-setup'
export type HookCommandSourcePolicy = 'shared-only' | 'local-only' | 'run-both'

// ─── Hooks (nightshift.yaml) ──────────────────────────────────────────────
export type NightshiftHooks = {
  scripts: {
    setup?: string // Runs after worktree is created
    archive?: string // Runs before worktree is archived
  }
  setupAgentStartupPolicy?: SetupAgentStartupPolicy
  issueCommand?: string // Shared default command for linked GitHub issues
  defaultTabs?: NightshiftDefaultTabTemplate[] // Terminal tabs to create once for a new worktree
  environmentRecipes?: NightshiftVmRecipe[] // Project-scoped per-workspace environment recipes
  environmentRecipeDiagnostics?: NightshiftVmRecipeDiagnostic[] // Non-fatal validation issues from environmentRecipes
  worktree?: NightshiftWorktreeDefaults // Project-scoped defaults applied when a worktree is created
}

export type NightshiftWorktreeDefaults = {
  // Why: shared (symlinked) rather than copied — large rebuildable dirs like
  // node_modules should be one install serving every worktree.
  sharedDirectories?: string[]
}

export type NightshiftDefaultTabTemplate = {
  title?: string
  color?: string
  command?: string
}

export type EphemeralVmCheckoutMode = 'nightshift-worktree' | 'provisioned-root'

export type NightshiftVmRecipe = {
  id: string
  name: string
  create: string
  checkoutMode?: EphemeralVmCheckoutMode
  description?: string
  suspend?: string
  resume?: string
  destroy?: string
  destroyDisabled?: boolean
}

export type NightshiftVmRecipeDiagnostic = {
  index: number
  field?: string
  message: string
}

export type RepoHookSettings = {
  // Why: persisted data may still include the old mode field from the earlier
  // hook UI. Keep it in the shape so existing local state reads without a migration.
  mode: 'auto' | 'override'
  setupRunPolicy?: SetupRunPolicy
  setupAgentStartupPolicy?: SetupAgentStartupPolicy
  commandSourcePolicy?: HookCommandSourcePolicy
  scripts: {
    setup: string
    archive: string
  }
}

export type PersistedTrustedNightshiftHookEntry = {
  contentHash: string
  approvedAt: number
}

export type PersistedTrustedNightshiftHookRepo = {
  all?: {
    approvedAt: number
  }
  setup?: PersistedTrustedNightshiftHookEntry
  archive?: PersistedTrustedNightshiftHookEntry
  issueCommand?: PersistedTrustedNightshiftHookEntry
  vmRecipe?: PersistedTrustedNightshiftHookEntry
}

export type PersistedTrustedNightshiftHooks = Record<string, PersistedTrustedNightshiftHookRepo>
