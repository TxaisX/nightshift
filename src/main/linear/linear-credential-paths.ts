import { existsSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export const LEGACY_WORKSPACE_ID = 'legacy'

function getNightshiftDir(): string {
  return join(homedir(), '.nightshift')
}

function getLegacyTokenPath(): string {
  return join(getNightshiftDir(), 'linear-token.enc')
}

export function getLegacyViewerPath(): string {
  return join(getNightshiftDir(), 'linear-viewer.json')
}

export function getWorkspaceFilePath(): string {
  return join(getNightshiftDir(), 'linear-workspaces.json')
}

function getWorkspaceTokenDir(): string {
  return join(getNightshiftDir(), 'linear-tokens')
}

export function getWorkspaceTokenPath(workspaceId: string): string {
  if (workspaceId === LEGACY_WORKSPACE_ID) {
    return getLegacyTokenPath()
  }
  return join(getWorkspaceTokenDir(), `${Buffer.from(workspaceId).toString('base64url')}.enc`)
}

export function ensureNightshiftDir(): void {
  const dir = getNightshiftDir()
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}

export function ensureWorkspaceTokenDir(): void {
  const dir = getWorkspaceTokenDir()
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}
