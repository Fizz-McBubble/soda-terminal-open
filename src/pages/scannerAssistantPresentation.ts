import type { ScannerAssistantSnapshot } from '../scanner/runtime'

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
  | { status: 'error'; message: string }
