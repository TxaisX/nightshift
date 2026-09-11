import { describe, expect, it } from 'vitest'

import {
  inventoryRemoteInstallDirs,
  NIGHTSHIFTD_INSTALL_MODEL,
  RELAY_INSTALL_MODEL,
  remoteInstallDirName,
  remoteInstallDirOwner,
  remoteInstallGcPermits,
  remoteInstallListingRegexSource,
  remoteInstallVersionDirRegex
} from './remote-install-model'

const RELAY_DIRS = ['relay-0.1.0+abcdef123456', 'relay-v0.1.0', 'relay-1.2.3']
const NIGHTSHIFTD_DIRS = [
  'nightshiftd-0.1.0+abcdef123456',
  'nightshiftd-v0.1.0',
  'nightshiftd-1.2.3'
]

describe('remote install namespace', () => {
  it('names each model its own version dir', () => {
    expect(remoteInstallDirName(RELAY_INSTALL_MODEL, '0.1.0+aa')).toBe('relay-0.1.0+aa')
    expect(remoteInstallDirName(NIGHTSHIFTD_INSTALL_MODEL, '0.1.0+aa')).toBe('nightshiftd-0.1.0+aa')
  })

  it('keeps the relay listing pattern byte-identical to the one it shipped with', () => {
    // The literal that was hardcoded in `listRelayBaseDirsCommand` before it was
    // parameterized. A drift here changes what an existing host's GC can see.
    expect(remoteInstallListingRegexSource(RELAY_INSTALL_MODEL)).toBe(
      String.raw`^relay-(v?[0-9]+\.[0-9]+\.[0-9]+(\+[0-9a-f]+)?)(\.gc-tombstone\.[0-9]+\.[0-9]+)?$`
    )
  })

  it('refuses a dir prefix that could escape a remote glob or quote', () => {
    const injected = { ...RELAY_INSTALL_MODEL, dirPrefix: "relay'; rm -rf ~" }
    expect(() => remoteInstallVersionDirRegex(injected)).toThrow('Unsafe remote install dir prefix')
  })
})

describe('GC ownership — each model collects only its own namespace', () => {
  it.each(NIGHTSHIFTD_DIRS)('the relay never permits GC of %s', (dirName) => {
    expect(remoteInstallDirOwner(dirName)).toBe('nightshiftd')
    expect(remoteInstallGcPermits(RELAY_INSTALL_MODEL, dirName)).toBe(false)
  })

  it.each(RELAY_DIRS)('nightshiftd never permits GC of %s', (dirName) => {
    expect(remoteInstallDirOwner(dirName)).toBe('relay')
    expect(remoteInstallGcPermits(NIGHTSHIFTD_INSTALL_MODEL, dirName)).toBe(false)
  })

  it('permits each model its own dirs and its own tombstones', () => {
    expect(remoteInstallGcPermits(RELAY_INSTALL_MODEL, 'relay-0.1.0+aa')).toBe(true)
    expect(remoteInstallGcPermits(NIGHTSHIFTD_INSTALL_MODEL, 'nightshiftd-0.1.0+aa')).toBe(true)
    expect(
      remoteInstallGcPermits(NIGHTSHIFTD_INSTALL_MODEL, 'nightshiftd-0.1.0+aa.gc-tombstone.12.34')
    ).toBe(true)
  })

  it('claims nothing it did not create', () => {
    for (const name of [
      '.nightshift-remote',
      'nightshiftd',
      'relayish-0.1.0',
      'nightshiftd-notaversion',
      'node'
    ]) {
      expect(remoteInstallDirOwner(name)).toBeNull()
      expect(remoteInstallGcPermits(RELAY_INSTALL_MODEL, name)).toBe(false)
      expect(remoteInstallGcPermits(NIGHTSHIFTD_INSTALL_MODEL, name)).toBe(false)
    }
  })

  it('groups a mixed listing without losing anything to the wrong owner', () => {
    const inventory = inventoryRemoteInstallDirs([
      ...RELAY_DIRS,
      ...NIGHTSHIFTD_DIRS,
      'something-else'
    ])
    expect(inventory.relay).toEqual(RELAY_DIRS)
    expect(inventory.nightshiftd).toEqual(NIGHTSHIFTD_DIRS)
    expect(inventory.unknown).toEqual(['something-else'])
  })
})
