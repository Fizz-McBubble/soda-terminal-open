import { expect, it, vi } from 'vitest'
import { webcrypto } from 'node:crypto'
import { installerDownloadChunkSize } from './installerDownloadCache'
import {
  createInstallerDownloadFeedbackReport,
  downloadScannerInstaller,
  installerDownloadConcurrency,
  installerDownloadFailureDetails,
} from './installerDownload'

export function registerInstallerDownloadRangeCases(context: {
  options: (signal?: AbortSignal) => Parameters<typeof downloadScannerInstaller>[0]
  executable: Uint8Array<ArrayBuffer>
  createObjectURL: ReturnType<typeof vi.fn>
}) {
  const { options, executable, createObjectURL } = context

  async function pinned(bytes: Uint8Array<ArrayBuffer>, signal = new AbortController().signal) {
    const digest = await webcrypto.subtle.digest('SHA-256', bytes)
    return {
      ...options(signal),
      expectedSize: bytes.length,
      expectedSha256: Buffer.from(digest).toString('hex'),
      onTransfer: vi.fn(),
    }
  }
  function binary(size: number) {
    const bytes = new Uint8Array(size).fill(3)
    bytes.set([0x4d, 0x5a])
    return bytes
  }
  function segment(bytes: Uint8Array<ArrayBuffer>, sha: string, start = 0) {
    const end = Math.min(bytes.length, start + installerDownloadChunkSize) - 1
    return new Response(bytes.slice(start, end + 1), {
      status: 206,
      headers: {
        'content-range': `bytes ${start}-${end}/${bytes.length}`,
        'content-length': `${end - start + 1}`,
        etag: `"${sha}"`,
        'content-type': 'application/octet-stream',
      },
    })
  }

  it.each([
    'https://other.invalid/downloads/Soda-Scanner-Setup.exe',
    '/downloads/unknown.exe',
    '/downloads/Soda-Scanner-Setup.exe?signature=secret',
    '/downloads/Soda-Scanner-Setup.exe#fragment',
  ])('rejects untrusted package URL %s before any request', async (url) => {
    const fetcher = vi.fn()
    vi.stubGlobal('fetch', fetcher)
    await expect(downloadScannerInstaller({ ...options(), url })).rejects.toThrow(
      'invalid_download_url',
    )
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('requests the bounded range window and binds every resumed range to the release SHA ETag', async () => {
    const bytes = binary(installerDownloadChunkSize + 8)
    const input = await pinned(bytes)
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(segment(bytes, input.expectedSha256))
      .mockResolvedValueOnce(segment(bytes, input.expectedSha256, installerDownloadChunkSize))
    vi.stubGlobal('fetch', fetcher)
    await expect(downloadScannerInstaller(input)).resolves.toBe('save_requested')
    expect(fetcher.mock.calls.map(([, init]) => init.headers)).toEqual([
      { Range: `bytes=0-${installerDownloadChunkSize - 1}` },
      {
        Range: `bytes=${installerDownloadChunkSize}-${bytes.length - 1}`,
        'If-Range': `"${input.expectedSha256}"`,
      },
    ])
    expect(input.onTransfer).toHaveBeenLastCalledWith(
      expect.objectContaining({
        bytes: bytes.length,
        total: bytes.length,
        phase: 'downloading',
        resumedBytes: 0,
      }),
    )
    expect(input.onTransfer.mock.calls.some(([status]) => status.bytesPerSecond > 0)).toBe(true)
  })

  it('starts a bounded parallel window and commits out-of-order results by offset', async () => {
    const bytes = binary(installerDownloadChunkSize * (installerDownloadConcurrency + 1))
    const input = await pinned(bytes)
    const pending = new Map<number, (response: Response) => void>()
    const ranges: number[] = []
    const fetcher = vi.fn((_url: string, init: RequestInit) => {
      const start = Number(/^bytes=(\d+)-/u.exec(new Headers(init.headers).get('range') ?? '')![1])
      ranges.push(start)
      return new Promise<Response>((resolve) => pending.set(start, resolve))
    })
    vi.stubGlobal('fetch', fetcher)

    const download = downloadScannerInstaller(input)
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(installerDownloadConcurrency))
    expect(ranges).toEqual(
      Array.from(
        { length: installerDownloadConcurrency },
        (_, index) => index * installerDownloadChunkSize,
      ),
    )

    pending.get(installerDownloadChunkSize * 2)!(
      segment(bytes, input.expectedSha256, 2 * installerDownloadChunkSize),
    )
    pending.get(installerDownloadChunkSize * 3)!(
      segment(bytes, input.expectedSha256, 3 * installerDownloadChunkSize),
    )
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(fetcher).toHaveBeenCalledTimes(installerDownloadConcurrency)
    expect(input.onProgress).not.toHaveBeenCalled()

    pending.get(0)!(segment(bytes, input.expectedSha256))
    pending.get(installerDownloadChunkSize)!(
      segment(bytes, input.expectedSha256, installerDownloadChunkSize),
    )
    await vi.waitFor(() =>
      expect(input.onProgress).toHaveBeenLastCalledWith(installerDownloadChunkSize * 4),
    )
    for (let index = 4; index < installerDownloadConcurrency; index += 1)
      pending.get(installerDownloadChunkSize * index)!(
        segment(bytes, input.expectedSha256, installerDownloadChunkSize * index),
      )
    await vi.waitFor(() =>
      expect(input.onProgress).toHaveBeenLastCalledWith(
        installerDownloadChunkSize * installerDownloadConcurrency,
      ),
    )
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(installerDownloadConcurrency + 1))
    pending.get(installerDownloadChunkSize * installerDownloadConcurrency)!(
      segment(
        bytes,
        input.expectedSha256,
        installerDownloadChunkSize * installerDownloadConcurrency,
      ),
    )

    await expect(download).resolves.toBe('save_requested')
    expect(createObjectURL.mock.calls[0]![0].size).toBe(bytes.length)
    expect(input.onProgress).toHaveBeenLastCalledWith(bytes.length)
  })

  const invalidRangeHeaders: Record<string, string>[] = [
    { 'content-range': 'bytes 1-7/8' },
    { 'content-range': 'bytes 0-7/9' },
    { 'content-range': 'bytes 0-7/8', 'content-length': '7' },
    { 'content-range': 'bytes 0-7/8', 'content-type': 'text/html' },
    { 'content-range': 'bytes 0-7/8', etag: 'W/"weak"' },
  ]
  it.each(invalidRangeHeaders)(
    'rejects an incorrect range, length, HTML or ETag without retries %#',
    async (headers) => {
      const input = options()
      const fetcher = vi.fn().mockResolvedValue(
        new Response(executable, {
          status: 206,
          headers: { etag: `"${input.expectedSha256}"`, ...headers },
        }),
      )
      vi.stubGlobal('fetch', fetcher)
      await expect(downloadScannerInstaller(input)).rejects.toThrow()
      expect(fetcher).toHaveBeenCalledOnce()
      expect(createObjectURL).not.toHaveBeenCalled()
    },
  )

  it('retains complete chunks across manual cancellation even when persistent storage is unavailable', async () => {
    const bytes = binary(installerDownloadChunkSize + 8)
    const controller = new AbortController()
    const input = await pinned(bytes, controller.signal)
    const first = vi
      .fn()
      .mockResolvedValueOnce(segment(bytes, input.expectedSha256))
      .mockReturnValue(new Promise(() => {}))
    vi.stubGlobal('fetch', first)
    const pending = downloadScannerInstaller(input)
    const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    await vi.waitFor(() => expect(first).toHaveBeenCalledTimes(2))
    controller.abort()
    await rejected
    const second = vi
      .fn()
      .mockResolvedValue(segment(bytes, input.expectedSha256, installerDownloadChunkSize))
    vi.stubGlobal('fetch', second)
    const resumed = await pinned(bytes)
    await expect(downloadScannerInstaller(resumed)).resolves.toBe('save_requested')
    expect(second).toHaveBeenCalledOnce()
    expect(second.mock.calls[0]![1].headers.Range).toContain(`bytes=${installerDownloadChunkSize}-`)
    expect(resumed.onTransfer.mock.calls[0]![0].resumedBytes).toBe(installerDownloadChunkSize)
  })

  it('safely restarts from zero when a server ignores a resumed Range', async () => {
    const bytes = binary(installerDownloadChunkSize + 8)
    const input = await pinned(bytes)
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(segment(bytes, input.expectedSha256))
      .mockResolvedValueOnce(new Response(bytes))
      .mockResolvedValueOnce(new Response(bytes))
    vi.stubGlobal('fetch', fetcher)
    await expect(downloadScannerInstaller(input)).resolves.toBe('save_requested')
    expect(fetcher).toHaveBeenCalledTimes(3)
    expect(fetcher.mock.calls[2]![1].headers.Range).toBe(
      `bytes=0-${installerDownloadChunkSize - 1}`,
    )
    expect(input.onProgress).toHaveBeenCalledWith(0)
    expect(input.onTransfer).toHaveBeenLastCalledWith(
      expect.objectContaining({ bytes: bytes.length, resumedBytes: 0 }),
    )
    expect(createObjectURL.mock.calls[0]![0].size).toBe(bytes.length)
  })

  it('allows a slow active transfer to exceed ten minutes without an idle retry', async () => {
    const bytes = binary(16)
    const input = await pinned(bytes)
    vi.useFakeTimers()
    let timer: ReturnType<typeof setInterval>
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        let index = 0
        timer = setInterval(() => {
          controller.enqueue(bytes.slice(index, ++index))
          if (index === bytes.length) {
            clearInterval(timer)
            controller.close()
          }
        }, 50_000)
      },
      cancel() {
        clearInterval(timer)
      },
    })
    const fetcher = vi.fn().mockResolvedValue(new Response(body))
    vi.stubGlobal('fetch', fetcher)
    const pending = downloadScannerInstaller(input)
    await vi.advanceTimersByTimeAsync(800_000)
    await expect(pending).resolves.toBe('save_requested')
    expect(fetcher).toHaveBeenCalledOnce()
    expect(input.onProgress).toHaveBeenLastCalledWith(bytes.length)
  })

  it('honors bounded Retry-After on 429 and cancellation interrupts the wait immediately', async () => {
    vi.useFakeTimers()
    const controller = new AbortController()
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 429, headers: { 'retry-after': '9999' } }))
    vi.stubGlobal('fetch', fetcher)
    const input = { ...options(controller.signal), onTransfer: vi.fn() }
    const pending = downloadScannerInstaller(input)
    const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    await vi.advanceTimersByTimeAsync(59_999)
    expect(fetcher).toHaveBeenCalledOnce()
    expect(input.onTransfer).toHaveBeenLastCalledWith(
      expect.objectContaining({ phase: 'retrying', retryAttempt: 1 }),
    )
    controller.abort()
    await rejected
    await vi.advanceTimersByTimeAsync(60_000)
    expect(fetcher).toHaveBeenCalledOnce()
  })

  it('reports only bounded download facts and never retains the URL or raw exception', async () => {
    vi.useFakeTimers()
    const validInput = options()
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 429, headers: { 'retry-after': '1' } }))
    vi.stubGlobal('fetch', fetcher)
    const pending = downloadScannerInstaller(validInput)
    const failure = pending.catch((error: unknown) => error)
    await vi.advanceTimersByTimeAsync(7_000)
    const error = await failure
    expect(installerDownloadFailureDetails(error)).toMatchObject({
      code: 'installer_download_rate_limited',
      phase: 'range',
      bytesReceived: 0,
      attemptCount: 4,
      waitReason: 'rate_limit',
      httpStatus: 429,
    })
    const report = createInstallerDownloadFeedbackReport({
      tool: 'screen_scanner_installer',
      installerVersion: '1.0.9',
      expectedSize: validInput.expectedSize,
      expectedSha256: validInput.expectedSha256,
      durationMs: 7200,
      error,
    })
    expect(report).toMatchObject({
      code: 'installer_download_rate_limited',
      stage: 'prepare',
      download: {
        httpStatus: 429,
        expectedRelease: {
          size: validInput.expectedSize,
          sha256: validInput.expectedSha256,
        },
      },
    })
    expect(JSON.stringify(report)).not.toMatch(/token|must-not-leak|\/downloads\//u)
  })

  it('classifies an ETag change as a release change and discards stale checkpoints', async () => {
    const input = options()
    const fetcher = vi.fn().mockResolvedValue(
      new Response(new Uint8Array([0x4d, 0x5a, 1, 2, 3, 4, 5, 6]), {
        status: 206,
        headers: {
          'content-range': 'bytes 0-7/8',
          'content-length': '8',
          etag: `"${'b'.repeat(64)}"`,
        },
      }),
    )
    vi.stubGlobal('fetch', fetcher)
    const error = await downloadScannerInstaller(input).catch((reason: unknown) => reason)
    expect(installerDownloadFailureDetails(error)).toMatchObject({
      code: 'installer_download_release_changed',
      phase: 'range',
      attemptCount: 1,
      httpStatus: 206,
    })
  })

  it('retries a rate limit after its window and resets the budget after each successful chunk', async () => {
    const bytes = binary(installerDownloadChunkSize * 2 + 8)
    const input = await pinned(bytes)
    vi.useFakeTimers()
    const attempts = new Map<number, number>()
    const fetcher = vi.fn(async (_url: string, init: RequestInit) => {
      const start = Number(/^bytes=(\d+)-/u.exec(new Headers(init.headers).get('range') ?? '')![1])
      const attempt = attempts.get(start) ?? 0
      attempts.set(start, attempt + 1)
      return attempt === 0
        ? new Response(null, { status: 429, headers: { 'retry-after': '2' } })
        : segment(bytes, input.expectedSha256, start)
    })
    vi.stubGlobal('fetch', fetcher)
    const pending = downloadScannerInstaller(input)
    await vi.advanceTimersByTimeAsync(6_000)
    await expect(pending).resolves.toBe('save_requested')
    expect(fetcher).toHaveBeenCalledTimes(6)
    expect(
      input.onTransfer.mock.calls
        .filter(([status]) => status.phase === 'retrying')
        .map(([status]) => status.retryAttempt),
    ).toEqual([1, 1, 1])
  })
}
