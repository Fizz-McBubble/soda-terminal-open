import { Link } from 'react-router-dom'
import { BackNavigation } from '../components/BackNavigation'

export function SavedAgentPlanRouteError({
  status,
  agentId,
}: {
  status: 'missing' | 'references_changed'
  agentId: string
}) {
  if (status === 'missing')
    return (
      <section className="panel">
        <h1>找不到已保存方案</h1>
        <p>该方案不属于当前代理人，或已不在这个账户中。</p>
        <BackNavigation label="返回养成" to="/development" />
      </section>
    )
  return (
    <section className="panel">
      <h1>方案中的部分驱动盘已找不到</h1>
      <p>这份方案已不完整，请重新搭配后保存。</p>
      <div className="button-row">
        <BackNavigation label="返回养成" to="/development" />
        <Link className="button button--primary" to={`/development/${agentId}`}>
          重新搭配
        </Link>
      </div>
    </section>
  )
}
