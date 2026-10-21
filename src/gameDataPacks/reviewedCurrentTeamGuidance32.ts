import type { ReviewedTeamSourceDirection } from './reviewedTeamSourceDirections'
import { stableContentHash } from './types'
import { gameData32BuildSources } from './gameData32BuildGuidance'

const checkedAt = '2026-10-19'
const aggregateCheckedAt = '2026-10-14'
const aggregateContentHash = '17F78D6C7528258188BE5EE1197F83A72B54DFDBBB7F26330F54A306A192EFAA'

function pinnedMechanicSource(input: {
  upstreamKey: string
  formulaPath: string
  formulaSha256: string
}) {
  return {
    id: `gos-3456-${input.upstreamKey}-formula-current-32`,
    url: `https://github.com/frzyc/genshin-optimizer/blob/3456cd0f6f5bea10e168074502460dac2fcd6df4/${input.formulaPath}`,
    sourceVersion: '3.2-phase-ii',
    checkedAt,
    contentHash: input.formulaSha256,
    locator: input.formulaPath,
    verificationStatus: 'reviewed_current_mechanic_formula',
  }
}

function aggregateTrioSource(trioId: string) {
  return {
    id: `lvlurarti-shiyustats-${trioId}`,
    url: 'https://huggingface.co/datasets/LvlUrArti/ShiyuDataProcessed/tree/219a1881324ab76887e0245062f2635900a9d6d2',
    sourceVersion: '3.2.3',
    checkedAt: aggregateCheckedAt,
    contentHash: aggregateContentHash,
    locator: `reviewed-team-performance.3.2.3.json#targetTrios[id=${trioId}]`,
    verificationStatus: 'reviewed_current_aggregate_composition_32',
  }
}

function currentBuildTeamSource(key: 'koledaLiveBuild32' | 'sigridLiveBuild32', trioId: string) {
  const source = gameData32BuildSources[key]!
  return {
    id: `${source.id}:${trioId}`,
    url: source.url,
    sourceVersion: source.sourceVersion,
    checkedAt: source.checkedAt,
    contentHash: source.contentHash,
    locator: `Teams > Recommended teams > ${trioId}`,
    verificationStatus: 'reviewed_exact_team_current_32',
  }
}

/**
 * Exact 3.2 team identities admitted after local source review.
 *
 * This table only proves current source-named membership and conditions. It
 * carries no team tier, DPS, default choice, or account-fit claim.
 */
