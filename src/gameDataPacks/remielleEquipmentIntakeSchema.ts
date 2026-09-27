import { z } from 'zod'

export const remielleEquipmentIntakeVersion = 'game-data-3.1-remielle-equipment-intake-v1' as const

const sourceSchema = z.object({
  id: z.string().min(1),
  url: z.string().url(),
  sourceType: z.enum(['official', 'community', 'structured_database']),
  sourceVersion: z.string().min(1),
  checkedAt: z.string().datetime(),
  locator: z.string().min(1),
  contentIdentityHash: z.string().min(1),
  hashKind: z.literal('minimal-derived-facts'),
  license: z.object({
    status: z.enum(['official_minimal_facts', 'unverified']),
    reuse: z.enum(['minimal_fact_only', 'reference_only']),
    boundary: z.string().min(1),
  }),
})

const continuitySchema = z.object({
  originalSourceVersion: z.string().min(1),
  lastChangeVersion: z.string().min(1),
  currentApplicability: z.enum([
    'verified_current',
    'continuous_candidate',
    'superseded',
    'missing',
  ]),
  changeEvidence: z.string().min(1),
})

const fieldSchema = z.object({
  path: z.string().min(1),
  value: z.unknown().nullable(),
  status: z.enum(['formal', 'verified_candidate', 'candidate', 'reference', 'missing']),
  sourceRefs: z.array(z.string().min(1)).min(1),
  sourceVersion: z.string().min(1),
  verifiedAt: z.string().datetime(),
  license: z.string().min(1),
  continuity: continuitySchema,
  conflict: z
    .object({
      status: z.enum(['none', 'resolved', 'unresolved']),
      refs: z.array(z.string()),
      resolution: z.string().min(1),
    })
    .nullable(),
  note: z.string().min(1),
})

const deltaSchema = z.object({
  id: z.string().min(1),
  entityId: z.string().min(1),
  operation: z.enum(['add', 'change', 'carry_forward', 'missing']),
  fieldPaths: z.array(z.string().min(1)).min(1),
  sourceRefs: z.array(z.string().min(1)).min(1),
  rollbackRef: z.string().min(1),
  affects: z.array(z.enum(['catalog', 'warehouse', 'damage'])).min(1),
  note: z.string().min(1),
})

export const remielleEquipmentIntakeSchema = z.object({
  version: z.literal(remielleEquipmentIntakeVersion),
  gameVersion: z.literal('3.1'),
  status: z.literal('candidate'),
  sources: z.array(sourceSchema).min(3),
  fields: z.array(fieldSchema).min(1),
  deltas: z.array(deltaSchema).min(1),
  conflicts: z.array(
    z.object({
      id: z.string().min(1),
      fieldPath: z.string().min(1),
      status: z.enum(['resolved', 'unresolved']),
      candidateValues: z.array(z.object({ sourceRef: z.string().min(1), value: z.unknown() })),
      resolution: z.string().min(1),
    }),
  ),
  gaps: z.array(
    z.object({
      fieldPath: z.string().min(1),
      status: z.literal('missing'),
      checkedSourceRefs: z.array(z.string().min(1)).min(1),
      nextEvidence: z.string().min(1),
    }),
  ),
  warehouseConstraintHash: z.string().min(1),
  rollback: z.object({
    previousCatalogIntake: z.literal('game-data-3.1-catalog-intake'),
    rule: z.string().min(1),
  }),
  boundary: z.string().min(1),
  contentHash: z.string().min(1),
})

export type IntakeSource = z.infer<typeof sourceSchema>
export type IntakeField = z.infer<typeof fieldSchema>
