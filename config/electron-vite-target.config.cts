import { defineConfig } from 'electron-vite'
import { electronViteConfig } from '../electron.vite.config'

const target = process.env.NIGHTSHIFT_ELECTRON_VITE_TARGET
const configByTarget = {
  main: { main: electronViteConfig.main },
  preload: { preload: electronViteConfig.preload },
  renderer: { renderer: electronViteConfig.renderer }
}

if (!target || !Object.hasOwn(configByTarget, target)) {
  throw new Error(`Invalid NIGHTSHIFT_ELECTRON_VITE_TARGET: ${target ?? '<unset>'}`)
}

export default defineConfig(configByTarget[target as keyof typeof configByTarget])
