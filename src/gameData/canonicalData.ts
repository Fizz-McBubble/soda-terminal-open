import { z } from 'zod'
import { agentCatalog, bangbooCatalog } from '../assault/catalog'
import wEngineCatalog from '../assault/data/wEngineCatalog.3.0.json'
import driveDiscData from '../data/drive-disc-data.v1.json'
import { database, type SodaDatabase } from '../db/database'
import { contentHash } from '../evaluation/contentHash'

export const dataCoverageStatusSchema = z.enum(['formal', 'review', 'missing'])
export type DataCoverageStatus = z.infer<typeof dataCoverageStatusSchema>

export const evidenceSourceSchema = z.object({
  id: z.string().min(1),
  tier: z.enum(['official', 'structured', 'community']),
  sourceUrl: z.string().url(),
  checkedAt: z.string().datetime(),
  gameVersion: z.string().min(1),
  author: z.string().min(1).nullable(),
  popularity: z.string().min(1).nullable(),
  license: z.string().min(1).nullable(),
  scope: z.string().min(1),
  contentHash: z.string().min(1).nullable(),
})

const coverageEntrySchema = z.object({
  expected: z.number().int().nonnegative().nullable(),
  available: z.number().int().nonnegative(),
  status: dataCoverageStatusSchema,
  sourceIds: z.array(z.string().min(1)),
  missing: z.array(z.string().min(1)),
  note: z.string().min(1),
})

const canonicalDataPackCoreSchema = z.object({
  schemaVersion: z.literal(1),
  packId: z.string().min(1),
  gameVersion: z.string().min(1),
  dataVersion: z.string().min(1),
  status: dataCoverageStatusSchema,
  publishedAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  sources: z.array(evidenceSourceSchema),
  coverage: z.record(z.string(), coverageEntrySchema),
  catalogRefs: z.object({
    agents: z.string().min(1),
    bangboos: z.string().min(1),
    wEngines: z.string().min(1),
    driveDiscs: z.string().min(1),
  }),
  computeReadiness: z.object({
    currentBest: z.boolean(),
    directDamage: z.boolean(),
    anomalyAndDisorder: z.boolean(),
    deadlyAssaultScore: z.boolean(),
  }),
})

export const canonicalDataPackSchema = canonicalDataPackCoreSchema.extend({
  contentHash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
})

export type CanonicalDataPack = z.infer<typeof canonicalDataPackSchema>

const releasedAgentCount = agentCatalog.filter((item) => item[7] === 'released').length
const releasedBangbooCount = bangbooCatalog.filter((item) => item[4] === 'released').length

