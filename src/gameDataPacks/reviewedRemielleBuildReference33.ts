import { stableContentHash } from './types'

/** One observed recipe; these values are not thresholds for other equipment. */
const observation = {
  sourceId: 'gamewith-remielle-build-2026-11-01',
  url: 'https://gamewith.jp/zenless/550725',
  pageUpdatedAt: '2026-11-01 04:39',
  checkedAt: '2026-11-01',
  build: {
    signature: '空羽复归之诗',
    fourPiece: '谶羽之誓',
    twoPiece: '自由蓝调',
    slots: { 4: 'anomaly_proficiency', 5: 'atk_percent', 6: 'atk_percent' },
    mindscape: null,
    refinement: null,
  },
  observed: { atk: 3855, anomalyProficiency: 430 },
  units: { atk: 'points', anomalyProficiency: 'points' },
} as const

export const reviewedRemielleBuildReference33 = {
  observation,
  engineId: 'wengine-14158',
  primarySetId: 'set-34100',
  secondarySetId: 'set-freedom-blues',
  condition:
    '这组参考使用「空羽复归之诗」、谶羽之誓4件＋自由蓝调2件，4号位异常精通、5／6号位攻击力；其他配置按词条方向取舍。',
  source: {
    id: observation.sourceId,
    url: observation.url,
    sourceVersion: 'live guide / 2026-11-01',
    pageUpdatedAt: observation.pageUpdatedAt,
    retrievedAt: observation.checkedAt,
    checkedAt: observation.checkedAt,
    contentHash: stableContentHash(observation),
    verified: true,
    licenseBoundary:
      '仅采用同一专武配方的最小数值与条件；哈希为结构化事实标识，不冒充网页原文哈希；不复制正文或媒体。',
  },
} as const
