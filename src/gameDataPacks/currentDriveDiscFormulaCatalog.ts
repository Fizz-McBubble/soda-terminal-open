import { z } from 'zod'
import rawCatalog from './generated/current-drive-disc-formula-catalog.v1.json'

const modifierSchema = z
  .object({
    stat: z.string().min(1),
    value: z.number(),
    actionTypes: z
      .array(z.enum(['basic', 'dash', 'aftershock']))
      .min(1)
      .optional(),
  })
  .strict()
  .superRefine((modifier, context) => {
    if (modifier.stat === 'action_dmg_' && !modifier.actionTypes)
      context.addIssue({
        code: 'custom',
        message: 'action_dmg_ two-piece modifiers require source actionTypes.',
      })
  })

const itemSchema = z.object({
  stableId: z.string().regex(/^set-/),
  gameId: z.string().regex(/^\d+$/),
  upstreamKey: z.string().min(1),
  englishName: z.string().min(1),
  twoPieceModifiers: z.array(modifierSchema).min(1),
  fourPieceFormula: z.object({
    status: z.literal('wrap_or_adapt'),
    path: z.string().min(1),
    sha256: z.string().regex(/^[A-F0-9]{64}$/),
    todoMarkers: z.array(z.string()),
  }),
})

const catalogSchema = z.object({
  schema: z.literal('soda-current-drive-disc-formula-catalog/v1'),
  gameVersion: z.literal('3.1-phase-ii'),
  generatedFrom: z.object({
    repository: z.literal('https://github.com/frzyc/genshin-optimizer'),
    commit: z.literal('eabba1f092b282cccb3f028b7253a1db3dac5208'),
    license: z.literal('MIT'),
    correction: z.object({
      pullRequest: z.literal(3273),
      head: z.literal('1e7cb3d1b7a6adebaacf62b66155ce47fcaccc33'),
      scope: z.string().min(1),
    }),
  }),
  coverage: z.object({
    entities: z.literal(30),
    twoPieceModifiers: z.literal(30),
    fourPieceFormulaSheets: z.literal(30),
    formulaTodoFiles: z.literal(1),
  }),
  items: z.array(itemSchema).length(30),
  contentHash: z.string().regex(/^[A-F0-9]{64}$/),
})

export type CurrentDriveDiscTwoPieceModifier = z.infer<typeof modifierSchema>
export type CurrentDriveDiscFormulaItem = z.infer<typeof itemSchema>

export const currentDriveDiscFormulaCatalog = catalogSchema.parse(rawCatalog)

const byStableId = new Map(
  currentDriveDiscFormulaCatalog.items.map((item) => [item.stableId, item] as const),
)

export function getCurrentDriveDiscFormulaData(stableId: string) {
  return byStableId.get(stableId) ?? null
}

/**
 * Generic, deterministic two-piece resolver for the complete 3.1 Phase II catalog.
 * It returns no effect below two equipped pieces and never evaluates four-piece triggers.
 */
export function resolveCurrentDriveDiscTwoPieceModifiers(
  stableId: string,
  equippedPieces: number,
): readonly CurrentDriveDiscTwoPieceModifier[] {
  if (equippedPieces < 2) return []
  return getCurrentDriveDiscFormulaData(stableId)?.twoPieceModifiers ?? []
}
