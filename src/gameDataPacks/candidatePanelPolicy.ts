import reviewedTargetPanels from './data/reviewed-target-panel-guidance.3.1.json'
import { reviewedGuideBuildConditions } from './reviewedGuideBuildDirections'

export const candidatePanelPolicyVersion = 'source-bound-attack-priority-r1' as const

export type CandidatePanelPriorityStat = 'anomalyProficiency' | 'energyRegen'

export type CandidatePanelPolicy = {
  agentId: string
  minimumAttack: number
  priorityStat: CandidatePanelPriorityStat
  requiredCoreLevel?: 7
  requiredFourPieceSet?: string
  sourceId: string
}

export type CandidatePanelPolicyContext = {
  coreLevel?: number
  fourPieceSetId?: string
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
        requiredCoreLevel: 7,
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
        // Preserve the previously verified solver boundary: PanelInput Core 5
        // is game-facing Core level 7. The guide line alone does not verify
        // that the same executable threshold applies below full Core.
        requiredCoreLevel: 7,
        sourceId: source.id,
      }
    : null
}

const policies = [
  reviewedSetPolicy('agent-astra', 3429, 'miyoushe-65063323-fold-56-disc-condition'),
  reviewedSetPolicy('agent-pan-yinhu', 3000, 'miyoushe-65136583-fold-51-disc-condition'),
  reviewedYuzuhaPolicy(),
].filter((policy): policy is CandidatePanelPolicy => policy !== null)

export function getCandidatePanelPolicy(agentId: string): CandidatePanelPolicy | null {
  return policies.find((policy) => policy.agentId === agentId) ?? null
}

export function candidatePanelPolicyPrerequisites(
  policy: CandidatePanelPolicy,
  context: CandidatePanelPolicyContext,
) {
  const coreSatisfied =
    policy.requiredCoreLevel === undefined || context.coreLevel === policy.requiredCoreLevel
  const fourPieceSatisfied =
    policy.requiredFourPieceSet === undefined ||
    context.fourPieceSetId === policy.requiredFourPieceSet
  return {
    coreSatisfied,
    fourPieceSatisfied,
    executable: coreSatisfied && fourPieceSatisfied,
  }
}
