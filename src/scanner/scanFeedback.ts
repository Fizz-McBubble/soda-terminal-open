import { useEffect, useState } from 'react'
import type { ScannerAssistantSnapshot } from './runtime'
import {
  diagnosticFromSnapshot,
  sanitizeScanDiagnostic,
  type ScanDiagnosticReport,
} from './diagnostics'
import contract from './scanFeedback.contract.json'

export const lastScanDiagnosticKey = 'soda.scanner.last-diagnostic.v1'
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
    localStorage.setItem(lastScanDiagnosticKey, JSON.stringify(safe))
  } catch {
    /* Copy remains available if storage is disabled. */
  }
}
/** Failures are immutable. A new attempt hides its predecessor without deleting the help-page copy. */
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
      if (!report || report.reportId !== next.reportId) report = next
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
        let outgoing = safe
        const send = () =>
          fetcher(contract.endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(outgoing),
            signal: controller.signal,
            credentials: 'omit',
          })
        let response = await send()
        // Two tabs can observe the same native attempt with different browser facts.
        // Preserve retry idempotency, but resolve that ID collision within this click.
        if (response.status === 409) {
          outgoing = { ...safe, reportId: crypto.randomUUID() }
          response = await send()
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
        if (!ack || typeof ack !== 'object') throw new Error('invalid-receipt')
        const receipt = ack as Record<string, unknown>
        if (
          receipt.status !== 'received' ||
          receipt.reportId !== outgoing.reportId ||
          typeof receipt.receivedAt !== 'string' ||
          !Number.isFinite(Date.parse(receipt.receivedAt))
        )
          throw new Error('invalid-receipt')
        return { reportId: outgoing.reportId, receivedAt: receipt.receivedAt }
      })(),
    ])
  } finally {
    clearTimeout(timer)
  }
}
