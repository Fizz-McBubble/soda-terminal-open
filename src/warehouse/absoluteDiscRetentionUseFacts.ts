/**
 * Soda Terminal: absolute-retention sourced fact resolver.
 * Evaluates drive disc two-piece stat effects and combat action utilities
 * based on verified source contracts and explicit agent mechanics.
 */
import type { CandidateWarehouseConstraint } from '../gameDataPacks/candidateWarehouseConstraints'
import type { StatKey } from '../domain/schemas'
import { getCurrentAgentEventContract } from '../calculation/currentAgentMechanicContracts'
import { getCurrentAgentDecisionMechanicContract } from '../calculation/currentAgentDecisionMechanicContracts'
import { resolveCurrentReleasedIdentity } from '../gameDataPacks/currentReleasedIdentityMap'
import { agentCatalog } from '../assault/catalogData'
import {
  EFFECT_TO_DOMAIN_STAT,
  ELEMENT_EFFECT_MAP,
  resolveEffectUtility,
} from './absoluteDiscRetentionEffectUtility'
import { resolveActionUtility } from './absoluteDiscRetentionActionUtility'
import { getReviewedNormalM0UseScope } from './reviewedRetentionUseScope'
import {
  normalRetentionFunctionalContext,
  resolveRetentionFunctionalStatEvidence,
  retentionFunctionalStatEvidencePolicy,
  type FunctionalStatContext,
} from './retentionFunctionalStatEvidence'

export type RetentionUtilityState =
  | 'valid'
  | 'conditional'
  | 'incidental'
  | 'incompatible'
  | 'missing_fact'

export type RetentionUtilityEvidence = {
  state: RetentionUtilityState
  predicateId: string
  evidenceIds: string[]
  detail: string
}

export type RetentionUseFacts = {
  effects: Record<string, RetentionUtilityEvidence>
  actions: Record<string, RetentionUtilityEvidence>
  sourceIds: string[]
  goal: 'crit_damage' | 'anomaly_damage' | 'functional' | 'unknown'
  scalingStats: string[]
  coreStats: string[]
  functionalStatPolicy?: string
}

export const STAT_EFFECT_KEYS = [
  'atk_',
  'hp_',
  'def_',
  'crit_',
  'crit_dmg_',
  'anomProf',
  'anomMas_',
  'impact_',
  'enerRegen_',
  'pen_',
  'dazeInc_',
  'shield_',
  'physical_dmg_',
  'fire_dmg_',
  'ice_dmg_',
  'electric_dmg_',
  'ether_dmg_',
  'wind_dmg_',
] as const

export const ACTION_KEYS = ['basic', 'dash', 'aftershock'] as const

const CORE_STAT_KEY_MAP: Record<string, StatKey> = {
  atk: 'atk_flat',
  hp: 'hp_flat',
  def: 'def_flat',
  crit_rate: 'crit_rate',
  critRate: 'crit_rate',
  crit_: 'crit_rate',
  crit_dmg: 'crit_dmg',
  critDamage: 'crit_dmg',
  crit_dmg_: 'crit_dmg',
  anomProf: 'anomaly_proficiency',
  anomMas: 'anomaly_mastery',
  impact: 'impact',
  enerRegen: 'energy_regen',
  pen: 'pen',
  pen_ratio: 'pen_ratio',
}

const catalogMap = new Map<
  string,
  { name: string; role: string; externalId: string; rarity: string; attribute: string }
>(
  agentCatalog.map(([stableId, name, role, externalId, rarity, attribute]) => [
    stableId,
    { name, role, externalId, rarity, attribute },
  ]),
)

function resolveSources(constraint: CandidateWarehouseConstraint): string[] {
  return constraint.sources
    .filter((s) => s.verified)
    .map((s) => (s.contentHash ? `${s.id}:${s.contentHash}` : s.id))
}

function resolveAttribute(agentId: string, eventAttr?: string): string {
  if (eventAttr && eventAttr !== 'auric-ink') return eventAttr
  return catalogMap.get(agentId)?.attribute ?? 'physical'
}

