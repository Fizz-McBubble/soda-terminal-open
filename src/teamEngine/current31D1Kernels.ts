import type { PairSynergyKernel, TeamEngineEvidenceRef, TeamPredicate } from './contracts'
import { defineTeamMethodKernel } from './teamMethodR1'

type EvidenceKey =
  | 'zhuYuanGuide'
  | 'qingyiGuide'
  | 'astraGuide'
  | 'yixuanGuide'
  | 'panGuide'
  | 'luciaGuide'
  | 'dialynGuide'
  | 'yixuanLuciaDialynSeed'
  | 'yixuanPanSeed'
  | 'yeGuide'
  | 'zhaoGuide'
  | 'sunnaGuide'
  | 'ariaGuide'
  | 'yuzuhaGuide'
  | 'promeiaGuide'
  | 'nangongGuide'
  | 'pyroisGuide'
  | 'normaTeamGuide'
  | 'ultraJakeGuide'
  | 'sproutAdoption'
  | 'biggestFanAdoption'
  | 'knightbooPredicateAdoption'
  | 'knightbooTeamAdoption'

export type Current31D1KernelEvidence = Record<EvidenceKey, TeamEngineEvidenceRef> & {
  coverageDiscoverySeed: (row: number, family: string) => TeamEngineEvidenceRef
}

type CurrentKernelFacts = {
  identity: { kernelId: string; familyId: string; label: string }
  formation: {
    coreAgentIds: [string, string]
    eligibleThirdAgentIds: string[]
    allowedInactiveAdditionalAbilityAgentIds?: string[]
  }
  closure: {
    predicates: TeamPredicate[]
    producedTags: string[]
    effectTags: string[]
  }
  scenarioTags: string[]
  strength: PairSynergyKernel['strengthEvidence']
}

const specialty = (specialty: string, minimum = 1): TeamPredicate => ({
  kind: 'specialty_count',
  specialty,
  minimum,
})

function currentKernel(facts: CurrentKernelFacts) {
  return defineTeamMethodKernel({
    currentVersion: '3.1',
    identity: facts.identity,
    formation: {
      ...facts.formation,
      allowedInactiveAdditionalAbilityAgentIds:
        facts.formation.allowedInactiveAdditionalAbilityAgentIds ?? [],
    },
    mechanismClosure: {
      requiredTeamPredicates: facts.closure.predicates,
      requiredProducedTags: facts.closure.producedTags,
    },
    effectCoverage: { requiredEffectTags: facts.closure.effectTags },
    scenarios: { scenarioTags: facts.scenarioTags },
    currentStrength: facts.strength,
  })
}

