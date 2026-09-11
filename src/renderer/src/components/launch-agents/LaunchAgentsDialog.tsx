import React, { useEffect, useMemo, useState } from 'react'
import { Minus, Plus, Rocket } from 'lucide-react'
import { toast } from 'sonner'
import { useAppStore } from '@/store'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { AgentIcon, getAgentCatalog } from '@/lib/agent-catalog'
import { runBackgroundWorktreeCreation } from '@/lib/worktree-creation-flow'
import { resolveDirectSetupDecision } from '@/lib/launch-work-item-direct-preflight'
import { getSettingsForRepoRuntimeOwner } from '@/lib/repo-runtime-owner'
import { ensureHooksConfirmed } from '@/lib/ensure-hooks-confirmed'
import { useRetiredWorktreeNames } from '@/hooks/useRetiredWorktreeNames'
import { translate } from '@/i18n/i18n'
import { isTuiAgentEnabled } from '../../../../shared/tui-agent-selection'
import type { TuiAgent } from '../../../../shared/tui-agent'
import {
  buildLaunchAgentsRequests,
  expandLaunchAgentCounts,
  LAUNCH_AGENTS_MAX_PER_AGENT,
  type LaunchAgentCounts
} from './launch-agents-requests'
import { assignLaunchRoles, getLaunchPreset } from './launch-agent-roles'
import { LaunchAgentsLineup, LaunchPresetRow } from './LaunchAgentsLineup'

const T = (id: string, fallback: string): string =>
  translate(`auto.components.launch-agents.LaunchAgentsDialog.${id}`, fallback)

export default function LaunchAgentsDialog(): React.JSX.Element | null {
  const visible = useAppStore((s) => s.activeModal === 'launch-agents')
  const closeModal = useAppStore((s) => s.closeModal)
  if (!visible) {
    return null
  }
  return (
    <Dialog open onOpenChange={(open) => !open && closeModal()}>
      <DialogContent className="flex max-h-[calc(100vh-2rem)] flex-col overflow-hidden sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{T('title', 'Launch agents')}</DialogTitle>
          <DialogDescription>
            {T(
              'description',
              'Pick how many sessions of each agent to open. Each one gets its own worktree and the same prompt.'
            )}
          </DialogDescription>
        </DialogHeader>
        <LaunchAgentsBody onClose={closeModal} />
      </DialogContent>
    </Dialog>
  )
}

