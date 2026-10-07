import type { ScanDiagnosticReport } from '../scanner/diagnostics'

type Guidance = { problem: string; nextAction: string }
const guidance: Record<string, Guidance> = {
  helper_unavailable: {
    problem: '网页暂时没有连接到本机扫描助手。',
    nextAction: '确认扫描助手已启动，再点击重新连接。',
  },
  helper_incompatible: {
    problem: '本机扫描助手与当前网页版本不匹配。',
    nextAction: '按页面提示更新扫描助手，然后重新连接。',
  },
  helper_pairing_denied: {
    problem: '扫描助手拒绝了此网站的连接。',
    nextAction: '更新扫描助手后重新连接。',
  },
  permission_denied: {
    problem: '扫描助手未获得本次操作所需的权限。',
    nextAction: '重新开始，留意 Windows 对本次扫描的权限提示；仍失败时可反馈。',
  },
  elevation_cancelled: {
    problem: '本次 Windows 权限确认没有完成。',
    nextAction: '准备继续扫描时重新开始，并确认本次权限提示。',
  },
  game_process_not_found: {
    problem: '扫描助手暂时没有找到正在运行的游戏。',
    nextAction: '打开绝区零并进入游戏，再尝试扫描。',
  },
  panel_capture_timeout: {
    problem: '未能及时读取到可识别的驱动盘画面。',
    nextAction: '确认游戏仓库画面可见、没有弹窗遮挡，再重试；仍失败时可反馈。',
  },
  scan_navigation_failed: {
    problem: '扫描时未能按预期翻动仓库。',
    nextAction: '回到驱动盘仓库并关闭弹窗，再重试；扫描时避免操作游戏。',
  },
  visual_preflight_failed: {
    problem: '开始扫描前，游戏画面检查没有通过。',
    nextAction: '确认已进入游戏且画面没有被遮挡，按页面提示检查后重试。',
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
    nextAction: '查看页面对结果完整性的提示，确认后再继续；需要完整仓库时重新扫描。',
  },
  previous_scan_recovery_failed: {
    problem: '上一次扫描结果未能恢复。',
    nextAction: '可重新扫描；若有保留的结果文件，也可通过页面的导入入口检查。',
  },
  scan_result_timeout: {
    problem: '等待扫描结果的时间过长，本次未取得结果。',
    nextAction: '确认扫描助手状态后重试；若持续发生，请反馈此问题。',
  },
  scan_result_read_failed: {
    problem: '扫描结果未能正常读取。',
    nextAction: '重试读取或重新扫描；若持续失败，请反馈此问题。',
  },
  scan_import_handoff_failed: {
    problem: '扫描结果未能送到导入页面。',
    nextAction: '重试打开导入；若已保存结果文件，可从页面导入入口继续。',
  },
  scan_import_failed: {
    problem: '扫描结果未能完成导入。',
    nextAction: '查看导入页面的提示后重试；若仍失败，请反馈此问题。',
  },
  scan_file_invalid: {
    problem: '所选文件未通过扫描结果格式检查。',
    nextAction: '选择扫描生成的结果文件；若原文件仍无法导入，请反馈此问题。',
  },
  scanner_exit: {
    problem: '扫描程序在完成前退出。',
    nextAction: '重新扫描；若再次退出，请反馈此问题。',
  },
  scanner_failure: {
    problem: '扫描程序未能完成本次任务，具体原因尚未确定。',
    nextAction: '可重试扫描；若仍失败，请反馈此问题以便排查。',
  },
}

export function scannerDiagnosticGuidance(report: ScanDiagnosticReport): Guidance {
  if (guidance[report.code]) return guidance[report.code]
  if (report.code === 'none' && report.outcome === 'completed')
    return { problem: '本次扫描已完成，未记录到具体错误。', nextAction: '可继续检查扫描结果。' }
  if (report.code === 'none' && report.outcome === 'cancelled')
    return {
      problem: '本次扫描已停止，未记录到具体错误。',
      nextAction: '准备继续时可重新开始扫描。',
    }
  return {
    problem: '本次没有取得足够信息，暂时无法确定原因。',
    nextAction: '可重试；若问题持续，请反馈此问题帮助排查。',
  }
}
