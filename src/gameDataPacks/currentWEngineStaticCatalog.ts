import { z } from 'zod'
import rawCatalog from './generated/current-wengine-static-catalog.v1.json'
import reviewedWEngineData33 from './data/reviewed-wengine.3.3.json' with { type: 'json' }
import { currentGameDataSelection } from './currentGameDataSelection'
import { stableContentHash } from './types'

const baseStatSchema = z.object({
  key: z.enum(['atk', 'def']),
  value: z.number().positive(),
})

const level60BaseStatSchema = z.object({
  key: z.enum(['atk', 'def']),
  value: z.number().int().positive(),
})

const rawStaticStatsSchema = z.object({
  baseStat: baseStatSchema.optional(),
  level60BaseStat: level60BaseStatSchema.optional(),
  atkBase: z.number().positive().optional(),
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
  level60BaseAttack: z.number().int().positive().optional(),
  level60SecondaryValue: z.number().positive(),
})

const staticStatsSchema = rawStaticStatsSchema
  .transform((stats) => {
    const baseStat =
      stats.baseStat ??
      (stats.atkBase !== undefined ? { key: 'atk' as const, value: stats.atkBase } : undefined)
    const level60BaseStat =
      stats.level60BaseStat ??
      (stats.level60BaseAttack !== undefined
        ? { key: 'atk' as const, value: stats.level60BaseAttack }
        : undefined)

    if (!baseStat || !level60BaseStat) {
      throw new Error(
        'Either typed baseStat/level60BaseStat or legacy atkBase/level60BaseAttack must be provided',
      )
    }

    return {
      baseStat,
      level60BaseStat,
      secondaryStatKey: stats.secondaryStatKey,
      secondaryStatBaseValue: stats.secondaryStatBaseValue,
      level60SecondaryValue: stats.level60SecondaryValue,
      ...(baseStat.key === 'atk'
        ? {
            atkBase: stats.atkBase ?? baseStat.value,
            level60BaseAttack: stats.level60BaseAttack ?? level60BaseStat.value,
          }
        : {}),
    }
  })
  .pipe(
    z
      .object({
        baseStat: baseStatSchema,
        level60BaseStat: level60BaseStatSchema,
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
        level60SecondaryValue: z.number().positive(),
        atkBase: z.number().positive().optional(),
        level60BaseAttack: z.number().int().positive().optional(),
      })
      .superRefine((stats, ctx) => {
        if (stats.baseStat.key !== stats.level60BaseStat.key) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'baseStat.key and level60BaseStat.key must match',
          })
        }
        if (stats.baseStat.key === 'atk') {
          if (stats.atkBase !== undefined && stats.atkBase !== stats.baseStat.value) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: 'atkBase must match baseStat.value for atk records',
            })
          }
          if (
            stats.level60BaseAttack !== undefined &&
            stats.level60BaseAttack !== stats.level60BaseStat.value
          ) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: 'level60BaseAttack must match level60BaseStat.value for atk records',
            })
          }
        } else {
          if (stats.atkBase !== undefined) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: 'atkBase must not be present on non-atk records',
            })
          }
          if (stats.level60BaseAttack !== undefined) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: 'level60BaseAttack must not be present on non-atk records',
            })
          }
        }
      }),
  )

