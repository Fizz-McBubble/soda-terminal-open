import { useParams } from 'react-router-dom'
import type { CoreWarehouse } from '../accounts/coreFlow'
import { usePlanningProfile } from './planningProfile'
import { InvalidPlan } from './InvalidPlan'
import { PlanEditor } from './PlanEditor'

export function AgentPlan({ warehouse }: { warehouse: CoreWarehouse }) {
  const { agentId = '' } = useParams()
  const profile = usePlanningProfile(agentId)
  const valid = warehouse.roster.agents.some((agent) => agent.owned && agent.agentId === agentId)
  if (!valid) return <InvalidPlan back="/loadouts/agent" label="角色" />
  return (
    <PlanEditor
      key={`${warehouse.accountId}:agent:${agentId}`}
      warehouse={warehouse}
      kind="agent"
      profiles={[profile]}
      back="/loadouts/agent"
    />
  )
}
