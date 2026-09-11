import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Repo } from '../../../../shared/repo-types'
import {
  createCompatibleRuntimeStatusResponseIfNeeded,
  type RuntimeEnvironmentCallRequest
} from '../../runtime/runtime-compatibility-test-fixture'
import { clearRuntimeCompatibilityCacheForTests } from '../../runtime/runtime-rpc-client'
import { createTestStore } from './store-test-helpers'

const runtimeEnvironmentCall = vi.fn()
const runtimeEnvironmentTransportCall = vi.fn()

beforeEach(() => {
  clearRuntimeCompatibilityCacheForTests()
  runtimeEnvironmentCall.mockReset()
  runtimeEnvironmentTransportCall.mockReset()
  runtimeEnvironmentTransportCall.mockImplementation((args: RuntimeEnvironmentCallRequest) => {
    return createCompatibleRuntimeStatusResponseIfNeeded(args) ?? runtimeEnvironmentCall(args)
  })
  vi.stubGlobal('window', {
    api: {
      runtimeEnvironments: { call: runtimeEnvironmentTransportCall }
    }
  })
})

describe('repo slice runtime project groups', () => {
  it('keeps runtime copies of a grouped canonical project in the same project group', async () => {
    const gitRemoteIdentity = {
      canonicalKey: 'github.com/TxaisX/nightshift',
      remoteName: 'origin',
      remoteUrl: 'https://github.com/TxaisX/nightshift.git'
    }
    const localNightshift: Repo = {
      id: 'local-nightshift',
      path: '/Users/alice/stably/nightshift',
      displayName: 'nightshift',
      badgeColor: '#000',
      addedAt: 1,
      executionHostId: 'local',
      gitRemoteIdentity,
      projectGroupId: 'group-nightshift'
    }
    const runtimeNightshift: Repo = {
      id: 'runtime-nightshift',
      path: '/vercel/sandbox/nightshift',
      displayName: 'nightshift',
      badgeColor: '#111',
      addedAt: 2,
      gitRemoteIdentity
    }
    runtimeEnvironmentCall.mockResolvedValue({
      id: 'rpc-runtime-nightshift',
      ok: true,
      result: { repos: [runtimeNightshift] },
      _meta: { runtimeId: 'runtime-remote' }
    })
    const store = createTestStore()
    store.setState({
      settings: { activeRuntimeEnvironmentId: 'env-1' } as never,
      repos: [localNightshift]
    })

    await store.getState().fetchRepos()

    expect(store.getState().repos).toEqual([
      localNightshift,
      {
        ...runtimeNightshift,
        executionHostId: 'runtime:env-1',
        projectGroupId: 'group-nightshift'
      }
    ])
  })
})
