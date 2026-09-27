import type { AgentRule, BangbooRule, TeamEngineEvidenceRef, TeamEnginePack } from './contracts'
import { resolveSourceBoundAdditionalAbility } from '../gameDataPacks/reviewedSourceBoundAdditionalAbility'
import {
  reviewedBelionFactionCountMinimumByStar,
  reviewedBiggestFanFactionCountMinimumByStar,
} from '../gameDataPacks/reviewedBangbooActivationSemantics'
import { buildCurrent31D1Kernels } from './current31D1Kernels'
import { current31TeamEngineVerticalSlice } from './current31VerticalSlice'
import { current31MetaStrengthR1 } from './currentMetaStrengthR1'
import {
  current31LegacyCoverageAgentRules,
  current31LegacyCoverageBangbooRules,
  current31LegacyCoverageKernels,
} from './current31LegacyCoverage'
import { compileCurrent31AgentRules } from './current31CompiledAgentRules'

const currentGuide = (sourceId: string, locator: string): TeamEngineEvidenceRef => ({
  sourceId,
  gameVersion: '3.1',
  status: 'candidate',
  locator,
})

const zhuYuanGuide = currentGuide(
  'prydwen-zhu-yuan-3.1-2026-08-24',
  'Core Passive, Additional Ability, current rating and Astra synergy',
)
const qingyiGuide = currentGuide(
  'prydwen-qingyi-3.1-2026-08-24',
  'Additional Ability, field-time demand and stun multiplier',
)
const astraGuide = currentGuide(
  'prydwen-astra-3.1-2026-08-24',
  'Additional Ability, Idyllic Cadenza, Quick Assist and team buffs',
)
const yixuanGuide = currentGuide(
  'prydwen-yixuan-3.1-2026-08-24',
  'Additional Ability, Adrenaline, Sheer Force and current synergy',
)
const panGuide = currentGuide(
  'prydwen-pan-yinhu-3.1-2026-08-24',
  'Additional Ability, Meridian Flow, Depleted Qi and party ordering',
)

/** Keeps a changed adopted catalog from silently retaining the old two-member predicate. */
export function resolveReviewedBelionActivation(
  factionCountMinimumByStar = reviewedBelionFactionCountMinimumByStar,
): BangbooRule['activation'] {
  if (!factionCountMinimumByStar)
    return {
      status: 'unknown',
      description: '狮耶星级激活阈值的已采用数值目录语义绑定失效，待重新审阅。',
      evidence: [yixuanGuide, panGuide],
    }
  return {
    status: 'modeled',
    predicate: { kind: 'faction_count', faction: '云岿山', minimum: 2 },
    factionCountMinimumByStar,
    description: '额外能力要求云岿山代理人：1至2星至少两名，3至5星至少一名。',
    evidence: [yixuanGuide, panGuide],
  }
}

