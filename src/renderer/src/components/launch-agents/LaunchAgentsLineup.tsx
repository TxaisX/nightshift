import React from 'react'
import { Button } from '@/components/ui/button'
import { AgentIcon, getAgentCatalog } from '@/lib/agent-catalog'
import { translate } from '@/i18n/i18n'
import type { TuiAgent } from '../../../../shared/tui-agent'
import { getLaunchPresets, type LaunchRole } from './launch-agent-roles'

const T = (id: string, fallback: string): string =>
  translate(`auto.components.launch-agents.LaunchAgentsLineup.${id}`, fallback)

function agentLabel(agent: TuiAgent): string {
  return getAgentCatalog().find((entry) => entry.id === agent)?.label ?? agent
}

export function LaunchPresetRow({
  presetId,
  onSelect
}: {
  presetId: string | null
  onSelect: (id: string | null) => void
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium">{T('shape', 'Shape')}</span>
      <div className="flex flex-wrap gap-1.5">
        <Button
          type="button"
          size="xs"
          variant={presetId === null ? 'default' : 'outline'}
          onClick={() => onSelect(null)}
        >
          {T('samePrompt', 'Same prompt')}
        </Button>
        {getLaunchPresets().map((preset) => (
          <Button
            key={preset.id}
            type="button"
            size="xs"
            variant={presetId === preset.id ? 'default' : 'outline'}
            onClick={() => onSelect(preset.id)}
          >
            {preset.label}
          </Button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        {presetId === null
          ? T('samePromptHelp', 'Every session gets the identical prompt.')
          : T('rolesHelp', 'Each session gets a different job ahead of your prompt.')}
      </p>
    </div>
  )
}

/**
 * The lineup: what will actually open, and the role each session takes. Shown
 * before launching so a wave is reviewed rather than discovered afterwards.
 */
export function LaunchAgentsLineup({
  agents,
  roles
}: {
  agents: readonly TuiAgent[]
  roles: readonly (LaunchRole | null)[]
}): React.JSX.Element | null {
  if (agents.length === 0) {
    return null
  }
  return (
    <div className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium">
        {translate(
          'auto.components.launch-agents.LaunchAgentsLineup.lineup',
          'Lineup ({{count}})',
          { count: agents.length }
        )}
      </span>
      <ol className="scrollbar-sleek max-h-32 overflow-y-auto rounded-md border border-border">
        {agents.map((agent, index) => (
          <li
            key={`${agent}-${index}`}
            className="flex items-center gap-2 border-b border-border px-3 py-1 text-xs last:border-b-0"
          >
            <span className="w-4 text-center tabular-nums text-muted-foreground">{index + 1}</span>
            <AgentIcon agent={agent} size={12} />
            <span className="flex-1 truncate">{agentLabel(agent)}</span>
            <span className="text-muted-foreground">
              {roles[index]?.label ?? T('sameTask', 'Same task')}
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}
