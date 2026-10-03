import { createCalculationContext } from '../calculation/calculationContext'
import { resolveCurrentAgentEvent } from '../calculation/currentAgentMechanicContracts'
import {
  evaluateReviewedDamageEvent32,
  reviewedDamageStatsHash32,
  type ReviewedDamageEvent32,
} from '../calculation/reviewedDamage32'
import { damageFormula32Identity } from '../calculation/sharpDamageCore'
import { getReviewedEventCapability32 } from '../gameDataPacks/reviewedEventCapabilities32'
import { stableContentHash } from '../gameDataPacks/types'
import {
  incremental32RecoveryPolicy,
  incremental32RecoveryReason,
} from '../gameDataPacks/incremental32RecoveryPolicy'

type NumericStats = { [K in keyof ReviewedDamageEvent32['stats']]: number }

export type ReviewedIncrementalEventInput32 = {
  agentId: string
  eventId?: string
  level: number
  skillLevel: number
  stats: NumericStats
  enemy: { defense: number; resistance: number; stunMultiplier: number; vulnerability: number }
  confirmedFinalStatsAndModifiers: boolean
  stale: boolean
}

/** A source coefficient plus explicit final combat inputs, never a rotation inference. */
export function evaluateReviewedIncrementalEventBenchmark32(
  input: ReviewedIncrementalEventInput32,
) {
  const unsupported = (gaps: string[]) => ({ status: 'unsupported' as const, gaps })
  if (incremental32RecoveryPolicy.enabled) return unsupported([incremental32RecoveryReason])
  const capability = getReviewedEventCapability32(input.agentId, input.eventId)
  if (!capability) return unsupported(['主体或单次命中不在已核验范围内。'])
  if (!input.confirmedFinalStatsAndModifiers)
    return unsupported(['请核对这次命中的最终属性、所有伤害修正和敌人条件。'])
  if (input.stale) return unsupported(['输入已经变化，请重新核对后计算。'])
  const event = resolveCurrentAgentEvent({
    stableId: input.agentId,
    eventId: capability.eventId,
    skillLevel: input.skillLevel,
  })
  if (event.status !== 'supported') return unsupported([...event.blockers])
  const stats = Object.fromEntries(
    Object.entries(input.stats).map(([key, value]) => [
      key,
      { value, evidenceRefs: ['provided_final_stats'] },
    ]),
  ) as ReviewedDamageEvent32['stats']
  try {
    const statsHash = reviewedDamageStatsHash32(stats)
    const inputHash = stableContentHash(input)
    const context = createCalculationContext({
      schemaVersion: 'calculation-context-v2',
      contextId: `${capability.contextScope}:${input.agentId}`,
      gameVersion: capability.gameVersion,
      canonical: {
        packageId: `reviewed-event-32:${input.agentId}`,
        packageVersion: capability.contentHash,
        gameVersion: capability.gameVersion,
        contentHash: capability.contentHash,
        status: 'formal',
        rollbackPackageId: null,
      },
      accountSnapshot: {
        accountId: 'explicit-local-input',
        rosterHash: inputHash,
        warehouseHash: inputHash,
        planningHash: inputHash,
        capturedAt: new Date().toISOString(),
        stale: input.stale,
      },
      scope: { kind: 'agent', agentIds: [input.agentId] },
      actors: [
        {
          agentId: input.agentId,
          level: input.level,
          mindscape: null,
          potential: null,
          skillLevels: { [capability.eventId.split('.')[0]!]: input.skillLevel },
          wEngine: null,
          discs: [],
          finalStatsHash: statsHash,
        },
      ],
      bangboo: null,
      scenario: {
        playModeId: null,
        scenarioId: 'explicit-enemy',
        scenarioHash: stableContentHash(input.enemy),
        enemy: { id: 'explicit-enemy', level: null, ...input.enemy },
      },
      cycle: null,
      objective: 'formal_damage',
      constraintsHash: capability.contentHash,
      evidence: [
        {
          fieldId: 'formula',
          status: 'formal',
          applicability: 'verified_current',
          sourceRefs: [...damageFormula32Identity.evidenceRefs],
          sourceVersion: capability.gameVersion,
          requiredFor: ['formal_single_event'],
          reason: 'Pinned formula and independent arithmetic cases.',
        },
        {
          fieldId: 'event',
          status: 'formal',
          applicability: 'verified_current',
          sourceRefs: capability.evidenceRefs,
          sourceVersion: capability.gameVersion,
          requiredFor: ['formal_single_event'],
          reason: 'Named reviewed coefficient; one indexed hit.',
        },
        {
          fieldId: 'provided_final_stats',
          status: 'formal',
          applicability: 'verified_current',
          sourceRefs: [`explicit-player-input:${inputHash}`],
          sourceVersion: capability.gameVersion,
          requiredFor: ['formal_single_event'],
          reason:
            'Explicitly confirmed final combat values and enemy parameters; no equipment or trigger inferred.',
        },
      ],
    })
    return evaluateReviewedDamageEvent32({
      context,
      subjectAgentId: input.agentId,
      actorFinalStatsHash: statsHash,
      upstreamCommit: damageFormula32Identity.upstreamCommit,
      formulaEvidenceRefs: ['formula'],
      contextEvidenceRefs: ['provided_final_stats'],
      stats,
      definition: {
        subjectAgentId: input.agentId,
        eventId: capability.eventId,
        family: capability.family,
        scalingAttribute: capability.scalingAttribute,
        attribute: capability.attribute,
        targetVersion: capability.gameVersion,
        evidenceRefs: ['event'],
      },
      event: {
        eventId: capability.eventId,
        family: capability.family,
        scalingAttribute: capability.scalingAttribute,
        attribute: capability.attribute,
        multiplier: { value: event.damageMultiplier, evidenceRefs: ['event'] },
        hitCount: { value: 1, evidenceRefs: ['event'] },
        evidenceRefs: ['event'],
      },
    })
  } catch {
    return unsupported(['请提供完整、有限且合法的最终属性和敌人参数。'])
  }
}
