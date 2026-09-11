import { RuntimeClientError } from '../../runtime-client'

export function resolveCompatibilityCliCommand():
  | 'nightshift'
  | 'nightshift-ide'
  | 'nightshift-dev' {
  const configured = process.env.NIGHTSHIFT_CLI_COMMAND
  if (
    configured === 'nightshift' ||
    configured === 'nightshift-ide' ||
    configured === 'nightshift-dev'
  ) {
    return configured
  }
  return process.platform === 'linux' ? 'nightshift-ide' : 'nightshift'
}

export function resolvePackagedWindowsCompatibilityCommand():
  | 'nightshift'
  | 'nightshift-ide'
  | undefined {
  if (process.env.NIGHTSHIFT_WINDOWS_PACKAGED_CLI_LAUNCHER !== '1') {
    return undefined
  }
  const command = process.env.NIGHTSHIFT_CLI_COMMAND
  if (command === 'nightshift' || command === 'nightshift-ide') {
    return command
  }
  throw new RuntimeClientError(
    'invalid_argument',
    'The packaged Nightshift launcher did not provide a valid resume command. No question was created.'
  )
}

export async function flushOrchestrationStdout(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    process.stdout.write('', (error) => {
      if (error) {
        reject(error)
      } else {
        resolve()
      }
    })
  })
}

export function isDevCliInvocation(): boolean {
  return (
    process.env.NIGHTSHIFT_DEV_CLI_INVOCATION === '1' ||
    (process.env.NIGHTSHIFT_USER_DATA_PATH?.includes('nightshift-dev') ?? false)
  )
}