export const reviewedCurrentTeamGuidance32 = {
  gameVersion: '3.2',
  reviewedAt: '2026-10-20',
  entries: [
    {
      memberIds: ['agent-koleda', 'agent-yixuan', 'agent-lucia'],
      sourceRefs: [currentBuildTeamSource('koledaLiveBuild32', 'Rupture: Yixuan & Lucia')],
      conditions: [
        '当前攻略明确列出仪玄／珂蕾妲／卢西娅；既有独立米游社队伍记录继续保留原2.3来源身份。',
        '命破队的普通暴伤与失衡增益按实际接受者和潜能等级核对；山大王或震星分支不等于常驻增益。',
        '该三人方向不提供独立强度档位、最优音擎或完整循环结论。',
      ],
    },
    {
      memberIds: ['agent-koleda', 'agent-soldier-11', 'agent-lucy'],
      sourceRefs: [currentBuildTeamSource('koledaLiveBuild32', 'F2P Fire: Soldier 11 & Lucy')],
      conditions: [
        '当前攻略明确列出「11号」／珂蕾妲／露西，历史独立攻略仍保留原始版本。',
        '珂蕾妲负责失衡窗口，露西提供攻击方向；炉火、山大王与潜能增益须按真实等级和动作触发。',
        '不由来源中的使用率或个人评级推导三人强度；邦布需按实际额外能力选择。',
      ],
    },
    {
      memberIds: ['agent-sigrid', 'agent-norma', 'agent-astra'],
      sourceRefs: [currentBuildTeamSource('sigridLiveBuild32', 'Premium: Norma & Astra Yao')],
      conditions: [
        '当前攻略直接列出希格莉德／诺姆／耀嘉音；旧IcyVeins与Prydwen成员记录保留历史版本，不冒充重新测算。',
        '激素朋克与拂晓为不同触发方向；拂晓连段前EX须明确，不能凭成员职业自动开启四件效果。',
        '33.8%为来源暴击率参考；满核心与巡空枪势有效时的数学满暴点34%及状态条件继续沿既有规则。',
      ],
    },
    {
      memberIds: ['agent-sigrid', 'agent-dialyn', 'agent-rina'],
      sourceRefs: [currentBuildTeamSource('sigridLiveBuild32', 'Ultimate spam: Dialyn & Rina')],
      conditions: [
        '当前攻略直接列出希格莉德／琉音／丽娜，琉音的终结技转换是河豚四件来源分支的条件。',
        '丽娜的穿透收益与希格莉德影画、实际装备有关；不把角色个人评级或终结技频率描述换算成全队分数。',
        '套装触发与覆盖单独核对；完整循环和独立档位未由本条来源证明。',
      ],
    },
    {
      memberIds: ['agent-sigrid', 'agent-lycaon', 'agent-rina'],
      sourceRefs: [currentBuildTeamSource('sigridLiveBuild32', 'Standard banner: Lycaon & Rina')],
      conditions: [
        '当前攻略直接列出希格莉德／莱卡恩／丽娜，莱卡恩负责失衡与冰属性适配。',
        '未包含琉音，不沿用河豚四件的终结技转换分支；拂晓强化普攻方向仍需佩戴者EX条件。',
        '来源只支持当前可用方向，不给出与诺姆队同条件的强弱结论。',
      ],
    },
    {
      memberIds: ['agent-miyabi', 'agent-remielle', 'agent-velina'],
      sourceRefs: [
        {
          id: 'miyoushe-77017654-miyabi-remielle-velina-3.2-review',
          url: 'https://www.miyoushe.com/zzz/article/77017654',
          sourceVersion: '3.1',
          checkedAt,
          contentHash: '61077E8797FA13E43CF1BB22398D6F945B468A6057A92BD5B541A7004F302003',
          locator: 'Post 77017654, 丹雅维 section; local 3.2 source review',
        },
        {
          id: 'hoyobuild-remielle-3.2-miyabi-remielle-velina',
          url: 'https://hoyobuild.com/en/zzz/characters/remielle',
          sourceVersion: '3.2',
          checkedAt,
          contentHash: 'CF52554D18DAA9F11D8C02E311A529A7DAD76ACF68A42B9C06A82EB6B154E437',
          locator: 'Current Remielle team recommendation',
          verificationStatus: 'reviewed_exact_team_current_32',
        },
      ],
      conditions: [
        '雅按影画使用直伤或精通分支；0影可由直伤转为4自由蓝调+2法厄同之歌，2/6影保留原套装并只替换对应主词。',
        '雅、丹与维丽娜的当前三人身份可由3.2来源复核；完整动作帧、资源循环和强度档位不从成员身份外推。',
      ],
      sourceBangbooOptionIds: ['bangboo-ariel', 'bangboo-birkblick', 'bangboo-ultra-jake'],
    },
    {
      memberIds: ['agent-claret', 'agent-norma', 'agent-rina'],
      sourceRefs: [
        {
          id: 'prydwen-claret-3.2-norma-rina',
          url: 'https://www.prydwen.gg/zenless/characters/claret',
          sourceVersion: '3.2',
          checkedAt: '2026-09-30',
          contentHash: '028F278DA96D0EB8073767A8790FAF55F8D64F018B91296E3CC098876ECF069A',
          locator: 'Full Team calculations; teammate conditions',
          verificationStatus: 'reviewed_exact_team_current_32',
        },
      ],
      conditions: [
        '诺姆满足击破队友条件，丽娜满足同属性条件；音擎和驱动盘条件随精确三人引用，不从角色个人榜继承强度。',
        '作者全队计算仅作来源观察；当前仍缺独立三人档位和完整循环证据。',
      ],
    },
    {
      memberIds: ['agent-claret', 'agent-koleda', 'agent-rina'],
      sourceRefs: [
        {
          id: 'prydwen-claret-3.2-koleda-rina',
          url: 'https://www.prydwen.gg/zenless/characters/claret',
          sourceVersion: '3.2',
          checkedAt: '2026-09-30',
          contentHash: 'F40C8569D4AC9586A7AD4826ED3D64715C09FFDECA32043258C28CF4C742975C',
          locator: 'Best teammates; stun alternatives',
          verificationStatus: 'reviewed_exact_team_current_32',
        },
      ],
      conditions: [
        '珂蕾妲满足击破队友条件，丽娜满足同属性条件；珂蕾妲潜能收益必须归属其真实接受者。',
        '该精确三人只确认当前来源收录与条件，不据此输出强度档位。',
      ],
    },
    {
      memberIds: ['agent-nekomata', 'agent-dialyn', 'agent-sunna'],
      sourceRefs: [
        {
          id: 'miyoushe-76994144-nekomata-dialyn-sunna-current',
          recommendationPrerequisites: [
            { kind: 'potential_minimum', agentId: 'agent-nekomata', minimum: 1 },
          ],
          url: 'https://www.miyoushe.com/zzz/article/76994144',
          sourceVersion: '3.1',
          checkedAt,
          contentHash: '7046A061731ACD7A190999FB4EB9B8EB089C896D57275A10AE7BED6B8ED2BE29',
          locator: 'Team composition and support-specific drive-disc branch',
          verificationStatus: 'reviewed_exact_team_current_32',
        },
      ],
      conditions: [
        '千夏支援分支使用沧浪行歌4件套，2件套仍由当前来源候选和整套目标比较。',
        '保留猫又潜能至少1级的来源条件，不将个人潜能收益写成无条件三人强度。',
      ],
    },
    {
      memberIds: ['agent-nekomata', 'agent-dialyn', 'agent-astra'],
      sourceRefs: [
        {
          id: 'miyoushe-76994144-nekomata-dialyn-astra-current',
          recommendationPrerequisites: [
            { kind: 'potential_minimum', agentId: 'agent-nekomata', minimum: 1 },
          ],
          url: 'https://www.miyoushe.com/zzz/article/76994144',
          sourceVersion: '3.1',
          checkedAt,
          contentHash: '7046A061731ACD7A190999FB4EB9B8EB089C896D57275A10AE7BED6B8ED2BE29',
          locator: 'Team composition and support-specific drive-disc branch',
          verificationStatus: 'reviewed_exact_team_current_32',
        },
      ],
      conditions: [
        '耀嘉音支援分支使用啄木鸟电音4件套；与千夏分支互斥，不能复用沧浪行歌目标。',
        '保留猫又潜能至少1级的来源条件，不将个人潜能收益写成无条件三人强度。',
      ],
    },
    {
      memberIds: ['agent-dialyn', 'agent-lucia', 'agent-yixuan'],
      sourceRefs: [
        aggregateTrioSource('trio-11-dialyn-lucia-yixuan'),
        pinnedMechanicSource({
          upstreamKey: 'Dialyn',
          formulaPath: 'libs/zzz/formula/src/data/char/sheets/Dialyn.ts',
          formulaSha256: 'AA6BA963833BFFC7B82C29A6EF227209E80FCD57E7FF98F6AAD2055ACA68982C',
        }),
        pinnedMechanicSource({
          upstreamKey: 'Lucia',
          formulaPath: 'libs/zzz/formula/src/data/char/sheets/Lucia.ts',
          formulaSha256: 'BB1DEBD0A64DF8367D347CE0511907891B08A0E98FA025726C5D6D28BE94B555',
        }),
        pinnedMechanicSource({
          upstreamKey: 'Yixuan',
          formulaPath: 'libs/zzz/formula/src/data/char/sheets/Yixuan.ts',
          formulaSha256: '43F11850985726682A1076704F9B0E9ACF3172F18AE4B76DE2AF4B16E3F28E80',
        }),
      ],
      conditions: [
        '3.2.3聚合记录只证明该M0三人曾经出场；装备、流程、强度和场景条件不从出场率外推。',
        '命破语义由三名成员的当前锁定公式及既有队伍模块复核支持。',
      ],
    },
    {
      memberIds: ['agent-orphie-magus', 'agent-soldier-0-anby', 'agent-trigger'],
      sourceRefs: [
        aggregateTrioSource('trio-17-orphie-magus-soldier-0-anby-trigger'),
        pinnedMechanicSource({
          upstreamKey: 'OrphieMagus',
          formulaPath: 'libs/zzz/formula/src/data/char/sheets/OrphieMagus.ts',
          formulaSha256: 'A1F61932E1812E23C8E22490CFA3EEF69AEA01B6FD0136A54EA334FB57D0C1C0',
        }),
        pinnedMechanicSource({
          upstreamKey: 'Soldier0Anby',
          formulaPath: 'libs/zzz/formula/src/data/char/sheets/Soldier0Anby.ts',
          formulaSha256: '15E220B7933E2A50257119248DCC3F0A7F8564A708AEFB1AD826763A04979D6E',
        }),
        pinnedMechanicSource({
          upstreamKey: 'Trigger',
          formulaPath: 'libs/zzz/formula/src/data/char/sheets/Trigger.ts',
          formulaSha256: 'C24093AAEF041B0CA582F19729665387060E64C6CDDC9DAF7B338DA37075B0A6',
        }),
      ],
      conditions: [
        '3.2.3聚合记录只证明该M0三人曾经出场；装备、流程、强度和场景条件不从出场率外推。',
        '追加攻击语义由三名成员的当前锁定公式及既有队伍模块复核支持。',
      ],
    },
    {
      memberIds: ['agent-claret', 'agent-lycaon', 'agent-rina'],
      sourceRefs: [
        {
          id: 'prydwen-claret-3.2-lycaon-rina',
          recommendationPrerequisites: [
            { kind: 'potential_minimum', agentId: 'agent-lycaon', minimum: 1 },
          ],
          url: 'https://www.prydwen.gg/zenless/characters/claret',
          sourceVersion: '3.2',
          sourceUpdatedAt: '2026-09-30',
          checkedAt: '2026-10-20',
          contentHash: '7D89817F698377C78EE82FF059DF11CAD469553E755AF3CE78A877F92ACF9CF3',
          hashDefinition: 'Web text projection extraction sha256; not raw HTML',
          locator: 'Teams & Synergy > Synergy > Lycaon; rendered lines 696–697',
          verificationStatus: 'reviewed_exact_team_current_32',
        },
      ],
      conditions: [
        '来源Teams & Synergy明确列出克拉蕾／莱卡恩／丽娜三人可用方向；丽娜同阵营满足莱卡恩额外能力条件。',
        '莱卡恩潜能解锁（Potential Unlock）为搭配克拉蕾的前提，使其增益与锋御特性兼容；莱卡恩前台与后台均可积攒失衡，并可提供快速支援触发星声。',
        '该精确三人仅支持克拉蕾锋御／毁伤主输出与失衡机制，不代表三人强度档位、使用率分数或固定逐帧循环。',
      ],
    },
    {
      memberIds: ['agent-claret', 'agent-trigger', 'agent-nicole'],
      sourceRefs: [
        {
          id: 'prydwen-claret-3.2-trigger-nicole',
          recommendationPrerequisites: [
            { kind: 'wengine', agentId: 'agent-trigger', engineId: 'wengine-14136' },
          ],
          url: 'https://www.prydwen.gg/zenless/characters/claret',
          sourceVersion: '3.2',
          sourceUpdatedAt: '2026-09-30',
          checkedAt: '2026-10-20',
          contentHash: '7D89817F698377C78EE82FF059DF11CAD469553E755AF3CE78A877F92ACF9CF3',
          hashDefinition: 'Web text projection extraction sha256; not raw HTML',
          locator: 'Teams & Synergy > Synergy > Trigger & Nicole; rendered lines 698–699',
          verificationStatus: 'reviewed_exact_team_current_32',
        },
      ],
      conditions: [
        '来源Teams & Synergy明确列出克拉蕾搭配扳机与妮可组合；妮可提供兼容锋御特性的增益并可使用「聚宝箱」（The Vault，wengine-13103）等非纯攻击辅助音擎。',
        '核心协同依赖扳机装备专武提供减防（DEF Shred），且依赖站场时间与增减益覆盖管理；该前提默认不自动开启，不能由扳机改为追加攻击主输出，克拉蕾仍为主输出。',
        '该精确三人仅支持克拉蕾锋御／毁伤主输出与失衡协同，不包含三人强度分数、场景排名推断或完整逐帧循环。',
      ],
    },
  ] satisfies readonly ReviewedTeamSourceDirection[],
} as const

export const reviewedCurrentTeamGuidance32Identity = stableContentHash(
  reviewedCurrentTeamGuidance32,
)
