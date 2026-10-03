import { createCalculationContext } from './calculationContext'
import {
  getCurrentAgentEventContract,
  resolveCurrentAgentEvent,
} from './currentAgentMechanicContracts'
import type { PlanningEffectRuntimeMember } from './currentPlanningEffectRuntime'
import type { PlanningEventUsage } from './planningCalculationContextCompiler'
import type { PlanningBaseline } from './planningDpsContract'
import type { DriveDisc } from '../domain/schemas'
import { damageFormula32Identity, isDamageFormula32Version } from './sharpDamageCore'
import { incremental32RecoveryPolicy } from '../gameDataPacks/incremental32RecoveryPolicy'
import { stableContentHash } from '../gameDataPacks/types'

// Literal source L12 coefficients are checked independently of the packet
// compiler. The packet uses source units, not guessed physical-hit counts.
const definitions = [
  {
    agentId: 'agent-claret',
    policyId: 'personal-claret-prepared-held-subduing-axe-30s-r1',
    family: 'sharp' as const,
    maximumMindscape: 6,
    maximumPotential: 0,
    statsSha256: '49BDB5A6D64AC3CA2727F376765BF97F884C7DDF03F9B954017532757C85388C',
    formulaSha256: 'BDF57EEC001BFA499D2C08BDB8E5004469EAE22E411D9EAFE4F614E3C55F5AF3',
    rows: [
      ['special.SpecialAttackBloodbloomOathCleavingGoldAndIron.hit-0', 1, null, 1.536],
      ['special.SpecialAttackBloodbloomOathBloodBurialAssault.hit-0', 1, null, 6.263],
      ['special.SpecialAttackBloodbloomOathCleavingGoldAndIron.hit-2', 3, null, 16.256],
      ['basic.BasicAttackBloodbloomOathSubduingAxe.hit-0', 1, null, 6.569],
    ],
  },
  {
    agentId: 'agent-roxy',
    policyId: 'personal-roxy-prepared-held-one-second-30s-r1',
    family: 'direct' as const,
    maximumMindscape: 6,
    maximumPotential: 0,
    statsSha256: '764769EFD09AAD9D9651B8BD77D3B936AE6760515546333753104890F56587EF',
    formulaSha256: 'DFB173A363EFD3D9384AB3D53C543824B2B420ED14C67FD3039DC5F3C022D27D',
    rows: [
      ['special.EXSpecialAttackDontCatchAChill.hit-0', 1, null, 0.28],
      ['special.EXSpecialAttackDontCatchAChill.hit-1', 1, 1, 26.086],
      ['special.EXSpecialAttackKindlyRestInPeace.hit-0', 1, null, 0.638],
      ['special.EXSpecialAttackKindlyRestInPeace.hit-1', 3, null, 0.525],
      ['special.SpecialAttackForgiveMeForNotSeeingYouOff.hit-0', 1, null, 5.008],
      ['special.EyeOfTheStorm.hit-0', 3, null, 1.049],
      ['special.EyeOfTheStorm.hit-2', 1, 1, 4.174],
    ],
  },
  {
    agentId: 'agent-koleda',
    policyId: 'personal-koleda-prepared-enhanced-basic-30s-r1',
    family: 'direct' as const,
    maximumMindscape: 6,
    maximumPotential: 6,
    statsSha256: '08D32A1E6A628AD342DC4F4EA6391AF15B6F8890CE47FD3884CC6BB60A49958D',
    formulaSha256: '632180C58A583A7024641799AF82A21906D78973C2046A48C2DFB88E21E59C8C',
    rows: [
      ['basic.BasicAttackSmashNBash.hit-0', 1, null, 1.274],
      ['basic.BasicAttackSmashNBash.hit-1', 1, null, 1.584],
      ['basic.BasicAttackSmashNBash.hit-4', 1, null, 3.225],
      ['basic.BasicAttackSmashNBash.hit-5', 1, null, 8.108],
    ],
  },
] as const

/** M6 adds two distinct one-second storms at source offsets +3/+6. Total
 * rate exposure is three seconds, not three multiplied by three seconds. */
export function reviewedPreparedEventRows32(
  record: {
    agentId: string
    rows: ReadonlyArray<readonly [string, number, number | null, number]>
  },
  mindscape: number,
) {
  return record.rows.map(([id, count, duration, coefficient]) =>
    record.agentId === 'agent-roxy' && mindscape === 6 && id === 'special.EyeOfTheStorm.hit-2'
      ? ([id, 3, 3, coefficient] as const)
      : ([id, count, duration, coefficient] as const),
  )
}

export const reviewedPreparedBenchmarkCapabilities32 = Object.freeze(
  definitions.flatMap((row) => {
    const contract = getCurrentAgentEventContract(row.agentId)
    if (
      !contract ||
      contract.source.commit !== damageFormula32Identity.upstreamCommit ||
      contract.source.statsSha256 !== row.statsSha256 ||
      contract.source.formulaSha256 !== row.formulaSha256 ||
      row.rows.some(([eventId, , , coefficient]) => {
        const event = resolveCurrentAgentEvent({ stableId: row.agentId, eventId, skillLevel: 12 })
        return (
          event.status !== 'supported' || Math.abs(event.damageMultiplier - coefficient) > 1e-10
        )
      })
    )
      return []
    return [
      {
        ...row,
        gameVersion: '3.2' as const,
        eventId: row.policyId,
        contextScope: 'personal_prepared_fixed_event_model' as const,
        capability: 'formal_dps' as const,
        importReady: false as const,
        source: contract.source,
        evidenceRefs: [
          `GO:${contract.source.statsPath}:sha256:${row.statsSha256}`,
          `GO:${contract.source.formulaPath}:sha256:${row.formulaSha256}`,
        ],
        validationRef: 'calculation/reviewedPreparedBenchmark32.test.ts',
        contentHash: stableContentHash({
          row,
          formula: damageFormula32Identity,
          scope: 'prepared-model-not-full-combat',
        }),
      },
    ]
  }),
)

