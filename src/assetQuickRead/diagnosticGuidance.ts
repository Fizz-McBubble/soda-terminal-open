import contract from '../scanner/scanFeedback.contract.json'

type AssetFailureEvidence = {
  nativeErrorCode?: number
}

/** Choose recovery text only from reviewed codes; never display child output. */
export function assetFailureGuidance(code?: string | null, evidence?: AssetFailureEvidence | null) {
  if (code === 'candidate_validation_issues')
    return {
      problem: '本次读取结果未通过校验。',
      nextAction: '请保留诊断和当前库存；不要据此导入未校验结果。',
    }
  if (!code || !contract.assetQuickRead.codes.includes(code)) return undefined
  if (code.startsWith('public_'))
    return {
      problem: '游戏公共配置未能准备完成。',
      nextAction: '确认游戏资源服务可访问后重试；仍失败时请发送诊断。',
    }
  if (code.startsWith('client_resource_') || code.startsWith('client_dispatch_'))
    return {
      problem: '游戏资源未通过读取或兼容检查。',
      nextAction: '确认所选目录是当前游戏的实际安装目录；仍失败时请发送诊断以便核对兼容性。',
    }
  if (code === 'client_directory_rejected')
    return {
      problem: '游戏安装目录格式不可用。',
      nextAction: "soda-source-ref:f8fa681d92b02f93232cbf5ec8df1838",
    }
  if (code === 'client_directory_missing')
    return {
      problem: '游戏安装目录不存在。',
      nextAction: '请从启动器的游戏设置打开实际目录，再复制地址栏中的完整路径。',
    }
  if (code === 'client_resource_missing')
    return {
      problem: '所选目录不是完整的游戏安装目录。',
      nextAction: '请选择同时包含 ZenlessZoneZero.exe 和 ZenlessZoneZero_Data 的目录。',
    }
  if (code === 'linked_path_rejected')
    return {
      problem: '游戏目录包含目录链接。',
      nextAction: '请选择游戏实际所在目录，不要使用快捷方式、junction 或目录链接。',
    }
  if (code.startsWith('protocol_') || code.startsWith('driver_'))
    return {
      problem: '资产快读运行文件未通过检查。',
      nextAction: '请保留诊断并反馈工具运行文件问题，已有读取结果无需删除。',
    }
  if (code === 'capture_dll_unavailable' || code === 'dll_search_restriction_failed')
    return {
      problem: '资产快读采集依赖未能加载。',
      nextAction: '请保留诊断并反馈工具运行文件问题。',
    }
  if (code === 'capture_open_failed' && evidence?.nativeErrorCode === 1450)
    return {
      problem: 'Windows 未能打开采集通道，系统返回资源不可用（1450）。',
      nextAction:
        '确认本次管理员授权已完成，关闭其他抓包或网络驱动工具，重启资产快读后重试；仍失败时发送诊断。',
    }
  if (code === 'capture_open_failed' || code === 'capture_receive_failed')
    return {
      problem: code === 'capture_open_failed' ? '未能打开本机采集通道。' : '本机采集通道中断。',
      nextAction: '可重试并留意本次 Windows 授权提示；仍失败时请发送诊断。',
    }
  if (code === 'capture_child_start_failed' || code === 'worker_launch_failed')
    return {
      problem: '资产快读采集进程未能启动。',
      nextAction: '重试仍失败时请发送诊断，已取得的系统错误码会一并保留。',
    }
  if (code.startsWith('output_') || code === 'report_serialization_failed')
    return {
      problem: '本次读取结果未能写入。',
      nextAction: '请保留诊断并反馈，已有读取结果无需删除。',
    }
  return undefined
}