/** Keeps a changed adopted catalog from silently retaining the old two-member predicate. */
export function resolveReviewedBiggestFanActivation(
  factionCountMinimumByStar = reviewedBiggestFanFactionCountMinimumByStar,
): BangbooRule['activation'] {
  if (!factionCountMinimumByStar)
    return {
      status: 'unknown',
      description: '阿饭星级激活阈值的已采用数值目录语义绑定失效，待重新审阅。',
      evidence: [biggestFanAdoption],
    }
  return {
    status: 'modeled',
    predicate: { kind: 'faction_count', faction: '妄想天使', minimum: 2 },
    factionCountMinimumByStar,
    description: '额外能力要求妄想天使代理人：1至2星至少两名，3至5星至少一名。',
    evidence: [biggestFanAdoption],
  }
}
const luciaGuide = currentGuide(
  'prydwen-lucia-page-candidate',
  'Current candidate mechanics: Ether Veil, rupture support and Yixuan team relation',
)
const dialynGuide = currentGuide(
  'prydwen-dialyn-2.4',
  'Current candidate mechanics: stun window, ultimate conversion and Yixuan team relation',
)
const yixuanLuciaDialynSeed: TeamEngineEvidenceRef = {
  sourceId: 'source-user-confirmed-gpt-r2-team-matrix-r92',
  gameVersion: '3.1',
  status: 'limited',
  locator:
    'TEAM_RECOMMENDATIONS_3.1 row 38; candidate discovery and formation evidence only; non_damage_index/current_top are not strength inputs',
}
const yixuanPanSeed: TeamEngineEvidenceRef = {
  sourceId: 'source-user-confirmed-gpt-r2-team-matrix-r92',
  gameVersion: '3.1',
  status: 'limited',
  locator:
    'TEAM_RECOMMENDATIONS_3.1 row 55; formation and Sprout relation only; non_damage_index/S tier are not strength inputs',
}
const yeGuide = currentGuide(
  'prydwen-ye-shunguang-2.5-2026-08-05',
  'Qingming Sword Force, Enlightened Mind, Ether Veil: Verdict, Additional Ability and current strength boundary',
)
const zhaoGuide = currentGuide(
  'prydwen-zhao-current-2026-08-05',
  'Ether Veil: Wellspring, team buffs, Additional Ability and Ye Shunguang synergy',
)
const sunnaGuide = currentGuide(
  'prydwen-sunna-2.6-2026-08-05',
  "Cat's Gaze, Ether Veil, team buffs and Additional Ability",
)
const ariaGuide = currentGuide(
  'prydwen-aria-2.6-2026-08-05',
  'Fandom, Perfect Pitch, Abloom, Additional Ability, current strength and Sunna/Yuzuha synergy',
)
const yuzuhaGuide = currentGuide(
  'prydwen-yuzuha-current-2026-08-05',
  'Tanuki Wish, anomaly/disorder amplification and Additional Ability',
)
const promeiaGuide = currentGuide(
  'prydwen-promeia-2.8-2026-07-29',
  'Corrosive Chill, Trial by Cold, Merciless Judgement, Abloom, Additional Ability and current strength',
)
const nangongGuide = currentGuide(
  'prydwen-nangong-2.7-2026-06-23',
  'Downbeats, Misstep, Dance Prowess, Polarity Disorder, Vibrato and Additional Ability',
)
const pyroisGuide = currentGuide(
  'prydwen-pyrois-3.0-2026-07-29',
  'Celestial Light, Chain/Ultimate loop, Additional Ability and current strength',
)
const normaTeamGuide = currentGuide(
  'icyveins-norma-team-2026-07-28',
  'Norma/Pyrois/Sunna representative team, Preheated Chamber, Tech Divide and Ultra Jake relation',
)
const ultraJakeGuide = currentGuide(
  'noncharacter-r13-source-92653c760e8839ac4499',
  'Additional Ability requires at least one Roscaelifer agent',
)
const sproutAdoption = currentGuide(
  'game8-sprout-ye-team-2026-08-26',
  'Sprout requires Ye Shunguang and directly supports Ye Shunguang/Dialyn/Zhao',
)
const biggestFanAdoption = currentGuide(
  'gamevika-biggest-fan-predicate-2026-08-26',
  'Additional Ability requires two Angels of Delusion agents',
)
const knightbooPredicateAdoption = currentGuide(
  'zzz-wiki-knightboo-support-predicate-2026-08-26',
  'Additional Ability requires at least one Support agent',
)
const knightbooTeamAdoption = currentGuide(
  'gladiatorboost-promeia-knightboo-team-2026-08-26',
  'Promeia/Nangong/Yuzuha representative team uses Knightboo',
)
const coverageDiscoverySeed = (row: number, family: string): TeamEngineEvidenceRef => ({
  sourceId: 'source-user-confirmed-gpt-r2-team-matrix-r92',
  gameVersion: '3.1',
  status: 'limited',
  locator: `TEAM_RECOMMENDATIONS_3.1 row ${row}; ${family} discovery/formation only; current_top, S/SS/SSS and non_damage_index are not strength inputs`,
})

