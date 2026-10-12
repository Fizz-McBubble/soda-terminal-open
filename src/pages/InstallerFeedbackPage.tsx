import { useState } from 'react'
import { FileText, CheckCircle2, AlertCircle } from 'lucide-react'
import {
  readInstallerReceipt,
  submitInstallerFeedback,
  type InstallerFeedbackReceipt,
  type InstallerFeedbackReport,
} from '../assetQuickRead/installerFeedback'
import './installer-feedback.css'

const STAGE_LABELS: Record<string, string> = {
  prepare: '准备环境',
  payload_verify: '校验安装包',
  copy: '写入文件',
  protocol: '下载协议数据',
  verify: '校验安装完整性',
  register: '添加快捷入口',
  extract: '准备组件',
  commit: '完成安装登记',
  start: '启动工具',
  failed: '安装失败',
}

function problemForCode(code: string, toolLabel: string): { problem: string; nextAction: string } {
  switch (code) {
    case 'installer_access_denied':
      return {
        problem: '安装目录访问被拒绝。',
        nextAction: '请检查当前账户目录权限或安全软件拦截提示后重试。',
      }
    case 'protocol_source_rejected':
      return {
        problem: '所需数据源校验不匹配。',
        nextAction: '请访问官网重新获取官方最新安装程序。',
      }
    case 'protocol_download_timeout':
      return {
        problem: '协议数据下载超时。',
        nextAction: '请检查网络连接后在安装器中点击重试。',
      }
    case 'protocol_download_connection_failed':
      return {
        problem: '未能连接到数据下载服务器。',
        nextAction: '请检查网络连通性后在安装器中点击重试。',
      }
    case 'payload_hash_mismatch':
    case 'payload_file_hash_mismatch':
    case 'installed_hash_mismatch':
      return {
        problem: '安装文件完整性校验失败。',
        nextAction: '安装文件可能在下载过程中损坏，请重新下载官方安装程序。',
      }
    case 'catalog_identity_rejected':
      return {
        problem: '安装清单不匹配。',
        nextAction: '请重新下载官方最新版本安装程序。',
      }
    case 'setup_asset_size_mismatch':
    case 'runtime_asset_identity_mismatch':
    case 'runtime_file_identity_mismatch':
    case 'uninstaller_invalid':
      return {
        problem: '安装组件完整性校验失败。',
        nextAction: '请从官网重新下载安装包后重试。',
      }
    case 'setup_asset_prepare_timeout':
    case 'setup_asset_extract_failed':
    case 'setup_asset_missing':
    case 'setup_asset_ready_invalid':
      return {
        problem: '安装组件准备未完成。',
        nextAction: '请在安装器中重试；若持续失败，可提交本诊断协助定位。',
      }
    case 'runtime_health_probe_failed':
    case 'runtime_health_probe_timeout':
      return {
        problem: '安装后的工具未通过就绪检查。',
        nextAction: '请关闭画面扫描后重试，并保留诊断回执以便排查。',
      }
    case 'scanner_still_running':
      return {
        problem: '画面扫描仍在运行。',
        nextAction: '请结束当前扫描并关闭工具，再返回安装器重试。',
      }
    case 'another_installer_is_running':
      return {
        problem: '已有安装程序正在运行。',
        nextAction: '请关闭其他正在进行的安装后重试。',
      }
    case 'offline_payload_unavailable':
      return {
        problem: '离线安装包不可用。',
        nextAction: '请确认安装包完整解压后重试。',
      }
    default:
      return {
        problem: `${toolLabel}安装未完成。`,
        nextAction: '请检查安装器详情后重试；若持续失败可提交本诊断协助定位。',
      }
  }
}

