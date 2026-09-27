import { z } from 'zod'

export const gameDataPackageKinds = [
  'game-base',
  'build-knowledge',
  'rotation',
  'visual-catalog',
] as const

export const gameDataPackageStatuses = ['candidate', 'formal', 'expired', 'rolled_back'] as const

export const gameDataSourceSchema = z.object({
  label: z.string().min(1),
  url: z.string().url(),
  checkedAt: z.string().datetime(),
  sourceVersion: z.string().min(1),
  contentHash: z.string().min(1).nullable().default(null),
  verification: z.enum(['official_verified', 'official_reference', 'missing']),
})

export const gameDataCoverageSchema = z.object({
  stableId: z.string().min(1),
  displayName: z.string().min(1),
  status: z.enum(['covered', 'missing']),
  note: z.string().min(1),
  sourceUrl: z.string().url().nullable(),
  sourceVersion: z.string().min(1).nullable(),
  sourceCheckedAt: z.string().datetime().nullable().default(null),
  sourceContentHash: z.string().min(1).nullable().default(null),
  entityType: z
    .enum(['agent', 'wengine', 'bangboo', 'drive_disc_set', 'disc_stat_rule'])
    .nullable()
    .default(null),
  rarity: z.enum(['S', 'A', 'B']).nullable().default(null),
  classification: z.string().min(1).nullable().default(null),
  calculationEligibility: z.enum(['included', 'excluded', 'quality_only']).default('included'),
  releaseAt: z.string().datetime().nullable(),
  releaseSourceVersion: z.string().min(1).nullable(),
})

export const gameDataPackageManifestSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(gameDataPackageKinds),
  gameVersion: z.string().min(1),
  packageVersion: z.string().min(1),
  status: z.enum(gameDataPackageStatuses),
  publishedAt: z.string().datetime(),
  effectiveFrom: z.string().datetime().nullable(),
  effectiveTo: z.string().datetime().nullable(),
  sources: z.array(gameDataSourceSchema).min(1),
  contentHash: z.string().min(1),
  coverage: z.array(gameDataCoverageSchema),
  missing: z.array(gameDataCoverageSchema),
  changesFromPreviousFormal: z.array(z.string()),
  migrationNotes: z.array(z.string()),
  rollbackTo: z.string().nullable(),
})

export type GameDataPackageManifest = z.infer<typeof gameDataPackageManifestSchema>

export type GameDataPackState = {
  id: 'active-game-data-packs'
  activeFormalByKind: Partial<Record<GameDataPackageManifest['kind'], string>>
  expiredCalculationPackageIds: string[]
  updatedAt: string
}

export function stableContentHash(input: unknown) {
  const value = JSON.stringify(input)
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return `fnv1a-${(hash >>> 0).toString(16)}`
}

export function createManifest(
  input: Omit<GameDataPackageManifest, 'contentHash'>,
): GameDataPackageManifest {
  return gameDataPackageManifestSchema.parse({
    ...input,
    contentHash: stableContentHash({ ...input, contentHash: undefined }),
  })
}

export function validateManifest(input: unknown) {
  const parsed = gameDataPackageManifestSchema.safeParse(input)
  if (!parsed.success) return { success: false as const, error: '数据包格式或版本无效。' }
  const expected = stableContentHash({ ...parsed.data, contentHash: undefined })
  if (parsed.data.contentHash !== expected)
    return { success: false as const, error: '数据包内容校验未通过。' }
  return { success: true as const, manifest: parsed.data }
}
