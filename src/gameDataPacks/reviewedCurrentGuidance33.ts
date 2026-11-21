import { driveDiscData } from '../data/gameData'
import type { StatKey } from '../domain/schemas'
import type { PlayerBuildSource } from './playerBuildSources'
import type { ReviewedMainStatAlternative } from './reviewedMainStatAlternatives'
import { currentGameDataSelection } from './currentGameDataSelection'
import { getCurrentWEngineStaticData } from './currentWEngineStaticCatalog'
import { reviewedRemielleBuildReference33 } from './reviewedRemielleBuildReference33'

/** The historical ledger is immutable; the new claim supersedes its wrong transcription. */
export const reviewedRemielleSourceCorrection33 = Object.freeze({
  id: 'miyoushe-77013702-main-stats-correction-20261030',
  agentId: 'agent-remielle',
  supersedes: '77013702:claim:004',
  invalidatedClaim: '77013702:claim:004',
  originalLedgerSha256: 'BB1F507D19FA5C13807ECC172E347BB6A4B8FD382437C5197120021FE8D93121',
  sourceLocatorSha256: 'E08724B78136B027C31C789F0EA4614845A6CAFDCFEA2FD96A6E741F486B2552',
  mainStats: { '4': 'anomaly_proficiency', '5': 'atk_percent', '6': 'atk_percent' } as const,
  condition: '3.1 原攻略的一组固定主词：4 精通、5 攻击、6 攻击；队伍与潜能适用性须另行确认。',
})

export function reviewedCurrentClaimIsAdmissible(input: {
  claimId: string
  slot: '4' | '5' | '6'
  stat: StatKey
}): boolean {
  if (input.claimId === reviewedRemielleSourceCorrection33.invalidatedClaim) return false
  if (input.claimId !== reviewedRemielleSourceCorrection33.id) return false
  return (
    reviewedRemielleSourceCorrection33.mainStats[input.slot] === input.stat &&
    (driveDiscData?.rules.mainStatsBySlot[input.slot] ?? []).includes(input.stat)
  )
}

/** Validate source-derived slot choices against the actual equipment rules. */
export function isReviewedCurrentMainStatAlternativeLegal(
  alternative: ReviewedMainStatAlternative,
) {
  const legal = driveDiscData?.rules.mainStatsBySlot[alternative.slot] ?? []
  return (
    alternative.source.id !== reviewedRemielleSourceCorrection33.invalidatedClaim &&
    alternative.stats.length > 0 &&
    alternative.stats.every((stat) => legal.includes(stat))
  )
}

export function getReviewedCurrentGuidanceSources33(agentId: string): PlayerBuildSource[] {
  if (agentId !== reviewedRemielleSourceCorrection33.agentId) return []
  const correction = reviewedRemielleSourceCorrection33
  if (
    !(['4', '5', '6'] as const).every((slot) =>
      reviewedCurrentClaimIsAdmissible({
        claimId: correction.id,
        slot,
        stat: correction.mainStats[slot],
      }),
    )
  )
    return []
  return [
    {
      id: correction.id,
      url: 'https://www.miyoushe.com/zzz/article/77013702',
      sourceVersion: '3.1',
      checkedAt: '2026-10-30',
      contentHash: correction.sourceLocatorSha256,
      verified: true,
      licenseBoundary: `原帖定位文本 SHA，非网页全文 hash；纠正并取代 ${correction.invalidatedClaim} 中四号误记。${correction.condition} 不证明 3.3 最优或账户适用。`,
    },
  ]
}

