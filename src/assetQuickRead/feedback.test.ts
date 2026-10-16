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
  AssetFeedbackSubmissionError,
  assetFeedbackFailureMessage,
} from './feedback'
import { sanitizeScanFeedbackPayload } from '../../deploy/cloudflare/scan-feedback.mjs'
import { assetQuickReadRelease } from './distribution'
import { AssetQuickReadImportError } from './importErrors'
import { AssetQuickReadUnavailableError } from './launcher'
import type { AssetBridgeJob } from './bridgeClient'

const failedNativeJob: AssetBridgeJob = {
  jobId: '1e80b26d-39fa-41a5-afbf-fca374acb6ee',
  targetAccountId: 'private-account',
  state: 'error',
  phase: 'driver',
  code: 'capture_open_failed',
  startedAt: '2026-10-16T00:00:00Z',
  readyAt: null,
  deadline: null,
  remainingSeconds: null,
  counts: { agents: 0, discs: 0, engines: 0 },
  candidateAvailable: false,
  diagnostics: { nativeErrorCode: 5, childExitCode: 3221225477 },
}

it('retains finite native failure evidence through storage and receiver without inventing zero assets', () => {
  const report = assetFailureDiagnostic('startup', undefined, failedNativeJob, '1.0.7')
  expect(report.code).toBe('capture_open_failed')
  expect(report.evidence).toEqual({
    jobState: 'error',
    jobPhase: 'driver',
    candidateAvailable: false,
    nativeErrorCode: 5,
    childExitCode: 3221225477,
  })
  expect(report.counts).toEqual({ processed: null, total: null })
  expect(sanitizeScanFeedbackPayload(report)).toEqual({ ok: true, record: report })
  saveAssetDiagnostic(report)
  expect(readAssetDiagnostic()).toEqual(report)
  expect(JSON.stringify(report)).not.toMatch(/private|targetAccountId|jobId/)
  const receivedEmpty = assetFailureDiagnostic('result', undefined, {
    ...failedNativeJob,
    state: 'received',
    phase: 'complete',
    candidateAvailable: true,
  })
  expect(receivedEmpty.counts).toMatchObject({ agents: 0, discs: 0, engines: 0 })
})

it.each([
  'public_metadata_ec2b_missing',
  'public_configuration_request_failed',
  'protocol_file_missing',
])('does not replace reviewed native reason %s with capture_failed', (code) => {
  const report = assetFailureDiagnostic('startup', undefined, { ...failedNativeJob, code })
  expect(report.code).toBe(code)
  expect(sanitizeScanFeedbackPayload(report)).toEqual({ ok: true, record: report })
})

it('rejects malformed native evidence and raw or filename-suffixed failure strings', () => {
  const safe = assetFailureDiagnostic('startup', undefined, failedNativeJob)
  for (const value of [-1, 4294967296, 1.5, "soda-source-ref:61ed5e34eb22556ab3b6b6fcd94f5347"]) {
    expect(sanitizeAssetDiagnostic({ ...safe, evidence: { nativeErrorCode: value } })).toBeNull()
    expect(
      sanitizeScanFeedbackPayload({ ...safe, evidence: { childExitCode: value } }).ok,
    ).not.toBe(true)
  }
  for (const code of [
    'protocol_file_missing:manifest.json',
    'capture_open_failed_win32:5',
    "soda-source-ref:1108f972c93ca7ec01527caab53bca00",
  ]) {
    expect(assetFailureDiagnostic('startup', undefined, { ...failedNativeJob, code }).code).toBe(
      'capture_failed',
    )
  }
})

it.each(['connection', 'import'] as const)(
  'does not attach a retained capture task to a %s failure',
  (stage) => {
    const report = assetFailureDiagnostic(stage, undefined, {
      jobId: crypto.randomUUID(),
      targetAccountId: 'unrelated-account',
      state: 'capturing',
      phase: 'capture',
      code: 'capture_child_failed',
      startedAt: '2026-10-11T00:00:00Z',
      readyAt: null,
      deadline: null,
      remainingSeconds: 140,
      counts: { agents: 33, discs: 374, engines: 1 },
      candidateAvailable: false,
    })
    expect(report).toMatchObject({
      stage,
      code: stage === 'connection' ? 'bridge_unavailable' : 'import_failed',
      counts: { processed: null, total: null },
      durationMs: null,
      evidence: {},
    })
    expect(report.counts).not.toHaveProperty('discs')
    expect(sanitizeScanFeedbackPayload(report)).toEqual({ ok: true, record: report })
  },
)

