import { agentCatalog } from '../assault/catalog'
import { applyReviewedDiscCorrections } from './reviewedDiscFieldCorrections'
import { buildKnowledge30Profiles } from './buildKnowledge'
import { stableContentHash } from './types'
import { reviewedGuideSkillDirections } from './reviewedGuideSkillDirections'
import { reviewedPotentialGuideReferences } from './reviewedPotentialGuideReferences'
import { reviewedGuideBuildDirections } from './reviewedGuideBuildDirections'
import { getArchivedGuideSetDirections } from './archivedGuideSetSections'
import { compileCandidateSetPlans } from './candidateSetPlans'
import {
  type PlayerBuildSource,
  type PlayerBuildField,
  type PlayerBuildProfile,
  checkedAt,
  officialCatalogSource,
  bwikiPageEvidence,
} from './playerBuildSources'
export {
  playerBuildFieldStatuses,
  type PlayerBuildFieldStatus,
  type PlayerBuildSource,
  type PlayerBuildField,
  type PlayerBuildProfile,
} from './playerBuildSources'

/**
 * Page-level directions are intentionally separate from the optimizer profile. They preserve the
 * source's own terminology for player reading and never become solver constraints without a
 * second normalization and same-version review.
 */
const pageCandidateDirections: Partial<
  Record<
    string,
    {
      source: PlayerBuildSource
      wengines: string[]
      sets: string[]
      stats: { main: string[]; sub: string[] }
      progression: string[]
      team: string[]
    }
  >
