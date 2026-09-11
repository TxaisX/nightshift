export function getNightshiftCliCommandNameForPlatform(platform: NodeJS.Platform): string {
  if (platform === 'linux') {
    return 'nightshift-ide'
  }
  if (platform === 'win32') {
    return 'nightshift.cmd'
  }
  return 'nightshift'
}