const canonicalDataPackCore = canonicalDataPackCoreSchema.parse({
  schemaVersion: 1,
  packId: 'zzz-canonical-game-data-3.0',
  gameVersion: '3.0',
  dataVersion: 'zzz-canonical-audit-3.0.0',
  status: 'review',
  publishedAt: '2026-06-17T00:00:00.000Z',
  updatedAt: '2026-07-06T00:00:00.000Z',
  sources: [
    {
      id: 'mihoyo-zzz-wiki-catalogs',
      tier: 'official',
      sourceUrl: 'https://baike.mihoyo.com/zzz/wiki/channel/map/2/67',
      checkedAt: '2026-07-06T00:00:00.000Z',
      gameVersion: '3.0',
      author: '米哈游',
      popularity: null,
      license: '官方版权；仅记录事实与来源，不随包分发图片',
      scope: '代理人、音擎、邦布、驱动盘与敌人目录入口',
      contentHash: null,
    },
    {
      id: 'hoyoverse-3.0-release',
      tier: 'official',
      sourceUrl: 'https://zenless.hoyoverse.com/en-us/news/164775',
      checkedAt: '2026-07-06T00:00:00.000Z',
      gameVersion: '3.0',
      author: 'HoYoverse',
      popularity: null,
      license: '官方公告',
      scope: '3.0 版本边界与新增内容',
      contentHash: null,
    },
    {
      id: 'bwiki-zzz',
      tier: 'community',
      sourceUrl: 'https://wiki.biligame.com/zzz/%E9%A6%96%E9%A1%B5',
      checkedAt: '2026-07-06T00:00:00.000Z',
      gameVersion: '3.0',
      author: '绝区零 BWIKI 贡献者',
      popularity: null,
      license: 'CC BY-NC-SA 4.0',
      scope: '官方缺失字段的结构化补充与历史版本核对',
      contentHash: null,
    },
    {
      id: 'prydwen-zzz-characters',
      tier: 'community',
      sourceUrl: 'https://www.prydwen.gg/zenless/characters',
      checkedAt: '2026-07-06T00:00:00.000Z',
      gameVersion: '3.0',
      author: 'Prydwen Institute',
      popularity: null,
      license: '来源页面版权；仅记录攻略证据',
      scope: '国际社区当前角色与构筑交叉核对',
      contentHash: null,
    },
  ],
  coverage: {
    agents: {
      expected: releasedAgentCount,
      available: releasedAgentCount,
      status: 'formal',
      sourceIds: ['mihoyo-zzz-wiki-catalogs', 'hoyoverse-3.0-release'],
      missing: [],
      note: '仅代表 3.0 已发布代理人稳定 ID、名称、特性、属性和阵营目录完整。',
    },
    agentSkillsAndMultipliers: {
      expected: releasedAgentCount,
      available: 0,
      status: 'missing',
      sourceIds: ['mihoyo-zzz-wiki-catalogs'],
      missing: ['55 名代理人的技能倍率、核心技、影画数值尚未形成版本化离线事实表'],
      note: '当前角色目录不能替代技能与倍率数据库。',
    },
    wEngines: {
      expected: wEngineCatalog.coverage.entries,
      available: wEngineCatalog.items.length,
      status: 'review',
      sourceIds: ['mihoyo-zzz-wiki-catalogs', 'bwiki-zzz'],
      missing: ['基础属性、被动数值、精炼成长和触发条件尚未全量核验'],
      note: '94 条仅完成名称、稀有度和特性目录，不可直接用于精确伤害。',
    },
    bangboos: {
      expected: releasedBangbooCount,
      available: releasedBangbooCount,
      status: 'review',
      sourceIds: ['mihoyo-zzz-wiki-catalogs'],
      missing: ['技能倍率、连携触发与星级成长未全量入包'],
      note: '40 只邦布目录完整，战斗计算字段不完整。',
    },
    driveDiscSets: {
      expected: driveDiscData.driveDiscSets.length,
      available: driveDiscData.driveDiscSets.length,
      status: 'formal',
      sourceIds: ['mihoyo-zzz-wiki-catalogs', 'bwiki-zzz'],
      missing: [],
      note: '28 套驱动盘稳定 ID、2/4 件效果与版本事实已入包。',
    },
    driveDiscStatRules: {
      expected: 1,
      available: 1,
      status: 'formal',
      sourceIds: ['mihoyo-zzz-wiki-catalogs', 'bwiki-zzz'],
      missing: [],
      note: '号位主词条、副词条单位与稀有度数值规则已版本化。',
    },
    enemies: {
      expected: null,
      available: 0,
      status: 'missing',
      sourceIds: ['mihoyo-zzz-wiki-catalogs'],
      missing: ['完整敌人目录、等级、DEF、RES、失衡和阶段参数'],
      note: '现有轮换中的 Boss 名称不能冒充完整敌人数据库。',
    },
    gameplayRules: {
      expected: null,
      available: 0,
      status: 'missing',
      sourceIds: ['hoyoverse-3.0-release'],
      missing: ['式舆、危局及其他玩法的版本化计分与目标规则'],
      note: '玩法轮换与基础游戏包继续分离。',
    },
    communityBuildEvidence: {
      expected: releasedAgentCount,
      available: 20,
      status: 'review',
      sourceIds: ['prydwen-zzz-characters', 'bwiki-zzz'],
      missing: ['其余角色的当前中文/国际多源构筑证据与冲突记录'],
      note: '用户 20 人构筑资料只是攻略覆盖，不是完整角色数据库。',
    },
  },
  catalogRefs: {
    agents: 'src/assault/catalog.ts#agentCatalog',
    bangboos: 'src/assault/catalog.ts#bangbooCatalog',
    wEngines: 'src/assault/data/wEngineCatalog.3.0.json',
    driveDiscs: 'src/data/drive-disc-data.v1.json',
  },
  computeReadiness: {
    currentBest: false,
    directDamage: false,
    anomalyAndDisorder: false,
    deadlyAssaultScore: false,
  },
})

export const builtInCanonicalDataPack: CanonicalDataPack = {
  ...canonicalDataPackCore,
  contentHash: contentHash(canonicalDataPackCore),
}

export function validateCanonicalDataPack(input: unknown) {
  const parsed = canonicalDataPackSchema.parse(input)
  const { contentHash: actualHash, ...core } = parsed
  if (contentHash(core) !== actualHash) throw new Error('游戏数据包内容哈希不匹配。')
  return parsed
}

const activeKey = 'canonical-game-data:active'
const previousKey = 'canonical-game-data:previous'

export async function installCanonicalDataPack(input: unknown, db: SodaDatabase = database) {
  const pack = validateCanonicalDataPack(input)
  await db.transaction('rw', db.settings, async () => {
    const active = await db.settings.get(activeKey)
    if (active?.value) await db.settings.put({ key: previousKey, value: active.value })
    await db.settings.put({ key: activeKey, value: pack })
  })
  return pack
}

export async function rollbackCanonicalDataPack(db: SodaDatabase = database) {
  return db.transaction('rw', db.settings, async () => {
    const previous = await db.settings.get(previousKey)
    if (!previous?.value) return false
    validateCanonicalDataPack(previous.value)
    const active = await db.settings.get(activeKey)
    await db.settings.put({ key: activeKey, value: previous.value })
    if (active?.value) await db.settings.put({ key: previousKey, value: active.value })
    return true
  })
}

export function getCanonicalCoverageMatrix(pack = builtInCanonicalDataPack) {
  return Object.entries(pack.coverage).map(([category, value]) => ({ category, ...value }))
}
