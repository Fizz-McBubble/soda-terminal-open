import { useId } from 'react'
import { AlertTriangle, Database, ScanLine } from 'lucide-react'
import './AssetCaptureMethodsNotice.css'

const officialTermsUrl =
  'https://fastcdn.mihoyo.com/static-resource-v2/2025/12/30/f91a0c8796a63ce69bb054d096371593_7574548664798296571.pdf'

/** Readable information only. Starting either method remains with its existing explicit entry. */
export function AssetCaptureRiskNotice({ detailHref }: { detailHref: string }) {
  return (
    <p className="asset-capture-risk" role="note">
      <AlertTriangle size={16} aria-hidden="true" />
      <span>两种采集方式均非官方，存在账号处罚的不确定性，无法比较封号概率。</span>
      <a href={detailHref}>方式与风险</a>
      <a href={officialTermsUrl} target="_blank" rel="noopener noreferrer">
        游戏协议
      </a>
    </p>
  )
}

export function AssetCaptureMethodsNotice({
  id,
  showCommon = true,
}: { id?: string; showCommon?: boolean } = {}) {
  const headingId = useId()
  const scanningId = useId()
  const quickReadId = useId()

  return (
    <section id={id} className="asset-capture-methods" aria-labelledby={headingId}>
      <h2 id={headingId}>采集方式与风险说明</h2>
      {showCommon && (
        <div className="asset-capture-methods__common">
          <AlertTriangle aria-hidden="true" size={21} />
          <div>
            <p>
              画面扫描和资产快读均为非官方第三方采集方式，未取得米哈游对这些方式的书面授权。
              两者都存在官方规则与账号处罚的不确定性，不能保证账号安全，也没有依据比较两者的封号概率。
            </p>
            <a href={officialTermsUrl} target="_blank" rel="noopener noreferrer">
              阅读《绝区零》游戏使用许可及服务协议（PDF，新窗口）
            </a>
          </div>
        </div>
      )}

      <div className="asset-capture-methods__grid">
        <article className="asset-capture-methods__card" aria-labelledby={scanningId}>
          <h3 id={scanningId}>
            <ScanLine aria-hidden="true" size={21} />
            画面扫描
          </h3>
          <p className="asset-capture-methods__summary">现有成熟入口，主要读取 S 级驱动盘。</p>
          <h4>适合与优势</h4>
          <ul>
            <li>可从游戏盘库开始，无需重新登录。</li>
            <li>自动点击、滚动后，在本地识别游戏画面中的文字（OCR）。</li>
            <li>不额外安装网络捕获驱动，不解析游戏通信。</li>
          </ul>
          <h4>要求与局限</h4>
          <ul>
            <li>实际启动会请求管理员权限，需要游戏窗口和画面保持稳定。</li>
            <li>只负责 S 级驱动盘，不读取代理人养成或完整资产。</li>
            <li>OCR 可能误识别或漏读；窗口变化也可能影响自动鼠标操作。</li>
          </ul>
        </article>

        <article className="asset-capture-methods__card" aria-labelledby={quickReadId}>
          <h3 id={quickReadId}>
            <Database aria-hidden="true" size={21} />
            资产快读（实验）
          </h3>
          <p className="asset-capture-methods__summary">通过正常的新启动登录，接收游戏通信副本。</p>
          <h4>适合与优势</h4>
          <ul>
            <li>不自动点击游戏，减少文字识别和鼠标操作环节。</li>
            <li>读取结构化的代理人养成、S 级驱动盘与当前装备；不建立音擎或邦布库存。</li>
            <li>
              当前本机国服 3.2 已两次取得数据，关键数值核对通过；不代表支持其他版本或覆盖所有资产。
            </li>
          </ul>
          <h4>要求与局限</h4>
          <ul>
            <li>
              需要独立组件、管理员权限及 WinDivert
              网络驱动，并依赖游戏版本与协议适配；配置查询需要联网。
            </li>
            <li>
              须先完成游戏更新及首次着色器编译，再完全退出客户端。工具实际就绪后，才完整启动并登录。
            </li>
            <li>最长等待 3 分钟，所需数据齐全后立即反馈，不必等满 3 分钟。</li>
          </ul>
        </article>
      </div>

      <p className="asset-capture-methods__handling">
        两种方式均在本地处理数据，导入前请核对目标账户与内容。不提供游戏内强化、装备或拆解操作，
        不读取账号密码，不上传或保存原始流量、密钥。请按采集范围和技术要求选择，采集结果仍需由你核对。
      </p>
    </section>
  )
}
