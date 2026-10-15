import type { ScannerAssistantSnapshot } from './runtimeSnapshotTypes'

/** Configuration shared by the runtime and isolated transport tests. */
export type ScannerAssistantRuntimeOptions = {
  baseUrl?: string
  token?: string
  fetchImpl?: typeof fetch
  EventSourceImpl?: typeof EventSource
  createObjectURL?: (blob: Blob) => string
  revokeObjectURL?: (url: string) => void
  reconnectDelayMs?: number
  maxReconnectAttempts?: number
  deferInitialConnection?: boolean
  launchProtocol?: (uri: string) => void
  resultRequestTimeoutMs?: number
  helperRequestTimeoutMs?: number
  streamIdleTimeoutMs?: number
}

/** Mutable connection ownership; a disposed or replaced stream cannot publish. */
export type ScannerRuntimeSubscription = {
  listener: (snapshot: ScannerAssistantSnapshot) => void
  events: EventSource | null
  abort: AbortController | null
  reconnectAttempts: number
  disposed: boolean
  interrupted: boolean
}
