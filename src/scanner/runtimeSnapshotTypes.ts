import type { ScannerDistributionSnapshot } from './distribution'
import type { ScannerAttemptDiagnostics } from './diagnostics'

export type ScannerAssistantState =
  | 'unchecked'
  | 'connecting'
  | 'checking'
  | 'awaiting_elevation'
  | 'connection_failed'
  | 'ready'
  | 'scanning'
  | 'paused'
  | 'completed'

export type ScannerAssistantSnapshot = {
  state: ScannerAssistantState
  permission: 'checking' | 'granted' | 'denied'
  readiness: {
    helperConnected: boolean
    gameFrameReadable: boolean
    accountWriteEnabled: false
  }
  prepare?: {
    observedTotal?: number | null
    expectedTotal?: number | null
    totalSource?: string
    requiresElevation?: boolean
    geometry?: {
      client?: {
        width?: number
        height?: number
      }
    }
    errors?: string[]
    checkedAt?: string
    gameProcessId?: number | null
    /** Read-only preparation facts passed to the native capture gate. */
    playerChecks?: {
      filtersClear: boolean | null
      overlayClear: boolean | null
      inventoryCapacity: number | null
    }
  }
  config: {
    scopeLabel: string
    localOnly: true
    reviewPolicyLabel: string
    safeStopAvailable: true
  }
  progress?: {
    processed: number
    total: number | null
    stageLabel: string
    etaSeconds: number | null
  }
  summary?: {
    reliable: number
    needsReview: number
    unreadable: number
    resultFileHandle: string
    resultStatus: 'ready_for_review' | 'needs_review' | 'blocked_import'
    uniqueRecords: number
    totalSeconds: number
  }
  error?: {
    title?: string
    userMessage: string
    remedy?: string
    recoveryAction: 'retry' | 'request_elevated_scan' | 'open_permission_help' | 'export_diagnostic'
    diagnosticCode?: string
  }
  distribution?: ScannerDistributionSnapshot
  /** Per-attempt, allowlisted technical facts from Helper; no raw log or account data. */
  diagnostics?: ScannerAttemptDiagnostics
}