const itemSchema = z.object({
  stableId: z.string().regex(/^wengine-\d+$/),
  gameId: z.string().regex(/^\d+$/),
  playerName: z.string().min(1),
  upstreamKey: z.string().min(1),
  rarity: z.enum(['S', 'A', 'B']),
  specialty: z.enum(['damage', 'anomaly', 'defense', 'rupture', 'stun', 'support', 'armorer']),
  staticStats: staticStatsSchema,
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

const catalogSchema = z
  .object({
    schema: z.literal('soda-current-wengine-static-catalog/v1'),
    gameVersion: z.string().min(1),
    generatedFrom: z.object({
      repository: z.literal('https://github.com/frzyc/genshin-optimizer'),
      commit: z.string().regex(/^[a-f0-9]{40}$/),
      license: z.literal('MIT'),
      idMapPath: z.string().min(1),
      dataDirectory: z.string().min(1),
      formulaDirectory: z.string().min(1),
      staticFormula: z.string().min(1),
    }),
    coverage: z.object({
      entities: z.number().int().positive(),
      p1ToP5Tables: z.number().int().positive(),
      formulaWrapOrAdapt: z.number().int().nonnegative(),
      formulaStaticOnly: z.number().int().nonnegative(),
      formulaTodoFiles: z.number().int().nonnegative(),
    }),
    items: z.array(itemSchema).nonempty(),
    contentHash: z.string().regex(/^[A-F0-9]{64}$/),
  })
  .superRefine((catalog, ctx) => {
    if (catalog.coverage.entities !== catalog.items.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `coverage.entities (${catalog.coverage.entities}) must match items.length (${catalog.items.length})`,
      })
    }
    const p1ToP5 = catalog.items.filter((i) => i.passiveParameterTable.length === 5).length
    if (catalog.coverage.p1ToP5Tables !== p1ToP5) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `coverage.p1ToP5Tables (${catalog.coverage.p1ToP5Tables}) must match count of 5-phase items (${p1ToP5})`,
      })
    }
    const wrapOrAdapt = catalog.items.filter(
      (i) => i.formulaAdoption.status === 'wrap_or_adapt',
    ).length
    if (catalog.coverage.formulaWrapOrAdapt !== wrapOrAdapt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `coverage.formulaWrapOrAdapt (${catalog.coverage.formulaWrapOrAdapt}) must match actual count (${wrapOrAdapt})`,
      })
    }
    const staticOnly = catalog.items.filter(
      (i) => i.formulaAdoption.status === 'static_only',
    ).length
    if (catalog.coverage.formulaStaticOnly !== staticOnly) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `coverage.formulaStaticOnly (${catalog.coverage.formulaStaticOnly}) must match actual count (${staticOnly})`,
      })
    }
    const uniqueIds = new Set(catalog.items.map((i) => i.stableId))
    if (uniqueIds.size !== catalog.items.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Duplicate stableId found in catalog items',
      })
    }
  })

export const nanokaSourceSchema = z.object({
  provider: z.literal('nanoka'),
  url: z.string().url(),
  rawSha256: z.string().regex(/^[a-f0-9]{64}$/),
  providerManifestSha256: z.string().regex(/^[a-f0-9]{64}$/),
  locators: z.object({
    baseProperty: z.string().min(1),
    randProperty: z.string().min(1),
    talents: z.string().min(1),
  }),
})

export const nanokaItemSchema = z.object({
  stableId: z.string().regex(/^wengine-\d+$/),
  gameId: z.string().regex(/^\d+$/),
  playerName: z.string().min(1),
  nativeKey: z.string().min(1),
  rarity: z.enum(['S', 'A', 'B']),
  specialty: z.enum(['damage', 'anomaly', 'defense', 'rupture', 'stun', 'support', 'armorer']),
  releaseStatus: z.enum(['released_first_half', 'pending_event', 'pending_second_half']),
  releaseAt: z.string().min(1),
  staticStats: staticStatsSchema,
  passiveParameterTable: z
    .array(
      z.object({
        refinement: z.number().int().min(1).max(5),
        params: z.array(z.number()),
      }),
    )
    .length(5),
  source: nanokaSourceSchema,
  formulaAdoption: z.object({
    status: z.enum(['wrap_or_adapt', 'static_only']),
    todoMarkers: z.array(z.string()),
  }),
})

export type CurrentWEngineGoItem = z.infer<typeof itemSchema>
export type CurrentWEngineNanokaItem = z.infer<typeof nanokaItemSchema>

export type CurrentWEngineGoSource = CurrentWEngineGoItem['source']
export type CurrentWEngineNanokaSource = CurrentWEngineNanokaItem['source']

