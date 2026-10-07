import { useRef, useState } from 'react'
import { Download } from 'lucide-react'
import {
  scannerDistributionManifest,
  type ScannerDistributionSnapshot,
} from '../scanner/distribution'

type SaveHandle = { createWritable(): Promise<FileSystemWritableFileStream> }
type SaveWindow = Window & {
  showSaveFilePicker?: (options: { suggestedName: string; startIn: string }) => Promise<SaveHandle>
}

export function ScannerInstallerAction({
  distribution,
  issueCode,
}: {
  distribution: ScannerDistributionSnapshot
  issueCode?: string
}) {
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState('')
  const inFlight = useRef(false)
  const update = Boolean(
    (distribution.installedVersion &&
      distribution.installedVersion !== scannerDistributionManifest.runtime.version) ||
    ['helper_incompatible', 'helper_pairing_denied'].includes(issueCode ?? ''),
  )
  if (
    scannerDistributionManifest.runtime.releaseState !== 'published' ||
    (distribution.state === 'ready' && !update)
  )
    return null

  async function download() {
    if (inFlight.current) return
    inFlight.current = true
    setPending(true)
    setMessage('')
    let writable: FileSystemWritableFileStream | undefined
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
    try {
      const picker = (window as SaveWindow).showSaveFilePicker
      if (!picker) {
        const anchor = document.createElement('a')
        anchor.href = scannerDistributionManifest.helper.downloadUrl
        anchor.download = scannerDistributionManifest.helper.entry
        anchor.click()
        return
      }
      // Preserve the click's transient activation: ask where to save before fetching.
      const handle = await picker.call(window, {
        suggestedName: scannerDistributionManifest.helper.entry,
        startIn: 'downloads',
      })
      const response = await fetch(scannerDistributionManifest.helper.downloadUrl, {
        credentials: 'omit',
        signal: AbortSignal.timeout(10 * 60 * 1000),
      })
      if (!response.ok) throw new Error('download_failed')
      const expectedSize = scannerDistributionManifest.helper.size
      if (!response.body || !Number.isSafeInteger(expectedSize) || expectedSize <= 0)
        throw new Error('invalid_download')
      reader = response.body.getReader()
      const prefix: Uint8Array[] = []
      let size = 0
      while (size < 2) {
        const { done, value } = await reader.read()
        if (done) throw new Error('invalid_download')
        prefix.push(value)
        size += value.byteLength
      }
      const signature = prefix.flatMap((chunk) => Array.from(chunk.subarray(0, 2))).slice(0, 2)
      if (signature[0] !== 0x4d || signature[1] !== 0x5a || size > expectedSize)
        throw new Error('invalid_download')
      writable = await handle.createWritable()
      for (const chunk of prefix) await writable.write(chunk as Uint8Array<ArrayBuffer>)
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        size += value.byteLength
        if (size > expectedSize) throw new Error('invalid_download')
        await writable.write(value as Uint8Array<ArrayBuffer>)
      }
      if (size !== expectedSize) throw new Error('incomplete_download')
      await writable.close()
      writable = undefined
    } catch (error) {
      await writable?.abort().catch(() => {})
      if (!(error instanceof DOMException && error.name === 'AbortError'))
        setMessage('下载未完成，请重试。')
    } finally {
      await reader?.cancel().catch(() => {})
      reader?.releaseLock()
      inFlight.current = false
      setPending(false)
    }
  }
  return (
    <>
      <button
        className="button button--quiet scanner-prepare__download"
        type="button"
        onClick={() => void download()}
        disabled={pending}
      >
        <Download aria-hidden="true" size={17} />
        {pending ? '正在下载…' : update ? '更新扫描助手' : '下载扫描助手'}
      </button>
      {message ? (
        <p className="scanner-installer__notice" role="status">
          {message}
        </p>
      ) : null}
    </>
  )
}
