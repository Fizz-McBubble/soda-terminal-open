import { z } from 'zod'
import rawCatalog from './generated/current-wengine-static-catalog.v1.json'

const itemSchema = z.object({
  stableId: z.string().regex(/^wengine-\d+$/),
  gameId: z.string().regex(/^\d+$/),
  playerName: z.string().min(1),
  upstreamKey: z.string().min(1),
  rarity: z.enum(['S', 'A', 'B']),
  specialty: z.enum(['damage', 'anomaly', 'defense', 'rupture', 'stun', 'support']),
  staticStats: z.object({
    atkBase: z.number().positive(),
    secondaryStatKey: z.enum([
      'hp_',
      'atk_',
      'pen_',
      'def_',
      'crit_',
      'crit_dmg_',
      'anomProf',
      'impact_',
      'enerRegen_',
      'anomMas_',
    ]),
    secondaryStatBaseValue: z.number().positive(),
    level60BaseAttack: z.number().int().positive(),
    level60SecondaryValue: z.number().positive(),
  }),
  passiveParameterTable: z
    .array(
      z.object({
        refinement: z.number().int().min(1).max(5),
        params: z.array(z.number()),
      }),
    )
    .length(5),
  source: z.object({
    dataPath: z.string().min(1),
    dataSha256: z.string().regex(/^[A-F0-9]{64}$/),
    formulaPath: z.string().min(1),
    formulaSha256: z.string().regex(/^[A-F0-9]{64}$/),
  }),
  formulaAdoption: z.object({
    status: z.enum(['wrap_or_adapt', 'static_only']),
    todoMarkers: z.array(z.string()),
  }),
})

const catalogSchema = z.object({
  schema: z.literal('soda-current-wengine-static-catalog/v1'),
  gameVersion: z.literal('3.1-phase-ii'),
  generatedFrom: z.object({
    repository: z.literal('https://github.com/frzyc/genshin-optimizer'),
    commit: z.literal('eabba1f092b282cccb3f028b7253a1db3dac5208'),
    license: z.literal('MIT'),
    idMapPath: z.string().min(1),
    dataDirectory: z.string().min(1),
    formulaDirectory: z.string().min(1),
    staticFormula: z.string().min(1),
  }),
  coverage: z.object({
    entities: z.literal(95),
    p1ToP5Tables: z.literal(95),
    formulaWrapOrAdapt: z.number().int().nonnegative(),
    formulaStaticOnly: z.number().int().nonnegative(),
    formulaTodoFiles: z.number().int().nonnegative(),
  }),
  items: z.array(itemSchema).length(95),
  contentHash: z.string().regex(/^[A-F0-9]{64}$/),
})

export type CurrentWEngineStaticCatalogItem = z.infer<typeof itemSchema>

export const currentWEngineStaticCatalog = catalogSchema.parse(rawCatalog)

const byStableId = new Map(
  currentWEngineStaticCatalog.items.map((item) => [item.stableId, item] as const),
)

export function getCurrentWEngineStaticData(stableId: string) {
  return byStableId.get(stableId) ?? null
}
