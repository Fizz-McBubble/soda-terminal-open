import type { ReviewedTeamSourceDirection } from './reviewedTeamSourceDirections'
import { stableContentHash } from './types'

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

/**
 * Exact 3.2 team identities admitted after local source review.
 *
 * This table only proves current source-named membership and conditions. It
 * carries no team tier, DPS, default choice, or account-fit claim.
 */
export const reviewedCurrentTeamGuidance32 = {
  gameVersion: '3.2',
  reviewedAt: checkedAt,
  entries: [
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
  ] satisfies readonly ReviewedTeamSourceDirection[],
} as const

export const reviewedCurrentTeamGuidance32Identity = stableContentHash(
  reviewedCurrentTeamGuidance32,
)
