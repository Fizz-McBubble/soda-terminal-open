import targetFields from '../gameDataPacks/data/reviewed-external-support-target31.3.1.json'
import { getCurrentAgentDecisionMechanicContract } from './currentAgentDecisionMechanicContracts'
import {
  evaluateCurrentAgentTeamActivation,
  getCurrentAgentEventContract,
} from './currentAgentMechanicContracts'
import type { PlanningEffectRuntimeMember } from './currentPlanningEffectDomain'
import { canonicalJson, sha256 } from '../application/contentHash'
import { functionalEquipmentGaps32 } from './reviewedFunctionalEquipmentDependencies32'
import {
  createPlanningExpressionDomainRuntime,
  evaluateUpstreamExpressionIr,
  type UpstreamExpressionIR,
} from './currentUpstreamExpressionIR'
import type { ReviewedFunctionalCapacity32 } from './reviewedFunctionalCapacity32'

/** Independent support targets, never damage or a claim that all HP benefits cap. */
export function evaluateReviewedSupportTargetCapacity32(input: {
  member: PlanningEffectRuntimeMember
  members?: readonly PlanningEffectRuntimeMember[]
  equipmentExclusions?: readonly unknown[]
  baselineReferencesByAgentId?: Readonly<Record<string, Readonly<Record<string, unknown>>>>
}) {
  const { member } = input
  const capacities: ReviewedFunctionalCapacity32[] = []
  const blockers: string[] = []
  if (!['agent-zhao', 'agent-lucia', 'agent-remielle'].includes(member.agentId))
    return { capacities, blockers }
  const source = getCurrentAgentDecisionMechanicContract(member.agentId)?.effectContract
  const gaps = functionalEquipmentGaps32(input.equipmentExclusions, member.agentId, [
    member.agentId === 'agent-remielle' ? 'initial.atk' : 'initial.hp',
  ])
  const hp = member.initialStats.hp
  let value: number | null = null
  let context: unknown
  let sourceRefs: string[]
  let key: string
  let included: string[]
  if (member.agentId === 'agent-zhao') {
    key = 'initial_hp_additional_target'
    included = ['已声明以太帷幕中的追加能力伤害加成分量（比率，非团队伤害/DPS）。']
    const row = targetFields.rows.find((row) => row.agentId === member.agentId)
    const check = row?.checks.find((check) => check.locator === 'passive.level.1341507.desc[1]')
    const bound =
      row?.sha256 === '628b4949def6a5f64b44b3f8a8f46b43b9d89946ef4761bcf9bc38721e841361' &&
      check?.level === 7 &&
      check.contains.includes('初始最大生命值达到27000点') &&
      source?.source.formulaSha256 ===
        'D371D769E3EFA7F079DE26EE86762F7001B1025655CAF767D596F79FEF434B15'
    const activation = input.members
      ? evaluateCurrentAgentTeamActivation({
          stableId: member.agentId,
          memberIds: input.members.map((row) => row.agentId),
          agentState: { mindscape: member.mindscape, potentialImage: member.potential },
        })
      : null
    const veil = input.baselineReferencesByAgentId?.[member.agentId]?.inside_any_ether_veil
    const excess = Math.max(0, Math.min(hp, 27000) - 15000)
    // The retained Additional Ability explicitly does not depend on Core level.
    if (
      bound &&
      activation?.status === 'supported' &&
      Number.isFinite(hp) &&
      hp >= 0 &&
      typeof veil === 'boolean' &&
      !gaps.length
    ) {
      // Field-reviewed calculators independently use complete 400-HP steps.
      // Never round the initial panel up across a step or the 27000 cap.
      if (!activation.active || !veil) value = 0
      else value = (10 + Math.floor(excess / 400)) / 100
    }
    context = {
      core: member.coreLevel,
      activation,
      veil,
      source: row?.sha256,
      arithmetic: 'complete-400-initial-hp-steps-floor-r1',
    }
    sourceRefs = row
      ? [
          `reviewed-external-support-target31:${row.sha256}#${check?.locator}`,
          'https://www.prydwen.gg/zenless/characters/zhao#additional-ability-crystallization',
          'https://github.com/ZztIsolation/zzz_calculator/blob/da6a8c08bcc447c49da2bbb657891ded6dfa11d6/data/combat_buffs.json#L648',
          'https://github.com/vidanj/ZZZ_DMG_OPT/blob/23b024e5d72d2a470233688441a236d8608fa73e/zzz_dmg_calc/agent.py#L178-L183',
        ]
      : []
  } else if (member.agentId === 'agent-remielle') {
    key = 'entry_team_attack'
    included = ['入场追加能力的队伍攻击分量，异常人数含自身；非完整队伍伤害。']
    const members = input.members
    const entered = input.baselineReferencesByAgentId?.[member.agentId]?.battlefield_entered
    const activation = members
      ? evaluateCurrentAgentTeamActivation({
          stableId: member.agentId,
          memberIds: members.map((row) => row.agentId),
          agentState: { mindscape: member.mindscape, potentialImage: member.potential },
        })
      : null
    const anomalyCount = members?.filter(
      (row) => getCurrentAgentEventContract(row.agentId)?.identity.specialty === 'anomaly',
    ).length
    const rate =
      anomalyCount === 1 ? 0.06 : anomalyCount === 2 ? 0.12 : anomalyCount === 3 ? 0.4 : null
    if (
      activation?.status === 'supported' &&
      typeof entered === 'boolean' &&
      rate !== null &&
      Number.isFinite(member.initialStats.atk) &&
      member.initialStats.atk >= 0 &&
      !gaps.length &&
      members?.some((row) => row.agentId === member.agentId) &&
      members.length === new Set(members.map((row) => row.agentId)).size
    ) {
      value = activation.active && entered ? Math.min(1600, member.initialStats.atk * rate) : 0
    }
    context = {
      activation,
      entered,
      anomalyCount,
      declaration: 'remielle_entry_initial_atk_component-r2',
    }
    sourceRefs = [
      'https://www.prydwen.gg/zenless/characters/remielle#additional-ability-invitation-to-bloom',
      'R2-input-sha256:29D7A09A80F48EF49EEAB60090E89953B018CAFC56FE39076E1D67D93CE847C2#OBJ-REMIELLE-ATK',
    ]
  } else {
    key = 'ex_special_sheer_force'
    included = ['已声明暗破状态下强化特殊技单项贯穿力增益（非合唱/治疗/总收益）。']
    const effect = source?.effects.find((row) => row.effectId === 'exSpecial_sheerForce')
    const expression = effect?.numericExpression
    const ir = expression?.expressionIr as UpstreamExpressionIR | undefined
    const darkbreaker = input.baselineReferencesByAgentId?.[member.agentId]?.darkbreaker
    const skill = member.skillLevels.special
    const bound =
      source?.source.formulaSha256 ===
        'BB1DEBD0A64DF8367D347CE0511907891B08A0E98FA025726C5D6D28BE94B555' &&
      expression?.expressionSha256 ===
        '1DD9CD057517A714ECB9E929EF1BD3D302F657B7E5D14AAF2BA9A7E55D63C8CB'
    if (
      bound &&
      ir?.kind === 'call' &&
      ir.arguments[0]?.kind === 'call' &&
      typeof darkbreaker === 'boolean' &&
      Number.isInteger(skill) &&
      skill >= 1 &&
      skill <= 16 &&
      Number.isFinite(hp) &&
      hp >= 0 &&
      !gaps.length
    ) {
      // Retain the pinned inner min AST; activation is explicitly observed above.
      const result = evaluateUpstreamExpressionIr(
        ir.arguments[0].arguments[0]!,
        createPlanningExpressionDomainRuntime({
          references: { 'char.special': skill, 'own.initial.hp': hp },
        }),
      )
      if (result.status === 'supported' && typeof result.value === 'number')
        value = darkbreaker ? result.value : 0
    }
    context = { skill, darkbreaker, expression: expression?.expressionSha256 }
    sourceRefs = source
      ? [
          `${source.source.formulaPath}#${source.source.formulaSha256}`,
          `expression:${expression?.expressionSha256}`,
        ]
      : []
  }
  if (value === null)
    blockers.push(`功能目标缺少已核来源、等级、激活或初始属性/装备上下文：${member.agentId}`)
  capacities.push({
    key: `${member.agentId}:${key}`,
    kind: 'source_support_target',
    value,
    contextKey: sha256(canonicalJson(context)),
    sourceRefs,
    included,
    excluded: ['其他属性收益、持续时间、覆盖率、治疗、实际团队伤害。', ...gaps],
  })
  return { capacities, blockers }
}
