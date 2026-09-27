import type { BangbooStar } from '../teamEngine/contracts'
import { getCurrentBangbooNumericData } from './currentBangbooNumericCatalog'

type BangbooNumericItem = NonNullable<ReturnType<typeof getCurrentBangbooNumericData>>

type ReviewedFactionCountFieldBinding = {
  stableId: string
  gameId: string
  skill: {
    slot: 'b'
    role: 'additional_ability'
    /** Named source property reviewed alongside the raw skill rows. */
    propertyLabel: string
    parameterIndex: number
    semanticSha256: string
    levelParams: readonly [string, string, string, string, string]
  }
  source: {
    url: string
    sha256: string
    observedAt: string
    license: 'unknown'
    distributionBoundary: string
  }
}

/**
 * Field-level source bindings for the five adopted catalog records whose additional-ability B
 * rows expose a star-scaled first parameter. These establish only the raw, named field; a local
 * faction predicate is modeled separately and only where the named faction is already mapped.
 */
export const reviewedBangbooFactionCountFieldBindings = Object.freeze([
  {
    stableId: 'bangboo-biggest-fan',
    gameId: '54010',
    skill: {
      slot: 'b',
      role: 'additional_ability',
      propertyLabel: 'Required Angels of Delusion Characters',
      parameterIndex: 0,
      semanticSha256: '7E84CCFE449245327BF1368084149A3786909A6AA0588F93E5820C476666EB51',
      levelParams: ['2|50|15%', '2|62|18.8%', '1|75|22.5%', '1|87|26%', '1|100|30%'],
    },
    source: {
      url: 'https://static.nanoka.cc/zzz/3.1/en/bangboo/54010.json',
      sha256: '139953448C5EA20693D425B310E466DACDFE9C407E91AAF9524C3B0355D2C041',
      observedAt: '2026-09-08',
      license: 'unknown',
      distributionBoundary: '只采用静态激活阈值；原始来源的再分发许可未知。',
    },
  },
  {
    stableId: 'bangboo-belion',
    gameId: '54017',
    skill: {
      slot: 'b',
      role: 'additional_ability',
      propertyLabel: 'Required Yunkui Summit Characters',
      parameterIndex: 0,
      semanticSha256: 'CB9113EFF3D1C7DB05A4297099C56FD3639AB9070850EEB04AA1DD75061F4FFD',
      levelParams: ['2|25%|4s', '2|31%|4s', '1|37%|4s', '1|43%|4s', '1|50%|4s'],
    },
    source: {
      url: 'https://static.nanoka.cc/zzz/3.1/en/bangboo/54017.json',
      sha256: '3FC8DE070EAF5562B91CC42A5580EB618911902878F062F272221863B7B8F5D7',
      observedAt: '2026-09-08',
      license: 'unknown',
      distributionBoundary: '只采用静态激活阈值；原始来源的再分发许可未知。',
    },
  },
  {
    stableId: 'bangboo-miss-esme',
    gameId: '54018',
    skill: {
      slot: 'b',
      role: 'additional_ability',
      propertyLabel: 'Required Spook Shack Characters',
      parameterIndex: 0,
      semanticSha256: 'C9D4DEABDFE36AF636DEA6D4BDFF105F14C7776DAC2B33F553A5F494DD983D9E',
      levelParams: ['2|20%|20%', '2|25%|25%', '1|30%|30%', '1|35%|35%', '1|40%|40%'],
    },
    source: {
      url: 'https://static.nanoka.cc/zzz/3.1/en/bangboo/54018.json',
      sha256: '26A83DDD487842F3956ED1D12092930B31C87FA6110468EEEA92B2F4A11ECEB3',
      observedAt: '2026-09-08',
      license: 'unknown',
      distributionBoundary: '只登记命名字段与静态阈值；尚未映射为本地阵营谓词。',
    },
  },
  {
    stableId: 'bangboo-mercury',
    gameId: '54019',
    skill: {
      slot: 'b',
      role: 'additional_ability',
      propertyLabel: 'Required Defense Force Characters',
      parameterIndex: 0,
      semanticSha256: 'DBB8277C3823992764E8CD50B49E29A18C50BEB9C266D72AAD97BEB17AEB3B7E',
      levelParams: ['2|22.5%', '2|28.1%', '1|33.7%', '1|39.3%', '1|45%'],
    },
    source: {
      url: 'https://static.nanoka.cc/zzz/3.1/en/bangboo/54019.json',
      sha256: 'F9522BAB58CBDB8B4D0631B312F4C93F161D3898B2E625689C0C39574EFA8629',
      observedAt: '2026-09-08',
      license: 'unknown',
      distributionBoundary: '只登记命名字段与静态阈值；尚未映射为本地阵营谓词。',
    },
  },
  {
    stableId: 'bangboo-birkblick',
    gameId: '54020',
    skill: {
      slot: 'b',
      role: 'additional_ability',
      propertyLabel: 'Required Krampus Characters',
      parameterIndex: 0,
      semanticSha256: '768A9785256F3796F22F09549E629A092E09423A743344927667FAC943C6F634',
      levelParams: ['2|4%', '2|5%', '1|6%', '1|7%', '1|8%'],
    },
    source: {
      url: 'https://static.nanoka.cc/zzz/3.1/en/bangboo/54020.json',
      sha256: '3438DE1094C766A036AE8F861B99A82A07FDF021D8055F6EFB8BC94BFC882929',
      observedAt: '2026-09-08',
      license: 'unknown',
      distributionBoundary: '只登记命名字段与静态阈值；尚未映射为本地阵营谓词。',
    },
  },
] as const satisfies readonly ReviewedFactionCountFieldBinding[])

