import { translate } from '@/i18n/i18n'
import { createLocalizedCatalog } from '@/i18n/localized-catalog'
import type { TuiAgent } from '../../../../shared/tui-agent'

/**
 * A role gives one launched session a job distinct from its siblings. Without
 * roles every session in a wave receives the identical prompt and does the
 * identical work, which is the failure mode this module exists to fix.
 */
export type LaunchRole = {
  key: string
  label: string
  /** Prefixed to the shared prompt so the session opens already scoped.
   *  Not localized: it is sent to the agent, not shown to the user. */
  brief: string
}

export type LaunchPreset = {
  id: string
  label: string
  roles: readonly LaunchRole[]
}

const T = (id: string, fallback: string): string =>
  translate(`auto.components.launch-agents.launch-agent-roles.${id}`, fallback)

function buildRoles(): Record<string, LaunchRole> {
  return {
    builder: {
      key: 'builder',
      label: T('builder', 'Builder'),
      brief:
        'You are the BUILDER for this task. Implement it end to end and prefer the smallest working diff. Leave one runnable check behind.'
    },
    reviewer: {
      key: 'reviewer',
      label: T('reviewer', 'Reviewer'),
      brief:
        'You are the REVIEWER for this task. Do not implement it. Read the code it touches and report correctness, security and simplification findings, most severe first.'
    },
    scout: {
      key: 'scout',
      label: T('scout', 'Scout'),
      brief:
        'You are the SCOUT for this task. Do not implement it. Map the code the task touches and report the files, the real call paths and the risks, with file:line references.'
    },
    tester: {
      key: 'tester',
      label: T('tester', 'Tester'),
      brief:
        'You are the TESTER for this task. Do not implement the feature. Write and run the smallest checks that fail if the behaviour breaks, and report what passed.'
    }
  }
}

export const getLaunchPresets = createLocalizedCatalog((): LaunchPreset[] => {
  const roles = buildRoles()
  return [
    { id: 'solo', label: T('solo', 'Solo'), roles: [roles.builder] },
    { id: 'pair', label: T('pair', 'Pair'), roles: [roles.builder, roles.reviewer] },
    {
      id: 'workbench',
      label: T('workbench', 'Workbench'),
      roles: [roles.scout, roles.builder, roles.reviewer]
    },
    {
      id: 'swarm',
      label: T('swarm', 'Swarm'),
      roles: [roles.scout, roles.builder, roles.builder, roles.tester, roles.reviewer]
    }
  ]
})

export function getLaunchPreset(id: string | null): LaunchPreset | null {
  if (id === null) {
    return null
  }
  return getLaunchPresets().find((preset) => preset.id === id) ?? null
}

/**
 * Pair each launched session with a role. Roles cycle when there are more
 * sessions than roles so a wave larger than the preset still differentiates
 * its sessions instead of silently falling back to N identical prompts.
 */
export function assignLaunchRoles(
  agents: readonly TuiAgent[],
  roles: readonly LaunchRole[]
): (LaunchRole | null)[] {
  if (roles.length === 0) {
    return agents.map(() => null)
  }
  return agents.map((_agent, index) => roles[index % roles.length] ?? null)
}

/** Compose the per-session prompt: the role brief, then the shared task. */
export function composeRolePrompt(prompt: string, role: LaunchRole | null): string {
  const task = prompt.trim()
  if (role === null) {
    return task
  }
  if (task.length === 0) {
    return role.brief
  }
  return `${role.brief}\n\n${task}`
}
