import type { NightshiftRuntimeService } from '../nightshift-runtime'

export function routeDispatcherClientHostedBrowserRpc(
  runtime: NightshiftRuntimeService,
  method: string,
  params: unknown
) {
  const candidate = runtime as NightshiftRuntimeService & {
    routeClientHostedBrowserRpc?: NightshiftRuntimeService['routeClientHostedBrowserRpc']
  }
  return candidate.routeClientHostedBrowserRpc?.(method, params) ?? { handled: false as const }
}