/** Current 3.1 facts only; all method judgments are delegated to Team Method R1. */
export function buildCurrent31D1Kernels(e: Current31D1KernelEvidence) {
  return [
    currentKernel({
      identity: {
        kernelId: 'kernel-3.1-zhu-yuan-qingyi-astra',
        familyId: 'family-zhu-yuan-stun-shells',
        label: '朱鸢·青衣失衡弹药核心',
      },
      formation: {
        coreAgentIds: ['agent-zhu-yuan', 'agent-qingyi'],
        eligibleThirdAgentIds: ['agent-astra'],
      },
      closure: {
        predicates: [specialty('damage'), specialty('stun'), specialty('support')],
        producedTags: ['enhanced_shells', 'stun_window', 'chain_attack_refill'],
        effectTags: ['stun_multiplier', 'team_attack'],
      },
      scenarioTags: ['single_target_boss', 'stun_window_burst', 'ether_damage'],
      strength: {
        tier: 'current_viable_candidate',
        score: 60,
        claim:
          '机制上能形成失衡窗弹药爆发，但当前证据明确朱鸢已被新以太输出压过，只能列为稳定可用。',
        refs: [e.zhuYuanGuide, e.qingyiGuide, e.astraGuide],
      },
    }),
    currentKernel({
      identity: {
        kernelId: 'kernel-3.1-yixuan-pan-astra',
        familyId: 'family-yixuan-rupture',
        label: '仪玄·潘引壶命破支援核心',
      },
      formation: {
        coreAgentIds: ['agent-yixuan', 'agent-pan-yinhu'],
        eligibleThirdAgentIds: ['agent-astra'],
      },
      closure: {
        predicates: [specialty('rupture'), specialty('defense'), specialty('support')],
        producedTags: ['adrenaline', 'sheer_force_buff', 'quick_assist'],
        effectTags: ['sheer_force_buff', 'damage_taken_debuff', 'team_attack'],
      },
      scenarioTags: ['sheer_damage', 'sustained_boss', 'low_field_time_support'],
      strength: {
        tier: 'current_strong_candidate',
        score: 82,
        claim:
          '潘引壶补齐命破专属增益与受伤增幅，耀嘉音以低站场提供全队支援；当前仍为 Candidate 强度。',
        refs: [e.yixuanGuide, e.panGuide, e.astraGuide, e.yixuanPanSeed],
      },
    }),
    currentKernel({
      identity: {
        kernelId: 'kernel-3.1-yixuan-lucia-dialyn',
        familyId: 'family-yixuan-rupture',
        label: '仪玄·卢西娅·琉音命破失衡核心',
      },
      formation: {
        coreAgentIds: ['agent-yixuan', 'agent-lucia'],
        eligibleThirdAgentIds: ['agent-dialyn'],
      },
      closure: {
        predicates: [specialty('rupture'), specialty('support'), specialty('stun')],
        producedTags: ['adrenaline', 'ether_veil', 'stun_window'],
        effectTags: ['rupture_amplification', 'stun_multiplier'],
      },
      scenarioTags: ['sheer_damage', 'stun_window_burst', 'high_pressure', 'support_general'],
      strength: {
        tier: 'current_strong_candidate',
        score: 79,
        claim:
          '沿用现有仪玄 current strong 核心强度边界；卢西娅与琉音的 current 机制事实补齐贯穿、失衡与终结技闭环。兼容 score 不参与跨 family 排序，且不来自 synthesis seed 的 current_top、S/SS/SSS 或 non_damage_index。',
        refs: [e.yixuanGuide, e.luciaGuide, e.dialynGuide, e.yixuanLuciaDialynSeed],
      },
    }),
    currentKernel({
      identity: {
        kernelId: 'kernel-3.1-ye-dialyn-zhao',
        familyId: 'family-ye-veil-attack',
        label: '叶瞬光·琉音·照帷幕强攻核心',
      },
      formation: {
        coreAgentIds: ['agent-ye-shunguang', 'agent-dialyn'],
        eligibleThirdAgentIds: ['agent-zhao'],
      },
      closure: {
        predicates: [specialty('damage'), specialty('stun'), specialty('defense')],
        producedTags: [
          'qingming_sword_force',
          'enlightened_mind',
          'ether_veil',
          'ultimate_conversion',
        ],
        effectTags: ['veil_vulnerability', 'stun_multiplier', 'team_damage'],
      },
      scenarioTags: ['veil_attack', 'stun_window_burst', 'physical_damage'],
      strength: {
        tier: 'current_strong_candidate',
        score: 0,
        claim:
          '叶瞬光以青溟剑势进入明心境，照提供 Ether Veil，琉音补齐失衡与终结技转换；当前来源支持 strong Candidate，兼容 score 不参与排序。',
        refs: [
          e.yeGuide,
          e.dialynGuide,
          e.zhaoGuide,
          e.sproutAdoption,
          e.coverageDiscoverySeed(30, 'Ye veil attack'),
        ],
      },
    }),
    currentKernel({
      identity: {
        kernelId: 'kernel-3.1-aria-sunna-yuzuha',
        familyId: 'family-aria-frontline-anomaly',
        label: '爱芮·千夏·柚叶前台异常核心',
      },
      formation: {
        coreAgentIds: ['agent-aria', 'agent-sunna'],
        eligibleThirdAgentIds: ['agent-yuzuha'],
      },
      closure: {
        predicates: [
          specialty('anomaly'),
          specialty('support', 2),
          { kind: 'faction_count', faction: '妄想天使', minimum: 2 },
        ],
        producedTags: ['fandom', 'perfect_pitch', 'abloom', 'cat_gaze', 'anomaly_amplification'],
        effectTags: ['abloom_damage', 'cat_gaze', 'team_attack', 'anomaly_amplification'],
      },
      scenarioTags: ['angels_anomaly', 'abloom', 'sustained_boss'],
      strength: {
        tier: 'current_strong_candidate',
        score: 0,
        claim:
          "爱芮的 Fandom、Perfect Pitch 与 Abloom 由千夏 Cat's Gaze、帷幕增益及柚叶异常/紊乱增益闭合；当前来源支持 strong Candidate，兼容 score 不参与排序。",
        refs: [
          e.ariaGuide,
          e.sunnaGuide,
          e.yuzuhaGuide,
          e.biggestFanAdoption,
          e.coverageDiscoverySeed(31, 'Aria frontline anomaly'),
        ],
      },
    }),
    currentKernel({
      identity: {
        kernelId: 'kernel-3.1-promeia-nangong-yuzuha',
        familyId: 'family-promeia-polarity-anomaly',
        label: '普罗米娅·南宫羽·柚叶冰异常极性核心',
      },
      formation: {
        coreAgentIds: ['agent-promeia', 'agent-nangong'],
        eligibleThirdAgentIds: ['agent-yuzuha'],
      },
      closure: {
        predicates: [specialty('anomaly'), specialty('stun'), specialty('support')],
        producedTags: [
          'corrosive_chill',
          'trial_by_cold',
          'abloom',
          'polarity_disorder',
          'vibrato',
          'anomaly_amplification',
        ],
        effectTags: ['abloom_damage', 'stun_multiplier', 'anomaly_amplification'],
      },
      scenarioTags: ['polarity_abloom', 'ice_anomaly', 'stun_window_burst'],
      strength: {
        tier: 'current_strong_candidate',
        score: 0,
        claim:
          '普罗米娅的 Corrosive Chill、Trial by Cold 与 Abloom 由南宫羽的 Polarity Disorder/Vibrato 和柚叶异常增益闭合；当前来源支持 strong Candidate，兼容 score 不参与排序。',
        refs: [
          e.promeiaGuide,
          e.nangongGuide,
          e.yuzuhaGuide,
          e.knightbooPredicateAdoption,
          e.knightbooTeamAdoption,
          e.coverageDiscoverySeed(22, 'Promeia polarity anomaly'),
        ],
      },
    }),
    currentKernel({
      identity: {
        kernelId: 'kernel-3.1-pyrois-norma-sunna',
        familyId: 'family-pyrois-norma-chain-burst',
        label: '佩洛伊斯·诺姆·千夏连携爆发核心',
      },
      formation: {
        coreAgentIds: ['agent-pyrois', 'agent-norma'],
        eligibleThirdAgentIds: ['agent-sunna'],
      },
      closure: {
        predicates: [specialty('damage'), specialty('stun'), specialty('support')],
        producedTags: [
          'celestial_light',
          'chain_burst',
          'preheated_chamber',
          'chain_attack_refill',
          'tech_divide',
        ],
        effectTags: ['stun_multiplier', 'team_damage', 'team_attack'],
      },
      scenarioTags: ['chain_attack_burst', 'stun_window_burst', 'ether_damage'],
      strength: {
        tier: 'current_strong_candidate',
        score: 0,
        claim:
          '佩洛伊斯的 Celestial Light、连携与终结技循环由诺姆 Preheated Chamber、Quick Assist 转连携及 Tech Divide 衔接，千夏补足增益；当前来源支持 strong Candidate，兼容 score 不参与排序。',
        refs: [
          e.pyroisGuide,
          e.normaTeamGuide,
          e.sunnaGuide,
          e.ultraJakeGuide,
          e.coverageDiscoverySeed(13, 'Pyrois Norma chain burst'),
        ],
      },
    }),
  ]
}
