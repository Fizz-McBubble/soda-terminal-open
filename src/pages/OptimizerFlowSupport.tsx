import { Link, Navigate, useLocation, useSearchParams } from 'react-router-dom'

export function LegacyOptimizerRouteRedirect() {
  const location = useLocation()
  const [legacyParams] = useSearchParams()
  const agentId = legacyParams.get('agent')
  return (
    <Navigate
      replace
      to={
        agentId
          ? `/loadouts/agent/${encodeURIComponent(agentId)}`
          : location.pathname === '/optimizer'
            ? '/loadouts/team'
            : `${location.pathname.replace(/^\/optimizer/, '/loadouts')}${location.search}`
      }
    />
  )
}

export function NoOwned() {
  return (
    <section className="panel result-empty">
      <h1>还没有已拥有角色</h1>
      <p>先在代理人资产标记拥有角色；不会读取旧表或生成虚构队伍。</p>
      <Link className="primary-action" to="/assets/agents">
        前往代理人资产
      </Link>
    </section>
  )
}

export function LegacyResultRedirect() {
  const location = useLocation()
  const [params] = useSearchParams()
  const team = location.pathname.includes('/team/')
  const id = params.get(team ? 'team' : 'agent')
  return (
    <Navigate
      replace
      to={
        id
          ? `/loadouts/${team ? 'team' : 'agent'}/${encodeURIComponent(id)}`
          : `/loadouts/${team ? 'team' : 'agent'}`
      }
    />
  )
}
