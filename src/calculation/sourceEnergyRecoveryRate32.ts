import { stableContentHash } from '../gameDataPacks/types'
import { currentAgentMechanicIdentity } from './currentAgentMechanicContracts'
import { getCurrentAgentDecisionMechanicContract } from './currentAgentDecisionMechanicContracts'
import { currentAgentPlanningEffectBlueprints } from './currentAgentPlanningEffectBlueprint'
import { applicationForReceiver, recipientIds } from './currentPlanningDamageModifiers'
import { effectReceiverMetadata } from './currentPlanningEffectExpressions'
import { evaluateCurrentPlanningEffectEntries32 } from './currentPlanningEffectRuntime'
import { planningRuntimeEffectBuckets32 } from './currentPlanningSelfEffects32'
import { functionalEquipmentGaps32 } from './reviewedFunctionalEquipmentDependencies32'
import { applyPlanningNaturalEnergyModifiers32 } from './planningNaturalEnergyModifiers32'
import type {
  evaluateReviewedFunctionalCapacity32,
  ReviewedFunctionalCapacity32,
} from './reviewedFunctionalCapacity32'

export const sourceEnergyRecoveryRateIdentity32 = Object.freeze({
  revision: 'source-natural-recovery-rate-r2',
  commit: '3456cd0f6f5bea10e168074502460dac2fcd6df4',
  path: 'libs/zzz/formula/src/data/common/index.ts',
  sha256: '8C97E50A3B88846F7083290C53604F6545E818CAE3E7E3F8464C18011B2F594F',
  locator: 'flatAndPercentStats:final=initial*(1+combat_percent)+combat_flat',
  statListing: 'libs/zzz/formula/src/data/util/listing.ts#flatAndPercentStats:enerRegen',
  caesarM2: {
    minimumMindscape: 2,
    formulaSha256: '3F8882797C2D056CB9548B431209D6535C1B4BB3E3435D305C3C970EAF241125',
    expressionSha256: 'B5ED46409E37E7991D612F56F8200079B251850E94690B77DFDF2028DFD04838',
    descriptionPath: 'libs/zzz/dm-localization/assets/locales/en/char_Caesar_gen.json#mindscapes.2',
    descriptionSha256: '7f5fd06fa76d69895fcc3a299a192349881ee6afe210d692d166dfd612c4d620',
  },
})
const applications = new Set(['energy_regen_percent', 'energy_regen_flat'])
const energyEntries = currentAgentPlanningEffectBlueprints.filter((entry) => {
  const receiver = effectReceiverMetadata(entry.numericExpression.expressionIr).receiverPath
  return (
    /^(ownBuff|notOwnBuff|teamBuff)\.combat\.enerRegen_?$/.test(receiver ?? '') &&
    applications.has(applicationForReceiver(receiver))
  )
})

/** Snapshot of the natural recovery rate under the declared source conditions.
 * Hit recovery, fixed grants, overflow and elapsed combat time are separate. */
