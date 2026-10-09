export type LocalDataFileKind = 'account-backup' | 'scan-result'

/** Routing only. Each destination still runs its full preflight before any write. */
export function detectLocalDataFileKind(text: string): LocalDataFileKind | null {
  try {
    const input: unknown = JSON.parse(text)
    if (!input || typeof input !== 'object' || !('format' in input)) return null
    if (input.format === 'soda-terminal-account-backup') return 'account-backup'
    if (input.format === 'soda-terminal-scan-staging') return 'scan-result'
  } catch {
    // Let the destination's existing validator explain malformed or unsupported files.
  }
  return null
}
