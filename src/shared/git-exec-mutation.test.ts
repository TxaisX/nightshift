import { describe, expect, it } from 'vitest'
import { gitExecMutatesRepository } from './git-exec-mutation'

describe('gitExecMutatesRepository', () => {
  it.each([
    [
      [
        'remote',
        'add',
        'pr-contributor-nightshift',
        'https://github.com/contributor/nightshift.git'
      ]
    ],
    [['remote', 'remove', 'pr-contributor-nightshift']],
    [['clone', '--', 'https://github.com/TxaisX/nightshift.git', 'nightshift']],
    [['commit', '--allow-empty', '-m', 'Initial commit']],
    [['init']]
  ])('treats %j as mutating', (args) => {
    expect(gitExecMutatesRepository(args)).toBe(true)
  })

  it.each([
    // Why: these run on read-heavy paths; misclassifying them would flush the
    // git read cache on every remote probe.
    [['remote']],
    [['remote', '-v']],
    [['remote', 'get-url', 'origin']],
    [['remote', 'show', 'origin']],
    [['rev-parse', '--show-toplevel']],
    [[]]
  ])('treats %j as read-only', (args) => {
    expect(gitExecMutatesRepository(args)).toBe(false)
  })
})
