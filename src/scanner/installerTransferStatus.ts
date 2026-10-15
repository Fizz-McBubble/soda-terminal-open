import type { InstallerTransferProgress } from './installerDownload'

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
