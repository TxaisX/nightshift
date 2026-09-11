// Build-time diagnostic upload routing. Kept outside ipc/diagnostics.ts so
// crash reporting can attach logs through the same pinned endpoint rules.

export function resolveDiagnosticBuildTokenEndpoint(): string | null {
  const endpoint =
    typeof NIGHTSHIFT_DIAGNOSTICS_TOKEN_URL !== 'undefined'
      ? NIGHTSHIFT_DIAGNOSTICS_TOKEN_URL
      : ((globalThis as { NIGHTSHIFT_DIAGNOSTICS_TOKEN_URL?: string | null })
          .NIGHTSHIFT_DIAGNOSTICS_TOKEN_URL ?? null)
  return typeof endpoint === 'string' && endpoint.length > 0 ? endpoint : null
}

export function resolveDiagnosticBuildIdentity(): 'stable' | 'rc' | null {
  const ident =
    typeof NIGHTSHIFT_BUILD_IDENTITY !== 'undefined'
      ? NIGHTSHIFT_BUILD_IDENTITY
      : ((globalThis as { NIGHTSHIFT_BUILD_IDENTITY?: 'stable' | 'rc' | null })
          .NIGHTSHIFT_BUILD_IDENTITY ?? null)
  return ident === 'stable' || ident === 'rc' ? ident : null
}

export function resolveDiagnosticTokenEndpoint(): string | null {
  const buildEndpoint = resolveDiagnosticBuildTokenEndpoint()
  // Official builds must stay pinned to the CI-substituted endpoint; user env
  // cannot redirect uploads that the UI labels as going to Nightshift support.
  if (resolveDiagnosticBuildIdentity()) {
    return buildEndpoint
  }
  const fromEnv = process.env.NIGHTSHIFT_DIAGNOSTICS_TOKEN_URL
  if (fromEnv && fromEnv.length > 0) {
    return fromEnv
  }
  return buildEndpoint
}

export function resolveDiagnosticNightshiftChannel(): 'stable' | 'rc' | 'dev' {
  const ident = resolveDiagnosticBuildIdentity()
  if (ident === 'stable' || ident === 'rc') {
    return ident
  }
  return 'dev'
}