function hasActiveShieldMechanic(
  agentId: string,
  eventContract: ReturnType<typeof getCurrentAgentEventContract>,
  decisionContract: ReturnType<typeof getCurrentAgentDecisionMechanicContract>,
): boolean {
  const released = resolveCurrentReleasedIdentity(agentId)
  if (released === 'agent-caesar' || released === 'agent-seth' || released === 'agent-ben')
    return true
  if (
    decisionContract?.effectContract?.effects?.some(
      (e) =>
        /shield/i.test(e.effectId) ||
        /shield/i.test(e.locator) ||
        JSON.stringify(e.numericExpression).includes('shield'),
    )
  )
    return true
  if (
    eventContract?.eventContract?.events?.some(
      (e) => /shield/i.test(e.actionId) || /shield/i.test(e.skill),
    )
  )
    return true
  // Mentioning a teammate shield, or "no shield", is not proof that this agent generates one.
  return false
}

function detectHpScaling(
  agentId: string,
  constraint: CandidateWarehouseConstraint,
  decisionContract: ReturnType<typeof getCurrentAgentDecisionMechanicContract>,
): boolean {
  const mains = Object.values(constraint.mainStats).flat()
  if (mains.includes('hp_percent') || (constraint.subStatWeights['hp_percent'] ?? 0) > 0)
    return true
  const released = resolveCurrentReleasedIdentity(agentId)
  if (released === 'agent-manato' || released === 'agent-yixuan' || released === 'agent-yidhari')
    return true
  return (
    decisionContract?.effectContract?.effects?.some(
      (e) =>
        !/^m[1-6](?:_|$)/i.test(e.effectId) &&
        /sheer/i.test(e.effectId) &&
        JSON.stringify(e.numericExpression).includes('own.final.hp'),
    ) ?? false
  )
}

function detectDefScaling(agentId: string, constraint: CandidateWarehouseConstraint): boolean {
  const mains = Object.values(constraint.mainStats).flat()
  if (mains.includes('def_percent') || (constraint.subStatWeights['def_percent'] ?? 0) > 0)
    return true
  return resolveCurrentReleasedIdentity(agentId) === 'agent-ben'
}

function detectSheerBypassesDefense(
  agentId: string,
  decisionContract: ReturnType<typeof getCurrentAgentDecisionMechanicContract>,
  role?: string | null,
): boolean {
  if (role === 'rupture') return true
  const released = resolveCurrentReleasedIdentity(agentId)
  if (released === 'agent-yixuan' || released === 'agent-yidhari') return true
  return (
    decisionContract?.effectContract?.effects?.some(
      (e) => !/^m[1-6](?:_|$)/i.test(e.effectId) && /sheer/i.test(e.effectId),
    ) ?? false
  )
}

function isAnomalyCritException(agentId: string): boolean {
  return resolveCurrentReleasedIdentity(agentId) === 'agent-jane'
}

function determineGoal(
  constraint: CandidateWarehouseConstraint,
  role: string | null | undefined,
  specialty: string | null | undefined,
  isJane: boolean,
): 'crit_damage' | 'anomaly_damage' | 'functional' | 'unknown' {
  if (constraint.status === 'missing' || constraint.sources.length === 0) return 'unknown'
  const norm = specialty ?? (role === 'damage' ? 'attack' : role)
  const fourthSlot = constraint.mainStats['4'] ?? []
  if (fourthSlot.includes('crit_rate') || fourthSlot.includes('crit_dmg')) return 'crit_damage'
  if (norm === 'stun' || norm === 'support') return 'functional'
  if (norm === 'defense') {
    const mains = Object.values(constraint.mainStats).flat()
    return mains.some((s) => s === 'crit_dmg' || s === 'crit_rate' || s === 'fire_dmg')
      ? 'crit_damage'
      : 'functional'
  }
  if (fourthSlot.includes('anomaly_proficiency') || isJane || norm === 'anomaly')
    return 'anomaly_damage'
  if (norm === 'attack' || norm === 'rupture' || role === 'damage') return 'crit_damage'
  const mains = Object.values(constraint.mainStats).flat()
  return mains.some((s) => s === 'crit_rate' || s === 'crit_dmg') ? 'crit_damage' : 'functional'
}

function determineScalingStats(
  constraint: CandidateWarehouseConstraint,
  goal: 'crit_damage' | 'anomaly_damage' | 'functional' | 'unknown',
  hpScaling: boolean,
  defScaling: boolean,
  isJane: boolean,
  attributeKey?: StatKey,
): string[] {
  const stats = new Set<string>()
  for (const list of Object.values(constraint.mainStats))
    for (const stat of list ?? []) stats.add(stat)
  for (const [stat, weight] of Object.entries(constraint.subStatWeights ?? {}))
    if (weight && weight > 0) stats.add(stat)
  if (hpScaling) stats.add('hp_percent')
  if (defScaling) stats.add('def_percent')
  if (goal === 'crit_damage' || isJane) {
    stats.add('crit_rate')
    stats.add('crit_dmg')
  }
  if (goal === 'anomaly_damage' || isJane) {
    stats.add('anomaly_proficiency')
    stats.add('anomaly_mastery')
  }
  if (attributeKey) stats.add(attributeKey)
  return [...stats]
}

