import { renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { connectingSnapshot } from './runtimeSnapshots'
import type { ScannerAssistantSnapshot } from './runtime'
import {
  lastScanDiagnosticKey,
  lastScanFeedbackReceiptKey,
  readScanFeedbackReceipt,
  readLastScanDiagnostic,
  saveLastScanDiagnostic,
  submitScanFeedback,
  useScannerFailureDiagnostic,
} from './scanFeedback'
import { sanitizeScanDiagnostic } from './diagnostics'
const makeReport = () =>
  sanitizeScanDiagnostic({
    schema: 1,
    reportId: crypto.randomUUID(),
    release: 'test',
    outcome: 'failed',
    code: 'helper_unavailable',
    stage: 'connection',
  })!
afterEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

it('captures an actual failure immutably, hides it on retry, and assigns a fresh fallback attempt ID', () => {
  const failure = {
    ...connectingSnapshot,
    state: 'connection_failed' as const,
    error: {
      userMessage: 'private path',
      recoveryAction: 'retry' as const,
      diagnosticCode: 'helper_unavailable',
    },
  }
  const { result, rerender } = renderHook(({ snapshot }) => useScannerFailureDiagnostic(snapshot), {
    initialProps: { snapshot: connectingSnapshot },
  })
  expect(result.current).toBeNull()
  rerender({ snapshot: failure })
  const first = result.current!
  expect(first.code).toBe('helper_unavailable')
  expect(readLastScanDiagnostic()).toEqual(first)
  rerender({
    snapshot: {
      ...failure,
      progress: { processed: 88, total: 99, stageLabel: 'private', etaSeconds: 5 },
    },
  })
  expect(result.current).toEqual(first)
  rerender({ snapshot: { ...connectingSnapshot, state: 'connecting' } })
  expect(result.current).toBeNull()
  expect(readLastScanDiagnostic()).toEqual(first)
  rerender({ snapshot: failure })
  expect(result.current!.reportId).not.toBe(first.reportId)
})
it('ignores old-format, corrupt and oversized local data; readback removes unknown fields', () => {
  for (const input of [
    'invalid JSON',
    JSON.stringify({ title: 'private', error: 'raw' }),
    JSON.stringify({ schema: 1, reportId: 'UID' }),
    ' '.repeat(4097),
  ]) {
    localStorage.setItem(lastScanDiagnosticKey, input)
    expect(readLastScanDiagnostic()).toBeNull()
  }
  const report = makeReport()
  saveLastScanDiagnostic({ ...report, accountId: 'private' } as typeof report)
  expect(readLastScanDiagnostic()).toEqual(report)
  expect(localStorage.getItem(lastScanDiagnosticKey)).not.toContain('private')
})

it('captures a completed scan import failure without exposing its raw message or reusing the native failure ID', () => {
  const nativeId = crypto.randomUUID()
  const snapshot = {
    ...connectingSnapshot,
    state: 'completed' as const,
    diagnostics: {
      reportId: nativeId,
      outcome: 'completed' as const,
      stage: 'result',
      code: 'none',
      durationMs: 804000,
      counts: { processed: 806, total: 806 },
      versions: { helper: '2.3.6' },
      environment: {},
      evidence: {},
    },
  }
  const { result, rerender } = renderHook(
    ({ issueCode }) => useScannerFailureDiagnostic(snapshot, issueCode),
    { initialProps: { issueCode: null as string | null } },
  )
  expect(result.current).toBeNull()
  rerender({ issueCode: 'scan_import_handoff_failed' })
  const report = result.current!
  expect(report).toMatchObject({
    stage: 'import',
    code: 'scan_import_handoff_failed',
    outcome: 'completed',
    counts: { processed: 806, total: 806 },
    durationMs: 804000,
  })
  expect(report.reportId).not.toBe(nativeId)
  expect(readLastScanDiagnostic()).toEqual(report)
  rerender({ issueCode: null })
  expect(result.current).toBeNull()
  rerender({ issueCode: 'scan_result_timeout' })
  expect(result.current).toMatchObject({ stage: 'result', code: 'scan_result_timeout' })
  expect(result.current!.reportId).not.toBe(report.reportId)
})

it('resolves a native attempt ID collision once, with a bounded no-cookie retry and matching receipt', async () => {
  const report = makeReport()
  const sent: (typeof report)[] = []
  const fetcher = vi.fn().mockImplementation((_url, init) => {
    const payload = JSON.parse(init.body) as typeof report
    sent.push(payload)
    return Promise.resolve(
      sent.length === 1
        ? new Response('conflict', { status: 409 })
        : new Response(
            JSON.stringify({
              status: 'received',
              reportId: payload.reportId,
              receivedAt: '2026-10-07T00:00:00Z',
            }),
          ),
    )
  })
  const receipt = await submitScanFeedback(report, fetcher)
  expect(fetcher).toHaveBeenCalledTimes(2)
  expect(sent[1]).toEqual({ ...report, reportId: receipt.reportId })
  expect(receipt.reportId).not.toBe(report.reportId)
  expect(readLastScanDiagnostic()).toEqual(sent[1])
  expect(fetcher.mock.calls[1][1]).toMatchObject({ credentials: 'omit' })
})
it('does not replace a newer cached failure when an older feedback submission succeeds', async () => {
  const report = makeReport()
  const newer = makeReport()
  saveLastScanDiagnostic(newer)
  await submitScanFeedback(
    report,
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 'received',
          reportId: report.reportId,
          receivedAt: '2026-10-07T00:00:00Z',
        }),
      ),
    ),
  )
  expect(readLastScanDiagnostic()).toEqual(newer)
})
it('requires a durable matching acknowledgement, supports retry and bounds unresponsive fetch', async () => {
  const report = makeReport()
  for (const response of [
    new Response('{}', { status: 503 }),
    new Response(
      JSON.stringify({
        status: 'received',
        reportId: crypto.randomUUID(),
        receivedAt: new Date().toISOString(),
      }),
    ),
    new Response('{"status":"received"}'),
  ]) {
    await expect(submitScanFeedback(report, vi.fn().mockResolvedValue(response))).rejects.toThrow()
  }
  const fetcher = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        status: 'received',
        reportId: report.reportId,
        receivedAt: '2026-10-07T00:00:00Z',
      }),
    ),
  )
  await expect(submitScanFeedback(report, fetcher)).resolves.toMatchObject({
    reportId: report.reportId,
  })
  expect(fetcher.mock.calls[0][1]).toMatchObject({ credentials: 'omit' })
  vi.useFakeTimers()
  const pending = submitScanFeedback(
    report,
    vi.fn().mockImplementation(() => new Promise(() => {})),
    50,
  )
  const assertion = expect(pending).rejects.toThrow('timeout')
  await vi.advanceTimersByTimeAsync(51)
  await assertion
})

