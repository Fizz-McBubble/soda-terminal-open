import { expect, it } from 'vitest'
import { sanitizeScanDiagnostic, type ScanDiagnosticReport } from '../scanner/diagnostics'
import contract from '../scanner/scanFeedback.contract.json'
import { scannerDiagnosticGuidance } from './scannerDiagnosticGuidance'

export function registerScannerDiagnosticGuidanceCases(makeReport: () => ScanDiagnosticReport) {
  it.each(contract.codes.filter((code) => !['none', 'unknown'].includes(code)))(
    'gives a concrete problem and next action for safe code %s',
    (code) => {
      const result = scannerDiagnosticGuidance({ ...makeReport(), code })
      expect(result.problem).toBeTruthy()
      expect(result.nextAction).toBeTruthy()
      expect(result.problem).not.toContain('没有取得足够信息')
      expect(result.problem).not.toContain(code)
    },
  )

  it.each([
    [
      'panel_capture_timeout',
      'acceptGateReason',
      'waiting_for_target_selection_stability',
      '没有确认目标盘已稳定选中',
    ],
    ['panel_capture_timeout', 'acceptGateReason', 'required_core_missing', '必要文字不完整'],
    ['scan_navigation_failed', 'reason', 'scrollbar_position_missing', '未能确认仓库滚动条'],
    ['scan_navigation_failed', 'reason', 'unexpected_scroll_during_row', '非预期的仓库滚动'],
    [
      'scan_navigation_failed',
      'reason',
      'scroll_top_position_unconfirmed',
      '未能确认已回到仓库顶部',
    ],
  ])(
    'explains observed diagnostic detail without claiming the underlying cause: %s/%s',
    (code, key, value, problem) => {
      const report = sanitizeScanDiagnostic({ ...makeReport(), code, evidence: { [key]: value } })!
      const result = scannerDiagnosticGuidance(report)
      expect(result.problem).toContain(problem)
      expect(result.problem).not.toMatch(/截图|权限|用户|遮挡/)
      expect(result.nextAction).toContain('更新画面扫描后重试')
    },
  )

  it.each(['terminal_details', 'legacy_log', 'unavailable'])(
    'chooses a supported next action for the same concrete reason from %s',
    (diagnosticSource) => {
      const report = sanitizeScanDiagnostic({
        ...makeReport(),
        code: 'scan_navigation_failed',
        evidence: { diagnosticSource, reason: 'scroll_top_position_unconfirmed' },
      })!
      const result = scannerDiagnosticGuidance(report)
      expect(result.problem).toBe('未能确认已回到仓库顶部。')
      if (diagnosticSource === 'terminal_details') {
        expect(result.nextAction).toBe('请反馈此问题；准备好后可重新扫描。')
        expect(result.nextAction).not.toContain('更新')
      } else expect(result.nextAction).toContain('更新画面扫描后重试')
    },
  )
  it.each([
    ['native_edge_position_unverified', '翻行后仓库位置未能确认。'],
    ['native_edge_position_release_unverified', '翻行后仓库稳定位置未能确认。'],
  ])('describes the observed row-transition confirmation %s accurately', (reason, problem) => {
    const result = scannerDiagnosticGuidance({
      ...makeReport(),
      code: 'scan_navigation_failed',
      evidence: { reason, diagnosticSource: 'terminal_details' },
    })
    expect(result.problem).toBe(problem)
    expect(result.nextAction).toBe('请反馈此问题；准备好后可重新扫描。')
  })
  it.each([
    'panel_capture_timeout',
    'scan_navigation_failed',
    'warehouse_context_lost',
    'visual_preflight_failed',
  ])('does not prescribe a helper update for structured current failure %s', (code) => {
    expect(
      scannerDiagnosticGuidance({
        ...makeReport(),
        code,
        evidence: { diagnosticSource: 'terminal_details' },
      }).nextAction,
    ).toBe('请反馈此问题；准备好后可重新扫描。')
  })
}
