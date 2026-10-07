import { vi } from 'vitest'
import { createScannerAssistantRuntime, type ScannerAssistantSnapshot } from './runtime'

export const nativeIdentity = {
  service: 'soda-terminal-scanner-helper',
  version: '2.3.1',
  protocolVersion: 5,
  transport: 'direct-fork-http',
  accountWriteEnabled: false,
  importAccess: false,
}

export function createNativeFixtureRuntime(
  options: Parameters<typeof createScannerAssistantRuntime>[0],
) {
  const fetchImpl = options?.fetchImpl
  return createScannerAssistantRuntime({
    ...options,
    fetchImpl: (input, init) =>
      new URL(String(input)).pathname === '/'
        ? Promise.resolve(new Response(JSON.stringify(nativeIdentity)))
        : fetchImpl!(input, init),
  })
}

export class FakeEventSource {
  static latest: FakeEventSource | null = null
  static instances: FakeEventSource[] = []
  readonly url: string
  readonly authorization: string | undefined
  onmessage: ((event: MessageEvent<string>) => void) | null = null
  onerror: (() => void) | null = null
  closed = false

  constructor(url: string | URL, options?: { headers?: Record<string, string> }) {
    this.url = String(url)
    this.authorization = options?.headers?.['X-Soda-Scanner-Token']
    FakeEventSource.latest = this
    FakeEventSource.instances.push(this)
  }

  close() {
    this.closed = true
  }

  emit(snapshot: ScannerAssistantSnapshot) {
    this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(snapshot) }))
  }
}

export const readySnapshot: ScannerAssistantSnapshot = {
  state: 'ready',
  permission: 'granted',
  readiness: { helperConnected: true, gameFrameReadable: true, accountWriteEnabled: false },
  config: {
    scopeLabel: '完整驱动盘仓库 · 当场读取数量',
    localOnly: true,
    reviewPolicyLabel: '证据不足时保留检查',
    safeStopAvailable: true,
  },
}

export function helperFetch() {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = new URL(String(input)).pathname
    const bodies: Record<string, unknown> = {
      '/token': { token: 'a'.repeat(48) },
      '/_soda/runtime-config': { scannerToken: 'a'.repeat(48) },
      '/api/retry': readySnapshot,
      '/api/start': { ...readySnapshot, state: 'scanning' },
      '/api/stop': readySnapshot,
      '/api/result': {
        resultFileHandle: 'scanner-r10c-test',
        resultStatus: 'needs_review',
        accountWriteEnabled: false,
      },
    }
    return {
      ok:
        path === '/token' ||
        path === '/_soda/runtime-config' ||
        (init?.headers instanceof Headers
          ? init.headers.get('X-Soda-Scanner-Token') === 'a'.repeat(48)
          : (init?.headers as Record<string, string>)?.['X-Soda-Scanner-Token'] === 'a'.repeat(48)),
      status: 200,
      json: async () => bodies[path],
    } as Response
  })
}
