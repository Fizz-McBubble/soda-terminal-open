import { AlertTriangle, Database, ScanLine } from 'lucide-react'
import { ExplanationPopover } from '../components/ExplanationPopover'
import './AssetCaptureMethodsNotice.css'

const officialTermsUrl =
  'https://fastcdn.mihoyo.com/static-resource-v2/2025/12/30/f91a0c8796a63ce69bb054d096371593_7574548664798296571.pdf'

export function AssetCaptureRiskNotice() {
  return (
    <aside id="scanner-risk-notice" className="asset-capture-risk" aria-label="非官方工具风险提示">
      <AlertTriangle size={20} aria-hidden="true" />
      <p>
        <strong>账号风险</strong>两种方式均为非官方工具，存在账号处罚风险，无法保证账号安全。
      </p>
      <AssetCaptureRiskDetails />
      <a href={officialTermsUrl} target="_blank" rel="noopener noreferrer">
        游戏协议
      </a>
    </aside>
  )
}

export function AssetCaptureRiskDetails({ label = '风险说明' }: { label?: string }) {
  return (
    <ExplanationPopover
      label={label}
      title="权限与数据说明"
      className="asset-capture-risk-details"
      align="end"
    >
      <ul>
        <li>两种方式均未取得官方书面授权，没有依据比较封号概率。</li>
        <li>
          启动均需管理员权限。资产快读另需 WinDivert
          网络驱动，配置查询需联网；停止读取不会自动卸载驱动。
        </li>
        <li>资产在本机处理，不读取账号密码，不上传或保存原始流量、密钥。</li>
      </ul>
    </ExplanationPopover>
  )
}

/** Only facts that help choose a method belong here; operational steps stay in its guide. */
export function AssetCaptureMethodsNotice() {
  return (
    <section
      id="scanner-capture-methods"
      className="asset-capture-methods"
      aria-label="采集方式与风险说明"
      tabIndex={-1}
    >
      <div className="asset-capture-methods__grid">
        <article className="asset-capture-methods__card" aria-label="画面扫描说明">
          <h3>
            <ScanLine size={21} aria-hidden="true" />
            画面扫描
          </h3>
          <h4>读取范围</h4>
          <p>S 级驱动盘。</p>
          <h4>导入后</h4>
          <p>更新驱动盘仓库。代理人养成与音擎沿用你在资产中填写的信息，再自行搭配配装。</p>
          <h4>使用条件与限制</h4>
          <ul>
            <li>
              支持本机游戏和<strong className="asset-capture-methods__advantage">云·绝区零</strong>
              ，<strong className="asset-capture-methods__advantage">无需重新登录</strong>。
            </li>
            <li>自动点击和翻页，需保持画面可见，期间不能同时操作游戏。</li>
            <li>文字识别可能出错，结果可检查修正；盘越多，等待越久。</li>
          </ul>
        </article>
        <article className="asset-capture-methods__card" aria-label="资产快读说明">
          <h3>
            <Database size={21} aria-hidden="true" />
            资产快读
            <small className="f5v-beta" aria-label="测试版">
              Beta
            </small>
          </h3>
          <h4>读取范围</h4>
          <p>
            S 级驱动盘、<strong className="asset-capture-methods__advantage">代理人养成</strong>
            ，以及
            <strong className="asset-capture-methods__advantage">当前装备的驱动盘和音擎</strong>。
          </p>
          <h4>导入后</h4>
          <p>
            同步本次读到的养成与配装，进入养成页即可从当前装备出发，对比换装后的面板和近似输出。
          </p>
          <h4>使用条件与限制</h4>
          <ul>
            <li>仅支持本机游戏，需要重新登录。</li>
            <li>
              <strong className="asset-capture-methods__advantage">不操作鼠标</strong>，
              <strong className="asset-capture-methods__advantage">
                无需逐个翻阅代理人和驱动盘
              </strong>
              。
            </li>
            <li>未读到的潜能保留原值；游戏更新后可能需等待适配。</li>
          </ul>
        </article>
      </div>
    </section>
  )
}
