import { describe, expect, it } from 'vitest'
import {
  browserDiagnostic,
  diagnosticFromSnapshot,
  diagnosticJson,
  sanitizeScanDiagnostic,
} from './diagnostics'
import { connectingSnapshot } from './runtimeSnapshots'
import { readLastScanDiagnostic, saveLastScanDiagnostic } from './scanFeedback'
import { sanitizeScanFeedbackPayload } from '../../deploy/cloudflare/scan-feedback.mjs'
const reportId = '10f44460-1234-4123-8123-abc123abc123'
export const validReport = {
  schema: 1,
  reportId,
  release: 'test-release',
  outcome: 'failed' as const,
  stage: 'capture',
  code: 'panel_capture_timeout',
  versions: { helper: '1.2.3' },
  counts: { processed: 4, total: null },
  durationMs: null,
  environment: { width: 1920, height: 1080, captureMode: 'gdi', browser: 'edge' },
  evidence: { attempts: 2, sawPanelChange: false },
}

describe('allowlisted diagnostic privacy boundary', () => {
  it('preserves exact scanner r38 candidate identity and historical revisions without retaining unknown scanner identities', () => {
    for (const scanner of [
      'ZZZ-Scanner.Next-1.0.49-soda-r22',
      'ZZZ-Scanner.Next-1.0.49-soda-r37',
      'ZZZ-Scanner.Next-1.0.49-soda-r38',
    ]) {
      const report = diagnosticFromSnapshot(
        { ...connectingSnapshot, diagnostics: { ...validReport, versions: { scanner } } },
        reportId,
      )
      expect(report.versions).toEqual({ scanner })
      expect(sanitizeScanFeedbackPayload(report)).toEqual({ ok: true, record: report })
      saveLastScanDiagnostic(report)
      expect(readLastScanDiagnostic()?.versions).toEqual({ scanner })
      expect(JSON.parse(diagnosticJson(report)).versions).toEqual({ scanner })
    }
    for (const scanner of [
      'unknown',
      'scanner-r38b',
      'ZZZ-Scanner.Next-1.0.49-soda-r38b',
      'ZZZ-Scanner.Next-1.0.49-soda-r10000',
      'ZZZ-Scanner.Next-1.0.49-soda-r38/private',
    ]) {
      const raw = { ...validReport, versions: { scanner } }
      const safe = sanitizeScanDiagnostic(raw)!
      expect(safe.versions).toEqual({})
      expect(sanitizeScanFeedbackPayload(raw)).toEqual({ status: 400 })
      expect(sanitizeScanFeedbackPayload(safe)).toEqual({ ok: true, record: safe })
    }
    localStorage.clear()
  })

  it('keeps the observed preflight reason across browser storage and strict receiver', () => {
    const evidence = {
      preflightState: 'inventory_screen_unreadable',
      captureHealthy: true,
      captureScore: 100,
      titleEditDistance: 2,
      headerConfidencePermille: 420,
      usedNormalizedImage: true,
      warehouseHeaderDetected: false,
      inventoryCountDetected: true,
      stableFrames: 0,
    }
    const report = sanitizeScanDiagnostic({
      ...validReport,
      code: 'visual_preflight_failed',
      stage: 'preflight',
      evidence,
    })!
    expect(report.evidence).toEqual(evidence)
    expect(sanitizeScanFeedbackPayload(report)).toEqual({ ok: true, record: report })
    saveLastScanDiagnostic(report)
    expect(readLastScanDiagnostic()).toEqual(report)
    const unsafe = sanitizeScanDiagnostic({
      ...report,
      evidence: {
        preflightState: "soda-source-ref:1108f972c93ca7ec01527caab53bca00",
        rawText: 'private',
        headerConfidencePermille: 1001,
      },
    })!
    expect(unsafe.evidence).toEqual({})
    expect(
      sanitizeScanFeedbackPayload({ ...report, evidence: { preflightState: 'raw_text' } }),
    ).toEqual({ status: 400 })
  })

  it('preserves duplicate guard finalization evidence through browser projection and local storage', () => {
    const report = diagnosticFromSnapshot(
      {
        ...connectingSnapshot,
        state: 'connection_failed',
        error: {
          userMessage: '连续读到相同驱动盘，扫描已保护性停止。',
          diagnosticCode: 'duplicate_guard',
          recoveryAction: 'retry',
        },
        diagnostics: {
          ...validReport,
          code: 'duplicate_guard',
          stage: 'ocr',
          counts: { processed: 507, total: 2566, visited: 509, queued: 508, failed: 0 },
          evidence: { itemIndex: 508, targetVerificationKind: 'ChangedText' },
        },
      },
      reportId,
    )
    expect(report).toMatchObject({
      code: 'duplicate_guard',
      stage: 'ocr',
      outcome: 'failed',
      counts: { processed: 507, total: 2566, visited: 509, queued: 508, failed: 0 },
      evidence: { itemIndex: 508, targetVerificationKind: 'ChangedText' },
    })
    saveLastScanDiagnostic(report)
    expect(readLastScanDiagnostic()).toEqual(report)
    expect(JSON.parse(diagnosticJson(report))).toEqual(report)
    const received = sanitizeScanFeedbackPayload(JSON.parse(diagnosticJson(report)))
    expect(received).toEqual({ ok: true, record: report })
    localStorage.clear()
    const legacy = diagnosticFromSnapshot(
      {
        ...connectingSnapshot,
        state: 'connection_failed',
        error: {
          userMessage: 'private',
          diagnosticCode: 'duplicate_guard',
          recoveryAction: 'retry',
        },
      },
      reportId,
    )
    expect(legacy.stage).toBe('ocr')
    expect(legacy.evidence).toEqual({})
  })
  it.each(['ChangedText', 'IdenticalNeighborRoundTrip', 'Unknown'])(
    'retains bounded duplicate stop verification kind %s',
    (targetVerificationKind) => {
      const report = sanitizeScanDiagnostic({
        ...validReport,
        code: 'duplicate_guard',
        evidence: { itemIndex: 508, targetVerificationKind },
      })!
      expect(report.evidence).toEqual({ itemIndex: 508, targetVerificationKind })
    },
  )
  it.each([
    [-1, 'private/path'],
    [100001, 'ChangedText.private'],
    [508.5, 42],
    ['508', {}],
  ])(
    'omits invalid duplicate stop fields %s / %s and arbitrary codes',
    (itemIndex, targetVerificationKind) => {
      const report = sanitizeScanDiagnostic({
        ...validReport,
        code: 'duplicate_guard private/path',
        evidence: { itemIndex, targetVerificationKind, accountId: 'private' },
      })!
      expect(report.code).toBe('unknown')
      expect(report.evidence).toEqual({})
    },
  )
  it.each([
    'game_window_ambiguous',
    'game_window_not_foreground',
    'game_window_not_visible',
    'window_geometry_changed',
    'input_position_failed',
    'ppocrv6_detail_geometry_incompatible',
    'warehouse_context_lost',
  ])('preserves actionable window failure %s without copying raw details', (code) => {
    const report = sanitizeScanDiagnostic({
      ...validReport,
      code,
      rawError: 'private path and window title',
    })!
    expect(report.code).toBe(code)
    expect(report).not.toHaveProperty('rawError')
  })
  it.each([
    [
      'game_window_ambiguous',
      'preflight',
      '检测到多个游戏窗口。请将本次要扫描的驱动仓库切到前台后重试。',
    ],
    ['input_position_failed', 'capture', '鼠标未能移动到目标位置，已停止扫描。'],
  ])('keeps %s actionable through legacy snapshot diagnostics', (code, stage, userMessage) => {
    const report = diagnosticFromSnapshot(
      {
        ...connectingSnapshot,
        state: 'connection_failed',
        error: {
          userMessage,
          remedy: 'private path and window title',
          diagnosticCode: code,
          recoveryAction: 'retry',
        },
      },
      reportId,
    )
    expect(report).toMatchObject({ code, stage, outcome: 'failed' })
    expect(JSON.stringify(report)).not.toContain('private')
  })
  it.each([
    ['helper_unavailable', 'connection'],
    ['scanner_workspace_failed', 'preflight'],
  ])('reports %s without copying a retained completed scan', (code, stage) => {
    const report = diagnosticFromSnapshot(
      {
        ...connectingSnapshot,
        state: 'completed',
        diagnostics: { ...validReport, outcome: 'completed', durationMs: 9000 },
      },
      '20f44460-1234-4123-8123-abc123abc123',
      code,
    )
    expect(report).toMatchObject({
      reportId: '20f44460-1234-4123-8123-abc123abc123',
      code,
      stage,
      outcome: 'failed',
      counts: { processed: null, total: null },
      durationMs: null,
      evidence: {},
    })
  })
  it('reconstructs every nested field before copying/storage/submission and rejects unsafe values', () => {
    const report = sanitizeScanDiagnostic({
      ...validReport,
      accountId: 'sensitive',
      rawError: 'private path',
      versions: {
        helper: 'private/path',
        scanner: 'ZZZ-Scanner.Next-1.0.49-soda-r22',
        token: 'secret',
      },
      counts: { processed: -1, total: 200001, uid: 42 },
      environment: { width: 1920, dpi: 1001, ua: 'full agent', browser: 'private' },
      evidence: {
        attempts: 3.5,
        firstMissingRoi: 'mainStatValue',
        path: 'private',
        selectionChanged: true,
        screenshot: 'private',
      },
    })!
    expect(report.counts).toEqual({ processed: null, total: null })
    expect(report.versions).toEqual({ scanner: 'ZZZ-Scanner.Next-1.0.49-soda-r22' })
    expect(report.evidence).toEqual({ firstMissingRoi: 'mainStatValue', selectionChanged: true })
    expect(diagnosticJson(report)).not.toMatch(
      /private|secret|sensitive|uid|token|screenshot|rawError|accountId/,
    )
    expect(sanitizeScanDiagnostic({ ...validReport, reportId: 'account-42' })).toBeNull()
    expect(sanitizeScanDiagnostic({ ...validReport, schema: 0 })).toBeNull()
  })
  it('uses honest old-helper counts and duration and only numeric browser major', () => {
    const report = diagnosticFromSnapshot(
      {
        ...connectingSnapshot,
        state: 'connection_failed',
        progress: { processed: 4, total: null, stageLabel: 'private', etaSeconds: 3 },
        error: {
          userMessage: 'private',
          recoveryAction: 'retry',
          diagnosticCode: 'panel_capture_timeout',
        },
      },
      reportId,
    )
    expect(report.counts).toEqual({ processed: 4, total: null })
    expect(report.durationMs).toBeNull()
    expect(report.versions).toEqual({})
    expect(report.stage).toBe('capture')
    expect(report.reportId).toBe(reportId)
    expect(browserDiagnostic('Mozilla private Chrome/132.0 Edg/133.0')).toEqual({
      browser: 'edge',
      browserMajor: 133,
    })
    expect(browserDiagnostic('unknown private')).toEqual({ browser: 'unknown' })
  })
})

