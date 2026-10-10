import { useCallback, useEffect, useRef, useState } from 'react'
import { Download, X } from 'lucide-react'
import {
  assetQuickReadDownloadAvailable,
  assetQuickReadRelease,
  type AssetQuickReadRelease,
} from '../assetQuickRead/distribution'
import { downloadAssetQuickReadInstaller } from '../assetQuickRead/installerDownload'
import './AssetQuickReadInstallerAction.css'

type State = 'idle' | 'downloading' | 'saving' | 'save_requested' | 'error' | 'cancelled'
export function AssetQuickReadInstallerAction({
  connected = false,
  blocked = false,
  release = assetQuickReadRelease,
  onConnect,
  onReturnConnect,
  onBusyChange,
}: {
  connected?: boolean
  blocked?: boolean
  release?: AssetQuickReadRelease
  onConnect?: () => void | Promise<void>
  onReturnConnect?: () => void | Promise<void>
  onBusyChange?: (busy: boolean) => void
}) {
  const [state, setState] = useState<State>('idle')
  const [bytes, setBytes] = useState(0)
  const [notice, setNotice] = useState('')
  const [connecting, setConnecting] = useState(false)
  const request = useRef<AbortController | null>(null)
  const mounted = useRef(false)
  const left = useRef(false)
  const attempted = useRef(false)
  const connectPending = useRef(false)
  const downloadButton = useRef<HTMLButtonElement>(null)
  const cancelButton = useRef<HTMLButtonElement>(null)
  const restoreFocus = useRef(false)
  const available = assetQuickReadDownloadAvailable(release)
  const pending = state === 'downloading' || state === 'saving'
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      request.current?.abort()
      request.current = null
    }
  }, [])
  useEffect(() => {
    onBusyChange?.(pending)
    return () => onBusyChange?.(false)
  }, [pending, onBusyChange])
  useEffect(() => {
    if (!pending && restoreFocus.current) {
      restoreFocus.current = false
      downloadButton.current?.focus({ preventScroll: true })
    }
  }, [pending])
  const connect = useCallback(
    async (automatic: boolean) => {
      const callback = automatic ? onReturnConnect : onConnect
      if (blocked || connectPending.current || !callback) return
      connectPending.current = true
      attempted.current = true
      setConnecting(true)
      setNotice('')
      try {
        await callback()
      } catch {
        if (mounted.current) setNotice('尚未连接。完成安装后，点击连接独立工具继续。')
      } finally {
        connectPending.current = false
        if (mounted.current) setConnecting(false)
      }
    },
    [blocked, onConnect, onReturnConnect],
  )
  useEffect(() => {
    if (state !== 'save_requested' || !onReturnConnect) return
    const depart = () => {
      left.current = true
    }
    const returned = () => {
      if (left.current && !attempted.current && !blocked) void connect(true)
    }
    const changed = () => {
      if (document.visibilityState === 'hidden') depart()
      else returned()
    }
    window.addEventListener('blur', depart)
    window.addEventListener('focus', returned)
    document.addEventListener('visibilitychange', changed)
    return () => {
      window.removeEventListener('blur', depart)
      window.removeEventListener('focus', returned)
      document.removeEventListener('visibilitychange', changed)
    }
  }, [state, onReturnConnect, blocked, connect])
  async function download() {
    if (!available || blocked || request.current || connectPending.current) return
    const controller = new AbortController()
    request.current = controller
    const current = () => mounted.current && request.current === controller
    left.current = false
    attempted.current = false
    setState('downloading')
    setBytes(0)
    setNotice('')
    try {
      const result = await downloadAssetQuickReadInstaller({
        release,
        signal: controller.signal,
        onProgress: (value) => {
          if (current()) setBytes(value)
        },
        onSaving: () => {
          if (current()) setState('saving')
        },
      })
      if (current()) {
        restoreFocus.current ||= document.activeElement === cancelButton.current
        setState(result)
      }
    } catch (error) {
      if (current()) {
        restoreFocus.current ||= document.activeElement === cancelButton.current
        setState(controller.signal.aborted ? 'cancelled' : 'error')
        if (error instanceof DOMException && error.name === 'TimeoutError')
          setNotice('下载超时，请重试。')
      }
    } finally {
      if (request.current === controller) request.current = null
    }
  }
  const progress =
    state === 'saving'
      ? '正在准备文件'
      : `下载中 ${Math.min(100, Math.floor((bytes / (release.size ?? 1)) * 100))}%`
  const feedback =
    notice ||
    (state === 'save_requested'
      ? '文件已准备。请在下载列表打开安装包，完成安装后回到本页连接；不会自动开始读取。'
      : state === 'cancelled'
        ? '下载已取消，可重新下载。'
        : state === 'error'
          ? '下载未完成，请重试。'
          : '')
  return (
    <>
      <button
        ref={downloadButton}
        className="button button--quiet asset-quick-read-installer__download"
        type="button"
        title={!available ? '独立安装包尚未发布，当前不能下载。' : `独立工具 v${release.version}`}
        disabled={!available || blocked || pending || connecting}
        onClick={() => void download()}
      >
        <Download size={17} aria-hidden="true" />
        {pending
          ? progress
          : state === 'save_requested'
            ? '重新下载独立工具'
            : connected
              ? '更新独立工具'
              : '下载独立工具'}
        {!pending && available && (
          <small className="asset-quick-read-installer__version" aria-hidden="true">
            v{release.version}
          </small>
        )}
      </button>
      {pending && (
        <>
          <progress
            className="asset-quick-read-installer__progress"
            aria-label="独立工具下载进度"
            aria-valuetext={progress}
            value={bytes}
            max={release.size ?? 1}
          />
          <button
            ref={cancelButton}
            className="button button--quiet"
            type="button"
            aria-label="取消独立工具下载"
            onClick={() => {
              restoreFocus.current = document.activeElement === cancelButton.current
              request.current?.abort()
            }}
          >
            <X size={16} aria-hidden="true" />
            取消下载
          </button>
        </>
      )}
      {feedback && (
        <div className="asset-quick-read-installer__feedback" role="status">
          {feedback}
          {state === 'save_requested' && !connected && onConnect && (
            <button
              className="button button--quiet"
              type="button"
              disabled={blocked || connecting}
              onClick={() => void connect(false)}
            >
              {connecting ? '连接中…' : '安装完成，继续连接'}
            </button>
          )}
        </div>
      )}
    </>
  )
}
