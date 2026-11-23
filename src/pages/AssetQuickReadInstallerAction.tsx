import { useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Download, X } from 'lucide-react'
import {
  assetQuickReadDownloadAvailable,
  assetQuickReadRelease,
  type AssetQuickReadRelease,
} from '../assetQuickRead/distribution'
import {
  downloadAssetQuickReadInstaller,
  readAssetQuickReadInstallerRelease,
} from '../assetQuickRead/installerDownload'
import {
  createInstallerDownloadFeedbackReport,
  installerDownloadFailureDetails,
} from '../scanner/installerDownload'
import type { InstallerTransferProgress } from '../scanner/installerDownload'
import {
  installerTransferStatus,
  installerOutcomeMessage,
} from '../scanner/installerTransferStatus'
import './scanner-installer-action.css'
import './AssetQuickReadInstallerAction.css'
import { assetQuickReadUpgradeNotice } from '../assetQuickRead/upgradeNotice'
import { ScannerPreparationStatus } from './ScannerPreparationStatus'

type State = 'idle' | 'downloading' | 'saving' | 'save_requested' | 'error' | 'cancelled'
export function AssetQuickReadInstallerAction({
  connected = false,
  blocked = false,
  release = assetQuickReadRelease,
  onConnect,
  onReturnConnect,
  onBusyChange,
  toolVersion,
}: {
  connected?: boolean
  blocked?: boolean
  release?: AssetQuickReadRelease
  onConnect?: () => void | Promise<void>
  onReturnConnect?: () => void | Promise<void>
  onBusyChange?: (busy: boolean) => void
  toolVersion?: string | null
}) {
  const [state, setState] = useState<State>('idle')
  const publishStatus = useContext(ScannerPreparationStatus)
  const [bytes, setBytes] = useState(0)
  const [transfer, setTransfer] = useState<InstallerTransferProgress | null>(null)
  const [notice, setNotice] = useState('')
  const [resolvedRelease, setResolvedRelease] = useState<{
    source: AssetQuickReadRelease
    value: AssetQuickReadRelease
  } | null>(null)
  const [feedbackReport, setFeedbackReport] = useState<ReturnType<
    typeof createInstallerDownloadFeedbackReport
  > | null>(null)
  const [connecting, setConnecting] = useState(false)
  const request = useRef<AbortController | null>(null)
  const mounted = useRef(false)
  const left = useRef(false)
  const attempted = useRef(false)
  const connectPending = useRef(false)
  const downloadButton = useRef<HTMLButtonElement>(null)
  const cancelButton = useRef<HTMLButtonElement>(null)
  const restoreFocus = useRef(false)
  const activeRelease = resolvedRelease?.source === release ? resolvedRelease.value : release
  const available = assetQuickReadDownloadAvailable(activeRelease)
  const upgradeNotice = connected
    ? assetQuickReadUpgradeNotice(toolVersion, activeRelease.bridgeVersion ?? activeRelease.version)
    : null
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
        if (mounted.current) setNotice('资产快读连接未完成，请重试连接。')
      } finally {
        connectPending.current = false
        if (mounted.current) setConnecting(false)
      }
    },
    [blocked, onConnect, onReturnConnect],
  )
  useLayoutEffect(() => {
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
    const startedAt = performance.now()
    left.current = false
    attempted.current = false
    setState('downloading')
    setBytes(0)
    setTransfer(null)
    setNotice('')
    setFeedbackReport(null)
    let downloadRelease: AssetQuickReadRelease | null = activeRelease
    try {
      downloadRelease = await readAssetQuickReadInstallerRelease(controller.signal)
      if (!current()) return
      setResolvedRelease({ source: release, value: downloadRelease })
      let result: Awaited<ReturnType<typeof downloadAssetQuickReadInstaller>>
      for (let recovery = 0; ; recovery += 1) {
        try {
          result = await downloadAssetQuickReadInstaller({
            release: downloadRelease,
            signal: controller.signal,
            onProgress: (value) => {
              if (current()) setBytes(value)
            },
            onTransfer: (progress) => {
              if (current()) setTransfer(progress)
            },
            onSaving: () => {
              if (current()) setState('saving')
            },
          })
          break
        } catch (error) {
          const details = installerDownloadFailureDetails(error)
          if (
            recovery > 0 ||
            details?.code !== 'installer_download_release_changed' ||
            controller.signal.aborted
          )
            throw error
          const refreshed = await readAssetQuickReadInstallerRelease(controller.signal)
          if (!current()) return
          if (
            refreshed.version === downloadRelease.version &&
            refreshed.size === downloadRelease.size &&
            refreshed.sha256 === downloadRelease.sha256
          )
            throw error
          downloadRelease = refreshed
          setResolvedRelease({ source: release, value: refreshed })
          setBytes(0)
          setTransfer(null)
        }
      }
      if (current()) {
        restoreFocus.current ||= document.activeElement === cancelButton.current
        setState(result)
      }
    } catch (error) {
      if (current()) {
        restoreFocus.current ||= document.activeElement === cancelButton.current
        const cancelled = controller.signal.aborted
        setState(cancelled ? 'cancelled' : 'error')
        if (!cancelled) {
          const expected = downloadRelease ?? activeRelease
          setFeedbackReport(
            createInstallerDownloadFeedbackReport({
              tool: 'asset_quick_read_installer',
              installerVersion: expected.version,
              expectedSize: expected.size ?? 0,
              expectedSha256: expected.sha256 ?? '',
              durationMs: performance.now() - startedAt,
              error,
            }),
          )
        }
        if (
          installerDownloadFailureDetails(error)?.code === 'installer_download_timeout' ||
          (error instanceof DOMException && error.name === 'TimeoutError')
        )
          setNotice(installerOutcomeMessage('error', true))
      }
    } finally {
      if (request.current === controller) request.current = null
    }
  }
  const progress =
    state === 'saving'
      ? '正在准备文件'
      : `下载中 ${Math.min(100, Math.floor((bytes / (activeRelease.size ?? 1)) * 100))}%`
  const timedOut =
    notice === installerOutcomeMessage('error', true) ||
    feedbackReport?.code === 'installer_download_timeout'
  const outcomeText = notice || installerOutcomeMessage(state, timedOut)
  const showOutcome = state === 'error' || state === 'cancelled' || Boolean(notice)
  const feedback = pending
    ? state === 'downloading' && transfer
      ? installerTransferStatus(transfer)
      : progress
    : showOutcome
      ? outcomeText
      : connected
        ? upgradeNotice || ''
        : outcomeText
  const feedbackHref = feedbackReport
    ? `/installer-feedback#${encodeURIComponent(JSON.stringify(feedbackReport))}`
    : null
  useEffect(() => {
    publishStatus?.({ text: feedback, pending })
    return () => publishStatus?.({ text: '', pending: false })
  }, [publishStatus, feedback, pending])
  if (connected && !upgradeNotice && !pending && !showOutcome && !feedbackReport) return null
  return (
    <div className="scanner-installer asset-quick-read-installer">
      <div className={`scanner-installer__control${pending ? ' is-pending' : ''}`}>
        <button
          ref={downloadButton}
          className="button button--quiet scanner-prepare__download asset-quick-read-installer__download"
          type="button"
          title={
            !available
              ? '资产快读安装包尚未发布，当前不能下载。'
              : `资产快读安装包 v${activeRelease.version}`
          }
          disabled={!available || blocked || pending || connecting}
          onClick={() => void download()}
        >
          <Download size={17} aria-hidden="true" />
          {pending
            ? progress
            : state === 'save_requested'
              ? '重新下载'
              : upgradeNotice
                ? '更新资产快读'
                : '下载资产快读'}
          {!pending && available && (
            <small className="asset-quick-read-installer__version" aria-hidden="true">
              v{activeRelease.version}
            </small>
          )}
        </button>
        {pending && (
          <>
            <progress
              className="scanner-installer__progress"
              aria-label="资产快读下载进度"
              aria-valuetext={`${progress} · ${feedback}`}
              value={bytes}
              max={activeRelease.size ?? 1}
            />
            <button
              ref={cancelButton}
              className="scanner-installer__cancel"
              type="button"
              aria-label="取消资产快读下载"
              onClick={() => {
                restoreFocus.current = document.activeElement === cancelButton.current
                request.current?.abort()
              }}
            >
              <X size={16} aria-hidden="true" />
            </button>
          </>
        )}
      </div>
      {feedback && !publishStatus && (
        <div className="asset-quick-read-installer__feedback" role="status">
          {feedback}
          {feedbackHref ? (
            <a className="scanner-installer__fallback" href={feedbackHref}>
              报告下载问题
            </a>
          ) : null}
        </div>
      )}
      {feedbackHref && publishStatus ? (
        <div className="scanner-installer__feedback">
          <a className="scanner-installer__fallback" href={feedbackHref}>
            报告下载问题
          </a>
        </div>
      ) : null}
    </div>
  )
}
