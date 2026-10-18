export type LocalDataFileKind = 'asset-snapshot' | 'account-backup' | 'scan-result'

export const localDataFileMaxBytes = 32 * 1024 * 1024
export const assetSnapshotMaxBytes = 16 * 1024 * 1024

export function localDataFileSizeIssue(
  kind: LocalDataFileKind | null,
  bytes: number,
): 'file_too_large' | 'asset_snapshot_too_large' | null {
  if (bytes > localDataFileMaxBytes) return 'file_too_large'
  if (kind === 'asset-snapshot' && bytes > assetSnapshotMaxBytes)
    return 'asset_snapshot_too_large'
  return null
}

/** Routing only. Each destination still runs its full preflight before any write. */
export function detectLocalDataFileKind(text: string): LocalDataFileKind | null {
  try {
    const input: unknown = JSON.parse(text)
    if (!input || typeof input !== 'object') return null
    if ('schema' in input && input.schema === 'soda-asset-snapshot-probe/v1')
      return 'asset-snapshot'
    if (!('format' in input)) return null
    if (input.format === 'soda-terminal-account-backup') return 'account-backup'
    if (input.format === 'soda-terminal-scan-staging') return 'scan-result'
  } catch {
    // Let the destination's existing validator explain malformed or unsupported files.
  }
  return null
}
