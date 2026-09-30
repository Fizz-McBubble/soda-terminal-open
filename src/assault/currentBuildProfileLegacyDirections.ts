import type { RosterAgent } from './types'
export type Recommendation = {
  wEngines: string[]
  skillPriority: Array<keyof RosterAgent['skillLevels']>
  skillTargets: RosterAgent['skillLevels']
  coreTarget: number
  sets: Array<{ pattern: '4+2' | '2+2+2'; primary: string[]; secondary: string[] }>
  mainStats: Record<'4' | '5' | '6', string[]>
  substatWeights: Record<string, number>
  teamConstraints: { teammateNotes: string[]; bangbooIds: string[] }
}

const fullSkillTargets: RosterAgent['skillLevels'] = {
  basic: 12,
  dodge: 12,
  assist: 12,
  special: 12,
  chain: 12,
  core: 7,
}

function recommendation(input: {
  wEngines: string[]
  skillPriority: Recommendation['skillPriority']
  primarySet: string
  secondarySets: string[]
  mainStats: Recommendation['mainStats']
  substatWeights: Record<string, number>
  teammateNotes: string[]
  bangbooIds?: string[]
}): Recommendation {
  return {
    wEngines: input.wEngines,
    skillPriority: input.skillPriority,
    skillTargets: { ...fullSkillTargets },
    coreTarget: 7,
    sets: [
      {
        pattern: '4+2',
        primary: [input.primarySet],
        secondary: input.secondarySets,
      },
      {
        pattern: '2+2+2',
        primary: [input.primarySet, ...input.secondarySets],
        secondary: [],
      },
    ],
    mainStats: input.mainStats,
    substatWeights: input.substatWeights,
    teamConstraints: {
      teammateNotes: input.teammateNotes,
      bangbooIds: input.bangbooIds ?? [],
    },
  }
}

const critWeights = { crit_rate: 1, crit_dmg: 1, atk_percent: 0.8, pen: 0.45, atk_flat: 0.25 }

export const anomalyWeights = {
  anomaly_proficiency: 1,
  atk_percent: 0.8,
  pen: 0.4,
  atk_flat: 0.25,
}

const supportWeights = {
  energy_regen: 1,
  atk_percent: 0.65,
  anomaly_proficiency: 0.45,
  pen: 0.25,
}

const stunWeights = { impact: 1, crit_rate: 0.55, crit_dmg: 0.55, atk_percent: 0.5, pen: 0.3 }

const defenseWeights = { def_percent: 1, hp_percent: 0.65, atk_percent: 0.45, energy_regen: 0.4 }

