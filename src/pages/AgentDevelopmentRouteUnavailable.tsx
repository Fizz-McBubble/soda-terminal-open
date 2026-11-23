import { BackNavigation } from '../components/BackNavigation'

export function AgentDevelopmentRouteUnavailable({ failed }: { failed: boolean }) {
  return (
    <section className="panel">
      <h1>{failed ? '暂时无法读取本次养成资料' : '当前养成建议暂时无法显示'}</h1>
      <p>请重新打开当前代理人。</p>
      <BackNavigation to="/development" />
    </section>
  )
}
