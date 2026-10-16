import reviewedTargetPanels from './data/reviewed-target-panel-guidance.3.1.json'
import { reviewedGuideBuildConditions } from './reviewedGuideBuildDirections'
import { resolveReviewedZhaoHpTarget } from './reviewedZhaoSupportTarget'
import { reviewedContextualMechanicTargets } from './reviewedContextualTargetPanel'

export const candidatePanelPolicyVersion = 'source-bound-initial-hp-and-attack-priority-r2' as const

export type CandidatePanelPriorityStat = 'anomalyProficiency' | 'energyRegen' | 'source'

export type CandidatePanelPolicy = {
  agentId: string
  minimumAttack: number
  minimumInitialHp?: number
  requiresPreciseInitialStats?: boolean
  priorityStat: CandidatePanelPriorityStat
  requiresActualCoreLevel?: boolean
  requiredFourPieceSet?: string
  sourceId: string
}

export type CandidatePanelPolicyContext = {
  coreLevel?: number
  fourPieceSetId?: string
  /** Account Mindscape level (0-6); unknown values must not imply M0/M1. */
  mindscape?: number
  specialLevel?: number
}

function reviewedSetPolicy(
  agentId: 'agent-astra' | 'agent-pan-yinhu',
  minimumAttack: number,
  sourceId: string,
): CandidatePanelPolicy | null {
  const source = reviewedGuideBuildConditions[agentId]
  const adopted =
    source?.source.verified &&
    source.source.id === sourceId &&
    source.conditions.some(
      (text) =>
        text.includes(String(minimumAttack)) &&
        text.includes('满级核心技') &&
        text.includes('静听嘉音') &&
        text.includes('回能'),
    )
  return adopted
    ? {
        agentId,
        minimumAttack,
        priorityStat: 'energyRegen',
        requiresActualCoreLevel: true,
        requiredFourPieceSet: 'set-astral-voice',
        sourceId,
      }
    : null
}

function reviewedYuzuhaPolicy(): CandidatePanelPolicy | null {
  const source = reviewedTargetPanels.entries.find((entry) => entry.agentId === 'agent-yuzuha')
  return source?.id === 'prydwen-yuzuha-current-2026-08-05' &&
    source.s.includes('atk:3000+') &&
    source.c?.some((condition) => condition.includes('Prioritize ATK under 3000 then AP'))
    ? {
        agentId: 'agent-yuzuha',
        minimumAttack: 3000,
        priorityStat: 'anomalyProficiency',
        requiresActualCoreLevel: true,
        sourceId: source.id,
      }
    : null
}

const policies = [
  reviewedSetPolicy('agent-astra', 3429, 'miyoushe-65063323-fold-56-disc-condition'),
  reviewedSetPolicy('agent-pan-yinhu', 3000, 'miyoushe-65136583-fold-51-disc-condition'),
  reviewedYuzuhaPolicy(),
  (() => {
    const target = resolveReviewedZhaoHpTarget({ agentId: 'agent-zhao', coreLevel: 7 })
    return target
      ? {
          agentId: 'agent-zhao',
          minimumAttack: 0,
          minimumInitialHp: target.minimum,
          priorityStat: 'source' as const,
          sourceId: target.sourceId,
        }
      : null
  })(),
].filter((policy): policy is CandidatePanelPolicy => policy !== null)

export function getCandidatePanelPolicy(agentId: string): CandidatePanelPolicy | null {
  return policies.find((policy) => policy.agentId === agentId) ?? null
}

export function hasContextualAttackTargetPolicy(agentId: string) {
  return ['agent-lucy', 'agent-soukaku'].includes(agentId)
}

/** Resolve the actual-core/skill preparation line. Base declarations retain guide
 * direction for consumers without context, and cannot execute without required facts. */
export function getCandidatePanelPolicyForContext(
  agentId: string,
  context: CandidatePanelPolicyContext,
): CandidatePanelPolicy | null {
  const policy = getCandidatePanelPolicy(agentId)
  if (hasContextualAttackTargetPolicy(agentId)) {
    const mechanic = reviewedContextualMechanicTargets({
      agentId,
      coreLevel: context.coreLevel,
      specialLevel: context.specialLevel,
    })
    return mechanic
      ? {
          agentId,
          priorityStat: 'source',
          minimumAttack: mechanic.values.atk,
          requiresPreciseInitialStats: true,
          sourceId: mechanic.sourceRef.contentHash,
        }
      : null
  }
  if (!policy || !['agent-astra', 'agent-pan-yinhu', 'agent-yuzuha'].includes(agentId))
    return policy
  if (
    agentId !== 'agent-yuzuha' &&
    (!Number.isInteger(context.mindscape) || context.mindscape! < 0 || context.mindscape! > 6)
  )
    return null
  const mechanic = reviewedContextualMechanicTargets({
    agentId,
    coreLevel: context.coreLevel,
    mindscape: context.mindscape,
  })
  if (mechanic)
    return {
      ...policy,
      minimumAttack: mechanic.values.atk,
      requiresPreciseInitialStats: true,
      sourceId: mechanic.sourceRef.contentHash,
    }
  return null
}

export function candidatePanelPolicyPrerequisites(
  policy: CandidatePanelPolicy,
  context: CandidatePanelPolicyContext,
) {
  const coreSatisfied =
    !policy.requiresActualCoreLevel ||
    (Number.isInteger(context.coreLevel) && context.coreLevel! >= 1 && context.coreLevel! <= 7)
  const fourPieceSatisfied =
    policy.requiredFourPieceSet === undefined ||
    context.fourPieceSetId === policy.requiredFourPieceSet
  const mindscapeSatisfied =
    !['agent-astra', 'agent-pan-yinhu'].includes(policy.agentId) ||
    (Number.isInteger(context.mindscape) && context.mindscape! >= 0 && context.mindscape! <= 6)
  return {
    coreSatisfied,
    fourPieceSatisfied,
    mindscapeSatisfied,
    executable: coreSatisfied && fourPieceSatisfied && mindscapeSatisfied,
  }
}