it('distinguishes an unavailable transport without claiming a specific browser or UAC cause', () => {
  const report = assetFailureDiagnostic(
    'startup',
    new AssetQuickReadUnavailableError('private url and account', {
      cause: new TypeError('private transport details'),
    }),
  )
  expect(report).toMatchObject({ stage: 'startup', code: 'bridge_unavailable', evidence: {} })
  expect(JSON.stringify(report)).not.toContain('private')
})

it.each([
  [404, 'unavailable'],
  [503, 'unavailable'],
  [429, 'rate-limited'],
  [400, 'rejected'],
  [413, 'rejected'],
  [409, 'conflict'],
  [500, 'retry'],
])(
  'classifies HTTP %i without persisting a receipt or changing the diagnostic',
  async (status, code) => {
    const report = assetFailureDiagnostic('waiting')
    saveAssetDiagnostic(report)
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('private server details', {
        status: Number(status),
        headers: { 'Retry-After': '30' },
      }),
    )
    await expect(submitAssetFeedback(report, fetcher)).rejects.toMatchObject({ code })
    expect(readAssetReceipt(report)).toBeNull()
    expect(readAssetDiagnostic()).toEqual(report)
    expect(fetcher).toHaveBeenCalledOnce()
  },
)

it.each(['null', '[]', '{', '{"status":"received"}'])(
  'rejects malformed receipt %s safely',
  async (body) => {
    const report = assetFailureDiagnostic('result')
    await expect(
      submitAssetFeedback(report, vi.fn<typeof fetch>().mockResolvedValue(new Response(body))),
    ).rejects.toMatchObject({ code: 'invalid-receipt' })
    expect(readAssetReceipt(report)).toBeNull()
  },
)

it('classifies transport failures without exposing their private messages', async () => {
  const report = assetFailureDiagnostic('connection')
  const error = await submitAssetFeedback(
    report,
    vi.fn<typeof fetch>().mockRejectedValue(new TypeError('private endpoint and path')),
  ).catch((value: unknown) => value)
  expect(error).toMatchObject({ code: 'network' })
  expect(assetFeedbackFailureMessage(error)).toContain('暂未确认送达')
  expect(assetFeedbackFailureMessage(error)).not.toContain('private')
})

it.each(['30', 'bad', '-3', '999999999'])(
  'bounds Retry-After %s and never automatically resends',
  async (retryAfter) => {
    const report = assetFailureDiagnostic('waiting')
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('', {
        status: 429,
        headers: { 'Retry-After': retryAfter },
      }),
    )
    const error = await submitAssetFeedback(report, fetcher).catch((value: unknown) => value)
    expect(error).toBeInstanceOf(AssetFeedbackSubmissionError)
    expect(error).toMatchObject({
      code: 'rate-limited',
      retryAfterSeconds: retryAfter === '30' ? 30 : undefined,
    })
    expect(fetcher).toHaveBeenCalledOnce()
    expect(assetFeedbackFailureMessage(error)).toContain('反馈提交过于频繁')
  },
)

it.each(['import_recovery_limit_reached', 'import_snapshot_reused'] as const)(
  'passes the fixed %s import reason through the cloud allowlist without the local explanation',
  (code) => {
    const report = assetFailureDiagnostic(
      'import',
      new AssetQuickReadImportError(code, 'private account and recovery details'),
    )
    expect(report).toMatchObject({ stage: 'import', code, evidence: {}, durationMs: null })
    expect(sanitizeScanFeedbackPayload(report)).toEqual({ ok: true, record: report })
    expect(JSON.stringify(report)).not.toContain('private')
  },
)

it('keeps the released bridge version, final counts and timing through the cloud allowlist', () => {
  const report = assetFailureDiagnostic(
    'waiting',
    undefined,
    {
      jobId: crypto.randomUUID(),
      targetAccountId: 'private-account',
      state: 'timed_out',
      phase: 'private-phase',
      code: 'capture_watchdog_timeout',
      startedAt: '2026-10-11T00:00:00Z',
      readyAt: null,
      deadline: null,
      remainingSeconds: 0,
      counts: { agents: 33, discs: 374, engines: 1 },
      candidateAvailable: false,
    },
    assetQuickReadRelease.bridgeVersion ?? '1.0.8',
    Date.parse('2026-10-11T00:03:00Z'),
  )
  expect(assetQuickReadRelease.bridgeVersion).toBe('1.0.8')
  expect(assetQuickReadRelease.version).toBe('1.1.2')
  expect(report).toMatchObject({
    versions: { bridge: '1.0.8', protocol: '1' },
    counts: { agents: 33, discs: 374 },
    durationMs: 180000,
    evidence: { jobState: 'timed_out' },
  })
  expect(sanitizeScanFeedbackPayload(report)).toEqual({ ok: true, record: report })
  expect(JSON.stringify(report)).not.toContain('private')
})

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
