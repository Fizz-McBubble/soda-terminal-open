import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { webcrypto } from 'node:crypto'
import Dexie from 'dexie'
import {
  downloadScannerInstaller,
  installerDownloadConcurrency,
  scannerInstallerFileName,
} from './installerDownload'
import { InstallerDownloadCache, installerDownloadIdentity } from './installerDownloadCache'
import { installerDownloadChunkSize } from './installerDownloadCache'
const executable = new Uint8Array([0x4d, 0x5a, 1, 2, 3, 4, 5, 6])
const createObjectURL = vi.fn().mockReturnValue('blob:installer')
const revokeObjectURL = vi.fn()
function options(signal = new AbortController().signal) {
  return {
    url: '/downloads/Soda-Scanner-Setup.exe',
    fileName: scannerInstallerFileName('1.0.6'),
    expectedSize: 8,
    expectedSha256: '9f36b7c45ed5f988cdccc31daef10be8d5b0d55fdfc6181df5eff666a9c4f2db',
    signal,
    onProgress: vi.fn(),
    onSaving: vi.fn(),
  }
}
beforeEach(() => {
  // Legacy stream/timeout cases also exercise the storage-unavailable fallback.
  // Persistent checkpoints are covered separately against real fake-indexeddb.
  vi.spyOn(Dexie.prototype, 'open').mockRejectedValue(new DOMException('blocked', 'SecurityError'))
  vi.stubGlobal('crypto', webcrypto)
  createObjectURL.mockClear()
  revokeObjectURL.mockClear()
  vi.stubGlobal(
    'URL',
    class extends URL {
      static createObjectURL = createObjectURL
      static revokeObjectURL = revokeObjectURL
    },
  )
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
})
it('derives the save filename from the installer version', () => {
  expect(scannerInstallerFileName('1.0.9')).toBe('SodaTerminal-Scanner-Setup-1.0.9.exe')
  expect(scannerInstallerFileName('1.0.5')).toBe('Soda-画面扫描-1.0.5.exe')
  expect(scannerInstallerFileName('1.0.6')).toBe('Soda-画面扫描-1.0.6.exe')
})
it.each(['latest', '1.0', '1.0.6-beta', '1.0.6\r\nX-Injected: yes', '../1.0.6', '1.0.6\n'])(
  'rejects an unsafe or unsupported installer version %j',
  (version) => expect(() => scannerInstallerFileName(version)).toThrow('invalid_installer_version'),
)
afterEach(async () => {
  const input = options()
  const cache = new InstallerDownloadCache(
    installerDownloadIdentity(input.url, input.expectedSize, input.expectedSha256),
    input.signal,
  )
  await cache.discard()
  await cache.close()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
it('receives split MZ bytes and only requests save after the complete pinned file', async () => {
  const chunks = [executable.subarray(0, 1), executable.subarray(1, 4), executable.subarray(4)]
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk)
      controller.close()
    },
  })
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body)))
  const input = options()
  await expect(downloadScannerInstaller(input)).resolves.toBe('save_requested')
  expect(input.onProgress.mock.calls.flat()).toEqual([1, 4, 8])
  expect(input.onSaving).toHaveBeenCalledOnce()
  expect(createObjectURL.mock.calls[0][0].size).toBe(8)
  expect(
    (vi.mocked(HTMLAnchorElement.prototype.click).mock.instances[0] as HTMLAnchorElement).download,
  ).toBe('Soda-画面扫描-1.0.6.exe')
})
it.each([
  ['truncated', executable.subarray(0, 7)],
  ['oversized', new Uint8Array([...executable, 9])],
  ['invalid header', new Uint8Array([60, 104, 116, 109, 108])],
  ['empty', new Uint8Array()],
])('rejects a %s response without allocating a save Blob', async (_, bytes) => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(bytes)))
  await expect(downloadScannerInstaller(options())).rejects.toThrow()
  expect(createObjectURL).not.toHaveBeenCalled()
})
it('does not treat an HTTP failure as a download', async () => {
  vi.useFakeTimers()
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(executable, { status: 503 })))
  const rejected = expect(downloadScannerInstaller(options())).rejects.toThrow('download_failed')
  await vi.advanceTimersByTimeAsync(7_000)
  await rejected
  expect(fetch).toHaveBeenCalledTimes(4)
  expect(createObjectURL).not.toHaveBeenCalled()
})
it('rejects tampered bytes with the same size and MZ header before creating a save URL', async () => {
  const tampered = new Uint8Array(executable)
  tampered[tampered.length - 1] ^= 1
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(tampered)))
  await expect(downloadScannerInstaller(options())).rejects.toThrow('invalid_download_sha256')
  expect(createObjectURL).not.toHaveBeenCalled()
  expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled()
})
it('cancels promptly during a non-settling full-file hash without requesting save', async () => {
  vi.stubGlobal('crypto', { subtle: { digest: vi.fn().mockReturnValue(new Promise(() => {})) } })
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(executable)))
  const controller = new AbortController()
  const input = options(controller.signal)
  const pending = downloadScannerInstaller(input)
  const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' })
  await vi.waitFor(() => expect(crypto.subtle.digest).toHaveBeenCalledOnce())
  controller.abort()
  await rejected
  expect(createObjectURL).not.toHaveBeenCalled()
})
it('applies a separate sixty-second deadline while SHA-256 is pending', async () => {
  vi.useFakeTimers()
  vi.stubGlobal('crypto', { subtle: { digest: vi.fn().mockReturnValue(new Promise(() => {})) } })
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(executable)))
  const pending = downloadScannerInstaller(options())
  const rejected = expect(pending).rejects.toMatchObject({ name: 'TimeoutError' })
  await vi.advanceTimersByTimeAsync(0)
  expect(crypto.subtle.digest).toHaveBeenCalledOnce()
  await vi.advanceTimersByTimeAsync(60_000)
  await rejected
  expect(createObjectURL).not.toHaveBeenCalled()
})
it('releases a partial stream on a network failure without requesting save', async () => {
  vi.useFakeTimers()
  let streamController!: ReadableStreamDefaultController<Uint8Array>
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      streamController = controller
      controller.enqueue(executable.subarray(0, 4))
    },
  })
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValueOnce(new Response(body)).mockRejectedValue(new Error('network_error')),
  )
  const input = options()
  const pending = downloadScannerInstaller(input)
  const rejected = expect(pending).rejects.toThrow('network_error')
  await vi.advanceTimersByTimeAsync(0)
  expect(input.onProgress).toHaveBeenCalledWith(4)
  streamController.error(new Error('network_error'))
  await vi.advanceTimersByTimeAsync(7_000)
  await rejected
  expect(body.locked).toBe(false)
  expect(createObjectURL).not.toHaveBeenCalled()
})
it('cancels promptly even when the underlying stream cleanup never settles', async () => {
  const cancel = vi.fn().mockReturnValue(new Promise(() => {}))
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(executable.subarray(0, 4))
    },
    cancel,
  })
  const fetcher = vi.fn().mockResolvedValue(new Response(body))
  vi.stubGlobal('fetch', fetcher)
  const controller = new AbortController()
  const input = options(controller.signal)
  const pending = downloadScannerInstaller(input)
  const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' })
  await vi.waitFor(() => expect(input.onProgress).toHaveBeenCalledWith(4))
  controller.abort()
  await rejected
  expect(cancel).toHaveBeenCalledOnce()
  expect(body.locked).toBe(false)
  expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true)
  expect(createObjectURL).not.toHaveBeenCalled()
})
it('cancels a non-settling host fetch and disposes its late response', async () => {
  let finishFetch!: (response: Response) => void
  const fetcher = vi.fn().mockReturnValue(
    new Promise<Response>((resolve) => {
      finishFetch = resolve
    }),
  )
  vi.stubGlobal('fetch', fetcher)
  const controller = new AbortController()
  const pending = downloadScannerInstaller(options(controller.signal))
  const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' })
  await vi.waitFor(() => expect(fetcher).toHaveBeenCalledOnce())
  controller.abort()
  await rejected
  const cancel = vi.fn()
  finishFetch(new Response(new ReadableStream({ cancel })))
  await Promise.resolve()
  expect(cancel).toHaveBeenCalledOnce()
  expect(createObjectURL).not.toHaveBeenCalled()
})
it('ends non-settling fetch attempts after bounded idle time and three retries', async () => {
  vi.useFakeTimers()
  const fetcher = vi.fn().mockReturnValue(new Promise(() => {}))
  vi.stubGlobal('fetch', fetcher)
  const pending = downloadScannerInstaller(options())
  const rejected = expect(pending).rejects.toMatchObject({ name: 'TimeoutError' })
  await vi.advanceTimersByTimeAsync(4 * 60_000 + 7_000)
  await rejected
  expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true)
  expect(fetcher).toHaveBeenCalledTimes(4)
  expect(createObjectURL).not.toHaveBeenCalled()
})
it('times out a stalled partial stream and releases the reader', async () => {
  vi.useFakeTimers()
  const cancel = vi.fn()
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(executable.subarray(0, 4))
    },
    cancel,
  })
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValueOnce(new Response(body))
      .mockReturnValue(new Promise(() => {})),
  )
  const input = options()
  const pending = downloadScannerInstaller(input)
  const rejected = expect(pending).rejects.toMatchObject({ name: 'TimeoutError' })
  await vi.advanceTimersByTimeAsync(0)
  expect(input.onProgress).toHaveBeenCalledWith(4)
  await vi.advanceTimersByTimeAsync(4 * 60_000 + 7_000)
  await rejected
  expect(cancel).toHaveBeenCalledOnce()
  expect(body.locked).toBe(false)
  expect(createObjectURL).not.toHaveBeenCalled()
})
it('retains the save object URL for sixty seconds then releases it', async () => {
  vi.useFakeTimers()
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(executable)))
  await expect(downloadScannerInstaller(options())).resolves.toBe('save_requested')
  expect(revokeObjectURL).not.toHaveBeenCalled()
  await vi.advanceTimersByTimeAsync(60_000)
  expect(revokeObjectURL).toHaveBeenCalledWith('blob:installer')
})
it('clears the buffer and reader if the browser cannot accept a save request', async () => {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(executable)
      controller.close()
    },
  })
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body)))
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {
    throw new DOMException('save not allowed', 'SecurityError')
  })
  await expect(downloadScannerInstaller(options())).rejects.toMatchObject({ name: 'SecurityError' })
  expect(body.locked).toBe(false)
})

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
    segment(bytes, input.expectedSha256, installerDownloadChunkSize * installerDownloadConcurrency),
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
  expect(fetcher.mock.calls[2]![1].headers.Range).toBe(`bytes=0-${installerDownloadChunkSize - 1}`)
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
