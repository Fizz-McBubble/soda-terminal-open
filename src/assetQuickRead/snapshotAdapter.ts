import { z } from 'zod'
import type { ObservedAgentField, RosterAgent } from '../assault/types'
import { standardDriveDiscImportSchema } from '../domain/discImport'
import type { StatKey } from '../domain/schemas'
import { publicScannerDriveDiscData } from '../application/publicScannerCatalog'
import identities from './catalogIdentityProjection.json'

export type StandardAssetDiscImport = z.infer<typeof standardDriveDiscImportSchema>
export type AssetQuickReadIssue = {
  code: string
  message: string
  kind?: 'discs' | 'engines' | 'agents' | 'snapshot'
  index?: number
  field?: string
}
export type AssetQuickReadAgentCandidate = {
  agentId: string
  name: string
  fields: Partial<RosterAgent>
  observedFields: ObservedAgentField[]
  equippedSourceIds: string[]
}
export type AssetQuickReadCandidate = {
  capturedAt: string
  snapshotSha256: string
  protocolVersion: '3.2'
  discs: StandardAssetDiscImport
  agents: AssetQuickReadAgentCandidate[]
  counts: {
    discs: number
    sDiscs: number
    engines: number
    agents: number
    importableAgents: number
  }
  issues: AssetQuickReadIssue[]
  warnings?: readonly string[]
  importable: boolean
  /** These are observed candidates, never proof of inventory completeness or deletion authority. */
  fullInventoryVerified: false
}

const uint = z.number().int().min(0).max(0xffffffff)
const observation = z.discriminatedUnion('presence', [
  z.object({ presence: z.literal('present'), value: uint }),
  z.object({ presence: z.literal('omitted'), value: z.null() }),
])
const stat = z.object({ key: observation, base_value: observation, add_value: observation })
const discRecord = z.object({
  uid: observation,
  catalog_id: observation,
  level: observation,
  main_stat: stat.nullable(),
  substats: z.array(stat).max(4),
})
const engineRecord = z.object({
  uid: observation,
  catalog_id: observation,
  level: observation,
  phase: observation,
  modification: observation,
})
const agentRecord = z.object({
  catalog_id: observation,
  level: observation,
  promotion: observation,
  weapon_uid: observation,
  mindscape: observation,
  skills: z.array(z.object({ skill_type: observation, level: observation })).max(6),
  dressed_equips: z.array(z.object({ uid: observation, slot: observation })).max(6),
})
/** Unknown transport/security fields are stripped and never copied into account candidates. */
export const assetSnapshotSchema = z.object({
  schema: z.literal('soda-asset-snapshot-probe/v1'),
  status: z.enum(['staged_for_field_review', 'response_semantics_unverified']),
  source: z.object({
    upstream_commit: z.literal('4853f07c8fb5322c12b9b580d6364b577c2ac96a'),
    protocol_version: z.literal('3.2'),
    requested_game_region: z.literal('CN'),
    mode: z.literal('live_copy_only_client_cn_configuration_candidate'),
    capture_started_unix_seconds: z.number().int().positive().max(253402300799),
  }),
  coverage: z.object({
    disc_load_received: z.literal(true),
    engine_load_received: z.literal(true),
    agent_load_received: z.literal(true),
  }),
  counts: z.object({
    discs: uint.max(3000),
    s_discs: uint.max(3000),
    a_discs: uint.max(3000),
    b_discs: uint.max(3000),
    unknown_rarity_discs: uint.max(3000),
    engines: uint.max(10000),
    agents: uint.max(1000),
  }),
  counters: z.object({ decoded_messages: uint.min(3) }),
  response_observations: z
    .array(
      z.object({
        kind: z.enum(['discs', 'engines', 'agents']),
        command_id: uint,
        status_field: uint,
        status_value: z.number().int().nullable(),
        status_presence: z.enum(['present', 'omitted']),
        assessment: z.enum(['zero_semantics_unverified', 'omitted_semantics_unverified']),
        status_semantics_verified: z.boolean(),
      }),
    )
    .length(3),
  issues: z.array(z.object({ code: z.string(), asset: z.string(), field: z.string() })).max(100),
  assets: z.object({
    discs: z.array(discRecord).max(3000),
    engines: z.array(engineRecord).max(10000),
    agents: z.array(agentRecord).max(1000),
  }),
  independent_inventory_total_verified: z.boolean(),
  full_inventory_verified: z.boolean(),
  ready_for_account_import: z.boolean(),
  account_write_enabled: z.literal(false),
  raw_traffic_saved: z.literal(false),
  response_status_semantics_verified: z.boolean(),
})

