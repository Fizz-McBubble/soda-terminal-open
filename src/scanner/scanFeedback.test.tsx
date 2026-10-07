import { renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { connectingSnapshot } from './runtimeSnapshots'
import {
  lastScanDiagnosticKey,
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
  expect(fetcher.mock.calls[1][1]).toMatchObject({ credentials: 'omit' })
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