it('carries bounded terminal evidence through projection, storage, copy and strict receiver', () => {
  const evidence = {
    diagnosticSource: 'terminal_details',
    phase: 'capture',
    acceptGateReason: 'waiting_for_target_selection_stability',
    stableFrames: 22,
    requiredStableFrames: 2,
    selectionStableFrames: 1,
    requiredSelectionStableFrames: 2,
    selectionChanged: true,
    preselectedTargetEvidence: false,
    preselectedSelectionPresent: false,
    selectionRoundTripReady: false,
    reason: 'scrollbar_position_missing',
    actualThumbStart: 128,
    expectedThumbStart: 120,
    elapsedMs: 4600,
    timeoutMs: 4500,
    positionFound: false,
    captureHealthy: true,
    windowForeground: true,
  }
  const report = diagnosticFromSnapshot(
    {
      ...connectingSnapshot,
      state: 'connection_failed',
      diagnostics: { ...validReport, code: 'panel_capture_timeout', evidence },
    },
    reportId,
  )
  expect(report.evidence).toEqual(evidence)
  saveLastScanDiagnostic(report)
  expect(readLastScanDiagnostic()).toEqual(report)
  expect(sanitizeScanFeedbackPayload(JSON.parse(diagnosticJson(report)))).toEqual({
    ok: true,
    record: report,
  })
  expect(new TextEncoder().encode(diagnosticJson(report)).length).toBeLessThanOrEqual(4096)
  localStorage.clear()
})

