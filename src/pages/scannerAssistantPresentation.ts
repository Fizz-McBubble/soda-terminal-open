import type { ScannerAssistantSnapshot } from '../scanner/runtime'

export function getAverageScannerRate(snapshot: ScannerAssistantSnapshot): number | null {
  const recognized =
    snapshot.state === 'completed'
      ? snapshot.summary?.uniqueRecords
      : snapshot.diagnostics?.counts?.processed
  const elapsedMs = snapshot.diagnostics?.durationMs ?? (snapshot.summary?.totalSeconds ?? 0) * 1000
  if (
    typeof recognized !== 'number' ||
    !Number.isFinite(recognized) ||
    recognized <= 0 ||
    !Number.isFinite(elapsedMs) ||
    elapsedMs <= 0
  )
    return null
  return Math.round((recognized * 60000) / elapsedMs)
}

export const scannerSteps = [
  { id: 'account', label: '选择账户' },
  { id: 'helper', label: '启动 Helper' },
  { id: 'review', label: '检查结果' },
  { id: 'import', label: '正式导入' },
] as const

export const scannerStateStep: Record<ScannerAssistantSnapshot['state'], number> = {
  unchecked: 0,
  connecting: 1,
  checking: 1,
  awaiting_elevation: 1,
  connection_failed: 0,
  ready: 0,
  scanning: 1,
  paused: 1,
  completed: 2,
}

export type PrepareCheckStatus = 'unchecked' | 'checking' | 'ready' | 'blocked'

export type PrepareCheck = {
  id: string
  label: string
  status: PrepareCheckStatus
  instruction: string
  feedback: string
}

export type HandoffState =
  | { status: 'idle' }
  | { status: 'working'; message: string }
  | { status: 'success'; message: string }
  | {
      status: 'error'
      message: string
      issueCode?:
        | 'scan_result_timeout'
        | 'scan_result_read_failed'
        | 'scan_import_handoff_failed'
        | 'scan_import_failed'
        | 'scan_file_invalid'
    }
