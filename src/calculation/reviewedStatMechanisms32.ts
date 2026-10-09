import { PINNED_SOURCE_COMMIT } from './dynamic/sourceExpressionReconciliation'

export type MechanismAdoptionStatus =
  | 'already_bound'
  | 'reconciled_this_batch'
  | 'resolved_intermediate_this_batch'
  | 'pending_shield_contract'

export interface ReviewedMechanismRecord {
  id: string
  agentId: string
  effectId: string | null
  upstreamKey: string
  adoptionStatus: MechanismAdoptionStatus
  inputStat: 'initial' | 'combat' | 'stack' | 'fixed' | 'not_applicable'
  targetStat: string
  notes: string
}

export const reviewedStatMechanisms19: readonly ReviewedMechanismRecord[] = Object.freeze([
  {
    id: 'astra-core-atk',
    agentId: 'agent-astra',
    effectId: 'core_atk',
    upstreamKey: 'AstraYao',
    adoptionStatus: 'already_bound',
    inputStat: 'initial',
    targetStat: 'attack_points',
    notes: '核心加攻已绑定初始攻击 own.initial.atk，核心成长与M2上限已在生产表达式中。',
  },
  {
    id: 'pan-core-sheer',
    agentId: 'agent-pan-yinhu',
    effectId: 'core_sheerForce',
    upstreamKey: 'PanYinhu',
    adoptionStatus: 'reconciled_this_batch',
    inputStat: 'initial',
    targetStat: 'sheer_force_points',
    notes: '本次纠偏：原表达式 own.final.atk 纠偏为 own.initial.atk，M0上限540，M6上限720。',
  },
  {
    id: 'yuzuha-core-atk',
    agentId: 'agent-yuzuha',
    effectId: 'core_atk',
    upstreamKey: 'Yuzuha',
    adoptionStatus: 'already_bound',
    inputStat: 'initial',
    targetStat: 'attack_points',
    notes: '核心加攻已绑定初始攻击 own.initial.atk 与核心上限。',
  },
  {
    id: 'yuzuha-buildup',
    agentId: 'agent-yuzuha',
    effectId: 'ability_anomBuildup_',
    upstreamKey: 'Yuzuha',
    adoptionStatus: 'already_bound',
    inputStat: 'combat',
    targetStat: 'fraction',
    notes: '额外能力积蓄支援已绑定异常掌控 own.final.anomMas（100阈值，0.2上限）。',
  },
  {
    id: 'yuzuha-anomaly-buff',
    agentId: 'agent-yuzuha',
    effectId: 'ability_anomaly_buff_',
    upstreamKey: 'Yuzuha',
    adoptionStatus: 'already_bound',
    inputStat: 'combat',
    targetStat: 'fraction',
    notes: '额外能力伤害支援已绑定异常掌控 own.final.anomMas 与 M1 增幅。',
  },
  {
    id: 'lucy-cheer-atk',
    agentId: 'agent-lucy',
    effectId: 'exSpecial_atk',
    upstreamKey: 'Lucy',
    adoptionStatus: 'already_bound',
    inputStat: 'initial',
    targetStat: 'attack_points',
    notes: '强化特殊技加攻已绑定初始攻击 own.initial.atk 与技能等级，600上限。',
  },
  {
    id: 'rina-core-pen',
    agentId: 'agent-rina',
    effectId: 'core_pen_',
    upstreamKey: 'Rina',
    adoptionStatus: 'already_bound',
    inputStat: 'combat',
    targetStat: 'fraction',
    notes: '核心穿透率已绑定战斗穿透 own.final.pen_，0.3上限与M1近距离修正。',
  },
  {
    id: 'jufufu-roar-cd',
    agentId: 'agent-ju-fufu',
    effectId: 'core_crit_dmg_',
    upstreamKey: 'JuFufu',
    adoptionStatus: 'reconciled_this_batch',
    inputStat: 'initial',
    targetStat: 'fraction',
    notes: '本次纠偏：原表达式 own.final.atk 纠偏为 own.initial.atk，2800门槛，0.3上限。',
  },
  {
    id: 'ben-defense-atk',
    agentId: 'agent-ben',
    effectId: 'core_atk',
    upstreamKey: 'Ben',
    adoptionStatus: 'already_bound',
    inputStat: 'initial',
    targetStat: 'attack_points',
    notes: '核心防御转攻击已绑定初始防御 own.initial.def。',
  },
  {
    id: 'seth-shield-ap',
    agentId: 'agent-seth',
    effectId: 'core_anomProf',
    upstreamKey: 'Seth',
    adoptionStatus: 'already_bound',
    inputStat: 'fixed',
    targetStat: 'proficiency_points',
    notes: '受盾者异常精通来自核心固定等级表，不依赖赛斯自身精通。',
  },
  {
    id: 'seth-shield-strength',
    agentId: 'agent-seth',
    effectId: null,
    upstreamKey: 'Seth',
    adoptionStatus: 'pending_shield_contract',
    inputStat: 'initial',
    targetStat: 'shield_points',
    notes: '护盾值公式 min(3000, initialAtk * core.shield)；非战斗队伍buff，待专属护盾合同。',
  },
  {
    id: 'caesar-fixed-atk',
    agentId: 'agent-caesar',
    effectId: 'core_atk',
    upstreamKey: 'Caesar',
    adoptionStatus: 'already_bound',
    inputStat: 'fixed',
    targetStat: 'attack_points',
    notes: '核心加攻为固定等级数值（M2另乘1.5），不缩放自凯撒自身攻击。',
  },
  {
    id: 'caesar-shield-strength',
    agentId: 'agent-caesar',
    effectId: null,
    upstreamKey: 'Caesar',
    adoptionStatus: 'pending_shield_contract',
    inputStat: 'initial',
    targetStat: 'shield_points',
    notes:
      '护盾值公式 initialImpact * core.shield_ + core.shield；非战斗队伍buff，待专属护盾合同。',
  },
  {
    id: 'jane-passion-atk',
    agentId: 'agent-jane',
    effectId: 'passion_atk',
    upstreamKey: 'Jane',
    adoptionStatus: 'already_bound',
    inputStat: 'combat',
    targetStat: 'attack_points',
    notes: '狂热加攻已绑定战斗异常精通 own.final.anomProf（120门槛，600上限）。',
  },
  {
    id: 'jane-assault-crit',
    agentId: 'agent-jane',
    effectId: 'core_assault_crit_',
    upstreamKey: 'Jane',
    adoptionStatus: 'already_bound',
    inputStat: 'combat',
    targetStat: 'probability',
    notes: '强击暴击率已绑定战斗异常精通 own.final.anomProf。',
  },
  {
    id: 'miyabi-frost-buildup',
    agentId: 'agent-miyabi',
    effectId: 'core_frost_anomBuildup_',
    upstreamKey: 'Miyabi',
    adoptionStatus: 'already_bound',
    inputStat: 'combat',
    targetStat: 'fraction',
    notes: '霜染积蓄提升已绑定战斗暴击率 own.final.crit_（0.8上限）。',
  },
  {
    id: 'alice-mastery-ap',
    agentId: 'agent-alice',
    effectId: 'ability_anomProf',
    upstreamKey: 'Alice',
    adoptionStatus: 'already_bound',
    inputStat: 'combat',
    targetStat: 'proficiency_points',
    notes: '额外能力精通转换已绑定战斗异常掌控 own.final.anomMas（140门槛）。',
  },
  {
    id: 'dialyn-crit-impact',
    agentId: 'agent-dialyn',
    effectId: 'core_impact',
    upstreamKey: 'Dialyn',
    adoptionStatus: 'reconciled_this_batch',
    inputStat: 'initial',
    targetStat: 'impact_points',
    notes: '本次纠偏：原表达式 own.final.crit_ 纠偏为 own.initial.crit_，50%门槛，100冲击上限。',
  },
  {
    id: 'lighter-elation-damage',
    agentId: 'agent-lighter',
    effectId: 'ability_fire_dmg_',
    upstreamKey: 'Lighter',
    adoptionStatus: 'resolved_intermediate_this_batch',
    inputStat: 'stack',
    targetStat: 'fraction',
    notes:
      '本次解析：中间表达式 ability_ice_fire_dmg_check 展开，按层数、战斗冲击、M2、额外能力求值。',
  },
])

export function getReviewedMechanismAdoptionSummary() {
  const total = reviewedStatMechanisms19.length
  const alreadyBound = reviewedStatMechanisms19.filter(
    (r) => r.adoptionStatus === 'already_bound',
  ).length
  const reconciledThisBatch = reviewedStatMechanisms19.filter(
    (r) => r.adoptionStatus === 'reconciled_this_batch',
  ).length
  const resolvedIntermediateThisBatch = reviewedStatMechanisms19.filter(
    (r) => r.adoptionStatus === 'resolved_intermediate_this_batch',
  ).length
  const pendingShieldContract = reviewedStatMechanisms19.filter(
    (r) => r.adoptionStatus === 'pending_shield_contract',
  ).length

  return {
    total,
    alreadyBound,
    reconciledThisBatch,
    resolvedIntermediateThisBatch,
    pendingShieldContract,
    sourceCommit: PINNED_SOURCE_COMMIT,
  }
}