> = {
  'agent-ben': {
    source: {
      id: 'bwiki-ben-unversioned',
      url: 'https://wiki.biligame.com/zzz/%E6%9C%AC',
      sourceVersion: null,
      checkedAt: '2026-07-27T00:00:00.000Z',
      contentHash: 'sha256:b4b04a3ff8d2a3983717300675098914b6070c7646670227dee18355d9cd1b19',
      licenseBoundary:
        'CC BY-NC-SA 4.0：仅本地非商业候选、保留署名与同许可边界；页面未给出可核验的构筑版本，不能作为当前 3.0 正式求解输入。',
      verified: true,
    },
    wengines: ['本的专属音擎', '兔能环', '「恒等式」- 本格', '「恒等式」- 变格'],
    sets: ['摇摆爵士 4 件', '自由蓝调 4 件', '炎狱重金属 4 件 + 啄木鸟电音 / 灵魂摇滚 2 件'],
    stats: {
      main: ['4号位：防御力/暴击伤害', '5号位：火属性伤害/防御力', '6号位：能量回复效率/防御力'],
      sub: ['暴击率/暴击伤害、防御力、穿透值'],
    },
    progression: ['核心技 > 特殊技 > 连携技；以团队护盾与短轴火伤为适用前提。'],
    team: ['火队或团队防御辅助方向；来源仅列出「11号」协同，未给出可核验邦布优先级。'],
  },
  'agent-evelyn': {
    source: {
      id: 'bwiki-evelyn-unversioned',
      url: 'https://wiki.biligame.com/zzz/%E4%BC%8A%E8%8A%99%E7%90%B3',
      sourceVersion: null,
      checkedAt: '2026-07-27T00:00:00.000Z',
      contentHash: stableContentHash({
        url: 'https://wiki.biligame.com/zzz/%E4%BC%8A%E8%8A%99%E7%90%B3',
        checkedAt: '2026-07-27',
        evidence: 'BWIKI candidate build sections, queried page identity',
      }),
      licenseBoundary:
        'CC BY-NC-SA 4.0：仅本地非商业候选、保留署名与同许可边界；页面构筑未给出可核验的适用版本，不能作为当前 3.0 正式求解输入。',
      verified: true,
    },
    wengines: ['伊芙琳的专属音擎', '硫磺石', '牺牲洁纯', '强音热望', '加农转子', '钢铁肉垫'],
    sets: ['炎狱重金属 4 件（需稳定灼烧）', '高暴击率时改用页面列出的其他 4 件或 2+2+2 方向'],
    stats: {
      main: ['4号位：暴击伤害优先/暴击率', '5号位：火伤或穿透率/攻击力%', '6号位：攻击力%'],
      sub: ['暴击率/暴击伤害优先，攻击力%/穿透值'],
    },
    progression: ['核心技=连携技优先，其次普攻、强化特殊技；支援技取决于快速支援循环。'],
    team: ['输出+击破+增伤辅助；页面示例为耀嘉音+莱特/珂蕾妲，邦布可用咔嚓仔或飚速布。'],
  },
  'agent-yanagi': {
    source: {
      id: 'bwiki-yanagi-2.1',
      url: 'https://wiki.biligame.com/zzz/%E6%9F%B3',
      sourceVersion: '2.1',
      checkedAt: '2026-07-27T00:00:00.000Z',
      contentHash: stableContentHash({
        url: 'https://wiki.biligame.com/zzz/%E6%9F%B3',
        pageBuildVersion: '2.1',
        checkedAt: '2026-07-27',
      }),
      licenseBoundary:
        'CC BY-NC-SA 4.0：仅本地非商业候选、保留署名与同许可边界；旧版本候选不能作为当前 3.0 正式求解输入。',
      verified: true,
    },
    wengines: ['柳的专属音擎', '嵌合编译器'],
    sets: [
      '混沌爵士 4 件 + 自由蓝调 / 法厄同之歌 / 雷暴重金属 2 件',
      '丽娜穿透前提下可考虑河豚电音 2 件',
    ],
    stats: {
      main: ['4号位：异常精通', '5号位：电伤/穿透率', '6号位：攻击力%/异常掌控'],
      sub: ['异常精通优先，其次攻击力%、穿透值、攻击力'],
    },
    progression: ['页面定位为驻场异常输出；技能/核心的当前版本优先级仍需逐字段核验。'],
    team: ['站场紊乱：耀嘉音 + 扳机/妮可/丽娜/凯撒；页面示例邦布为插头布或恶魔布。'],
  },
  'agent-burnice': {
    source: {
      id: 'prydwen-burnice-page-candidate',
      url: 'https://www.prydwen.gg/zenless/characters/burnice',
      sourceVersion: null,
      checkedAt: '2026-07-27T00:00:00.000Z',
      contentHash: stableContentHash({
        url: 'https://www.prydwen.gg/zenless/characters/burnice',
        checkedAt: '2026-07-27',
        evidence: 'page-level build and teams sections',
      }),
      licenseBoundary:
        '社区候选页面：仅本地候选与来源定位，不作为官方事实或正式计算输入；页面未给出可核验的 3.0 适用版本。',
      verified: true,
    },
    wengines: ['Flamemaker Shaker', 'Practiced Perfection', 'Electro-Lip Gloss', 'Weeping Gemini'],
    sets: ['Chaos Jazz 4 件 + 可选 2 件套'],
    stats: {
      main: [
        '4号位：异常精通',
        '5号位：火伤/穿透率',
        '6号位：异常掌控或能量回复（取决于音擎与热量循环）',
      ],
      sub: ['异常精通、攻击力%、穿透值；不把候选面板阈值升格为正式规则。'],
    },
    progression: [
      '维持 Heat、施加 Scorched 后离场触发 Afterburn；补能时短暂回场，避免在 50 Heat 以上浪费终结技补充。',
    ],
    team: [
      '火异常/紊乱副C方向；页面示例为爱丽丝 + 柚叶，或与其他异常主C协同；邦布未作为稳定优先级录入。',
    ],
  },
  'agent-vivian': {
    source: {
      id: 'prydwen-vivian-2.3',
      url: 'https://www.prydwen.gg/zenless/characters/vivian',
      sourceVersion: '2.3',
      checkedAt: '2026-07-27T00:00:00.000Z',
      contentHash: stableContentHash({
        url: 'https://www.prydwen.gg/zenless/characters/vivian',
        buildVersion: '2.3',
        updatedAt: '2026-06-23',
      }),
      licenseBoundary: '社区候选页面：仅本地候选与来源定位，不作为官方事实或正式计算输入。',
      verified: true,
    },
    wengines: ['Flight of Fancy', 'Weeping Gemini'],
    sets: [
      "Phaethon's Melody 4 件 + Chaos Jazz / Freedom Blues / Chaotic Metal / Astral Voice / Hormone Punk / Puffer Electro 2 件",
    ],
    stats: {
      main: ['4号位：异常精通', '5号位：以太伤害优先，其次穿透率/攻击力%', '6号位：异常掌控'],
      sub: ['异常精通优先，其次攻击力%、攻击力、穿透'],
    },
    progression: ['核心被动优先；通过飞羽转护羽后切人，以队友异常触发 Abloom。'],
    team: ['需要另一名异常主C；页面列出雅/柳/爱丽丝/简/派派/格莉丝与耀嘉音/柚叶/妮可/露西等协同。'],
  },
  'agent-jane': {
    source: {
      id: 'prydwen-jane-page-candidate',
      url: 'https://www.prydwen.gg/zenless/characters/jane-doe',
      sourceVersion: null,
      checkedAt: '2026-07-27T00:00:00.000Z',
      contentHash: stableContentHash({
        url: 'https://www.prydwen.gg/zenless/characters/jane-doe',
        checkedAt: '2026-07-27',
      }),
      licenseBoundary:
        '社区候选页面：仅本地候选与来源定位，不作为官方事实或正式计算输入；页面未给出可核验的 3.0 适用版本。',
      verified: true,
    },
    wengines: [
      'Sharpened Stinger',
      'Practiced Perfection',
      'Weeping Gemini',
      'Electro-Lip Gloss',
      'Fusion Compiler',
    ],
    sets: [
      "Fanged Metal 4 件 + Phaethon's Melody / Puffer Electro / Freedom Blues / Chaos Jazz / Astral Voice / Hormone Punk 2 件",
    ],
    stats: {
      main: ['4号位：异常精通', '5号位：穿透率优先，其次物理伤害/攻击力%', '6号位：异常掌控'],
      sub: ['异常精通优先，其次攻击力%、穿透、攻击力'],
    },
    progression: ['页面终局候选以异常精通约 375–420、异常掌控 192+ 为前提；不升格为正式阈值。'],
    team: ['物理异常主C；页面列出薇薇安/柏妮思/赛斯/柚叶/爱丽丝等协同，依赖持续冲击/异常节奏。'],
  },
  'agent-harumasa': {
    source: {
      id: 'prydwen-harumasa-page-candidate',
      url: 'https://www.prydwen.gg/zenless/characters/harumasa',
      sourceVersion: null,
      checkedAt: '2026-07-27T00:00:00.000Z',
      contentHash: stableContentHash({
        url: 'https://www.prydwen.gg/zenless/characters/harumasa',
        checkedAt: '2026-07-27',
      }),
      licenseBoundary:
        '社区候选页面：仅本地候选与来源定位，不作为官方事实或正式计算输入；页面未给出可核验的 3.0 适用版本。',
      verified: true,
    },
    wengines: [
      'Cordis Germina',
      'Zanshin Herb Case',
      'The Brimstone',
      'Heartstring Nocturne',
      'Severed Innocence',
      'Starlight Engine',
    ],
    sets: [
      'Thunder Metal 4 件 + Hormone Punk / Astral Voice / Branch & Blade Song / Shadow Harmony / Woodpecker Electro 2 件',
      'Shadow Harmony 4 件 + Branch & Blade Song / Woodpecker Electro / Astral Voice / Hormone Punk 2 件',
    ],
    stats: {
      main: ['4号位：攻击力%优先，暴击伤害/暴击率', '5号位：攻击力%/电伤', '6号位：攻击力%'],
      sub: ['暴击率至面板 75%，其后攻击力%、暴击伤害、穿透值、攻击力'],
    },
    progression: [
      '失衡爆发：先布置箭矢，失衡内围绕强化冲刺；核心、影画与具体技能等级需同版本独立核验。',
    ],
    team: [
      '击破爆发：琉音/青衣/扳机/安比之一 + 柚叶/妮可/耀嘉音等辅助；电异常对齐会影响 Thunder Metal 覆盖。',
    ],
  },
  'agent-lighter': {
    source: {
      id: 'prydwen-lighter-page-candidate',
      url: 'https://www.prydwen.gg/zenless/characters/lighter',
      sourceVersion: null,
      checkedAt: '2026-07-27T00:00:00.000Z',
      contentHash: stableContentHash({
        url: 'https://www.prydwen.gg/zenless/characters/lighter',
        checkedAt: '2026-07-27',
        section: 'build-and-teams',
      }),
      licenseBoundary:
        '社区候选页面：仅本地候选与来源定位，不作为官方事实或正式计算输入；页面未给出可核验的 3.0 适用版本。',
      verified: true,
    },
    wengines: [
      'Blazing Laurel',
      'Ice-Jade Teapot',
      'Hellfire Gears',
      'Precious Fossilized Core',
      'The Restrained',
    ],
    sets: [
      'King of the Summit 4 件 + Shockstar Disco / Swing Jazz 2 件',
      'Astral Voice 4 件 + King of the Summit / Shockstar Disco / Swing Jazz 2 件',
      'Proto Punk 4 件 + King of the Summit / Shockstar Disco / Swing Jazz 2 件',
    ],
    stats: {
      main: ['4号位：暴击率优先，其次暴击伤害', '5号位：攻击力%/火伤/穿透率', '6号位：冲击力'],
      sub: ['暴击率、暴击伤害、攻击力%、穿透率、攻击力；King of the Summit 方向需暴击率 50%+。'],
    },
    progression: ['击破辅助：保持 Morale 强化连段；核心与关键技能等级需按当前版本另行核验。'],
    team: [
      '火/冰暴击队的击破与增益方向；套装覆盖依赖队内是否已有 Astral Voice 持有者，邦布未作为稳定优先级录入。',
    ],
  },
  'agent-hugo': {
    source: {
      id: 'prydwen-hugo-page-candidate',
      url: 'https://www.prydwen.gg/zenless/characters/hugo',
      sourceVersion: null,
      checkedAt: '2026-07-27T00:00:00.000Z',
      contentHash: stableContentHash({
        url: 'https://www.prydwen.gg/zenless/characters/hugo',
        checkedAt: '2026-07-27',
        section: 'build-and-teams',
      }),
      licenseBoundary:
        '社区候选页面：仅本地候选与来源定位，不作为官方事实或正式计算输入；页面未给出可核验的 3.0 适用版本。',
      verified: true,
    },
    wengines: [
      'Myriad Eclipse',
      'Cordis Germina',
      'Heartstring Nocturne',
      'Steel Cushion',
      'Marcato Desire',
    ],
    sets: [
      'Hormone Punk 4 件 + Polar Metal / Woodpecker Electro / Puffer Electro / Astral Voice / Branch & Blade Song 2 件',
      'Dialyn 前提下可考虑 Puffer Electro 4 件 + Polar Metal 等 2 件',
    ],
    stats: {
      main: [
        '4号位：暴击伤害优先，其次暴击率',
        '5号位：冰伤优先，其次攻击力%/穿透率',
        '6号位：攻击力%',
      ],
      sub: [
        '暴击率、暴击伤害、攻击力%、攻击力、穿透；候选终局方向为暴击率 70–88%、暴击伤害 160–200%+。',
      ],
    },
    progression: [
      '爆发窗口优先特殊技与连携技，其次普攻、支援、闪避；以失衡期 Totalize 爆发为循环前提。',
    ],
    team: [
      '优先与莱特/莱卡恩/扳机等击破协同；可用青衣/普露夏，辅助方向列出苍角/耀嘉音。邦布方向未作稳定候选。',
    ],
  },
  'agent-caesar': {
    source: {
      id: 'prydwen-caesar-page-candidate',
      url: 'https://www.prydwen.gg/zenless/characters/caesar',
      sourceVersion: null,
      checkedAt: '2026-07-27T00:00:00.000Z',
      contentHash: stableContentHash({
        url: 'https://www.prydwen.gg/zenless/characters/caesar',
        checkedAt: '2026-07-27',
        section: 'build-and-teams',
      }),
      licenseBoundary:
        '社区候选页面：仅本地候选与来源定位，不作为官方事实或正式计算输入；页面未给出可核验的 3.0 适用版本。',
      verified: true,
    },
    wengines: [
      'Tusks of Fury',
      'Original Transmorpher',
      'Spring Embrace',
      'Peacekeeper - Specialized',
    ],
    sets: [
      'Astral Voice 4 件 + Shockstar Disco / King of the Summit / Proto Punk 2 件',
      'Proto Punk 4 件 + Shockstar Disco / King of the Summit 2 件',
      '物理异常队可考虑 Freedom Blues 4 件',
    ],
    stats: {
      main: ['4号位：暴击率/异常精通', '5号位：物理伤害优先，其次攻击力%/穿透率', '6号位：冲击力'],
      sub: ['暴击率、暴击伤害、攻击力%、穿透率、攻击力；物理异常方向保留异常精通分支。'],
    },
    progression: [
      '护盾/击破辅助：围绕格挡反击、强化特殊技与额外能力；核心与技能等级优先级需按当前版本另行核验。',
    ],
    team: [
      '通用护盾增益或物理异常支援方向；团队套装需避免与队内同一 4 件效果重复，邦布未作为稳定优先级录入。',
    ],
  },
  'agent-astra': {
    source: {
      id: 'prydwen-astra-page-candidate',
      url: 'https://www.prydwen.gg/zenless/characters/astra-yao',
      sourceVersion: null,
      checkedAt: '2026-07-27T00:00:00.000Z',
      contentHash: stableContentHash({
        url: 'https://www.prydwen.gg/zenless/characters/astra-yao',
        checkedAt: '2026-07-27',
        section: 'build-and-teams',
      }),
      licenseBoundary:
        '社区候选页面：仅本地候选与来源定位，不作为官方事实或正式计算输入；页面未给出可核验的 3.0 适用版本。',
      verified: true,
    },
    wengines: ['Elegant Vanity', 'Bashful Demon', 'Kaboom the Cannon', 'The Vault'],
    sets: [
      'Astral Voice 4 件 + Swing Jazz / Moonlight Lullaby / Hormone Punk 2 件',
      '队内已有 Astral Voice 时使用 Moonlight Lullaby 4 件 + Swing Jazz / Hormone Punk / Astral Voice 2 件',
    ],
    stats: {
      main: ['4号位：攻击力%', '5号位：攻击力%', '6号位：能量回复或攻击力%'],
      sub: [
        '先保证攻击力至约 3430 以满足核心团队增益上限；之后在暴击或异常方向二选一，能量回复随音擎/副套装调整。',
      ],
    },
    progression: [
      '特殊技进入 Idyllic Cadenza 后维持快速支援、连携和终结技；技能优先特殊技、连携、支援、闪避、普攻。',
    ],
    team: [
      '泛用低站场辅助；与伊芙琳及多数攻击特性角色、或雅/柳/简/柏妮思等异常角色协同。邦布方向未作稳定候选。',
    ],
  },
  'agent-rina': {
    source: {
      id: 'prydwen-rina-2.2',
      url: 'https://www.prydwen.gg/zenless/characters/rina',
      sourceVersion: '2.2',
      checkedAt: '2026-07-27T00:00:00.000Z',
      contentHash: stableContentHash({
        url: 'https://www.prydwen.gg/zenless/characters/rina',
        buildVersion: '2.2',
        checkedAt: '2026-07-27',
      }),
      licenseBoundary:
        '社区候选页面：仅本地候选与来源定位，不作为官方事实或正式计算输入；页面的构筑更新标为 2.2。',
      verified: true,
    },
    wengines: [
      'Weeping Cradle',
      'Kaboom the Cannon',
      'Slice of Time',
      '[Reverb] Mark II',
      'Unfettered Game Ball',
    ],
    sets: [
      'Moonlight Lullaby 4 件 + Puffer Electro / Astral Voice / Hormone Punk / Thunder Metal 2 件',
      'Astral Voice 4 件 + Puffer Electro / Hormone Punk / Thunder Metal 2 件',
      'Swing Jazz 4 件 + Puffer Electro / Astral Voice / Hormone Punk / Thunder Metal 2 件',
    ],
    stats: {
      main: ['4号位：攻击力%/异常精通', '5号位：穿透率', '6号位：能量回复优先，其次攻击力%'],
      sub: ['异常精通、攻击力%、穿透/攻击力；候选团队穿透方向为核心 6 时穿透率约 72%。'],
    },
    progression: ['连携技、特殊技优先，其次普攻、支援、闪避；保持人偶在场以维持穿透率增益。'],
    team: [
      '电异常：柳/简；电输出：悠真。通过同属性/阵营满足额外能力，并保持 Shock 与人偶部署。邦布方向未作稳定候选。',
    ],
  },
  'agent-lycaon': {
    source: {
      id: 'prydwen-lycaon-page-candidate',
      url: 'https://www.prydwen.gg/zenless/characters/lycaon',
      sourceVersion: null,
      checkedAt: '2026-07-27T00:00:00.000Z',
      contentHash: stableContentHash({
        url: 'https://www.prydwen.gg/zenless/characters/lycaon',
        checkedAt: '2026-07-27',
        section: 'build-and-teams',
      }),
      licenseBoundary:
        '社区候选页面：仅本地候选与来源定位，不作为官方事实或正式计算输入；页面未给出可核验的 3.0 适用版本。',
      verified: true,
    },
    wengines: [
      'Blazing Laurel',
      'Precious Fossilized Core',
      'Steam Oven',
      'Hellfire Gears',
      'The Restrained',
    ],
    sets: [
      'King of the Summit 4 件 + Shockstar Disco / Swing Jazz 2 件；需 50% 暴击率以触发该套装方向',
      'Shockstar Disco 4 件 + King of the Summit / Swing Jazz 2 件',
    ],
    stats: {
      main: ['4号位：暴击率/暴击伤害', '5号位：冰伤优先，其次攻击力%', '6号位：冲击力'],
      sub: ['暴击率/暴击伤害、攻击力%、穿透、攻击力；候选冲击力目标 169–190+。'],
    },
    progression: [
      '特殊技、支援优先，随后连携、普攻、闪避；由支援追击进入 Encircle Prey，并以 EX 特殊技开启失衡。',
    ],
    team: [
      '冰队：雅/艾莲；也可与雨果双击破，通用辅助方向为耀嘉音/柚叶/妮可，冰队可配苍角。邦布方向未作稳定候选。',
    ],
  },
  'agent-grace': {
    source: {
      id: 'prydwen-grace-page-candidate',
      url: 'https://www.prydwen.gg/zenless/characters/grace-howard',
      sourceVersion: null,
      checkedAt: '2026-07-27T00:00:00.000Z',
      contentHash: stableContentHash({
        url: 'https://www.prydwen.gg/zenless/characters/grace-howard',
        checkedAt: '2026-07-27',
        section: 'build-and-teams',
      }),
      licenseBoundary:
        '社区候选页面：仅本地候选与来源定位，不作为官方事实或正式计算输入；页面未给出可核验的 3.0 适用版本。',
      verified: true,
    },
    wengines: [
      'Timeweaver',
      'Practiced Perfection',
      'Fusion Compiler',
      'Electro-Lip Gloss',
      'Weeping Gemini',
    ],
    sets: ['Thunder Metal 4 件 + 候选 2 件套；以 Shock 覆盖为前提，异常/紊乱方向需按队伍复核。'],
    stats: {
      main: ['4号位：异常精通', '5号位：电伤/穿透率', '6号位：异常掌控'],
      sub: ['异常精通、攻击力%、穿透、攻击力；不把候选面板阈值升格为正式规则。'],
    },
    progression: [
      'B1-B2-B3→特殊/强化特殊→B4→特殊/强化特殊以生成并消耗 Zap；终结技后以 Pulse/Abloom 循环为适用前提。',
    ],
    team: ['电异常或紊乱副C方向；来源计算队示例为柏妮思+柚叶，具体邦布和版本化异常顺序仍待核验。'],
  },
  'agent-trigger': {
    source: {
      id: 'prydwen-trigger-page-candidate',
      url: 'https://www.prydwen.gg/zenless/characters/trigger',
      sourceVersion: null,
      checkedAt: '2026-07-27T00:00:00.000Z',
      contentHash: stableContentHash({
        url: 'https://www.prydwen.gg/zenless/characters/trigger',
        checkedAt: '2026-07-27',
        section: 'build-and-teams',
      }),
      licenseBoundary:
        '社区候选页面：仅本地候选与来源定位，不作为官方事实或正式计算输入；页面未给出可核验的 3.0 适用版本。',
      verified: true,
    },
    wengines: [
      'Spectral Gaze',
      'Blazing Laurel',
      'Ice-Jade Teapot',
      'The Restrained',
      'Precious Fossilized Core',
      'Steam Oven',
    ],
    sets: [
      'King of the Summit 4 件 + Shockstar Disco / Swing Jazz 2 件',
      'Astral Voice 4 件 + King of the Summit / Shockstar Disco / Swing Jazz 2 件',
    ],
    stats: {
      main: ['4号位：暴击率', '5号位：电伤优先，其次攻击力%', '6号位：冲击力'],
      sub: [
        '暴击率、暴击伤害、攻击力%、穿透、攻击力；候选冲击力 162–186+，额外能力上限前暴击率可至 90%。',
      ],
    },
    progression: [
      '先完成 4 发 Silenced Shot 与收招，再切出触发后台 Aftershock；普攻、特殊、连携、支援、闪避按页面顺序投入。',
    ],
    team: [
      '后台击破/Aftershock：优先零号·安比，亦可为火/冰队提供击破与团队增益；邦布方向未作稳定候选。',
    ],
  },
  'agent-orphie-magus': {
    source: {
      id: 'prydwen-orphie-magus-page-candidate',
      url: 'https://www.prydwen.gg/zenless/characters/orphie-and-magus',
      sourceVersion: null,
      checkedAt: '2026-07-27T00:00:00.000Z',
      contentHash: stableContentHash({
        url: 'https://www.prydwen.gg/zenless/characters/orphie-and-magus',
        checkedAt: '2026-07-27',
        section: 'build-and-teams',
      }),
      licenseBoundary:
        '社区候选页面：仅本地候选与来源定位，不作为官方事实或正式计算输入；页面未给出可核验的 3.0 适用版本。',
      verified: true,
    },
    wengines: [
      'Bellicose Blaze',
      'Heartstring Nocturne',
      'Severed Innocence',
      'Myriad Eclipse',
      'Cordis Germina',
      'Gilded Blossom',
      'Marcato Desire',
    ],
    sets: [
      'Shadow Harmony 4 件 + Swing Jazz / Moonlight Lullaby 2 件',
      '双攻击队可用 Astral Voice 4 件 + Swing Jazz / Moonlight Lullaby 2 件',
    ],
    stats: {
      main: ['4号位：暴击伤害/暴击率', '5号位：火伤优先，其次攻击力%', '6号位：能量回复或攻击力%'],
      sub: [
        '暴击伤害/暴击率、攻击力%、穿透、攻击力；候选终局方向为暴击率 90–100%、能量回复 80%+。',
      ],
    },
    progression: [
      '围绕 Bottled Heat 与 Zeroed In：100 热量后强化特殊技快速支援并给全队增益；技能优先特殊、连携、支援、普攻、闪避。',
    ],
    team: ['副C/Aftershock：优先席德或零号·安比，可与扳机/橘福福协同；邦布方向未作稳定候选。'],
  },
  'agent-soldier-0-anby': {
    source: {
      id: 'prydwen-soldier0-anby-2.5',
      url: 'https://www.prydwen.gg/zenless/characters/anby-demara-soldier-0',
      sourceVersion: '2.5',
      checkedAt: '2026-07-27T00:00:00.000Z',
      contentHash: stableContentHash({
        url: 'https://www.prydwen.gg/zenless/characters/anby-demara-soldier-0',
        buildVersion: '2.5',
        checkedAt: '2026-07-27',
      }),
      licenseBoundary:
        '社区候选页面：仅本地候选与来源定位，不作为官方事实或正式计算输入；页面的构筑更新标为 2.5。',
      verified: true,
    },
    wengines: ['Severed Innocence', 'Cordis Germina', 'Heartstring Nocturne', 'Marcato Desire'],
    sets: [
      '页面明确的 Aftershock/暴击输出构筑；4 件套与 4/5/6 号位需同版本字段复核，不能从候选结论外推。',
    ],
    stats: {
      main: ['4/5/6号位：页面已定位为暴击/电伤/攻击取向，精确优先级待同版本字段核验。'],
      sub: ['暴击率、暴击伤害、攻击力%、穿透；Cordis Germina 前提下须调整暴击率避免溢出。'],
    },
    progression: [
      '围绕 Silver Star、Azure Flash 与失衡窗口；120 能量双 EX 或双连携循环均为候选手动参考。',
    ],
    team: [
      'Aftershock 输出：奥菲丝&「鬼火」+扳机为页面计算队；也可与橘福福协同。邦布方向未作稳定候选。',
    ],
  },
  'agent-yidhari': {
    source: {
      id: 'prydwen-yidhari-page-candidate',
      url: 'https://www.prydwen.gg/zenless/characters/yidhari',
      sourceVersion: null,
      checkedAt: '2026-07-27T00:00:00.000Z',
      contentHash: stableContentHash({
        url: 'https://www.prydwen.gg/zenless/characters/yidhari',
        checkedAt: '2026-07-27',
        section: 'build-and-teams',
      }),
      licenseBoundary:
        '社区候选页面：仅本地候选与来源定位，不作为官方事实或正式计算输入；页面未给出可核验的 3.0 适用版本。',
      verified: true,
    },
    wengines: [
      "Kraken's Cradle",
      "Grill O'Wisp",
      'Cauldron of Clarity',
      'Qingming Birdcage',
      'Radiowave Journey',
      'Puzzle Sphere',
    ],
    sets: ['Yunkui Tales 4 件 + Woodpecker Electro / Branch & Blade Song 2 件'],
    stats: {
      main: ['4号位：暴击伤害/暴击率', '5号位：冰伤或生命值%', '6号位：生命值%'],
      sub: ['暴击率、暴击伤害、生命值%、攻击力%；候选暴击率为 58.6–65.8%（战斗内可提高）。'],
    },
    progression: [
      '以耗血充能的 Frostbite Embrace、Glacial Crush 与失衡连携为核心；特殊、连携、普攻、支援、闪避按页面顺序投入。',
    ],
    team: [
      '裂隙输出：卢西娅为优先辅助，潘引壶为可获得替代；琉音优先击破、莱卡恩替代。邦布方向未作稳定候选。',
    ],
  },
  'agent-lucia': {
    source: {
      id: 'prydwen-lucia-page-candidate',
      url: 'https://www.prydwen.gg/zenless/characters/lucia',
      sourceVersion: null,
      checkedAt: '2026-07-27T00:00:00.000Z',
      contentHash: stableContentHash({
        url: 'https://www.prydwen.gg/zenless/characters/lucia',
        checkedAt: '2026-07-27',
        section: 'build-and-teams',
      }),
      licenseBoundary:
        '社区候选页面：仅本地候选与来源定位，不作为官方事实或正式计算输入；页面未给出可核验的 3.0 适用版本。',
      verified: true,
    },
    wengines: ['Dreamlit Hearth'],
    sets: [
      '裂隙辅助候选方向；精确 4 件/2 件套与 4/5/6 号位需按页面当前构筑字段补齐，不能由角色机制推断。',
    ],
    stats: {
      main: ['生命值/能量回复方向；精确号位优先级待同版本字段核验。'],
      sub: ['生命值%、能量回复与核心增益相关属性；候选来源明确以生命值扩展裂隙队增益。'],
    },
    progression: [
      '通过 Whim、连携、强化特殊和支援追击积累 Dream Points，维持 Dream State / Ether Veil: Wellspring；技能优先特殊、连携、普攻、支援、闪避。',
    ],
    team: [
      '裂隙辅助：仪玄、狛野真斗、般岳与伊德海莉方向；以维持 Ether Veil 为适用前提。邦布方向未作稳定候选。',
    ],
  },
  'agent-alice': {
    source: {
      id: 'prydwen-alice-page-candidate',
      url: 'https://www.prydwen.gg/zenless/characters/alice',
      sourceVersion: null,
      checkedAt: '2026-07-27T00:00:00.000Z',
      contentHash: stableContentHash({
        url: 'https://www.prydwen.gg/zenless/characters/alice',
        checkedAt: '2026-07-27',
        section: 'build-and-teams',
      }),
      licenseBoundary:
        '社区候选页面：仅本地候选与来源定位，不作为官方事实或正式计算输入；页面未给出可核验的 3.0 适用版本。',
      verified: true,
    },
    wengines: ['Alice 的专属音擎', 'Fusion Compiler'],
    sets: ['物理异常输出方向；4 件套及精确 4/5/6 号位待同版本构筑区字段核验。'],
    stats: {
      main: ['异常精通/物理伤害/异常掌控方向；精确号位优先级待同版本字段核验。'],
      sub: ['异常精通、攻击力%、穿透；候选路线以物理异常和 Blade Etiquette 充能为前提。'],
    },
    progression: [
      '积累 Blade Etiquette 后施放蓄力普攻与 Polarized Assault；快速支援接普攻5、强化特殊和完美闪避用于资源循环。',
    ],
    team: [
      '物理异常主C；候选协同为柚叶或耀嘉音等快速支援辅助，异常队需按敌人与循环手动对照。邦布方向未作稳定候选。',
    ],
  },
  'agent-ju-fufu': {
    source: {
      id: 'prydwen-jufufu-2.0',
      url: 'https://www.prydwen.gg/zenless/characters/ju-fufu',
      sourceVersion: '2.0',
      checkedAt: '2026-07-27T00:00:00.000Z',
      contentHash: stableContentHash({
        url: 'https://www.prydwen.gg/zenless/characters/ju-fufu',
        buildVersion: '2.0',
        checkedAt: '2026-07-27',
      }),
      licenseBoundary:
        '社区候选页面：仅本地候选与来源定位，不作为官方事实或正式计算输入；页面构筑更新标为 2.0。',
      verified: true,
    },
    wengines: ['Ju Fufu 的专属音擎', 'Blazing Laurel 等击破音擎；精确排序需同版本构筑区字段核验。'],
    sets: [
      'King of the Summit 4 件 + Shockstar Disco / Woodpecker Electro / Astral Voice / Hormone Punk / Swing Jazz 2 件',
      '队内已有 King of the Summit 时使用 Swing Jazz 4 件',
    ],
    stats: {
      main: ['4号位：暴击率/攻击力%', '5号位：攻击力%', '6号位：冲击力/攻击力%'],
      sub: [
        'King 4 件时暴击率至 50%，再堆攻击力至约 3400，随后暴击伤害/穿透；候选冲击力 139–160+。',
      ],
    },
    progression: [
      '围绕 Hu Wei、Might 与 Momentum 后台循环；技能优先连携、特殊、普攻、支援、闪避。',
    ],
    team: [
      '仪玄优先协同；亦可为零号·安比、艾莲、11号、伊芙琳、雨果等提供后台击破与连携/终结技增益。邦布方向未作稳定候选。',
    ],
  },
  'agent-dialyn': {
    source: {
      id: 'prydwen-dialyn-2.4',
      url: 'https://www.prydwen.gg/zenless/characters/dialyn',
      sourceVersion: '2.4',
      checkedAt: '2026-07-27T00:00:00.000Z',
      contentHash: stableContentHash({
        url: 'https://www.prydwen.gg/zenless/characters/dialyn',
        buildVersion: '2.4',
        checkedAt: '2026-07-27',
      }),
      licenseBoundary:
        '社区候选页面：仅本地候选与来源定位，不作为官方事实或正式计算输入；页面构筑更新标为 2.4。',
      verified: true,
    },
    wengines: ['Yesterday Calls', 'Hellfire Gears', 'Steam Oven'],
    sets: ['击破候选方向；精确 4 件/2 件套与 4/5/6 号位仍需从同版本构筑区抽取。'],
    stats: {
      main: ['以暴击率、能量回复与击破循环为方向；精确号位优先级待同版本字段核验。'],
      sub: ['暴击率（超过 50% 提高冲击）、能量回复与候选击破属性；不把机制文本转换为正式阈值。'],
    },
    progression: [
      '围绕 Positive Reviews、Rock→Scissors→Paper 强化特殊技，以及失衡期终结技转换；注意队伍站位影响额外能力。',
    ],
    team: [
      '攻击/裂隙队的击破：叶瞬光、狛野真斗、般岳、雨果、伊芙琳等；以延长失衡和终结技转换为适用前提。邦布方向未作稳定候选。',
    ],
  },
  'agent-yuzuha': {
    source: {
      id: 'prydwen-yuzuha-page-candidate',
      url: 'https://www.prydwen.gg/zenless/characters/ukinami-yuzuha',
      sourceVersion: null,
      checkedAt: '2026-07-27T00:00:00.000Z',
      contentHash: stableContentHash({
        url: 'https://www.prydwen.gg/zenless/characters/ukinami-yuzuha',
        checkedAt: '2026-07-27',
        section: 'build-and-teams',
      }),
      licenseBoundary:
        '社区候选页面：仅本地候选与来源定位，不作为官方事实或正式计算输入；页面未给出可核验的 3.0 适用版本。',
      verified: true,
    },
    wengines: [
      'Weeping Cradle',
      'Thoughtbop',
      'Metanukimorphosis',
      'Kaboom the Cannon',
      'Unfettered Game Ball',
    ],
    sets: ['Moonlight Lullaby 4 件；完整候选套装分支与 4/5/6 号位需按同版本构筑区继续核验。'],
    stats: {
      main: ['异常或暴击辅助的分支取决于队伍；精确号位优先级待同版本字段核验。'],
      sub: ['异常队考虑异常相关属性；其他队伍以能量/团队增益方向为准，不能转为正式约束。'],
    },
    progression: [
      '防御支援/招架后接支援追击，再以强化特殊或终结技触发快速支援；保持 Sweet Scare、Tanuki Wish 与 Sugar Point。',
    ],
    team: ['异常队优先柳/简/派派等，并可配薇薇安/柏妮思；雅队为例外候选。邦布方向未作稳定候选。'],
  },
  'agent-manato': {
    source: {
      id: 'prydwen-manato-page-candidate',
      url: 'https://www.prydwen.gg/zenless/characters/manato',
      sourceVersion: null,
      checkedAt: '2026-07-27T00:00:00.000Z',
      contentHash: stableContentHash({
        url: 'https://www.prydwen.gg/zenless/characters/manato',
        checkedAt: '2026-07-27',
        section: 'build-and-teams',
      }),
      licenseBoundary:
        '社区候选页面：仅本地候选与来源定位，不作为官方事实或正式计算输入；页面未给出可核验的 3.0 适用版本。',
      verified: true,
    },
    wengines: ['Qingming Birdcage 等裂隙候选音擎；完整排序需同版本构筑区字段核验。'],
    sets: ['裂隙输出候选方向；完整 4+2 / 2+2+2 组合与号位待同版本字段核验。'],
    stats: {
      main: ['裂隙/生命值与暴击方向；精确号位优先级待同版本字段核验。'],
      sub: ['暴击率、暴击伤害、生命值%、攻击力%；不将候选玩法描述升格为正式面板。'],
    },
    progression: [
      '通过防御支援和特殊技恢复 Blazing Heart，以支援追击、强化普攻消耗生命；失衡内保留强化特殊和终结技。',
    ],
    team: ['裂隙主C：卢西娅、潘引壶辅助，琉音优先击破、橘福福次选。邦布方向未作稳定候选。'],
  },
  'agent-banyue': {
    source: {
      id: 'prydwen-banyue-page-candidate',
      url: 'https://www.prydwen.gg/zenless/characters/banyue',
      sourceVersion: null,
      checkedAt: '2026-07-27T00:00:00.000Z',
      contentHash: stableContentHash({
        url: 'https://www.prydwen.gg/zenless/characters/banyue',
        checkedAt: '2026-07-27',
        section: 'build-and-teams',
      }),
      licenseBoundary:
        '社区候选页面：仅本地候选与来源定位，不作为官方事实或正式计算输入；页面未给出可核验的 3.0 适用版本。',
      verified: true,
    },
    wengines: ['Wrathful Vajra', 'Qingming Birdcage'],
    sets: [
      '裂隙暴击输出套装 + Woodpecker Electro / Branch & Blade Song 2 件；主套精确名称待同版本构筑区核验。',
    ],
    stats: {
      main: ['4号位：暴击伤害优先，其次暴击率', '5号位：火伤优先，其次生命值%', '6号位：生命值%'],
      sub: ['暴击率/暴击伤害、生命值%、攻击力%、生命值；候选目标 Sheer Force 2200+、生命 18000+。'],
    },
    progression: [
      '保持场上完美招架以积累 Wrathful Fires；120 层后配合失衡爆发并利用 Adrenaline 返还循环。',
    ],
    team: [
      '裂隙主C：琉音优先击破、卢西娅辅助；来源页面强调二者的终结技转换和失衡延长协同。邦布方向未作稳定候选。',
    ],
  },
  'agent-zhao': {
    source: {
      id: 'prydwen-zhao-page-candidate',
      url: 'https://www.prydwen.gg/zenless/characters/zhao',
      sourceVersion: null,
      checkedAt: '2026-07-27T00:00:00.000Z',
      contentHash: stableContentHash({
        url: 'https://www.prydwen.gg/zenless/characters/zhao',
        checkedAt: '2026-07-27',
        section: 'build-and-teams',
      }),
      licenseBoundary:
        '社区候选页面：仅本地候选与来源定位，不作为官方事实或正式计算输入；页面未给出可核验的 3.0 适用版本。',
      verified: true,
    },
    wengines: ['Half-Sugar Bunny', 'Tusks of Fury'],
    sets: ['防御辅助候选方向；完整套装与号位需同版本构筑区字段核验。'],
    stats: {
      main: ['生命值/能量回复方向；精确号位待同版本字段核验。'],
      sub: ['生命值、能量回复与暴击方向；候选满层团队增益以初始生命约 27000 为前提。'],
    },
    progression: [
      '低站场循环：积累 Frostbite Points 后开启 Ether Veil: Wellspring，利用追击/强化特殊/终结技后自动蓄力的 Final Verdict。',
    ],
    team: [
      '叶瞬光优先；也可为猫又、艾莲、席德、柳、爱丽丝等攻击/异常角色提供增益。邦布方向未作稳定候选。',
    ],
  },
  'agent-sunna': {
    source: {
      id: 'prydwen-sunna-2.6',
      url: 'https://www.prydwen.gg/zenless/characters/sunna',
      sourceVersion: '2.6',
      checkedAt: '2026-07-27T00:00:00.000Z',
      contentHash: stableContentHash({
        url: 'https://www.prydwen.gg/zenless/characters/sunna',
        buildVersion: '2.6',
        checkedAt: '2026-07-27',
      }),
      licenseBoundary:
        '社区候选页面：仅本地候选与来源定位，不作为官方事实或正式计算输入；页面构筑更新标为 2.6。',
      verified: true,
    },
    wengines: ['Thoughtbop', 'Weeping Cradle', 'Kaboom the Cannon', 'Unfettered Game Ball'],
    sets: ['Moonlight Lullaby 4 件 + Swing Jazz / Astral Voice / Hormone Punk 2 件'],
    stats: {
      main: ['4号位：攻击力%', '5号位：攻击力%', '6号位：能量回复'],
      sub: ['攻击力至约 3500，再按异常或暴击分支选择异常精通或双暴/穿透。'],
    },
    progression: [
      'Bubblegum Barrage→Special Photography Technique 激活 Ether Veil，切出攻击角色触发 Cat’s Gaze，约 25 秒刷新 Moonlight Lullaby。',
    ],
    team: [
      '叶瞬光+赵/琉音，或比利/艾莲/悠真等攻击输出；Aria 队可走异常分支。邦布方向未作稳定候选。',
    ],
  },
  'agent-aria': {
    source: {
      id: 'prydwen-aria-page-candidate',
      url: 'https://www.prydwen.gg/zenless/characters/aria',
      sourceVersion: null,
      checkedAt: '2026-07-27T00:00:00.000Z',
      contentHash: stableContentHash({
        url: 'https://www.prydwen.gg/zenless/characters/aria',
        checkedAt: '2026-07-27',
        section: 'build-and-teams',
      }),
      licenseBoundary:
        '社区候选页面：仅本地候选与来源定位，不作为官方事实或正式计算输入；页面未给出可核验的 3.0 适用版本。',
      verified: true,
    },
    wengines: ['Angel in the Shell', 'Flight of Fancy'],
    sets: ["Phaethon's Melody 4 件 + Freedom Blues / Chaos Jazz 2 件"],
    stats: {
      main: ['4号位：异常精通', '5号位：以太伤害/攻击力%/穿透率', '6号位：异常掌控'],
      sub: ['异常精通、攻击力%、穿透、攻击力；候选异常精通 330–420、异常掌控 184–244。'],
    },
    progression: [
      '普攻4/替代特殊/强化特殊积累 Fandom Power，消费后触发三级 Perfect Pitch 与 Abloom；无异常目标时不应强行触发。',
    ],
    team: [
      '候选计算队为千夏+柚叶；与南宫羽等异常协同需按异常与失衡时机手动对照。邦布方向未作稳定候选。',
    ],
  },
  'agent-nangong': {
    source: {
      id: 'prydwen-nangong-page-candidate',
      url: 'https://www.prydwen.gg/zenless/characters/nangong-yu',
      sourceVersion: null,
      checkedAt: '2026-07-27T00:00:00.000Z',
      contentHash: stableContentHash({
        url: 'https://www.prydwen.gg/zenless/characters/nangong-yu',
        checkedAt: '2026-07-27',
        section: 'build-and-teams',
      }),
      licenseBoundary:
        '社区候选页面：仅本地候选与来源定位，不作为官方事实或正式计算输入；页面未给出可核验的 3.0 适用版本。',
      verified: true,
    },
    wengines: [
      'Neon Fantasies',
      'Hellfire Gears',
      'The Simmering Pot',
      'Precious Fossilized Core',
      'Roaring Fur-nace',
    ],
    sets: ["Phaethon's Melody 4 件 + Phaethon's Melody 2 件"],
    stats: {
      main: ['4号位：异常精通', '5号位：以太伤害/攻击力%/穿透率', '6号位：异常掌控'],
      sub: ['异常精通、攻击力%、穿透、攻击力；候选异常精通 280–350、异常掌控 173–211。'],
    },
    progression: ['依异常与失衡时机管理资源和强化特殊；技能优先特殊、连携、普攻、支援、闪避。'],
    team: [
      '异常协同：爱芮/爱丽丝/简/派派/格莉丝/柏妮思/雅/柳等；不同队伍的能量与异常顺序不可混用。邦布方向未作稳定候选。',
    ],
  },
  'agent-cissia': {
    source: {
      id: 'prydwen-cissia-page-candidate',
      url: 'https://www.prydwen.gg/zenless/characters/cissia',
      sourceVersion: null,
      checkedAt: '2026-07-27T00:00:00.000Z',
      contentHash: stableContentHash({
        url: 'https://www.prydwen.gg/zenless/characters/cissia',
        checkedAt: '2026-07-27',
        section: 'build-and-teams',
      }),
      licenseBoundary:
        '社区候选页面：仅本地候选与来源定位，不作为官方事实或正式计算输入；页面未给出可核验的 3.0 适用版本。',
      verified: true,
    },
    wengines: ['Serpentine Seeker', 'Bellicose Blaze'],
    sets: [
      '电队可用 Thunder Metal 4 件 + Swing Jazz / Moonlight Lullaby / Branch & Blade Song 2 件；其余主套方向需同版本字段核验。',
    ],
    stats: {
      main: ['4号位：暴击率优先，其次暴击伤害', '5号位：电伤优先，其次攻击力%', '6号位：能量回复'],
      sub: ['暴击率、暴击伤害、攻击力%、穿透、攻击力；候选暴击率 50–57%、暴击伤害 110%+。'],
    },
    progression: [
      '频繁强化特殊积累 Venom，Serpentine Shadow 后以强化普攻消耗并触发 Corrode Bone；失衡内保留能量进行爆发。',
    ],
    team: ['席德优先，千夏/耀嘉音等攻击辅助可用；电队可配扳机。邦布方向未作稳定候选。'],
  },
  'agent-starlight-billy': {
    source: {
      id: 'prydwen-starlight-billy-2.8',
      url: 'https://www.prydwen.gg/zenless/characters/billy-starlight',
      sourceVersion: '2.8',
      checkedAt: '2026-07-27T00:00:00.000Z',
      contentHash: stableContentHash({
        url: 'https://www.prydwen.gg/zenless/characters/billy-starlight',
        buildVersion: '2.8',
        checkedAt: '2026-07-27',
      }),
      licenseBoundary:
        '社区候选页面：仅本地候选与来源定位，不作为官方事实或正式计算输入；页面构筑更新标为 2.8。',
      verified: true,
    },
    wengines: [
      'Starlight Rider Faceplate',
      'Qingming Birdcage',
      'Cauldron of Clarity',
      'Steel Cushion',
      "Grill O'Wisp",
    ],
    sets: [
      '裂隙暴击候选方向 + Hormone Punk / Bunny in Wonderland 2 件；主套精确名称待同版本构筑区核验。',
    ],
    stats: {
      main: [
        '4号位：暴击率/暴击伤害/生命值%',
        '5号位：物理伤害优先，其次生命值%',
        '6号位：生命值%',
      ],
      sub: ['暴击率、暴击伤害、生命值%、攻击力；候选 Sheer Force 2200+、生命 18000+。'],
    },
    progression: [
      '通过 Drive Suppression 耗血、普攻/闪避反击回血，积累 Determination 后释放 Full-Throttle Starlight；失衡内保留 Cool Wheelie、终结技和强化普攻。',
    ],
    team: ['裂隙：琉音+卢西娅候选计算队；诺姆可提供额外连携的替代方向。邦布方向未作稳定候选。'],
  },
  'agent-norma': {
    source: {
      id: 'prydwen-norma-page-candidate',
      url: 'https://www.prydwen.gg/zenless/characters/norma',
      sourceVersion: null,
      checkedAt: '2026-07-27T00:00:00.000Z',
      contentHash: stableContentHash({
        url: 'https://www.prydwen.gg/zenless/characters/norma',
        checkedAt: '2026-07-27',
        section: 'build-and-teams',
      }),
      licenseBoundary:
        '社区候选页面：仅本地候选与来源定位，不作为官方事实或正式计算输入；页面未给出可核验的 3.0 适用版本。',
      verified: true,
    },
    wengines: [
      'Chief Sidekick',
      'Hellfire Gears',
      'Steam Oven',
      'Blazing Laurel',
      'The Simmering Pot',
    ],
    sets: ['King of the Summit 4 件 + Swing Jazz / Moonlight Lullaby / Woodpecker Electro 2 件'],
    stats: {
      main: ['4号位：暴击率', '5号位：火伤优先，其次穿透率/攻击力%', '6号位：能量回复/冲击力'],
      sub: ['暴击率至战斗内 100%，随后暴击伤害、攻击力%、穿透、攻击力；候选攻击力 2400+。'],
    },
    progression: [
      '尽早强化特殊进入 En-Nah Barrage，后台炮塔叠 Daze；失衡中段以蓄力普攻给主C额外连携，注意 Preheated Chamber。',
    ],
    team: [
      '千夏泛用辅助组合，佩洛伊斯/11号、希希芙/奥菲丝、雨果或裂隙输出可选；团队按额外连携和失衡窗口调整。邦布方向未作稳定候选。',
    ],
  },
  'agent-yixuan': {
    source: {
      id: 'prydwen-yixuan-2.5',
      url: 'https://www.prydwen.gg/zenless/characters/yixuan',
      sourceVersion: '2.5',
      checkedAt: '2026-06-14T00:00:00.000Z',
      contentHash: stableContentHash({
        url: 'https://www.prydwen.gg/zenless/characters/yixuan',
        updatedAt: '2026-06-14',
        buildVersion: '2.5',
      }),
      licenseBoundary: '社区候选页面：仅本地候选与来源定位，不作为官方事实或正式计算输入。',
      verified: true,
    },
    wengines: ['Qingming Birdcage', 'Cauldron of Clarity', 'Radiowave Journey', 'Puzzle Sphere'],
    sets: ['Yunkui Tales 4 件 + Woodpecker Electro / Branch & Blade Song 2 件'],
    stats: {
      main: ['4号位：暴击伤害/暴击率', '5号位：以太伤害/生命值', '6号位：生命值'],
      sub: ['暴击率/暴击伤害、生命值%、攻击力%'],
    },
    progression: ['候选页面包含构筑与终局面板；技能/核心优先级需同版本独立核验。'],
    team: ['页面计算假设：橘福福与卢西娅；不等同唯一队伍或正式最优。'],
  },
  'agent-seed': {
    source: {
      id: 'prydwen-seed-2.2',
      url: 'https://www.prydwen.gg/zenless/characters/seed',
      sourceVersion: '2.2',
      checkedAt: '2026-06-14T00:00:00.000Z',
      contentHash: stableContentHash({
        url: 'https://www.prydwen.gg/zenless/characters/seed',
        updatedAt: '2026-06-14',
        buildVersion: '2.2',
      }),
      licenseBoundary: '社区候选页面：仅本地候选与来源定位，不作为官方事实或正式计算输入。',
      verified: true,
    },
    wengines: ['Cordis Germina', 'Heartstring Nocturne', 'Myriad Eclipse', 'Zanshin Herb Case'],
    sets: ["Dawn's Bloom 4 件 + Woodpecker Electro 2 件"],
    stats: {
      main: ['页面构筑区已定位；需同版本抽取4/5/6号位精确优先级。'],
      sub: ['暴击率/暴击伤害与攻击力方向；需同版本字段核验。'],
    },
    progression: ['候选页面包含音擎与套装方向；技能优先级需同版本独立核验。'],
    team: ['页面计算假设：零号·安比与耀嘉音；不等同唯一队伍或正式最优。'],
  },
  'agent-zhu-yuan': {
    source: {
      id: 'prydwen-zhuyuan-2.4',
      url: 'https://www.prydwen.gg/zenless/characters/zhu-yuan',
      sourceVersion: '2.4',
      checkedAt: '2026-06-14T00:00:00.000Z',
      contentHash: stableContentHash({
        url: 'https://www.prydwen.gg/zenless/characters/zhu-yuan',
        buildVersion: '2.4',
      }),
      licenseBoundary: '社区候选页面：仅本地候选与来源定位，不作为官方事实或正式计算输入。',
      verified: true,
    },
    wengines: ['Cordis Germina', 'The Brimstone', 'Riot Suppressor Mark VI', 'Marcato Desire'],
    sets: [
      'Chaotic Metal 4 件 + Woodpecker Electro / Astral Voice 2 件',
      'Puffer Electro 4 件（需琉音前提）',
    ],
    stats: {
      main: ['4号位：暴击伤害/暴击率', '5号位：攻击力/以太伤害/穿透率', '6号位：攻击力'],
      sub: ['暴击率/暴击伤害/攻击力/穿透'],
    },
    progression: ['候选页面包含终局面板；技能/核心优先级需同版本独立核验。'],
    team: ['页面计算假设：琉音与妮可；不等同唯一队伍或正式最优。'],
  },
  'agent-miyabi': {
    source: {
      id: 'prydwen-miyabi-2.1',
      url: 'https://www.prydwen.gg/zenless/characters/miyabi',
      sourceVersion: '2.1',
      checkedAt: '2026-06-14T00:00:00.000Z',
      contentHash: stableContentHash({
        url: 'https://www.prydwen.gg/zenless/characters/miyabi',
        buildVersion: '2.1',
      }),
      licenseBoundary: '社区候选页面：仅本地候选与来源定位，不作为官方事实或正式计算输入。',
      verified: true,
    },
    wengines: ['Hailstorm Shrine', 'Fusion Compiler', 'Electro-Lip Gloss', 'Rainforest Gourmet'],
    sets: [
      'Branch & Blade Song 4 件 + Polar Metal / Astral Voice / Hormone Punk 2 件',
      'Woodpecker Electro 4 件 + Polar Metal 2 件',
    ],
    stats: {
      main: ['4号位：暴击率/攻击力', '5号位：冰伤/攻击力', '6号位：攻击力'],
      sub: ['暴击率（至80%）、暴击伤害、攻击力、异常精通/穿透'],
    },
    progression: ['候选页面包含终局面板；技能/核心优先级需同版本独立核验。'],
    team: ['需持续属性异常覆盖；不等同唯一队伍或正式最优。'],
  },
  'agent-seth': {
    source: {
      id: 'prydwen-seth-1.5',
      url: 'https://www.prydwen.gg/zenless/characters/seth',
      sourceVersion: '1.5',
      checkedAt: '2026-06-14T00:00:00.000Z',
      contentHash: stableContentHash({
        url: 'https://www.prydwen.gg/zenless/characters/seth',
        buildVersion: '1.5',
      }),
      licenseBoundary: '社区候选页面：仅本地候选与来源定位，不作为官方事实或正式计算输入。',
      verified: true,
    },
    wengines: [
      'Peacekeeper - Specialized',
      'Spring Embrace',
      'Bunny Band',
      'Original Transmorpher',
    ],
    sets: [
      'Astral Voice 4 件 + Swing Jazz / Freedom Blues 2 件',
      'Swing Jazz 4 件 + Proto Punk / Shockstar Disco 2 件',
      'Proto Punk 4 件 + Swing Jazz 2 件',
    ],
    stats: {
      main: ['4号位：攻击力/异常精通', '5号位：攻击力/电伤', '6号位：能量回复/异常掌控'],
      sub: ['攻击力%、异常精通、攻击力、穿透'],
    },
    progression: ['候选页面强调强化特殊技与蓄力普攻的循环；技能/核心优先级需同版本独立核验。'],
    team: ['面向异常队的护盾与异常效率支援；不等同唯一队伍或正式最优。'],
  },
}