export type CurrentWEngineStaticCatalogItem =
  | (CurrentWEngineGoItem & {
      nativeKey?: undefined
      releaseStatus?: undefined
      releaseAt?: undefined
      source: CurrentWEngineGoSource & {
        provider?: undefined
        url?: undefined
        rawSha256?: undefined
        providerManifestSha256?: undefined
        locators?: undefined
      }
    })
  | (CurrentWEngineNanokaItem & {
      upstreamKey?: undefined
      source: CurrentWEngineNanokaSource & {
        dataPath?: undefined
        dataSha256?: undefined
        formulaPath?: undefined
        formulaSha256?: undefined
      }
    })

export const baseWEngineStaticCatalog = catalogSchema.parse(rawCatalog)

const rawFirstPlumage = reviewedWEngineData33.items.find(
  (item) => item.stableId === 'wengine-14164',
)

if (!rawFirstPlumage) {
  throw new Error('Missing reviewed W-Engine data for wengine-14164 (涅槃初翎)')
}

export const firstPlumageStaticRecord: CurrentWEngineNanokaItem =
  nanokaItemSchema.parse(rawFirstPlumage)

const byStableId32 = new Map(
  baseWEngineStaticCatalog.items.map(
    (item) => [item.stableId, item as CurrentWEngineStaticCatalogItem] as const,
  ),
)

const byStableId33 = new Map<string, CurrentWEngineStaticCatalogItem>([
  ...baseWEngineStaticCatalog.items.map(
    (item) => [item.stableId, item as CurrentWEngineStaticCatalogItem] as const,
  ),
  ['wengine-14164', firstPlumageStaticRecord as CurrentWEngineStaticCatalogItem],
])

export const currentWEngineStaticCatalog = {
  ...baseWEngineStaticCatalog,
  // generatedFrom describes only the unchanged GO subset. The composition has
  // its own identity and per-item sources; Nanoka never inherits a GO license.
  baseCatalogIdentity: baseWEngineStaticCatalog.contentHash,
  get contentHash() {
    return currentGameDataSelection.gameVersion === '3.3'
      ? stableContentHash({
          baseCatalogHash: baseWEngineStaticCatalog.contentHash,
          addedRecords: [firstPlumageStaticRecord],
        })
      : baseWEngineStaticCatalog.contentHash
  },
  get coverage(): typeof baseWEngineStaticCatalog.coverage {
    const items = this.items
    return {
      ...baseWEngineStaticCatalog.coverage,
      entities: items.length,
      p1ToP5Tables: items.filter((item) => item.passiveParameterTable.length === 5).length,
      formulaWrapOrAdapt: items.filter((item) => item.formulaAdoption.status === 'wrap_or_adapt')
        .length,
      formulaStaticOnly: items.filter((item) => item.formulaAdoption.status === 'static_only')
        .length,
    }
  },
  get gameVersion() {
    return currentGameDataSelection.gameVersion === '3.3'
      ? '3.3'
      : baseWEngineStaticCatalog.gameVersion
  },
  get items(): readonly CurrentWEngineStaticCatalogItem[] {
    return currentGameDataSelection.gameVersion === '3.3'
      ? [...baseWEngineStaticCatalog.items, firstPlumageStaticRecord]
      : baseWEngineStaticCatalog.items
  },
  get additionalSources() {
    return currentGameDataSelection.gameVersion === '3.3'
      ? [
          {
            provider: 'nanoka' as const,
            gameVersion: '3.3' as const,
            itemsCount: 1,
            manifestPin: '4d30f529d6e0568a130ebe4d79557b30d9c65d2219e77461763df1c4b42cb029',
          },
        ]
      : []
  },
}

/** Preserve provider identity when exposing evidence to consumers. */
export function currentWEngineSourceRefs(source: CurrentWEngineStaticCatalogItem['source']) {
  return source.url
    ? [`${source.url}#sha256=${source.rawSha256}`]
    : [
        `${source.dataPath}#sha256=${source.dataSha256}`,
        `${source.formulaPath}#sha256=${source.formulaSha256}`,
      ]
}

export function getCurrentWEngineStaticData(
  stableId: string,
): CurrentWEngineStaticCatalogItem | null {
  if (currentGameDataSelection.gameVersion === '3.3') {
    return byStableId33.get(stableId) ?? null
  }
  return byStableId32.get(stableId) ?? null
}
