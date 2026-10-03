import { getCurrentAgentEventContract } from '../calculation/currentAgentMechanicContracts'
import { damageFormula32Identity } from '../calculation/sharpDamageCore'
import { stableContentHash } from './types'
import { incremental32RecoveryPolicy } from './incremental32RecoveryPolicy'
import { reviewedPreparedBenchmarkCapabilities32 } from '../calculation/reviewedPreparedBenchmark32'
import { reviewedPreparedTeamCapabilities32 } from '../calculation/reviewedPreparedTeamBenchmark32'

// Approval is intentionally a named tuple. A compiler run or a changed release
// title cannot approve another subject, event, family, or calculation scope.
const reviewedTuples = [
  {
    agentId: 'agent-claret',
    eventId: 'basic.BasicAttackBloodforgingFourForms.hit-0',
    label: '普通攻击·血铸四式第一段',
    family: 'sharp' as const,
    scalingAttribute: 'defense' as const,
    attribute: 'electric' as const,
    statsSha256: '49BDB5A6D64AC3CA2727F376765BF97F884C7DDF03F9B954017532757C85388C',
    formulaSha256: 'BDF57EEC001BFA499D2C08BDB8E5004469EAE22E411D9EAFE4F614E3C55F5AF3',
    multiplier: { base: 0.544, growthPerLevel: 0.05 },
    independentCaseId: 'claret-basic-l12-level1-def400-cr150-l150',
  },
  {
    agentId: 'agent-claret',
    eventId: 'assist.CounterAssistGiveNotAnInchOfSteel.hit-0',
    label: '反击支援·寸铁不让',
    family: 'sharp' as const,
    scalingAttribute: 'defense' as const,
    attribute: 'electric' as const,
    statsSha256: '49BDB5A6D64AC3CA2727F376765BF97F884C7DDF03F9B954017532757C85388C',
    formulaSha256: 'BDF57EEC001BFA499D2C08BDB8E5004469EAE22E411D9EAFE4F614E3C55F5AF3',
    multiplier: { base: 11.53, growthPerLevel: 1.049 },
    independentCaseId: 'claret-counter-assist-l12-level1-def400-cr150-l150',
  },
  {
    agentId: 'agent-roxy',
    eventId: 'basic.BasicAttackDoStayAWhile.hit-0',
    label: '普通攻击·请留片刻第一段',
    family: 'direct' as const,
    scalingAttribute: 'attack' as const,
    attribute: 'wind' as const,
    statsSha256: '764769EFD09AAD9D9651B8BD77D3B936AE6760515546333753104890F56587EF',
    formulaSha256: 'DFB173A363EFD3D9384AB3D53C543824B2B420ED14C67FD3039DC5F3C022D27D',
    multiplier: { base: 0.524, growthPerLevel: 0.048 },
    independentCaseId: 'roxy-basic-l12-level1-atk1000-cr50-cd100',
  },
] as const

export const reviewedEventScope32 = 'provided_final_stats_single_event' as const

export function getReviewedEventCapability32(agentId: string, eventId?: string) {
  const tuple = reviewedTuples.find(
    (row) => row.agentId === agentId && (eventId === undefined || row.eventId === eventId),
  )
  const contract = getCurrentAgentEventContract(agentId)
  const event = contract?.eventContract.events.find((row) => row.eventId === tuple?.eventId)
  if (!tuple || !contract || !event) return null
  const operator = event.operators.damageMultiplier
  if (
    contract.source.commit !== damageFormula32Identity.upstreamCommit ||
    contract.source.statsSha256 !== tuple.statsSha256 ||
    contract.source.formulaSha256 !== tuple.formulaSha256 ||
    event.eventModifierRefs.length !== 0 ||
    event.formulaProjection !== 'source_registered' ||
    event.attribute !== tuple.attribute ||
    event.scalingAttribute !== (tuple.scalingAttribute === 'defense' ? 'def' : 'atk') ||
    event.formulaFamily !==
      (tuple.family === 'sharp' ? 'sharp_damage' : 'standard_direct_damage') ||
    operator.kind !== 'linear_skill_level' ||
    operator.base !== tuple.multiplier.base ||
    operator.growthPerLevel !== tuple.multiplier.growthPerLevel ||
    operator.minimumLevel !== 1 ||
    operator.maximumLevel !== 16
  )
    return null
  return {
    ...tuple,
    gameVersion: '3.2' as const,
    contextScope: reviewedEventScope32,
    capability: 'formal_single_event' as const,
    importReady: false as const,
    source: contract.source,
    evidenceRefs: [
      `GO:${contract.source.statsPath}:sha256:${tuple.statsSha256}`,
      `GO:${contract.source.formulaPath}:sha256:${tuple.formulaSha256}`,
    ],
    validationRef: 'decision/reviewedIncrementalEventBenchmark32.test.ts',
    contentHash: stableContentHash({
      tuple,
      scope: reviewedEventScope32,
      formula: damageFormula32Identity,
    }),
  }
}

export const reviewedEventCapabilities32 = Object.freeze(
  reviewedTuples.flatMap(({ agentId, eventId }) => {
    const row = getReviewedEventCapability32(agentId, eventId)
    return row ? [row] : []
  }),
)

export const reviewedCalculationCapabilities32 = Object.freeze([
  ...reviewedEventCapabilities32,
  ...reviewedPreparedBenchmarkCapabilities32,
  ...reviewedPreparedTeamCapabilities32,
])

const activeCapabilities32 = reviewedCalculationCapabilities32.filter(
  () => !incremental32RecoveryPolicy.enabled,
)

export const incrementalFormalCapabilitySummary32 = Object.freeze({
  subjects: new Set(reviewedCalculationCapabilities32.map((row) => row.agentId)).size,
  tuples: reviewedCalculationCapabilities32.length,
  activeTuples: activeCapabilities32.length,
  activeFixedCycleTuples: activeCapabilities32.filter(
    (row) => String(row.capability) === 'formal_dps',
  ).length,
  capabilities: [...new Set(reviewedCalculationCapabilities32.map((row) => row.capability))],
  contextScopes: [...new Set(reviewedCalculationCapabilities32.map((row) => row.contextScope))],
  importReady: reviewedCalculationCapabilities32.some((row) => row.importReady),
  fixedCycleTuples: reviewedCalculationCapabilities32.filter(
    (row) => String(row.capability) === 'formal_dps',
  ).length,
})
