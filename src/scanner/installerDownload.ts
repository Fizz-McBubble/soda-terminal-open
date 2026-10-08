export type InstallerDownloadResult = 'save_requested'

export function scannerInstallerFileName(version: string): string {
  if (!/^\d+\.\d+\.\d+$/u.test(version)) throw new Error('invalid_installer_version')
  return `Soda-Scanner-Setup-${version}.exe`
}

function waitForAbortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
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

/** Fetch bytes directly; the release size bounds the buffer before browser saving. */
export async function downloadScannerInstaller({
  url,
  fileName,
  expectedSize,
  signal,
  onProgress,
  onSaving,
}: {
  url: string
  fileName: string
  expectedSize: number
  signal: AbortSignal
  onProgress: (bytes: number) => void
  onSaving: () => void
}): Promise<InstallerDownloadResult> {
  if (!Number.isSafeInteger(expectedSize) || expectedSize < 2)
    throw new Error('invalid_download_size')
  const controller = new AbortController()
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
  const chunks: Uint8Array<ArrayBuffer>[] = []
  const abort = (reason: unknown) => {
    controller.abort(reason)
    void reader?.cancel().catch(() => {})
    chunks.length = 0
  }
  const cancel = () => abort(signal.reason)
  signal.addEventListener('abort', cancel, { once: true })
  const deadline = setTimeout(
    () => abort(new DOMException('download_timeout', 'TimeoutError')),
    10 * 60 * 1000,
  )
  try {
    if (signal.aborted) cancel()
    controller.signal.throwIfAborted()
    const responsePromise = fetch(url, { credentials: 'omit', signal: controller.signal })
    // Fetch honors abort in ordinary browsers. Consume a late response too if a
    // host failed to reject the fetch, without waiting for it to release the UI.
    void responsePromise.then(
      (response) => {
        if (controller.signal.aborted) void response.body?.cancel().catch(() => {})
      },
      () => {},
    )
    const response = await waitForAbortable(responsePromise, controller.signal)
    controller.signal.throwIfAborted()
    if (!response.ok || !response.body) throw new Error('download_failed')
    reader = response.body.getReader()
    const signature: number[] = []
    let bytes = 0
    while (true) {
      const { done, value } = await waitForAbortable(reader.read(), controller.signal)
      controller.signal.throwIfAborted()
      if (done) break
      bytes += value.byteLength
      if (bytes > expectedSize) throw new Error('invalid_download')
      for (const byte of value.subarray(0, Math.max(0, 2 - signature.length))) signature.push(byte)
      if (signature.length === 2 && (signature[0] !== 0x4d || signature[1] !== 0x5a))
        throw new Error('invalid_download')
      // Keep only the received view's bytes, rather than retaining a potentially
      // larger backing buffer supplied by the host stream.
      chunks.push(new Uint8Array(value))
      onProgress(bytes)
    }
    if (bytes !== expectedSize || signature.length !== 2) throw new Error('incomplete_download')
    onSaving()
    controller.signal.throwIfAborted()
    const blob = new Blob(chunks, { type: 'application/octet-stream' })
    chunks.length = 0
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
    return 'save_requested'
  } finally {
    clearTimeout(deadline)
    signal.removeEventListener('abort', cancel)
    chunks.length = 0
    // Cancellation must not keep the UI pending on a host cleanup promise.
    void reader?.cancel().catch(() => {})
    reader?.releaseLock()
  }
}