export const reviewedBiggestFanFactionCountActivationSource =
  reviewedBangbooFactionCountFieldBindings[0]
export const reviewedBelionFactionCountActivationSource =
  reviewedBangbooFactionCountFieldBindings[1]

function sameLevelParams(
  actual: readonly string[],
  expected: ReviewedFactionCountFieldBinding['skill']['levelParams'],
) {
  return (
    actual.length === expected.length && actual.every((value, index) => value === expected[index])
  )
}

export function deriveReviewedFactionCountMinimumByStar(
  item: BangbooNumericItem | null,
  binding: ReviewedFactionCountFieldBinding,
): Partial<Record<BangbooStar, number>> | null {
  if (
    !item ||
    item.stableId !== binding.stableId ||
    item.gameId !== binding.gameId ||
    item.source.url !== binding.source.url ||
    item.source.sha256 !== binding.source.sha256
  )
    return null
  const skill = item.skills.find(
    (candidate) => candidate.slot === binding.skill.slot && candidate.role === binding.skill.role,
  )
  if (
    !skill ||
    skill.semanticSha256 !== binding.skill.semanticSha256 ||
    !sameLevelParams(skill.levelParams, binding.skill.levelParams)
  )
    return null
  const minimums = skill.levelParams.map((row) =>
    Number(row.split('|')[binding.skill.parameterIndex]),
  )
  if (minimums.some((value) => !Number.isInteger(value) || value < 1)) return null
  return { 1: minimums[0]!, 2: minimums[1]!, 3: minimums[2]!, 4: minimums[3]!, 5: minimums[4]! }
}

export function deriveReviewedBelionFactionCountMinimumByStar(item: BangbooNumericItem | null) {
  return deriveReviewedFactionCountMinimumByStar(item, reviewedBelionFactionCountActivationSource)
}

export function deriveReviewedBiggestFanFactionCountMinimumByStar(item: BangbooNumericItem | null) {
  return deriveReviewedFactionCountMinimumByStar(
    item,
    reviewedBiggestFanFactionCountActivationSource,
  )
}

const derivedBelionFactionCountMinimumByStar = deriveReviewedBelionFactionCountMinimumByStar(
  getCurrentBangbooNumericData('bangboo-belion'),
)
const derivedBiggestFanFactionCountMinimumByStar =
  deriveReviewedBiggestFanFactionCountMinimumByStar(
    getCurrentBangbooNumericData('bangboo-biggest-fan'),
  )

/** Null means the frozen catalog binding changed and this activation must remain unmodeled. */
export const reviewedBelionFactionCountMinimumByStar: Partial<Record<BangbooStar, number>> | null =
  derivedBelionFactionCountMinimumByStar

/** Null means the frozen catalog binding changed and this activation must remain unmodeled. */
export const reviewedBiggestFanFactionCountMinimumByStar: Partial<
  Record<BangbooStar, number>
> | null = derivedBiggestFanFactionCountMinimumByStar
