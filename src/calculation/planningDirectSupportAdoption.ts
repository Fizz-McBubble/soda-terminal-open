import {
  getGeneralEventSourceFact,
  generalEventSourceCommit,
} from '../gameDataPacks/general-event-mapping.v1'
import { stableContentHash } from '../gameDataPacks/types'
import {
  calculateStandardDirectDamageCore,
  resolveAttackerLevelDefenseCoefficient,
} from './directDamageCore'
import { resolveGeneralSkillMultiplier } from './directDamageEvents'
import { planningDirectEventBundleFormulaHash } from './planningDirectEventBundle'

const billyEvent = getGeneralEventSourceFact('agent-billy')
if (!billyEvent) throw new Error('Billy general direct event source fact is missing')

const skillLevel = 12
const resolvedMultiplier = resolveGeneralSkillMultiplier(billyEvent.multiplier, skillLevel)
const expectedMultiplier = 0.618 + 0.057 * (skillLevel - 1)
const oracle = calculateStandardDirectDamageCore({
  attackerLevel: 60,
  attack: 1000,
  attackPercent: 0,
  attackFlat: 0,
  multiplier: resolvedMultiplier,
  hitCount: 1,
  critRate: 0.5,
  critDamage: 1,
  damageBonus: 0.2,
  vulnerability: 0,
  defenseReduction: 0,
  penetrationRatio: 0,
  penetrationFlat: 0,
  resistance: 0.2,
  resistanceReduction: 0,
  stunMultiplier: 1,
  enemyDefense: 700,
})
const independentExpectedDamage = 1000 * expectedMultiplier * 1.2 * (794 / (794 + 700)) * 0.8 * 1.5

const checks = [
  {
    id: 'locked-source-revision',
    passed: billyEvent.sourceVersion === generalEventSourceCommit,
    evidence: billyEvent.sourceVersion,
  },
  {
    id: 'evaluated-for-current-version',
    passed: billyEvent.targetVersion === '3.1',
    evidence: billyEvent.targetVersion,
  },
  {
    id: 'source-byte-provenance',
    passed:
      billyEvent.evidenceRefs.length === 2 &&
      billyEvent.evidenceRefs.every((ref) => ref.includes('sha256:')),
    evidence: billyEvent.evidenceRefs.join('|'),
  },
  {
    id: 'skill-multiplier-independent-recalculation',
    passed: Math.abs(resolvedMultiplier - expectedMultiplier) < 1e-12,
    evidence: `${resolvedMultiplier}`,
  },
  {
    id: 'r18-defense-coefficient-revalidation',
    passed: resolveAttackerLevelDefenseCoefficient(60) === 794,
    evidence: `${resolveAttackerLevelDefenseCoefficient(60)}`,
  },
  {
    id: 'full-damage-independent-recalculation',
    passed: Math.abs(oracle.expectedDamage - independentExpectedDamage) < 1e-9,
    evidence: `${oracle.expectedDamage}`,
  },
] as const

if (checks.some((check) => !check.passed))
  throw new Error('Billy Planning direct support adoption revalidation failed')

const adoptionCore = {
  schema: 'soda-planning-direct-support-adoption/v1',
  adoptionId: 'planning-direct-billy-source-event-3.1-r1',
  gameVersion: '3.1',
  agentId: 'agent-billy',
  eventId: billyEvent.eventId,
  formulaFamily: 'standard_direct_event_bundle',
  formulaHash: planningDirectEventBundleFormulaHash,
  sourceRevision: {
    repository: 'frzyc/genshin-optimizer',
    commit: generalEventSourceCommit,
    license: 'MIT',
    evidenceRefs: billyEvent.evidenceRefs,
  },
  state: 'runtime_adapter_ready',
  checks,
  fieldStates: {
    eventDefinition: 'formal',
    versionApplicability: 'formal',
    formulaCore: 'formal',
    independentRecalculation: 'formal',
    realAccountFinalStats: 'verified_runtime_projection_available',
    planningBaseline: 'required_per_execution',
    planningResult: 'supported_only_when_runtime_contract_is_complete',
  },
  boundary:
    'This adopts one model-grade event definition, not a default build, account snapshot, complete rotation, player-visible DPS, or BOX optimum.',
} as const

export const planningDirectBillySupportAdoption = Object.freeze({
  ...adoptionCore,
  contentHash: stableContentHash(adoptionCore),
})

