import {
  InstallerDownloadCache,
  installerDownloadChunkSize,
  installerDownloadIdentity,
} from './installerDownloadCache'
import {
  type InstallerDownloadResult,
  installerDownloadConcurrency,
  installerDownloadMaximumSize,
  type InstallerTransferProgress,
  type InstallerDownloadErrorCode,
  type InstallerDownloadFailureDetails,
  InstallerDownloadError,
  installerDownloadFailureDetails,
  installerDownloadRequestCount,
  createInstallerDownloadFeedbackReport,
  scannerInstallerFileName,
  waitForAbortable,
  RetryableTransferError,
  RestartTransfer,
  ResponseTransferError,
  ReleaseChangedTransferError,
  retryDelay,
  transferFailureDetails,
  retryPause,
  batchOffsets,
} from './installerDownloadSupport'

export {
  type InstallerDownloadResult,
  installerDownloadConcurrency,
  installerDownloadMaximumSize,
  type InstallerTransferProgress,
  type InstallerDownloadErrorCode,
  type InstallerDownloadFailureDetails,
  InstallerDownloadError,
  installerDownloadFailureDetails,
  installerDownloadRequestCount,
  createInstallerDownloadFeedbackReport,
  scannerInstallerFileName,
  waitForAbortable,
}

async function receiveRange(
  url: string,
  offset: number,
  size: number,
  sha256: string,
  signal: AbortSignal,
  progress: (bytes: number) => void,
  observe: (event: {
    attempt?: true
    status?: number
    waitReason?: InstallerDownloadFailureDetails['waitReason']
  }) => void,
) {
  const end = Math.min(offset + installerDownloadChunkSize, size) - 1
  const attempt = new AbortController()
  const abort = () => attempt.abort(signal.reason)
  signal.addEventListener('abort', abort, { once: true })
  let idle: ReturnType<typeof setTimeout>
  const touch = () => {
    clearTimeout(idle)
    idle = setTimeout(
      () => attempt.abort(new DOMException('download_timeout', 'TimeoutError')),
      60_000,
    )
  }
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
  let response: Response | undefined
  let network = true
  touch()
  try {
    signal.throwIfAborted()
    observe({ attempt: true })
    const promise = fetch(url, {
      credentials: 'omit',
      cache: 'no-store',
      mode: 'same-origin',
      redirect: 'error',
      headers: {
        Range: `bytes=${offset}-${end}`,
        ...(offset ? { 'If-Range': `"${sha256}"` } : {}),
      },
      signal: attempt.signal,
    })
    void promise.then(
      (late) => {
        if (attempt.signal.aborted) void late.body?.cancel().catch(() => {})
      },
      () => {},
    )
    response = await waitForAbortable(promise, attempt.signal)
    network = false
    attempt.signal.throwIfAborted()
    observe({ status: response.status })
    if ([408, 425, 429, 500, 502, 503, 504].includes(response.status))
      throw new RetryableTransferError(
        new Error('download_failed'),
        retryDelay(response),
        response.status,
        response.status === 429
          ? 'rate_limit'
          : response.status === 503
            ? 'server_busy'
            : 'network',
      )
    if (!response.ok || !response.body || response.redirected)
      throw new ResponseTransferError(response.status)
    if (/html/iu.test(response.headers.get('content-type') ?? ''))
      throw new Error('invalid_download')
    const etag = response.headers.get('etag')
    let length: number
    if (response.status === 206) {
      if (response.headers.get('content-range') !== `bytes ${offset}-${end}/${size}`)
        throw new Error('invalid_download_range')
      if (etag !== `"${sha256}"`) throw new ReleaseChangedTransferError(206)
      length = end - offset + 1
    } else if (response.status === 200) {
      if (offset) throw new RestartTransfer()
      if (etag !== null && etag !== `"${sha256}"`) throw new ReleaseChangedTransferError(200)
      length = size
    } else throw new Error('invalid_download_range')
    const contentLength = response.headers.get('content-length')
    if (
      contentLength !== null &&
      (!/^\d+$/u.test(contentLength) || Number(contentLength) !== length)
    )
      throw new Error('invalid_download_size')
    reader = response.body.getReader()
    const received = new Uint8Array(length)
    let bytes = 0
    while (true) {
      network = true
      const result = await waitForAbortable(reader.read(), attempt.signal)
      network = false
      attempt.signal.throwIfAborted()
      if (result.done) break
      if (!result.value.byteLength) continue
      if (bytes + result.value.byteLength > length) throw new Error('invalid_download')
      received.set(result.value, bytes)
      bytes += result.value.byteLength
      touch()
      if (offset === 0 && bytes >= 2 && (received[0] !== 0x4d || received[1] !== 0x5a))
        throw new Error('invalid_download')
      progress(offset + bytes)
    }
    if (bytes !== length) throw new Error('incomplete_download')
    return received
  } catch (error) {
    if (signal.aborted) throw signal.reason
    if (network || (error instanceof DOMException && error.name === 'TimeoutError'))
      throw new RetryableTransferError(
        error,
        undefined,
        undefined,
        error instanceof DOMException && error.name === 'TimeoutError' ? 'timeout' : 'network',
      )
    throw error
  } finally {
    clearTimeout(idle!)
    signal.removeEventListener('abort', abort)
    // Neither a host's fetch nor a host's stream cleanup may hold the UI open.
    attempt.abort()
    if (reader) {
      void reader.cancel().catch(() => {})
      reader.releaseLock()
    } else if (response) void response.body?.cancel().catch(() => {})
  }
}

