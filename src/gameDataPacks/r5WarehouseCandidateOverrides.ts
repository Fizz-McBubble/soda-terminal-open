import { stableContentHash } from './types'
import { checkedAt, type PlayerBuildSource } from './playerBuildSources'
import { pageCandidateDirections } from './pageCandidateDirections'

function r5PrydwenCandidateSource(
  slug: string,
  sourceVersion: string | null,
  evidence: string,
): PlayerBuildSource {
  const url = `https://www.prydwen.gg/zenless/characters/${slug}`
  return {
    id: `prydwen-r5-${slug}`,
    url,
    sourceVersion,
    checkedAt,
    contentHash: stableContentHash({ url, sourceVersion, checkedAt, evidence }),
    licenseBoundary:
      '社区候选页面：仅保存最小派生的配装字段与来源定位，不复制页面内容；不得作为官方事实、正式仓库求解或精确伤害输入。',
    verified: true,
  }
}

export const r5WarehouseCandidateOverrides: typeof pageCandidateDirections = {
  'agent-soldier-0-anby': {
    source: r5PrydwenCandidateSource(
      'anby-demara-soldier-0',
      '2.5',
      'Shadow Harmony 4pc; Woodpecker 2pc; CRIT/Electric/ATK main stats; aftershock team',
    ),
    wengines: ['Severed Innocence', 'Cordis Germina', 'Heartstring Nocturne', 'Marcato Desire'],
    sets: ['Shadow Harmony 4 件 + Woodpecker Electro 2 件'],
    stats: {
      main: ['4号位：暴击率/暴击伤害', '5号位：电属性伤害/攻击力%', '6号位：攻击力%'],
      sub: ['暴击率、暴击伤害、攻击力%、穿透值/攻击力'],
    },
    progression: ['围绕银星标记与失衡窗口内 Azure Flash/强化特殊技循环；优先特殊、连携、普攻。'],
    team: ['追加攻击队：奥菲丝&「鬼火」与扳机；需击破或支援队友激活额外能力，邦布不作固定候选。'],
  },
  'agent-alice': {
    source: r5PrydwenCandidateSource(
      'alice',
      null,
      'Fanged Metal 4pc; Phaethons Melody 2pc; anomaly/physical/anomaly-mastery main stats',
    ),
    wengines: ['Practiced Perfection', 'Sharpened Stinger', 'Fusion Compiler', 'Weeping Gemini'],
    sets: ["Fanged Metal 4 件 + Phaethon's Melody 2 件"],
    stats: {
      main: ['4号位：异常精通/攻击力%', '5号位：穿透率/物理属性伤害/攻击力%', '6号位：异常掌控'],
      sub: ['异常精通、攻击力%、穿透值、攻击力'],
    },
    progression: ['以异常与紊乱累积 Blade Etiquette，并在失衡窗口施放蓄力普攻和强化特殊技。'],
    team: [
      '物理异常主C：与薇薇安、柳、柏妮思或格莉丝等可快速施加异常的副C协同；邦布不作固定候选。',
    ],
  },
  'agent-yuzuha': {
    source: r5PrydwenCandidateSource(
      'ukinami-yuzuha',
      null,
      'Moonlight Lullaby 4pc; Phaethons Melody 2pc; ATK/PEN/anomaly-mastery main stats',
    ),
    wengines: ['Metanukimorphosis', 'Weeping Cradle', 'Kaboom the Cannon', 'Thoughtbop'],
    sets: [
      "Moonlight Lullaby 4 件 + Phaethon's Melody 2 件",
      "Astral Voice 4 件 + Phaethon's Melody 2 件",
    ],
    stats: {
      main: ['4号位：攻击力%/异常精通', '5号位：攻击力%/穿透率', '6号位：异常掌控/攻击力%'],
      sub: ['攻击力%、攻击力、异常精通、穿透值'],
    },
    progression: ['维持 Sweet Scare 与 Tanuki Wish，借防御/快速支援后以强化特殊技或终结技续增益。'],
    team: [
      '异常队优先柳、简、派派并配薇薇安或柏妮思；物理队也可用，按队伍异常需求调整。邦布不作固定候选。',
    ],
  },
  'agent-manato': {
    source: r5PrydwenCandidateSource(
      'manato',
      '2.4',
      'Yunkui Tales 4pc; Woodpecker 2pc; CRIT/Fire-or-HP/HP main stats',
    ),
    wengines: [
      "Grill O'Wisp",
      'Wrathful Vajra',
      'Qingming Birdcage',
      'Radiowave Journey',
      'Puzzle Sphere',
    ],
    sets: [
      'Yunkui Tales 4 件 + Woodpecker Electro 2 件',
      'Yunkui Tales 4 件 + Branch & Blade Song 2 件',
    ],
    stats: {
      main: ['4号位：暴击率/暴击伤害', '5号位：火属性伤害/生命值%', '6号位：生命值%'],
      sub: ['暴击率、暴击伤害、生命值%、生命值、攻击力%、攻击力'],
    },
    progression: ['以 Blazing Heart 维持熔刃状态；失衡窗口保留强化特殊技与终结技。'],
    team: [
      '命破主C：卢西娅或潘引壶辅助，戴音或橘福福击破；以生命值转贯穿与失衡爆发为前提。邦布不作固定候选。',
    ],
  },
  'agent-lucia': {
    source: r5PrydwenCandidateSource(
      'lucia',
      null,
      'Moonlight Lullaby 4pc; Yunkui Tales 2pc; HP/HP/HP main stats',
    ),
    wengines: ['Dreamlit Hearth', 'Weeping Cradle', 'Kaboom the Cannon', 'Unfettered Game Ball'],
    sets: ['Moonlight Lullaby 4 件 + Yunkui Tales 2 件'],
    stats: {
      main: ['4号位：生命值%', '5号位：生命值%', '6号位：生命值%'],
      sub: ['生命值%、生命值、暴击率、暴击伤害'],
    },
    progression: ['维持 Ether Veil 以提供命破队增益；优先特殊与连携，按能量循环触发强化特殊技。'],
    team: [
      '命破辅助：仪玄、狛野真斗、般岳或伊德海莉；以持续以太帷幕覆盖为前提。邦布不作固定候选。',
    ],
  },
  'agent-seed': {
    source: r5PrydwenCandidateSource(
      'seed',
      '2.2',
      'Dawns Bloom 4pc; Woodpecker 2pc; CRIT/PEN-or-ATK-or-Electric/ATK main stats',
    ),
    wengines: ['Cordis Germina', 'Heartstring Nocturne', 'Myriad Eclipse', 'Marcato Desire'],
    sets: [
      "Dawn's Bloom 4 件 + Woodpecker Electro 2 件",
      'Woodpecker Electro 4 件 + Branch & Blade Song 2 件',
    ],
    stats: {
      main: ['4号位：暴击伤害/暴击率', '5号位：穿透率/攻击力%/电属性伤害', '6号位：攻击力%'],
      sub: ['暴击伤害、暴击率、攻击力%、穿透值、攻击力'],
    },
    progression: ['以普通攻击和 Downfall 为主要伤害窗口，特殊与连携次之。'],
    team: [
      '可与奥菲丝&「鬼火」组成双强攻协同，也可配零号·安比等强攻；角色与队伍能量循环为前提。邦布不作固定候选。',
    ],
  },
  'agent-dialyn': {
    source: r5PrydwenCandidateSource(
      'dialyn',
      '2.4',
      'King of the Summit 4pc; Woodpecker 2pc; CRIT/ATK-or-physical-or-PEN/energy main stats',
    ),
    wengines: ['Yesterday Calls', 'Hellfire Gears', 'Steam Oven', 'Precious Fossilized Core'],
    sets: [
      'King of the Summit 4 件 + Woodpecker Electro 2 件',
      'King of the Summit 4 件 + Swing Jazz 2 件',
    ],
    stats: {
      main: ['4号位：暴击率', '5号位：攻击力%/物理属性伤害/穿透率', '6号位：能量自动回复'],
      sub: ['暴击率、暴击伤害、攻击力%、穿透值、攻击力'],
    },
    progression: ['以强化特殊技与终结技转换维持失衡期收益；优先连携、特殊与支援。'],
    team: [
      '击破：叶瞬光、仪玄、伊德海莉或狛野真斗等；以失衡延长与终结技转换为适用前提。邦布不作固定候选。',
    ],
  },
  'agent-zhao': {
    source: r5PrydwenCandidateSource(
      'zhao',
      null,
      'Bunny in Wonderland 4pc; Yunkui Tales 2pc; HP/HP/energy main stats',
    ),
    wengines: ['Half-Sugar Bunny', 'Tusks of Fury', 'Original Transmorpher'],
    sets: ['Bunny in Wonderland 4 件 + Yunkui Tales 2 件', 'Astral Voice 4 件 + Swing Jazz 2 件'],
    stats: {
      main: ['4号位：生命值%', '5号位：生命值%', '6号位：能量自动回复'],
      sub: ['生命值%、生命值、暴击率、暴击伤害'],
    },
    progression: [
      '频繁消耗 Frostbite Points 以维持 Ether Veil: Wellspring；强化特殊技和连携为优先。',
    ],
    team: [
      '防护辅助：以叶瞬光等需要以太帷幕增益的队伍为前提；可用招架/回避支援触发套装。邦布不作固定候选。',
    ],
  },
}
