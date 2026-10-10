import {
  connectionFailure,
  isAuthenticationFailure,
  isCompatibilityFailure,
} from './runtimeConnectionErrors'
import type { ScannerAssistantCommands } from './runtimeCommands'
export type { ScannerAssistantCommands } from './runtimeCommands'
import { useEffect, useMemo, useState } from 'react'
import { connectingSnapshot, createDevSnapshot, failedSnapshot } from './runtimeSnapshots'
import { resolveScannerHelperSessionToken } from './scannerSessionToken'
import { createDevelopmentScannerCommands } from './runtimeDevelopmentCommands'
import { readScannerResultWithDeadline } from './resultRead'
import { withScannerRequestDeadline } from './requestDeadline'
import {
  presentScannerHelperSnapshot,
  requireCurrentScannerHelper,
  verifyScannerHelperIdentity,
} from './runtimeHelperVersion'

import type { ScannerAssistantSnapshot } from './runtimeSnapshotTypes'
export type { ScannerAssistantSnapshot, ScannerAssistantState } from './runtimeSnapshotTypes'

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
    resultRequestTimeoutMs?: number
    helperRequestTimeoutMs?: number
    streamIdleTimeoutMs?: number
  } = {},
) {
  const baseUrl = options.baseUrl ?? 'http://127.0.0.1:43127'
  let token = options.token ?? import.meta.env.VITE_SCANNER_HELPER_TOKEN ?? ''
  let tokenResolved = false
  let nativeIdentityVerified = false
  let nativeHelperVersion: string | null = null
  const fetchImpl = options.fetchImpl ?? fetch
  const EventSourceImpl = options.EventSourceImpl ?? null
  const reconnectDelayMs = options.reconnectDelayMs ?? 250
  const maxReconnectAttempts = options.maxReconnectAttempts ?? 20
  const helperRequestTimeoutMs = options.helperRequestTimeoutMs ?? 30000
  const createObjectURL = options.createObjectURL ?? ((blob: Blob) => URL.createObjectURL(blob))
  const revokeObjectURL = options.revokeObjectURL ?? ((url: string) => URL.revokeObjectURL(url))
  let activeSubscription: {
    listener: (snapshot: ScannerAssistantSnapshot) => void
    events: EventSource | null
    abort: AbortController | null
    reconnectAttempts: number
    disposed: boolean
    interrupted: boolean
  } | null = null

  function withHelperDeadline<T>(
    operation: (signal: AbortSignal) => Promise<T>,
    signal?: AbortSignal,
  ) {
    return withScannerRequestDeadline(operation, signal, helperRequestTimeoutMs, () => {
      const error = new Error(
        '连接尚未完成。请确认画面扫描已运行；若浏览器显示本机设备权限，请先允许，再重新连接。',
      )
      error.name = 'ScannerHelperTimeoutError'
      return error
    })
  }

  function publishSnapshot(value: unknown) {
    const next = value as ScannerAssistantSnapshot | undefined
    if (
      next?.state &&
      next.readiness &&
      next.config &&
      activeSubscription &&
      !activeSubscription.disposed
    )
      activeSubscription.listener(presentScannerHelperSnapshot(next, nativeHelperVersion))
  }

  function connectEvents(subscription: NonNullable<typeof activeSubscription>, issued: string) {
    if (subscription.disposed) return
    subscription.interrupted = false
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
      subscription.listener(presentScannerHelperSnapshot(next, nativeHelperVersion))
    }
    events.onerror = () => {
      if (subscription.disposed || subscription.events !== events) return
      subscription.interrupted = true
      if (!document.hidden) subscription.listener(failedSnapshot)
    }
  }

  async function readAuthenticatedEvents(
    subscription: NonNullable<typeof activeSubscription>,
    issued: string,
    controller: AbortController,
  ) {
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
    try {
      const response = await withHelperDeadline(
        () =>
          fetchImpl(`${baseUrl}/api/events`, {
            headers: { 'X-Soda-Scanner-Token': issued },
            signal: controller.signal,
            cache: 'no-store',
          }),
        controller.signal,
      )
      if (!response.ok || !response.body) throw new Error(`helper_events_failed_${response.status}`)
      subscription.reconnectAttempts = 0
      reader = response.body.getReader()
      const decoder = new TextDecoder()
      let pending = ''
      while (!controller.signal.aborted) {
        const { done, value } = await withScannerRequestDeadline(
          () => reader!.read(),
          controller.signal,
          options.streamIdleTimeoutMs ?? 45000,
          () => new Error('helper_events_timeout'),
        )
        if (done) break
        pending += decoder.decode(value, { stream: true })
        let separator = /\r?\n\r?\n/.exec(pending)
        while (separator) {
          const frame = pending.slice(0, separator.index).replaceAll('\r', '')
          pending = pending.slice(separator.index + separator[0].length)
          const data = frame
            .split('\n')
            .filter((line) => line.startsWith('data:'))
            .map((line) => line.slice(5).trimStart())
            .join('\n')
          if (data && !subscription.disposed && subscription.abort === controller) {
            const next = JSON.parse(data) as ScannerAssistantSnapshot
            subscription.listener(presentScannerHelperSnapshot(next, nativeHelperVersion))
          }
          separator = /\r?\n\r?\n/.exec(pending)
        }
      }
      if (!controller.signal.aborted) throw new Error('helper_events_disconnected')
    } catch (error) {
      if (subscription.disposed || subscription.abort !== controller) return
      if (controller.signal.aborted) return
      subscription.interrupted = true
      controller.abort()
      if (!document.hidden) {
        subscription.listener(failedSnapshot)
        if (subscription.reconnectAttempts++ < maxReconnectAttempts) {
          window.setTimeout(() => {
            if (subscription.disposed || subscription.abort !== controller) return
            if (error instanceof Error && error.message === 'helper_events_failed_401') {
              token = ''
              tokenResolved = false
            }
            void withHelperDeadline((signal) => ensureSessionToken(signal))
              .then((next) => connectEvents(subscription, next))
              .catch(() => {
                if (!subscription.disposed) subscription.listener(failedSnapshot)
              })
          }, reconnectDelayMs)
        }
      }
    } finally {
      if (reader) void reader.cancel().catch(() => {})
    }
  }

  function reconnectActiveSubscription() {
    if (activeSubscription && token) connectEvents(activeSubscription, token)
  }

  async function verifyNativeHelper(signal?: AbortSignal) {
    signal?.throwIfAborted()
    const response = await fetchImpl(`${baseUrl}/`, signal ? { signal } : undefined)
    const identity = response.ok ? await response.json() : null
    signal?.throwIfAborted()
    nativeHelperVersion = verifyScannerHelperIdentity(identity)
    nativeIdentityVerified = true
  }

  async function ensureSessionToken(signal?: AbortSignal) {
    signal?.throwIfAborted()
    if (!nativeIdentityVerified) await verifyNativeHelper(signal)
    if (tokenResolved && token) return token
    token = await resolveScannerHelperSessionToken({
      baseUrl,
      initialToken: token,
      fetchImpl,
      origin: window.location.origin,
      fallbackErrorCode: 'helper_token_request_failed',
      signal,
    })
    signal?.throwIfAborted()
    tokenResolved = true
    return token
  }

  async function command(path: string, method = 'POST', signal?: AbortSignal) {
    return withHelperDeadline(
      (requestSignal) => executeCommand(path, method, requestSignal),
      signal,
    )
  }

  async function executeCommand(path: string, method: string, signal: AbortSignal) {
    await verifyNativeHelper(signal)
    signal?.throwIfAborted()
    if (path === '/api/start') requireCurrentScannerHelper(nativeHelperVersion)
    await ensureSessionToken(signal)
    signal?.throwIfAborted()
    const request = () => {
      if (path === '/api/start') requireCurrentScannerHelper(nativeHelperVersion)
      return fetchImpl(`${baseUrl}${path}`, {
        method,
        headers: { 'X-Soda-Scanner-Token': token },
        ...(signal ? { signal } : {}),
      })
    }
    let response = await request()
    signal?.throwIfAborted()
    if (response.status === 401) {
      // Restarted native helpers issue a new session. A rejected request has not
      // entered the authenticated command handler, so retry it once after renewal.
      token = ''
      tokenResolved = false
      nativeIdentityVerified = false
      await ensureSessionToken(signal)
      signal?.throwIfAborted()
      response = await request()
      signal?.throwIfAborted()
      if (response.ok) reconnectActiveSubscription()
    }
    if (!response.ok) throw new Error(`helper_request_failed_${response.status}`)
    const body = await response.json()
    signal.throwIfAborted()
    return body
  }

  async function readResult(path: string, method: string, signal?: AbortSignal) {
    return readScannerResultWithDeadline(
      (readSignal) => command(path, method, readSignal),
      signal,
      options.resultRequestTimeoutMs,
    )
  }

  async function readAuthenticatedImage(path: string) {
    await withHelperDeadline((signal) => ensureSessionToken(signal))
    const imageUrl = new URL(path, baseUrl)
    if (
      imageUrl.origin !== new URL(baseUrl).origin ||
      !imageUrl.pathname.startsWith('/api/result/')
    )
      throw new Error('helper_evidence_origin_invalid')
    const blob = await withHelperDeadline(async (signal) => {
      const response = await fetchImpl(imageUrl.toString(), {
        headers: { 'X-Soda-Scanner-Token': token },
        signal,
      })
      const contentType = response.headers.get('content-type')?.toLowerCase() ?? ''
      if (!response.ok) throw new Error(`helper_evidence_request_failed_${response.status}`)
      if (!contentType.startsWith('image/')) throw new Error('helper_evidence_content_type_invalid')
      const image = await response.blob()
      signal.throwIfAborted()
      return image
    })
    return createObjectURL(blob)
  }

  async function retryUntilConnected() {
    return withHelperDeadline(async (signal) => {
      let lastError: unknown
      for (let attempt = 0; attempt < maxReconnectAttempts; attempt += 1) {
        signal.throwIfAborted()
        try {
          const snapshot = await command('/api/retry', 'POST', signal)
          signal.throwIfAborted()
          publishSnapshot(snapshot)
          return
        } catch (error) {
          signal.throwIfAborted()
          if (isAuthenticationFailure(error) || isCompatibilityFailure(error)) throw error
          lastError = error
          if (attempt + 1 < maxReconnectAttempts)
            await new Promise((resolve) => window.setTimeout(resolve, reconnectDelayMs))
        }
      }
      throw lastError instanceof Error ? lastError : new Error('helper_unavailable')
    })
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
        interrupted: false,
      }
      activeSubscription = subscription
      const onVisible = () => {
        if (!document.hidden && subscription.interrupted && !subscription.disposed) {
          subscription.interrupted = false
          void withHelperDeadline((signal) => ensureSessionToken(signal))
            .then((issued) => connectEvents(subscription, issued))
            .catch((error) => {
              if (!subscription.disposed) {
                subscription.interrupted = true
                listener(connectionFailure(error))
              }
            })
        }
      }
      document.addEventListener('visibilitychange', onVisible)
      // A public HTTPS page must explain local-device access before the first
      // loopback fetch, which can trigger the browser's local-network prompt.
      if (!options.deferInitialConnection)
        void withHelperDeadline((signal) => ensureSessionToken(signal))
          .then((issued) => {
            connectEvents(subscription, issued)
          })
          .catch((error: unknown) => {
            if (!subscription.disposed) listener(connectionFailure(error))
          })
      return () => {
        subscription.disposed = true
        document.removeEventListener('visibilitychange', onVisible)
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
        publishSnapshot(await command('/api/start'))
      },
      async safeStop() {
        publishSnapshot(await command('/api/stop'))
      },
      async revokePairing() {
        await command('/api/revoke')
        token = ''
        tokenResolved = false
        activeSubscription?.events?.close()
        activeSubscription?.abort?.abort()
        activeSubscription?.listener(failedSnapshot)
      },
      async requestResultFile(signal?: AbortSignal) {
        return readResult('/api/result', 'POST', signal) as Promise<{
          resultFileHandle: string
          resultStatus: string
          accountWriteEnabled: false
        }>
      },
      async requestResultStaging(resultFileHandle, signal?: AbortSignal) {
        return readResult(`/api/result/${encodeURIComponent(resultFileHandle)}`, 'GET', signal)
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
