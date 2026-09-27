import { stableContentHash } from '../gameDataPacks/types'
import type { TeamRatingBand } from './teamDecisionAuthority'
import { evaluateCurrent31TeamRating } from './current31TeamRating'

export const current31BlindMetaHoldoutContractId = 'soda-current-3.1-blind-meta-holdout/v1' as const

const gameVikaSnapshot = Object.freeze({
  publisher: 'GameVika',
  url: 'https://gamevika.com/en/zzz/teams',
  capturedAt: '2026-09-02T14:08:00Z',
  scrapeId: '01a0626f-1b21-74ba-9117-a418db1071d9',
  lines: Object.freeze([
    'S+|Ye Shunguang|Dialyn|Sunna',
    'S+|Miyabi|Yanagi|Astra Yao',
    'S+|Velina|Aria|Yuzuha',
    'S|Yixuan|Ju Fufu|Lucia',
    'S|Evelyn|Dialyn|Astra Yao',
    'S|Vivian|Yanagi|Astra Yao',
    'S|Alice|Yuzuha|Vivian',
    'S|Zhu Yuan|Qingyi|Astra Yao',
    'S|Hugo|Lighter|Astra Yao',
    'S|Seed|Orphie & Magus|Trigger',
    'S|Soldier 0 - Anby|Astra Yao|Trigger',
    'S|Pyrois|Dialyn|Sunna',
    'S|Velina|Promeia|Yuzuha',
    'A|Jane|Seth|Caesar',
    'S|Evelyn|Norma|Astra Yao',
    'S|Aria|Nangong Yu|Sunna',
  ]),
})

const sourceContentHash = stableContentHash({
  url: gameVikaSnapshot.url,
  lines: gameVikaSnapshot.lines,
})

type HoldoutCase = {
  caseId: string
  memberIds: readonly [string, string, string]
  publisherTier: 'S+' | 'S' | 'A'
  expectedBand: TeamRatingBand
  locator: string
}

const holdoutCases = [
  {
    caseId: 'blind-gamevika-ye-dialyn-sunna',
    memberIds: ['agent-ye-shunguang', 'agent-dialyn', 'agent-sunna'],
    publisherTier: 'S+',
    expectedBand: 'S',
    locator: 'S+|Ye Shunguang|Dialyn|Sunna',
  },
  {
    caseId: 'blind-gamevika-yixuan-ju-fufu-lucia',
    memberIds: ['agent-yixuan', 'agent-ju-fufu', 'agent-lucia'],
    publisherTier: 'S',
    expectedBand: 'A+',
    locator: 'S|Yixuan|Ju Fufu|Lucia',
  },
  {
    caseId: 'blind-gamevika-alice-vivian-yuzuha',
    memberIds: ['agent-alice', 'agent-vivian', 'agent-yuzuha'],
    publisherTier: 'S',
    expectedBand: 'A+',
    locator: 'S|Alice|Yuzuha|Vivian',
  },
  {
    caseId: 'blind-gamevika-jane-seth-caesar',
    memberIds: ['agent-jane', 'agent-seth', 'agent-caesar'],
    publisherTier: 'A',
    expectedBand: 'B',
    locator: 'A|Jane|Seth|Caesar',
  },
] as const satisfies readonly HoldoutCase[]

const unavailableBenchmark = Object.freeze({
  status: 'unavailable' as const,
  baselineId: null,
  outputIndex: null,
  unsupportedIssueIds: [] as string[],
  explanation: 'Blind Meta Holdout 只验证来源化粗档，不借用 Reference Performance。',
})

const ratingRank: Record<TeamRatingBand, number> = {
  'S+': 0,
  S: 1,
  'A+': 2,
  A: 3,
  B: 4,
  Experimental: 5,
}

const cases = holdoutCases.map((item) => {
  const result = evaluateCurrent31TeamRating({
    candidateId: item.caseId,
    memberIds: item.memberIds,
    bangbooId: null,
    outputPotentialBand: 'unknown',
    benchmark: unavailableBenchmark,
  })
  const observedBand = result.rating.status === 'rated' ? result.rating.ratingBand : null
  const productionEvidenceRefs = result.metaCalibration.evidenceRefs
  return Object.freeze({
    ...item,
    sourceUrl: gameVikaSnapshot.url,
    sourceContentHash,
    observedBand,
    aligned: observedBand === item.expectedBand,
    productionEvidenceRefs,
    labelLeak: productionEvidenceRefs.includes(gameVikaSnapshot.url),
  })
})

const pairwiseRelations = cases.flatMap((left, leftIndex) =>
  cases.slice(leftIndex + 1).flatMap((right) => {
    if (ratingRank[left.expectedBand] === ratingRank[right.expectedBand]) return []
    const expectedStronger =
      ratingRank[left.expectedBand] < ratingRank[right.expectedBand] ? left : right
    const expectedWeaker = expectedStronger === left ? right : left
    const comparable =
      expectedStronger.observedBand !== null && expectedWeaker.observedBand !== null
    const aligned =
      comparable &&
      ratingRank[expectedStronger.observedBand!] < ratingRank[expectedWeaker.observedBand!]
    return [
      Object.freeze({
        strongerCaseId: expectedStronger.caseId,
        weakerCaseId: expectedWeaker.caseId,
        aligned,
      }),
    ]
  }),
)

const alignedBandCount = cases.filter((item) => item.aligned).length
const alignedPairwiseCount = pairwiseRelations.filter((item) => item.aligned).length
const labelLeakCount = cases.filter((item) => item.labelLeak).length

export const current31BlindMetaHoldout = Object.freeze({
  contract: current31BlindMetaHoldoutContractId,
  gameVersion: '3.1',
  split: 'row_level_label_independent_holdout' as const,
  sourceSnapshot: Object.freeze({
    ...gameVikaSnapshot,
    sourceContentHash,
    rowCount: gameVikaSnapshot.lines.length,
  }),
  taxonomyCrosswalk: Object.freeze({
    'S+': 'S',
    S: 'A+',
    A: 'B',
  } as const),
  bandCoverage: Object.freeze(['S', 'A+', 'B'] as const),
  cases,
  bandCaseCount: cases.length,
  alignedBandCount,
  bandAgreement: alignedBandCount / cases.length,
  pairwiseRelations,
  pairwiseRelationCount: pairwiseRelations.length,
  alignedPairwiseCount,
  pairwiseConsistency: alignedPairwiseCount / pairwiseRelations.length,
  labelLeakCount,
  labelIndependent: labelLeakCount === 0,
  boundary:
    'Holdout 只保留冻结抓取中的四条未进入生产来源的最终 tier 行；生产预测只读取既有 Icy/Prydwen/Biligame Versioned Strength claims。GameVika 同页其他行可用于 Delta 诊断，但本四行不得回写生产校准。publisher/URL 隔离不是硬门，行级标签依赖隔离是硬门。',
})
