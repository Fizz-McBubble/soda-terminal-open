import { z } from 'zod'

export const visualAssetEntityTypeSchema = z.enum([
  'agent',
  'bangboo',
  'drive_disc_set',
  'wengine',
  'scene',
  'illustration',
])

/**
 * Shared display/download facts. Both the internal manifest entry and the generated public display
 * projection must carry these; the provenance ledger below is required only on the internal entry,
 * so shipping the projection never weakens validation of the desktop manifest.
 */
const visualAssetDisplayFields = {
  entityType: visualAssetEntityTypeSchema,
  entityId: z.string().min(1),
  name: z.string().min(1),
  variant: z.string().min(1),
  remoteUrl: z.string().url().nullable(),
  localCache: z.string().nullable().optional(),
  sourceType: z.enum(['official', 'community', 'original']),
  cachePolicy: z.enum(['explicit-personal-cache', 'remote-only', 'bundled-original']),
  contentHash: z.string().regex(/^sha256-[a-f0-9]{64}$/),
  status: z.enum(['verified', 'review', 'unavailable']),
} as const

/**
 * Runtime display shape: the public projection and personal packs may omit the provenance ledger,
 * so those fields stay optional here while the internal entry below requires them.
 */
export const visualAssetSchema = z.object({
  ...visualAssetDisplayFields,
  sourcePage: z.string().min(1).optional(),
  license: z.string().min(1).optional(),
  attribution: z.string().min(1).optional(),
  verifiedAt: z.string().datetime().optional(),
})

/** Internal/desktop manifest entry: the full source, licence, attribution and review ledger. */
export const visualAssetInternalSchema = visualAssetSchema.extend({
  sourcePage: z.string().min(1),
  license: z.string().min(1),
  attribution: z.string().min(1),
  verifiedAt: z.string().datetime(),
})

function manifestSchema<T extends z.ZodTypeAny>(asset: T) {
  return z.object({
    schemaVersion: z.literal(1),
    packVersion: z.string().min(1),
    gameVersion: z.string().min(1),
    publishedAt: z.string().datetime().optional(),
    updatedAt: z.string().datetime().optional(),
    verifiedAt: z.string().datetime().optional(),
    cacheMode: z.literal('explicit-personal-cache'),
    supportedEntityTypes: z.array(visualAssetEntityTypeSchema),
    sourcePages: z.array(z.string().min(1)).min(1).optional(),
    attribution: z.string().min(1).optional(),
    assets: z.array(asset),
    contentHash: z.string().regex(/^sha256-[a-f0-9]{64}$/),
  })
}

/** Runtime contract for whatever this build binds: the public projection or a personal pack. */
export const visualAssetManifestSchema = manifestSchema(visualAssetSchema)

/** Strict desktop/private manifest contract, enforced at the internal binding entry. */
export const visualAssetInternalManifestSchema = manifestSchema(visualAssetInternalSchema)

export type VisualAsset = z.infer<typeof visualAssetSchema>
export type VisualAssetInternalEntry = z.infer<typeof visualAssetInternalSchema>
export type VisualAssetManifest = z.infer<typeof visualAssetManifestSchema>
export type VisualAssetInternalManifest = z.infer<typeof visualAssetInternalManifestSchema>
export type VisualAssetEntityType = z.infer<typeof visualAssetEntityTypeSchema>
