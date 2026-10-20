import { getCurrentAgentEventContract } from '../calculation/currentAgentMechanicContracts'
import type {
  PlanningEffectRuntimeMember,
  PlanningEffectRuntimeStats,
} from '../calculation/currentPlanningEffectDomain'
import {
  projectOutOfCombatPanel,
  resolveDriveDiscMainStatValue,
} from '../calculation/outOfCombatPanel'
import { createStaticReferenceEquipment } from '../calculation/staticReferenceBuild'
import { getCandidateWarehouseConstraintForTeam } from '../gameDataPacks/candidateWarehouseConstraints'
import { resolveCurrentDriveDiscTwoPieceModifiers } from '../gameDataPacks/currentDriveDiscFormulaCatalog'
import { currentFormulaBaseStats } from '../gameDataPacks/currentFormulaBaseStats'
import { stableContentHash } from '../gameDataPacks/types'
import {
  resolveTeamStrengthReferenceMindscape,
  resolveTeamStrengthReferencePotential,
  teamStrengthReferenceStateIdentity,
  teamStrengthReferenceStatePolicy,
} from './teamStrengthReferenceState'
import type { TeamStrengthReferenceConditions } from './teamStrengthReferenceConditionsTypes'
import { getCurrentWEngineStaticData } from '../gameDataPacks/currentWEngineStaticCatalog'
import type { DriveDisc } from '../domain/schemas'
import {
  createStandardReferenceDiscSeed,
  validateStandardReferenceDiscs,
} from '../calculation/standardReferenceDiscAllocation'
import { currentAgentDirectory } from '../assault/catalog'
import {
  resolveSkillInvestmentMindscapeBonus,
  skillInvestmentMindscapeSource,
} from './skillInvestmentProjection'

export type StandardReferenceEquipmentSelection = {
  engineId: string
  refinement: number
  discs: DriveDisc[]
  objectiveIdentity: string
  identity: string
}

export const localStandardReferenceBuildPolicy = {
  id: 'local-standard-level60-base-skill11-core7-s0-a6-legal48/v1',
  mindscape: { S: 0, A: 6 },
  baseSkillLevel: 11,
  coreLevel: 7,
  effectiveSkillSource: skillInvestmentMindscapeSource,
} as const

/** Declared equipped comparison protocol, independent of the frozen skill12 reference. */
export const teamStrengthEquippedReferenceBuildPolicy = Object.freeze({
  ...teamStrengthReferenceStatePolicy,
  id: 'team-strength-equipped-level60-base-skill11-core7-s0-a6-supported-p6-legal48-seed/v5',
  engineDirectionBinding: 'leading-source-named-current-stable-id-before-legacy-alias',
  equipment: 'source_qualified_4_plus_2_template_with_legal_48_seed',
  mainStatChoice: 'first_explicit_recommendation',
  setChoice: 'first_explicit_4_plus_2_branch',
  engineChoice: 'first_resolvable_recommendation_s_p1_a_p5',
  discBudget: '3x48-rolls-balanced20-objective28-not-claimed-optimal',
  initialState: 'out_of_combat_static_panel',
  conditionalEquipmentEffects: 'owned-by-explicit-event-consumer',
  accountInventoryAuthority: false,
})

