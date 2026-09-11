import type { TabGroupLayoutNode } from '../../../../shared/tab-types'

function countLeaves(node: TabGroupLayoutNode): number {
  return node.type === 'leaf' ? 1 : countLeaves(node.first) + countLeaves(node.second)
}

/**
 * Pure structural normalize: walks the layout tree and rewrites every split
 * ratio so each leaf ends up with an equal on-screen share, regardless of
 * how lopsided the tree's nesting is. Never creates, destroys or reorders
 * leaves — only `ratio` fields change, so pane identity and order survive.
 */
export function tidyLayout(node: TabGroupLayoutNode): TabGroupLayoutNode {
  if (node.type === 'leaf') {
    return node
  }
  const firstCount = countLeaves(node.first)
  const secondCount = countLeaves(node.second)
  const ratio = firstCount / (firstCount + secondCount)
  return {
    ...node,
    ratio,
    first: tidyLayout(node.first),
    second: tidyLayout(node.second)
  }
}

/** Left-to-right leaf order, for identity/order assertions and traversal. */
export function collectLeafGroupIds(node: TabGroupLayoutNode): string[] {
  return node.type === 'leaf'
    ? [node.groupId]
    : [...collectLeafGroupIds(node.first), ...collectLeafGroupIds(node.second)]
}

/**
 * Flattens a (typically tidied) tree into the `(nodePath, ratio)` pairs the
 * existing `setTabGroupSplitRatio(worktreeId, nodePath, ratio)` store action
 * already accepts one at a time — so applying a tidy is just a sequence of
 * calls into that existing API, no new store action required.
 */
export function collectSplitRatioUpdates(
  node: TabGroupLayoutNode,
  path = ''
): { path: string; ratio: number }[] {
  if (node.type === 'leaf') {
    return []
  }
  return [
    { path, ratio: node.ratio ?? 0.5 },
    ...collectSplitRatioUpdates(node.first, path.length > 0 ? `${path}.first` : 'first'),
    ...collectSplitRatioUpdates(node.second, path.length > 0 ? `${path}.second` : 'second')
  ]
}