it.each([
  'insufficient_stable_confirmation',
  'cursor_release_unconfirmed',
  'scroll_no_movement_after_max_ticks',
])('retains the measured row-scroll cause %s rather than only its phase and tick', (reason) => {
  // These names come from ScanDiagnosticDetails.RowScroll, not the edge-click DTO.
  const evidence = {
    diagnosticSource: 'terminal_details',
    phase: 'row_scroll',
    direction: 'down',
    tick: 1,
    maximumTicks: 2,
    sample: 14,
    decision: 'Ambiguous',
    noMoveScore: 53,
    oneRowScore: 12,
    twoRowScore: 48,
    bestScore: 12,
    secondScore: 48,
    margin: 36,
    movedDistance: 15,
    frameDistance: 20,
    observationPhase: 'Settle',
    settleSamples: 14,
    reason,
  }
  const report = diagnosticFromSnapshot(
    {
      ...connectingSnapshot,
      state: 'connection_failed',
      diagnostics: { ...validReport, code: 'scan_navigation_failed', evidence },
    },
    reportId,
  )
  expect(report.evidence).toEqual(evidence)
  saveLastScanDiagnostic(report)
  expect(readLastScanDiagnostic()).toEqual(report)
  expect(sanitizeScanFeedbackPayload(JSON.parse(diagnosticJson(report)))).toEqual({
    ok: true,
    record: report,
  })
  expect(new TextEncoder().encode(diagnosticJson(report)).length).toBeLessThanOrEqual(4096)
  localStorage.clear()
})

