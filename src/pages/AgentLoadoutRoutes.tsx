import { useContext } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { CoreWarehouse } from '../accounts/coreFlow'
import {
  agentCatalog,
  getAgentName,
  getAgentSpecialtyLabel,
} from '../application/publicRosterNames'
import { VisualEntityImage } from '../components/VisualEntityImage'
import { pickerReleaseDataDependency, sortOwnedAgentsForPicker } from './teamPickerPresentation'
import { NoOwned } from './OptimizerFlowSupport'
import { PlanningProfileContext, usePlanningProfile } from './planningProfile'
import { InvalidPlan } from './InvalidPlan'
import { PlanEditor } from './PlanEditor'

export function AgentPicker({ warehouse }: { warehouse: CoreWarehouse }) {
  const navigate = useNavigate()
  const resolveProfile = useContext(PlanningProfileContext)
  const owned = sortOwnedAgentsForPicker(
    warehouse.roster.agents
      .filter((agent) => agent.owned)
      .map((agent) => {
        const item = agentCatalog.find(([id]) => id === agent.agentId)
        return {
          ...agent,
          rarity: item?.[4] ?? 'B',
          specialty: getAgentSpecialtyLabel(item?.[2]),
        }
      }),
  )
  if (!owned.length) return <NoOwned />
  return (
    <section className="optimizer-flow">
      <h1>选择代理人</h1>
      <p className="muted-note">仅显示当前账户已拥有角色。{pickerReleaseDataDependency}</p>
      <div className="owned-agent-picker" role="list" aria-label="已拥有代理人">
        {owned.map((agent) => {
          const profile = resolveProfile(agent.agentId)
          return (
            <div key={agent.agentId} role="listitem">
              <button
                type="button"
                onClick={() => navigate(`/loadouts/agent/${encodeURIComponent(agent.agentId)}`)}
              >
                <VisualEntityImage
                  entityType="agent"
                  entityId={agent.agentId}
                  name={getAgentName(agent.agentId)}
                />
                <strong>{getAgentName(agent.agentId)}</strong>
                <span>
                  {agent.specialty} · {agent.rarity}级 · 等级 {agent.level}
                </span>
                <small>
                  {profile.status === 'formal'
                    ? '可查看建议'
                    : profile.status === 'candidate'
                      ? '参考建议可生成仓库方案'
                      : '资料待补齐'}
                </small>
              </button>
            </div>
          )
        })}
      </div>
    </section>
  )
}

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