function determineCoreStats(
  eventContract: ReturnType<typeof getCurrentAgentEventContract>,
): string[] {
  if (!eventContract?.coreStats?.length) return []
  const last = eventContract.coreStats[eventContract.coreStats.length - 1]
  if (!last) return []
  const domainStats = new Set<string>()
  for (const [key, value] of Object.entries(last)) {
    if (typeof value === 'number' && value > 0) {
      const mapped = CORE_STAT_KEY_MAP[key]
      if (mapped) domainStats.add(mapped)
    }
  }
  return [...domainStats]
}

export function resolveRetentionUseFacts(
  constraint: CandidateWarehouseConstraint,
  agentId: string,
  functionalContext: FunctionalStatContext = normalRetentionFunctionalContext,
): RetentionUseFacts {
  const releasedId = resolveCurrentReleasedIdentity(agentId)
  const catalogEntry = catalogMap.get(releasedId)
  const eventContract = getCurrentAgentEventContract(releasedId)
  const decisionContract = getCurrentAgentDecisionMechanicContract(releasedId)

  const role = catalogEntry?.role ?? eventContract?.identity.specialty
  const specialty = eventContract?.identity.specialty ?? catalogEntry?.role
  const agentAttr = resolveAttribute(releasedId, eventContract?.identity.attribute)

  const sourceIds = [
    ...resolveSources(constraint),
    ...(eventContract
      ? [
          `${eventContract.source.repository}:${eventContract.source.commit}:${eventContract.source.formulaSha256}`,
        ]
      : []),
  ]
  const isJane = isAnomalyCritException(releasedId)
  const hasShield = hasActiveShieldMechanic(releasedId, eventContract, decisionContract)
  const hpScaling = detectHpScaling(releasedId, constraint, decisionContract)
  const defScaling = detectDefScaling(releasedId, constraint)
  const sheerDefenseBypass = detectSheerBypassesDefense(releasedId, decisionContract, role)

  const goal = determineGoal(constraint, role, specialty, isJane)
  const attributeStatKey = EFFECT_TO_DOMAIN_STAT[ELEMENT_EFFECT_MAP[agentAttr] ?? '']
  const scalingStats = determineScalingStats(
    constraint,
    goal,
    hpScaling,
    defScaling,
    isJane,
    attributeStatKey,
  )
  const coreStats = determineCoreStats(eventContract)

  const functionalStatEvidence = Object.fromEntries(
    ['atk_', 'hp_', 'def_', 'anomProf', 'crit_', 'crit_dmg_'].map((effectStat) => [
      effectStat,
      resolveRetentionFunctionalStatEvidence({
        agentId: releasedId,
        effectStat,
        context: {
          ...functionalContext,
          unconsumedShieldOrHealing:
            hasShield && !decisionContract?.effectContract?.functionalInputs.length,
        },
      }),
    ]),
  )
  const context = {
    hasShield,
    hpScaling,
    defScaling,
    sheerDefenseBypass,
    isJane,
    role,
    functionalStatEvidence,
  }
  sourceIds.push(
    retentionFunctionalStatEvidencePolicy,
    ...Object.values(functionalStatEvidence).map(
      (evidence) => `functional-stat-context:${evidence.fingerprint}`,
    ),
  )

  const effects = Object.fromEntries(
    STAT_EFFECT_KEYS.map((s) => [
      s,
      resolveEffectUtility(s, releasedId, constraint, goal, agentAttr, sourceIds, context),
    ]),
  )
  const actions = Object.fromEntries(
    ACTION_KEYS.map((a) => [
      a,
      resolveActionUtility(
        a,
        releasedId,
        constraint,
        eventContract,
        sourceIds,
        getReviewedNormalM0UseScope(constraint, releasedId, goal, eventContract),
      ),
    ]),
  )

  return {
    effects,
    actions,
    sourceIds,
    goal,
    scalingStats,
    coreStats,
    functionalStatPolicy: retentionFunctionalStatEvidencePolicy,
  }
}