const nekomataEvent = getGeneralEventSourceFact('agent-nekomata')
if (!nekomataEvent) throw new Error('Nekomata general direct event source fact is missing')
const nekomataResolvedMultiplier = resolveGeneralSkillMultiplier(
  nekomataEvent.multiplier,
  skillLevel,
)
const nekomataExpectedMultiplier = 0.552 + 0.051 * (skillLevel - 1)
const nekomataOracle = calculateStandardDirectDamageCore({
  attackerLevel: 60,
  attack: 1000,
  attackPercent: 0,
  attackFlat: 0,
  multiplier: nekomataResolvedMultiplier,
  hitCount: 1,
  critRate: 0.5,
  critDamage: 1,
  damageBonus: 0.2,
  vulnerability: 0,
  defenseReduction: 0,
  penetrationRatio: 0,
  penetrationFlat: 0,
  resistance: 0.2,
  resistanceReduction: 0,
  stunMultiplier: 1,
  enemyDefense: 700,
})
const nekomataIndependentExpectedDamage =
  1000 * nekomataExpectedMultiplier * 1.2 * (794 / (794 + 700)) * 0.8 * 1.5
const nekomataChecks = [
  {
    id: 'locked-source-revision',
    passed: nekomataEvent.sourceVersion === generalEventSourceCommit,
    evidence: nekomataEvent.sourceVersion,
  },
  {
    id: 'evaluated-for-current-version',
    passed: nekomataEvent.targetVersion === '3.1',
    evidence: nekomataEvent.targetVersion,
  },
  {
    id: 'source-byte-provenance',
    passed:
      nekomataEvent.evidenceRefs.length === 2 &&
      nekomataEvent.evidenceRefs.every((ref) => ref.includes('sha256:')),
    evidence: nekomataEvent.evidenceRefs.join('|'),
  },
  {
    id: 'skill-multiplier-independent-recalculation',
    passed: Math.abs(nekomataResolvedMultiplier - nekomataExpectedMultiplier) < 1e-12,
    evidence: `${nekomataResolvedMultiplier}`,
  },
  {
    id: 'full-damage-independent-recalculation',
    passed: Math.abs(nekomataOracle.expectedDamage - nekomataIndependentExpectedDamage) < 1e-9,
    evidence: `${nekomataOracle.expectedDamage}`,
  },
] as const
if (nekomataChecks.some((check) => !check.passed))
  throw new Error('Nekomata Planning direct support adoption revalidation failed')

const nekomataAdoptionCore = {
  schema: 'soda-planning-direct-support-adoption/v1',
  adoptionId: 'planning-direct-nekomata-source-event-3.1-r1',
  gameVersion: '3.1',
  agentId: 'agent-nekomata',
  eventId: nekomataEvent.eventId,
  formulaFamily: 'standard_direct_event_bundle',
  formulaHash: planningDirectEventBundleFormulaHash,
  sourceRevision: {
    repository: 'frzyc/genshin-optimizer',
    commit: generalEventSourceCommit,
    license: 'MIT',
    evidenceRefs: nekomataEvent.evidenceRefs,
  },
  state: 'runtime_adapter_ready',
  checks: nekomataChecks,
  fieldStates: {
    eventDefinition: 'formal',
    versionApplicability: 'formal',
    formulaCore: 'formal',
    independentRecalculation: 'formal',
    realAccountFinalStats: 'verified_runtime_projection_available',
    planningBaseline: 'required_per_execution',
    planningResult: 'supported_only_when_runtime_contract_is_complete',
  },
  boundary:
    'This closes one Nekomata runtime adapter, not a precomputed account result, complete rotation, team contribution, or BOX optimum.',
} as const

export const planningDirectNekomataEventAdoption = Object.freeze({
  ...nekomataAdoptionCore,
  contentHash: stableContentHash(nekomataAdoptionCore),
})

export const planningDirectSourceAssessments = Object.freeze([
  {
    agentId: 'agent-billy',
    state: 'runtime_adapter_ready',
    nextEvidence: [
      'Bind a selected real-account build and named PlanningBaseline for each execution.',
    ],
  },
  {
    agentId: 'agent-nekomata',
    state: 'runtime_adapter_ready',
    nextEvidence: [
      'Bind a selected real-account build and named PlanningBaseline for each execution.',
    ],
  },
  {
    agentId: 'agent-remielle',
    state: 'blocked_formula_family',
    nextEvidence: [
      'Close Lumiflux/anomaly or special-settlement semantics before direct-family adoption.',
    ],
  },
])