export function createTeamStrengthEquippedReferenceMember(input: {
  agentId: string
  memberIds?: readonly string[]
  referenceConditions?: TeamStrengthReferenceConditions
  /** An explicitly solved local-standard slice; absence retains the historical protocol. */
  standardEquipmentSelection?: StandardReferenceEquipmentSelection
}) {
  const { agentId, memberIds, referenceConditions, standardEquipmentSelection } = input
  const requestIdentity = stableContentHash({
    policy: standardEquipmentSelection
      ? localStandardReferenceBuildPolicy
      : teamStrengthEquippedReferenceBuildPolicy,
    sourceState: teamStrengthReferenceStateIdentity,
    agentId,
    memberIds: memberIds && [...memberIds].sort(),
    referenceConditions,
    ...(standardEquipmentSelection ? { standardEquipmentSelection } : {}),
  })
  try {
    const contract = getCurrentAgentEventContract(agentId)
    if (!contract) throw new Error(`缺少角色事件合同：${agentId}`)
    const rarity = currentAgentDirectory.find((row) => row.id === agentId)?.rarity
    if (rarity !== 'S' && rarity !== 'A') throw new Error('标准培养条件缺少明确S/A身份。')
    const mindscape = resolveTeamStrengthReferenceMindscape(agentId)
    const skillLevel = 11 + (resolveSkillInvestmentMindscapeBonus(mindscape) ?? 0)
    const potential = resolveTeamStrengthReferencePotential(agentId, referenceConditions)
    const agentStateById = Object.fromEntries(
      (memberIds ?? [agentId]).map((id) => [
        id,
        {
          potentialImage: resolveTeamStrengthReferencePotential(id, referenceConditions),
          mindscape: resolveTeamStrengthReferenceMindscape(id),
        },
      ]),
    )
    const recommendation = getCandidateWarehouseConstraintForTeam(agentId, {
      memberIds,
      agentStateById,
    })
    if (!recommendation) throw new Error(`缺少标准装备方向：${agentId}`)
    // Readiness projects the first branch of any pattern. The frozen model
    // recipe asks for the first complete 4+2 branch, which may be later (Evelyn).
    // Keep its exact pair; never flatten the source's alternative sets.
    const branch = recommendation.setPlans?.find(
      (plan) =>
        plan.pattern === '4+2' && plan.primarySetIds.length > 0 && plan.secondarySetIds.length > 0,
    )
    const sourceSeedEquipment = () => {
      const source = createStaticReferenceEquipment({
        agentId,
        recommendation: {
          ...recommendation,
          ...(branch
            ? {
                setPlanReadiness: {
                  status: 'executable' as const,
                  pattern: branch.pattern,
                  primarySetIds: branch.primarySetIds,
                  secondarySetIds: branch.secondarySetIds,
                },
              }
            : {}),
          // 3.2 reviewed directions already carry exact catalog IDs. Preserve
          // source order and the existing first-resolvable policy; only adopt a
          // leading named option, never an incidental ID inside a caveat.
          wEngineDirections: recommendation.wEngineDirections.map((direction) => {
            const id =
              direction.match(/^(wengine-\d+)(?=$|[（(])/u)?.[1] ??
              direction.match(/^[^（）()：:]*[（(](wengine-\d+)[)）]/u)?.[1]
            return id && getCurrentWEngineStaticData(id) ? id : direction
          }),
        },
        stamp: '2026-10-14T00:00:00.000Z',
        version: '3.2',
      })
      const seed = createStandardReferenceDiscSeed(source.discs)
      if (seed.status !== 'supported') throw new Error(seed.reason)
      return { ...source, discs: seed.discs }
    }
    const equipment = standardEquipmentSelection
      ? (() => {
          const selected = standardEquipmentSelection
          const validation = validateStandardReferenceDiscs(selected.discs)
          if (!validation.valid) throw new Error(`标准48次装备不合法：${validation.reason}`)
          const engine = getCurrentWEngineStaticData(selected.engineId)
          if (
            !engine ||
            engine.specialty !== currentAgentDirectory.find((row) => row.id === agentId)?.specialty
          )
            throw new Error('标准音擎身份或职业不适用。')
          if (selected.refinement !== (engine.rarity === 'S' ? 1 : 5))
            throw new Error('标准音擎精炼须为S1或A/B5。')
          if (!selected.objectiveIdentity || !/^fnv1a-[0-9a-f]{1,8}$/.test(selected.identity))
            throw new Error('标准装备缺少目标与选择身份。')
          return { ...selected, engine }
        })()
      : sourceSeedEquipment()
    const panel = projectOutOfCombatPanel({
      agentId,
      level: 60,
      ascension: 5,
      core: 5,
      mindscape,
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
      mindscape,
      potential,
      coreLevel: 7,
      skillLevels: {
        basic: skillLevel,
        dodge: skillLevel,
        assist: skillLevel,
        special: skillLevel,
        chain: skillLevel,
        core: 7,
      },
      statBasis32: 'out_of_combat',
      initialStats: { ...stats },
      finalStats: { ...stats },
    }
    const sourceRefs = [
      ...new Set([
        `${contract.source.repository}@${contract.source.commit}`,
        `${contract.source.statsPath}#${contract.source.statsSha256}`,
        ...panel.trace.map((row) => row.source),
        ...recommendation.sources.map((source) => source.url),
        ...(standardEquipmentSelection
          ? [`${skillInvestmentMindscapeSource.path}#${skillInvestmentMindscapeSource.sha256}`]
          : []),
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
        '声明源合格主词与套装模板上的合法48次数值种子，不是账户装备、作者毕业观测或整队目标最优。',
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
