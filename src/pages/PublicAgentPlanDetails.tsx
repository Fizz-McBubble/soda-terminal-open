import type { CoreWarehouse } from '../accounts/coreFlow'
import type { PlanningDraftInput } from '../accounts/planningDrafts'
import { publicAssetDiscSetById } from '../application/publicAssetCatalog'
import { getCandidateStatLabels } from '../application/publicCandidateLabels'
import type { CandidateWarehousePlan } from '../optimizer/candidateWarehouseSolver'
import type { PlanningProfile } from './planningProfile'

export function PublicAgentPlanDetails({
  profile,
  plan,
  warehouse,
  draft,
  onNameChange,
  onOverrideChange,
}: {
  profile: PlanningProfile
  plan?: CandidateWarehousePlan
  warehouse: CoreWarehouse
  draft: Pick<PlanningDraftInput, 'name' | 'manualOverrides'>
  onNameChange: (name: string) => void
  onOverrideChange: (key: keyof PlanningDraftInput['manualOverrides'], value: string) => void
}) {
  const loadout = plan?.loadouts.find((item) => item.agentId === profile.agentId)
  return (
    <>
      {plan ? (
        <section className="panel candidate-warehouse-result" aria-label="仓库参考匹配方案">
          <h2>实际仓库参考方案</h2>
          <p>这套配装用于比较方向；保存前不会更换角色装备。</p>
          {loadout ? (
            <>
              <p>
                仓库适配分 <strong>{loadout.totalScore.toFixed(2)}</strong>
              </p>
              <ol className="candidate-disc-list" aria-label={`${profile.agentName}的六张驱动盘`}>
                {loadout.discs.map((choice) => (
                  <li key={choice.disc.id}>
                    <strong>{choice.disc.slot}号位</strong> ·{' '}
                    {publicAssetDiscSetById.get(choice.disc.setId)?.playerName ?? '套装资料待补齐'}{' '}
                    · {getCandidateStatLabels([choice.disc.mainStat], '主词条')[0]} · +
                    {choice.disc.level}
                  </li>
                ))}
              </ol>
              {loadout.degradeReasons.length ? (
                <p>匹配取舍：{loadout.degradeReasons.join('；')}</p>
              ) : null}
            </>
          ) : (
            <p>当前仓库暂不能组成完整参考方案。</p>
          )}
          {plan.gaps.length ? <p>库存提示：{plan.gaps.join('；')}</p> : null}
        </section>
      ) : null}
      <section className="panel" aria-label="方案条件与调整">
        <h2>{profile.agentName} · 方案条件</h2>
        <p>{warehouse.discs.length} 张驱动盘在当前仓库；记录下方条件不会修改游戏内装备。</p>
        <label>
          方案名称
          <input value={draft.name} onChange={(event) => onNameChange(event.target.value)} />
        </label>
        <label>
          音擎方向
          <input
            value={draft.manualOverrides.wEngineDirection}
            onChange={(event) => onOverrideChange('wEngineDirection', event.target.value)}
          />
        </label>
        <label>
          驱动盘与词条方向
          <textarea
            value={draft.manualOverrides.discDirection}
            onChange={(event) => onOverrideChange('discDirection', event.target.value)}
          />
        </label>
        <label>
          养成方向
          <input
            value={draft.manualOverrides.progressionDirection}
            onChange={(event) => onOverrideChange('progressionDirection', event.target.value)}
          />
        </label>
        <label>
          方案备注
          <textarea
            value={draft.manualOverrides.notes}
            onChange={(event) => onOverrideChange('notes', event.target.value)}
          />
        </label>
      </section>
    </>
  )
}