it('rejects unobserved scores and unbounded scroll details without converting them to zero', () => {
  const report = sanitizeScanDiagnostic({
    ...validReport,
    evidence: {
      noMoveScore: 2147483647,
      oneRowScore: -1,
      twoRowScore: 1.5,
      frameDistance: 0,
      sample: 100001,
      direction: 'down/private',
      observationPhase: 'Settle/private',
      reason: 'cursor_release_unconfirmed/private',
      positionReason: 'scrollbar_and_leading_phase_no_move',
    },
  })!
  expect(report.evidence).toEqual({
    frameDistance: 0,
    positionReason: 'scrollbar_and_leading_phase_no_move',
  })
})

it.each(['scanner_failure', 'unknown', 'none', 'scanner_exit'])(
  'prefers a specific terminal code over generic diagnostic %s',
  (code) => {
    const report = diagnosticFromSnapshot(
      {
        ...connectingSnapshot,
        state: 'connection_failed',
        diagnostics: { ...validReport, code, stage: 'unknown' },
        error: {
          userMessage: 'private',
          recoveryAction: 'retry',
          diagnosticCode: 'inventory_count_ocr_failed',
        },
      },
      reportId,
    )
    expect(report).toMatchObject({ code: 'inventory_count_ocr_failed', stage: 'preflight' })
    expect(
      diagnosticFromSnapshot(
        {
          ...connectingSnapshot,
          state: 'connection_failed',
          diagnostics: { ...validReport, code: 'scan_no_importable_s_discs', stage: 'unknown' },
        },
        reportId,
      ),
    ).toMatchObject({ code: 'scan_no_importable_s_discs', stage: 'result' })
  },
)

it('drops unknown, path-like and out-of-range new evidence values in browser projection', () => {
  expect(
    sanitizeScanDiagnostic({
      ...validReport,
      evidence: {
        phase: "soda-source-ref:11722a25453694ffb98f9398fd5716d7",
        diagnosticSource: 'raw_log',
        reason: 'scrollbar_position_missing/path',
        acceptGateReason: 'waiting_for_target_selection_stability UID=42',
        actualThumbEnd: 20001,
        elapsedMs: -1,
        tick: 0.5,
        captureHealthy: 'yes',
        selectionStableFrames: -1,
        requiredSelectionStableFrames: 101,
        preselectedTargetEvidence: 'private detail',
        privatePath: "soda-source-ref:11722a25453694ffb98f9398fd5716d7",
      },
    })!.evidence,
  ).toEqual({})
})
