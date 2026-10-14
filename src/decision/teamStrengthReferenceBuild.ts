import { getCurrentAgentEventContract } from '../calculation/currentAgentMechanicContracts'
import type {
  PlanningEffectRuntimeMember,
  PlanningEffectRuntimeStats,
} from '../calculation/currentPlanningEffectDomain'
import {
  projectOutOfCombatPanel,
  resolveDriveDiscMainStatValue,
} from '../calculation/outOfCombatPanel'
import {
  createStaticReferenceEquipment,
  staticReferenceEquipmentPolicy,
} from '../calculation/staticReferenceBuild'
import { getCandidateWarehouseConstraintForTeam } from '../gameDataPacks/candidateWarehouseConstraints'
import { resolveCurrentDriveDiscTwoPieceModifiers } from '../gameDataPacks/currentDriveDiscFormulaCatalog'
import { currentFormulaBaseStats } from '../gameDataPacks/currentFormulaBaseStats'
import { stableContentHash } from '../gameDataPacks/types'
import {
  resolveTeamStrengthReferencePotential,
  teamStrengthReferenceStateIdentity,
  teamStrengthReferenceStatePolicy,
} from './teamStrengthReferenceState'
import type { TeamStrengthReferenceConditions } from './teamStrengthReferenceConditionsTypes'

/** Declared equipped comparison protocol, independent of the frozen skill12 reference. */
export const teamStrengthEquippedReferenceBuildPolicy = Object.freeze({
  ...teamStrengthReferenceStatePolicy,
  ...staticReferenceEquipmentPolicy,
  id: 'team-strength-equipped-level60-skill11-core7-m0-supported-p6-54-rolls/v1',
  equipment: 'declared_static_4_plus_2',
  initialState: 'out_of_combat_static_panel',
  conditionalEquipmentEffects: 'owned-by-explicit-event-consumer',
  accountInventoryAuthority: false,
})

export function createTeamStrengthEquippedReferenceMember(input: {
  agentId: string
  memberIds?: readonly string[]
  referenceConditions?: TeamStrengthReferenceConditions
}) {
  const { agentId, memberIds, referenceConditions } = input
  const requestIdentity = stableContentHash({
    policy: teamStrengthEquippedReferenceBuildPolicy,
    sourceState: teamStrengthReferenceStateIdentity,
    agentId,
    memberIds: memberIds && [...memberIds].sort(),
    referenceConditions,
  })
  try {
    const contract = getCurrentAgentEventContract(agentId)
    if (!contract) throw new Error(`缺少角色事件合同：${agentId}`)
    const potential = resolveTeamStrengthReferencePotential(agentId, referenceConditions)
    const agentStateById = Object.fromEntries(
      (memberIds ?? [agentId]).map((id) => [
        id,
        { potentialImage: resolveTeamStrengthReferencePotential(id, referenceConditions) },
      ]),
    )
    const recommendation = getCandidateWarehouseConstraintForTeam(agentId, {
      memberIds,
      agentStateById,
    })
    if (!recommendation) throw new Error(`缺少标准装备方向：${agentId}`)
    const equipment = createStaticReferenceEquipment({
      agentId,
      recommendation,
      stamp: '2026-10-14T00:00:00.000Z',
      version: '3.2',
    })
    const panel = projectOutOfCombatPanel({
      agentId,
      level: 60,
      ascension: 5,
      core: 5,
      mindscape: 0,
      potentialImage: potential,
      wEngine: {
        id: equipment.engineId,
        level: 60,
        ascension: 5,
        refinement: equipment.refinement,
      },
      discs: equipment.discs,
    })
    if (panel.status !== 'ok') throw new Error(`标准装备面板不可执行：${agentId}：${panel.reason}`)
    const counts = new Map<string, number>()
    for (const disc of equipment.discs) counts.set(disc.setId, (counts.get(disc.setId) ?? 0) + 1)
    const damageBonusesByAttribute: Record<string, number> = {}
    for (const attribute of ['physical', 'fire', 'ice', 'electric', 'wind', 'ether']) {
      const mainBonus = equipment.discs.reduce((sum, disc) => {
        const main = resolveDriveDiscMainStatValue(disc)
        return sum + (main?.stat === `${attribute}_dmg` ? main.value / 100 : 0)
      }, 0)
      damageBonusesByAttribute[attribute] =
        mainBonus +
        [...counts].reduce(
          (sum, [id, count]) =>
            sum +
            resolveCurrentDriveDiscTwoPieceModifiers(id, count)
              .filter((m) => m.stat === `${attribute}_dmg_`)
              .reduce((total, m) => total + m.value, 0),
          0,
        )
    }
    const baseValue = (key: 'atk' | 'def') =>
      panel.trace
        .filter((row) => row.key === key && row.operation === 'base')
        .reduce((sum, row) => sum + (typeof row.value === 'number' ? row.value : 0), 0)
    const p = panel.values
    const stats: PlanningEffectRuntimeStats = {
      atk: p.atk,
      def: p.def,
      hp: p.hp,
      baseAttack: baseValue('atk'),
      baseDefense: baseValue('def'),
      crit_: p.critRate / 100,
      crit_dmg_: p.critDamage / 100,
      anomMas: p.anomalyMastery,
      anomProf: p.anomalyProficiency,
      impact: p.impact,
      pen_: p.penRatio / 100,
      pen: p.pen,
      enerRegen: p.energyRegen,
      lacerationDamage: p.lacerationDamage / 100,
      sharpDamageBonus: currentFormulaBaseStats.sharpDamageBonus,
      damageBonus: damageBonusesByAttribute[contract.identity.attribute] ?? 0,
      damageBonusesByAttribute,
    }
    if (
      !Object.values(stats)
        .filter((value) => typeof value === 'number')
        .every(Number.isFinite)
    )
      throw new Error(`标准装备面板含非有限数值：${agentId}`)
    const runtimeMember: PlanningEffectRuntimeMember = {
      agentId,
      level: 60,
      mindscape: 0,
      potential,
      coreLevel: 7,
      skillLevels: { basic: 11, dodge: 11, assist: 11, special: 11, chain: 11, core: 7 },
      initialStats: { ...stats },
      finalStats: { ...stats },
    }
    const sourceRefs = [
      ...new Set([
        `${contract.source.repository}@${contract.source.commit}`,
        `${contract.source.statsPath}#${contract.source.statsSha256}`,
        ...panel.trace.map((row) => row.source),
        ...recommendation.sources.map((source) => source.url),
        ...(referenceConditions?.evidenceRefs ?? []),
      ]),
    ]
    const identity = stableContentHash({
      requestIdentity,
      recommendationHash: recommendation.contentHash,
      equipment: {
        engineId: equipment.engineId,
        refinement: equipment.refinement,
        discs: equipment.discs,
      },
      engineSource: equipment.engine.source,
      runtimeMember,
      sourceRefs,
    })
    return {
      status: 'ready' as const,
      runtimeMember,
      equipment: {
        engineId: equipment.engineId,
        refinement: equipment.refinement,
        discs: equipment.discs,
      },
      identity,
      sourceRefs,
      limitations: [
        '声明静态参考装备，不是账户装备或作者毕业观测。',
        '四件套、音擎战斗被动、资源及窗口只由显式事件消费者激活。',
        '贯穿力及条件转化由现行来源事件公式消费，不预置满层或持续循环。',
      ],
    }
  } catch (error) {
    return {
      status: 'unsupported' as const,
      reason: error instanceof Error ? error.message : String(error),
      identity: requestIdentity,
    }
  }
}
