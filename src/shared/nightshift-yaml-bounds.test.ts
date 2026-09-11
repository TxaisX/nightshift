import { beforeEach, describe, expect, it, vi } from 'vitest'

const parseDocumentMock = vi.hoisted(() => vi.fn())

vi.mock('yaml', () => ({
  parseDocument: parseDocumentMock
}))

import {
  MAX_NIGHTSHIFT_YAML_ALIAS_COUNT,
  MAX_NIGHTSHIFT_YAML_BYTES,
  MAX_NIGHTSHIFT_YAML_COLLECTION_ENTRIES,
  MAX_NIGHTSHIFT_YAML_FIELD_BYTES,
  MAX_NIGHTSHIFT_YAML_FIELD_CODE_UNITS
} from './nightshift-yaml-file-limit'
import { parseNightshiftYaml } from './nightshift-yaml'

function returnYamlRoot(root: unknown): void {
  parseDocumentMock.mockReturnValue({
    errors: [],
    toJS: vi.fn(() => root)
  })
}

describe('nightshift.yaml parse bounds', () => {
  beforeEach(() => {
    parseDocumentMock.mockReset()
    returnYamlRoot({ scripts: { setup: 'pnpm install' } })
  })

  it('admits the exact UTF-8 input boundary and rejects +1 before YAML parsing', () => {
    expect(parseNightshiftYaml(' '.repeat(MAX_NIGHTSHIFT_YAML_BYTES))).toMatchObject({
      scripts: { setup: 'pnpm install' }
    })
    expect(parseDocumentMock).toHaveBeenCalledOnce()

    parseDocumentMock.mockClear()
    expect(parseNightshiftYaml(' '.repeat(MAX_NIGHTSHIFT_YAML_BYTES + 1))).toBeNull()
    expect(parseDocumentMock).not.toHaveBeenCalled()
  })

  it('rejects a multibyte input over the byte cap before YAML parsing', () => {
    const content = 'é'.repeat(MAX_NIGHTSHIFT_YAML_BYTES / 2 + 1)

    expect(parseNightshiftYaml(content)).toBeNull()
    expect(parseDocumentMock).not.toHaveBeenCalled()
  })

  it('passes an explicit alias expansion cap to YAML conversion', () => {
    const toJS = vi.fn(() => ({ scripts: { setup: 'pnpm install' } }))
    parseDocumentMock.mockReturnValue({ errors: [], toJS })

    expect(parseNightshiftYaml('scripts: {}')).not.toBeNull()
    expect(toJS).toHaveBeenCalledWith({ maxAliasCount: MAX_NIGHTSHIFT_YAML_ALIAS_COUNT })
  })

  it('preserves exact-size fields and drops a field at +1 code unit', () => {
    const exact = 'x'.repeat(MAX_NIGHTSHIFT_YAML_FIELD_CODE_UNITS)
    returnYamlRoot({ scripts: { setup: exact } })
    expect(parseNightshiftYaml('exact')).toMatchObject({ scripts: { setup: exact } })

    returnYamlRoot({ scripts: { setup: `${exact}x` } })
    expect(parseNightshiftYaml('overflow')).toBeNull()

    const exactUtf8 = 'é'.repeat(MAX_NIGHTSHIFT_YAML_FIELD_BYTES / 2)
    returnYamlRoot({ scripts: { setup: exactUtf8 } })
    expect(parseNightshiftYaml('exact-utf8')).toMatchObject({ scripts: { setup: exactUtf8 } })

    returnYamlRoot({ scripts: { setup: `${exactUtf8}é` } })
    expect(parseNightshiftYaml('overflow-utf8')).toBeNull()
  })

  it('admits the exact collection boundary and rejects +1 entries', () => {
    const tabs = Array.from({ length: MAX_NIGHTSHIFT_YAML_COLLECTION_ENTRIES }, (_, index) => ({
      title: `tab-${index}`
    }))
    returnYamlRoot({ defaultTabs: tabs })
    expect(parseNightshiftYaml('exact')?.defaultTabs).toHaveLength(
      MAX_NIGHTSHIFT_YAML_COLLECTION_ENTRIES
    )

    returnYamlRoot({ defaultTabs: [...tabs, { title: 'overflow' }] })
    expect(parseNightshiftYaml('overflow')).toBeNull()
  })
})