export const unverifiedLegacyDirections: Partial<Record<string, Recommendation>> = {
  'agent-promeia': recommendation({
    wEngines: ['wengine-14154', 'wengine-14118', 'wengine-13008'],
    skillPriority: ['core', 'special', 'chain', 'basic', 'assist', 'dodge'],
    primarySet: 'set-notes-from-the-chained',
    secondarySets: [
      'set-phaethons-melody',
      'set-freedom-blues',
      'set-chaos-jazz',
      'set-astral-voice',
      'set-hormone-punk',
    ],
    mainStats: {
      '4': ['anomaly_proficiency'],
      '5': ['ice_dmg', 'atk_percent'],
      '6': ['anomaly_mastery'],
    },
    substatWeights: anomalyWeights,
    teammateNotes: ['优先异常或支援队友；不同绽放循环不混为同一场景。'],
    bangbooIds: ['bangboo-sharkboo'],
  }),
  'agent-ye-shunguang': recommendation({
    wEngines: ['wengine-14143', 'wengine-14104', 'wengine-14102'],
    skillPriority: ['core', 'basic', 'chain', 'special', 'assist', 'dodge'],
    primarySet: 'set-white-water-ballad',
    secondarySets: ['set-branch-blade-song', 'set-puffer-electro'],
    mainStats: {
      '4': ['atk_percent', 'crit_dmg'],
      '5': ['physical_dmg', 'pen_ratio', 'atk_percent'],
      '6': ['atk_percent'],
    },
    substatWeights: critWeights,
    teammateNotes: ['需要能稳定提供以太帷幕或失衡窗口的队友。'],
  }),
  'agent-qingyi': recommendation({
    wEngines: ['wengine-14125', 'wengine-13005', 'wengine-13101'],
    skillPriority: ['core', 'basic', 'special', 'chain', 'assist', 'dodge'],
    primarySet: 'set-shockstar-disco',
    secondarySets: ['set-swing-jazz', 'set-woodpecker-electro'],
    mainStats: {
      '4': ['crit_rate', 'crit_dmg'],
      '5': ['electric_dmg', 'atk_percent'],
      '6': ['impact'],
    },
    substatWeights: stunWeights,
    teammateNotes: ['面向需要长失衡窗口的强攻主C。'],
    bangbooIds: ['bangboo-officer-cui', 'bangboo-plugboo'],
  }),
  'agent-ellen': recommendation({
    wEngines: ['wengine-14119', 'wengine-14104', 'wengine-13004'],
    skillPriority: ['core', 'basic', 'chain', 'special', 'dodge', 'assist'],
    primarySet: 'set-puffer-electro',
    secondarySets: ['set-woodpecker-electro', 'set-polar-metal', 'set-branch-blade-song'],
    mainStats: {
      '4': ['crit_rate', 'crit_dmg'],
      '5': ['ice_dmg', 'atk_percent'],
      '6': ['atk_percent'],
    },
    substatWeights: critWeights,
    teammateNotes: ['优先冰属性增益、击破与支援队友。'],
    bangbooIds: ['bangboo-sharkboo', 'bangboo-butler'],
  }),
  'agent-koleda': recommendation({
    wEngines: ['wengine-14110', 'wengine-13006', 'wengine-13005'],
    skillPriority: ['core', 'basic', 'special', 'chain', 'assist', 'dodge'],
    primarySet: 'set-shockstar-disco',
    secondarySets: ['set-swing-jazz', 'set-inferno-metal'],
    mainStats: {
      '4': ['crit_rate', 'crit_dmg'],
      '5': ['fire_dmg', 'atk_percent'],
      '6': ['impact'],
    },
    substatWeights: stunWeights,
    teammateNotes: ['火属性队或需要快速失衡的队伍。'],
    bangbooIds: ['bangboo-safety', 'bangboo-rocketboo'],
  }),
  'agent-soldier-11': recommendation({
    wEngines: ['wengine-14104', 'wengine-13004', 'wengine-13001'],
    skillPriority: ['core', 'basic', 'chain', 'special', 'dodge', 'assist'],
    primarySet: 'set-inferno-metal',
    secondarySets: ['set-woodpecker-electro', 'set-branch-blade-song'],
    mainStats: {
      '4': ['crit_rate', 'crit_dmg'],
      '5': ['fire_dmg', 'atk_percent'],
      '6': ['atk_percent'],
    },
    substatWeights: critWeights,
    teammateNotes: ['需要稳定触发灼烧或提供火增益的击破/支援队友。'],
    bangbooIds: ['bangboo-rocketboo'],
  }),
  'agent-piper': recommendation({
    wEngines: ['wengine-13128', 'wengine-13003', 'wengine-13008'],
    skillPriority: ['core', 'special', 'chain', 'basic', 'dodge', 'assist'],
    primarySet: 'set-fanged-metal',
    secondarySets: ['set-freedom-blues', 'set-phaethons-melody'],
    mainStats: {
      '4': ['anomaly_proficiency'],
      '5': ['physical_dmg', 'atk_percent'],
      '6': ['anomaly_mastery'],
    },
    substatWeights: anomalyWeights,
    teammateNotes: ['物理异常或紊乱队；需按队伍确认异常覆盖。'],
    bangbooIds: ['bangboo-bangvolver', 'bangboo-red-moccus'],
  }),
  'agent-lucy': recommendation({
    wEngines: ['wengine-13115', 'wengine-13002', 'wengine-12006'],
    skillPriority: ['core', 'special', 'chain', 'assist', 'basic', 'dodge'],
    primarySet: 'set-astral-voice',
    secondarySets: ['set-swing-jazz', 'set-hormone-punk'],
    mainStats: {
      '4': ['atk_percent', 'crit_rate'],
      '5': ['fire_dmg', 'atk_percent'],
      '6': ['energy_regen', 'atk_percent'],
    },
    substatWeights: supportWeights,
    teammateNotes: ['需要快速支援入场的主C；攻击目标随小猪继承需求调整。'],
    bangbooIds: ['bangboo-red-moccus', 'bangboo-rocketboo'],
  }),
  'agent-soukaku': recommendation({
    wEngines: ['wengine-13113', 'wengine-13002', 'wengine-12006'],
    skillPriority: ['core', 'special', 'chain', 'assist', 'basic', 'dodge'],
    primarySet: 'set-swing-jazz',
    secondarySets: ['set-hormone-punk', 'set-astral-voice'],
    mainStats: { '4': ['atk_percent'], '5': ['ice_dmg', 'atk_percent'], '6': ['energy_regen'] },
    substatWeights: supportWeights,
    teammateNotes: ['优先冰属性主C；需满足展旗与攻击增益覆盖。'],
    bangbooIds: ['bangboo-sharkboo'],
  }),
  'agent-nicole': recommendation({
    wEngines: ['wengine-13103', 'wengine-13002', 'wengine-12006'],
    skillPriority: ['core', 'special', 'chain', 'assist', 'basic', 'dodge'],
    primarySet: 'set-swing-jazz',
    secondarySets: ['set-freedom-blues', 'set-astral-voice'],
    mainStats: {
      '4': ['anomaly_proficiency'],
      '5': ['ether_dmg', 'atk_percent'],
      '6': ['energy_regen', 'anomaly_mastery'],
    },
    substatWeights: supportWeights,
    teammateNotes: ['适合爆发窗口与以太队；需保证减防覆盖。'],
    bangbooIds: ['bangboo-amillion', 'bangboo-resonaboo'],
  }),
  'agent-ben': recommendation({
    wEngines: ['wengine-13112', 'wengine-13010', 'wengine-13007'],
    skillPriority: ['core', 'special', 'chain', 'assist', 'basic', 'dodge'],
    primarySet: 'set-proto-punk',
    secondarySets: ['set-soul-rock', 'set-swing-jazz'],
    mainStats: {
      '4': ['crit_rate', 'def_percent'],
      '5': ['fire_dmg', 'def_percent'],
      '6': ['def_percent', 'energy_regen'],
    },
    substatWeights: defenseWeights,
    teammateNotes: ['火队或需要护盾与完美支援增益的队伍。'],
    bangbooIds: ['bangboo-safety'],
  }),
  'agent-anby': recommendation({
    wEngines: ['wengine-13101', 'wengine-13005', 'wengine-13006'],
    skillPriority: ['core', 'basic', 'special', 'chain', 'assist', 'dodge'],
    primarySet: 'set-shockstar-disco',
    secondarySets: ['set-swing-jazz', 'set-thunder-metal'],
    mainStats: {
      '4': ['crit_rate', 'crit_dmg'],
      '5': ['electric_dmg', 'atk_percent'],
      '6': ['impact'],
    },
    substatWeights: stunWeights,
    teammateNotes: ['通用击破；电队可提高属性协同。'],
    bangbooIds: ['bangboo-amillion', 'bangboo-plugboo'],
  }),
  'agent-pyrois': recommendation({
    wEngines: ['wengine-14155', 'wengine-14104', 'wengine-13004'],
    skillPriority: ['core', 'chain', 'basic', 'special', 'assist', 'dodge'],
    primarySet: 'set-the-sky-ablaze',
    secondarySets: ['set-branch-blade-song', 'set-woodpecker-electro'],
    mainStats: {
      '4': ['crit_rate', 'crit_dmg'],
      '5': ['pen_ratio', 'ether_dmg', 'atk_percent'],
      '6': ['atk_percent'],
    },
    substatWeights: critWeights,
    teammateNotes: ['围绕多终结技循环；队友需补充增益和失衡窗口。'],
    bangbooIds: ['bangboo-resonaboo'],
  }),
  'agent-billy': recommendation({
    wEngines: ['wengine-13108', 'wengine-13004', 'wengine-13001'],
    skillPriority: ['core', 'basic', 'chain', 'special', 'dodge', 'assist'],
    primarySet: 'set-woodpecker-electro',
    secondarySets: ['set-fanged-metal', 'set-dawns-bloom'],
    mainStats: {
      '4': ['crit_rate', 'crit_dmg'],
      '5': ['physical_dmg', 'atk_percent'],
      '6': ['atk_percent'],
    },
    substatWeights: critWeights,
    teammateNotes: ['持续直伤与普攻强化为不同场景，当前模板按持续直伤。'],
    bangbooIds: ['bangboo-amillion'],
  }),
  'agent-pulchra': recommendation({
    wEngines: ['wengine-13135', 'wengine-14110', 'wengine-13006'],
    skillPriority: ['core', 'special', 'assist', 'chain', 'basic', 'dodge'],
    primarySet: 'set-astral-voice',
    secondarySets: ['set-proto-punk', 'set-shockstar-disco'],
    mainStats: {
      '4': ['crit_rate', 'crit_dmg'],
      '5': ['physical_dmg', 'atk_percent'],
      '6': ['impact'],
    },
    substatWeights: stunWeights,
    teammateNotes: ['余震队优先；非余震队需要M6后再确认泛用收益。'],
    bangbooIds: ['bangboo-bangvolver'],
  }),
  'agent-anton': recommendation({
    wEngines: ['wengine-13111', 'wengine-13004', 'wengine-13001'],
    skillPriority: ['core', 'basic', 'special', 'chain', 'dodge', 'assist'],
    primarySet: 'set-thunder-metal',
    secondarySets: ['set-woodpecker-electro', 'set-puffer-electro'],
    mainStats: {
      '4': ['crit_rate', 'crit_dmg'],
      '5': ['electric_dmg', 'atk_percent'],
      '6': ['atk_percent'],
    },
    substatWeights: critWeights,
    teammateNotes: ['需要电异常覆盖维持雷暴4件效果。'],
    bangbooIds: ['bangboo-safety', 'bangboo-plugboo'],
  }),
  'agent-corin': recommendation({
    wEngines: ['wengine-13106', 'wengine-13004', 'wengine-13001'],
    skillPriority: ['core', 'special', 'chain', 'basic', 'assist', 'dodge'],
    primarySet: 'set-fanged-metal',
    secondarySets: ['set-woodpecker-electro', 'set-puffer-electro'],
    mainStats: {
      '4': ['crit_rate', 'crit_dmg'],
      '5': ['physical_dmg', 'atk_percent'],
      '6': ['atk_percent'],
    },
    substatWeights: critWeights,
    teammateNotes: ['依赖失衡窗口持续输出；优先击破与物理异常协同。'],
    bangbooIds: ['bangboo-butler', 'bangboo-bangvolver'],
  }),
  'agent-nekomata': recommendation({
    wEngines: ['wengine-14102', 'wengine-14104', 'wengine-13004'],
    skillPriority: ['core', 'basic', 'chain', 'special', 'dodge', 'assist'],
    primarySet: 'set-fanged-metal',
    secondarySets: ['set-woodpecker-electro', 'set-puffer-electro'],
    mainStats: {
      '4': ['crit_rate', 'crit_dmg'],
      '5': ['physical_dmg', 'atk_percent'],
      '6': ['atk_percent'],
    },
    substatWeights: critWeights,
    teammateNotes: ['需要强击覆盖或物理队友激活獠牙4件。'],
    bangbooIds: ['bangboo-amillion', 'bangboo-bangvolver'],
  }),
  'agent-pan-yinhu': recommendation({
    wEngines: ['wengine-13142', 'wengine-13007', 'wengine-13010'],
    skillPriority: ['core', 'special', 'chain', 'assist', 'basic', 'dodge'],
    primarySet: 'set-astral-voice',
    secondarySets: ['set-hormone-punk', 'set-swing-jazz'],
    mainStats: { '4': ['atk_percent'], '5': ['atk_percent'], '6': ['energy_regen', 'atk_percent'] },
    substatWeights: supportWeights,
    teammateNotes: ['只在命破主C队中作为优先兼容建议；需满足攻击力Buff阈值。'],
  }),
}
