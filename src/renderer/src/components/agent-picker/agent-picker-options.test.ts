import { describe, expect, it } from 'vitest'
import { getAgentPickerOptions } from './agent-picker-options'

describe('getAgentPickerOptions', () => {
  it('puts the default agent first when it is detected and enabled', () => {
    expect(getAgentPickerOptions(['codex', 'claude'], 'codex')).toEqual(['codex', 'claude'])
  })

  it('excludes disabled agents', () => {
    expect(getAgentPickerOptions(['claude', 'codex'], null, ['codex'])).toEqual(['claude'])
  })

  it('excludes undetected agents', () => {
    expect(getAgentPickerOptions(['claude'], 'gemini')).toEqual(['claude'])
  })

  it('falls back to catalog order when there is no usable default', () => {
    expect(getAgentPickerOptions(['codex', 'claude'], 'blank')).toEqual(['claude', 'codex'])
  })
})
