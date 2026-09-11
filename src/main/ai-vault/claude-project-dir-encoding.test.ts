import { describe, expect, it } from 'vitest'
import {
  encodeClaudeProjectPath,
  encodeClaudeProjectPaths,
  isClaudeProjectDirInScope
} from './claude-project-dir-encoding'

describe('encodeClaudeProjectPath', () => {
  it('emits one dash per non-alphanumeric character rather than per run', () => {
    // The distinction is the whole contract: collapsing runs stops matching real bucket names.
    expect(encodeClaudeProjectPath('/Users/ada/nightshift/workspaces')).toBe(
      '-Users-ada-nightshift-workspaces'
    )
    expect(encodeClaudeProjectPath('/Users/ada/.nightshift/worktrees')).toBe(
      '-Users-ada--nightshift-worktrees'
    )
  })

  it('encodes a Windows drive path', () => {
    expect(encodeClaudeProjectPath('C:\\Users\\ada\\nightshift\\workspaces')).toBe(
      'C--Users-ada-nightshift-workspaces'
    )
    expect(encodeClaudeProjectPath('C:\\')).toBe('C--')
  })

  it('encodes a WSL UNC path', () => {
    expect(encodeClaudeProjectPath('\\\\wsl$\\Ubuntu\\home\\ada\\nightshift\\workspaces')).toBe(
      '--wsl--Ubuntu-home-ada-nightshift-workspaces'
    )
  })

  it('drops trailing separators but keeps a bare root', () => {
    expect(encodeClaudeProjectPath('/Users/ada/nightshift/')).toBe('-Users-ada-nightshift')
    expect(encodeClaudeProjectPath('/')).toBe('-')
  })

  it('offers the NFC spelling alongside the raw one', () => {
    const nfd = '/Users/ada/cafe\u0301'
    expect(encodeClaudeProjectPaths(nfd)).toEqual([
      encodeClaudeProjectPath(nfd),
      encodeClaudeProjectPath(nfd.normalize('NFC'))
    ])
    expect(encodeClaudeProjectPaths('/Users/ada/cafe')).toEqual(['-Users-ada-cafe'])
  })
})

describe('isClaudeProjectDirInScope', () => {
  it('accepts the prefix itself and its dash-delimited descendants', () => {
    expect(isClaudeProjectDirInScope('-w-nightshift', ['-w-nightshift'])).toBe(true)
    expect(isClaudeProjectDirInScope('-w-nightshift-nautilus', ['-w-nightshift'])).toBe(true)
  })

  it('rejects a sibling that merely starts with the prefix', () => {
    // Without the boundary, "nightshift" would absorb every workspace under "nightshiftdyne".
    expect(isClaudeProjectDirInScope('-w-nightshiftdyne-nautilus', ['-w-nightshift'])).toBe(false)
  })
})
