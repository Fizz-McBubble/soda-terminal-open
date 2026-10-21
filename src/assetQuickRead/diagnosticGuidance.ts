import contract from '../scanner/scanFeedback.contract.json'

const compatibilityProblems: Record<string, string> = {
  client_dispatch_version_rejected: '客户端配置版本未通过检查。',
  client_dispatch_seed_shape_rejected: '客户端请求参数格式未通过检查。',
  client_dispatch_version_and_seed_shape_rejected: '客户端配置版本与请求参数格式均未通过检查。',
  client_dispatch_version_or_seed_shape_rejected: '客户端版本或配置未通过检查。',
}

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
  const compatibility = compatibilityProblems[code]
  if (compatibility)
    return {
      problem: compatibility,
      nextAction: '发送诊断可保留本次具体校验分支，无需上传游戏文件或账户。',
    }
  if (code.startsWith('client_resource_') || code.startsWith('client_dispatch_'))
    return {
      problem: '游戏资源未通过读取或兼容检查。',
      nextAction: '确认所选目录是当前游戏的实际安装目录；仍失败时请发送诊断以便核对兼容性。',
    }
  if (code === 'import_account_changed' || code === 'import_scope_changed')
    return {
      problem: '目标账户或数据在检查后发生变化，本次导入已停止。',
      nextAction: '请重新检查导入影响，再确认导入。',
    }
  if (code === 'import_identity_conflict')
    return {
      problem: '读取结果与现有驱动盘的实例对应关系无法确认。',
      nextAction: '请保留当前库存与读取结果并发送诊断，不要通过删除旧盘消除冲突。',
    }
  if (code === 'import_snapshot_stale')
    return {
      problem: '读取结果早于已保存的数据，导入已停止。',
      nextAction: '请使用新的读取结果，现有库存保持不变。',
    }
  if (code === 'import_conservation_failed')
    return {
      problem: '导入后的账户守恒检查未通过，事务已回滚。',
      nextAction: '请保留读取结果并发送诊断，以便核对导入事务。',
    }
  if (code === 'import_snapshot_update_required')
    return {
      problem: '读取结果需要资产快读适配更新。',
      nextAction: '可先导出待适配结果，更新后重新检查；账户未修改。',
    }
  if (code === 'import_restore_unavailable' || code === 'import_restore_conflict')
    return {
      problem: '恢复副本不可用，或导入后已有其他修改，本次恢复已停止。',
      nextAction: '请保留当前库存与恢复副本，按页面具体提示核对后再操作。',
    }
  if (code === 'import_restore_conservation_failed')
    return {
      problem: '恢复后的账户守恒检查未通过，事务已回滚。',
      nextAction: '请保留当前库存与恢复副本并发送诊断。',
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
