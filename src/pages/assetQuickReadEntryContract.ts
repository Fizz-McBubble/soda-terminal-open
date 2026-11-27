import type { ReactNode } from 'react'

export type AssetQuickReadState =
  | 'idle'
  | 'starting'
  | 'capturing'
  | 'received'
  | 'timed_out'
  | 'stopped'
  | 'error'
  | 'completed'

export interface AssetQuickReadPreview {
  /** Identifies this exact candidate (the adapter may use the snapshot SHA-256). */
  snapshotId: string
  counts: { agents: number; discs: number }
  validSummary: string[]
  compactSummary?: string[]
  issues: string[]
  issueSummary?: string[]
  agents: Array<{
    agentId: string
    name: string
    level?: number
    mindscape?: number
    skills?: string
    wEngine?: string
  }>
}

export interface AssetQuickReadEntryProps {
  /** Only the real independent tool adapter may report ready. */
  connectedBridgeVersion?: string
  capability?: 'unavailable' | 'ready'
  /** Controlled by the adapter; this component never simulates capture or a deadline. */
  state?: AssetQuickReadState
  onConnect?: () => void | Promise<void>
  installationDirectory?: string
  onDirectoryChange?: (value: string) => void
  targetAccountId?: string
  targetAccountName?: string
  targetRequired?: boolean
  onStart?: () => void | Promise<void>
  onStop?: () => void | Promise<void>
  onImport?: () => void | Promise<void>
  onDiscard?: () => void | Promise<void>
  onPrepareAgain?: () => void | Promise<void>
  onExport?: () => void | Promise<void>
  onInspectFile?: () => void | Promise<void>
  onVerifyOriginalFile?: () => void
  canImport?: boolean
  preview?: AssetQuickReadPreview
  elapsedSeconds?: number
  remainingSeconds?: number
  /** Describes the adapter's actual transaction scope and recovery behavior. */
  transactionNotice?: string
  resultSaveNotice?: string
  errorMessage?: string
  completionMessage?: string
  onClose?: () => void
  onContinueScanning?: () => void
  blocked?: boolean
  preparationCondensed?: boolean
  onViewAssets?: () => void
  completionActions?: ReactNode
  preparationRecovery?: ReactNode
  resumeAvailable?: boolean
  pendingResultStatus?: 'loading' | 'none' | 'available' | 'error'
  riskNoticeHref?: string
  installer?: ReactNode
  downloadAvailable?: boolean
  diagnosticAction?:
    | ReactNode
    | ((status: { message: string; role: 'alert' | 'status' }) => ReactNode)
  workbenchExtras?:
    | ReactNode
    | ((status: { message: string; role: 'alert' | 'status' }) => ReactNode)
  pendingInspection?: boolean
  renderParts?: (parts: {
    preparation: ReactNode
    task: ReactNode | null
    stageActive: boolean
  }) => ReactNode
}
