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
  let nativeInstallerVersion: string | null = null
  let connectionStep: 'identity' | 'pairing' | 'command' | 'events' = 'identity'
  let connectionAttemptId = crypto.randomUUID()
  let lastSnapshot: ScannerAssistantSnapshot | undefined
  let eventRevision = 0
  function failureSnapshot(error: unknown, step = connectionStep) {
    return connectionFailure(error, {
      step,
      reportId: connectionAttemptId,
      lastSnapshot,
      versions: {
        ...lastSnapshot?.connectedVersions,
        ...(nativeHelperVersion ? { helper: nativeHelperVersion, protocol: '5' } : {}),
        ...(nativeInstallerVersion ? { installer: nativeInstallerVersion } : {}),
      },
    })
  }
  const fetchImpl = options.fetchImpl ?? fetch
  const EventSourceImpl = options.EventSourceImpl ?? null
  const reconnectDelayMs = options.reconnectDelayMs ?? 250
  const maxReconnectAttempts = options.maxReconnectAttempts ?? Infinity
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
      activeSubscription.listener(presentConnectedSnapshot(next))
  }

  function presentConnectedSnapshot(next: ScannerAssistantSnapshot) {
    const presented = presentScannerHelperSnapshot(
      next,
      nativeHelperVersion,
      next.readiness.helperConnected
        ? {
            installer: next.connectedVersions?.installer ?? nativeInstallerVersion,
            runtime: next.connectedVersions?.runtime ?? next.distribution?.installedVersion,
            scanner: next.connectedVersions?.scanner,
          }
        : {},
    )
    lastSnapshot = {
      ...presented,
      connectedVersions: {
        ...presented.connectedVersions,
        ...(nativeHelperVersion ? { helper: nativeHelperVersion, protocol: '5' } : {}),
        ...(nativeInstallerVersion ? { installer: nativeInstallerVersion } : {}),
      },
    }
    return lastSnapshot
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
      eventRevision += 1
      subscription.listener(presentConnectedSnapshot(next))
    }
    events.onerror = () => {
      if (subscription.disposed || subscription.events !== events) return
      subscription.interrupted = true
      if (!document.hidden)
        subscription.listener(failureSnapshot(new Error('helper_events_disconnected'), 'events'))
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
            eventRevision += 1
            subscription.listener(presentConnectedSnapshot(next))
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
        subscription.listener(failureSnapshot(error, 'events'))
        if (subscription.reconnectAttempts++ < maxReconnectAttempts) {
          window.setTimeout(() => {
            if (subscription.disposed || subscription.abort !== controller) return
            if (error instanceof Error && error.message === 'helper_events_failed_401') {
              token = ''
              tokenResolved = false
            }
            void withHelperDeadline((signal) => ensureSessionToken(signal))
              .then((next) => connectEvents(subscription, next))
              .catch((failure) => {
                if (!subscription.disposed) subscription.listener(failureSnapshot(failure))
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
    connectionStep = 'identity'
    signal?.throwIfAborted()
    const response = await fetchImpl(`${baseUrl}/`, signal ? { signal } : undefined)
    const identity = response.ok ? await response.json() : null
    signal?.throwIfAborted()
    nativeHelperVersion = verifyScannerHelperIdentity(identity)
    nativeInstallerVersion =
      typeof identity.installerVersion === 'string' &&
      /^\d{1,3}\.\d{1,3}\.\d{1,3}$/u.test(identity.installerVersion)
        ? identity.installerVersion
        : null
    nativeIdentityVerified = true
  }

  async function ensureSessionToken(signal?: AbortSignal) {
    signal?.throwIfAborted()
    if (!nativeIdentityVerified) await verifyNativeHelper(signal)
    if (tokenResolved && token) return token
    connectionStep = 'pairing'
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
    ).catch((error) => {
      if (path !== '/api/retry' && !signal?.aborted)
        activeSubscription?.listener(failureSnapshot(error))
      throw error
    })
  }

  async function executeCommand(path: string, method: string, signal: AbortSignal) {
    await verifyNativeHelper(signal)
    signal?.throwIfAborted()
    if (path === '/api/start') requireCurrentScannerHelper(nativeHelperVersion)
    await ensureSessionToken(signal)
    signal?.throwIfAborted()
    const request = () => {
      connectionStep = 'command'
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
    connectionAttemptId = crypto.randomUUID()
    const attemptId = connectionAttemptId
    return withHelperDeadline(async (signal) => {
      let lastError: unknown
      for (let attempt = 0; attempt < maxReconnectAttempts; attempt += 1) {
        signal.throwIfAborted()
        if (connectionAttemptId !== attemptId) return
        try {
          const beforeEvents = eventRevision
          const snapshot = await command('/api/retry', 'POST', signal)
          signal.throwIfAborted()
          if (connectionAttemptId !== attemptId) return
          if (eventRevision === beforeEvents) publishSnapshot(snapshot)
          return
        } catch (error) {
          signal.throwIfAborted()
          if (connectionAttemptId !== attemptId) return
          if (isAuthenticationFailure(error) || isCompatibilityFailure(error)) throw error
          lastError = error
          if (attempt + 1 < maxReconnectAttempts) {
            await new Promise<void>((resolve, reject) => {
              const timer = window.setTimeout(() => {
                signal.removeEventListener('abort', abort)
                resolve()
              }, reconnectDelayMs)
              const abort = () => {
                window.clearTimeout(timer)
                signal.removeEventListener('abort', abort)
                reject(signal.reason ?? new DOMException('Aborted', 'AbortError'))
              }
              signal.addEventListener('abort', abort, { once: true })
              if (signal.aborted) abort()
            })
          }
        }
      }
      throw lastError instanceof Error ? lastError : new Error('helper_unavailable')
    }).catch((error) => {
      if (connectionAttemptId === attemptId) {
        activeSubscription?.listener(failureSnapshot(error))
      }
      throw error
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
                listener(failureSnapshot(error))
              }
            })
        }
      }
      document.addEventListener('visibilitychange', onVisible)
      // User-facing pages explain local-device access before the first loopback
      // fetch. Explicit background clients may opt into immediate connection.
      if (!options.deferInitialConnection)
        void withHelperDeadline((signal) => ensureSessionToken(signal))
          .then((issued) => {
            connectEvents(subscription, issued)
          })
          .catch((error: unknown) => {
            if (!subscription.disposed) listener(failureSnapshot(error))
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
        const beforeEvents = eventRevision
        const next = await command('/api/start')
        if (eventRevision === beforeEvents) publishSnapshot(next)
      },
      async safeStop() {
        const beforeEvents = eventRevision
        const next = await command('/api/stop')
        if (eventRevision === beforeEvents) publishSnapshot(next)
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
        deferInitialConnection: true,
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
