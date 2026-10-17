import { useLayoutEffect, useRef, useState } from 'react'
import { sanitizeAssetDiagnostic, type AssetDiagnosticReport } from '../assetQuickRead/diagnostics'
import {
  assetFeedbackFailureMessage,
  readAssetReceipt,
  submitAssetFeedback,
} from '../assetQuickRead/feedback'
import { DiagnosticEntry, DiagnosticPopover } from './DiagnosticFeedbackPresentation'
import { assetQuickReadConnectionGuidance } from './assetQuickReadControllerContract'
import { assetFailureGuidance } from '../assetQuickRead/diagnosticGuidance'
import './scanner-guide.css'
import './scanner-diagnostic-feedback.css'

export function AssetQuickReadFeedback({
  report,
  workspaceMessage,
  workspaceMessageRole,
  previous = false,
  inline = false,
}: {
  report: AssetDiagnosticReport | null
  workspaceMessage?: string
  workspaceMessageRole?: 'alert' | 'status'
  previous?: boolean
  inline?: boolean
}) {
  const safe = sanitizeAssetDiagnostic(report)
  const key = safe ? JSON.stringify(safe) : ''
  const current = useRef(key)
  const pending = useRef<string | null>(null)
  const [state, setState] = useState<{
    key: string
    message: string
    pending?: boolean
    receivedAt?: string
  } | null>(null)
  useLayoutEffect(() => {
    current.current = key
  }, [key])
  if (!safe) return null
  const receipt = readAssetReceipt(safe)
  const shown = state?.key === key ? state : null
  const receivedAt = shown?.receivedAt ?? receipt?.receivedAt
  async function send() {
    if (!safe || pending.current === key || receivedAt) return
    pending.current = key
    setState({ key, message: '正在发送…', pending: true })
    try {
      const ack = await submitAssetFeedback(safe)
      if (current.current === key)
        setState({ key, message: '已收到反馈。', receivedAt: ack.receivedAt })
    } catch (error) {
      if (current.current === key) setState({ key, message: assetFeedbackFailureMessage(error) })
    } finally {
      if (pending.current === key) pending.current = null
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(safe, null, 2))
      if (current.current === key) setState({ key, message: '已复制诊断。', receivedAt })
    } catch {
      if (current.current === key)
        setState({ key, message: '复制未完成，可下载诊断。', receivedAt })
    }
  }
  function download() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(safe, null, 2)], { type: 'application/json' }),
    )
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `soda-asset-diagnostic-${safe!.reportId}.json`
    anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }
  const guidance: Record<string, { problem: string; nextAction: string }> = {
    connection: {
      problem: '资产快读未能连接。',
      nextAction: '确认工具已安装，并允许浏览器访问本机设备后重新连接。',
    },
    permission: {
      problem: '资产快读权限确认没有完成。',
      nextAction: '重新连接或开始读取，留意本次 Windows 权限提示。',
    },
    startup: {
      problem: '资产快读未能启动本次读取。',
      nextAction: '本次失败原因尚未细分，可重试；仍失败时请发送诊断。',
    },
    waiting: {
      problem: '资产快读未收到完整数据。',
      nextAction: '确认已完整启动游戏并登录；仍未收到数据时可重新读取。',
    },
    result: {
      problem: '资产快读结果未通过读取检查。',
      nextAction: '重新读取或选择完整的结果文件；仍失败时可反馈。',
    },
    import: {
      problem: '资产快读结果未完成导入。',
      nextAction: '检查当前接收账户和结果，再重新确认导入。',
    },
  }
  const statusOnly = safe.outcome !== 'failed'
  const detailedFailureHint = statusOnly
    ? undefined
    : assetFailureGuidance(safe.code, safe.evidence)
  const hint = statusOnly
    ? {
        problem:
          safe.outcome === 'completed'
            ? '本次导入已完成。'
            : safe.evidence.jobState === 'capturing'
              ? '正在等待读取结果。'
              : safe.evidence.jobState === 'received'
                ? '读取结果已就绪。'
                : safe.evidence.jobState === 'starting'
                  ? '正在准备资产快读。'
                  : '可查看当前状态并反馈。',
        nextAction: '操作异常时可反馈当前状态。',
      }
    : ((safe.code === 'import_recovery_limit_reached'
        ? {
            problem: '资产快读恢复副本已达上限。',
            nextAction: '在账户与备份中下载并保管旧副本，再确认移除本机副本后继续。',
          }
        : safe.code === 'import_snapshot_reused'
          ? {
              problem: '这份读取结果已使用，或账户在恢复后已有修改。',
              nextAction: '重新读取最新资产，再检查并确认导入。',
            }
          : (assetQuickReadConnectionGuidance(safe.code) ??
            detailedFailureHint ??
            guidance[safe.stage])) ?? {
        problem: '资产快读未完成本次操作。',
        nextAction: '检查工具准备状态后重试；仍失败时可反馈。',
      })
  const metadata: string[] = []
  if (safe.versions.bridge) metadata.push(`Bridge ${safe.versions.bridge}`)
  if (typeof safe.evidence.nativeErrorCode === 'number')
    metadata.push(`系统错误码 ${safe.evidence.nativeErrorCode}`)
  if (typeof safe.evidence.childExitCode === 'number')
    metadata.push(`采集进程退出码 ${safe.evidence.childExitCode}`)
  if (typeof safe.evidence.remainingSeconds === 'number')
    metadata.push(`剩余等待 ${safe.evidence.remainingSeconds} 秒`)
  if (safe.counts.processed !== null) metadata.push(`已处理 ${safe.counts.processed}`)
  return (
    <DiagnosticEntry
      title={previous ? '上次资产快读诊断' : '资产快读诊断'}
      inline={inline}
      status={
        workspaceMessage ||
        (receivedAt ? '本次反馈已发送。' : `${previous ? '上次记录：' : ''}${hint.problem}`)
      }
      statusRole={workspaceMessage ? workspaceMessageRole : undefined}
    >
      <DiagnosticPopover
        key={key}
        title={previous ? '上次资产快读诊断' : '资产快读诊断'}
        problem={
          (!detailedFailureHint && workspaceMessage) ||
          `${previous ? '上次记录：' : ''}${hint.problem}`
        }
        nextAction={hint.nextAction}
        metadata={metadata}
        receiptId={receivedAt ? safe.reportId : undefined}
        message={shown?.message ?? (receivedAt ? '已收到反馈。' : undefined)}
        actions={
          <>
            <button
              type="button"
              className="button button--quiet"
              disabled={Boolean(shown?.pending) || Boolean(receivedAt)}
              onClick={() => void send()}
            >
              {receivedAt
                ? '已发送'
                : shown?.pending
                  ? '发送中…'
                  : statusOnly
                    ? '反馈当前状态'
                    : '发送反馈'}
            </button>
            <button
              type="button"
              className="button button--quiet"
              disabled={Boolean(shown?.pending)}
              onClick={() => void copy()}
            >
              复制诊断
            </button>
            <button type="button" className="button button--quiet" onClick={download}>
              下载诊断
            </button>
          </>
        }
      />
    </DiagnosticEntry>
  )
}
