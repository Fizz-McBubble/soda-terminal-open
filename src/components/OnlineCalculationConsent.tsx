import { Link } from 'react-router-dom'
import { createPortal } from 'react-dom'
import './online-calculation-consent.css'

export function OnlineCalculationConsent({ onAllow }: { onAllow: () => void }) {
  return createPortal(
    <div className="online-calculation-consent-backdrop">
      <section
        className="online-calculation-consent"
        role="dialog"
        aria-modal="true"
        aria-label="在线计算说明"
      >
        <div>
          <strong>首次使用在线计算</strong>
          <p>
            计算会发送必要的代理人培养、音擎和驱动盘数值，以及用于关联结果的本地账户标识和方案盘引用。任务与结果只在服务端短期内存中保留。
            完整账户和方案仍保存在此浏览器；昵称、游戏 UID、备注、扫描截图和完整备份不会发送。
          </p>
          <Link to="/system/help#data">查看数据与隐私说明</Link>
        </div>
        <div className="online-calculation-consent__actions">
          <Link to="/">暂不使用，返回首页</Link>
          <button className="button button--primary" type="button" onClick={onAllow} autoFocus>
            了解并开始在线计算
          </button>
        </div>
      </section>
    </div>,
    document.body,
  )
}