const d1AgentRules: AgentRule[] = [
  {
    agentId: 'agent-zhu-yuan',
    name: '朱鸢',
    releaseState: 'released',
    specialty: 'damage',
    faction: '新艾利都治安局',
    attribute: 'ether',
    fieldTimeDemand: 0.55,
    produces: ['enhanced_shells', 'ether_burst'],
    consumes: ['enhanced_shells', 'stun_window'],
    effects: [],
    additionalAbility: {
      status: 'modeled',
      predicate: {
        kind: 'any',
        predicates: [
          { kind: 'specialty_count', specialty: 'support', minimum: 1 },
          { kind: 'faction_count', faction: '新艾利都治安局', minimum: 2 },
        ],
      },
      description: '需要支援或同阵营队友。',
    },
    evidence: [zhuYuanGuide],
  },
  {
    agentId: 'agent-qingyi',
    name: '青衣',
    releaseState: 'released',
    specialty: 'stun',
    faction: '新艾利都治安局',
    attribute: 'electric',
    fieldTimeDemand: 0.6,
    produces: ['stun_window', 'stun_multiplier', 'voltage'],
    consumes: ['voltage'],
    effects: [{ tag: 'stun_multiplier', recipient: 'enemy' }],
    additionalAbility: {
      status: 'modeled',
      predicate: {
        kind: 'any',
        predicates: [
          { kind: 'specialty_count', specialty: 'damage', minimum: 1 },
          { kind: 'faction_count', faction: '新艾利都治安局', minimum: 2 },
        ],
      },
      description: '需要强攻或同阵营队友。',
    },
    evidence: [qingyiGuide],
  },
  {
    agentId: 'agent-astra',
    name: '耀嘉音',
    releaseState: 'released',
    specialty: 'support',
    faction: '天琴座',
    attribute: 'ether',
    fieldTimeDemand: 0.1,
    produces: ['team_attack', 'team_damage', 'quick_assist', 'chain_attack_refill'],
    consumes: [],
    effects: [
      { tag: 'team_attack', recipient: 'team' },
      { tag: 'team_damage', recipient: 'team' },
    ],
    additionalAbility: {
      status: 'modeled',
      predicate: {
        kind: 'any',
        predicates: [
          { kind: 'specialty_count', specialty: 'damage', minimum: 1 },
          { kind: 'specialty_count', specialty: 'anomaly', minimum: 1 },
          { kind: 'specialty_count', specialty: 'rupture', minimum: 1 },
        ],
      },
      description: '需要强攻、异常或命破队友。',
    },
    evidence: [astraGuide],
  },
  {
    agentId: 'agent-yixuan',
    name: '仪玄',
    releaseState: 'released',
    specialty: 'rupture',
    faction: '云岿山',
    attribute: 'ether',
    fieldTimeDemand: 0.8,
    produces: ['adrenaline', 'sheer_damage', 'auric_ink_corruption'],
    consumes: ['adrenaline'],
    effects: [],
    additionalAbility: {
      status: 'modeled',
      predicate: {
        kind: 'any',
        predicates: [
          { kind: 'specialty_count', specialty: 'stun', minimum: 1 },
          { kind: 'specialty_count', specialty: 'support', minimum: 1 },
          { kind: 'specialty_count', specialty: 'defense', minimum: 1 },
        ],
      },
      description: '需要击破、支援或防护队友。',
    },
    evidence: [yixuanGuide],
  },
  {
    agentId: 'agent-pan-yinhu',
    name: '潘引壶',
    releaseState: 'released',
    specialty: 'defense',
    faction: '云岿山',
    attribute: 'physical',
    fieldTimeDemand: 0.15,
    produces: ['sheer_force_buff', 'adrenaline', 'quick_assist'],
    consumes: [],
    effects: [
      { tag: 'sheer_force_buff', recipient: 'active_agent' },
      { tag: 'damage_taken_debuff', recipient: 'enemy' },
    ],
    additionalAbility: {
      status: 'modeled',
      predicate: {
        kind: 'any',
        predicates: [
          { kind: 'specialty_count', specialty: 'rupture', minimum: 1 },
          { kind: 'faction_count', faction: '云岿山', minimum: 2 },
        ],
      },
      description: '需要命破或同阵营队友。',
    },
    evidence: [panGuide],
  },
  {
    agentId: 'agent-lucia',
    name: '卢西娅',
    releaseState: 'released',
    specialty: 'support',
    faction: '怪啖屋',
    attribute: 'ether',
    fieldTimeDemand: 0.2,
    produces: ['ether_veil', 'rupture_amplification', 'quick_assist'],
    consumes: [],
    effects: [{ tag: 'rupture_amplification', recipient: 'team' }],
    additionalAbility: {
      status: 'modeled',
      predicate: {
        kind: 'any',
        predicates: [
          { kind: 'specialty_count', specialty: 'rupture', minimum: 1 },
          { kind: 'specialty_count', specialty: 'stun', minimum: 1 },
        ],
      },
      description: '需要命破或击破队友触发额外能力。',
    },
    evidence: [
      luciaGuide,
      yixuanLuciaDialynSeed,
      {
        sourceId: 'miyoushe-75217294-lucia-additional-ability',
        gameVersion: '2.8',
        status: 'candidate',
        locator:
          'https://www.miyoushe.com/zzz/article/75217294; op61 image252936807; imageSha256=f79f9da41ba490b4dc5813794d862a7b1a908eb545e211da19302f2dfa0af316; 触发条件：队伍中存在命破/击破角色',
      },
    ],
  },
  {
    agentId: 'agent-dialyn',
    name: '琉音',
    releaseState: 'released',
    specialty: 'stun',
    faction: '坎卜斯黑枝',
    attribute: 'physical',
    fieldTimeDemand: 0.3,
    produces: ['stun_window', 'ultimate_conversion'],
    consumes: [],
    effects: [{ tag: 'stun_multiplier', recipient: 'enemy' }],
    additionalAbility: {
      status: 'modeled',
      predicate: {
        kind: 'any',
        predicates: [
          { kind: 'specialty_count', specialty: 'damage', minimum: 1 },
          { kind: 'specialty_count', specialty: 'rupture', minimum: 1 },
        ],
      },
      description: '需要强攻或命破队友承接失衡期终结技转换。',
    },
    evidence: [dialynGuide, yixuanLuciaDialynSeed],
  },
  {
    agentId: 'agent-ye-shunguang',
    name: '叶瞬光',
    releaseState: 'released',
    specialty: 'damage',
    faction: '云岿山',
    attribute: 'physical',
    fieldTimeDemand: 0.8,
    produces: ['qingming_sword_force', 'enlightened_mind', 'ether_veil_verdict'],
    consumes: ['qingming_sword_force', 'ether_veil'],
    effects: [{ tag: 'veil_vulnerability', recipient: 'enemy' }],
    additionalAbility: {
      status: 'modeled',
      predicate: {
        kind: 'any',
        predicates: [
          { kind: 'specialty_count', specialty: 'support', minimum: 1 },
          { kind: 'specialty_count', specialty: 'defense', minimum: 1 },
        ],
      },
      description: '需要支援或防护队友承接帷幕与剑势循环。',
    },
    evidence: [yeGuide, sproutAdoption],
  },
  {
    agentId: 'agent-zhao',
    name: '照',
    releaseState: 'released',
    specialty: 'defense',
    faction: '坎卜斯黑枝',
    attribute: 'ice',
    fieldTimeDemand: 0.15,
    produces: ['ether_veil', 'team_attack', 'team_damage'],
    consumes: [],
    effects: [
      { tag: 'team_attack', recipient: 'team' },
      { tag: 'team_damage', recipient: 'team' },
    ],
    additionalAbility: {
      status: 'modeled',
      predicate: {
        kind: 'any',
        predicates: [
          { kind: 'specialty_count', specialty: 'damage', minimum: 1 },
          { kind: 'specialty_count', specialty: 'anomaly', minimum: 1 },
          { kind: 'specialty_count', specialty: 'support', minimum: 1 },
        ],
      },
      description: '需要强攻、异常或支援队友。',
    },
    evidence: [zhaoGuide, yeGuide],
  },
  {
    agentId: 'agent-aria',
    name: '爱芮',
    releaseState: 'released',
    specialty: 'anomaly',
    faction: '妄想天使',
    attribute: 'ether',
    fieldTimeDemand: 0.65,
    produces: ['ether_anomaly', 'anomaly_driver', 'fandom', 'perfect_pitch', 'abloom'],
    consumes: ['fandom'],
    effects: [{ tag: 'abloom_damage', recipient: 'enemy' }],
    additionalAbility: {
      status: 'modeled',
      predicate: {
        kind: 'any',
        predicates: [
          { kind: 'specialty_count', specialty: 'stun', minimum: 1 },
          { kind: 'specialty_count', specialty: 'support', minimum: 1 },
          { kind: 'faction_count', faction: '妄想天使', minimum: 2 },
          { kind: 'specialty_count', specialty: 'anomaly', minimum: 2 },
        ],
      },
      description: '需要击破、支援、同阵营或其他异常队友。',
    },
    evidence: [
      ariaGuide,
      sunnaGuide,
      yuzuhaGuide,
      {
        sourceId: 'nanoka-3.1-aria-1501-additional-ability',
        gameVersion: '3.1',
        status: 'candidate',
        locator:
          'https://static.nanoka.cc/zzz/3.1/zh/character/1501.json; passive.level.1501049.desc[1] (core level 1, no potential); sha256=d2610095c6d441de080800a6a90399344db6c9f0734c571e8456eadd3b6646a7; corroborates miyoushe77029270/op29 version update',
      },
    ],
  },
  {
    agentId: 'agent-sunna',
    name: '千夏',
    releaseState: 'released',
    specialty: 'support',
    faction: '妄想天使',
    attribute: 'physical',
    fieldTimeDemand: 0.15,
    produces: ['cat_gaze', 'claw_sharpener', 'ether_veil', 'team_attack', 'stun_multiplier'],
    consumes: ['claw_sharpener'],
    effects: [
      { tag: 'team_attack', recipient: 'team' },
      { tag: 'stun_multiplier', recipient: 'enemy' },
      { tag: 'cat_gaze', recipient: 'enemy' },
    ],
    additionalAbility: {
      status: 'modeled',
      predicate: {
        kind: 'any',
        predicates: [
          { kind: 'specialty_count', specialty: 'damage', minimum: 1 },
          { kind: 'faction_count', faction: '妄想天使', minimum: 2 },
        ],
      },
      description: '需要强攻或同阵营队友。',
    },
    evidence: [sunnaGuide],
  },
  {
    agentId: 'agent-yuzuha',
    name: '柚叶',
    releaseState: 'released',
    specialty: 'support',
    faction: '怪啖屋',
    attribute: 'physical',
    fieldTimeDemand: 0.15,
    produces: ['sugar_points', 'anomaly_amplification', 'disorder_amplification', 'aftershock'],
    consumes: ['sugar_points'],
    effects: [
      { tag: 'anomaly_amplification', recipient: 'team' },
      { tag: 'disorder_amplification', recipient: 'team' },
    ],
    additionalAbility: {
      status: 'modeled',
      predicate: {
        kind: 'any',
        predicates: [
          { kind: 'specialty_count', specialty: 'anomaly', minimum: 1 },
          { kind: 'faction_count', faction: '怪啖屋', minimum: 2 },
        ],
      },
      description: '需要异常或同阵营队友。',
    },
    evidence: [yuzuhaGuide],
  },
  {
    agentId: 'agent-promeia',
    name: '普罗米娅',
    releaseState: 'released',
    specialty: 'anomaly',
    faction: '坎卜斯黑枝',
    attribute: 'ice',
    fieldTimeDemand: 0.65,
    produces: ['ice_anomaly', 'anomaly_driver', 'corrosive_chill', 'trial_by_cold', 'abloom'],
    consumes: ['trial_by_cold'],
    effects: [{ tag: 'abloom_damage', recipient: 'enemy' }],
    additionalAbility: {
      status: 'modeled',
      predicate: {
        kind: 'any',
        predicates: [
          { kind: 'specialty_count', specialty: 'anomaly', minimum: 2 },
          { kind: 'specialty_count', specialty: 'support', minimum: 1 },
        ],
      },
      description: '需要异常或支援队友。',
    },
    evidence: [promeiaGuide, nangongGuide, yuzuhaGuide],
  },
  {
    agentId: 'agent-nangong',
    name: '南宫羽',
    releaseState: 'released',
    specialty: 'stun',
    faction: '妄想天使',
    attribute: 'ether',
    fieldTimeDemand: 0.45,
    produces: [
      'downbeats',
      'dance_prowess',
      'stun_window',
      'misstep',
      'polarity_disorder',
      'vibrato',
    ],
    consumes: ['downbeats', 'dance_prowess'],
    effects: [
      { tag: 'stun_multiplier', recipient: 'enemy' },
      { tag: 'anomaly_amplification', recipient: 'team' },
    ],
    additionalAbility: {
      status: 'modeled',
      predicate: {
        kind: 'any',
        predicates: [
          { kind: 'specialty_count', specialty: 'anomaly', minimum: 1 },
          { kind: 'faction_count', faction: '妄想天使', minimum: 2 },
        ],
      },
      description: '需要异常或同阵营队友闭合极性紊乱。',
    },
    evidence: [nangongGuide, promeiaGuide],
  },
  {
    agentId: 'agent-pyrois',
    name: '佩洛伊斯',
    releaseState: 'released',
    specialty: 'damage',
    faction: '法厄同',
    attribute: 'ether',
    fieldTimeDemand: 0.75,
    produces: ['celestial_light', 'chain_burst', 'ultimate_cycle'],
    consumes: ['celestial_light', 'stun_window'],
    effects: [],
    additionalAbility: {
      status: 'modeled',
      predicate: {
        kind: 'any',
        predicates: [
          { kind: 'specialty_count', specialty: 'stun', minimum: 1 },
          { kind: 'specialty_count', specialty: 'support', minimum: 1 },
        ],
      },
      description: '需要击破或支援队友承接连携爆发。',
    },
    evidence: [pyroisGuide, normaTeamGuide],
  },
  {
    agentId: 'agent-norma',
    name: '诺姆',
    releaseState: 'released',
    specialty: 'stun',
    faction: '罗斯凯利法·外务筹策局',
    attribute: 'fire',
    fieldTimeDemand: 0.4,
    produces: ['preheated_chamber', 'chain_attack_refill', 'tech_divide', 'stun_window'],
    consumes: ['preheated_chamber'],
    effects: [
      { tag: 'stun_multiplier', recipient: 'enemy' },
      { tag: 'team_damage', recipient: 'team' },
    ],
    additionalAbility: {
      status: 'modeled',
      predicate: {
        kind: 'any',
        predicates: [
          { kind: 'specialty_count', specialty: 'damage', minimum: 1 },
          { kind: 'specialty_count', specialty: 'rupture', minimum: 1 },
          { kind: 'faction_count', faction: '罗斯凯利法·外务筹策局', minimum: 2 },
        ],
      },
      description: '需要强攻、命破或同阵营队友。',
    },
    evidence: [normaTeamGuide, ultraJakeGuide],
  },
]

