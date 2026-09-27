import { correctReviewedAdditionalDiscField } from './reviewedAdditionalDiscDirections'
import { correctReviewedMainStatField } from './reviewedMainStatAdditions'
import type { PlayerBuildField, PlayerBuildSource } from './playerBuildSources'
import { stableContentHash } from './types'

const sources: Record<string, PlayerBuildSource> = {
  'agent-ellen': {
    id: 'prydwen-ellen-20260914-main-stats',
    url: 'https://www.prydwen.gg/zenless/characters/ellen',
    sourceVersion: '2.5',
    checkedAt: '2026-09-14T00:00:00.000Z',
    verified: true,
    contentHash: stableContentHash({
      slot: 5,
      options: ['ice_dmg', 'pen_ratio', 'atk_percent'],
      checkedAt: '2026-09-14',
    }),
    licenseBoundary: '复核作者主词条范围；穿透收益随队伍变化，不表示固定优先于冰伤。',
  },
  'agent-ye-shunguang': {
    id: 'miyoushe-76034445-disc-main-stats',
    url: 'https://www.miyoushe.com/zzz/article/76034445',
    sourceVersion: '3.0',
    checkedAt: '2026-09-14T00:00:00.000Z',
    contentHash: '146bb958dc340000213c6480ee0ac8633b6cf67edba03961ab026f70d7a0cdf5',
    verified: true,
    licenseBoundary: '已归档攻略配装图，仅采用主词条方向，不扩展为精确伤害结论。',
  },
  'agent-nangong': {
    id: 'miyoushe-74153268-disc-baseline',
    url: 'https://www.miyoushe.com/zzz/article/74153268',
    sourceVersion: '2.7',
    checkedAt: '2026-09-14T00:00:00.000Z',
    contentHash: '54b0e68e6c476c42ef5922f56f14d1aad8084a8a826c47019c0e91f216e127ba',
    verified: true,
    licenseBoundary: '复用归档原文的法厄同四件与精通两件方向；适合爱芮队伍不是装备硬性限制。',
  },
}

/** Field-local corrections must not relabel unrelated weapon or skill evidence. */
export function correctReviewedDiscField(
  agentId: string,
  field: PlayerBuildField,
): PlayerBuildField {
  const source = sources[agentId]
  if (!source) return field
  if (agentId === 'agent-nangong' && field.path === 'build.drive_disc_sets') {
    return {
      ...field,
      status: 'candidate',
      source,
      value: ['法厄同之歌 4 件 + 自由蓝调 / 混沌爵士 2 件'],
      reason: '采用已归档的完整4+2方向；组队时再按异常与支援成员调整。',
    }
  }
  if (
    (agentId === 'agent-ye-shunguang' || agentId === 'agent-ellen') &&
    field.path === 'build.main_sub_stats'
  ) {
    const value = field.value as { mainStats: Record<string, string[]>; subStats: unknown }
    return {
      ...field,
      source,
      value: {
        ...value,
        mainStats: {
          ...value.mainStats,
          '5': [agentId === 'agent-ellen' ? 'ice_dmg' : 'physical_dmg', 'pen_ratio', 'atk_percent'],
        },
      },
      reason: '补齐已核对的五号位可选范围，具体收益仍取决于队伍与副词条。',
    }
  }
  return field
}

export function applyReviewedDiscCorrections(
  agentId: string,
  field: PlayerBuildField,
): PlayerBuildField {
  return correctReviewedMainStatField(
    agentId,
    correctReviewedAdditionalDiscField(agentId, correctReviewedDiscField(agentId, field)),
  )
}
