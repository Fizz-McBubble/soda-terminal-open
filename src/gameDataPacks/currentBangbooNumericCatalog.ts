import { z } from 'zod'
import rawCatalog from './generated/current-bangboo-numeric-catalog.v1.json'
import reviewedContinuity from './reviewedBangbooContinuity32.json'
import { stableContentHash } from './types'

const ascensionSchema = z.object({ hp: z.number(), attack: z.number(), defence: z.number() })
const propertySchema = z.object({
  key: z.string().min(1),
  main: z.number(),
  growth: z.number(),
  format: z.literal('%'),
})
const itemSchema = z.object({
  stableId: z.string().regex(/^bangboo-/),
  gameId: z.string().regex(/^\d+$/),
  playerName: z.string().min(1),
  englishName: z.string().min(1),
  codename: z.string().min(1),
  rarity: z.enum(['S', 'A']),
  stats: z.object({
    hpBase: z.number().positive(),
    hpUpgrade: z.number().positive(),
    attackBase: z.number().positive(),
    attackUpgrade: z.number().positive(),
    defenceBase: z.number().positive(),
    defenceUpgrade: z.number().positive(),
    breakStun: z.number().positive(),
    anomalyMastery: z.number().positive(),
    critRate: z.number().nonnegative(),
    critDamage: z.number().nonnegative(),
    penetrationRatio: z.number().nonnegative(),
    ascensionByLevelCap: z.object({
      '10': ascensionSchema,
      '20': ascensionSchema,
      '30': ascensionSchema,
      '40': ascensionSchema,
      '50': ascensionSchema,
      '60': ascensionSchema,
    }),
  }),
  skills: z
    .array(
      z.object({
        slot: z.enum(['a', 'b', 'c']),
        role: z.enum(['active', 'additional_ability', 'chain']),
        name: z.string().min(1),
        levelCount: z.number().int().positive(),
        levelParams: z.array(z.string()).min(1).max(10),
        paramRefs: z.array(z.string().regex(/^\d+$/)),
        semanticSha256: z.string().regex(/^[A-F0-9]{64}$/),
      }),
    )
    .min(2)
    .max(3),
  skillProps: z
    .array(
      z.object({
        skillId: z.string().regex(/^\d+$/),
        elementAccumulationValue: z.number().nonnegative(),
        properties: z.array(propertySchema),
      }),
    )
    .min(1),
  source: z.object({
    url: z.string().url(),
    sha256: z.string().regex(/^[A-F0-9]{64}$/),
    license: z.literal('unknown'),
  }),
})

const catalogSchema = z.object({
  schema: z.literal('soda-current-bangboo-numeric-catalog/v1'),
  gameVersion: z.literal('3.1-phase-ii'),
  generatedFrom: z.object({
    source: z.literal('https://static.nanoka.cc/zzz/3.1'),
    upstreamGenerator: z.string().min(1),
    boundary: z.string().min(1),
  }),
  coverage: z.object({
    entities: z.literal(41),
    statCurves: z.literal(41),
    skillSemanticRecords: z.number().int().positive(),
    skillPropertyRecords: z.number().int().positive(),
  }),
  items: z.array(itemSchema).length(41),
  contentHash: z.string().regex(/^[A-F0-9]{64}$/),
})

const historicalCatalog = catalogSchema.parse(rawCatalog)