/**
 * Receive a bounded parallel window, checkpoint contiguous chunks as soon as possible,
 * then verify the whole package before browser saving.
 */
export async function downloadScannerInstaller({
  url,
  fileName,
  expectedSize,
  expectedSha256,
  signal,
  onProgress,
  onSaving,
  onTransfer,
}: {
  url: string
  fileName: string
  expectedSize: number
  expectedSha256: string
  signal: AbortSignal
  onProgress: (bytes: number) => void
  onSaving: () => void
  onTransfer?: (status: InstallerTransferProgress) => void
}): Promise<InstallerDownloadResult> {
  if (!Number.isSafeInteger(expectedSize) || expectedSize < 2 || expectedSize > 1024 * 1024 * 1024)
    throw new Error('invalid_download_size')
  if (!/^[a-f0-9]{64}$/u.test(expectedSha256)) throw new Error('invalid_download_sha256')
  const identity = installerDownloadIdentity(url, expectedSize, expectedSha256)
  signal.throwIfAborted()
  let cache: InstallerDownloadCache | undefined
  let phase: InstallerDownloadFailureDetails['phase'] = 'range'
  let attemptCount = 0
  let httpStatus: number | undefined
  let waitReason: InstallerDownloadFailureDetails['waitReason'] = 'none'
  let lastProgress = 0
  try {
    phase = 'storage'
    const activeCache = new InstallerDownloadCache(identity, signal)
    cache = activeCache
    await waitForAbortable(activeCache.open(), signal)
    let resumedBytes = activeCache.bytes
    let parallelism = Math.min(
      installerDownloadConcurrency,
      Math.ceil((expectedSize - activeCache.bytes) / installerDownloadChunkSize),
    )
    let restarted = false
    lastProgress = activeCache.bytes
    phase = 'range'
    const observe = (event: {
      attempt?: true
      status?: number
      waitReason?: InstallerDownloadFailureDetails['waitReason']
    }) => {
      if (event.attempt) attemptCount += 1
      if (event.status !== undefined) httpStatus = event.status
      if (event.waitReason) waitReason = event.waitReason
      phase = 'range'
    }
    const notify = (
      bytes: number,
      bytesPerSecond = 0,
      phase: InstallerTransferProgress['phase'] = 'downloading',
      retryAttempt = 0,
    ) =>
      onTransfer?.({
        bytes,
        total: expectedSize,
        bytesPerSecond,
        resumedBytes,
        phase,
        retryAttempt,
      })
    const reportProgress = (bytes: number, allowReset = false) => {
      const next = Math.min(expectedSize, Math.max(allowReset ? 0 : lastProgress, bytes))
      if (allowReset || next !== lastProgress) {
        lastProgress = next
        onProgress(next)
      }
    }
    if (resumedBytes) reportProgress(resumedBytes)
    notify(resumedBytes)
    while (activeCache.bytes < expectedSize) {
      signal.throwIfAborted()
      const batchStart = activeCache.bytes
      const offsets = batchOffsets(batchStart, expectedSize, parallelism)
      const started = performance.now()
      const batchAbort = new AbortController()
      const batchSignal = AbortSignal.any([signal, batchAbort.signal])
      const loaded = new Map<number, number>()
      const results = new Map<number, Uint8Array<ArrayBuffer>>()
      const errors = new Map<number, unknown>()
      let nextCommit = 0
      let commitError: unknown
      let commitChain = Promise.resolve()
      const aggregateBytes = () => {
        let bytes = activeCache.bytes
        for (const offset of offsets) {
          if (offset < activeCache.bytes) continue
          const expected = Math.min(installerDownloadChunkSize, expectedSize - offset)
          const loadedBytes = loaded.get(offset) ?? 0
          bytes += Math.min(expected, loadedBytes)
          if (loadedBytes < expected) break
        }
        return Math.min(expectedSize, bytes)
      }
      const reportLoaded = (retryAttempt = 0) => {
        const bytes = aggregateBytes()
        reportProgress(bytes)
        notify(
          bytes,
          ((bytes - batchStart) * 1000) / Math.max(1, performance.now() - started),
          'downloading',
          retryAttempt,
        )
      }
      const commitReady = () => {
        while (results.has(nextCommit)) {
          const index = nextCommit++
          const bytes = results.get(index)!
          results.delete(index)
          loaded.delete(offsets[index])
          commitChain = commitChain
            .then(async () => {
              phase = 'storage'
              try {
                for (let start = 0; start < bytes.byteLength; start += installerDownloadChunkSize)
                  await waitForAbortable(
                    activeCache.checkpoint(bytes.slice(start, start + installerDownloadChunkSize)),
                    signal,
                  )
                reportLoaded()
              } finally {
                phase = 'range'
              }
            })
            .catch((error: unknown) => {
              commitError ??= error
              batchAbort.abort(error)
              throw error
            })
        }
      }
      const tasks = offsets.map(async (offset, index) => {
        let failures = 0
        while (true) {
          batchSignal.throwIfAborted()
          try {
            const bytes = await receiveRange(
              url,
              offset,
              expectedSize,
              expectedSha256,
              batchSignal,
              (total) => {
                loaded.set(offset, total - offset)
                reportLoaded(failures)
              },
              observe,
            )
            results.set(index, bytes)
            commitReady()
            return
          } catch (error) {
            loaded.delete(offset)
            if (signal.aborted) throw signal.reason
            if (batchSignal.aborted) {
              errors.set(index, batchSignal.reason)
              return
            }
            if (error instanceof RestartTransfer) {
              errors.set(index, error)
              batchAbort.abort(error)
              return
            }
            if (!(error instanceof RetryableTransferError)) {
              errors.set(index, error)
              batchAbort.abort(error)
              return
            }
            observe({ status: error.status, waitReason: error.waitReason })
            if (failures >= 3) {
              errors.set(index, error.cause)
              batchAbort.abort(error.cause)
              return
            }
            failures++
            notify(aggregateBytes(), 0, 'retrying', failures)
            await retryPause(error.retryAfter ?? 1000 * 2 ** (failures - 1), batchSignal)
          }
        }
      })
      await Promise.all(tasks)
      await commitChain.catch(() => {})
      if (commitError !== undefined) throw commitError
      if (activeCache.bytes === expectedSize) break
      const failure = offsets
        .map((_, index) => errors.get(index))
        .find((error) => error !== undefined)
      if (failure instanceof RestartTransfer && !restarted) {
        restarted = true
        parallelism = 1
        phase = 'storage'
        await waitForAbortable(activeCache.reset(), signal)
        phase = 'range'
        resumedBytes = 0
        reportProgress(0, true)
        notify(0)
        continue
      }
      if (failure !== undefined) throw failure
      continue
    }
    phase = 'verify'
    if (activeCache.chunks[0]?.[0] !== 0x4d || activeCache.chunks[0]?.[1] !== 0x5a) {
      await waitForAbortable(activeCache.discard(), signal)
      throw new Error('invalid_download')
    }
    signal.throwIfAborted()
    const blob = new Blob(activeCache.chunks, { type: 'application/octet-stream' })
    const hashing = new AbortController()
    const cancelHash = () => hashing.abort(signal.reason)
    signal.addEventListener('abort', cancelHash, { once: true })
    const hashDeadline = setTimeout(
      () => hashing.abort(new DOMException('download_hash_timeout', 'TimeoutError')),
      60_000,
    )
    let hash: ArrayBuffer
    try {
      const buffer = await waitForAbortable(blob.arrayBuffer(), hashing.signal)
      hash = await waitForAbortable(crypto.subtle.digest('SHA-256', buffer), hashing.signal)
      hashing.signal.throwIfAborted()
    } finally {
      clearTimeout(hashDeadline)
      signal.removeEventListener('abort', cancelHash)
    }
    signal.throwIfAborted()
    const sha256 = Array.from(new Uint8Array(hash), (byte) =>
      byte.toString(16).padStart(2, '0'),
    ).join('')
    if (sha256 !== expectedSha256) {
      await waitForAbortable(activeCache.discard(), signal)
      throw new Error('invalid_download_sha256')
    }
    phase = 'save'
    onSaving()
    signal.throwIfAborted()
    const objectUrl = URL.createObjectURL(blob)
    try {
      const anchor = document.createElement('a')
      anchor.href = objectUrl
      anchor.download = fileName
      document.body.append(anchor)
      try {
        anchor.click()
      } finally {
        anchor.remove()
      }
    } finally {
      // Browser save acceptance is unobservable; allow time before releasing it.
      setTimeout(URL.revokeObjectURL.bind(URL, objectUrl), 60_000)
    }
    phase = 'storage'
    await waitForAbortable(activeCache.discard(), signal)
    return 'save_requested'
  } catch (error) {
    if (signal.aborted) throw signal.reason
    const details = transferFailureDetails(error, {
      phase,
      bytesReceived: Math.max(lastProgress, cache?.bytes ?? 0),
      attemptCount,
      waitReason,
      httpStatus,
    })
    if (details.code === 'installer_download_release_changed' && cache) {
      await waitForAbortable(cache.discard(), signal).catch(() => {})
    }
    throw new InstallerDownloadError(error, details)
  } finally {
    void cache?.close()
  }
}
