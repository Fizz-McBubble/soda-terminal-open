import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { PlayerSelect } from '../components/PlayerSelect'
import { readLastScanDiagnostic } from '../scanner/scanFeedback'
import { readAssetDiagnostic } from '../assetQuickRead/feedback'
import { AssetQuickReadFeedback } from './AssetQuickReadFeedback'
import { ScannerDiagnosticFeedback } from './ScannerDiagnosticFeedback'
import { ScannerGuide } from './ScannerGuide'
import { UsageStatisticsPreference } from '../usageStatistics/UsageStatistics'
import { useAppHealth } from '../appHealthContext'
import { getCalculationProcessingDisclosure } from '../application/calculationProcessingDisclosure'
import './help-and-privacy.css'

const configuredFeedbackUrl = import.meta.env.VITE_SODA_FEEDBACK_URL?.trim()
const defaultFeedbackUrl =
  'https://github.com/Fizz-McBubble/soda-terminal-feedback/issues/new/choose'
const feedbackUrl = configuredFeedbackUrl?.startsWith('https://')
  ? configuredFeedbackUrl
  : defaultFeedbackUrl
const releaseId = import.meta.env.VITE_SODA_RELEASE_ID || 'local-development'
const currentEntryUrl = window.location.origin
const diagnosticStages = (online: boolean) =>
  [
    ['startup', '页面启动'],
    ['calculation', online ? '在线计算' : '本机计算'],
    ['image', '图片加载'],
    ['scanner', '本机扫描连接'],
    ['backup', '备份导入或导出'],
  ] as const

function diagnosticText(stage: string, versions: string[]) {
  const retryHints: Record<string, string> = {
    页面启动: '重新加载页面；请保留浏览器中的账户资料，不要清除站点数据。',
    本机计算: '使用结果区域的重试或重新搭配按钮；尚未保存的编辑请先保留。',
    在线计算: '检查网络连接，使用结果区域的重试按钮；账户与已保存方案仍保留在本机。',
    图片加载: '在首页打开“管理图片”查看缓存状态。仍有缺图时，点击“补齐图片”。',
    本机扫描连接: '先启动画面扫描，允许本站连接本机，再点击重新连接。',
    备份导入或导出: '导出请检查浏览器下载列表；恢复失败时保留原文件并重新选择。',
  }
  return [
    `Soda Terminal 版本：${releaseId}`,
    ...versions,
    `错误阶段：${stage}`,
    `可重试提示：${retryHints[stage] ?? retryHints.页面启动}`,
  ].join('\n')
}