// Protocol enum, not the positional 0..5 indices used by upstream ZOD export.
const skillsByType: Record<number, keyof RosterAgent['skillLevels']> = {
  0: 'basic',
  1: 'special',
  2: 'dodge',
  3: 'chain',
  5: 'core',
  6: 'assist',
}
const statsById: Record<number, [StatKey, boolean]> = {
  11102: ['hp_percent', true],
  11103: ['hp_flat', false],
  12102: ['atk_percent', true],
  12103: ['atk_flat', false],
  12202: ['impact', true],
  13102: ['def_percent', true],
  13103: ['def_flat', false],
  20103: ['crit_rate', true],
  21103: ['crit_dmg', true],
  23103: ['pen_ratio', true],
  23203: ['pen', false],
  30502: ['energy_regen', true],
  31203: ['anomaly_proficiency', false],
  31402: ['anomaly_mastery', true],
  31503: ['physical_dmg', true],
  31603: ['fire_dmg', true],
  31703: ['ice_dmg', true],
  31803: ['electric_dmg', true],
  31903: ['ether_dmg', true],
  32303: ['wind_dmg', true],
}
const agentIdentities = new Map(
  identities.agents.map((row) => [row.gameId, { id: row.id, name: row.name }]),
)
const setIdentities = new Map(identities.discs.map((row) => [Number(row.gameId), row.id]))
const engineIdentities = new Map(identities.engines.map((row) => [Number(row.gameId), row]))
const sourceId = (uid: number) => `asset-quick-read:${uid}`