/**
 * R5 closes the remaining warehouse-constraint gaps with page-level, non-generic evidence.
 * These remain candidate directions: a community build page is never a formal game fact or a
 * direct-damage input. Keeping the override separate makes the source-specific upgrade auditable.
 */
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

const r5WarehouseCandidateOverrides: typeof pageCandidateDirections = {
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

function bwikiAgentSource(agentId: string, agentName: string): PlayerBuildSource {
  const url = `https://wiki.biligame.com/zzz/${encodeURIComponent(agentName)}`
  const page = bwikiPageEvidence[agentId]
  return {
    id: `bwiki-agent-${stableContentHash(agentName).slice(-12)}`,
    url,
    sourceVersion: null,
    checkedAt: page?.updatedAt ?? checkedAt,
    contentHash: stableContentHash({
      url,
      pageUpdatedAt: page?.updatedAt ?? null,
      purpose: 'page-level build intake locator',
    }),
    licenseBoundary: page
      ? 'CC BY-NC-SA 4.0：仅本地非商业候选、保留署名与同许可边界；不作为官方事实或正式计算输入。'
      : '尚未逐页核验的 BWIKI 定位入口；不能作为候选事实或正式计算输入。',
    verified: Boolean(page),
  }
}

function missing(path: string, source: PlayerBuildSource, reason: string): PlayerBuildField {
  return { path, status: 'missing', value: null, source, reason }
}

function formalCatalog(path: string, value: unknown): PlayerBuildField {
  return {
    path,
    status: 'formal',
    value,
    source: officialCatalogSource,
    reason: '3.0 正式目录已核验。',
  }
}

function candidateDirection(
  path: string,
  value: unknown,
  source: PlayerBuildSource,
): PlayerBuildField {
  return {
    path,
    status: 'candidate',
    value,
    source,
    reason: '页面级社区构筑候选；需同版本官方或游戏内核验后才能进入正式仓库求解。',
  }
}

function sourceFromBuildKnowledge(
  profile: (typeof buildKnowledge30Profiles)[number],
  fallback: PlayerBuildSource,
): PlayerBuildSource {
  const evidence =
    profile.sourceEvidence.find(
      (item) => item.status === 'candidate' && item.sourceVersion === '3.0',
    ) ?? profile.sourceEvidence.find((item) => item.status === 'candidate')
  return evidence
    ? {
        id: `build-knowledge-${stableContentHash(evidence.url).slice(-12)}`,
        url: evidence.url,
        sourceVersion: evidence.sourceVersion,
        checkedAt: evidence.checkedAt,
        contentHash: evidence.contentHash,
        licenseBoundary: evidence.licenseBoundary,
        verified: true,
      }
    : fallback
}

export const playerBuildProfiles30: PlayerBuildProfile[] = agentCatalog
  .filter((agent) => agent[7] === 'released')
  .map(([agentId, agentName, specialty, , rarity, attribute, faction]) => {
    const knowledge = buildKnowledge30Profiles.find((profile) => profile.agentId === agentId)!
    const candidateSource = bwikiAgentSource(agentId, agentName)
    const pageEvidence = bwikiPageEvidence[agentId]
    const recommendation = knowledge.recommendation
    const candidate = knowledge.status === 'candidate' && recommendation !== null
    const buildSource = sourceFromBuildKnowledge(knowledge, candidateSource)
    const pageCandidate = r5WarehouseCandidateOverrides[agentId] ?? pageCandidateDirections[agentId]
    const reviewedSkills = reviewedGuideSkillDirections[agentId]
    const reviewedBuild = reviewedGuideBuildDirections[agentId]
    const archivedSets =
      !reviewedBuild && pageCandidate && !compileCandidateSetPlans(pageCandidate.sets).length
        ? getArchivedGuideSetDirections(agentId)
        : null
    const fields: PlayerBuildField[] = [
      formalCatalog('identity', { rarity, specialty, attribute, faction }),
      pageEvidence?.lv60
        ? candidateDirection('progression.lv60_and_ascension', pageEvidence.lv60, candidateSource)
        : missing(
            'progression.lv60_and_ascension',
            candidateSource,
            '待逐页提取并交叉核验 LV60 面板与突破材料。',
          ),
      missing(
        'progression.skill_core_cinema',
        candidateSource,
        '待逐页提取技能、核心技和影画的版本化优先级。',
      ),
      reviewedPotentialGuideReferences[agentId]
        ? candidateDirection(
            'progression.potential_overlay',
            reviewedPotentialGuideReferences[agentId]!.value,
            reviewedPotentialGuideReferences[agentId]!.source,
          )
        : missing(
            'progression.potential_overlay',
            candidateSource,
            '潜能作为独立 overlay；未核验前不覆盖普通技能或影画。',
          ),
      reviewedBuild
        ? candidateDirection('build.wengines', reviewedBuild.wengines, reviewedBuild.source)
        : pageCandidate
          ? candidateDirection('build.wengines', pageCandidate.wengines, pageCandidate.source)
          : candidate && recommendation
            ? candidateDirection('build.wengines', recommendation.wEngines, buildSource)
            : missing('build.wengines', candidateSource, '缺少该角色可追溯的音擎优先级与替代。'),
      reviewedBuild
        ? candidateDirection('build.drive_disc_sets', reviewedBuild.sets, reviewedBuild.source)
        : archivedSets
          ? candidateDirection('build.drive_disc_sets', archivedSets.sets, archivedSets.source)
          : pageCandidate
            ? candidateDirection('build.drive_disc_sets', pageCandidate.sets, pageCandidate.source)
            : candidate && recommendation
              ? candidateDirection('build.drive_disc_sets', recommendation.sets, buildSource)
              : missing(
                  'build.drive_disc_sets',
                  candidateSource,
                  '缺少该角色可追溯的驱动盘套装组合。',
                ),
      reviewedBuild
        ? candidateDirection('build.main_sub_stats', reviewedBuild.stats, reviewedBuild.source)
        : pageCandidate
          ? candidateDirection('build.main_sub_stats', pageCandidate.stats, pageCandidate.source)
          : candidate && recommendation
            ? candidateDirection(
                'build.main_sub_stats',
                {
                  mainStats: recommendation.mainStats,
                  subStats: recommendation.subStats,
                },
                buildSource,
              )
            : missing(
                'build.main_sub_stats',
                candidateSource,
                '缺少该角色可追溯的主、副词条方向。',
              ),
      reviewedSkills
        ? candidateDirection('build.progression', reviewedSkills.directions, reviewedSkills.source)
        : pageCandidate
          ? candidateDirection('build.progression', pageCandidate.progression, pageCandidate.source)
          : candidate && recommendation
            ? candidateDirection(
                'build.progression',
                {
                  skillPriority: recommendation.skillPriority,
                  coreTarget: recommendation.coreTarget,
                },
                buildSource,
              )
            : missing(
                'build.progression',
                candidateSource,
                '缺少该角色可追溯的技能与核心技优先级。',
              ),
      pageCandidate
        ? candidateDirection(
            'build.team_bangboo_scenario',
            pageCandidate.team,
            pageCandidate.source,
          )
        : candidate && recommendation
          ? candidateDirection(
              'build.team_bangboo_scenario',
              {
                teammates: recommendation.teammates,
                bangboos: recommendation.bangboos,
                scenario: knowledge.scenario,
              },
              buildSource,
            )
          : missing(
              'build.team_bangboo_scenario',
              candidateSource,
              '缺少该角色可追溯的队伍、邦布与场景前提。',
            ),
      missing('build.target_panel', candidateSource, '缺少同版本、可量化毕业面板或不可量化理由。'),
      missing(
        'build.version_change_impact',
        candidateSource,
        '缺少当前版本变更对该角色构筑影响的逐字段核验。',
      ),
    ]
    const input = {
      agentId,
      agentName,
      gameVersion: '3.0' as const,
      profileVersion: '3.0.2',
      fields: fields.map((field) => applyReviewedDiscCorrections(agentId, field)),
    }
    return { ...input, contentHash: stableContentHash(input) }
  })

function hasCandidateDirection(profile: PlayerBuildProfile) {
  return [
    'build.wengines',
    'build.drive_disc_sets',
    'build.main_sub_stats',
    'build.progression',
    'build.team_bangboo_scenario',
  ].every((path) =>
    profile.fields.some((field) => field.path === path && field.status !== 'missing'),
  )
}

function hasCurrentVersionCandidateDirection(profile: PlayerBuildProfile) {
  return [
    'build.wengines',
    'build.drive_disc_sets',
    'build.main_sub_stats',
    'build.progression',
    'build.team_bangboo_scenario',
  ].every((path) => {
    const field = profile.fields.find((item) => item.path === path)
    return field?.status === 'candidate' && field.source?.sourceVersion === '3.0'
  })
}

export const playerBuildProfileCoverage = {
  total: playerBuildProfiles30.length,
  readable: playerBuildProfiles30.filter(hasCandidateDirection).length,
  currentVersionReadable: playerBuildProfiles30.filter(hasCurrentVersionCandidateDirection).length,
  candidateWarehouseConstraints: playerBuildProfiles30.filter(hasCandidateDirection).length,
  formalWarehouseSolvable: playerBuildProfiles30.filter((profile) =>
    profile.fields
      .filter((field) => field.path.startsWith('build.'))
      .every((field) => field.status === 'formal'),
  ).length,
  formalExactDamageSolvable: 0,
  verifiedCandidateFields: playerBuildProfiles30
    .flatMap((profile) => profile.fields)
    .filter((field) => field.status === 'candidate' && field.source?.verified).length,
  unfetchedSourceLocators: playerBuildProfiles30
    .flatMap((profile) => profile.fields)
    .filter((field) => field.status === 'missing' && field.source && !field.source.verified).length,
  missingByField: Object.fromEntries(
    [
      ...new Set(
        playerBuildProfiles30.flatMap((profile) => profile.fields.map((field) => field.path)),
      ),
    ].map((path) => [
      path,
      playerBuildProfiles30.filter(
        (profile) => profile.fields.find((field) => field.path === path)?.status === 'missing',
      ).length,
    ]),
  ),
}

export type PlayerBuildProfileDelta = { added: string[]; changed: string[]; deprecated: string[] }
export function diffPlayerBuildProfiles(
  previous: PlayerBuildProfile[],
  next: PlayerBuildProfile[],
): PlayerBuildProfileDelta {
  const before = new Map(previous.map((profile) => [profile.agentId, profile.contentHash]))
  const after = new Map(next.map((profile) => [profile.agentId, profile.contentHash]))
  return {
    added: [...after.keys()].filter((id) => !before.has(id)),
    changed: [...after.entries()]
      .filter(([id, hash]) => before.get(id) !== undefined && before.get(id) !== hash)
      .map(([id]) => id),
    deprecated: [...before.keys()].filter((id) => !after.has(id)),
  }
}
