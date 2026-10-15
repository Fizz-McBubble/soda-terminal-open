import { z } from 'zod'
import { discSlotSchema } from './schemas'

export const driveDiscImportFormat = 'soda-terminal-drive-disc-import'
export const driveDiscImportFormatVersion = 1

const raritySchema = z.enum(['B', 'A', 'S']).default('S')
const importSubStatSchema = z.object({
  stat: z.string().min(1),
  value: z.number().nonnegative(),
  upgrades: z.number().int().min(0).max(5).default(0),
})

export const standardDriveDiscImportSchema = z.object({
  format: z.literal(driveDiscImportFormat),
  formatVersion: z.number().int().positive().max(driveDiscImportFormatVersion),
  source: z
    .object({
      adapter: z.string().min(1).default('soda-terminal-standard'),
      sourceFile: z.string().min(1).optional(),
      capturedAt: z.string().datetime().optional(),
      detailPanel: z
        .object({
          resolution: z.string().min(1).optional(),
          region: z.string().min(1).optional(),
        })
        .optional(),
    })
    .default({ adapter: 'soda-terminal-standard' }),
  batch: z
    .object({
      id: z.string().min(1).optional(),
      note: z.string().max(120).optional(),
    })
    .default({}),
  discs: z
    .array(
      z.object({
        id: z.string().min(1).optional(),
        setId: z.string().min(1).optional(),
        setName: z.string().min(1).optional(),
        slot: discSlotSchema,
        level: z.number().int().min(0).max(15),
        rarity: raritySchema,
        mainStat: z.string().min(1),
        subStats: z.array(importSubStatSchema).max(4).default([]),
        locked: z.boolean().default(false),
        sourceId: z.string().min(1).optional(),
      }),
    )
    .min(1),
})

export type StandardDriveDiscImport = z.infer<typeof standardDriveDiscImportSchema>