function LaunchAgentsBody({ onClose }: { onClose: () => void }): React.JSX.Element {
  const repos = useAppStore((s) => s.repos)
  const activeRepoId = useAppStore((s) => s.activeRepoId)
  const settings = useAppStore((s) => s.settings)
  const worktreesByRepo = useAppStore((s) => s.worktreesByRepo)
  const detectedAgentList = useAppStore((s) => s.detectedAgentIds)
  const ensureDetectedAgents = useAppStore((s) => s.ensureDetectedAgents)

  // Why: v1 launches into local git worktrees only; remote/SSH repos keep the single-agent composer.
  const localRepos = useMemo(() => repos.filter((repo) => !repo.connectionId), [repos])
  const [repoId, setRepoId] = useState<string>(() =>
    localRepos.some((repo) => repo.id === activeRepoId)
      ? (activeRepoId ?? '')
      : (localRepos[0]?.id ?? '')
  )
  const [prompt, setPrompt] = useState('')
  const [counts, setCounts] = useState<LaunchAgentCounts>({})
  const [presetId, setPresetId] = useState<string | null>(null)
  const [launching, setLaunching] = useState(false)
  const retired = useRetiredWorktreeNames(repoId || null, repoId)

  useEffect(() => {
    void ensureDetectedAgents()
  }, [ensureDetectedAgents])

  const agents = useMemo(() => {
    const detected = detectedAgentList ? new Set<TuiAgent>(detectedAgentList) : null
    return getAgentCatalog().filter(
      (entry) =>
        isTuiAgentEnabled(entry.id, settings?.disabledTuiAgents) &&
        (detected === null || detected.has(entry.id))
    )
  }, [detectedAgentList, settings?.disabledTuiAgents])

  const expandedAgents = useMemo(() => expandLaunchAgentCounts(counts), [counts])
  const total = expandedAgents.length
  const repo = localRepos.find((entry) => entry.id === repoId) ?? null
  const preset = getLaunchPreset(presetId)
  const roles = useMemo(
    () => assignLaunchRoles(expandedAgents, preset?.roles ?? []),
    [expandedAgents, preset]
  )

  const setCount = (agent: TuiAgent, next: number): void => {
    setCounts((prev) => ({
      ...prev,
      [agent]: Math.max(0, Math.min(LAUNCH_AGENTS_MAX_PER_AGENT, next))
    }))
  }

  // Why: picking a shape with nothing queued should produce that shape, not an
  // empty lineup the user then has to build by hand one click at a time.
  const selectPreset = (nextPresetId: string | null): void => {
    setPresetId(nextPresetId)
    const nextPreset = getLaunchPreset(nextPresetId)
    const firstAgent = agents[0]
    if (!nextPreset || total > 0 || !firstAgent) {
      return
    }
    setCount(firstAgent.id, Math.min(nextPreset.roles.length, LAUNCH_AGENTS_MAX_PER_AGENT))
  }

  const launch = async (): Promise<void> => {
    if (!repo || !settings || total === 0) {
      return
    }
    setLaunching(true)
    try {
      const store = useAppStore.getState()
      const setup = await resolveDirectSetupDecision(
        repo.id,
        repo,
        getSettingsForRepoRuntimeOwner(store, repo.id)
      )
      if (setup.kind === 'needs-modal') {
        toast.error(
          T(
            'setupAsksPerWorkspace',
            'This project asks about setup scripts per workspace. Pick a default in its settings, then launch again.'
          )
        )
        return
      }
      const trust = await ensureHooksConfirmed(useAppStore.getState(), repo.id, 'setup')
      const requests = buildLaunchAgentsRequests({
        repo,
        settings,
        prompt,
        agents: expandedAgents,
        roles,
        setupDecision: trust === 'skip' ? 'skip' : setup.decision,
        worktreesByRepo,
        retired
      })
      for (const request of requests) {
        runBackgroundWorktreeCreation(request)
      }
      toast.success(
        translate(
          'auto.components.launch-agents.LaunchAgentsDialog.launched',
          'Launching {{count}} agent sessions',
          { count: requests.length }
        )
      )
      onClose()
    } finally {
      setLaunching(false)
    }
  }

  return (
    <div className="flex min-h-0 flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">{T('project', 'Project')}</span>
        <select
          className="h-8 rounded-md border border-input bg-background px-2 text-sm"
          value={repoId}
          onChange={(event) => setRepoId(event.target.value)}
        >
          {localRepos.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.displayName}
            </option>
          ))}
        </select>
      </label>

      <div className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">{T('agents', 'Agents')}</span>
        <div className="scrollbar-sleek max-h-56 overflow-y-auto rounded-md border border-border">
          {agents.length === 0 ? (
            <p className="p-3 text-xs text-muted-foreground">
              {T('noAgents', 'No agent CLIs detected on this machine yet.')}
            </p>
          ) : null}
          {agents.map((entry) => {
            const count = counts[entry.id] ?? 0
            return (
              <div
                key={entry.id}
                className="flex items-center gap-2 border-b border-border px-3 py-1.5 last:border-b-0"
              >
                <AgentIcon agent={entry.id} size={14} />
                <span className="flex-1 truncate">{entry.label}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={T('fewer', 'Fewer')}
                  disabled={count === 0}
                  onClick={() => setCount(entry.id, count - 1)}
                >
                  <Minus className="size-3.5" />
                </Button>
                <span className="w-5 text-center tabular-nums">{count}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={T('more', 'More')}
                  disabled={count >= LAUNCH_AGENTS_MAX_PER_AGENT}
                  onClick={() => setCount(entry.id, count + 1)}
                >
                  <Plus className="size-3.5" />
                </Button>
              </div>
            )
          })}
        </div>
      </div>

      <LaunchPresetRow presetId={presetId} onSelect={selectPreset} />

      <LaunchAgentsLineup agents={expandedAgents} roles={roles} />

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">{T('prompt', 'Prompt for every session')}</span>
        <Textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          rows={4}
          placeholder={T(
            'promptPlaceholder',
            'Describe the task. Leave empty to just open the agents.'
          )}
        />
      </label>

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          {T('cancel', 'Cancel')}
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={launching || total === 0 || repo === null}
          onClick={() => void launch()}
        >
          <Rocket className="size-3.5" />
          {translate(
            'auto.components.launch-agents.LaunchAgentsDialog.launchCount',
            'Launch {{count}}',
            { count: total }
          )}
        </Button>
      </div>
    </div>
  )
}
