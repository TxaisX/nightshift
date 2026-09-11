import { describe, expect, it } from 'vitest'
import type { TabGroupLayoutNode } from '../../../../shared/tab-types'
import { collectLeafGroupIds, collectSplitRatioUpdates, tidyLayout } from './tidy-layout'

function leaf(groupId: string): TabGroupLayoutNode {
  return { type: 'leaf', groupId }
}

function split(
  first: TabGroupLayoutNode,
  second: TabGroupLayoutNode,
  ratio?: number,
  direction: 'horizontal' | 'vertical' = 'horizontal'
): TabGroupLayoutNode {
  return { type: 'split', direction, first, second, ratio }
}

describe('tidyLayout', () => {
  it('handles a single pane (leaf) without throwing, unchanged', () => {
    const single = leaf('a')
    expect(tidyLayout(single)).toEqual(single)
  })

  it('never creates, destroys or reorders panes — only resizes', () => {
    // Deliberately lopsided: a 90/10 split whose second branch nests a 5/95 split.
    const messy = split(leaf('a'), split(leaf('b'), leaf('c'), 0.05), 0.9)
    const before = collectLeafGroupIds(messy)
    const tidied = tidyLayout(messy)
    const after = collectLeafGroupIds(tidied)

    expect(after).toEqual(before) // same identities, same left-to-right order
    expect(after.length).toBe(before.length) // pane count preserved
  })

  it('normalizes a messy layout so every leaf gets an equal on-screen share', () => {
    // 3 leaves total: first split should give the lone leaf 1/3, the nested
    // split should give its two leaves 1/2 each (of the remaining 2/3).
    const messy = split(leaf('a'), split(leaf('b'), leaf('c'), 0.05), 0.9)
    const tidied = tidyLayout(messy) as Extract<TabGroupLayoutNode, { type: 'split' }>

    expect(tidied.ratio).toBeCloseTo(1 / 3)
    const secondBranch = tidied.second as Extract<TabGroupLayoutNode, { type: 'split' }>
    expect(secondBranch.ratio).toBeCloseTo(0.5)
  })

  it('is a no-op on a layout that is already evenly split', () => {
    // 3 leaves: each must hold 1/3 of the canvas — that's ratio 1/3 at the
    // outer split (1 leaf vs. 2) and 0.5 at the inner split (1 vs. 1).
    const even = split(leaf('a'), split(leaf('b'), leaf('c'), 0.5), 1 / 3)
    expect(tidyLayout(even)).toEqual(even)
  })

  it('produces (path, ratio) updates matching setTabGroupSplitRatio nodePath format', () => {
    const messy = split(leaf('a'), split(leaf('b'), leaf('c'), 0.05), 0.9)
    const updates = collectSplitRatioUpdates(tidyLayout(messy))

    expect(updates).toEqual([
      { path: '', ratio: expect.closeTo(1 / 3, 5) },
      { path: 'second', ratio: expect.closeTo(0.5, 5) }
    ])
  })
})
