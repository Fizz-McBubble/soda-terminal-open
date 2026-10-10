import type { ScanDiagnosticReport } from '../scanner/diagnostics'

type Guidance = { problem: string; nextAction: string }
const guidance: Record<string, Guidance> = {
  game_window_not_foreground: {
    problem: '游戏窗口未保持在前台。',
    nextAction: '切回绝区零的驱动仓库后重试，扫描期间不要切换窗口。',
  },
  window_geometry_changed: {
    problem: '扫描期间游戏窗口的位置或尺寸发生了变化。',
    nextAction: '保持窗口位置和尺寸固定，重新开始扫描。',
  },
  game_window_not_visible: {
    problem: '游戏画面未完整显示在屏幕内。',
    nextAction: '恢复游戏窗口并使画面完整可见，关闭遮挡后重试。',
  },
  ppocrv6_detail_geometry_incompatible: {
    problem: '当前游戏画面尺寸或驱动盘详情布局不适合扫描。',
    nextAction:
      '按画面扫描指南使用支持的 16:9 画面，打开驱动仓库完整列表，保持画面完整可见后重试。',
  },
  helper_unavailable: {
    problem: '网页暂时没有连接到画面扫描。',
    nextAction: '确认画面扫描已启动，再点击重新连接。',
  },
  helper_incompatible: {
    problem: '画面扫描与当前网页版本不匹配。',
    nextAction: '刷新页面并重新连接；仍提示版本不匹配时，按页面提示更新画面扫描。',
  },
  helper_pairing_denied: {
    problem: '画面扫描拒绝了此网站的连接。',
    nextAction: '重新连接；若仍被拒绝，请反馈此问题。',
  },
  permission_denied: {
    problem: '画面扫描未获得本次操作所需的权限。',
    nextAction: '重新开始，留意 Windows 对本次扫描的权限提示；仍失败时可反馈。',
  },
  elevation_cancelled: {
    problem: '本次 Windows 权限确认没有完成。',
    nextAction: '准备继续扫描时重新开始，并确认本次权限提示。',
  },
  game_process_not_found: {
    problem: '画面扫描暂时没有找到正在运行的游戏。',
    nextAction: '打开绝区零并进入游戏，再尝试扫描。',
  },
  inventory_count_ocr_failed: {
    problem: '扫描前未能识别仓库数量。',
    nextAction: '请反馈此问题；准备好后可重新扫描。',
  },
  scan_no_importable_s_discs: {
    problem: '本次结果没有可导入的 S 级驱动盘。',
    nextAction: '检查扫描结果提示；若仓库有 S 级盘却未读到，请反馈此问题。',
  },
  panel_capture_timeout: {
    problem: '未能及时读取到可识别的驱动盘画面。',
    nextAction: '更新画面扫描后重试；仍失败时请反馈此问题。',
  },
  duplicate_guard: {
    problem: '画面扫描将相同属性判断为重复，停止了扫描。',
    nextAction: '更新画面扫描后重试；若仍中断，请反馈此问题。',
  },
  warehouse_context_lost: {
    problem: '暂时无法确认驱动仓库画面，扫描已停止。',
    nextAction: '更新画面扫描后重试；若仍停止，请反馈此问题。',
  },
  scan_navigation_failed: {
    problem: '扫描时未能按预期翻动仓库。',
    nextAction: '更新画面扫描后重试；若仍中断，请反馈此问题。',
  },
  visual_preflight_failed: {
    problem: '开始扫描前，游戏画面检查没有通过。',
    nextAction: '查看页面的具体检查提示后重试；没有具体提示时，可更新画面扫描再试。',
  },
  ocr_worker_failed: {
    problem: '扫描中的文字识别没有正常完成。',
    nextAction: '重试扫描；若再次失败，请反馈此问题以便排查识别组件。',
  },
  direct_fork_result_missing: {
    problem: '扫描结束后，没有取得可用的结果。',
    nextAction: '重新扫描；若再次失败，请反馈此问题。',
  },
  direct_fork_partial: {
    problem: '本次扫描只取得了部分结果。',
    nextAction: '本次结果不完整，暂不能更新仓库；可反馈问题，再重新完整扫描。',
  },
  previous_scan_recovery_failed: {
    problem: '上一次扫描结果未能恢复。',
    nextAction: '可重新扫描；若有保留的结果文件，也可通过页面的导入入口检查。',
  },
  scan_result_timeout: {
    problem: '等待扫描结果的时间过长，本次未取得结果。',
    nextAction: '确认画面扫描状态后重试读取结果；若持续发生，可反馈此问题。',
  },
  scan_result_read_failed: {
    problem: '扫描结果未能正常读取。',
    nextAction: '重试读取或重新扫描；若持续失败，请反馈此问题。',
  },
  scan_import_handoff_failed: {
    problem: '扫描结果未能进入检查。',
    nextAction: '在当前页重新检查结果；若已保存结果文件，可使用结果文件入口继续。',
  },
  scan_import_failed: {
    problem: '扫描结果未能完成导入。',
    nextAction: '重新核对接收账户和导入检查，再确认更新；仍失败时可反馈问题。',
  },
  scan_import_review_required: {
    problem: '部分驱动盘的套装、词条或其他信息未通过检查，账户仓库尚未更新。',
    nextAction: '对照盘面手动校准，再确认导入；无法确认时可反馈问题或重新扫描。',
  },
  scan_file_invalid: {
    problem: '所选文件未通过格式检查。',
    nextAction: '选择完整、未损坏的原始文件后重试；若仍无法读取，可反馈此问题。',
  },
  scanner_exit: {
    problem: '扫描程序在完成前退出，现有诊断信息不足以确定原因。',
    nextAction: '更新画面扫描后重试；若再次退出，请反馈此问题。',
  },
  scanner_failure: {
    problem: '扫描程序未能完成本次任务，现有诊断信息不足以确定原因。',
    nextAction: '更新画面扫描后重试；若仍失败，请反馈此问题。',
  },
}