it('preserves native attempt identity and duration while dropping unknown raw fields and hiding replayed diagnostics during a new scan', () => {
  const nativeId = crypto.randomUUID()
  const failure = {
    ...connectingSnapshot,
    state: 'connection_failed' as const,
    diagnostics: {
      reportId: nativeId,
      outcome: 'failed' as const,
      stage: 'capture',
      code: 'panel_capture_timeout',
      durationMs: 1203,
      counts: { processed: 3, total: null, uid: 55 },
      versions: { helper: '1.2.3', protocol: '5', raw: 'private' },
      environment: {},
      evidence: { attempts: 3, selectionChanged: false, rawError: 'private' },
      accountId: 'private',
      screenshot: 'private',
    },
  }
  const { result, rerender } = renderHook(({ snapshot }) => useScannerFailureDiagnostic(snapshot), {
    initialProps: { snapshot: failure as typeof connectingSnapshot },
  })
  expect(result.current).toMatchObject({
    reportId: nativeId,
    durationMs: 1203,
    counts: { processed: 3, total: null },
    evidence: { attempts: 3, selectionChanged: false },
    versions: { helper: '1.2.3', protocol: '5' },
  })
  expect(JSON.stringify(result.current)).not.toMatch(/private|rawError|accountId|screenshot|uid/)
  rerender({ snapshot: { ...failure, state: 'scanning' } as typeof connectingSnapshot })
  expect(result.current).toBeNull()
  expect(readLastScanDiagnostic()?.reportId).toBe(nativeId)
})

