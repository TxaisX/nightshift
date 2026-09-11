import { describe, expect, it } from 'vitest'
import { countLiveSessionsByWorktree } from './live-session-counts'

describe('countLiveSessionsByWorktree', () => {
  it('counts live sessions per worktree', () => {
    const tabsByWorktree = {
      'wt-1': [{ id: 'tab-1' }, { id: 'tab-2' }],
      'wt-2': [{ id: 'tab-3' }]
    }
    const ptyIdsByTabId = {
      'tab-1': ['pty-1'],
      'tab-2': ['pty-2'],
      'tab-3': ['pty-3']
    }
    expect(countLiveSessionsByWorktree(tabsByWorktree, ptyIdsByTabId)).toEqual({
      'wt-1': 2,
      'wt-2': 1
    })
  })

  it('ignores dead tabs (no live pty) and omits worktrees left with zero', () => {
    const tabsByWorktree = {
      'wt-1': [{ id: 'tab-1' }, { id: 'tab-2' }],
      'wt-2': [{ id: 'tab-3' }]
    }
    const ptyIdsByTabId = {
      'tab-1': ['pty-1'],
      'tab-2': [], // dead: pty list emptied on exit
      'tab-3': undefined // dead: never spawned / already removed
    }
    expect(countLiveSessionsByWorktree(tabsByWorktree, ptyIdsByTabId)).toEqual({
      'wt-1': 1
    })
  })

  it('handles an empty store', () => {
    expect(countLiveSessionsByWorktree({}, {})).toEqual({})
  })
})