/** Formal applies to this finite numeric model and its stated effect coverage.
 * Equipment/whole-team recommendation qualification remains with the existing
 * comparison gate; an excluded effect cannot become a claimed overall gain. */
export function qualifyReviewedPreparedBenchmark32(input: {
  member: PlanningEffectRuntimeMember
  policyId: string
  actionIdentity: string
  resourceLegality: { legal: boolean }
  eventUsages: readonly PlanningEventUsage[]
  baseline: PlanningBaseline
  engine: { engineId: string; level: number; refinement: number }
  discs: readonly DriveDisc[]
  accountId: string
  accountHash: string
  effects: unknown
  totalDamage: number
  planningDps: number
  stale: boolean
}) {
  const record = reviewedPreparedBenchmarkCapabilities32.find(
    (row) => row.agentId === input.member.agentId && row.policyId === input.policyId,
  )
  if (
    !record ||
    incremental32RecoveryPolicy.enabled ||
    input.stale ||
    !input.resourceLegality.legal ||
    !isDamageFormula32Version(input.baseline.gameVersion) ||
    input.baseline.declaredDurationSeconds !== 30 ||
    !Number.isInteger(input.member.level) ||
    Number(input.member.level) < 1 ||
    Number(input.member.level) > 60 ||
    !Number.isInteger(input.member.mindscape) ||
    input.member.mindscape < 0 ||
    input.member.mindscape > record.maximumMindscape ||
    !Number.isInteger(input.member.potential ?? 0) ||
    (input.member.potential ?? 0) < 0 ||
    (input.member.potential ?? 0) > record.maximumPotential ||
    !Number.isFinite(input.totalDamage) ||
    input.totalDamage <= 0 ||
    !Number.isFinite(input.planningDps) ||
    Math.abs(input.planningDps * 30 - input.totalDamage) > 1e-7 ||
    input.eventUsages.length !== record.rows.length ||
    reviewedPreparedEventRows32(record, input.member.mindscape).some(
      ([id, count, duration], index) => {
        const usage = input.eventUsages[index]
        return (
          !usage ||
          usage.ownerAgentId !== record.agentId ||
          usage.eventId !== id ||
          usage.occurrenceCount !== count ||
          (usage.durationSeconds ?? null) !== duration ||
          usage.skillLevel !== input.member.skillLevels[id.split('.')[0]!] ||
          !Number.isInteger(usage.skillLevel) ||
          usage.skillLevel < 1 ||
          usage.skillLevel > 16
        )
      },
    )
  )
    return null
  try {
    const context = createCalculationContext({
      schemaVersion: 'calculation-context-v2',
      contextId: record.policyId,
      gameVersion: input.baseline.gameVersion,
      canonical: {
        packageId: record.policyId,
        packageVersion: record.contentHash,
        gameVersion: input.baseline.gameVersion,
        contentHash: record.contentHash,
        status: 'formal',
        rollbackPackageId: null,
      },
      accountSnapshot: {
        accountId: input.accountId,
        rosterHash: input.accountHash,
        warehouseHash: stableContentHash(input.discs),
        planningHash: input.actionIdentity,
        capturedAt: new Date().toISOString(),
        stale: false,
      },
      scope: { kind: 'agent', agentIds: [record.agentId] },
      actors: [
        {
          agentId: record.agentId,
          level: input.member.level ?? null,
          mindscape: input.member.mindscape,
          potential: input.member.potential ?? null,
          skillLevels: { ...input.member.skillLevels },
          wEngine: {
            id: input.engine.engineId,
            level: input.engine.level,
            refinement: input.engine.refinement,
          },
          discs: input.discs.map((disc) => ({
            id: disc.id,
            slot: disc.slot,
            setId: disc.setId,
            level: disc.level,
            statsHash: stableContentHash(disc),
          })),
          finalStatsHash: stableContentHash({
            initial: input.member.initialStats,
            final: input.member.finalStats,
          }),
        },
      ],
      bangboo: null,
      scenario: {
        playModeId: null,
        scenarioId: input.baseline.baselineId,
        scenarioHash: stableContentHash(input.baseline),
        enemy: { ...input.baseline.enemy, level: null },
      },
      cycle: {
        id: input.policyId,
        durationSeconds: 30,
        actionSequenceHash: stableContentHash({
          events: input.eventUsages,
          resource: input.resourceLegality,
        }),
        hitCount: null,
        buffWindowHash: stableContentHash(input.effects),
        complete: true,
      },
      objective: 'formal_dps',
      constraintsHash: input.actionIdentity,
      evidence: [
        {
          fieldId: 'prepared_fixed_event_model',
          status: 'formal',
          applicability: 'verified_current',
          sourceRefs: record.evidenceRefs,
          sourceVersion: input.baseline.gameVersion,
          requiredFor: ['formal_dps'],
          reason:
            'Pinned complete action coefficients, bounded legal preparation, shared formula and independent arithmetic.',
        },
      ],
    })
    return {
      status: 'formal' as const,
      capability: record.capability,
      scope: record.contextScope,
      policyId: record.policyId,
      contextComparisonKey: context.comparabilityKey,
      sourceHash: record.contentHash,
      includedScope: 'declared_fixed_events_and_resolved_effects' as const,
      wholeTeamFormal: false as const,
      importReady: false as const,
    }
  } catch {
    return null
  }
}