/** Sourced single-slot references do not replace the existing full-build branch. */
export function getReviewedCurrentMainStatAlternatives33(
  agentId: string,
): ReviewedMainStatAlternative[] {
  const sourceAlternatives: Record<
    string,
    { id: string; url: string; hash: string; line: string; condition: string }
  > = {
    'agent-zhu-yuan': {
      id: 'icy-zhu-yuan-slot4-atk-20261031',
      url: 'https://www.icy-veins.com/zenless-zone-zero/zhu-yuan-guide-best-builds',
      hash: 'de4fd8dea10c295325ab4db9e3219bc0d60560bb1d2bfc78e754e60cc55a33f3',
      line: 'L147',
      condition: '攻击盘是双暴之外的备选；需结合其他暴击率来源、队伍加成与整套副词条比较。',
    },
    'agent-aria': {
      id: 'icy-aria-slot4-atk-20261031',
      url: 'https://www.icy-veins.com/zenless-zone-zero/aria-guide-best-builds',
      hash: '592e1ce5077cfb37954117be84ceb78e92173fb2727128661b4c50f8ecbf8e20',
      line: 'L161',
      condition: '4号可比较精通与攻击；按异常支援或自身输出目标、队伍和整套副词条取舍。',
    },
    'agent-pyrois': {
      id: 'icy-pyrois-slot4-atk-20261031',
      url: 'https://www.icy-veins.com/zenless-zone-zero/pyrois-guide-best-builds',
      hash: '065990e897f4468e6da87ed0a8b1dd51f11c367b43cf3e2197e6b201271837b9',
      line: 'L126',
      condition: '攻击盘是双暴之外的备选；按音擎和终结技循环比较，先保证暴击需求。',
    },
    'agent-evelyn': {
      id: 'prydwen-evelyn-slot4-atk-20261031',
      url: 'https://www.prydwen.gg/zenless/characters/evelyn',
      hash: 'c4f486f74a88a2cca451ed7f756165ea1105c4a900f35dedc07372a8851897b2',
      line: 'L674',
      condition: '攻击盘是双暴之外的备选；在相同音擎、队伍和实际暴击面板下比较。',
    },
  }
  const sourceAlternative = sourceAlternatives[agentId]
  if (sourceAlternative)
    return [
      {
        slot: '4',
        stats: ['atk_percent'],
        purpose: 'secondary',
        automaticEligibility: false,
        condition: sourceAlternative.condition,
        source: {
          id: sourceAlternative.id,
          url: sourceAlternative.url,
          sourceVersion: null,
          checkedAt: '2026-10-31',
          contentHash: sourceAlternative.hash,
          verified: true,
          licenseBoundary: `精确 URL 本页 ${sourceAlternative.line} 主词摘录；hash 为归档摘录文件，非网页全文。原作者构筑版未确认，不声明当前最优或自动配装。`,
        },
      },
    ]
  if (agentId === 'agent-qingyi')
    return [
      {
        slot: '4',
        stats: ['atk_percent'],
        purpose: 'personal_damage',
        automaticEligibility: false,
        condition:
          '兼顾自身输出时可比较攻击盘，先保证冲击与队伍需求；山大王四件的额外暴伤仍要求50%暴击率。',
        source: {
          id: 'icy-qingyi-slot4-atk-reference-20261031',
          url: 'https://www.icy-veins.com/zenless-zone-zero/qingyi-guide-best-builds',
          sourceVersion: null,
          checkedAt: '2026-10-31',
          contentHash: 'F660F801E2EA27ECBB2F2DA398628AF6C209C6F93D3D73C4C9937B57AC158C9E',
          verified: true,
          licenseBoundary:
            '同角色 URL 标题隔离摘录 L142–148、L184、L203–205；hash 为摘录文件而非网页全文。来源版本和冲击门槛面板口径未确认，不声明当前最优或自动配装。',
        },
      },
    ]
  if (agentId === 'agent-remielle') {
    const reference = reviewedRemielleBuildReference33
    return [
      {
        slot: '4',
        stats: [reference.observation.build.slots[4]],
        purpose: 'anomaly_support',
        automaticEligibility: false,
        condition: reference.condition,
        source: reference.source,
      },
    ]
  }
  if (agentId === 'agent-burnice')
    return [
      {
        slot: '6',
        stats: ['energy_regen'],
        purpose: 'anomaly_support',
        automaticEligibility: false,
        condition:
          '强化特殊技循环缺回能时可比较回能盘；结合实际潜能效果取舍，异常积蓄需求较高时保留掌控盘。',
        source: {
          id: 'icy-burnice-slot6-reference-20261030',
          url: 'https://www.icy-veins.com/zenless-zone-zero/burnice-white-guide-best-builds',
          sourceVersion: null,
          checkedAt: '2026-10-30',
          contentHash: '11e3e3533f2e3349f37199df25fa91e9a608184e64c6e7450b688e7c12555e0e',
          verified: true,
          licenseBoundary:
            '同角色 URL 标题隔离的 icy-details-02 摘录 L148；hash 为摘录文件而非网页全文。作者潜能前提未在摘录中确认，不作为当前最优或自动配装资格。',
        },
      },
    ]
  if (agentId === 'agent-roxy')
    return [
      {
        slot: '5',
        stats: ['atk_percent', 'wind_dmg'],
        purpose: 'secondary',
        automaticEligibility: false,
        condition: '攻击、风伤与穿透率在相同队伍、音擎和目标面板下比较。',
        source: {
          id: 'icy-roxy-slot5-reference-20261030',
          url: 'https://www.icy-veins.com/zenless-zone-zero/roxy-guide-best-builds',
          sourceVersion: null,
          checkedAt: '2026-10-30',
          contentHash: '6df5c5803626c242c3fd25dde7d36b8f1c777666addb1b821bd830f0445ea95d',
          verified: true,
          licenseBoundary:
            '同角色 URL 标题隔离的 icy-details-08 摘录 L138；hash 为摘录文件而非网页全文。原文未明确 3.3 作者复核版，不作为当前最优或自动配装资格。',
        },
      },
    ]
  return []
}

