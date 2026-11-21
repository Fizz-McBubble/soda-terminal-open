import { installerDownloadChunkSize } from './installerDownloadCache'

export type InstallerDownloadResult = 'save_requested'
export const installerDownloadConcurrency = 8
export const installerDownloadMaximumSize = 1024 * 1024 * 1024
export type InstallerTransferProgress = {
  bytes: number
  total: number
  bytesPerSecond: number
  resumedBytes: number
  phase: 'downloading' | 'retrying'
  retryAttempt: number
}

export type InstallerDownloadErrorCode =
  | 'installer_download_unavailable'
  | 'installer_download_request_failed'
  | 'installer_download_rate_limited'
  | 'installer_download_timeout'
  | 'installer_download_incomplete'
  | 'installer_download_integrity_mismatch'
  | 'installer_download_storage_failed'
  | 'installer_download_save_failed'
  | 'installer_download_release_changed'

export type InstallerDownloadFailureDetails = {
  code: InstallerDownloadErrorCode
  phase: 'manifest' | 'range' | 'verify' | 'storage' | 'save'
  bytesReceived: number
  attemptCount: number
  waitReason: 'none' | 'rate_limit' | 'server_busy' | 'network' | 'timeout'
  httpStatus?: number
}

export class InstallerDownloadError extends Error {
  readonly details: InstallerDownloadFailureDetails
  readonly cause: unknown

  constructor(cause: unknown, details: InstallerDownloadFailureDetails) {
    super(cause instanceof Error ? cause.message : 'installer_download_failed')
    this.name =
      details.code === 'installer_download_timeout'
        ? 'TimeoutError'
        : details.phase === 'save'
          ? cause instanceof DOMException
            ? cause.name
            : 'SecurityError'
          : cause instanceof Error
            ? cause.name
            : 'InstallerDownloadError'
    this.cause = cause
    this.details = details
  }
}

export function installerDownloadFailureDetails(
  error: unknown,
): InstallerDownloadFailureDetails | null {
  return error instanceof InstallerDownloadError ? error.details : null
}

export function installerDownloadRequestCount(size: number) {
  if (!Number.isSafeInteger(size) || size < 1) throw new Error('invalid_download_size')
  return Math.ceil(size / installerDownloadChunkSize)
}

/**
 * Keep browser download failures in the same explicit installer-feedback flow
 * as native installer failures. The URL and raw exception never enter the DTO.
 */
export function createInstallerDownloadFeedbackReport({
  tool,
  installerVersion,
  expectedSize,
  expectedSha256,
  durationMs,
  error,
}: {
  tool: 'asset_quick_read_installer' | 'screen_scanner_installer'
  installerVersion: string
  expectedSize: number
  expectedSha256: string
  durationMs: number
  error: unknown
}) {
  const failure =
    installerDownloadFailureDetails(error) ??
    (error instanceof DOMException && error.name === 'TimeoutError'
      ? {
          code: 'installer_download_timeout' as const,
          phase: 'manifest' as const,
          bytesReceived: 0,
          attemptCount: 0,
          waitReason: 'timeout' as const,
        }
      : {
          code: 'installer_download_unavailable' as const,
          phase: 'manifest' as const,
          bytesReceived: 0,
          attemptCount: 0,
          waitReason: 'none' as const,
        })
  return {
    schema: 1 as const,
    tool,
    reportId: crypto.randomUUID(),
    installerVersion,
    stage: 'prepare' as const,
    code: failure.code,
    durationMs: Math.min(3_600_000, Math.max(0, Math.round(durationMs))),
    attempts: [],
    download: {
      phase: failure.phase,
      bytesReceived: failure.bytesReceived,
      attemptCount: failure.attemptCount,
      waitReason: failure.waitReason,
      ...(failure.httpStatus !== undefined ? { httpStatus: failure.httpStatus } : {}),
      expectedRelease: { size: expectedSize, sha256: expectedSha256 },
    },
  }
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

export class RetryableTransferError extends Error {
  readonly cause: unknown
  readonly retryAfter: number | undefined
  readonly status: number | undefined
  readonly waitReason: InstallerDownloadFailureDetails['waitReason']
  constructor(
    cause: unknown,
    retryAfter?: number,
    status?: number,
    waitReason: InstallerDownloadFailureDetails['waitReason'] = 'network',
  ) {
    super('download_retryable')
    this.cause = cause
    this.retryAfter = retryAfter
    this.status = status
    this.waitReason = waitReason
  }
}
export class RestartTransfer extends Error {}
export class ResponseTransferError extends Error {
  readonly status: number
  constructor(status: number) {
    super('download_failed')
    this.status = status
  }
}
export class ReleaseChangedTransferError extends Error {
  readonly status: number | undefined
  constructor(status?: number) {
    super('invalid_download_etag')
    this.status = status
  }
}

export function retryDelay(response: Response) {
  const value = response.headers.get('retry-after')
  return [429, 503].includes(response.status) &&
    value !== null &&
    /^\d+(?:\.\d+)?$/u.test(value.trim())
    ? Math.max(1, Math.min(60, Number(value))) * 1000
    : undefined
}

export function transferFailureDetails(
  error: unknown,
  state: {
    phase: InstallerDownloadFailureDetails['phase']
    bytesReceived: number
    attemptCount: number
    waitReason: InstallerDownloadFailureDetails['waitReason']
    httpStatus?: number
  },
): InstallerDownloadFailureDetails {
  const message = error instanceof Error ? error.message : ''
  const status =
    error instanceof ResponseTransferError ||
    error instanceof ReleaseChangedTransferError ||
    error instanceof RetryableTransferError
      ? (error.status ?? state.httpStatus)
      : state.httpStatus
  let code: InstallerDownloadErrorCode
  if (status === 429) code = 'installer_download_rate_limited'
  else if (
    error instanceof ReleaseChangedTransferError ||
    message === 'invalid_download_etag' ||
    status === 416
  )
    code = 'installer_download_release_changed'
  else if (error instanceof DOMException && error.name === 'TimeoutError')
    code = 'installer_download_timeout'
  else if (message === 'incomplete_download') code = 'installer_download_incomplete'
  else if (
    [
      'invalid_download',
      'invalid_download_range',
      'invalid_download_size',
      'invalid_download_sha256',
    ].includes(message)
  )
    code = 'installer_download_integrity_mismatch'
  else if (
    ['download_storage_timeout', 'download_storage_inactive', 'download_cache_closed'].includes(
      message,
    )
  )
    code = 'installer_download_storage_failed'
  else if (state.phase === 'save') code = 'installer_download_save_failed'
  else code = 'installer_download_request_failed'
  return {
    code,
    phase: state.phase,
    bytesReceived: Math.min(installerDownloadMaximumSize, Math.max(0, state.bytesReceived)),
    attemptCount: Math.min(1024, Math.max(0, state.attemptCount)),
    waitReason: state.waitReason,
    ...(Number.isInteger(status) && status! >= 100 && status! <= 599 ? { httpStatus: status } : {}),
  }
}

export async function retryPause(ms: number, signal: AbortSignal) {
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

export function batchOffsets(offset: number, size: number, concurrency: number) {
  const remaining = Math.ceil((size - offset) / installerDownloadChunkSize)
  return Array.from(
    { length: Math.min(remaining, concurrency) },
    (_, index) => offset + index * installerDownloadChunkSize,
  )
}
