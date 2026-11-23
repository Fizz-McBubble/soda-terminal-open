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
      {generated && kind === 'agent' && !candidate ? <FormalDamageGateNotice /> : null}
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
              ? '按当前仓库比较配装方向；不同方案可能共用驱动盘。'
              : '资料与计算条件齐全时才显示伤害比较。'}
          </p>
        </details>
      ) : null}
      {kind === 'agent' && activeProfiles[0]?.agentId === 'agent-billy' ? (
        <section className="panel" aria-label="比利满级理论估算">
          <h2>比利·奇德 · 满级理论参考</h2>
          <p>同版本、同条件的单次伤害参考。</p>
        </section>
      ) : null}
      {kind !== 'team' ? (
        <details className="panel" aria-label="方案条件与调整">
          <summary>方案条件与调整</summary>
          <p>记录4/5/6号位、目标词条及固定或排除盘等方案偏好。</p>
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