const [
  directStunKernel,
  ruptureDefenseKernel,
  ruptureVeilKernel,
  yeVeilKernel,
  ariaFrontlineAnomalyKernel,
  promeiaPolarityKernel,
  pyroisChainBurstKernel,
] = buildCurrent31D1Kernels({
  zhuYuanGuide,
  qingyiGuide,
  astraGuide,
  yixuanGuide,
  panGuide,
  luciaGuide,
  dialynGuide,
  yixuanLuciaDialynSeed,
  yixuanPanSeed,
  yeGuide,
  zhaoGuide,
  sunnaGuide,
  ariaGuide,
  yuzuhaGuide,
  promeiaGuide,
  nangongGuide,
  pyroisGuide,
  normaTeamGuide,
  ultraJakeGuide,
  sproutAdoption,
  biggestFanAdoption,
  knightbooPredicateAdoption,
  knightbooTeamAdoption,
  coverageDiscoverySeed,
})

const coverageOverrideAgentIds = new Set([
  'agent-aria',
  'agent-promeia',
  ...current31LegacyCoverageAgentRules.map((rule) => rule.agentId),
])

const inheritedAgentRules = [
  ...current31TeamEngineVerticalSlice.agentRules.filter(
    (rule) => !coverageOverrideAgentIds.has(rule.agentId),
  ),
  ...d1AgentRules,
  ...current31LegacyCoverageAgentRules,
]

