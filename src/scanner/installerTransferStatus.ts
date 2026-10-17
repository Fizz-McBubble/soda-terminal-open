import type { InstallerTransferProgress } from './installerDownload'

export function installerOutcomeMessage(state: string, timedOut = false) {
  if (state === 'save_requested') return '文件已准备，请在下载列表打开安装包，安装后点击连接。'
  if (state === 'cancelled') return '下载已取消，可重新下载。'
  if (state === 'error') return timedOut ? '连接超时，请重新下载以继续。' : '下载未完成，请重试。'
  return ''
}

function amount(bytes: number) {
  if (!Number.isFinite(bytes) || bytes < 0) return '—'
  return bytes >= 1_000_000
    ? `${(bytes / 1_000_000).toFixed(1)} MB`
    : bytes >= 1_000
      ? `${Math.floor(bytes / 1_000)} KB`
      : `${Math.floor(bytes)} B`
}

/** Short feedback for the existing preparation status, never a second status card. */
export function installerTransferStatus(progress: InstallerTransferProgress) {
  if (progress.phase === 'retrying')
    return `连接中断，正在${progress.bytes ? '续传' : '重试'}（${progress.retryAttempt}/3）`
  const received = `${amount(progress.bytes)} / ${amount(progress.total)}`
  const speed =
    progress.bytesPerSecond > 0
      ? `${amount(progress.bytesPerSecond)}/s`
      : progress.resumedBytes > 0
        ? '继续下载中'
        : '连接中'
  return `${received} · ${speed}${progress.resumedBytes > 0 ? ' · 已续传' : ''}`
}
