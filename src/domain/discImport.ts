import { z } from 'zod'
import type { DriveDisc, DriveDiscDataManifest, DriveDiscSet, StatKey } from './schemas'
import { driveDiscSchema, discSlotSchema, statKeySchema } from './schemas'

export const driveDiscImportFormat = 'soda-terminal-drive-disc-import'
export const driveDiscImportFormatVersion = 1

const raritySchema = z.enum(['A', 'S']).default('S')
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

type StandardDriveDiscImport = z.infer<typeof standardDriveDiscImportSchema>
type StandardImportDisc = StandardDriveDiscImport['discs'][number]

export type DriveDiscImportSetIdentity = Pick<
  DriveDiscSet,
  'id' | 'name' | 'englishName' | 'aliases'
> & { evidenceOnly?: boolean; effectStatus?: 'formal' | 'candidate' }

type ImportContext = {
  driveDiscSets: DriveDiscSet[]
  driveDiscSetIdentities?: DriveDiscImportSetIdentity[]
  driveDiscRules?: DriveDiscDataManifest['rules']
  gameDataVersion: string
  existingDiscs?: DriveDisc[]
  now?: string
  batchId?: string
}

export type DriveDiscImportIssue = {
  index: number
  message: string
  field?: string
}

export type DriveDiscImportItem = {
  index: number
  status: 'ready' | 'skipped' | 'failed'
  disc?: DriveDisc
  fingerprint?: string
  issues: DriveDiscImportIssue[]
}

export type DriveDiscImportPreflight = {
  format: typeof driveDiscImportFormat
  formatVersion: typeof driveDiscImportFormatVersion
  batchId: string
  sourceAdapter: string
  readyDiscs: DriveDisc[]
  items: DriveDiscImportItem[]
  summary: {
    total: number
    ready: number
    skipped: number
    failed: number
  }
}

export type DriveDiscImportAdapter = {
  id: string
  canParse(input: unknown): boolean
  normalize(input: unknown): StandardDriveDiscImport
}

const statAliases: Record<string, StatKey> = {
  hp: 'hp_flat',
  hp_flat: 'hp_flat',
  生命值: 'hp_flat',
  hp_percent: 'hp_percent',
  hp_pct: 'hp_percent',
  生命值百分比: 'hp_percent',
  atk: 'atk_flat',
  atk_flat: 'atk_flat',
  攻击力: 'atk_flat',
  atk_percent: 'atk_percent',
  atk_pct: 'atk_percent',
  攻击力百分比: 'atk_percent',
  def: 'def_flat',
  def_flat: 'def_flat',
  防御力: 'def_flat',
  def_percent: 'def_percent',
  def_pct: 'def_percent',
  防御力百分比: 'def_percent',
  crit_rate: 'crit_rate',
  crit: 'crit_rate',
  暴击率: 'crit_rate',
  crit_dmg: 'crit_dmg',
  crit_damage: 'crit_dmg',
  暴击伤害: 'crit_dmg',
  anomaly_proficiency: 'anomaly_proficiency',
  异常精通: 'anomaly_proficiency',
  pen: 'pen',
  穿透值: 'pen',
  pen_ratio: 'pen_ratio',
  穿透率: 'pen_ratio',
  impact: 'impact',
  冲击力: 'impact',
  anomaly_mastery: 'anomaly_mastery',
  异常掌控: 'anomaly_mastery',
  energy_regen: 'energy_regen',
  能量自动回复: 'energy_regen',
  physical_dmg: 'physical_dmg',
  物理属性伤害加成: 'physical_dmg',
  fire_dmg: 'fire_dmg',
  火属性伤害加成: 'fire_dmg',
  ice_dmg: 'ice_dmg',
  冰属性伤害加成: 'ice_dmg',
  electric_dmg: 'electric_dmg',
  电属性伤害加成: 'electric_dmg',
  wind_dmg: 'wind_dmg',
  风属性伤害加成: 'wind_dmg',
  ether_dmg: 'ether_dmg',
  以太属性伤害加成: 'ether_dmg',
}

function normalizeAlias(value: string) {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, '_')
}

function resolveStat(value: string) {
  const direct = statKeySchema.safeParse(value)
  if (direct.success) return direct.data
  return statAliases[normalizeAlias(value)] ?? statAliases[value.trim()]
}

function resolveSet(input: StandardImportDisc, driveDiscSets: DriveDiscImportSetIdentity[]) {
  if (input.setId) {
    const direct = driveDiscSets.find((set) => set.id === input.setId)
    if (direct) return direct
  }
  const normalizedName = normalizeAlias(input.setName ?? '')
  return driveDiscSets.find((set) =>
    [set.name, set.englishName, ...(set.aliases ?? [])].some(
      (alias) => alias && normalizeAlias(alias) === normalizedName,
    ),
  )
}

function stableHash(value: string) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

