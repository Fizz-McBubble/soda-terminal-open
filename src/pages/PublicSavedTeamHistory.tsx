import type { CoreWarehouse } from '../accounts/coreFlow'
import type { AccountPlanningDraft } from '../accounts/types'
import { getCandidateWEngineLabels } from '../application/publicCandidateLabels'
import { getAgentName } from '../application/publicRosterNames'
import { playerFacingBangbooLabel } from '../application/playerFacingLabels'
import { PublicSavedDiscList } from './PublicSavedDiscList'

/** Historical plan facts are displayed from local storage without inventing a current score. */
export function PublicSavedTeamHistory({
  plan,
  warehouse,
}: {
  plan: AccountPlanningDraft
  warehouse: CoreWarehouse
}) {
  const loadouts = (plan.candidateWarehouse?.loadouts ?? []).filter((loadout) =>
    plan.selection.agentIds.includes(loadout.agentId),
  )
  const assignedIds = new Set(loadouts.flatMap((loadout) => loadout.discIds))
  const unassignedRefs = plan.warehouseRefs.filter((id) => !assignedIds.has(id))
  return (
    <section className="team-execution is-build" aria-label="历史保存方案配装">
      <header className="team-execution__header">
        <p className="team-execution__state">历史记录</p>
        <h2>已保存的配装</h2>
        <p>按当前仓库资料展示已保存的成员与驱动盘；未重新匹配。</p>
        {plan.selection.bangbooId ? (
          <p>邦布：{playerFacingBangbooLabel(plan.selection.bangbooId)}</p>
        ) : null}
      </header>
      {plan.selection.agentIds.map((agentId) => {
        const discIds = [
          ...new Set(
            loadouts.filter((item) => item.agentId === agentId).flatMap((item) => item.discIds),
          ),
        ]
        return (
          <article className="team-execution__loadout" key={agentId}>
            <h3>{getAgentName(agentId)}</h3>
            {discIds.length ? (
              <PublicSavedDiscList
                discIds={discIds}
                warehouse={warehouse}
                label={`${getAgentName(agentId)}的已保存驱动盘`}
              />
            ) : (
              <p className="team-execution__disc-missing">
                这份方案未记录该成员使用哪些驱动盘，其他已保存内容仍保留。
              </p>
            )}
          </article>
        )
      })}
      {unassignedRefs.length ? (
        <article className="team-execution__loadout">
          <h3>未记录成员归属的已保存驱动盘</h3>
          <PublicSavedDiscList
            discIds={unassignedRefs}
            warehouse={warehouse}
            label="未记录成员归属的已保存驱动盘"
          />
        </article>
      ) : null}
      {plan.teamEquipmentParameters ? (
        <section className="team-execution__loadout" aria-label="保存的方案音擎">
          <h3>保存的方案音擎</h3>
          <ul>
            {plan.teamEquipmentParameters.wEngines.map((engine) => (
              <li key={engine.agentId}>
                {getAgentName(engine.agentId)} · {getCandidateWEngineLabels([engine.engineId])[0]} ·
                P{engine.refinement}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {!plan.warehouseRefs.length && !loadouts.some((loadout) => loadout.discIds.length) ? (
        <p className="team-execution__disc-missing" role="status">
          这份旧方案未记录具体驱动盘；仍可查看队伍成员，重新匹配后可补齐配装。
        </p>
      ) : null}
    </section>
  )
}
