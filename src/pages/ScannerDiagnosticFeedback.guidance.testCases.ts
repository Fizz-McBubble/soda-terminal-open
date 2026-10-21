import { expect, it } from 'vitest'
import { sanitizeScanDiagnostic, type ScanDiagnosticReport } from '../scanner/diagnostics'
import contract from '../scanner/scanFeedback.contract.json'
import { scannerDiagnosticGuidance } from './scannerDiagnosticGuidance'

export function registerScannerDiagnosticGuidanceCases(makeReport: () => ScanDiagnosticReport) {
  it('uses selection evidence instead of treating stable panel frames as a stable target', () => {
    const report = makeReport()
    report.code = 'panel_capture_timeout'
    report.evidence = {
      diagnosticSource: 'terminal_details',
      acceptGateReason: 'waiting_for_target_selection_stability',
      stableFrames: 22,
      requiredStableFrames: 2,
      selectionChanged: true,
      selectionStableFrames: 1,
      requiredSelectionStableFrames: 2,
    }
    expect(scannerDiagnosticGuidance(report).problem).toBe(
      '已检测到选中区域变化，但未能确认目标盘稳定选中。',
    )
  })
  it.each([
    ['capture_unavailable', '未取得可用于检查的游戏画面', '恢复游戏窗口'],
    ['inventory_screen_unreadable', '联合确认条件', '标题和完整列表'],
    ['unsupported_display_layout', '支持布局检查', '16:9'],
    ['inventory_screen_not_detected', '未能确认驱动仓库标题和列表布局', '简体中文'],
  ])(
    'explains preflight observation %s with a specific recovery',
    (preflightState, problem, action) => {
      const report = sanitizeScanDiagnostic({
        ...makeReport(),
        code: 'visual_preflight_failed',
        evidence: { preflightState, diagnosticSource: 'terminal_details' },
      })!
      const result = scannerDiagnosticGuidance(report)
      expect(result.problem).toContain(problem)
      expect(result.nextAction).toContain(action)
      expect(result.problem).not.toMatch(/遮挡|没有打开|晃动|锚点/)
      expect(result.nextAction).not.toContain('更新画面扫描')
    },
  )

  it('describes a missing title confirmation without diagnosing why it failed', () => {
    const result = scannerDiagnosticGuidance({
      ...makeReport(),
      code: 'visual_preflight_failed',
      evidence: {
        preflightState: 'inventory_screen_unreadable',
        warehouseHeaderDetected: false,
        headerScore: 35,
        gridStructureScore: 100,
        layoutScore: 100,
        inventoryCountDetected: true,
        anchorScore: 0,
        stableFrames: 0,
      },
    })
    expect(result.problem).toBe('已检测到部分仓库特征，但未能确认驱动仓库标题。')
    expect(result.problem).not.toMatch(/遮挡|没有打开|晃动|锚点/)
  })

  it.each([undefined, 'unknown_private_reason'])(
    'keeps old or unknown preflight details inconclusive (%s)',
    (preflightState) => {
      const report = sanitizeScanDiagnostic({
        ...makeReport(),
        code: 'visual_preflight_failed',
        evidence: { preflightState, anchorScore: 0, stableFrames: 0, headerScore: 35 },
      })!
      const result = scannerDiagnosticGuidance(report)
      expect(result.problem).toBe('开始扫描前，游戏画面检查没有通过。')
      expect(result.problem).not.toMatch(/遮挡|没有打开|晃动|锚点/)
    },
  )

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

  it('explains reset_to_top phase with manual scroll guidance for terminal_details', () => {
    const report = sanitizeScanDiagnostic({
      ...makeReport(),
      code: 'scan_navigation_failed',
      stage: 'scroll',
      counts: { processed: 0, total: null },
      evidence: {
        phase: 'reset_to_top',
        reason: 'scroll_top_position_unconfirmed',
        acceptGateReason: 'scroll_top_position_unconfirmed',
        diagnosticSource: 'terminal_details',
      },
    })!
    const result = scannerDiagnosticGuidance(report)
    expect(result.problem).toBe('未能确认已回到仓库顶部。')
    expect(result.nextAction).toBe('手动将驱动仓库列表滑至最顶部后重试；若仍停止，请反馈此问题。')
  })

  it('explains unobserved panel change when acceptGateReason is unknown or stale', () => {
    const report = sanitizeScanDiagnostic({
      ...makeReport(),
      code: 'panel_capture_timeout',
      stage: 'capture',
      counts: { processed: 65, total: 1531 },
      evidence: {
        diagnosticSource: 'terminal_details',
        sawPanelChange: false,
        selectionChanged: false,
        acceptGateReason: 'unknown',
      },
    })!
    const result = scannerDiagnosticGuidance(report)
    expect(result.problem).toBe('等待期间没有确认到目标盘面的变化。')
    expect(result.nextAction).toBe(
      '确认游戏窗口在前台且可正常点击，重新开始扫描；若仍中断，请反馈此问题。',
    )
  })

  it('provides actionable window verification for waiting_for_panel_change', () => {
    const report = sanitizeScanDiagnostic({
      ...makeReport(),
      code: 'panel_capture_timeout',
      evidence: {
        diagnosticSource: 'terminal_details',
        acceptGateReason: 'waiting_for_panel_change',
      },
    })!
    const result = scannerDiagnosticGuidance(report)
    expect(result.problem).toBe('等待期间没有确认到目标盘面的变化。')
    expect(result.nextAction).toBe(
      '确认游戏窗口在前台且可正常点击，重新开始扫描；若仍中断，请反馈此问题。',
    )
  })
}