function createFingerprint(
  disc: Omit<DriveDisc, 'id' | 'createdAt' | 'updatedAt' | 'dataVersion'>,
) {
  const subStats = [...disc.subStats]
    .sort((left, right) => left.stat.localeCompare(right.stat))
    .map((item) => `${item.stat}:${item.value}:${item.upgrades}`)
    .join('|')
  return stableHash(
    [
      disc.importSource?.adapter,
      disc.importSource?.sourceId,
      disc.setId,
      disc.slot,
      disc.level,
      disc.rarity ?? 'S',
      disc.mainStat,
      subStats,
    ].join('::'),
  )
}

function createBatchId(input: StandardDriveDiscImport, now: string) {
  return (
    input.batch.id ?? `import-${stableHash(`${input.source.adapter}:${now}:${input.discs.length}`)}`
  )
}

function toDriveDisc(
  input: StandardImportDisc,
  context: Required<Pick<ImportContext, 'driveDiscSets' | 'gameDataVersion' | 'now' | 'batchId'>> &
    Pick<ImportContext, 'driveDiscRules' | 'driveDiscSetIdentities'>,
  source: StandardDriveDiscImport['source'],
  index: number,
): DriveDiscImportItem {
  const issues: DriveDiscImportIssue[] = []
  const resolvedSet = resolveSet(input, [
    ...context.driveDiscSets,
    ...(context.driveDiscSetIdentities ?? []),
  ])
  const setId = resolvedSet?.id
  if (!setId) issues.push({ index, field: 'set', message: '无法识别驱动盘套装。' })
  if (resolvedSet?.evidenceOnly) {
    issues.push({ index, field: 'set', message: '套装仅有截图证据，尚未完成公开数据核验。' })
  }
  const mainStat = resolveStat(input.mainStat)
  if (!mainStat)
    issues.push({ index, field: 'mainStat', message: `无法识别主词条：${input.mainStat}` })

  const subStats = input.subStats.flatMap((subStat, subIndex) => {
    const stat = resolveStat(subStat.stat)
    if (!stat) {
      issues.push({
        index,
        field: `subStats.${subIndex}.stat`,
        message: `无法识别副词条：${subStat.stat}`,
      })
      return []
    }
    return [{ stat, value: subStat.value, upgrades: subStat.upgrades }]
  })

  const rules = context.driveDiscRules
  if (mainStat && rules) {
    const allowed = rules.mainStatsBySlot[String(input.slot)] ?? []
    if (!allowed.includes(mainStat)) {
      issues.push({
        index,
        field: 'mainStat',
        message: `${input.slot} 号位不允许主词条 ${input.mainStat}。`,
      })
    }
  }
  if (rules) {
    const maxLevel = rules.maxLevelByRarity[input.rarity]
    if (input.level > maxLevel) {
      issues.push({ index, field: 'level', message: `${input.rarity} 级驱动盘等级超出上限。` })
    }
    const steps = new Map(
      rules.subStatStepsByRarity[input.rarity].map((rule) => [rule.stat, rule.baseValue]),
    )
    for (const [subIndex, subStat] of subStats.entries()) {
      const step = steps.get(subStat.stat)
      const expected = step === undefined ? null : step * (subStat.upgrades + 1)
      if (expected === null || Math.abs(expected - subStat.value) > 0.051) {
        issues.push({
          index,
          field: `subStats.${subIndex}.value`,
          message: `副词条 ${subStat.stat} 的数值与强化次数不匹配。`,
        })
      }
    }
    if (new Set(subStats.map((subStat) => subStat.stat)).size !== subStats.length) {
      issues.push({ index, field: 'subStats', message: '副词条存在重复字段。' })
    }
  }

  if (!setId || !mainStat || issues.length) return { index, status: 'failed', issues }

  const sourceId = input.sourceId ?? input.id
  const base = {
    setId,
    slot: input.slot,
    level: input.level,
    rarity: input.rarity,
    mainStat,
    subStats,
    locked: input.locked,
    favorite: false,
    tags: [],
    importBatchId: context.batchId,
    importSource: {
      adapter: source.adapter,
      sourceId,
      sourceFile: source.sourceFile,
      capturedAt: source.capturedAt,
      detailPanel: source.detailPanel,
    },
  } satisfies Omit<DriveDisc, 'id' | 'createdAt' | 'updatedAt' | 'dataVersion'>
  const fingerprint = createFingerprint(base)
  const parsed = driveDiscSchema.safeParse({
    ...base,
    id: `imported-disc-${fingerprint}`,
    importFingerprint: fingerprint,
    createdAt: context.now,
    updatedAt: context.now,
    dataVersion: context.gameDataVersion,
  })

  if (!parsed.success) {
    return {
      index,
      status: 'failed',
      fingerprint,
      issues: [
        {
          index,
          message: parsed.error.issues[0]?.message ?? '驱动盘数据不合法。',
        },
      ],
    }
  }

  return { index, status: 'ready', disc: parsed.data, fingerprint, issues: [] }
}

const standardAdapter: DriveDiscImportAdapter = {
  id: 'soda-terminal-standard',
  canParse(input) {
    return standardDriveDiscImportSchema.safeParse(input).success
  },
  normalize(input) {
    return standardDriveDiscImportSchema.parse(input)
  },
}

