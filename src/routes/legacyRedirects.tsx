import { Navigate, useLocation, useParams } from 'react-router-dom'

function withQuery(pathname: string, search: string, extra?: Record<string, string>) {
  const params = new URLSearchParams(search)
  Object.entries(extra ?? {}).forEach(([key, value]) => params.set(key, value))
  const query = params.toString()
  return `${pathname}${query ? `?${query}` : ''}`
}

export function LegacyOptimizerRootRedirect() {
  const location = useLocation()
  return <Navigate replace to={withQuery('/loadouts/team', location.search)} />
}

export function LegacyOptimizerTeamRedirect() {
  const location = useLocation()
  const { teamKey } = useParams()
  const target = location.pathname.endsWith('/result')
    ? '/loadouts/team/result'
    : teamKey
      ? `/loadouts/team/${encodeURIComponent(teamKey)}`
      : '/loadouts/team'
  return <Navigate replace to={withQuery(target, location.search)} />
}

export function LegacyOptimizerAgentRedirect() {
  const location = useLocation()
  const { agentId } = useParams()
  const params = new URLSearchParams(location.search)
  const selectedAgent = agentId ?? params.get('agent')
  const target = location.pathname.endsWith('/result')
    ? '/loadouts/agent/result'
    : selectedAgent
      ? `/loadouts/agent/${encodeURIComponent(selectedAgent)}`
      : '/development'
  params.delete('agent')
  return <Navigate replace to={withQuery(target, params.toString())} />
}

export function LegacyOptimizerCompareRedirect() {
  const location = useLocation()
  const scope = new URLSearchParams(location.search).get('scope')
  return <Navigate replace to={scope === 'agent' ? '/development' : '/loadouts/team'} />
}

export function LegacyOptimizerPlanRedirect() {
  const location = useLocation()
  const { planId } = useParams()
  return (
    <Navigate
      replace
      to={withQuery(`/loadouts/plans/${encodeURIComponent(planId ?? '')}`, location.search)}
    />
  )
}

export function LegacyAgentsRedirect() {
  const location = useLocation()
  const { agentId } = useParams()
  const target = agentId ? `/development/${encodeURIComponent(agentId)}` : '/development'
  return <Navigate replace to={withQuery(target, location.search)} />
}

export function LegacyRosterRedirect() {
  const location = useLocation()
  return <Navigate replace to={withQuery('/assets/agents', location.search)} />
}

export function LegacyDataCenterRedirect() {
  const location = useLocation()
  return <Navigate replace to={withQuery('/assets/account', location.search)} />
}

export function LegacyDiscWorkbenchRedirect() {
  const location = useLocation()
  return (
    <Navigate
      replace
      to={withQuery('/assets/discs', location.search, {
        action: 'add',
      })}
    />
  )
}

export function LegacyTemplateRedirect() {
  const location = useLocation()
  return (
    <Navigate
      replace
      to={withQuery('/assets/discs', location.search, {
        panel: 'rules',
      })}
    />
  )
}

export function LegacyAssaultRedirect() {
  const location = useLocation()
  return (
    <Navigate
      replace
      to={withQuery('/loadouts/team', location.search, {
        scenario: 'assault',
      })}
    />
  )
}

export function LegacyBuildAdviceRedirect() {
  const location = useLocation()
  const params = new URLSearchParams(location.search)
  const agentId = params.get('agent')
  if (!agentId) return <Navigate replace to="/development" />
  params.delete('agent')
  params.set('panel', 'knowledge')
  return (
    <Navigate
      replace
      to={withQuery(`/development/${encodeURIComponent(agentId)}`, params.toString())}
    />
  )
}

/**
 * C1 keeps the real-account journey inside the F5 surface. Detailed disc
 * editing remains preserved in source, but is not a production destination
 * until its dedicated retrofit closes.
 */
export function LegacyAssetDiscDetailRedirect() {
  const location = useLocation()
  const { discId } = useParams()
  return (
    <Navigate
      replace
      to={withQuery('/assets/discs', location.search, discId ? { selected: discId } : undefined)}
    />
  )
}

/** Routes still rendered by the pre-C4 optimizer are held at the F5 overview. */
export function LegacyLoadoutJourneyRedirect() {
  const location = useLocation()
  const { agentId, teamKey, planId } = useParams()
  const params = new URLSearchParams(location.search)
  if (agentId && agentId !== 'result') params.set('agent', agentId)
  if (teamKey && teamKey !== 'result') params.set('team', teamKey)
  if (planId) params.set('plan', planId)
  return <Navigate replace to={withQuery('/loadouts/team', params.toString())} />
}
