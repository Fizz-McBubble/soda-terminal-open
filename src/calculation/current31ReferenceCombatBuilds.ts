import { createStaticReferenceEquipment } from './staticReferenceBuild'
import { getCandidateWarehouseConstraint } from '../gameDataPacks/candidateWarehouseConstraints'
import { resolveCurrentDriveDiscTwoPieceModifiers } from '../gameDataPacks/currentDriveDiscFormulaCatalog'
import { stableContentHash } from '../gameDataPacks/types'
import { getCurrentAgentDecisionMechanicContract } from './currentAgentDecisionMechanicContracts'
import { getCurrentAgentEventContract } from './currentAgentMechanicContracts'
import { projectOutOfCombatPanel, resolveDriveDiscMainStatValue } from './outOfCombatPanel'
import type { ReferenceCombatInput } from './referenceCombatContract'

export const version = '3.1'
export const policyId = 'reference-build-60-core7-skill12-p1-54-rolls/v1'
export const policySourceId = 'declared-reference-policy'
const sourceCommit = 'eabba1f092b282cccb3f028b7253a1db3dac5208'
export const sourceRoot = `https://github.com/frzyc/genshin-optimizer/blob/${sourceCommit}/`
const stamp = '2026-09-13T00:00:00.000Z'
export const templateAgentIds = new Set(['agent-ye-shunguang', 'agent-zhao', 'agent-sunna'])

/** Frozen choices, not observations of a player's equipment or an optimized roll search. */
export const current31ReferenceCombatBuildPolicy = Object.freeze({
  id: policyId,
  level: 60,
  coreLevel: 7,
  skillLevel: 12,
  mindscape: 0,
  mainStatChoice: 'first_explicit_recommendation' as const,
  setChoice: 'first_explicit_4_plus_2_branch' as const,
  engineChoice: 'first_resolvable_recommendation_s_p1_a_p5' as const,
  substatRollsPerDisc: 9,
  substatRollsTotal: 54,
  substatAllocation: [3, 2, 2, 2] as const,
  substatChoice: 'four_highest_weight_legal_stats_excluding_main' as const,
  initialState: 'prepared_action_sequence_not_battle_entry' as const,
  accountInventoryAuthority: false,
})

export function required<T>(value: T | null | undefined, label: string): T {
  if (value === null || value === undefined) throw new Error(`Reference binding missing: ${label}`)
  return value
}

export function defaults(agentId: string): Readonly<Record<string, unknown>> {
  return required(getCurrentAgentDecisionMechanicContract(agentId), agentId).effectContract
    .runtimeDefaults.references
}

export function parameter(agentId: string, path: string, index?: number) {
  const raw = defaults(agentId)[path]
  const value = index === undefined ? raw : Array.isArray(raw) ? raw[index] : undefined
  if (typeof value !== 'number' || !Number.isFinite(value))
    throw new Error(`Reference parameter missing: ${agentId}:${path}`)
  return value
}

function makeReferenceBuild(agentId: string) {
  const recommendation = required(getCandidateWarehouseConstraint(agentId), agentId)
  const { engineId, engine, refinement, discs } = createStaticReferenceEquipment({
    agentId,
    recommendation,
    stamp,
    version,
  })
  const contract = required(getCurrentAgentEventContract(agentId), agentId)
  // Panel core is the A–F upgrade index (0–5); effect skill tables use level 7 index 6.
  const panel = projectOutOfCombatPanel({
    agentId,
    level: 60,
    ascension: 5,
    core: 5,
    mindscape: 0,
    wEngine: { id: engineId, level: 60, ascension: 5, refinement },
    discs,
  })
  if (panel.status !== 'ok')
    throw new Error(`Reference panel unsupported: ${agentId}: ${panel.reason}`)
  const setCounts = new Map<string, number>()
  for (const disc of discs) setCounts.set(disc.setId, (setCounts.get(disc.setId) ?? 0) + 1)
  const attribute = contract.identity.attribute
  const mainDamageBonus = discs.reduce((sum, disc) => {
    const main = resolveDriveDiscMainStatValue(disc)
    return sum + (main?.stat === `${attribute}_dmg` ? main.value / 100 : 0)
  }, 0)
  const setDamageBonus = [...setCounts].reduce(
    (sum, [setId, count]) =>
      sum +
      resolveCurrentDriveDiscTwoPieceModifiers(setId, count)
        .filter((modifier) => modifier.stat === `${attribute}_dmg_`)
        .reduce((total, modifier) => total + modifier.value, 0),
    0,
  )
  const baseAttack = panel.trace
    .filter((row) => row.key === 'atk' && row.operation === 'base')
    .reduce((sum, row) => sum + (typeof row.value === 'number' ? row.value : 0), 0)
  const stats: ReferenceCombatInput['members'][number]['stats'] = {
    attack: panel.values.atk,
    baseAttack,
    critRate: panel.values.critRate / 100,
    critDamage: panel.values.critDamage / 100,
    anomalyProficiency: panel.values.anomalyProficiency,
    penetrationRatio: panel.values.penRatio / 100,
    penetrationFlat: panel.values.pen,
    damageBonus: mainDamageBonus + setDamageBonus,
  }
  // Locked common/index.ts:71–83 uses 0.3 ATK for rupture; Yixuan adds final HP × dm.core.sheerForce.
  if (contract.identity.specialty === 'rupture') {
    stats.sheerForceAttackRatio = 0.3
    stats.sheerForce =
      stats.attack * stats.sheerForceAttackRatio +
      (agentId === 'agent-yixuan' ? panel.values.hp * parameter(agentId, 'dm.core.sheerForce') : 0)
  }
  const buildHash = stableContentHash({ policyId, agentId, engineId, refinement, discs, stats })
  return {
    agentId,
    engineId,
    refinement,
    discs,
    panel: panel.values,
    stats,
    buildHash,
    recommendationHash: recommendation.contentHash,
    source: contract.source,
    engineSource: engine.source,
  }
}

export type Build = ReturnType<typeof makeReferenceBuild>
export const buildCache = new Map<string, Build>()
export function buildFor(agentId: string) {
  if (!buildCache.has(agentId)) buildCache.set(agentId, makeReferenceBuild(agentId))
  return required(buildCache.get(agentId), agentId)
}
