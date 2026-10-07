import { useCallback, useEffect, useRef, useState } from 'react'
import { Download } from 'lucide-react'
import {
  scannerDistributionManifest,
  type ScannerDistributionSnapshot,
} from '../scanner/distribution'
import { downloadScannerInstaller } from '../scanner/installerDownload'
import './scanner-installer-action.css'

type DownloadState = 'idle' | 'downloading' | 'saving' | 'save_requested' | 'error' | 'cancelled'
const megabytes = (bytes: number) => (bytes / 1_000_000).toFixed(1)

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
  const [connecting, setConnecting] = useState(false)
  const [timedOut, setTimedOut] = useState(false)
  const [connectionNotice, setConnectionNotice] = useState('')
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
  const progressText = `${percent}% · ${megabytes(bytes)} / ${megabytes(expectedSize)} MB`
  const update = Boolean(
    (distribution.installedVersion &&
      distribution.installedVersion !== scannerDistributionManifest.runtime.version) ||
    ['helper_incompatible', 'helper_pairing_denied'].includes(issueCode ?? ''),
  )
  const connect = useCallback(async () => {
    if (connectPending.current || !onConnect) return
    connectPending.current = true
    autoConnectAttempted.current = true
    setConnecting(true)
    setConnectionNotice('')
    try {
      await onConnect()
    } catch {
      if (mounted.current)
        setConnectionNotice('暂未连接，请确认安装包已打开且助手已启动，再次连接。')
    } finally {
      connectPending.current = false
      if (mounted.current) setConnecting(false)
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
        setState(result)
      }
    } catch (error) {
      if (!current()) return
      const cancelled =
        controller.signal.aborted || (error instanceof DOMException && error.name === 'AbortError')
      setTimedOut(error instanceof DOMException && error.name === 'TimeoutError')
      setState(cancelled ? 'cancelled' : 'error')
    } finally {
      if (request.current === controller) request.current = null
    }
  }

  const message =
    state === 'save_requested'
      ? `安装包已接收。请在浏览器下载列表中确认保存并打开 ${scannerDistributionManifest.helper.entry}，首次打开会自动安装并启动助手；返回本页后会尝试连接。`
      : state === 'cancelled'
        ? '下载已取消，可以重新下载。'
        : state === 'error'
          ? timedOut
            ? '下载超时，请重试或使用浏览器直接下载。'
            : '下载未完成，请重试或使用浏览器直接下载。'
          : ''

  return (
    <div className={`scanner-installer${state !== 'idle' ? ' is-active' : ''}`}>
      <div className="scanner-installer__actions">
        <button
          className="button button--quiet scanner-prepare__download"
          type="button"
          onClick={() => void download()}
          disabled={pending}
        >
          <Download aria-hidden="true" size={17} />
          {pending ? '正在下载…' : complete ? '重新下载' : update ? '更新扫描助手' : '下载扫描助手'}
        </button>
        {pending ? (
          <button
            className="button button--quiet"
            type="button"
            onClick={() => request.current?.abort()}
          >
            取消下载
          </button>
        ) : null}
      </div>
      {pending || complete ? (
        <div className="scanner-installer__progress">
          <progress
            aria-label="扫描助手下载进度"
            aria-valuetext={progressText}
            value={bytes}
            max={expectedSize}
          />
          <span>{progressText}</span>
          {pending ? (
            <span role="status">
              {state === 'saving' ? '下载完成，正在保存…' : '正在接收安装包…'}
            </span>
          ) : null}
        </div>
      ) : null}
      {message ? (
        <p className="scanner-installer__notice" role="status">
          {message}
        </p>
      ) : null}
      {state === 'idle' ? (
        <p className="scanner-installer__notice">首次打开安装包后会自动安装并启动助手。</p>
      ) : null}
      {connectionNotice ? (
        <p className="scanner-installer__notice" role="status">
          {connectionNotice}
        </p>
      ) : null}
      {complete && onConnect ? (
        <button
          className="button button--quiet"
          type="button"
          disabled={connecting}
          onClick={() => void connect()}
        >
          {connecting ? '正在连接…' : '已打开，连接助手'}
        </button>
      ) : null}
      {state === 'error' || state === 'cancelled' ? (
        <a
          className="scanner-installer__fallback"
          href={scannerDistributionManifest.helper.downloadUrl}
          download={scannerDistributionManifest.helper.entry}
        >
          浏览器直接下载
        </a>
      ) : null}
    </div>
  )
}
