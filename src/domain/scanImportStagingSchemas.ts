import { z } from 'zod'
import { discSlotSchema, driveDiscSchema, statKeySchema } from './schemas'
export const scanImportStagingFormat = 'soda-terminal-scan-staging'

export const scanImportStagingFormatVersion = 1

export const legacyScanImportExpectedTotal = 343

export const scanImportStateSchema = z.enum(['ready', 'needs_review', 'invalid', 'imported'])

export const scanLockStateSchema = z.union([z.boolean(), z.literal('unknown')])

export const scanConfidenceSchema = z.enum(['high', 'medium', 'low'])

const scanBatchManifestBaseShape = {
  batchId: z.string().min(1),
  expectedTotal: z.number().int().positive(),
  capturedTotal: z.number().int().nonnegative(),
  uniqueItemCount: z.number().int().nonnegative(),
  gameVersion: z.string().min(1),
  scanConfigIdentity: z.string().min(1),
  viewport: z.string().min(1).nullable(),
  payloadHash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  sourceHash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  legacyAdapter: z.literal('legacy-343-v1').optional(),
}

export const scanBatchManifestV1Schema = z.object({
  schemaVersion: z.literal(1),
  ...scanBatchManifestBaseShape,
})

export const scanBatchManifestV2Schema = z.object({
  schemaVersion: z.literal(2),
  ...scanBatchManifestBaseShape,
})

export const scanBatchManifestSchema = z.discriminatedUnion('schemaVersion', [
  scanBatchManifestV1Schema,
  scanBatchManifestV2Schema,
])

const scanFieldEvidenceSchema = z.object({
  rawText: z.string(),
  normalizedValue: z.unknown().nullable(),
  confidence: scanConfidenceSchema,
  evidence: z.array(z.string()).default([]),
  rule: z.string().min(1),
  source: z.string().min(1),
})

const scanCandidateSchema = z.object({
  setId: z.string().nullable(),
  setName: z.string().nullable(),
  slot: discSlotSchema.nullable(),
  level: z.number().int().min(0).max(15).nullable(),
  rarity: z.enum(['A', 'S']).nullable(),
  mainStat: statKeySchema.nullable(),
  mainStatValue: z.number().nonnegative().nullable(),
  subStats: z.array(
    z.object({
      stat: statKeySchema.nullable(),
      value: z.number().nonnegative().nullable(),
      upgrades: z.number().int().min(0).max(5).nullable(),
      rawText: z.string(),
      confidence: scanConfidenceSchema,
    }),
  ),
})

export const scanReviewSnapshotSchema = z.object({
  candidate: scanCandidateSchema,
  lockState: scanLockStateSchema,
})

const scanUserConfirmationSchema = z.object({
  contract: z.literal('user_confirmed.v1'),
  confirmedAt: z.string().datetime(),
  source: z.enum(['user', 'legacy_migration', 'cross_batch_migration']),
  fields: z.array(z.string().min(1)),
  before: scanReviewSnapshotSchema.nullable(),
  after: scanReviewSnapshotSchema,
  migration: z
    .object({
      sourceBatchId: z.string().min(1),
      sourceItemId: z.string().min(1),
      sourceConfirmationAt: z.string().datetime(),
      matchMethod: z.string().min(1),
      matchConfidence: z.number().min(0).max(1),
      targetBefore: scanReviewSnapshotSchema.optional(),
      sourceFieldEvidence: z.record(z.string(), scanFieldEvidenceSchema).optional(),
    })
    .optional(),
})

const scanImportLifecycleEventSchema = z.object({
  action: z.enum(['imported', 'rolled_back']),
  at: z.string().datetime(),
  importedCount: z.number().int().nonnegative(),
  skippedCount: z.number().int().nonnegative().default(0),
})

const scanIssueSchema = z.object({
  field: z.string().min(1),
  code: z.string().min(1),
  message: z.string().min(1),
  severity: z.enum(['review', 'invalid']),
})

export const scanImportItemSchema = z.object({
  id: z.string().min(1),
  batchId: z.string().min(1),
  sequence: z.number().int().positive(),
  sourceIdentity: z.string().min(1),
  state: scanImportStateSchema,
  duplicate: z.boolean().default(false),
  fingerprint: z.string().min(1),
  lockState: scanLockStateSchema,
  candidate: scanCandidateSchema,
  fields: z.record(z.string(), scanFieldEvidenceSchema),
  confirmations: z.array(scanUserConfirmationSchema).default([]),
  issues: z.array(scanIssueSchema),
  evidence: z.object({
    detailPath: z.string().min(1),
    cardPath: z.string().min(1),
    visualDetailHash: z.string().min(1),
    rawText: z.record(z.string(), z.string()),
  }),
  updatedAt: z.string().datetime(),
})

export const scanImportBatchMetaSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  dataVersion: z.string().min(1),
  recognitionVersion: z.string().min(1),
  sourceReport: z.string().min(1),
  total: z.number().int().nonnegative(),
  manifest: scanBatchManifestSchema.optional(),
  importHistory: z.array(scanImportLifecycleEventSchema).default([]),
  /** Prior records absent from a replacement scan; retained for history, never live inventory. */
  replacedDiscs: z.array(driveDiscSchema).optional(),
  reviewState: z
    .object({
      revision: z.number().int().nonnegative(),
      preflight: z.enum(['stale', 'complete']),
      preflightRevision: z.number().int().nonnegative().nullable(),
      armedRevision: z.number().int().nonnegative().nullable(),
      warehouseFactHash: z.string().optional(),
    })
    .default({ revision: 0, preflight: 'stale', preflightRevision: null, armedRevision: null }),
})

export const scanImportStagingBatchSchema = z.object({
  format: z.literal(scanImportStagingFormat),
  formatVersion: z.literal(scanImportStagingFormatVersion),
  batch: scanImportBatchMetaSchema,
  items: z.array(scanImportItemSchema),
})

export type ScanImportState = z.infer<typeof scanImportStateSchema>

export type ScanBatchManifest = z.infer<typeof scanBatchManifestSchema>

export type ScanImportItem = z.infer<typeof scanImportItemSchema>

export type ScanImportBatchMeta = z.infer<typeof scanImportBatchMetaSchema>

export type ScanImportStagingBatch = z.infer<typeof scanImportStagingBatchSchema>

export type ScanImportIssue = z.infer<typeof scanIssueSchema>

export type ScanImportReviewPatch = Pick<ScanImportItem, 'candidate' | 'lockState'> & {
  /** Fields explicitly reviewed by the user; omitted only for legacy callers. */
  fields?: string[]
}

export type ScanImportBatchMatch = {
  sourceSequence: number
  targetSequence: number
  matchMethod: string
  matchConfidence: number
  ambiguousEntity: boolean
}
