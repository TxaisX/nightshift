import { measureUtf8ByteLength } from './utf8-byte-limits'

export const MAX_NIGHTSHIFT_YAML_BYTES = 256 * 1024
export const MAX_NIGHTSHIFT_YAML_CODE_UNITS = 256 * 1024
export const MAX_NIGHTSHIFT_YAML_FIELD_BYTES = 64 * 1024
export const MAX_NIGHTSHIFT_YAML_FIELD_CODE_UNITS = 64 * 1024
export const MAX_NIGHTSHIFT_YAML_COLLECTION_ENTRIES = 256
// The yaml parser rejects on `useCount * subtreeAliasCount`, so exponential expansion is caught by
// the multiplication regardless of this value; lowering it only rejects flat, linear reuse. Keep the
// library default so a nightshift.yaml that merges one anchor into many tabs still parses.
export const MAX_NIGHTSHIFT_YAML_ALIAS_COUNT = 100

export function isNightshiftYamlTextWithinLimit(content: string): boolean {
  return (
    content.length <= MAX_NIGHTSHIFT_YAML_CODE_UNITS &&
    !measureUtf8ByteLength(content, { stopAfterBytes: MAX_NIGHTSHIFT_YAML_BYTES }).exceededLimit
  )
}

export function isNightshiftYamlFieldWithinLimit(value: string): boolean {
  return (
    value.length <= MAX_NIGHTSHIFT_YAML_FIELD_CODE_UNITS &&
    !measureUtf8ByteLength(value, { stopAfterBytes: MAX_NIGHTSHIFT_YAML_FIELD_BYTES }).exceededLimit
  )
}