/** Source version stays historical; current evaluation requires an exact reviewed binding. */
export function validateBangbooContinuity32(
  catalog: typeof rawCatalog,
  review: typeof reviewedContinuity,
) {
  if (
    review.sourceKind !== 'release' ||
    review.reviewedForVersion !== '3.2-phase-ii' ||
    review.pending !== 0 ||
    review.baselineCatalogContentHash !== catalog.contentHash ||
    review.releaseSource.commit !== '1277ebca4b8a7a6c3bcbaac6d5708dc9f4a55f23' ||
    !review.releaseSource.releaseLabel.includes('PRODWin3.2.0_') ||
    review.releaseSource.tableHashes.length !== 14 ||
    new Set(review.releaseSource.tableHashes.map((entry) => entry.path)).size !== 14 ||
    review.releaseSource.tableHashes.some((entry) => !/^[A-F0-9]{64}$/.test(entry.sha256)) ||
    review.rows.length !== catalog.items.length ||
    new Set(review.rows.map((row) => row.stableId)).size !== catalog.items.length
  )
    return false
  return catalog.items.every((item) => {
    const row = review.rows.find((row) => row.stableId === item.stableId)
    return (
      row?.gameId === item.gameId &&
      row.itemFingerprint === stableContentHash(item) &&
      row.historicalSource.url === item.source.url &&
      row.historicalSource.sha256 === item.source.sha256 &&
      row.targetVersion === '3.2' &&
      ['reviewed_field_continuity', 'reviewed_current_fields_with_text_change'].includes(
        row.status,
      ) &&
      row.numericFieldsVerified === 11 &&
      row.ascensionCapsVerified === 6 &&
      row.skillPropertyRecordsVerified === item.skillProps.length &&
      row.skillLevelRecordsVerified === item.skills.length
    )
  })
}

if (!validateBangbooContinuity32(historicalCatalog, reviewedContinuity))
  throw new Error('Bangboo current 3.2 source continuity binding failed.')

export const currentBangbooNumericCatalog = {
  ...historicalCatalog,
  sourceVersion: historicalCatalog.gameVersion,
  reviewedForVersion: reviewedContinuity.reviewedForVersion,
  continuityReview: reviewedContinuity,
}
const byStableId = new Map(
  currentBangbooNumericCatalog.items.map((item) => [item.stableId, item] as const),
)

export function getCurrentBangbooNumericData(stableId: string) {
  return byStableId.get(stableId) ?? null
}

export function projectCurrentBangbooStats(input: {
  stableId: string
  level: number
  ascensionLevelCap: 10 | 20 | 30 | 40 | 50 | 60
}) {
  const item = getCurrentBangbooNumericData(input.stableId)
  if (
    !item ||
    !Number.isInteger(input.level) ||
    input.level < 1 ||
    input.level > input.ascensionLevelCap
  ) {
    return { status: 'unsupported' as const }
  }
  const levelCapKey = String(input.ascensionLevelCap) as '10' | '20' | '30' | '40' | '50' | '60'
  const ascension = item.stats.ascensionByLevelCap[levelCapKey]
  return {
    status: 'supported' as const,
    hp: Math.floor(
      item.stats.hpBase + ((input.level - 1) * item.stats.hpUpgrade) / 10000 + ascension.hp,
    ),
    attack: Math.floor(
      item.stats.attackBase +
        ((input.level - 1) * item.stats.attackUpgrade) / 10000 +
        ascension.attack,
    ),
    defence: Math.floor(
      item.stats.defenceBase +
        ((input.level - 1) * item.stats.defenceUpgrade) / 10000 +
        ascension.defence,
    ),
    breakStun: item.stats.breakStun,
    anomalyMastery: item.stats.anomalyMastery,
    critRate: item.stats.critRate,
    critDamage: item.stats.critDamage,
    penetrationRatio: item.stats.penetrationRatio,
  }
}

export function resolveCurrentBangbooSkillProperty(input: {
  stableId: string
  skillId: string
  propertyKey: string
  skillLevel: number
}) {
  const item = getCurrentBangbooNumericData(input.stableId)
  const property = item?.skillProps
    .find((skill) => skill.skillId === input.skillId)
    ?.properties.find((entry) => entry.key === input.propertyKey)
  if (
    !property ||
    !Number.isInteger(input.skillLevel) ||
    input.skillLevel < 1 ||
    input.skillLevel > 10
  ) {
    return { status: 'unsupported' as const }
  }
  return {
    status: 'supported' as const,
    value: (property.main + property.growth * (input.skillLevel - 1)) / 10000,
    format: property.format,
  }
}
