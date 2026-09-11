import React from 'react'
import { Badge } from '@/components/ui/badge'
import { translate } from '@/i18n/i18n'

const T = (id: string, fallback: string, values?: Record<string, unknown>): string =>
  translate(`auto.components.session-rail.SessionCountBadge.${id}`, fallback, values)

type Props = {
  count: number
}

/**
 * Small numeric badge showing how many terminal sessions are live in a
 * worktree/repo row right now — quiet by design: renders nothing at 0 so an
 * idle row shows no badge instead of a "0".
 */
export function SessionCountBadge({ count }: Props): React.JSX.Element | null {
  if (count <= 0) {
    return null
  }
  return (
    <Badge
      variant="secondary"
      className="h-[16px] min-w-[16px] shrink-0 justify-center rounded-full px-1 text-[10px] font-medium leading-none tabular-nums"
      aria-label={T('sessionCount', '{{value0}} live sessions', { value0: count })}
      title={T('sessionCount', '{{value0}} live sessions', { value0: count })}
    >
      {count}
    </Badge>
  )
}
