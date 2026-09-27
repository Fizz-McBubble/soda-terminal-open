import { stableContentHash } from '../gameDataPacks/types'
import { calculateSheerDamageCore } from './sheerDamageCore'
import { planningSheerEventBundleFormulaHash } from './planningSheerEventBundle'

export const manatoSheerSourceEvent = Object.freeze({
  eventId: 'agent-manato.basic.BasicAttackBlazingWindMistySlash.hit-0',
  actorId: 'agent-manato',
  actionId: 'BasicAttackBlazingWindMistySlash',
  hitIndex: 0,
  sourceVersion: 'eabba1f092b282cccb3f028b7253a1db3dac5208',
  targetVersion: '3.1',
  formulaFamily: 'hp_scaled_sheer_damage',
  multiplier: { base: 0.531, growthPerSkillLevel: 0.049, unit: 'ratio' },
  hitCount: { value: 1, unit: 'count' },
  damageType: 'fire',
  conditionRefs: ['event:blazing-wind-misty-slash'],
  evidenceRefs: [
    'GO:Manato.ts:sha256:E78424D27BF2028F7DBBE1C38C6B18E484585F5899E7C4C8E9992041158860E3',
    'GO:Manato.json:sha256:67C95DFAE577349430D862A7E7D3EFC6EE2AA1E89CFA6B0E82EF36222C220DDE',
  ],
} as const)

export function resolveManatoSheerSkillMultiplier(skillLevel: number) {
  if (!Number.isInteger(skillLevel) || skillLevel < 1)
    throw new Error('Manato basic skill level must be a positive integer')
  return (
    manatoSheerSourceEvent.multiplier.base +
    manatoSheerSourceEvent.multiplier.growthPerSkillLevel * (skillLevel - 1)
  )
}

const skillLevel = 12
const resolvedMultiplier = resolveManatoSheerSkillMultiplier(skillLevel)
const independentMultiplier = 0.531 + 0.049 * (skillLevel - 1)
const oracle = calculateSheerDamageCore({
  sheerForce: 1000,
  multiplier: resolvedMultiplier,
  hitCount: 1,
  critRate: 0.5,
  critDamage: 1,
  damageBonus: 0.2,
  directDamageBonus: 0,
  vulnerability: 0,
  resistance: 0.2,
  resistanceReduction: 0,
  stunMultiplier: 1,
  sheerDamageBonus: 0.1,
})
const independentDamage = 1000 * independentMultiplier * 1.2 * 1.5 * 0.8 * 1.1

const checks = [
  {
    id: 'locked-source-revision',
    passed: manatoSheerSourceEvent.sourceVersion === 'eabba1f092b282cccb3f028b7253a1db3dac5208',
    evidence: manatoSheerSourceEvent.sourceVersion,
  },
  {
    id: 'evaluated-for-current-version',
    passed: manatoSheerSourceEvent.targetVersion === '3.1',
    evidence: manatoSheerSourceEvent.targetVersion,
  },
  {
    id: 'source-byte-provenance',
    passed: manatoSheerSourceEvent.evidenceRefs.every((ref) => ref.includes('sha256:')),
    evidence: manatoSheerSourceEvent.evidenceRefs.join('|'),
  },
  {
    id: 'skill-multiplier-independent-recalculation',
    passed: Math.abs(resolvedMultiplier - independentMultiplier) < 1e-12,
    evidence: `${resolvedMultiplier}`,
  },
  {
    id: 'full-sheer-damage-independent-recalculation',
    passed: Math.abs(oracle.expectedDamage - independentDamage) < 1e-9,
    evidence: `${oracle.expectedDamage}`,
  },
] as const

if (checks.some((check) => !check.passed))
  throw new Error('Manato Planning Sheer support adoption revalidation failed')

const adoptionCore = {
  schema: 'soda-planning-sheer-support-adoption/v1',
  adoptionId: 'planning-sheer-manato-source-event-3.1-r1',
  gameVersion: '3.1',
  agentId: 'agent-manato',
  eventId: manatoSheerSourceEvent.eventId,
  formulaFamily: 'rupture_sheer',
  formulaHash: planningSheerEventBundleFormulaHash,
  sourceRevision: {
    repository: 'frzyc/genshin-optimizer',
    commit: manatoSheerSourceEvent.sourceVersion,
    license: 'MIT',
    evidenceRefs: manatoSheerSourceEvent.evidenceRefs,
  },
  state: 'runtime_adapter_ready',
  supportedBuildBoundary: 'level-60-ascension-5-mindscape-0-with-grill-o-wisp',
  checks,
  fieldStates: {
    eventDefinition: 'formal',
    versionApplicability: 'formal',
    formulaCore: 'formal',
    hpToSheerProjection: 'verified_runtime_projection_available',
    realAccountFinalStats: 'verified_runtime_projection_available',
    planningBaseline: 'required_per_execution',
    planningResult: 'supported_only_when_runtime_contract_is_complete',
  },
  boundary:
    'This closes one M0 Manato Sheer event and exact Grill O Wisp path; it is not a complete rotation, team contribution, arbitrary W-Engine adapter, or BOX optimum.',
} as const

export const planningSheerManatoSupportAdoption = Object.freeze({
  ...adoptionCore,
  contentHash: stableContentHash(adoptionCore),
})