export const current31TeamEngineD1Pack: TeamEnginePack = {
  ...current31TeamEngineVerticalSlice,
  agentRules: compileCurrent31AgentRules(inheritedAgentRules).map((rule) => {
    const predicate = resolveSourceBoundAdditionalAbility(rule.agentId, rule)
    if (!predicate || rule.additionalAbility.status !== 'modeled') return rule
    return {
      ...rule,
      additionalAbility: { ...rule.additionalAbility, predicate },
    }
  }),
  kernels: [
    ...current31TeamEngineVerticalSlice.kernels,
    directStunKernel,
    ruptureDefenseKernel,
    ruptureVeilKernel,
    yeVeilKernel,
    ariaFrontlineAnomalyKernel,
    promeiaPolarityKernel,
    pyroisChainBurstKernel,
    ...current31LegacyCoverageKernels,
  ],
  currentMetaStrength: current31MetaStrengthR1,
  bangbooRules: [
    ...current31TeamEngineVerticalSlice.bangbooRules,
    {
      bangbooId: 'bangboo-resonaboo',
      name: '共鸣布',
      releaseState: 'released',
      activation: {
        status: 'modeled',
        predicate: { kind: 'attribute_count', attribute: 'ether', minimum: 2 },
        description: '额外能力要求至少两名以太代理人。',
        evidence: [zhuYuanGuide, astraGuide],
      },
      suitability: {
        status: 'unknown',
        description: '当前 corpus 没有朱鸢 family 与共鸣布的具名适配证据。',
        evidence: [],
      },
      provenance: [zhuYuanGuide, astraGuide],
      evidence: [zhuYuanGuide, astraGuide],
    },
    {
      bangbooId: 'bangboo-sprout',
      name: '芽芽',
      releaseState: 'released',
      activation: {
        status: 'modeled',
        predicate: { kind: 'agent_present', agentId: 'agent-ye-shunguang' },
        description: '额外能力要求叶瞬光在队。',
        evidence: [sproutAdoption],
      },
      suitability: {
        status: 'modeled',
        familyIds: ['family-ye-veil-attack'],
        scenarioTags: ['veil_attack'],
        description: '芽芽的叶瞬光在队机制与该帷幕强攻 family、场景效果承接一致。',
        validationEvidence: [sproutAdoption],
        evidence: [sproutAdoption],
      },
      provenance: [sproutAdoption],
      evidence: [sproutAdoption],
    },
    {
      bangbooId: 'bangboo-belion',
      name: '狮耶',
      releaseState: 'released',
      activation: resolveReviewedBelionActivation(),
      suitability: {
        status: 'unknown',
        description: '当前 corpus 没有仪玄 family 与狮耶的具名适配证据。',
        evidence: [],
      },
      provenance: [yixuanGuide, panGuide],
      evidence: [yixuanGuide, panGuide],
    },
    {
      bangbooId: 'bangboo-biggest-fan',
      name: '阿饭',
      releaseState: 'released',
      activation: resolveReviewedBiggestFanActivation(),
      suitability: {
        status: 'modeled',
        familyIds: ['family-aria-frontline-anomaly'],
        scenarioTags: ['angels_anomaly'],
        description: '阿饭的妄想天使激活机制与爱芮前台异常 family、场景效果承接一致。',
        validationEvidence: [biggestFanAdoption, ariaGuide, sunnaGuide],
        evidence: [biggestFanAdoption, ariaGuide, sunnaGuide],
      },
      provenance: [biggestFanAdoption, ariaGuide, sunnaGuide],
      evidence: [biggestFanAdoption, ariaGuide, sunnaGuide],
    },
    {
      bangbooId: 'bangboo-knightboo',
      name: '骑士布',
      releaseState: 'released',
      activation: {
        status: 'modeled',
        predicate: { kind: 'specialty_count', specialty: 'support', minimum: 1 },
        description: '额外能力要求至少一名支援代理人。',
        evidence: [knightbooPredicateAdoption],
      },
      suitability: {
        status: 'modeled',
        familyIds: ['family-promeia-polarity-anomaly'],
        scenarioTags: ['polarity_abloom'],
        description: '骑士布的支援成员激活机制与极性异放 family、场景效果承接一致。',
        validationEvidence: [knightbooTeamAdoption],
        evidence: [knightbooTeamAdoption],
      },
      provenance: [knightbooPredicateAdoption, knightbooTeamAdoption],
      evidence: [knightbooPredicateAdoption, knightbooTeamAdoption],
    },
    {
      bangbooId: 'bangboo-ultra-jake',
      name: '超极杰克',
      releaseState: 'released',
      activation: {
        status: 'modeled',
        predicate: {
          kind: 'faction_count',
          faction: '罗斯凯利法·外务筹策局',
          minimum: 1,
        },
        description: '额外能力要求至少一名罗斯凯利法·外务筹策局代理人。',
        evidence: [ultraJakeGuide],
      },
      suitability: {
        status: 'modeled',
        familyIds: ['family-pyrois-norma-chain-burst'],
        scenarioTags: ['chain_attack_burst'],
        description: '超极杰克的阵营激活机制与连携爆发 family、场景效果承接一致。',
        validationEvidence: [normaTeamGuide],
        evidence: [normaTeamGuide],
      },
      provenance: [ultraJakeGuide, normaTeamGuide],
      evidence: [ultraJakeGuide, normaTeamGuide],
    },
    ...current31LegacyCoverageBangbooRules,
  ],
}
