import { type CoreWarehouse } from '../accounts/coreFlow'
import { CandidateWarehouseResult } from './CandidateWarehouseResult'
import { FormalDamageGateNotice } from './PlanningSupportParts'
import { type PlanningProfile } from './planningProfile'
import {
  CandidateReferenceDirection,
  MissingDirection,
  PlayerAssetSummary,
} from './AgentPlanReferenceParts'
import type { ComponentProps } from 'react'
import type { PlanningDraftInput } from '../accounts/planningDrafts'

export function AgentPlanDetails({
  generated,
  kind,
  activeProfiles,
  candidatePlans,
  activeCandidatePlanIndex,
  setCandidatePlanIndex,
  warehouse,
  candidate,
  draft,
  onNameChange,
  update,
}: {
  generated: boolean
  kind: 'agent' | 'team'
  activeProfiles: PlanningProfile[]
  candidatePlans: ComponentProps<typeof CandidateWarehouseResult>['plans']
  activeCandidatePlanIndex: number
  setCandidatePlanIndex: (index: number) => void
  warehouse: CoreWarehouse
  candidate: boolean
  draft: Pick<PlanningDraftInput, 'name' | 'manualOverrides'>
  onNameChange: (name: string) => void
  update: (key: keyof PlanningDraftInput['manualOverrides'], value: string) => void
}) {
  return (
    <>
      {generated && kind === 'agent' ? (
        <CandidateWarehouseResult
          plans={candidatePlans}
          activeIndex={activeCandidatePlanIndex}
          onSelect={setCandidatePlanIndex}
        />
      ) : null}
      {generated && kind === 'agent' ? <FormalDamageGateNotice /> : null}
      {kind !== 'team' && activeProfiles[0]!.status === 'missing' ? (
        <MissingDirection profile={activeProfiles[0]!} />
      ) : kind !== 'team' ? (
        <CandidateReferenceDirection profile={activeProfiles[0]!} />
      ) : null}
      {kind === 'agent' ? (
        <PlayerAssetSummary warehouse={warehouse} agentId={activeProfiles[0]!.agentId} />
      ) : null}
      {kind !== 'team' ? (
        <details className="optimizer-confidence optimizer-confidence--details">
          <summary>{candidate ? '查看建议依据' : '查看适用条件'}</summary>
          <p>
            {candidate
              ? '可比较实际仓库方案方向，不代表精确伤害、最高或自动配装。'
              : '资料与计算条件齐全时才显示伤害比较。'}
          </p>
          <p>这是单人配装建议，可能与其他方案共用驱动盘；保存不会自动更换装备。</p>
        </details>
      ) : null}
      {kind === 'agent' && activeProfiles[0]?.agentId === 'agent-billy' ? (
        <section className="panel" aria-label="比利满级理论估算">
          <h2>比利·奇德 · 满级理论参考</h2>
          <p>只用于相同版本和条件下的方向比较，不代表游戏内实测或最高伤害。</p>
        </section>
      ) : null}
      {kind !== 'team' ? (
        <details className="panel" aria-label="方案条件与调整">
          <summary>方案条件与调整</summary>
          <p>
            4/5/6
            号位、目标词条、固定或排除盘等条件可记录在本方案；以下调整仅更新草稿，不会修改角色、音擎、驱动盘或游戏数据。
          </p>
          <label>
            方案名称
            <input
              value={draft.name}
              onChange={(event) => {
                onNameChange(event.target.value)
              }}
            />
          </label>
          <label>
            音擎方向
            <input
              value={draft.manualOverrides.wEngineDirection}
              onChange={(event) => update('wEngineDirection', event.target.value)}
            />
          </label>
          <label>
            驱动盘与词条方向
            <textarea
              value={draft.manualOverrides.discDirection}
              onChange={(event) => update('discDirection', event.target.value)}
            />
          </label>
          <label>
            养成方向
            <input
              value={draft.manualOverrides.progressionDirection}
              onChange={(event) => update('progressionDirection', event.target.value)}
            />
          </label>
          <label>
            方案备注
            <textarea
              value={draft.manualOverrides.notes}
              onChange={(event) => update('notes', event.target.value)}
            />
          </label>
        </details>
      ) : null}
    </>
  )
}