it('replaces an early generic failure with late terminal evidence for the same native attempt', () => {
  const nativeId = crypto.randomUUID()
  const early = {
    ...connectingSnapshot,
    state: 'connection_failed' as const,
    diagnostics: {
      ...makeReport(),
      outcome: 'failed' as const,
      reportId: nativeId,
      code: 'scanner_failure',
      stage: 'unknown',
      evidence: {},
    },
  }
  const { result, rerender } = renderHook(({ snapshot }) => useScannerFailureDiagnostic(snapshot), {
    initialProps: { snapshot: early },
  })
  expect(result.current?.code).toBe('scanner_failure')
  const final = {
    ...early,
    diagnostics: {
      ...early.diagnostics,
      code: 'panel_capture_timeout',
      stage: 'capture',
      evidence: { diagnosticSource: 'terminal_details', acceptGateReason: 'required_core_missing' },
    },
  }
  rerender({ snapshot: final })
  expect(result.current).toMatchObject({
    reportId: nativeId,
    code: 'panel_capture_timeout',
    evidence: final.diagnostics.evidence,
  })
  expect(readLastScanDiagnostic()).toEqual(result.current)
  const finalReport = result.current
  rerender({ snapshot: { ...final, diagnostics: { ...final.diagnostics, durationMs: 9999 } } })
  expect(result.current).toBe(finalReport)
  rerender({ snapshot: { ...final, diagnostics: early.diagnostics } })
  expect(result.current?.code).toBe('panel_capture_timeout')
  rerender({
    snapshot: {
      ...final,
      diagnostics: { ...final.diagnostics, evidence: { diagnosticSource: 'legacy_log' } },
    },
  })
  expect(result.current?.evidence.diagnosticSource).toBe('terminal_details')
})

it.each([
  { evidence: { diagnosticSource: 'terminal_details' } },
  {
    environment: {
      width: 1920,
      height: 1080,
      dpi: 144,
      browser: 'unknown',
      captureMode: 'unknown',
    },
  },
  { counts: { processed: 507, total: 2566, visited: 509 } },
])(
  'does not let a late receipt overwrite richer diagnostics for the same attempt ID: %j',
  async (details) => {
    const report = makeReport()
    const enriched = { ...report, ...details }
    saveLastScanDiagnostic(enriched)
    await submitScanFeedback(
      report,
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            status: 'received',
            reportId: report.reportId,
            receivedAt: '2026-10-07T00:00:00Z',
          }),
        ),
      ),
    )
    expect(readLastScanDiagnostic()).toEqual(enriched)
  },
)

it('accepts late failure geometry and terminal counts without freezing or reacting to progress and duration alone', () => {
  const early: ScannerAssistantSnapshot = {
    ...connectingSnapshot,
    state: 'connection_failed',
    diagnostics: {
      ...makeReport(),
      outcome: 'failed',
      code: 'panel_capture_timeout',
      evidence: { diagnosticSource: 'terminal_details', acceptGateReason: 'required_core_missing' },
      environment: {},
      counts: { processed: null, total: null },
    },
  }
  const { result, rerender } = renderHook(({ snapshot }) => useScannerFailureDiagnostic(snapshot), {
    initialProps: { snapshot: early },
  })
  const geometry: ScannerAssistantSnapshot = {
    ...early,
    diagnostics: {
      ...early.diagnostics!,
      environment: { width: 1920, height: 1080, dpi: 144 },
    },
  }
  rerender({ snapshot: geometry })
  expect(result.current?.environment).toMatchObject({ width: 1920, height: 1080, dpi: 144 })
  const final: ScannerAssistantSnapshot = {
    ...geometry,
    diagnostics: {
      ...geometry.diagnostics!,
      counts: { processed: 507, total: 2566, visited: 509, queued: 508, failed: 0 },
    },
  }
  rerender({ snapshot: final })
  expect(result.current?.counts).toEqual(final.diagnostics!.counts)
  expect(result.current?.reportId).toBe(early.diagnostics!.reportId)
  expect(readLastScanDiagnostic()).toEqual(result.current)
  const captured = result.current
  rerender({
    snapshot: {
      ...final,
      progress: { processed: 999, total: 9999, etaSeconds: 0, stageLabel: 'private' },
      diagnostics: { ...final.diagnostics!, durationMs: 99999 },
    },
  })
  expect(result.current).toBe(captured)
  rerender({
    snapshot: {
      ...early,
      diagnostics: {
        ...early.diagnostics!,
        evidence: { diagnosticSource: 'legacy_log' },
        environment: { width: 1280, height: 720, dpi: 96 },
        counts: { processed: 1, total: 3 },
      },
    },
  })
  expect(result.current).toBe(captured)
})

