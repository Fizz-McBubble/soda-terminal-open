import { useMemo } from 'react'
import { initialDistributionSnapshot, scannerDistributionManifest } from './distribution'
import type { ScannerAssistantSnapshot } from './runtimeSnapshotTypes'

function compatibilityError(message: string) {
  const error = new Error(message)
  error.name = 'ScannerHelperCompatibilityError'
  return error
}

/** Previous direct-fork helpers remain reachable for updates and result recovery. */
export function verifyScannerHelperIdentity(value: unknown): string {
  const identity = value as Record<string, unknown> | null
  if (
    !identity ||
    identity.service !== 'soda-terminal-scanner-helper' ||
    typeof identity.version !== 'string' ||
    (identity.version !== scannerDistributionManifest.helper.version &&
      !/^2\.3\.[1-9]$/u.test(identity.version)) ||
    identity.protocolVersion !== 5 ||
    identity.transport !== 'direct-fork-http' ||
    identity.accountWriteEnabled !== false ||
    identity.importAccess !== false
  )
    throw compatibilityError('扫描助手未就绪，请更新扫描助手后重新连接。')
  return identity.version
}

export function requireCurrentScannerHelper(version: string | null) {
  if (version !== scannerDistributionManifest.helper.version)
    throw compatibilityError('请更新扫描助手后再扫描。')
}

export function presentScannerHelperUpdate(
  snapshot: ScannerAssistantSnapshot,
): ScannerAssistantSnapshot {
  return {
    ...snapshot,
    distribution: {
      ...(snapshot.distribution ?? initialDistributionSnapshot),
      targetVersion: scannerDistributionManifest.runtime.version,
      state: 'update_available',
      action: 'update',
      message: '请更新扫描助手后再扫描。',
    },
  }
}

export function useScannerHelperAction(
  snapshot: ScannerAssistantSnapshot,
  issueCode: string | null,
) {
  return useMemo(
    () => (issueCode === 'helper_incompatible' ? presentScannerHelperUpdate(snapshot) : snapshot),
    [snapshot, issueCode],
  )
}

export function presentScannerHelperSnapshot(
  snapshot: ScannerAssistantSnapshot,
  helperVersion: string | null,
): ScannerAssistantSnapshot {
  const next =
    snapshot.state === 'paused'
      ? { ...snapshot, state: 'ready' as const, progress: undefined, error: undefined }
      : snapshot
  if (!helperVersion || helperVersion === scannerDistributionManifest.helper.version) return next
  return presentScannerHelperUpdate(next)
}