export function InstallerFeedbackPage({
  initialReport = null,
}: {
  initialReport?: InstallerFeedbackReport | null
}) {
  // The entry point consumes the fragment once, before React StrictMode renders.
  const report = initialReport

  const [receipt, setReceipt] = useState<InstallerFeedbackReceipt | null>(() => {
    if (!report) return null
    return readInstallerReceipt(report)
  })

  const [isSending, setIsSending] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  if (!report) {
    return (
      <main className="installer-feedback-page" aria-label="安装反馈">
        <section className="installer-feedback-card">
          <div className="installer-feedback-header">
            <div className="installer-feedback-icon" aria-hidden="true">
              <AlertCircle size={24} />
            </div>
            <div className="installer-feedback-title-group">
              <h1 className="installer-feedback-title">安装问题反馈</h1>
              <span className="installer-feedback-version">Soda Terminal</span>
            </div>
          </div>
          <div className="installer-feedback-guidance">
            <p>
              <strong>状态说明</strong>
              <span>
                未检测到有效的安装诊断信息。若安装遇到问题，请在安装器中点击“反馈安装问题”；或检查网络连接后重试安装。
              </span>
            </p>
          </div>
          <div className="installer-feedback-footer">
            <p className="installer-feedback-privacy">未传输任何系统或个人信息。</p>
          </div>
        </section>
      </main>
    )
  }

  const toolLabel = report.tool === 'screen_scanner_installer' ? '画面扫描' : '资产快读'
  const { problem, nextAction } = problemForCode(report.code, toolLabel)

  async function handleSend() {
    if (!report || isSending || receipt) return
    setIsSending(true)
    setStatusMessage('正在发送…')
    try {
      const ack = await submitInstallerFeedback(report)
      setReceipt(ack)
      setStatusMessage('已收到反馈。')
    } catch {
      setStatusMessage('暂未收到回执，请重试或复制诊断。')
    } finally {
      setIsSending(false)
    }
  }

  async function handleCopy() {
    if (!report) return
    try {
      await navigator.clipboard.writeText(JSON.stringify(report, null, 2))
      setStatusMessage('已复制诊断。')
    } catch {
      setStatusMessage('复制未完成，可下载诊断。')
    }
  }

  function handleDownload() {
    if (!report) return
    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: 'application/json; charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `soda-installer-diagnostic-${report.reportId}.json`
    anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }

  return (
    <main className="installer-feedback-page" aria-label={`${toolLabel}安装问题反馈`}>
      <section className="installer-feedback-card">
        <header className="installer-feedback-header">
          <div className="installer-feedback-icon" aria-hidden="true">
            {receipt ? <CheckCircle2 size={24} /> : <FileText size={24} />}
          </div>
          <div className="installer-feedback-title-group">
            <h1 className="installer-feedback-title">{toolLabel}安装问题反馈</h1>
            <span className="installer-feedback-version">安装器版本 {report.installerVersion}</span>
          </div>
        </header>

        <div className="installer-feedback-guidance">
          <p>
            <strong>遇到的问题</strong>
            <span>{problem}</span>
          </p>
          <p>
            <strong>可以这样做</strong>
            <span>{nextAction}</span>
          </p>
        </div>

        <ul className="installer-feedback-metadata" aria-label="本次诊断概况">
          <li className="installer-feedback-tag">
            阶段：{STAGE_LABELS[report.stage] ?? report.stage}
          </li>
          <li className="installer-feedback-tag">代码：{report.code}</li>
          <li className="installer-feedback-tag">
            耗时：{Math.round(report.durationMs / 1000)} 秒
          </li>
          {report.attempts.length > 0 ? (
            <li className="installer-feedback-tag">诊断记录：{report.attempts.length} 条</li>
          ) : null}
        </ul>

        {report.attempts.length > 0 ? (
          <details className="installer-feedback-attempts">
            <summary className="installer-feedback-attempts-title">查看下载诊断记录</summary>
            <ul className="installer-feedback-attempts-list">
              {report.attempts.map((att, idx) => (
                <li
                  key={`${att.item}-${att.source}-${idx}`}
                  className="installer-feedback-attempt-item"
                >
                  <span>
                    项目 #{att.item + 1} ({att.source})：{att.code}
                  </span>
                  <span>{Math.round(att.elapsedMs / 1000)}s</span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}

        {receipt ? (
          <div className="installer-feedback-receipt" role="status">
            <strong>反馈已成功接收</strong>
            <span>回执编号：{receipt.report.reportId}</span>
            <span>接收时间：{receipt.receivedAt}</span>
          </div>
        ) : null}

        <div className="installer-feedback-actions">
          <button
            type="button"
            className="button button--primary"
            disabled={isSending || Boolean(receipt)}
            onClick={() => void handleSend()}
          >
            {receipt ? '已发送' : isSending ? '发送中…' : '发送反馈'}
          </button>
          <button
            type="button"
            className="button"
            disabled={isSending}
            onClick={() => void handleCopy()}
          >
            复制诊断
          </button>
          <button type="button" className="button" disabled={isSending} onClick={handleDownload}>
            下载诊断
          </button>
        </div>

        {statusMessage ? (
          <p className="installer-feedback-status-message" role="status">
            {statusMessage}
          </p>
        ) : null}

        <footer className="installer-feedback-footer">
          <p className="installer-feedback-privacy">
            仅在点击时发送安装问题信息，保留 30 天。不含进程标识、文件路径、系统凭据与个人数据。
          </p>
        </footer>
      </section>
    </main>
  )
}
