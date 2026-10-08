import { describe, expect, it } from 'vitest'
import {
  browserDiagnostic,
  diagnosticFromSnapshot,
  diagnosticJson,
  sanitizeScanDiagnostic,
} from './diagnostics'
import { connectingSnapshot } from './runtimeSnapshots'
const reportId = '10f44460-1234-4123-8123-abc123abc123'
export const validReport = {
  schema: 1,
  reportId,
  release: 'test-release',
  outcome: 'failed',
  stage: 'capture',
  code: 'panel_capture_timeout',
  versions: { helper: '1.2.3' },
  counts: { processed: 4, total: null },
  durationMs: null,
  environment: { width: 1920, height: 1080, captureMode: 'gdi', browser: 'edge' },
  evidence: { attempts: 2, sawPanelChange: false },
}

describe('allowlisted diagnostic privacy boundary', () => {
  it.each([
    'game_window_not_foreground',
    'game_window_not_visible',
    'window_geometry_changed',
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
  it('reports a connection failure without copying a retained completed scan', () => {
    const report = diagnosticFromSnapshot(
      {
        ...connectingSnapshot,
        state: 'completed',
        diagnostics: { ...validReport, outcome: 'completed', durationMs: 9000 },
      },
      '20f44460-1234-4123-8123-abc123abc123',
      'helper_unavailable',
    )
    expect(report).toMatchObject({
      reportId: '20f44460-1234-4123-8123-abc123abc123',
      code: 'helper_unavailable',
      stage: 'connection',
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
