import { useEffect, useMemo, useState } from 'react'
import type { ScannerDistributionSnapshot } from './distribution'
import { connectingSnapshot, createDevSnapshot, failedSnapshot } from './runtimeSnapshots'
import { resolveScannerHelperSessionToken } from './scannerSessionToken'
import { createDevelopmentScannerCommands } from './runtimeDevelopmentCommands'

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
}

export type ScannerAssistantCommands = {
  openHelper(launchImmediately?: boolean): Promise<void>
  retryConnection(): Promise<void>
  startScan(): Promise<void>
  safeStop(): Promise<void>
  revokePairing(): Promise<void>
  requestResultFile(): Promise<{
    resultFileHandle: string
    resultStatus: string
    accountWriteEnabled: false
  }>
  requestResultStaging(resultFileHandle: string): Promise<unknown>
  requestResultEvidence(
    resultFileHandle: string,
    itemId: string,
  ): Promise<{
    availability: 'available'
    detailSrc: string
    cardSrc: string
    visualDetailHash: string
    revoke(): void
  }>
}

export function createScannerAssistantRuntime(
  options: {
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
  } = {},
) {
  const baseUrl = options.baseUrl ?? 'http://127.0.0.1:43127'
  let token = options.token ?? import.meta.env.VITE_SCANNER_HELPER_TOKEN ?? ''
  let tokenResolved = false
  let nativeIdentityVerified = false
  const fetchImpl = options.fetchImpl ?? fetch
  const EventSourceImpl = options.EventSourceImpl ?? null
  const reconnectDelayMs = options.reconnectDelayMs ?? 250
  const maxReconnectAttempts = options.maxReconnectAttempts ?? 20
  const createObjectURL = options.createObjectURL ?? ((blob: Blob) => URL.createObjectURL(blob))
  const revokeObjectURL = options.revokeObjectURL ?? ((url: string) => URL.revokeObjectURL(url))
  let activeSubscription: {
    listener: (snapshot: ScannerAssistantSnapshot) => void
    events: EventSource | null
    abort: AbortController | null
    reconnectAttempts: number
    disposed: boolean
  } | null = null

  function connectEvents(subscription: NonNullable<typeof activeSubscription>, issued: string) {
    if (subscription.disposed) return
    subscription.events?.close()
    subscription.abort?.abort()
    if (!EventSourceImpl) {
      const controller = new AbortController()
      subscription.abort = controller
      void readAuthenticatedEvents(subscription, issued, controller)
      return
    }
    // The injected event source is used by isolated tests; production uses fetch
    // because browser EventSource cannot send an authorization header.
    const events = new EventSourceImpl(`${baseUrl}/api/events`, {
      headers: { 'X-Soda-Scanner-Token': issued },
    } as EventSourceInit)
    subscription.events = events
    events.onmessage = (event) => {
      if (subscription.disposed || subscription.events !== events) return
      const next = JSON.parse(event.data) as ScannerAssistantSnapshot
      subscription.listener(
        next.state === 'paused'
          ? { ...next, state: 'ready', progress: undefined, error: undefined }
          : next,
      )
    }
    events.onerror = () => {
      if (subscription.disposed || subscription.events !== events) return
      if (!document.hidden) subscription.listener(failedSnapshot)
    }
  }

  async function readAuthenticatedEvents(
    subscription: NonNullable<typeof activeSubscription>,
    issued: string,
    controller: AbortController,
  ) {
    try {
      const response = await fetchImpl(`${baseUrl}/api/events`, {
        headers: { 'X-Soda-Scanner-Token': issued },
        signal: controller.signal,
        cache: 'no-store',
      })
      if (!response.ok || !response.body) throw new Error(`helper_events_failed_${response.status}`)
      subscription.reconnectAttempts = 0
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let pending = ''
      while (!controller.signal.aborted) {
        const { done, value } = await reader.read()
        if (done) break
        pending += decoder.decode(value, { stream: true })
        let boundary = pending.indexOf('\n\n')
        while (boundary >= 0) {
          const frame = pending.slice(0, boundary).replaceAll('\r', '')
          pending = pending.slice(boundary + 2)
          const data = frame
            .split('\n')
            .filter((line) => line.startsWith('data:'))
            .map((line) => line.slice(5).trimStart())
            .join('\n')
          if (data && !subscription.disposed && subscription.abort === controller) {
            const next = JSON.parse(data) as ScannerAssistantSnapshot
            subscription.listener(
              next.state === 'paused'
                ? { ...next, state: 'ready', progress: undefined, error: undefined }
                : next,
            )
          }
          boundary = pending.indexOf('\n\n')
        }
      }
      if (!controller.signal.aborted) throw new Error('helper_events_disconnected')
    } catch (error) {
      if (!controller.signal.aborted && !subscription.disposed && !document.hidden) {
        subscription.listener(failedSnapshot)
        if (subscription.reconnectAttempts++ < maxReconnectAttempts) {
          window.setTimeout(() => {
            if (subscription.disposed || subscription.abort !== controller) return
            if (error instanceof Error && error.message === 'helper_events_failed_401') {
              token = ''
              tokenResolved = false
            }
            void ensureSessionToken()
              .then((next) => connectEvents(subscription, next))
              .catch(() => subscription.listener(failedSnapshot))
          }, reconnectDelayMs)
        }
      }
    }
  }

  function reconnectActiveSubscription() {
    if (activeSubscription && token) connectEvents(activeSubscription, token)
  }

  async function verifyNativeHelper() {
    const response = await fetchImpl(`${baseUrl}/`)
    const identity = response.ok ? await response.json() : null
    if (
      !identity ||
      identity.service !== 'soda-terminal-scanner-helper' ||
      !['2.3.1', '2.3.2', '2.3.3', '2.3.4'].includes(identity.version) ||
      identity.protocolVersion !== 5 ||
      identity.transport !== 'direct-fork-http' ||
      identity.accountWriteEnabled !== false ||
      identity.importAccess !== false
    ) {
      const error = new Error('扫描助手未就绪，请关闭旧扫描助手，再重新打开 Soda Terminal。')
      error.name = 'ScannerHelperCompatibilityError'
      throw error
    }
    nativeIdentityVerified = true
  }

  async function ensureSessionToken() {
    if (!nativeIdentityVerified) await verifyNativeHelper()
    if (tokenResolved && token) return token
    token = await resolveScannerHelperSessionToken({
      baseUrl,
      initialToken: token,
      fetchImpl,
      origin: window.location.origin,
      fallbackErrorCode: 'helper_token_request_failed',
    })
    tokenResolved = true
    return token
  }

  async function command(path: string, method = 'POST') {
    await verifyNativeHelper()
    await ensureSessionToken()
    const request = () =>
      fetchImpl(`${baseUrl}${path}`, {
        method,
        headers: { 'X-Soda-Scanner-Token': token },
      })
    let response = await request()
    if (response.status === 401) {
      // Restarted native helpers issue a new session. A rejected request has not
      // entered the authenticated command handler, so retry it once after renewal.
      token = ''
      tokenResolved = false
      nativeIdentityVerified = false
      await ensureSessionToken()
      response = await request()
      if (response.ok) reconnectActiveSubscription()
    }
    if (!response.ok) throw new Error(`helper_request_failed_${response.status}`)
    return response.json()
  }

  async function readAuthenticatedImage(path: string) {
    await ensureSessionToken()
    const response = await fetchImpl(new URL(path, baseUrl).toString(), {
      headers: { 'X-Soda-Scanner-Token': token },
    })
    const contentType = response.headers.get('content-type')?.toLowerCase() ?? ''
    if (!response.ok) throw new Error(`helper_evidence_request_failed_${response.status}`)
    if (!contentType.startsWith('image/')) throw new Error('helper_evidence_content_type_invalid')
    return createObjectURL(await response.blob())
  }

  async function retryUntilConnected() {
    let lastError: unknown
    for (let attempt = 0; attempt < maxReconnectAttempts; attempt += 1) {
      try {
        await command('/api/retry')
        return
      } catch (error) {
        if (isAuthenticationFailure(error) || isCompatibilityFailure(error)) throw error
        lastError = error
        if (attempt + 1 < maxReconnectAttempts)
          await new Promise((resolve) => window.setTimeout(resolve, reconnectDelayMs))
      }
    }
    throw lastError instanceof Error ? lastError : new Error('helper_unavailable')
  }

  function isAuthenticationFailure(error: unknown) {
    return (
      error instanceof Error &&
      (error.message === 'helper_request_failed_401' || error.message === 'helper_pairing_denied')
    )
  }

  function isCompatibilityFailure(error: unknown) {
    return error instanceof Error && error.name === 'ScannerHelperCompatibilityError'
  }

  function connectionFailure(error: unknown) {
    if (error instanceof Error && error.message === 'helper_pairing_denied')
      return {
        ...failedSnapshot,
        error: {
          ...failedSnapshot.error!,
          userMessage: '本机扫描助手拒绝了此网站。请确认使用受支持的 Soda Terminal 网址，再重新连接。',
          diagnosticCode: 'helper_pairing_denied',
        },
      }
    return isCompatibilityFailure(error)
      ? {
          ...failedSnapshot,
          error: {
            ...failedSnapshot.error!,
            userMessage: (error as Error).message,
            diagnosticCode: 'helper_incompatible',
          },
        }
      : failedSnapshot
  }

  return {
    hasSession: true,
    subscribe(listener: (snapshot: ScannerAssistantSnapshot) => void) {
      const subscription = {
        listener,
        events: null as EventSource | null,
        abort: null as AbortController | null,
        reconnectAttempts: 0,
        disposed: false,
      }
      activeSubscription = subscription
      // A public HTTPS page must explain local-device access before the first
      // loopback fetch, which can trigger the browser's local-network prompt.
      if (!options.deferInitialConnection)
        void ensureSessionToken()
          .then((issued) => {
            connectEvents(subscription, issued)
          })
          .catch((error: unknown) => {
            if (!subscription.disposed) listener(connectionFailure(error))
          })
      return () => {
        subscription.disposed = true
        subscription.events?.close()
        subscription.abort?.abort()
        if (activeSubscription === subscription) activeSubscription = null
      }
    },
    commands: {
      async openHelper(launchImmediately = false) {
        if (launchImmediately) {
          const uri = `soda-terminal-scanner://open?origin=${encodeURIComponent(window.location.origin)}`
          if (options.launchProtocol) options.launchProtocol(uri)
          else window.location.href = uri
          token = ''
          tokenResolved = false
          await retryUntilConnected()
          reconnectActiveSubscription()
          return
        }
        try {
          await retryUntilConnected()
        } catch (error) {
          if (isAuthenticationFailure(error) || isCompatibilityFailure(error)) throw error
          window.location.href = `soda-terminal-scanner://open?origin=${encodeURIComponent(window.location.origin)}`
          token = ''
          tokenResolved = false
          await retryUntilConnected()
        }
        reconnectActiveSubscription()
      },
      async retryConnection() {
        try {
          await retryUntilConnected()
        } catch (error) {
          if (isAuthenticationFailure(error) || isCompatibilityFailure(error)) throw error
          token = ''
          tokenResolved = false
          await retryUntilConnected()
        }
        reconnectActiveSubscription()
      },
      async startScan() {
        await command('/api/start')
      },
      async safeStop() {
        await command('/api/stop')
      },
      async revokePairing() {
        await command('/api/revoke')
        token = ''
        tokenResolved = false
        activeSubscription?.events?.close()
        activeSubscription?.abort?.abort()
        activeSubscription?.listener(failedSnapshot)
      },
      async requestResultFile() {
        return command('/api/result') as Promise<{
          resultFileHandle: string
          resultStatus: string
          accountWriteEnabled: false
        }>
      },
      async requestResultStaging(resultFileHandle) {
        return command(`/api/result/${encodeURIComponent(resultFileHandle)}`, 'GET')
      },
      async requestResultEvidence(resultFileHandle, itemId) {
        const projection = (await command(
          `/api/result/${encodeURIComponent(resultFileHandle)}/evidence/${encodeURIComponent(itemId)}`,
          'GET',
        )) as {
          availability: 'available'
          detailSrc: string
          cardSrc: string
          visualDetailHash: string
        }
        let detailSrc = ''
        let cardSrc = ''
        try {
          detailSrc = await readAuthenticatedImage(projection.detailSrc)
          cardSrc = await readAuthenticatedImage(projection.cardSrc)
          return {
            availability: projection.availability,
            detailSrc,
            cardSrc,
            visualDetailHash: projection.visualDetailHash,
            revoke() {
              revokeObjectURL(detailSrc)
              revokeObjectURL(cardSrc)
            },
          }
        } catch (error) {
          if (detailSrc) revokeObjectURL(detailSrc)
          if (cardSrc) revokeObjectURL(cardSrc)
          throw error
        }
      },
    } satisfies ScannerAssistantCommands,
  }
}

export function useScannerAssistantRuntime() {
  const runtime = useMemo(
    () =>
      createScannerAssistantRuntime({
        deferInitialConnection: window.location.protocol === 'https:',
      }),
    [],
  )
  const devState = useMemo(() => {
    if (!import.meta.env.DEV) return null
    const params = new URLSearchParams(window.location.search)
    return createDevSnapshot(params.get('prepareState') ?? params.get('assistantState'))
  }, [])
  const [snapshot, setSnapshot] = useState<ScannerAssistantSnapshot>(
    () => devState ?? connectingSnapshot,
  )

  useEffect(() => {
    if (devState) return
    return runtime.subscribe(setSnapshot)
  }, [devState, runtime])

  const devCommands = useMemo(() => createDevelopmentScannerCommands(setSnapshot), [])

  return { snapshot, commands: devState ? devCommands : runtime.commands }
}
