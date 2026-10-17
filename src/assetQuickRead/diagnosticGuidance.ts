import contract from '../scanner/scanFeedback.contract.json'

type AssetFailureEvidence = {
  nativeErrorCode?: number
}

/** Choose recovery text only from reviewed codes; never display child output. */
export function assetFailureGuidance(
  code?: string | null,
  evidence?: AssetFailureEvidence | null,
) {
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
      problem: 'Windows 未能分配采集所需的系统资源。',
      nextAction: '请结束当前读取后重试；仍失败时发送诊断。',
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
