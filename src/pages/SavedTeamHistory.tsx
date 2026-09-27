import type { AccountPlanningDraft } from '../accounts/types'
import type { CoreWarehouse } from '../accounts/coreFlow'
import { getAgentName } from '../application/publicRosterNames'
import { currentWEngineDirectory } from '../assault/planningCatalog'
import { playerFacingBangbooLabel } from '../application/playerFacingLabels'
import { VisualEntityImage } from '../components/VisualEntityImage'
import { displayDriveDiscSet, presentDiscFactFromChoice } from './discFactPresentation'
import { savedPlanHistoricalDiscRefs } from './teamLoadoutSavedPlanProjection'
import { TeamExecutionDiscCard } from './teamExecutionWorkspaceParts'
import {
  displayDiscMainValue,
  formatDiscStatValue,
  type TeamExecutionDiscPresentation,
} from './teamExecutionPresentation'

function historicalDiscCard(disc: CoreWarehouse['discs'][number]): TeamExecutionDiscPresentation {
  return {
    ...presentDiscFactFromChoice({
      agentId: 'agent-history',
      choice: null,
      disc,
      set: displayDriveDiscSet(disc.setId),
      mainValue: displayDiscMainValue(disc),
      formatSubStatValue: (stat, value) => formatDiscStatValue(stat, value, '+'),
    }),
    effective: '保存记录',
    state: 'recorded',
  }
}

function HistoricalDiscList({
  discIds,
  warehouse,
  label,
}: {
  discIds: readonly string[]
  warehouse: CoreWarehouse
  label: string
}) {
  const discsById = new Map(warehouse.discs.map((disc) => [disc.id, disc]))
  const present = discIds.flatMap((discId) => {
    const disc = discsById.get(discId)
    return disc ? [historicalDiscCard(disc)] : []
  })
  const missingCount = discIds.length - present.length
  return (
    <>
      {present.length ? (
        <ol className="team-execution__disc-slots" aria-label={label}>
          {present.map((disc) => (
            <TeamExecutionDiscCard disc={disc} key={disc.id} />
          ))}
        </ol>
      ) : null}
      {missingCount ? (
        <p className="team-execution__disc-missing" role="status">
          有 {missingCount} 张已保存的驱动盘当前不在仓库；原记录已保留，未自动缩减或替换。
        </p>
      ) : null}
    </>
  )
}

/**
 * Read-only fallback for legacy saved team rows that predate an execution snapshot. It deliberately
 * renders only persisted member-to-disc links and current warehouse facts: it does not reconstruct
 * equipment parameters, actions, scores, or a current Authority result.
 */
export function SavedTeamHistory({
  plan,
  warehouse,
}: {
  plan: AccountPlanningDraft
  warehouse: CoreWarehouse
}) {
  const allRefs = savedPlanHistoricalDiscRefs(plan)
  const loadouts = plan.candidateWarehouse?.loadouts ?? []
  const selectedLoadouts = loadouts.filter((loadout) =>
    plan.selection.agentIds.includes(loadout.agentId),
  )
  const assignedIds = new Set(selectedLoadouts.flatMap((loadout) => loadout.discIds))
  const unassignedRefs = allRefs.filter((discId) => !assignedIds.has(discId))
  return (
    <section className="team-execution is-build" aria-label="历史保存方案配装">
      <header className="team-execution__header">
        <p className="team-execution__state">历史记录</p>
        <h2>已保存的配装</h2>
        <p>按当前仓库资料展示已保存的成员与驱动盘；未重新匹配。</p>
        {plan.selection.bangbooId ? (
          <p>
            <VisualEntityImage
              className="team-execution__bangboo-visual"
              consumer="box.team-workspace"
              entityId={plan.selection.bangbooId}
              entityType="bangboo"
              name={playerFacingBangbooLabel(plan.selection.bangbooId)}
              slotId="bangboo.team-icon"
            />
            邦布：{playerFacingBangbooLabel(plan.selection.bangbooId)}
          </p>
        ) : null}
      </header>
      {plan.selection.agentIds.map((agentId) => {
        const discIds = [
          ...new Set(
            selectedLoadouts
              .filter((loadout) => loadout.agentId === agentId)
              .flatMap((loadout) => loadout.discIds),
          ),
        ]
        return (
          <article className="team-execution__loadout" key={agentId}>
            <h3>{getAgentName(agentId)}</h3>
            {discIds.length ? (
              <HistoricalDiscList
                discIds={discIds}
                label={`${getAgentName(agentId)}的已保存驱动盘`}
                warehouse={warehouse}
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
          <HistoricalDiscList
            discIds={unassignedRefs}
            label="未记录成员归属的已保存驱动盘"
            warehouse={warehouse}
          />
        </article>
      ) : null}
      {plan.teamEquipmentParameters ? (
        <section className="team-execution__loadout" aria-label="保存的方案音擎">
          <h3>保存的方案音擎</h3>
          <ul>
            {plan.teamEquipmentParameters.wEngines.map((engine) => (
              <li key={engine.agentId}>
                {getAgentName(engine.agentId)} ·{' '}
                {currentWEngineDirectory.find((item) => item.id === engine.engineId)?.name ??
                  '音擎资料待补'}{' '}
                · P{engine.refinement}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {!allRefs.length ? (
        <p className="team-execution__disc-missing" role="status">
          这份旧方案未记录具体驱动盘；仍可查看队伍成员，重新匹配后可补齐配装。
        </p>
      ) : null}
    </section>
  )
}