it('persists only a matching successful receipt and keeps the acknowledged ID through native snapshot recapture', async () => {
  const report = makeReport()
  saveLastScanDiagnostic(report)
  const receivedId = crypto.randomUUID()
  let calls = 0
  const fetcher = vi
    .fn()
    .mockImplementation(() =>
      Promise.resolve(
        ++calls === 1
          ? new Response('conflict', { status: 409 })
          : new Response(
              JSON.stringify({
                status: 'received',
                reportId: receivedId,
                receivedAt: '2026-10-07T00:00:00Z',
              }),
            ),
      ),
    )
  vi.spyOn(crypto, 'randomUUID').mockReturnValue(receivedId)
  await submitScanFeedback(report, fetcher)
  const stored = readLastScanDiagnostic()!
  expect(stored).toEqual({ ...report, reportId: receivedId })
  expect(readScanFeedbackReceipt(report)?.report).toEqual(stored)
  expect(readScanFeedbackReceipt(stored)?.report).toEqual(stored)
  saveLastScanDiagnostic(report)
  expect(readLastScanDiagnostic()).toEqual(stored)
  const enriched = { ...report, counts: { processed: 5, total: 10 } }
  saveLastScanDiagnostic(enriched)
  expect(readScanFeedbackReceipt(enriched)).toBeNull()
  expect(readLastScanDiagnostic()).toEqual(enriched)
})
it('rejects oversized, corrupt, unsafe and mismatched cached receipts', async () => {
  const report = makeReport()
  await submitScanFeedback(
    report,
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 'received',
          reportId: report.reportId,
          receivedAt: '2026-10-07T00:00:00Z',
        }),
      ),
    ),
  )
  const receipt = JSON.parse(localStorage.getItem(lastScanFeedbackReceiptKey)!)
  for (const candidate of [
    'invalid',
    ' '.repeat(4353),
    JSON.stringify({ ...receipt, sourceReportId: 'UID' }),
    JSON.stringify({ ...receipt, receivedAt: 'private' }),
    JSON.stringify({ ...receipt, token: 'private' }),
    JSON.stringify({ ...receipt, report: { ...report, screenshot: 'private' } }),
    JSON.stringify({ ...receipt, report: { ...report, evidence: { reason: "soda-source-ref:11722a25453694ffb98f9398fd5716d7" } } }),
  ]) {
    localStorage.setItem(lastScanFeedbackReceiptKey, candidate)
    expect(readScanFeedbackReceipt(report)).toBeNull()
  }
  localStorage.setItem(lastScanFeedbackReceiptKey, JSON.stringify(receipt))
  expect(readScanFeedbackReceipt({ ...report, environment: { width: 1280 } })).toBeNull()
  expect(readScanFeedbackReceipt({ ...report, reportId: crypto.randomUUID() })).toBeNull()
})
it('does not persist a false success when an unresponsive fetch resolves after the click timeout', async () => {
  const report = makeReport()
  saveLastScanDiagnostic(report)
  let resolve!: (response: Response) => void
  vi.useFakeTimers()
  const pending = submitScanFeedback(
    report,
    vi.fn().mockImplementation(
      () =>
        new Promise<Response>((done) => {
          resolve = done
        }),
    ),
    50,
  )
  const timedOut = expect(pending).rejects.toThrow('timeout')
  await vi.advanceTimersByTimeAsync(51)
  await timedOut
  resolve(
    new Response(
      JSON.stringify({
        status: 'received',
        reportId: report.reportId,
        receivedAt: '2026-10-07T00:00:00Z',
      }),
    ),
  )
  await vi.advanceTimersByTimeAsync(1)
  expect(localStorage.getItem(lastScanFeedbackReceiptKey)).toBeNull()
  expect(readLastScanDiagnostic()).toEqual(report)
})
