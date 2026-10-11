import { useMemo } from 'react'
import { initialDistributionSnapshot, scannerDistributionManifest } from './distribution'
import type { ScannerAssistantSnapshot } from './runtimeSnapshotTypes'
import {
  compareToolVersion,
  scannerToolUpgradeNotice,
  scannerToolReleaseVersions,
  type ScannerToolVersions,
} from './toolUpgradeNotice'

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
      !/^2\.3\.[1-9]\d*$/u.test(identity.version)) ||
    identity.protocolVersion !== 5 ||
    identity.transport !== 'direct-fork-http' ||
    identity.accountWriteEnabled !== false ||
    identity.importAccess !== false
  )
    throw compatibilityError(
      '画面扫描未就绪：扫描助手版本或连接协议不兼容，请更新扫描助手后重新连接。',
    )
  return identity.version
}

export function requireCurrentScannerHelper(version: string | null) {
  const comparison = compareToolVersion(version, scannerDistributionManifest.helper.version)
  if (!version || !/^2\.3\.[1-9]\d*$/u.test(version) || comparison === null || comparison < 0)
    throw compatibilityError('请更新画面扫描后再扫描。')
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
      message: '请更新画面扫描后再扫描。',
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
  connectedVersions: ScannerToolVersions = {},
  targetVersions: ScannerToolVersions = scannerToolReleaseVersions,
): ScannerAssistantSnapshot {
  const next =
    snapshot.state === 'paused'
      ? { ...snapshot, state: 'ready' as const, progress: undefined, error: undefined }
      : snapshot
  const notice = scannerToolUpgradeNotice(
    { ...connectedVersions, helper: helperVersion },
    targetVersions,
  )
  if (!notice) return next
  const updated = presentScannerHelperUpdate(next)
  return { ...updated, distribution: { ...updated.distribution!, message: notice } }
}