export function evaluateSourceEnergyRecoveryRate32(
  input: Parameters<typeof evaluateReviewedFunctionalCapacity32>[0],
) {
  const member = input.member,
    agentId = member.agentId
  const members = input.members ?? [member]
  const memberIds = members.map((row) => row.agentId)
  const candidateEntries = energyEntries.filter(
    (entry) =>
      memberIds.includes(entry.providerAgentId) &&
      recipientIds({
        providerAgentId: entry.providerAgentId,
        targetKinds: entry.targetKinds,
        memberIds,
        receiverPath: effectReceiverMetadata(entry.numericExpression.expressionIr).receiverPath,
        effectKey: entry.effectKey,
      }).includes(agentId),
  )
  const gaps = functionalEquipmentGaps32(input.equipmentExclusions, agentId, [
    'initial.enerRegen',
    'initial.enerRegen_',
    'combat.enerRegen',
    'combat.enerRegen_',
  ])
  // The pinned sheet uses only radiant_aegis for the M2 recovery node.
  // The actual shield can exist below M2, but its M2 recovery cannot.
  const rankInactive: string[] = []
  const rankSourceRefs: string[] = []
  const entries = candidateEntries.filter((entry) => {
    if (entry.effectKey !== 'agent-caesar:m2_enerRegen_') return true
    const provider = members.find((row) => row.agentId === entry.providerAgentId)!
    const source = getCurrentAgentDecisionMechanicContract(provider.agentId)?.effectContract.source
    const binding = sourceEnergyRecoveryRateIdentity32.caesarM2
    if (
      source?.commit !== sourceEnergyRecoveryRateIdentity32.commit ||
      source.formulaSha256 !== binding.formulaSha256 ||
      entry.numericExpression.expressionSha256 !== binding.expressionSha256 ||
      !Number.isInteger(provider.mindscape) ||
      provider.mindscape < 0 ||
      provider.mindscape > 6
    ) {
      gaps.push('caesar_m2_recovery_rank_source_unbound')
      return true
    }
    rankSourceRefs.push(`${binding.descriptionPath}#${binding.descriptionSha256}`)
    if (provider.mindscape < binding.minimumMindscape) {
      rankInactive.push(entry.effectKey)
      return false
    }
    return true
  })
  if (currentAgentMechanicIdentity.upstreamCommit !== sourceEnergyRecoveryRateIdentity32.commit)
    gaps.push('energy_recovery_source_pin_mismatch')
  if (!Number.isFinite(member.initialStats.enerRegen) || member.initialStats.enerRegen < 0)
    gaps.push('invalid_initial_energy_recovery_rate')
  const runtime = entries.length
    ? evaluateCurrentPlanningEffectEntries32(
        { memberIds, members, baselineReferencesByAgentId: input.baselineReferencesByAgentId },
        entries,
      )
    : null
  if (runtime?.status === 'unsupported') gaps.push(...runtime.blockers)
  for (const row of runtime?.results ?? [])
    if (row.status === 'excluded_unknown')
      gaps.push(`energy_recovery_condition_unobserved:${row.effectKey}`)
  const sourceBuckets =
    runtime?.status === 'supported'
      ? planningRuntimeEffectBuckets32(runtime.results, memberIds)
      : []
  const buckets = [...sourceBuckets, ...(input.equipmentModifierBuckets ?? [])].filter(
    (row) => applications.has(row.application) && row.recipientAgentIds.includes(agentId),
  )
  const seen = new Set<string>()
  for (const bucket of buckets) {
    const key = `${bucket.providerAgentId}:${bucket.effectKey}`
    if (seen.has(key)) gaps.push('duplicate_energy_recovery_effect')
    seen.add(key)
    if (
      !Number.isFinite(bucket.value) ||
      bucket.action !== null ||
      bucket.attribute !== null ||
      bucket.damageType !== null ||
      bucket.applicationScope === 'event_only' ||
      !memberIds.includes(bucket.providerAgentId) ||
      (bucket.sourceFormula?.finalStatReferences.length ?? 0) > 0
    )
      gaps.push('energy_recovery_effect_scope_unresolved')
  }
  const rate = applyPlanningNaturalEnergyModifiers32(
    member.initialStats.enerRegen,
    member.finalStats.enerRegen,
    buckets,
  )
  if (rate.status !== 'supported') gaps.push(...rate.blockers)
  const capacities: ReviewedFunctionalCapacity32[] = [
    {
      key: `${agentId}:natural_energy_recovery_rate`,
      kind: 'natural_energy_recovery_rate',
      value: gaps.length || rate.status !== 'supported' ? null : rate.value,
      contextKey: stableContentHash({
        agentId,
        level: member.level ?? null,
        mindscape: member.mindscape,
        potential: member.potential ?? null,
        coreLevel: member.coreLevel,
        declaration: 'same-source-conditions-instantaneous-natural-recovery-rate',
        references: input.baselineReferencesByAgentId ?? null,
        identity: sourceEnergyRecoveryRateIdentity32,
      }),
      sourceRefs: [
        `${sourceEnergyRecoveryRateIdentity32.path}#${sourceEnergyRecoveryRateIdentity32.sha256}`,
        sourceEnergyRecoveryRateIdentity32.statListing,
        ...rankSourceRefs,
        ...buckets.flatMap((row) => row.sourceRefs),
      ],
      included: [
        'completed_initial_natural_recovery_rate',
        ...buckets.map((row) => row.effectKey),
        ...rankInactive.map((key) => `source_rank_inactive:${key}`),
      ],
      excluded: [
        ...new Set(gaps),
        'hit_energy_and_fixed_grants',
        'overflow_and_elapsed_resource_cycle',
      ],
    },
  ]
  return { status: 'supported' as const, capacities, blockers: [...new Set(gaps)] }
}
