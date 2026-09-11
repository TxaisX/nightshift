import { describe, expect, it } from 'vitest'
import {
  assignLaunchRoles,
  composeRolePrompt,
  getLaunchPreset,
  getLaunchPresets
} from './launch-agent-roles'
import type { TuiAgent } from '../../../../shared/tui-agent'

const CLAUDE = 'claude' as TuiAgent

describe('assignLaunchRoles', () => {
  it('gives every session no role when no preset is picked', () => {
    expect(assignLaunchRoles([CLAUDE, CLAUDE], [])).toEqual([null, null])
  })

  it('pairs each session with a distinct role', () => {
    const pair = getLaunchPreset('pair')
    expect(pair).not.toBeNull()
    const roles = assignLaunchRoles([CLAUDE, CLAUDE], pair?.roles ?? [])
    expect(roles.map((role) => role?.key)).toEqual(['builder', 'reviewer'])
  })

  it('cycles roles so a wave larger than the preset still differentiates', () => {
    const pair = getLaunchPreset('pair')
    const roles = assignLaunchRoles([CLAUDE, CLAUDE, CLAUDE], pair?.roles ?? [])
    expect(roles.map((role) => role?.key)).toEqual(['builder', 'reviewer', 'builder'])
  })

  it('never assigns the same role to every session in a multi-role preset', () => {
    for (const preset of getLaunchPresets().filter((entry) => entry.roles.length > 1)) {
      const sessions = Array.from({ length: preset.roles.length }, () => CLAUDE)
      const roles = assignLaunchRoles(sessions, preset.roles)
      expect(new Set(roles.map((role) => role?.key)).size).toBeGreaterThan(1)
    }
  })
})

describe('composeRolePrompt', () => {
  it('returns the bare task when there is no role', () => {
    expect(composeRolePrompt('  ship it  ', null)).toBe('ship it')
  })

  it('puts the role brief ahead of the shared task', () => {
    const role = getLaunchPreset('pair')?.roles[1] ?? null
    const composed = composeRolePrompt('ship it', role)
    expect(composed.startsWith('You are the REVIEWER')).toBe(true)
    expect(composed.endsWith('ship it')).toBe(true)
  })

  it('still scopes the session when the shared prompt is empty', () => {
    const role = getLaunchPreset('solo')?.roles[0] ?? null
    expect(composeRolePrompt('   ', role)).toBe(role?.brief)
  })
})
