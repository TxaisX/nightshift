// Why hoisted: `localeCompare(a, b, undefined, options)` resolves a fresh ICU
// collator on every comparison (~14x this form — see file-name-sort.ts), so a
// comparator that calls it pays that setup O(n log n) times per sort. Resolving
// once and reusing `.compare` keeps identical ordering at a fraction of the cost.
// Shared rather than renderer-local so main-process discovery scans (skills,
// Warp themes) get the same ordering and the same saving.
let baseSensitivityCollator: Intl.Collator | undefined
let numericCollator: Intl.Collator | undefined

export function compareBaseSensitivityLocaleText(a: string, b: string): number {
  // Why lazy: matches localeCompare's own behaviour of resolving on first use,
  // so importing this module never costs ICU setup in a process that never sorts.
  baseSensitivityCollator ??= new Intl.Collator(undefined, { sensitivity: 'base' })
  return baseSensitivityCollator.compare(a, b)
}

export function compareNumericLocaleText(a: string, b: string): number {
  numericCollator ??= new Intl.Collator(undefined, { numeric: true })
  return numericCollator.compare(a, b)
}