function normalizeScannerDisc(input: Record<string, unknown>) {
  const main = input.mainStat ?? input.main_stat ?? input.main
  const subStats = input.subStats ?? input.sub_stats ?? input.substats ?? []
  return {
    id: typeof input.id === 'string' ? input.id : undefined,
    setId: typeof input.setId === 'string' ? input.setId : undefined,
    setName:
      typeof input.setName === 'string'
        ? input.setName
        : typeof input.set === 'string'
          ? input.set
          : typeof input.equipmentSet === 'string'
            ? input.equipmentSet
            : undefined,
    slot: Number(input.slot ?? input.position),
    level: Number(input.level ?? input.enhancement ?? 0),
    rarity: input.rarity === 'A' ? 'A' : 'S',
    mainStat: String(main ?? ''),
    subStats: Array.isArray(subStats)
      ? subStats.map((subStat) => {
          const item = subStat as Record<string, unknown>
          return {
            stat: String(item.stat ?? item.name ?? ''),
            value: Number(item.value ?? 0),
            upgrades: Number(item.upgrades ?? item.upgrade ?? item.rolls ?? 0),
          }
        })
      : [],
    locked: Boolean(input.locked ?? input.lock),
    sourceId: typeof input.uid === 'string' ? input.uid : undefined,
  }
}

const scannerAdapter: DriveDiscImportAdapter = {
  id: 'zzz-scanner-compatible',
  canParse(input) {
    if (!input || typeof input !== 'object') return false
    return (
      Array.isArray((input as Record<string, unknown>).drive_discs) ||
      Array.isArray((input as Record<string, unknown>).discs)
    )
  },
  normalize(input) {
    const object = input as Record<string, unknown>
    const rawDiscs = (object.drive_discs ?? object.discs) as Record<string, unknown>[]
    return standardDriveDiscImportSchema.parse({
      format: driveDiscImportFormat,
      formatVersion: driveDiscImportFormatVersion,
      source: {
        adapter: scannerAdapter.id,
        sourceFile: typeof object.source === 'string' ? object.source : 'scan_data.json',
        capturedAt: typeof object.scanned_at === 'string' ? object.scanned_at : undefined,
        detailPanel:
          typeof object.resolution === 'string'
            ? { resolution: object.resolution, region: 'DETAIL' }
            : undefined,
      },
      batch: {
        id: typeof object.batch_id === 'string' ? object.batch_id : undefined,
      },
      discs: rawDiscs.map(normalizeScannerDisc),
    })
  },
}

const adapters = [standardAdapter, scannerAdapter]

function getAdapter(input: unknown) {
  return adapters.find((adapter) => adapter.canParse(input))
}

export function preflightDriveDiscImport(
  input: unknown,
  context: ImportContext,
): DriveDiscImportPreflight {
  const adapter = getAdapter(input)
  if (!adapter) {
    return {
      format: driveDiscImportFormat,
      formatVersion: driveDiscImportFormatVersion,
      batchId: context.batchId ?? 'unparsed',
      sourceAdapter: 'unknown',
      readyDiscs: [],
      items: [
        {
          index: 0,
          status: 'failed',
          issues: [{ index: 0, message: '无法识别导入文件格式。' }],
        },
      ],
      summary: { total: 0, ready: 0, skipped: 0, failed: 1 },
    }
  }

  const normalized = adapter.normalize(input)
  const now = context.now ?? new Date().toISOString()
  const batchId = context.batchId ?? createBatchId(normalized, now)
  const existingFingerprints = new Set(
    (context.existingDiscs ?? []).flatMap((disc) =>
      disc.importFingerprint ? [disc.importFingerprint] : [],
    ),
  )
  const seenFingerprints = new Set<string>()
  const items = normalized.discs.map((disc, index) => {
    const item = toDriveDisc(
      disc,
      {
        driveDiscSets: context.driveDiscSets,
        driveDiscSetIdentities: context.driveDiscSetIdentities,
        driveDiscRules: context.driveDiscRules,
        gameDataVersion: context.gameDataVersion,
        now,
        batchId,
      },
      normalized.source,
      index,
    )
    if (!item.fingerprint || item.status !== 'ready') return item
    if (existingFingerprints.has(item.fingerprint) || seenFingerprints.has(item.fingerprint)) {
      return {
        ...item,
        status: 'skipped' as const,
        disc: undefined,
        issues: [{ index, message: '检测到重复驱动盘，已跳过。' }],
      }
    }
    seenFingerprints.add(item.fingerprint)
    return item
  })
  const readyDiscs = items.flatMap((item) =>
    item.status === 'ready' && item.disc ? [item.disc] : [],
  )

  return {
    format: driveDiscImportFormat,
    formatVersion: driveDiscImportFormatVersion,
    batchId,
    sourceAdapter: normalized.source.adapter,
    readyDiscs,
    items,
    summary: {
      total: normalized.discs.length,
      ready: readyDiscs.length,
      skipped: items.filter((item) => item.status === 'skipped').length,
      failed: items.filter((item) => item.status === 'failed').length,
    },
  }
}
