import contract from '../scanner/scanFeedback.contract.json'
import { withFeedbackTimeout } from '../scanner/feedbackRequest'
import { sanitizeAssetDiagnostic, type AssetDiagnosticReport } from './diagnostics'

export const assetDiagnosticKey = 'soda.asset-quick-read.last-diagnostic.v1'
const receiptKey = 'soda.asset-quick-read.last-feedback-receipt.v1'
type Receipt = { report: AssetDiagnosticReport; receivedAt: string }
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
  return withFeedbackTimeout(timeoutMs, async (signal) => {
    const response = await fetcher(contract.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: textOf(safe),
      credentials: 'omit',
      signal,
    })
    if (!response.ok) throw new Error(response.status === 404 ? 'unavailable' : 'retry')
    const ack = (await response.json()) as Record<string, unknown>
    if (
      signal.aborted ||
      ack.status !== 'received' ||
      ack.reportId !== safe.reportId ||
      typeof ack.receivedAt !== 'string' ||
      ack.receivedAt.length > 32 ||
      !Number.isFinite(Date.parse(ack.receivedAt))
    )
      throw new Error('invalid-receipt')
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
}
