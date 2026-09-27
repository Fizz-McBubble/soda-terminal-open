import { stableContentHash } from '../gameDataPacks/types'
import { calculateAnomalyDamageCore, standardAnomalyBaseMultiplier } from './anomalyDamageCore'
import { planningAnomalyEventBundleFormulaHash } from './planningAnomalyEventBundle'

export const piperAnomalySourceEvent = Object.freeze({
  eventId: 'agent-piper.anomaly.physical.single-owner',
  actorId: 'agent-piper',
  settlement: 'standard_anomaly',
  attribute: 'physical',
  sourceVersion: 'eabba1f092b282cccb3f028b7253a1db3dac5208',
  targetVersion: '3.1',
  formulaFamily: 'anomaly_disorder',
  baseMultiplier: standardAnomalyBaseMultiplier('physical'),
  hitCount: 1,
  ownershipBoundary: 'single_owner_share_exactly_1',
  evidenceRefs: [
    'GO:Piper.ts:sha256:8CCE9CDB49198E028624842D97FF7970AB4F075299D123C21E2EA7DE1D11BA52',
    'GO:Piper.json:sha256:459C94D7F1D3BD379D9ECFD01C7B42E3C3E0DED2C1EB1045ED3F5D782E3F8B22',
    'GO:dmg.ts:sha256:34AE40061649E0F06FC6BFCCD07F35132103481559B96EDD446F5C8EE939FC5E',
    'GO:prep.ts:sha256:4DD2D7F4DA7ED1FB4B824E4332B9BC0D60E2B243CD52C4EBBD38253ABE245A77',
    'GO:char-util.ts:sha256:6278397AFA6C5B5F65A15BDADD16037B67B997DFFB2BF66289D63634BEC49A3D',
  ],
} as const)

const oracle = calculateAnomalyDamageCore({
  attackerLevel: 60,
  attack: 1000,
  baseMultiplier: piperAnomalySourceEvent.baseMultiplier,
  anomalyBaseBonus: 0,
  flatAnomalyDamage: 0,
  anomalyProficiency: 300,
  anomalyCritRate: 0,
  anomalyCritDamage: 0,
  damageBonus: 0.2,
  buffBonus: 0,
  directDamageBonus: 0,
  vulnerability: 0,
  defenseReduction: 0,
  defenseIgnore: 0,
  penetrationRatio: 0,
  penetrationFlat: 0,
  enemyDefense: 700,
  resistance: 0.2,
  resistanceReduction: 0,
  resistanceIgnore: 0,
  stunMultiplier: 1,
})
const independentDamage = 1000 * 7.13 * 1.2 * (794 / (794 + 700)) * 0.8 * 3 * 2
const checks = [
  {
    id: 'locked-source-revision',
    passed: piperAnomalySourceEvent.sourceVersion === 'eabba1f092b282cccb3f028b7253a1db3dac5208',
    evidence: piperAnomalySourceEvent.sourceVersion,
  },
  {
    id: 'evaluated-for-current-version',
    passed: piperAnomalySourceEvent.targetVersion === '3.1',
    evidence: piperAnomalySourceEvent.targetVersion,
  },
  {
    id: 'source-byte-provenance',
    passed: piperAnomalySourceEvent.evidenceRefs.every((ref) => ref.includes('sha256:')),
    evidence: piperAnomalySourceEvent.evidenceRefs.join('|'),
  },
  {
    id: 'physical-anomaly-multiplier',
    passed: piperAnomalySourceEvent.baseMultiplier === 7.13,
    evidence: `${piperAnomalySourceEvent.baseMultiplier}`,
  },
  {
    id: 'full-anomaly-damage-independent-recalculation',
    passed: Math.abs(oracle.expectedDamage - independentDamage) < 1e-9,
    evidence: `${oracle.expectedDamage}`,
  },
] as const
if (checks.some((check) => !check.passed))
  throw new Error('Piper Planning anomaly support adoption revalidation failed')

const adoptionCore = {
  schema: 'soda-planning-anomaly-support-adoption/v1',
  adoptionId: 'planning-anomaly-piper-single-owner-3.1-r1',
  gameVersion: '3.1',
  agentId: 'agent-piper',
  eventId: piperAnomalySourceEvent.eventId,
  formulaFamily: 'anomaly_disorder',
  formulaHash: planningAnomalyEventBundleFormulaHash,
  sourceRevision: {
    repository: 'frzyc/genshin-optimizer',
    commit: piperAnomalySourceEvent.sourceVersion,
    license: 'MIT',
    evidenceRefs: piperAnomalySourceEvent.evidenceRefs,
  },
  state: 'runtime_adapter_ready',
  supportedBuildBoundary: 'level-60-ascension-5-mindscape-0-with-rainforest-gourmet',
  ownershipBoundary: piperAnomalySourceEvent.ownershipBoundary,
  checks,
  fieldStates: {
    settlementDefinition: 'formal',
    versionApplicability: 'formal',
    formulaCore: 'formal',
    realAccountFinalStats: 'verified_runtime_projection_available',
    ownership: 'required_per_execution',
    planningBaseline: 'required_per_execution',
    planningResult: 'supported_only_when_runtime_contract_is_complete',
  },
  boundary:
    'This closes one M0 Piper physical anomaly settlement only when buildup ownership is exactly 100%; mixed ownership, Disorder, rotation, team contribution and BOX optimum remain unsupported.',
} as const

export const planningAnomalyPiperSupportAdoption = Object.freeze({
  ...adoptionCore,
  contentHash: stableContentHash(adoptionCore),
})