export type ReviewedCurrentIndependentDirection33 = {
  id: string
  agentId: string
  slot: '4' | '5' | '6'
  stats: readonly StatKey[]
  condition: string
  source: PlayerBuildSource
  requiresExplicitSelection: true
}

const independentDirectionAgents = new Set([
  'agent-qingyi',
  'agent-zhu-yuan',
  'agent-aria',
  'agent-pyrois',
  'agent-evelyn',
])

export const reviewedPhoenixTeam33 = Object.freeze({
  id: 'phoenix-velina-remielle-source-reference-20261031',
  memberIds: ['agent-phoenix', 'agent-velina', 'agent-remielle'] as const,
  members: '菲欧妮 · 维琳娜 · 蕾米埃尔·丹',
  condition:
    '三名异常代理人的作者队伍参考；灼蚀、风化及耀变须按实际战斗触发，邦布与影画由玩家选择。',
  sources: [
    {
      id: 'icy-phoenix-team-20261031',
      url: 'https://www.icy-veins.com/zenless-zone-zero/phoenix-teams',
      sourceVersion: null,
      checkedAt: '2026-10-31',
      contentHash: 'F6A75CE8FBB9E8E6FC07A6A3C3E1E6EAEF6838DBD5C5332D0048316BF8A14627',
      verified: true,
      licenseBoundary:
        'Lily 页面具名三人及队友协同；hash 是网页工具归档摘录文件，不是完整 HTTP 响应。源页更新日不冒充游戏版本或排名依据。',
    },
    {
      id: 'prydwen-phoenix-synergy-3.3-20261031',
      url: 'https://www.prydwen.gg/zenless/characters/phoenix',
      sourceVersion: '3.3',
      checkedAt: '2026-10-31',
      contentHash: '454DB9F0F8CD1D0D9803AC3EECFD6EA06C623CDFD406E82B1125E86868490499',
      verified: true,
      licenseBoundary:
        '3.3 构筑页 L650–652 分别说明维琳娜及蕾米埃尔协同；hash 是归档摘录文件，不是完整 HTTP 响应。',
    },
  ] satisfies PlayerBuildSource[],
})

export function getReviewedPhoenixTeam33(agentId: string) {
  return reviewedPhoenixTeam33.memberIds.includes(
    agentId as (typeof reviewedPhoenixTeam33.memberIds)[number],
  )
    ? reviewedPhoenixTeam33
    : undefined
}

