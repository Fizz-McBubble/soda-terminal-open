import { driveDiscData } from '../data/gameData'
import type { DriveDisc, StatKey } from '../domain/schemas'
import type { CandidateWarehouseConstraint } from '../gameDataPacks/candidateWarehouseConstraints'
import { resolveBuildIntentWEngineIds } from '../gameDataPacks/buildIntentWEngineIdentity'
import { getCurrentWEngineStaticData } from '../gameDataPacks/currentWEngineStaticCatalog'

/** Shared frozen legal equipment recipe; no combat effects, inventory or optimization. */
export const staticReferenceEquipmentPolicy = Object.freeze({
  mainStatChoice: 'first_explicit_recommendation',
  setChoice: 'first_explicit_4_plus_2_branch',
  engineChoice: 'first_resolvable_recommendation_s_p1_a_p5',
  substatRollsPerDisc: 9,
  substatRollsTotal: 54,
  substatAllocation: [3, 2, 2, 2] as const,
  substatChoice: 'four_highest_weight_legal_stats_excluding_main',
})
function required<T>(value: T | null | undefined, label: string): T {
  if (value === null || value === undefined) throw new Error(`Reference binding missing: ${label}`)
  return value
}

export function createStaticReferenceEquipment(input: {
  agentId: string
  recommendation: CandidateWarehouseConstraint
  stamp: string
  version: string
}) {
  const { agentId, recommendation, stamp, version } = input
  const sets = recommendation.setPlanReadiness
  if (sets.status !== 'executable' || sets.pattern !== '4+2')
    throw new Error(`Reference build requires an explicit 4+2 branch: ${agentId}`)
  const engineId = required(
    resolveBuildIntentWEngineIds(agentId, recommendation.wEngineDirections)[0],
    `${agentId}:engine`,
  )
  const engine = required(getCurrentWEngineStaticData(engineId), engineId)
  const rules = required(driveDiscData, 'disc rules').rules.subStatStepsByRarity.S
  const fixedMains: StatKey[] = ['hp_flat', 'atk_flat', 'def_flat']
  const discs: DriveDisc[] = Array.from({ length: 6 }, (_, index) => {
    const slot = (index + 1) as DriveDisc['slot']
    const mainStat = required(
      index < 3
        ? fixedMains[index]
        : recommendation.mainStats[String(slot) as '4' | '5' | '6']?.[0],
      `${agentId}:main:${slot}`,
    )
    const substatRules = rules
      .filter((rule) => rule.stat !== mainStat)
      .sort(
        (a, b) =>
          (recommendation.subStatWeights[b.stat] ?? 0) -
            (recommendation.subStatWeights[a.stat] ?? 0) || a.stat.localeCompare(b.stat),
      )
      .slice(0, 4)
    return {
      id: `reference:${agentId}:slot-${slot}`,
      slot,
      level: 15,
      rarity: 'S',
      setId: required(
        index < 4 ? sets.primarySetIds[0] : sets.secondarySetIds[0],
        `${agentId}:set`,
      ),
      mainStat,
      subStats: substatRules.map((rule, rank) => ({
        stat: rule.stat,
        value: rule.baseValue * staticReferenceEquipmentPolicy.substatAllocation[rank],
        upgrades: staticReferenceEquipmentPolicy.substatAllocation[rank] - 1,
      })),
      locked: false,
      favorite: false,
      tags: [],
      createdAt: stamp,
      updatedAt: stamp,
      dataVersion: version,
    }
  })
  const refinement = engine.rarity === 'S' ? 1 : 5
  return { engineId, engine, refinement, discs }
}
