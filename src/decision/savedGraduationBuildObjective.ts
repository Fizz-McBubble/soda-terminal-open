import { targetTeamBuildDirectionConditions } from '../application/targetTeamEffectivePotentialConditions'
import type { RosterAgent } from '../assault/types'
import type { DriveDisc } from '../domain/schemas'
import { getCandidateWarehouseConstraintForTeam } from '../gameDataPacks/candidateWarehouseConstraints'
import type { CandidateWarehouseConstraint } from '../gameDataPacks/candidateWarehouseConstraints'
import { readTargetPanelMetricSemantic } from '../gameDataPacks/targetPanelSemantics'
import type { CandidatePanelInput } from '../optimizer/candidatePanelObjective'
import {
  projectCandidateEffectiveCritObjective,
  type CandidateEffectiveCritProjection,
} from '../optimizer/candidateEffectiveCritObjective'
import { developmentCandidateEventObjective32 } from './developmentCandidateEventObjective32'
import type { CurrentPlanningScenarioSelection32 } from '../application/publicPlanningScenarioContract'
import type { ReviewedTemplateEventConditionDeclaration32 } from '../calculation/reviewedTemplateEventConditions32'

export type SavedGraduationBuildObjective = {
  constraintHash: string
  branchId?: string
  objective?: string
  sourceRefs: string[]
  mainStats: CandidateWarehouseConstraint['mainStats']
  /** Event coordinates retain their combat observation and never become menu targets. */
  targetPanelApplicability?: CandidateWarehouseConstraint['targetPanelApplicability']
  eventProjection?: CandidateEffectiveCritProjection
  critEfficiency?: {
    boundary: 'cap'
    observation: 'in_combat'
    effectiveCap: 1
    /** Excess CR is not a graduation penalty: conversions remain in event damage. */
    excessIsFailure: false
  }
}

/** Graduation consumes the same branch and event producer as solving. A finite
 * damage result has no independent graduation threshold and is never a score. */
export function resolveSavedGraduationBuildObjective(input: {
  agent: RosterAgent
  agents: readonly RosterAgent[]
  memberIds: readonly string[]
  discs: DriveDisc[]
  panelInput?: CandidatePanelInput
  target: unknown
  scenarioSelection?: CurrentPlanningScenarioSelection32
  eventConditionDeclaration?: ReviewedTemplateEventConditionDeclaration32
}) {
  const constraint = getCandidateWarehouseConstraintForTeam(input.agent.agentId, {
    memberIds: input.memberIds,
    ...targetTeamBuildDirectionConditions({
      memberIds: input.memberIds,
      roster: { agents: [...input.agents] },
    }),
  })
  if (!constraint) return undefined
  const critSemantic = constraint.targetPanelApplicability
    ? undefined
    : readTargetPanelMetricSemantic(input.target, 'critRate')
  const critCap = critSemantic?.boundary === 'cap' && critSemantic.requirement === 'optional'
  if (!constraint.buildObjective && !constraint.targetPanelApplicability && !critCap)
    return undefined
  const objective = developmentCandidateEventObjective32({ ...input, panelInput: input.panelInput })
  const eventProjection = objective
    ? projectCandidateEffectiveCritObjective(objective, input.panelInput, input.discs)
    : undefined
  const evidence: SavedGraduationBuildObjective = {
    constraintHash: constraint.contentHash,
    branchId: constraint.reviewedTeamDirectionId,
    objective: constraint.buildObjective,
    sourceRefs: [
      ...new Set([
        ...constraint.sources.map((source) => source.id),
        ...(eventProjection?.sourceRefs ?? []),
      ]),
    ],
    mainStats: constraint.mainStats,
    ...(constraint.targetPanelApplicability
      ? { targetPanelApplicability: constraint.targetPanelApplicability }
      : {}),
    ...(eventProjection ? { eventProjection } : {}),
    ...(critCap
      ? {
          critEfficiency: {
            boundary: 'cap' as const,
            observation: 'in_combat' as const,
            effectiveCap: 1 as const,
            excessIsFailure: false as const,
          },
        }
      : {}),
  }
  return {
    evidence,
    // An exact-team branch cannot inherit an unrelated personal guide's
    // numerical targets. Keep its useful direction without inventing thresholds.
    referenceReason:
      constraint.targetPanelApplicability || constraint.buildObjective
        ? '当前精确队伍采用来源条件化构筑；该目标没有独立量化毕业阈值，保留构筑参考，不套用传统个人面板完成度。'
        : !eventProjection || eventProjection.status !== 'applied'
          ? '条件化暴击目标的事件或增益窗口未完整核验，不能将其余面板拼成完整毕业完成度。'
          : undefined,
    conditions: [
      ...(constraint.targetPanelApplicability || constraint.buildObjective
        ? [constraint.boundary]
        : []),
      ...(critCap
        ? [
            '有效暴击按同一来源事件计算；上限是效率参考，超额不扣毕业分，也不证明持续覆盖或全部毕业。',
          ]
        : []),
      ...(eventProjection?.reasons ?? []),
    ],
  }
}
