import { beforeEach, expect, it, vi } from 'vitest'
import {
  assetFailureDiagnostic,
  AssetQuickReadRequestError,
  sanitizeAssetDiagnostic,
} from './diagnostics'
import {
  assetDiagnosticKey,
  readAssetDiagnostic,
  readAssetReceipt,
  saveAssetDiagnostic,
  submitAssetFeedback,
} from './feedback'

beforeEach(() => localStorage.clear())
it('captures only allowlisted facts for each failure, never message, account, path or snapshot', () => {
  for (const stage of [
    'connection',
    'permission',
    'startup',
    'waiting',
    'result',
    'import',
  ] as const) {
    const report = assetFailureDiagnostic(
      stage,
      new Error("soda-source-ref:99323e1ff63d8d7773c0370b36f53271"),
    )
    expect(report.stage).toBe(stage)
    expect(JSON.stringify(report)).not.toMatch(/private|token|snapshot|account/)
    expect(sanitizeAssetDiagnostic({ ...report, path: 'private' })).toBeNull()
    expect(sanitizeAssetDiagnostic({ ...report, evidence: { message: 'private' } })).toBeNull()
  }
  const report = assetFailureDiagnostic(
    'startup',
    new AssetQuickReadRequestError('elevation_denied', 'private'),
  )
  expect(report.stage).toBe('permission')
  expect(report.code).toBe('elevation_denied')
})
it('stores locally without sending, rejects poisoned persisted diagnostics', () => {
  const report = assetFailureDiagnostic('waiting')
  saveAssetDiagnostic(report)
  expect(readAssetDiagnostic()).toEqual(report)
  localStorage.setItem(assetDiagnosticKey, JSON.stringify({ ...report, accountId: 'private' }))
  expect(readAssetDiagnostic()).toBeNull()
})
it('sends to existing same-origin receiver with omitted credentials and binds refresh receipt', async () => {
  const report = assetFailureDiagnostic('result')
  saveAssetDiagnostic(report)
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
    new Response(
      JSON.stringify({
        status: 'received',
        reportId: report.reportId,
        receivedAt: '2026-10-11T00:00:00Z',
      }),
    ),
  )
  await submitAssetFeedback(report, fetcher)
  expect(fetcher).toHaveBeenCalledWith(
    '/_soda/scan-feedback',
    expect.objectContaining({ credentials: 'omit', method: 'POST', body: JSON.stringify(report) }),
  )
  expect(readAssetReceipt(readAssetDiagnostic()!)).not.toBeNull()
  expect(readAssetReceipt({ ...report, code: 'result_invalid' })).toBeNull()
})
it('rejects mismatched receipts and leaves retry identity stable', async () => {
  const report = assetFailureDiagnostic('import')
  saveAssetDiagnostic(report)
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
    new Response(
      JSON.stringify({
        status: 'received',
        reportId: crypto.randomUUID(),
        receivedAt: '2026-10-11T00:00:00Z',
      }),
    ),
  )
  await expect(submitAssetFeedback(report, fetcher)).rejects.toThrow('invalid-receipt')
  expect(readAssetReceipt(report)).toBeNull()
  expect(readAssetDiagnostic()).toEqual(report)
})
it('does not overwrite newer failure receipt when older submission arrives late', async () => {
  const old = assetFailureDiagnostic('startup')
  const newer = assetFailureDiagnostic('waiting')
  saveAssetDiagnostic(newer)
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
    new Response(
      JSON.stringify({
        status: 'received',
        reportId: old.reportId,
        receivedAt: '2026-10-11T00:00:00Z',
      }),
    ),
  )
  await submitAssetFeedback(old, fetcher)
  expect(readAssetDiagnostic()).toEqual(newer)
  expect(readAssetReceipt(old)).toBeNull()
})
it('times out even when the transport ignores AbortSignal and late ack cannot persist', async () => {
  const report = assetFailureDiagnostic('connection')
  saveAssetDiagnostic(report)
  let resolve!: (value: Response) => void
  const fetcher = vi.fn<typeof fetch>().mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done
      }),
  )
  await expect(submitAssetFeedback(report, fetcher, 5)).rejects.toThrow('timeout')
  resolve(
    new Response(
      JSON.stringify({
        status: 'received',
        reportId: report.reportId,
        receivedAt: '2026-10-11T00:00:00Z',
      }),
    ),
  )
  await Promise.resolve()
  expect(readAssetReceipt(report)).toBeNull()
})
