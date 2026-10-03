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

const catalogSchema = z
  .object({
    schema: z.literal('soda-current-drive-disc-formula-catalog/v1'),
    gameVersion: z.enum(['3.1-phase-ii', '3.2-phase-ii']),
    generatedFrom: z.object({
      repository: z.literal('https://github.com/frzyc/genshin-optimizer'),
      commit: z.string().regex(/^[a-f0-9]{40}$/),
      license: z.literal('MIT'),
      correction: z.object({
        pullRequest: z.literal(3273),
        head: z.literal('1e7cb3d1b7a6adebaacf62b66155ce47fcaccc33'),
        scope: z.string().min(1),
      }),
    }),
    coverage: z.object({
      entities: z.number().int().positive(),
      twoPieceModifiers: z.number().int().positive(),
      fourPieceFormulaSheets: z.number().int().positive(),
      formulaTodoFiles: z.number().int().nonnegative(),
    }),
    items: z.array(itemSchema).min(1),
    contentHash: z.string().regex(/^[A-F0-9]{64}$/),
  })
  .superRefine((catalog, context) => {
    const sourceCommit =
      catalog.gameVersion === '3.2-phase-ii'
        ? '3456cd0f6f5bea10e168074502460dac2fcd6df4'
        : 'eabba1f092b282cccb3f028b7253a1db3dac5208'
    if (catalog.generatedFrom.commit !== sourceCommit)
      context.addIssue({
        code: 'custom',
        message: 'Drive Disc source commit does not match its reviewed release.',
      })
    const expected = {
      entities: catalog.items.length,
      twoPieceModifiers: catalog.items.filter((item) => item.twoPieceModifiers.length > 0).length,
      fourPieceFormulaSheets: catalog.items.filter(
        (item) => item.fourPieceFormula.status === 'wrap_or_adapt',
      ).length,
      formulaTodoFiles: catalog.items.filter((item) => item.fourPieceFormula.todoMarkers.length > 0)
        .length,
    }
    for (const key of Object.keys(expected) as Array<keyof typeof expected>)
      if (catalog.coverage[key] !== expected[key])
        context.addIssue({
          code: 'custom',
          message: `Drive Disc coverage does not match records: ${key}`,
        })
    if (new Set(catalog.items.map((item) => item.stableId)).size !== catalog.items.length)
      context.addIssue({ code: 'custom', message: 'Duplicate Drive Disc stable identity.' })
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