/** Pure local conversion. No account lookup, mutation, inventory replacement or transport. */
export function convertAssetSnapshot(
  input: unknown,
  context: { snapshotSha256: string; capturedAt?: string },
): AssetQuickReadCandidate {
  const issues: AssetQuickReadIssue[] = []
  const warnings: string[] = []
  const issue = (
    code: string,
    message: string,
    kind: AssetQuickReadIssue['kind'] = 'snapshot',
    index?: number,
    field?: string,
  ) =>
    issues.push({
      code,
      message,
      kind,
      ...(index === undefined ? {} : { index }),
      ...(field ? { field } : {}),
    })
  const parsed = assetSnapshotSchema.safeParse(input)
  const fallbackTime = '1970-01-01T00:00:00.000Z'
  const capturedAtInput =
    context.capturedAt ??
    (parsed.success
      ? new Date(parsed.data.source.capture_started_unix_seconds * 1000).toISOString()
      : fallbackTime)
  const capturedTime = z.string().datetime({ offset: true }).safeParse(capturedAtInput)
  const capturedAt = capturedTime.success ? new Date(capturedTime.data).toISOString() : fallbackTime
  const result: AssetQuickReadCandidate = {
    capturedAt,
    snapshotSha256: context.snapshotSha256,
    protocolVersion: '3.2',
    discs: {
      format: 'soda-terminal-drive-disc-import',
      formatVersion: 1,
      source: { adapter: 'asset-quick-read', capturedAt },
      batch: {},
      discs: [],
    },
    agents: [],
    counts: { discs: 0, sDiscs: 0, engines: 0, agents: 0, importableAgents: 0 },
    issues,
    warnings,
    importable: false,
    fullInventoryVerified: false,
  }
  if (!/^[a-fA-F0-9]{64}$/.test(context.snapshotSha256))
    issue('invalid_snapshot_hash', '快照校验摘要无效。')
  if (!capturedTime.success) issue('invalid_capture_time', '快照采集时间无效。')
  if (!parsed.success) {
    // Paths only: Zod messages may echo raw values in future versions.
    for (const error of parsed.error.issues.slice(0, 30))
      issue(
        'invalid_snapshot',
        '快照结构、版本或读取范围不符合当前国服3.2适配合同。',
        'snapshot',
        undefined,
        error.path.join('.'),
      )
    return result
  }
  const snapshot = parsed.data
  const discData = publicScannerDriveDiscData
  if (!discData) {
    issue('public_disc_catalog_unavailable', '公开驱动盘目录或规则校验失败，无法安全转换。')
    return result
  }
  const { assets, counts } = snapshot
  result.counts = {
    discs: counts.discs,
    sDiscs: counts.s_discs,
    engines: counts.engines,
    agents: counts.agents,
    importableAgents: 0,
  }
  if (snapshot.issues.length) issue('native_decode_issues', '原生读取包含解码问题，需重新核对。')
  if (
    counts.discs !== assets.discs.length ||
    counts.engines !== assets.engines.length ||
    counts.agents !== assets.agents.length ||
    counts.s_discs + counts.a_discs + counts.b_discs + counts.unknown_rarity_discs !== counts.discs
  )
    issue('count_mismatch', '资产数量与记录或稀有度分布不一致。')
  const expectedResponses = { discs: [3933, 12], engines: [1382, 12], agents: [2470, 8] }
  const responseKinds = new Set<string>()
  for (const response of snapshot.response_observations) {
    const expected = expectedResponses[response.kind]
    if (
      responseKinds.has(response.kind) ||
      response.command_id !== expected[0] ||
      response.status_field !== expected[1] ||
      (response.status_presence === 'omitted'
        ? response.status_value !== null || response.assessment !== 'omitted_semantics_unverified'
        : response.status_value !== 0 || response.assessment !== 'zero_semantics_unverified')
    )
      issue('invalid_response_observation', '三类读取响应身份或状态不符合当前观察范围。')
    responseKinds.add(response.kind)
  }
  const value = (
    ob: z.infer<typeof observation>,
    min: number,
    max: number,
    kind: AssetQuickReadIssue['kind'],
    index: number,
    field: string,
    omitted?: number,
  ) => {
    const number = ob.presence === 'present' ? ob.value : omitted
    if (number === undefined || number < min || number > max) {
      issue('invalid_asset_field', '资产字段缺失或超出有效范围。', kind, index, field)
      return undefined
    }
    return number
  }
  const ids = <T extends { uid: z.infer<typeof observation> }>(
    records: T[],
    kind: 'discs' | 'engines',
  ) => {
    const indexed = new Map<number, T>()
    records.forEach((record, index) => {
      const uid = value(record.uid, 1, 0xffffffff, kind, index, 'uid')
      if (uid !== undefined) {
        if (indexed.has(uid)) issue('duplicate_uid', '检测到重复实例身份。', kind, index, 'uid')
        else indexed.set(uid, record)
      }
    })
    return indexed
  }
  const discIndex = ids(assets.discs, 'discs')
  const engineIndex = ids(assets.engines, 'engines')
  assets.engines.forEach((engine, index) => {
    if (engine.catalog_id.value === null || !engineIdentities.has(engine.catalog_id.value))
      issue('unknown_engine_catalog', '音擎目录身份未识别。', 'engines', index, 'catalog_id')
    // Omitted inventory progression is unobserved; all present scalars still need valid ranges.
    if (engine.level.presence === 'present') value(engine.level, 1, 60, 'engines', index, 'level')
    if (engine.phase.presence === 'present') value(engine.phase, 1, 5, 'engines', index, 'phase')
    if (engine.modification.presence === 'present')
      value(engine.modification, 0, 5, 'engines', index, 'modification')
  })
  let actualS = 0
  assets.discs.forEach((disc, index) => {
    const before = issues.length
    const catalog = value(disc.catalog_id, 1, 0xffffffff, 'discs', index, 'catalog_id')
    const uid = disc.uid.value
    if (catalog === undefined || uid === null) return
    const slot = catalog % 10
    const rarity = (Math.floor(catalog / 10) % 10) + 1
    const setId = setIdentities.get(Math.floor(catalog / 100) * 100)
    if (rarity === 5) actualS++
    if (!setId)
      issue('unknown_disc_catalog', '驱动盘套装目录身份未识别。', 'discs', index, 'catalog_id')
    if (rarity !== 5 || slot < 1 || slot > 6)
      issue(
        'unsupported_disc_catalog',
        '当前快读仅接收已核对的S级1至6号驱动盘。',
        'discs',
        index,
        'catalog_id',
      )
    const level = value(disc.level, 0, 15, 'discs', index, 'level', 0)
    const main = disc.main_stat
    const mainInfo = main?.key.value === null || !main ? undefined : statsById[main.key.value]
    if (!mainInfo || !main || level === undefined) {
      issue('unknown_main_stat', '驱动盘主词条身份或等级无效。', 'discs', index)
      return
    }
    const [mainStat, percent] = mainInfo
    const rule = discData.rules.mainStatBaseByRarity.S.find((row) => row.stat === mainStat)
    const allowed = (discData.rules.mainStatsBySlot as Record<string, string[]>)[String(slot)] ?? []
    if (
      !rule ||
      !allowed.includes(mainStat) ||
      main.base_value.value !== rule.baseValue * (percent ? 100 : 1) ||
      main.add_value.value !== 1
    )
      issue(
        'invalid_main_stat_value',
        '主词条基础值、倍率或号位与标准构造不一致。',
        'discs',
        index,
        'main_stat',
      )
    const seenStats = new Set<string>()
    const subStats: StandardAssetDiscImport['discs'][number]['subStats'] = []
    for (const sub of disc.substats) {
      const info = sub.key.value === null ? undefined : statsById[sub.key.value]
      const step = discData.rules.subStatStepsByRarity.S.find((row) => row.stat === info?.[0])
      const base = sub.base_value.value
      const add = sub.add_value.value
      if (
        !info ||
        !step ||
        base === null ||
        add === null ||
        add < 1 ||
        add > 6 ||
        base !== step.baseValue * (info[1] ? 100 : 1) ||
        seenStats.has(info[0]) ||
        info[0] === mainStat
      ) {
        issue('invalid_substat', '副词条身份、基础值或强化倍率不合法。', 'discs', index, 'substats')
        continue
      }
      seenStats.add(info[0])
      subStats.push({
        stat: info[0],
        value: Number(((base * add) / (info[1] ? 100 : 1)).toFixed(4)),
        upgrades: add - 1,
      })
    }
    if (
      subStats.length < 3 ||
      (level >= 3 && subStats.length !== 4) ||
      subStats.reduce((total, row) => total + row.upgrades, 0) > Math.floor(level / 3)
    )
      issue(
        'invalid_substat_progression',
        '副词条数量或强化次数与驱动盘等级不一致。',
        'discs',
        index,
        'substats',
      )
    if (issues.length === before && setId)
      result.discs.discs.push({
        setId,
        slot: slot as 1 | 2 | 3 | 4 | 5 | 6,
        rarity: 'S',
        level,
        mainStat,
        subStats,
        locked: false,
        sourceId: sourceId(uid),
      })
  })
  if (actualS !== counts.s_discs || actualS !== assets.discs.length)
    issue('rarity_count_mismatch', 'S级盘分布与目录记录不一致。')
  const seenAgents = new Set<number>()
  const assignedDiscs = new Set<number>()
  const assignedEngines = new Set<number>()
  let equippedEnginesWithUnobservedProgression = 0
  assets.agents.forEach((agent, index) => {
    const before = issues.length
    const id = value(agent.catalog_id, 1, 0xffffffff, 'agents', index, 'catalog_id')
    const identity = id === undefined ? undefined : agentIdentities.get(String(id))
    if (!identity || id === undefined) {
      issue('unknown_agent_catalog', '代理人目录身份未识别。', 'agents', index)
      return
    }
    if (seenAgents.has(id)) issue('duplicate_agent', '检测到重复代理人身份。', 'agents', index)
    seenAgents.add(id)
    const level = value(agent.level, 1, 60, 'agents', index, 'level')
    const promotion = value(agent.promotion, 1, 6, 'agents', index, 'promotion')
    const mindscape = value(agent.mindscape, 0, 6, 'agents', index, 'mindscape', 0)
    const fields: Partial<RosterAgent> = {
      owned: true,
      level,
      ascension: promotion === undefined ? undefined : promotion - 1,
      mindscape,
    }
    const observedFields: ObservedAgentField[] = ['owned', 'level', 'ascension', 'mindscape']
    const skillLevels: RosterAgent['skillLevels'] = {
      basic: null,
      dodge: null,
      assist: null,
      special: null,
      chain: null,
      core: null,
    }
    const seenSkills = new Set<string>()
    for (const skill of agent.skills) {
      const type = skill.skill_type.value ?? 0
      const key = skillsByType[type]
      if (!key || seenSkills.has(key)) {
        issue('invalid_skill_type', '技能类型未知或重复。', 'agents', index, 'skills')
        continue
      }
      seenSkills.add(key)
      const base = value(skill.level, 1, key === 'core' ? 7 : 12, 'agents', index, `skills.${key}`)
      if (base !== undefined && mindscape !== undefined) {
        skillLevels[key] =
          base + (key === 'core' ? 0 : (mindscape >= 3 ? 2 : 0) + (mindscape >= 5 ? 2 : 0))
        observedFields.push(`skillLevels.${key}`)
      }
    }
    if (seenSkills.size !== 6)
      issue('missing_skills', '缺少六项完整技能观察。', 'agents', index, 'skills')
    fields.skillLevels = skillLevels
    const equippedSourceIds: string[] = []
    const seenSlots = new Set<number>()
    for (const equip of agent.dressed_equips) {
      const uid = value(equip.uid, 1, 0xffffffff, 'agents', index, 'dressed_equips.uid')
      const slot = value(equip.slot, 1, 6, 'agents', index, 'dressed_equips.slot')
      const disc = uid === undefined ? undefined : discIndex.get(uid)
      if (
        !disc ||
        slot === undefined ||
        disc.catalog_id.value === null ||
        disc.catalog_id.value % 10 !== slot ||
        seenSlots.has(slot) ||
        (uid !== undefined && assignedDiscs.has(uid))
      ) {
        issue(
          'invalid_equipped_disc_reference',
          '装备盘引用缺失、重复或号位不一致。',
          'agents',
          index,
          'dressed_equips',
        )
        continue
      }
      seenSlots.add(slot)
      assignedDiscs.add(uid!)
      equippedSourceIds[slot - 1] = sourceId(uid!)
    }
    const references = equippedSourceIds.filter(Boolean)
    if (references.length) observedFields.push('equippedDiscIds')
    // An omitted weapon reference is unobserved, not authority to clear an old equipment field.
    const weaponUid = agent.weapon_uid.value
    if (weaponUid !== null && weaponUid !== 0) {
      const engine = engineIndex.get(weaponUid)
      const engineIdentity =
        engine?.catalog_id.value === null || !engine
          ? undefined
          : engineIdentities.get(engine.catalog_id.value)
      if (!engine || !engineIdentity || assignedEngines.has(weaponUid))
        issue(
          'invalid_equipped_engine_reference',
          '当前装备音擎引用未识别或重复。',
          'agents',
          index,
          'weapon_uid',
        )
      else {
        assignedEngines.add(weaponUid)
        const engineLevel =
          engine.level.presence === 'present'
            ? value(engine.level, 1, 60, 'agents', index, 'wEngineDetails.level')
            : undefined
        const ascension =
          engine.modification.presence === 'present'
            ? value(engine.modification, 0, 5, 'agents', index, 'wEngineDetails.ascension')
            : undefined
        const refinement =
          engine.phase.presence === 'present'
            ? value(engine.phase, 1, 5, 'agents', index, 'wEngineDetails.refinement')
            : undefined
        if (engineLevel === undefined || ascension === undefined)
          equippedEnginesWithUnobservedProgression++
        fields.wEngineDetails = {
          id: engineIdentity.id,
          name: engineIdentity.name,
          level: engineLevel ?? null,
          ascension,
          refinement: refinement ?? null,
        }
        observedFields.push('wEngineDetails.id', 'wEngineDetails.name')
        if (engineLevel !== undefined) observedFields.push('wEngineDetails.level')
        if (ascension !== undefined) observedFields.push('wEngineDetails.ascension')
        if (refinement !== undefined) observedFields.push('wEngineDetails.refinement')
      }
    }
    if (issues.length === before)
      result.agents.push({
        agentId: identity.id,
        name: identity.name,
        fields,
        observedFields,
        equippedSourceIds: references,
      })
  })
  result.counts.importableAgents = result.agents.length
  if (equippedEnginesWithUnobservedProgression)
    warnings.push(
      `${equippedEnginesWithUnobservedProgression}件当前装备音擎未出现完整等级或突破字段；对应旧值保持，不能当作本次实测。`,
    )
  warnings.push('本次仅检查已出现的代理人和S级盘；未观测资产不删除，快照不构成全量仓库证明。')
  if (result.discs.discs.length && !standardDriveDiscImportSchema.safeParse(result.discs).success)
    issue('invalid_standard_disc_import', '转换后驱动盘不符合标准导入合同。')
  if (!result.discs.discs.length && !result.agents.length)
    issue('empty_observation', '没有可检查的资产记录。')
  result.importable = issues.length === 0
  return result
}