export function HelpAndPrivacyPage() {
  const disclosure = getCalculationProcessingDisclosure(
    import.meta.env.VITE_SODA_PUBLIC_BUILD === 'true',
  )
  const stages = diagnosticStages(disclosure.mode === 'online')
  const { currentVersion, dataStatus } = useAppHealth()
  const [stage, setStage] = useState<string>(stages[0][1])
  const [copyState, setCopyState] = useState<'idle' | 'copying' | 'success' | 'error'>('idle')
  const diagnosticRevision = useRef(0)
  const [lastScanDiagnostic] = useState(readLastScanDiagnostic)
  const [lastAssetDiagnostic] = useState(readAssetDiagnostic)
  const versions: string[] = []
  if (currentVersion?.gameVersion)
    versions.push(
      `游戏资料版本：${currentVersion.gameVersion}${dataStatus === 'error' ? '（加载失败）' : ''}`,
    )
  // These readers already validate the saved diagnostic schema. Copy only known version fields,
  // and label them as last observed rather than claiming the tools are currently connected.
  for (const [key, label] of [
    ['installer', '安装包'],
    ['helper', 'Helper'],
    ['scanner', '扫描核心'],
    ['protocol', '协议'],
  ] as const) {
    const version = lastScanDiagnostic?.versions[key]
    if (version) versions.push(`上次画面扫描${label}版本：${version}`)
  }
  if (lastAssetDiagnostic?.versions.bridge)
    versions.push(`上次资产快读 Bridge 版本：${lastAssetDiagnostic.versions.bridge}`)
  if (lastAssetDiagnostic?.versions.protocol)
    versions.push(`上次资产快读协议版本：${lastAssetDiagnostic.versions.protocol}`)
  const diagnostic = diagnosticText(stage, versions)

  async function copyDiagnostic() {
    const revision = diagnosticRevision.current
    setCopyState('copying')
    let copied: 'success' | 'error' = 'success'
    try {
      await navigator.clipboard.writeText(diagnostic)
    } catch {
      copied = 'error'
    }
    setCopyState(revision === diagnosticRevision.current ? copied : 'idle')
  }

  return (
    <div className="help-privacy">
      <header className="help-privacy__header">
        <div className="help-privacy__intro">
          <h1>帮助与隐私</h1>
          <p>资料保存在本机浏览器；扫描有账号风险；反馈与诊断由你决定是否发送。</p>
          <nav aria-label="帮助主题" className="help-privacy__topics">
            <a href="#data">资料保存</a>
            <a href="#help-scanner">扫描与风险</a>
            <a href="#help-contact">问题与反馈</a>
          </nav>
        </div>
        <Link className="button button--secondary help-privacy__back" to="/">
          返回首页
        </Link>
      </header>
      <div className="help-privacy__sections">
        <section
          id="data"
          className="help-privacy__section"
          aria-labelledby="help-data-heading"
          tabIndex={-1}
        >
          <header className="help-privacy__section-heading">
            <h2 id="help-data-heading">资料保存与备份</h2>
          </header>
          <div className="help-privacy__content">
            <div className="help-privacy__action-card help-privacy__action-card--data">
              <div>
                <span className="help-privacy__eyebrow">建议先做</span>
                <strong>更换浏览器或网址前，先导出备份</strong>
                <p>清除站点数据或切换浏览器前，请先导出备份并妥善保管；恢复时须选择文件并确认。</p>
              </div>
              <div className="help-privacy__actions">
                <Link className="button button--primary" to="/assets/account">
                  我的资产 · 账户
                </Link>
                <Link className="button button--secondary" to="/assets/account#restore-backup">
                  恢复已有备份
                </Link>
              </div>
            </div>
            <dl className="help-privacy__facts">
              <div>
                <dt>保存位置</dt>
                <dd>{disclosure.storage}</dd>
              </div>
              <div>
                <dt>{disclosure.mode === 'online' ? '在线计算' : '本机计算'}</dt>
                <dd>{disclosure.processing}</dd>
              </div>
              {disclosure.retention ? (
                <div>
                  <dt>服务端保留</dt>
                  <dd>{disclosure.retention}</dd>
                </div>
              ) : null}
              <div>
                <dt>访问地址</dt>
                <dd>
                  当前为 <a href={currentEntryUrl}>{currentEntryUrl}</a>。浏览器按网址分别保存资料，
                  更换地址不会自动迁移；若旧地址仍能打开，请先在那里导出备份。
                </dd>
              </div>
            </dl>
            <p className="help-privacy__inline-warning">
              旧地址无法打开时，请保留原浏览器的站点数据，避免清除后失去恢复机会。
            </p>
            <UsageStatisticsPreference />
          </div>
        </section>
        <section
          id="help-scanner"
          className="help-privacy__section"
          aria-labelledby="help-scanner-heading"
          tabIndex={-1}
        >
          <header className="help-privacy__section-heading">
            <h2 id="help-scanner-heading">扫描与风险</h2>
          </header>
          <div className="help-privacy__content">
            <div className="help-privacy__risk-card" role="note">
              <span className="help-privacy__eyebrow">账号风险</span>
              <strong>两种采集方式都使用非官方工具</strong>
              <p>存在账号处罚风险，且没有官方书面授权。</p>
            </div>
            <div className="help-privacy__methods" aria-label="扫描方式">
              <article>
                <strong>画面扫描</strong>
                <p>支持本机和云游戏，只扫描 S 级驱动盘。</p>
              </article>
              <article>
                <strong>资产快读</strong>
                <p>在本机游戏登录时读取代理人养成、已装备的音擎和驱动盘，以及盘库。</p>
              </article>
            </div>
            <div className="help-privacy__import-card">
              <div className="help-privacy__import-copy">
                <strong>结果先检查，再由你确认导入</strong>
                <p>
                  先选择要更新的 Soda
                  账户，核对结果后再确认导入。需要回退时，打开“导入记录”查看可撤销的上次导入。
                </p>
              </div>
              <ScannerGuide />
            </div>
            {lastScanDiagnostic || lastAssetDiagnostic ? (
              <section className="help-privacy__diagnostics" aria-label="最近诊断">
                <header>
                  <strong>最近记录</strong>
                  <span>发送目标：Cloudflare；安全诊断保留 30 天。</span>
                </header>
                {lastScanDiagnostic ? (
                  <ScannerDiagnosticFeedback report={lastScanDiagnostic} />
                ) : null}
                {lastAssetDiagnostic ? (
                  <AssetQuickReadFeedback report={lastAssetDiagnostic} previous />
                ) : null}
              </section>
            ) : null}
          </div>
        </section>
        <section
          id="help-contact"
          className="help-privacy__section"
          aria-labelledby="help-contact-heading"
          tabIndex={-1}
        >
          <header className="help-privacy__section-heading">
            <h2 id="help-contact-heading">问题与反馈</h2>
          </header>
          <div className="help-privacy__content">
            <div className="help-privacy__action-card help-privacy__action-card--feedback">
              <div>
                <span className="help-privacy__eyebrow">公开反馈</span>
                <strong>描述现象、你做了什么，以及希望得到的结果</strong>
                <p>
                  GitHub 公开讨论，提交前请检查内容；请勿公开上传账户备份、游戏 UID 或扫描截图。
                </p>
              </div>
              <div className="help-privacy__actions">
                <a
                  className="button button--primary"
                  href={feedbackUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  问题与建议反馈
                </a>
              </div>
            </div>
            <details
              className="help-privacy__diagnostic"
              aria-describedby="help-privacy-diagnostic-guidance"
            >
              <summary>简要诊断</summary>
              <p id="help-privacy-diagnostic-guidance">
                仅包含版本、所选阶段和重试提示，不读取账户，也不自动发送。
              </p>
              <div className="help-privacy__diagnostic-controls">
                <label htmlFor="feedback-stage">错误阶段</label>
                <PlayerSelect
                  id="feedback-stage"
                  aria-label="错误阶段"
                  className="help-privacy__stage"
                  value={stage}
                  onChange={(value) => {
                    if (value === stage) return
                    diagnosticRevision.current++
                    setStage(value)
                    setCopyState((current) => (current === 'copying' ? current : 'idle'))
                  }}
                >
                  {stages.map(([code, label]) => (
                    <option key={code} value={label}>
                      {label}
                    </option>
                  ))}
                </PlayerSelect>
                <button
                  className="button button--primary"
                  type="button"
                  disabled={copyState === 'copying'}
                  onClick={() => void copyDiagnostic()}
                >
                  {copyState === 'copying' ? '正在复制…' : '复制简要诊断'}
                </button>
              </div>
              {copyState !== 'idle' && copyState !== 'copying' ? (
                <p
                  className="help-privacy__copy-feedback"
                  data-state={copyState}
                  role="status"
                  aria-live="polite"
                >
                  {copyState === 'success'
                    ? '已复制，请检查后自行粘贴到反馈页面。'
                    : '复制未完成，请手动选择下方文字。'}
                </p>
              ) : null}
              <pre tabIndex={0} aria-label="简要诊断内容">
                {diagnostic}
              </pre>
            </details>
          </div>
        </section>
      </div>
      <footer className="help-privacy__footer">
        <p>
          玩家制作项目，与《绝区零》官方无关联。维护者 Fizz-McBubble ·{' '}
          <a href="/third-party-notices.txt" target="_blank" rel="noopener noreferrer">
            第三方软件声明
          </a>
        </p>
        <p>所有功能免费，可在首页自愿支持。</p>
      </footer>
    </div>
  )
}
