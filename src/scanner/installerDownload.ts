import {
  InstallerDownloadCache,
  installerDownloadChunkSize,
  installerDownloadIdentity,
} from './installerDownloadCache'

export type InstallerDownloadResult = 'save_requested'
export const installerDownloadConcurrency = 4
export type InstallerTransferProgress = {
  bytes: number
  total: number
  bytesPerSecond: number
  resumedBytes: number
  phase: 'downloading' | 'retrying'
  retryAttempt: number
}

export function scannerInstallerFileName(version: string): string {
  if (!/^\d+\.\d+\.\d+$/u.test(version)) throw new Error('invalid_installer_version')
  return !/^1\.0\.[0-8]$/u.test(version)
    ? `SodaTerminal-Scanner-Setup-${version}.exe`
    : `Soda-画面扫描-${version}.exe`
}

export function waitForAbortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const aborted = () => {
      signal.removeEventListener('abort', aborted)
      reject(signal.reason)
    }
    signal.addEventListener('abort', aborted, { once: true })
    if (signal.aborted) aborted()
    promise.then(
      (value) => {
        signal.removeEventListener('abort', aborted)
        resolve(value)
      },
      (error: unknown) => {
        signal.removeEventListener('abort', aborted)
        reject(error)
      },
    )
  })
}

class RetryableTransferError extends Error {
  readonly cause: unknown
  readonly retryAfter: number | undefined
  constructor(cause: unknown, retryAfter?: number) {
    super('download_retryable')
    this.cause = cause
    this.retryAfter = retryAfter
  }
}
class RestartTransfer extends Error {}

function retryDelay(response: Response) {
  const value = response.headers.get('retry-after')
  return response.status === 429 && value !== null && /^\d+(?:\.\d+)?$/u.test(value.trim())
    ? Math.max(1, Math.min(60, Number(value))) * 1000
    : undefined
}

async function retryPause(ms: number, signal: AbortSignal) {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    await waitForAbortable(
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, ms)
      }),
      signal,
    )
  } finally {
    clearTimeout(timer)
  }
}

function batchOffsets(offset: number, size: number, concurrency: number) {
  const remaining = Math.ceil((size - offset) / installerDownloadChunkSize)
  return Array.from(
    { length: Math.min(remaining, concurrency) },
    (_, index) => offset + index * installerDownloadChunkSize,
  )
}

async function receiveRange(
  url: string,
  offset: number,
  size: number,
  sha256: string,
  signal: AbortSignal,
  progress: (bytes: number) => void,
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
    if (response.status === 429 || response.status === 503)
      throw new RetryableTransferError(new Error('download_failed'), retryDelay(response))
    if (!response.ok || !response.body || response.redirected) throw new Error('download_failed')
    if (/html/iu.test(response.headers.get('content-type') ?? ''))
      throw new Error('invalid_download')
    const etag = response.headers.get('etag')
    let length: number
    if (response.status === 206) {
      if (response.headers.get('content-range') !== `bytes ${offset}-${end}/${size}`)
        throw new Error('invalid_download_range')
      if (etag !== `"${sha256}"`) throw new Error('invalid_download_etag')
      length = end - offset + 1
    } else if (response.status === 200) {
      if (offset) throw new RestartTransfer()
      if (etag !== null && etag !== `"${sha256}"`) throw new Error('invalid_download_etag')
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
      throw new RetryableTransferError(error)
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
  const cache = new InstallerDownloadCache(identity, signal)
  try {
    await waitForAbortable(cache.open(), signal)
    let resumedBytes = cache.bytes
    let parallelism = Math.min(
      installerDownloadConcurrency,
      Math.ceil((expectedSize - cache.bytes) / installerDownloadChunkSize),
    )
    let restarted = false
    let lastProgress = cache.bytes
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
    while (cache.bytes < expectedSize) {
      signal.throwIfAborted()
      const batchStart = cache.bytes
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
        let bytes = cache.bytes
        for (const offset of offsets) {
          if (offset < cache.bytes) continue
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
              for (let start = 0; start < bytes.byteLength; start += installerDownloadChunkSize)
                await waitForAbortable(
                  cache.checkpoint(bytes.slice(start, start + installerDownloadChunkSize)),
                  signal,
                )
              reportLoaded()
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
      if (cache.bytes === expectedSize) break
      const failure = offsets
        .map((_, index) => errors.get(index))
        .find((error) => error !== undefined)
      if (failure instanceof RestartTransfer && !restarted) {
        restarted = true
        parallelism = 1
        await waitForAbortable(cache.reset(), signal)
        resumedBytes = 0
        reportProgress(0, true)
        notify(0)
        continue
      }
      if (failure !== undefined) throw failure
      continue
    }
    if (cache.chunks[0]?.[0] !== 0x4d || cache.chunks[0]?.[1] !== 0x5a) {
      await waitForAbortable(cache.discard(), signal)
      throw new Error('invalid_download')
    }
    onSaving()
    signal.throwIfAborted()
    const blob = new Blob(cache.chunks, { type: 'application/octet-stream' })
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
      await waitForAbortable(cache.discard(), signal)
      throw new Error('invalid_download_sha256')
    }
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
    await waitForAbortable(cache.discard(), signal)
    return 'save_requested'
  } finally {
    void cache.close()
  }
}
