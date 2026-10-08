import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, Download, X } from 'lucide-react'
import {
  scannerDistributionManifest,
  type ScannerDistributionSnapshot,
} from '../scanner/distribution'
import { downloadScannerInstaller } from '../scanner/installerDownload'
import './scanner-installer-action.css'

type DownloadState = 'idle' | 'downloading' | 'saving' | 'save_requested' | 'error' | 'cancelled'

export function ScannerInstallerAction({
  distribution,
  issueCode,
  onConnect,
}: {
  distribution: ScannerDistributionSnapshot
  issueCode?: string
  onConnect?: () => void | Promise<void>
}) {
  const [state, setState] = useState<DownloadState>('idle')
  const [bytes, setBytes] = useState(0)
  const [timedOut, setTimedOut] = useState(false)
  const [connectionNotice, setConnectionNotice] = useState('')
  const downloadButton = useRef<HTMLButtonElement | null>(null)
  const cancelButton = useRef<HTMLButtonElement | null>(null)
  const restoreDownloadFocus = useRef(false)
  const request = useRef<AbortController | null>(null)
  const connectPending = useRef(false)
  const completedDownload = useRef(false)
  const leftAfterDownload = useRef(false)
  const autoConnectAttempted = useRef(false)
  const mounted = useRef(false)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      request.current?.abort()
      request.current = null
      completedDownload.current = false
    }
  }, [])
  const pending = state === 'downloading' || state === 'saving'
  const complete = state === 'save_requested'
  const expectedSize = scannerDistributionManifest.helper.size
  const percent = Math.min(100, Math.floor((bytes / expectedSize) * 100))
  const progressText = state === 'saving' ? '正在准备文件' : `下载中 ${percent}%`
  useEffect(() => {
    if (!pending && restoreDownloadFocus.current) {
      restoreDownloadFocus.current = false
      downloadButton.current?.focus({ preventScroll: true })
    }
  }, [pending])
  const update = Boolean(
    (distribution.installedVersion &&
      distribution.installedVersion !== scannerDistributionManifest.runtime.version) ||
    ['helper_incompatible', 'helper_pairing_denied'].includes(issueCode ?? ''),
  )
  const connect = useCallback(async () => {
    if (connectPending.current || !onConnect) return
    connectPending.current = true
    autoConnectAttempted.current = true
    setConnectionNotice('')
    try {
      await onConnect()
    } catch {
      if (mounted.current) setConnectionNotice('启动助手后点击连接')
    } finally {
      connectPending.current = false
    }
  }, [onConnect])

  useEffect(() => {
    if (!complete || !onConnect) return
    const left = () => {
      if (completedDownload.current) leftAfterDownload.current = true
    }
    const returned = () => {
      if (
        !completedDownload.current ||
        !leftAfterDownload.current ||
        autoConnectAttempted.current ||
        connectPending.current
      )
        return
      autoConnectAttempted.current = true
      void connect()
    }
    const visibilityChanged = () => {
      if (document.visibilityState === 'hidden') left()
      else returned()
    }
    window.addEventListener('blur', left)
    window.addEventListener('focus', returned)
    document.addEventListener('visibilitychange', visibilityChanged)
    return () => {
      window.removeEventListener('blur', left)
      window.removeEventListener('focus', returned)
      document.removeEventListener('visibilitychange', visibilityChanged)
    }
  }, [complete, onConnect, connect])

  if (
    scannerDistributionManifest.runtime.releaseState !== 'published' ||
    (distribution.state === 'ready' && !update && !pending)
  )
    return null

  async function download() {
    if (request.current) return
    const controller = new AbortController()
    request.current = controller
    completedDownload.current = false
    const current = () => mounted.current && request.current === controller
    setState('downloading')
    setBytes(0)
    setTimedOut(false)
    setConnectionNotice('')
    leftAfterDownload.current = false
    autoConnectAttempted.current = false
    try {
      const result = await downloadScannerInstaller({
        url: scannerDistributionManifest.helper.downloadUrl,
        fileName: scannerDistributionManifest.helper.entry,
        expectedSize,
        signal: controller.signal,
        onProgress: (received) => {
          if (current()) setBytes(received)
        },
        onSaving: () => {
          if (current()) setState('saving')
        },
      })
      if (current()) {
        completedDownload.current = true
        restoreDownloadFocus.current = document.activeElement === cancelButton.current
        setState(result)
      }
    } catch (error) {
      if (!current()) return
      const cancelled =
        controller.signal.aborted || (error instanceof DOMException && error.name === 'AbortError')
      restoreDownloadFocus.current = document.activeElement === cancelButton.current
      setTimedOut(error instanceof DOMException && error.name === 'TimeoutError')
      setState(cancelled ? 'cancelled' : 'error')
    } finally {
      if (request.current === controller) request.current = null
    }
  }

  const message =
    connectionNotice ||
    (complete
      ? '在下载列表打开安装包'
      : state === 'cancelled'
        ? '下载已取消'
        : state === 'error'
          ? timedOut
            ? '下载超时'
            : '下载未完成'
          : '')

  return (
    <div className="scanner-installer">
      <div
        className={`scanner-installer__control${pending ? ' is-pending' : ''}${complete ? ' is-complete' : ''}`}
      >
        <button
          ref={downloadButton}
          className="button button--quiet scanner-prepare__download"
          type="button"
          onClick={() => void download()}
          disabled={pending}
        >
          {complete ? (
            <Check aria-hidden="true" size={16} />
          ) : (
            <Download aria-hidden="true" size={17} />
          )}
          <span>
            {pending
              ? progressText
              : complete
                ? '重新下载'
                : update
                  ? '更新扫描助手'
                  : '下载扫描助手'}
          </span>
        </button>
        {pending ? (
          <>
            <progress
              className="scanner-installer__progress"
              aria-label="扫描助手下载进度"
              aria-valuetext={progressText}
              value={bytes}
              max={expectedSize}
            />
            <button
              ref={cancelButton}
              className="scanner-installer__cancel"
              type="button"
              aria-label="取消下载"
              title="取消下载"
              onClick={() => {
                restoreDownloadFocus.current = document.activeElement === cancelButton.current
                request.current?.abort()
              }}
            >
              <X aria-hidden="true" size={15} />
            </button>
          </>
        ) : null}
      </div>
      {message ? (
        <div className="scanner-installer__feedback" role="status">
          <span className="scanner-installer__notice">{message}</span>
          {state === 'error' || state === 'cancelled' ? (
            <a
              className="scanner-installer__fallback"
              href={scannerDistributionManifest.helper.downloadUrl}
              download={scannerDistributionManifest.helper.entry}
            >
              直接下载
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