const retry = '请反馈此问题；准备好后可重新扫描。'
const legacyRetry = '更新画面扫描后重试；若仍中断，请反馈此问题。'
const detailGuidance: Record<string, Guidance> = {
  waiting_for_panel_change: { problem: '等待期间没有确认到目标盘面的变化。', nextAction: retry },
  waiting_for_target_selection_stability: {
    problem: '等待期间没有确认目标盘已稳定选中。',
    nextAction: retry,
  },
  waiting_for_preselected_selection_stability: {
    problem: '当前选中盘面未达到稳定确认条件。',
    nextAction: retry,
  },
  waiting_for_variable_roi_stability: {
    problem: '盘面文字区域未达到稳定确认条件。',
    nextAction: retry,
  },
  waiting_for_stable_frame: { problem: '等待期间未取得稳定盘面。', nextAction: retry },
  before_min_accept: { problem: '本次盘面未达到读取确认条件。', nextAction: retry },
  invalid_roi_layout: { problem: '本次盘面文字区域布局未通过检查。', nextAction: retry },
  required_core_missing: { problem: '读取到的驱动盘必要文字不完整。', nextAction: retry },
  incomplete_substat_pair: { problem: '读取到的副属性名称或数值不完整。', nextAction: retry },
  substat_gap: { problem: '读取到的副属性文字存在缺项。', nextAction: retry },
  scrollbar_position_missing: { problem: '扫描期间未能确认仓库滚动条的位置。', nextAction: retry },
  unexpected_scroll_during_row: {
    problem: '读取当前行时检测到非预期的仓库滚动。',
    nextAction: retry,
  },
  scrollbar_thumb_geometry_changed: {
    problem: '仓库滚动条的尺寸发生变化，位置未能确认。',
    nextAction: retry,
  },
  native_edge_position_unverified: { problem: '翻行后仓库位置未能确认。', nextAction: retry },
  native_edge_position_release_unverified: {
    problem: '翻行后仓库稳定位置未能确认。',
    nextAction: retry,
  },
  native_scrollbar_position_evidence_missing: {
    problem: '未取得确认仓库滚动位置所需的信息。',
    nextAction: retry,
  },
  preselected_binding_insufficient: {
    problem: '当前选中盘与目标位置的对应关系未能确认。',
    nextAction: retry,
  },
  preselected_position_mismatch: {
    problem: '当前选中盘的位置与目标位置不一致。',
    nextAction: retry,
  },
  unscanned_rows_at_bottom: { problem: '已到仓库底部，但仍有行未完成读取。', nextAction: retry },
  traversal_iteration_limit: { problem: '仓库遍历达到次数上限，扫描未完成。', nextAction: retry },
  scroll_top_position_unconfirmed: {
    problem: '未能确认已回到仓库顶部。',
    nextAction: retry,
  },
}
export function scannerDiagnosticGuidance(report: ScanDiagnosticReport): Guidance {
  if (
    ['panel_capture_timeout', 'scan_navigation_failed', 'scanner_failure', 'unknown'].includes(
      report.code,
    )
  ) {
    for (const key of ['reason', 'acceptGateReason']) {
      const detail = report.evidence[key]
      if (typeof detail === 'string' && detailGuidance[detail])
        return {
          ...detailGuidance[detail],
          nextAction: report.evidence.diagnosticSource === 'terminal_details' ? retry : legacyRetry,
        }
    }
  }
  if (guidance[report.code]) {
    const result = guidance[report.code]
    if (
      report.evidence.diagnosticSource === 'terminal_details' &&
      !['helper_incompatible', 'duplicate_guard'].includes(report.code) &&
      result.nextAction.includes('更新画面扫描')
    )
      return { ...result, nextAction: retry }
    return result
  }
  if (report.code === 'none' && report.outcome === 'completed')
    return { problem: '本次扫描已完成，未记录到具体错误。', nextAction: '可继续检查扫描结果。' }
  if (report.code === 'none' && report.outcome === 'cancelled')
    return {
      problem: '本次扫描已停止，未记录到具体错误。',
      nextAction: '准备继续时可重新开始扫描。',
    }
  return {
    problem: '本次没有取得足够信息，暂时无法确定原因。',
    nextAction: '可反馈问题，或按当前页面提示重试；页面提示版本不匹配时，再更新画面扫描。',
  }
}
