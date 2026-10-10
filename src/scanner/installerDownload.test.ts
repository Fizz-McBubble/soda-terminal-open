import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { webcrypto } from 'node:crypto'
import { downloadScannerInstaller, scannerInstallerFileName } from './installerDownload'
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
  expect(scannerInstallerFileName('1.0.5')).toBe('Soda-画面扫描-1.0.5.exe')
  expect(scannerInstallerFileName('1.0.6')).toBe('Soda-画面扫描-1.0.6.exe')
})
it.each(['latest', '1.0', '1.0.6-beta', '1.0.6\r\nX-Injected: yes', '../1.0.6', '1.0.6\n'])(
  'rejects an unsafe or unsupported installer version %j',
  (version) => expect(() => scannerInstallerFileName(version)).toThrow('invalid_installer_version'),
)
afterEach(() => {
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
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(executable, { status: 503 })))
  await expect(downloadScannerInstaller(options())).rejects.toThrow('download_failed')
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
it('also applies the ten-minute deadline while SHA-256 is pending', async () => {
  vi.useFakeTimers()
  vi.stubGlobal('crypto', { subtle: { digest: vi.fn().mockReturnValue(new Promise(() => {})) } })
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(executable)))
  const pending = downloadScannerInstaller(options())
  const rejected = expect(pending).rejects.toMatchObject({ name: 'TimeoutError' })
  await vi.advanceTimersByTimeAsync(0)
  expect(crypto.subtle.digest).toHaveBeenCalledOnce()
  await vi.advanceTimersByTimeAsync(10 * 60 * 1000)
  await rejected
  expect(createObjectURL).not.toHaveBeenCalled()
})
it('releases a partial stream on a network failure without requesting save', async () => {
  let streamController!: ReadableStreamDefaultController<Uint8Array>
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      streamController = controller
      controller.enqueue(executable.subarray(0, 4))
    },
  })
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body)))
  const input = options()
  const pending = downloadScannerInstaller(input)
  const rejected = expect(pending).rejects.toThrow('network_error')
  await vi.waitFor(() => expect(input.onProgress).toHaveBeenCalledWith(4))
  streamController.error(new Error('network_error'))
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
  controller.abort()
  await rejected
  const cancel = vi.fn()
  finishFetch(new Response(new ReadableStream({ cancel })))
  await Promise.resolve()
  expect(cancel).toHaveBeenCalledOnce()
  expect(createObjectURL).not.toHaveBeenCalled()
})
it('ends a non-settling fetch after ten minutes', async () => {
  vi.useFakeTimers()
  const fetcher = vi.fn().mockReturnValue(new Promise(() => {}))
  vi.stubGlobal('fetch', fetcher)
  const pending = downloadScannerInstaller(options())
  const rejected = expect(pending).rejects.toMatchObject({ name: 'TimeoutError' })
  await vi.advanceTimersByTimeAsync(10 * 60 * 1000)
  await rejected
  expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true)
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
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body)))
  const input = options()
  const pending = downloadScannerInstaller(input)
  const rejected = expect(pending).rejects.toMatchObject({ name: 'TimeoutError' })
  await vi.advanceTimersByTimeAsync(0)
  expect(input.onProgress).toHaveBeenCalledWith(4)
  await vi.advanceTimersByTimeAsync(10 * 60 * 1000)
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
