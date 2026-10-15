import contract from '../scanner/scanFeedback.contract.json'
import { withFeedbackTimeout } from '../scanner/feedbackRequest'
import { sanitizeAssetDiagnostic, type AssetDiagnosticReport } from './diagnostics'

export const assetDiagnosticKey = 'soda.asset-quick-read.last-diagnostic.v1'
const receiptKey = 'soda.asset-quick-read.last-feedback-receipt.v1'
type Receipt = { report: AssetDiagnosticReport; receivedAt: string }
type SubmissionCode =
  | 'network'
  | 'timeout'
  | 'unavailable'
  | 'rate-limited'
  | 'rejected'
  | 'conflict'
  | 'invalid-receipt'
  | 'retry'
export class AssetFeedbackSubmissionError extends Error {
  readonly code: SubmissionCode
  readonly retryAfterSeconds?: number
  constructor(code: SubmissionCode, retryAfterSeconds?: number) {
    super(code)
    this.code = code
    this.retryAfterSeconds = retryAfterSeconds
  }
}

export function assetFeedbackFailureMessage(error: unknown) {
  const failure = error instanceof AssetFeedbackSubmissionError ? error : null
  switch (failure?.code) {
    case 'rate-limited':
      return failure.retryAfterSeconds
        ? `反馈提交过于频繁，请至少等待 ${failure.retryAfterSeconds} 秒后重试。诊断仍保留在本机。`
        : '反馈提交过于频繁，请稍后重试。诊断仍保留在本机。'
    case 'unavailable':
      return '反馈服务暂不可用，请复制或下载诊断保留，稍后再试。'
    case 'rejected':
      return '本次诊断未通过接收检查，请复制或下载保留，并通过问题与反馈入口说明提交问题。'
    case 'conflict':
      return '反馈编号与已接收内容冲突，请保留诊断并通过问题与反馈入口说明，避免反复提交。'
    case 'invalid-receipt':
      return '未取得有效回执，暂未确认送达；请保留诊断并稍后重试。'
    case 'network':
      return '网络连接中断，暂未确认送达；请检查网络后重试，诊断仍保留在本机。'
    case 'timeout':
      return '等待反馈回执超时，暂未确认送达；可稍后重试或复制诊断保留。'
    default:
      return '暂时无法确认反馈接收，请复制或下载诊断保留，稍后重试。'
  }
}

function retryAfterSeconds(value: string | null) {
  if (!value) return undefined
  const seconds = /^\d+$/.test(value.trim())
    ? Number(value)
    : Math.ceil((Date.parse(value) - Date.now()) / 1000)
  return Number.isFinite(seconds) && seconds >= 0 && seconds <= 3600
    ? Math.max(1, Math.ceil(seconds))
    : undefined
}
const textOf = (report: AssetDiagnosticReport) => JSON.stringify(report)
function read(key: string): unknown {
  try {
    const text = localStorage.getItem(key)
    return text && new TextEncoder().encode(text).length <= contract.maxBytes + 128
      ? JSON.parse(text)
      : null
  } catch {
    return null
  }
}
export function readAssetDiagnostic() {
  return sanitizeAssetDiagnostic(read(assetDiagnosticKey))
}
export function saveAssetDiagnostic(report: AssetDiagnosticReport) {
  const safe = sanitizeAssetDiagnostic(report)
  if (safe) {
    try {
      localStorage.setItem(assetDiagnosticKey, textOf(safe))
    } catch {
      /* Copy remains available. */
    }
  }
}
export function readAssetReceipt(report: AssetDiagnosticReport): Receipt | null {
  const raw = read(receiptKey)
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const value = raw as Record<string, unknown>
  const safe = sanitizeAssetDiagnostic(value.report)
  return Object.keys(value).length === 2 &&
    safe &&
    textOf(safe) === textOf(report) &&
    typeof value.receivedAt === 'string' &&
    value.receivedAt.length <= 32 &&
    Number.isFinite(Date.parse(value.receivedAt))
    ? { report: safe, receivedAt: value.receivedAt }
    : null
}
/** Called only by the feedback button, never by capture or persistence effects. */
export async function submitAssetFeedback(
  report: AssetDiagnosticReport,
  fetcher: typeof fetch = fetch,
  timeoutMs = 12000,
) {
  const safe = sanitizeAssetDiagnostic(report)
  if (!safe) throw new Error('invalid-diagnostic')
  try {
    return await withFeedbackTimeout(timeoutMs, async (signal) => {
      const response = await fetcher(contract.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: textOf(safe),
        credentials: 'omit',
        signal,
      }).catch(() => {
        throw new AssetFeedbackSubmissionError('network')
      })
      if (!response.ok) {
        const code =
          response.status === 429
            ? 'rate-limited'
            : response.status === 404 || response.status === 503
              ? 'unavailable'
              : response.status === 409
                ? 'conflict'
                : response.status >= 400 && response.status < 500
                  ? 'rejected'
                  : 'retry'
        throw new AssetFeedbackSubmissionError(
          code,
          code === 'rate-limited'
            ? retryAfterSeconds(response.headers.get('Retry-After'))
            : undefined,
        )
      }
      const ack: unknown = await response.json().catch(() => {
        throw new AssetFeedbackSubmissionError('invalid-receipt')
      })
      if (
        signal.aborted ||
        !ack ||
        typeof ack !== 'object' ||
        Array.isArray(ack) ||
        !('status' in ack) ||
        !('reportId' in ack) ||
        !('receivedAt' in ack) ||
        ack.status !== 'received' ||
        ack.reportId !== safe.reportId ||
        typeof ack.receivedAt !== 'string' ||
        ack.receivedAt.length > 32 ||
        !Number.isFinite(Date.parse(ack.receivedAt))
      )
        throw new AssetFeedbackSubmissionError('invalid-receipt')
      const receipt = { report: safe, receivedAt: ack.receivedAt }
      const current = readAssetDiagnostic()
      if (!current || textOf(current) === textOf(safe)) {
        try {
          localStorage.setItem(receiptKey, JSON.stringify(receipt))
        } catch {
          /* Current card retains receipt. */
        }
      }
      return receipt
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'timeout')
      throw new AssetFeedbackSubmissionError('timeout')
    throw error
  }
}
