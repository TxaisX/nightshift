// Why a re-export: main-process discovery scans need the same hoisted collators,
// so the implementation moved to src/shared. Renderer callers keep this import
// path, which is the one they already use.
export {
  compareBaseSensitivityLocaleText,
  compareNumericLocaleText
} from '../../../shared/locale-text-collators'
