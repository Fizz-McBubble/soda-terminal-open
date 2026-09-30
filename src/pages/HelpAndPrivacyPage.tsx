import { useState } from 'react'
import { Link } from 'react-router-dom'
import './help-and-privacy.css'

const onlineMode = import.meta.env.VITE_SODA_PUBLIC_BUILD === 'true'
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
      setCopyState('诊断已复制。请检查内容后自行粘贴到反馈页面。')
    } catch {
      setCopyState('复制失败。请手动选择下方文字。')
    }
  }

  return (
    <div className="help-privacy">
      <header className="help-privacy__header">
        <h1>帮助与隐私</h1>
        <p>了解资料存放位置，以及扫描和计算如何运行。</p>
        <p>Soda Terminal 是玩家制作的非官方工具，与《绝区零》官方无关联。</p>
      </header>

      <div className="help-privacy__sections">
        <section aria-labelledby="help-contact-heading">
          <h2 id="help-contact-heading">关于与反馈</h2>
          <p>Soda Terminal · 维护者 Fizz-McBubble</p>
          <p>
            <a href="/third-party-notices.txt" target="_blank" rel="noopener noreferrer">
              第三方软件声明
            </a>
          </p>
          <p>
            <a href={feedbackUrl} target="_blank" rel="noopener noreferrer">
              问题与建议反馈
            </a>
            ：请勿公开上传账户备份、游戏 UID 或扫描截图。
          </p>
          <p>
            反馈前可复制以下简要诊断。它只包含版本、你选择的错误阶段和重试提示；不会读取账户或自动发送资料。
          </p>
          <label htmlFor="feedback-stage">错误阶段</label>{' '}
          <select
            id="feedback-stage"
            value={stage}
            onChange={(event) => setStage(event.target.value)}
          >
            {diagnosticStages.map(([code, label]) => (
              <option key={code} value={label}>
                {label}
              </option>
            ))}
          </select>{' '}
          <button type="button" onClick={() => void copyDiagnostic()}>
            复制简要诊断
          </button>
          <p role="status">{copyState}</p>
          <pre>{diagnosticText(stage)}</pre>
        </section>
        <section id="data" aria-labelledby="help-data-heading">
          <h2 id="help-data-heading">资料保存与计算</h2>
          <p>
            账户、资产、标记和已保存方案存于当前浏览器。你可以在
            <Link to="/assets/account">我的资产 · 账户</Link>
            导出备份、恢复已有备份或删除本地账户。首次打开本站时，如需继续使用旧资料，请先从该页选择备份文件并确认恢复；清除站点数据或更换浏览器前，请先导出备份并妥善保管。
          </p>
          <p>
            {onlineMode
              ? '允许在线计算后，会发送本次所需的代理人、音擎、驱动盘数值，以及用于关联结果的本地账户标识和方案盘引用；不提供云存档。昵称、游戏 UID、备注、扫描截图和完整备份不会发送。'
              : '当前版本在本机计算，不向公网发送账户或资产资料。'}
          </p>
          {onlineMode && (
            <p>
              在线计算服务由 Railway
              美国西部节点托管，只在内存中短暂保留临时会话、任务和结果。任务和结果约 5
              分钟后清除，服务每 30
              秒检查过期数据；不会保存为云端账户。服务按网络地址限制会话创建频率。
            </p>
          )}
        </section>
        <section aria-labelledby="help-scanner-heading">
          <h2 id="help-scanner-heading">本机扫描</h2>
          <p>
            Soda Terminal 扫描助手由 Soda
            开发和维护，负责本机扫描、识别结果审阅与账户导入。扫描执行组件包含对 ZZZ-Scanner.Next
            的适配与修改，相关第三方信息见安装包内声明。
          </p>
          <p>
            Windows
            扫描助手只通过本机回环地址连接，读取可见的游戏画面。扫描结果须经你检查并确认导入，才会更新
            Soda 账户。
          </p>
        </section>
        <section aria-labelledby="help-support-heading">
          <h2 id="help-support-heading">自愿支持</h2>
          <p>
            首页可选择支付宝或微信，以及随心支持或固定金额。选定金额后会显示对应收款码。本站不创建订单、不读取支付结果，也不保存支付记录。所有功能免费。
          </p>
        </section>
      </div>
      <Link className="button button--quiet help-privacy__back" to="/">
        返回首页
      </Link>
    </div>
  )
}