/** Current candidate ordering is separate from equipped/account equipment facts. */
export function getReviewedCurrentWEngineRecommendation33(agentId: string) {
  if (currentGameDataSelection.gameVersion !== '3.3') return undefined
  const rows = {
    'agent-soldier-11': {
      engineId: 'wengine-14132',
      previousEngineId: 'wengine-14104',
      sourceVersion: '2.5',
      url: 'https://www.prydwen.gg/zenless/characters/soldier-11',
      sha: '3dc2773543f501cc57cdcc22f1436feecf022bf9fca022564ac6133d54c189e8',
      locator: 'L463–467、L515–517',
      icyUrl: 'https://www.icy-veins.com/zenless-zone-zero/soldier-11-guide-best-builds',
      icySha: 'e9ed6a6b1b606f25bd390007f10e343e79999b05f08468c45d75b5622c394b19',
      icyLocator: 'L93–94',
      note: '心弦夜响S1：双暴属性常驻；火抗忽视仅对连携与终结技，层数须按实际触发。硫磺石保留为可用替代。',
    },
    'agent-piper': {
      engineId: 'wengine-14140',
      previousEngineId: 'wengine-13128',
      sourceVersion: '2.4',
      url: 'https://www.prydwen.gg/zenless/characters/piper',
      sha: 'c52f45fafe5d386d0dcdea4cd9029be885a2e079bd2f2179080001d8f2338190',
      locator: 'L408–411、L453–455',
      icyUrl: 'https://www.icy-veins.com/zenless-zone-zero/piper-wheel-guide-best-builds',
      icySha: '1897a3d06d556d8e8e3935e7ca68edb3758282d87bcf3c09eae63fb43e206b9c',
      icyLocator: 'L94–95',
      note: '十方锻星S1：60点异常掌控；物伤加成进入接战即有两层、可由强击刷新。轰鸣座驾A5保留为易得替代。',
    },
    'agent-anton': {
      engineId: 'wengine-14132',
      previousEngineId: 'wengine-13111',
      sourceVersion: '1.5',
      url: 'https://www.prydwen.gg/zenless/characters/anton',
      sha: '079129f3dd4f48bebbd3730e09153bc9f6eb549c1e5c730200a94ca7e61e578a',
      locator: 'L368–372、L431–433',
      icyUrl: 'https://www.icy-veins.com/zenless-zone-zero/anton-ivanov-guide-best-builds',
      icySha: '3b62261fce66ed422d4ef874cfb80a9d51db228deaf2a97d0499a9e3e3af7afc',
      icyLocator: 'L93–94',
      note: '心弦夜响S1主要提供双暴；火抗忽视只作用于火伤，不能用于安东的电伤。旋钻机-赤轴A5保留为易得替代。',
    },
  } as const
  const row = rows[agentId as keyof typeof rows]
  if (!row) return undefined
  const engine = getCurrentWEngineStaticData(row.engineId)
  const expectedSha =
    row.engineId === 'wengine-14132'
      ? 'A6376B23873E1606FCDB91E82827D06D0A42960954902B1F204D4C99D351DD7F'
      : '16E11F7DBE66C6188CC7FF04D375719CEC16C8331A009CFD7E94CB8676917CA4'
  const frozenHash = engine?.source.dataSha256
  const frozenPath = engine?.source.dataPath
  if (
    !engine ||
    engine.source.url ||
    typeof frozenHash !== 'string' ||
    typeof frozenPath !== 'string' ||
    !frozenPath ||
    frozenHash.toUpperCase() !== expectedSha
  )
    return undefined
  const sources: PlayerBuildSource[] = [
    {
      id: `prydwen-${agentId}-wengine-20261031`,
      url: row.url,
      sourceVersion: row.sourceVersion,
      checkedAt: '2026-10-31',
      contentHash: row.sha,
      verified: true,
      licenseBoundary: `原页 ${row.locator} 的 S1 与原候选对照；hash 为多页工具摘录文件，不是网页全文。原构筑版本保留。`,
    },
    {
      id: `icy-${agentId}-wengine-20261031`,
      url: row.icyUrl,
      sourceVersion: null,
      checkedAt: '2026-10-31',
      contentHash: row.icySha,
      verified: true,
      licenseBoundary: `各自作者页音擎区 ${row.icyLocator}；hash 为多页工具摘录文件，不是网页全文。未从网页更新日期推断游戏版本。`,
    },
    {
      id: `go-${row.engineId}-static-mechanic`,
      url: `https://github.com/frzyc/genshin-optimizer/blob/3456cd0f6f5bea10e168074502460dac2fcd6df4/${frozenPath}`,
      sourceVersion: '3.2-phase-ii',
      checkedAt: '2026-10-31',
      contentHash: frozenHash,
      verified: true,
      licenseBoundary:
        '锁定静态数值来源；效果条件另对照本地3.1中文原件，不代表精确伤害或账号拥有。',
    },
  ]
  return {
    id: `reviewed-${agentId}-wengine-20261031`,
    engineId: row.engineId,
    previousEngineId: row.previousEngineId,
    refinement: 1 as const,
    note: row.note,
    sources,
  }
}

/** A named single-slot intent. It does not claim a complete team build or ranking. */
export function getReviewedCurrentIndependentDirections33(
  agentId: string,
): ReviewedCurrentIndependentDirection33[] {
  if (!independentDirectionAgents.has(agentId)) return []
  return getReviewedCurrentMainStatAlternatives33(agentId).map((alternative) => {
    if (!isReviewedCurrentMainStatAlternativeLegal(alternative))
      throw new Error(`当前来源的 ${agentId} 主词与盘位不匹配。`)
    return {
      id: alternative.source.id,
      agentId,
      slot: alternative.slot,
      stats: alternative.stats,
      condition: alternative.condition,
      source: alternative.source,
      requiresExplicitSelection: true,
    }
  })
}

/** Callers must independently establish the named condition, not promote unknown to met. */
export function resolveReviewedCurrentIndependentDirection33(
  agentId: string,
  input: { directionId: string; conditionState: 'met' | 'not_met' | 'unknown' },
): ReviewedCurrentIndependentDirection33 | undefined {
  if (input.conditionState !== 'met') return undefined
  return getReviewedCurrentIndependentDirections33(agentId).find(
    (direction) => direction.id === input.directionId,
  )
}
