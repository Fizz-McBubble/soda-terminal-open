import { z } from 'zod'
import {
  canonicalBaseline30,
  canonicalCoverageReport,
  diffCanonicalBaseline,
  type CanonicalEntity,
} from './canonicalBaseline'
import { stableContentHash } from './types'
import { currentSourceSnapshots } from './sourceIntake'

const deltaSchema = z.object({
  added: z.array(z.string()),
  changed: z.array(z.string()),
  deprecated: z.array(z.string()),
})

export const canonicalPackSchema = z.object({
  id: z.string().min(1),
  schemaVersion: z.literal(1),
  gameVersion: z.string().min(1),
  status: z.enum(['formal', 'candidate', 'current']),
  createdAt: z.string().datetime(),
  sourceSnapshotIds: z.array(z.string()).min(1),
  baselineHash: z.string().min(1),
  delta: deltaSchema,
  coverage: z.object({
    catalogComplete: z.number().int().nonnegative(),
    buildReadable: z.number().int().nonnegative(),
    warehouseSolvable: z.number().int().nonnegative(),
    exactDamageSolvable: z.number().int().nonnegative(),
    missingFields: z.number().int().nonnegative(),
  }),
  migrationNotes: z.array(z.string()),
  affectedCalculations: z.array(z.string()),
  rollbackTo: z.string().nullable(),
  contentHash: z.string().min(1),
})

export type CanonicalPack = z.infer<typeof canonicalPackSchema>

export function createCanonicalPack(input: Omit<CanonicalPack, 'contentHash'>): CanonicalPack {
  return canonicalPackSchema.parse({
    ...input,
    contentHash: stableContentHash({ ...input, contentHash: undefined }),
  })
}

export const canonicalBaselinePack30 = createCanonicalPack({
  id: 'canonical-baseline-3.0.0',
  schemaVersion: 1,
  gameVersion: '3.0',
  status: 'formal',
  createdAt: '2026-07-27T00:00:00.000Z',
  sourceSnapshotIds: currentSourceSnapshots
    .filter((snapshot) => snapshot.gameVersion === '3.0' && snapshot.status === 'formal')
    .map((snapshot) => snapshot.id),
  baselineHash: canonicalCoverageReport.contentHash,
  delta: {
    added: canonicalBaseline30.map((entity) => entity.stableId),
    changed: [],
    deprecated: [],
  },
  coverage: {
    catalogComplete: canonicalCoverageReport.catalogComplete,
    buildReadable: canonicalCoverageReport.buildReadable,
    warehouseSolvable: canonicalCoverageReport.warehouseSolvable,
    exactDamageSolvable: canonicalCoverageReport.exactDamageSolvable,
    missingFields: canonicalCoverageReport.missingFields.length,
  },
  migrationNotes: ['首个 canonical 母库基线；只登记来源与字段状态，不写入玩家资产。'],
  affectedCalculations: [],
  rollbackTo: null,
})

export function createCanonicalDeltaPack(input: {
  gameVersion: string
  createdAt: string
  previous: CanonicalPack
  previousEntities: CanonicalEntity[]
  nextEntities: CanonicalEntity[]
  sourceSnapshotIds: string[]
}): CanonicalPack {
  const delta = diffCanonicalBaseline(input.previousEntities, input.nextEntities)
  const data = {
    id: `canonical-delta-${input.gameVersion}-${stableContentHash(delta)}`,
    schemaVersion: 1 as const,
    gameVersion: input.gameVersion,
    status: 'candidate' as const,
    createdAt: input.createdAt,
    sourceSnapshotIds: input.sourceSnapshotIds,
    baselineHash: stableContentHash(input.nextEntities),
    delta,
    coverage: {
      catalogComplete: input.nextEntities.filter((entity) =>
        entity.fields.some((field) => field.path === 'identity.name' && field.status === 'formal'),
      ).length,
      buildReadable: 0,
      warehouseSolvable: 0,
      exactDamageSolvable: 0,
      missingFields: input.nextEntities.flatMap((entity) =>
        entity.fields.filter((field) => field.status === 'missing'),
      ).length,
    },
    migrationNotes: ['仅处理新增、变化和弃用字段；未变化字段继续引用上一正式基线。'],
    affectedCalculations:
      delta.changed.length || delta.added.length || delta.deprecated.length
        ? ['涉及变化字段的建议与计算结果需在正式核验后重新确认。']
        : [],
    rollbackTo: input.previous.id,
  }
  return createCanonicalPack(data)
}

export function validateCanonicalPack(input: unknown) {
  const parsed = canonicalPackSchema.safeParse(input)
  if (!parsed.success) return { success: false as const, error: 'canonical 数据包格式无效。' }
  const expected = stableContentHash({ ...parsed.data, contentHash: undefined })
  if (expected !== parsed.data.contentHash)
    return { success: false as const, error: 'canonical 数据包校验失败。' }
  return { success: true as const, pack: parsed.data }
}

/** Candidate updates never replace the installed formal baseline until every affected field is formal. */
export function canPromoteCanonicalPack(pack: CanonicalPack, entities: CanonicalEntity[]) {
  return (
    pack.status === 'candidate' &&
    entities.length > 0 &&
    entities.every((entity) => entity.fields.every((field) => field.status === 'formal'))
  )
}

/** Rollback is a manifest switch only; canonical packs contain no player-scoped records. */
export function rollbackCanonicalPack(candidate: CanonicalPack, knownPacks: CanonicalPack[]) {
  if (!candidate.rollbackTo) return null
  return knownPacks.find((pack) => pack.id === candidate.rollbackTo) ?? null
}
