import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PlayerSelect } from '../components/PlayerSelect'
import { UsageStatisticsPreference } from '../usageStatistics/UsageStatistics'
import './help-and-privacy.css'

const configuredFeedbackUrl = import.meta.env.VITE_SODA_FEEDBACK_URL?.trim()
const defaultFeedbackUrl = 'https://github.com/Fizz-McBubble/soda-terminal-feedback/issues'
const feedbackUrl = configuredFeedbackUrl?.startsWith('https://')
  ? configuredFeedbackUrl
  : defaultFeedbackUrl
const releaseId = import.meta.env.VITE_SODA_RELEASE_ID || 'local-development'
const diagnosticStages = [
  ['startup', '页面启动'],
  ['calculation', '本机计算'],
  ['image', '图片加载'],
  ['scanner', '本机扫描连接'],
  ['backup', '备份导入或导出'],
] as const

function diagnosticText(stage: string) {
  return `Soda Terminal 版本：${releaseId}\n错误阶段：${stage}\n可重试提示：刷新页面后重试；涉及账户资料时，先保存现有备份。`
}

export function HelpAndPrivacyPage() {
  const [stage, setStage] = useState<string>(diagnosticStages[0][1])
  const [copyState, setCopyState] = useState('')

  async function copyDiagnostic() {
    try {
      await navigator.clipboard.writeText(diagnosticText(stage))
      setCopyState('已复制，请检查后自行粘贴到反馈页面。')
    } catch {
      setCopyState('复制失败，请手动选择下方文字。')
    }
  }

  return (
    <div className="help-privacy">
      <header className="help-privacy__header">
        <div>
          <h1>帮助与隐私</h1>
          <p>资料如何保存，遇到问题如何处理。</p>
        </div>
        <Link className="button button--secondary help-privacy__back" to="/">
          返回首页
        </Link>
      </header>
      <div className="help-privacy__sections">
        <section id="data" aria-labelledby="help-data-heading">
          <h2 id="help-data-heading">资料保存与备份</h2>
          <div className="help-privacy__content">
            <p>
              账户、资产、标记和已保存方案存于当前浏览器；计算在本机完成，不上传账户或资产资料。
            </p>
            <p>
              在<Link to="/assets/account">我的资产 · 账户</Link>
              导出或恢复备份。清除站点数据、更换浏览器前，请先导出备份并妥善保管；恢复时须选择文件并确认。
            </p>
            <UsageStatisticsPreference />
          </div>
        </section>
        <section aria-labelledby="help-scanner-heading">
          <h2 id="help-scanner-heading">本机扫描</h2>
          <div className="help-privacy__content">
            <p>
              Windows
              扫描助手通过本机回环地址连接，读取可见的游戏画面。扫描结果须经你检查并确认导入，才会更新
              Soda 账户。
            </p>
          </div>
        </section>
        <section aria-labelledby="help-contact-heading">
          <h2 id="help-contact-heading">问题与反馈</h2>
          <div className="help-privacy__content">
            <a
              className="button button--secondary"
              href={feedbackUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              问题与建议反馈
            </a>
            <p className="help-privacy__feedback-note">
              请勿公开上传账户备份、游戏 UID 或扫描截图。
            </p>
            <details className="help-privacy__diagnostic">
              <summary>简要诊断</summary>
              <p>仅包含版本、所选阶段和重试提示，不读取账户，也不自动发送。</p>
              <div className="help-privacy__diagnostic-controls">
                <label htmlFor="feedback-stage">错误阶段</label>
                <PlayerSelect
                  id="feedback-stage"
                  aria-label="错误阶段"
                  className="help-privacy__stage"
                  value={stage}
                  onChange={(value) => {
                    setStage(value)
                    setCopyState('')
                  }}
                >
                  {diagnosticStages.map(([code, label]) => (
                    <option key={code} value={label}>
                      {label}
                    </option>
                  ))}
                </PlayerSelect>
                <button
                  className="button button--secondary"
                  type="button"
                  onClick={() => void copyDiagnostic()}
                >
                  复制简要诊断
                </button>
              </div>
              <p role="status">{copyState}</p>
              <pre tabIndex={0} aria-label="简要诊断内容">
                {diagnosticText(stage)}
              </pre>
            </details>
          </div>
        </section>
      </div>
      <footer className="help-privacy__footer">
        <p>
          玩家制作的非官方工具，与《绝区零》官方无关联。维护者 Fizz-McBubble ·{' '}
          <a href="/third-party-notices.txt" target="_blank" rel="noopener noreferrer">
            第三方软件声明
          </a>
        </p>
        <p>所有功能免费，可在首页自愿支持。</p>
      </footer>
    </div>
  )
}
