import { useEffect, useState } from 'react'
import type { ScannerAssistantSnapshot } from './runtime'
import {
  diagnosticFromSnapshot,
  isReportId,
  sanitizeScanDiagnostic,
  type ScanDiagnosticReport,
} from './diagnostics'
import contract from './scanFeedback.contract.json'

export const lastScanDiagnosticKey = 'soda.scanner.last-diagnostic.v1'
export const lastScanFeedbackReceiptKey = 'soda.scanner.last-feedback-receipt.v1'
type StoredFeedbackReceipt = {
  schema: 1
  sourceReportId: string
  report: ScanDiagnosticReport
  receivedAt: string
}
/** Only the latest successful receipt is retained, and only for identical safe contents. */
export function readScanFeedbackReceipt(
  report: ScanDiagnosticReport,
): StoredFeedbackReceipt | null {
  const safe = sanitizeScanDiagnostic(report)
  if (!safe) return null
  try {
    const stored = localStorage.getItem(lastScanFeedbackReceiptKey)
    if (!stored || new TextEncoder().encode(stored).length > contract.maxBytes + 256) return null
    const value: unknown = JSON.parse(stored)
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null
    const source = value as Record<string, unknown>
    if (
      Object.keys(source).length !== 4 ||
      source.schema !== 1 ||
      !isReportId(source.sourceReportId) ||
      typeof source.receivedAt !== 'string' ||
      source.receivedAt.length > 32 ||
      !Number.isFinite(Date.parse(source.receivedAt))
    )
      return null
    const received = sanitizeScanDiagnostic(source.report)
    if (!received || JSON.stringify(source.report) !== JSON.stringify(received)) return null
    if (safe.reportId !== source.sourceReportId && safe.reportId !== received.reportId) return null
    if (JSON.stringify({ ...safe, reportId: received.reportId }) !== JSON.stringify(received))
      return null
    return {
      schema: 1,
      sourceReportId: source.sourceReportId,
      report: received,
      receivedAt: source.receivedAt,
    }
  } catch {
    return null
  }
}
function saveScanFeedbackReceipt(
  sourceReportId: string,
  report: ScanDiagnosticReport,
  receivedAt: string,
) {
  try {
    localStorage.setItem(
      lastScanFeedbackReceiptKey,
      JSON.stringify({
        schema: 1,
        sourceReportId,
        report,
        receivedAt: new Date(receivedAt).toISOString(),
      }),
    )
  } catch {
    /* The current card still retains a valid receipt if local storage is unavailable. */
  }
}
export class ScanFeedbackSubmissionError extends Error {
  readonly reason: 'unavailable' | 'release_changed' | 'retry'
  constructor(reason: 'unavailable' | 'release_changed' | 'retry') {
    super(reason)
    this.reason = reason
  }
}
export function readLastScanDiagnostic(): ScanDiagnosticReport | null {
  try {
    const stored = localStorage.getItem(lastScanDiagnosticKey)
    if (!stored || new TextEncoder().encode(stored).length > contract.maxBytes) return null
    return sanitizeScanDiagnostic(JSON.parse(stored))
  } catch {
    return null
  }
}
export function saveLastScanDiagnostic(report: ScanDiagnosticReport) {
  const safe = sanitizeScanDiagnostic(report)
  if (!safe) return
  try {
    localStorage.setItem(
      lastScanDiagnosticKey,
      JSON.stringify(readScanFeedbackReceipt(safe)?.report ?? safe),
    )
  } catch {
    /* Copy remains available if storage is disabled. */
  }
}
/** Keep terminal facts stable, but allow late final diagnostics to enrich the same attempt. */
export function useScannerFailureDiagnostic(
  snapshot: ScannerAssistantSnapshot,
  issueCode?: string | null,
) {
  const [capture, setCapture] = useState(() => {
    const attemptId = crypto.randomUUID()
    return {
      snapshot,
      issueCode,
      attemptId,
      report:
        snapshot.state === 'connection_failed' || issueCode
          ? diagnosticFromSnapshot(snapshot, attemptId, issueCode)
          : null,
    }
  })
  let current = capture
  if (capture.snapshot !== snapshot || capture.issueCode !== issueCode) {
    const activeStates = ['connecting', 'checking', 'awaiting_elevation', 'scanning']
    const newAttempt =
      activeStates.includes(snapshot.state) && !activeStates.includes(capture.snapshot.state)
    const attemptId =
      newAttempt || capture.issueCode !== issueCode ? crypto.randomUUID() : capture.attemptId
    let report = snapshot.state === 'connection_failed' || issueCode ? capture.report : null
    if (snapshot.state === 'connection_failed' || issueCode) {
      const next = diagnosticFromSnapshot(snapshot, attemptId, issueCode)
      const generic = (code: string) =>
        ['scanner_failure', 'scanner_exit', 'unknown', 'none'].includes(code)
      const sourceRank = (report: ScanDiagnosticReport) =>
        report.evidence.diagnosticSource === 'terminal_details'
          ? 2
          : report.evidence.diagnosticSource === 'legacy_log'
            ? 1
            : 0
      const upgraded =
        report &&
        sourceRank(next) >= sourceRank(report) &&
        generic(report.code) &&
        !generic(next.code)
      const enriched =
        report &&
        snapshot.diagnostics !== capture.snapshot.diagnostics &&
        sourceRank(next) >= sourceRank(report) &&
        (next.code === report.code || !generic(next.code)) &&
        (next.code !== report.code ||
          JSON.stringify(next.evidence) !== JSON.stringify(report.evidence) ||
          JSON.stringify(next.versions) !== JSON.stringify(report.versions) ||
          JSON.stringify(next.environment) !== JSON.stringify(report.environment) ||
          (next.evidence.diagnosticSource === 'terminal_details' &&
            JSON.stringify(next.counts) !== JSON.stringify(report.counts)))
      if (!report || report.reportId !== next.reportId || upgraded || enriched) report = next
    }
    current = { snapshot, issueCode, attemptId, report }
    setCapture(current)
  }
  const report = current.report
  useEffect(() => {
    if (report) saveLastScanDiagnostic(report)
  }, [report])
  return report
}
export async function submitScanFeedback(
  report: ScanDiagnosticReport,
  fetcher: typeof fetch = fetch,
  timeoutMs = 12000,
) {
  const safe = sanitizeScanDiagnostic(report)
  if (!safe) throw new Error('invalid-diagnostic')
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort()
      reject(new Error('timeout'))
    }, timeoutMs)
  })
  try {
    return await Promise.race([
      timeout,
      (async () => {
        let outgoing = readScanFeedbackReceipt(safe)?.report ?? safe
        const send = () =>
          fetcher(contract.endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(outgoing),
            signal: controller.signal,
            credentials: 'omit',
          })
        let response = await send()
        if (controller.signal.aborted) throw new Error('timeout')
        // Two tabs can observe the same native attempt with different browser facts.
        // Preserve retry idempotency, but resolve that ID collision within this click.
        if (response.status === 409) {
          outgoing = { ...safe, reportId: crypto.randomUUID() }
          response = await send()
          if (controller.signal.aborted) throw new Error('timeout')
        }
        if (!response.ok)
          throw new ScanFeedbackSubmissionError(
            response.status === 404
              ? 'unavailable'
              : response.status === 409
                ? 'release_changed'
                : 'retry',
          )
        const ack: unknown = await response.json()
        if (controller.signal.aborted) throw new Error('timeout')
        if (!ack || typeof ack !== 'object') throw new Error('invalid-receipt')
        const receipt = ack as Record<string, unknown>
        if (
          receipt.status !== 'received' ||
          receipt.reportId !== outgoing.reportId ||
          typeof receipt.receivedAt !== 'string' ||
          !Number.isFinite(Date.parse(receipt.receivedAt))
        )
          throw new Error('invalid-receipt')
        // Keep the Help-page copy aligned with the durable receipt without letting
        // a late submission overwrite a newer failure captured in another attempt.
        const stored = readLastScanDiagnostic()
        if (
          !stored ||
          JSON.stringify(stored) === JSON.stringify(safe) ||
          JSON.stringify(stored) === JSON.stringify(outgoing)
        ) {
          saveScanFeedbackReceipt(safe.reportId, outgoing, receipt.receivedAt)
          saveLastScanDiagnostic(outgoing)
        }
        return { reportId: outgoing.reportId, receivedAt: receipt.receivedAt }
      })(),
    ])
  } finally {
    clearTimeout(timer)
  }
}
