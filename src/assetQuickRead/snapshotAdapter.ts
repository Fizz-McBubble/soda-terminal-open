import { z } from 'zod'
import { publicScannerDriveDiscData } from '../application/publicScannerCatalog'
import type { ObservedAgentField, RosterAgent } from '../assault/types'
import { standardDriveDiscImportSchema } from '../domain/discImport'
import { observePotentialDetail } from './potentialDetailObservation'
import {
  agentIdentities,
  type AssetQuickReadCandidate,
  type AssetQuickReadIssue,
  engineIdentities,
  setIdentities,
  sourceId,
  type StandardAssetDiscImport,
  statsById,
} from './snapshotAdapterIdentity'
import { convertSnapshotAgentSkills } from './snapshotAgentSkills'
import { assetSnapshotSchema, type SnapshotObservation } from './snapshotProtocolSchema'
export type {
  AssetQuickReadAgentCandidate,
  AssetQuickReadCandidate,
  AssetQuickReadIssue,
  StandardAssetDiscImport,
} from './snapshotAdapterIdentity'
export { assetSnapshotSchema } from './snapshotProtocolSchema'

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
  ) => {
    // Roster/engine observations enrich a disc import; they never authorize
    // disc writes and must not make valid physical discs unavailable.
    if (kind === 'agents' || kind === 'engines') {
      const warning = `${message}该项保持原记录，可在导入后手动补齐。`
      if (!warnings.includes(warning)) warnings.push(warning)
      return
    }
    issues.push({
      code,
      message,
      kind,
      ...(index === undefined ? {} : { index }),
      ...(field ? { field } : {}),
    })
  }
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
  const unreliableEngines =
    snapshot.issues.some((row) => row.asset === 'engine') ||
    counts.engines !== assets.engines.length
  const unreliableAgents =
    snapshot.issues.some((row) => row.asset === 'agent') || counts.agents !== assets.agents.length
  if (snapshot.issues.some((row) => !['engine', 'agent'].includes(row.asset)))
    issue('native_decode_issues', '驱动盘或读取响应包含解码问题，需重新核对。')
  if (unreliableEngines) issue('unreliable_engines', '音擎读取不完整，本次不更新音擎。', 'engines')
  if (unreliableAgents) issue('unreliable_agents', '代理人读取不完整，本次不更新代理人。', 'agents')
  if (
    counts.discs !== assets.discs.length ||
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
    ob: SnapshotObservation,
    min: number,
    max: number,
    kind: AssetQuickReadIssue['kind'],
    index: number,
    field: string,
    omitted?: number,
  ) => {
    const number =
      ob.presence === 'present' ? ob.value : ob.presence === 'omitted' ? omitted : undefined
    if (number === undefined || number < min || number > max) {
      issue('invalid_asset_field', '资产字段缺失或超出有效范围。', kind, index, field)
      return undefined
    }
    return number
  }
  const ids = <T extends { uid: SnapshotObservation }>(records: T[], kind: 'discs' | 'engines') => {
    const indexed = new Map<number, T>()
    const duplicates = new Set<number>()
    records.forEach((record, index) => {
      const uid = value(record.uid, 1, 0xffffffff, kind, index, 'uid')
      if (uid !== undefined) {
        if (indexed.has(uid) || duplicates.has(uid)) {
          issue('duplicate_uid', '检测到重复实例身份。', kind, index, 'uid')
          duplicates.add(uid)
          indexed.delete(uid)
        } else indexed.set(uid, record)
      }
    })
    return indexed
  }
  const inScopeDisc = (disc: (typeof assets.discs)[number]) => {
    const catalog = disc.catalog_id.value
    const rarity = catalog === null ? null : (Math.floor(catalog / 10) % 10) + 1
    return rarity !== 3 && rarity !== 4
  }
  const discIndex = ids(assets.discs.filter(inScopeDisc), 'discs')
  // Lower-grade identities only explain unsupported equipment relationships;
  // they never enter validation, preview, import or S-disc duplicate authority.
  for (const disc of assets.discs.filter((row) => !inScopeDisc(row))) {
    if (disc.uid.value !== null && !discIndex.has(disc.uid.value))
      discIndex.set(disc.uid.value, disc)
  }
  const engineIndex = ids(unreliableEngines ? [] : assets.engines, 'engines')
  ;(unreliableEngines ? [] : assets.engines).forEach((engine, index) => {
    if (engine.catalog_id.value === null || !engineIdentities.has(engine.catalog_id.value))
      issue('unknown_engine_catalog', '音擎目录身份未识别。', 'engines', index, 'catalog_id')
    if (engine.level.presence === 'present') value(engine.level, 0, 60, 'engines', index, 'level')
    if (engine.phase.presence === 'present') value(engine.phase, 1, 5, 'engines', index, 'phase')
    if (engine.modification.presence === 'present')
      value(engine.modification, 0, 5, 'engines', index, 'modification')
  })
  let actualS = 0
  let actualA = 0
  let actualB = 0
  assets.discs.forEach((disc, index) => {
    const observedCatalog = disc.catalog_id.value
    const observedRarity =
      observedCatalog === null ? null : (Math.floor(observedCatalog / 10) % 10) + 1
    if (observedRarity === 3) {
      actualB++
      return
    }
    if (observedRarity === 4) {
      actualA++
      return
    }
    const before = issues.length
    const catalog = value(disc.catalog_id, 1, 0xffffffff, 'discs', index, 'catalog_id')
    const uid = disc.uid.value
    if (catalog === undefined || uid === null) return
    const slot = catalog % 10
    const rarity = (Math.floor(catalog / 10) % 10) + 1
    const setId = setIdentities.get(Math.floor(catalog / 100) * 100)
    if (rarity === 5) actualS++
    if (rarity === 4) actualA++
    if (rarity === 3) actualB++
    if (!setId)
      issue('unknown_disc_catalog', '驱动盘套装目录身份未识别。', 'discs', index, 'catalog_id')
    if (![3, 4, 5].includes(rarity) || slot < 1 || slot > 6)
      issue('unsupported_disc_catalog', '驱动盘品级或号位未识别。', 'discs', index, 'catalog_id')
    const rarityName = rarity === 3 ? 'B' : rarity === 4 ? 'A' : 'S'
    const level = value(
      disc.level,
      0,
      rarity === 3 ? 9 : rarity === 4 ? 12 : 15,
      'discs',
      index,
      'level',
      0,
    )
    const main = disc.main_stat
    const mainInfo = main?.key.value === null || !main ? undefined : statsById[main.key.value]
    if (!mainInfo || !main || level === undefined) {
      issue('unknown_main_stat', '驱动盘主词条身份或等级无效。', 'discs', index)
      return
    }
    const [mainStat, percent] = mainInfo
    const rule = discData.rules.mainStatBaseByRarity[rarityName].find(
      (row) => row.stat === mainStat,
    )
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
      const step = discData.rules.subStatStepsByRarity[rarityName].find(
        (row) => row.stat === info?.[0],
      )
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
      subStats.length < (rarity === 5 ? 3 : rarity === 4 ? 2 : 1) ||
      (rarity === 5 && level >= 3 && subStats.length !== 4) ||
      subStats.reduce((total, row) => total + row.upgrades, 0) > Math.floor(level / 3)
    )
      issue(
        'invalid_substat_progression',
        '副词条数量或强化次数与驱动盘等级不一致。',
        'discs',
        index,
        'substats',
      )
    if (issues.length === before && setId && rarity === 5)
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
  if (
    actualS !== counts.s_discs ||
    actualA !== counts.a_discs ||
    actualB !== counts.b_discs ||
    counts.unknown_rarity_discs !== 0
  )
    issue('rarity_count_mismatch', 'S级盘分布与目录记录不一致。')
  const agentRecords = unreliableAgents ? [] : assets.agents
  const occurrences = (values: (number | null)[]) => {
    const counts = new Map<number, number>()
    for (const value of values) if (value !== null) counts.set(value, (counts.get(value) ?? 0) + 1)
    return counts
  }
  const agentIds = occurrences(agentRecords.map((agent) => agent.catalog_id.value))
  const engineReferences = occurrences(agentRecords.map((agent) => agent.weapon_uid.value))
  const discReferences = occurrences(
    agentRecords.flatMap((agent) => agent.dressed_equips.map((row) => row.uid.value)),
  )
  let equippedEnginesWithUnobservedProgression = 0
  agentRecords.forEach((agent, index) => {
    const id = value(agent.catalog_id, 1, 0xffffffff, 'agents', index, 'catalog_id')
    const identity = id === undefined ? undefined : agentIdentities.get(String(id))
    if (!identity || id === undefined) {
      issue('unknown_agent_catalog', '代理人目录身份未识别。', 'agents', index)
      return
    }
    if ((agentIds.get(id) ?? 0) > 1) {
      issue('duplicate_agent', '检测到重复代理人身份。', 'agents', index)
      return
    }
    const level = value(agent.level, 1, 60, 'agents', index, 'level')
    const promotion = value(agent.promotion, 1, 6, 'agents', index, 'promotion')
    const mindscape = value(agent.mindscape, 0, 6, 'agents', index, 'mindscape', 0)
    const fields: Partial<RosterAgent> = {
      owned: true,
      level,
      ascension: promotion === undefined ? undefined : promotion - 1,
      mindscape,
    }
    const observedFields: ObservedAgentField[] = ['owned']
    if (level !== undefined) observedFields.push('level')
    if (promotion !== undefined) observedFields.push('ascension')
    if (mindscape !== undefined) observedFields.push('mindscape')
    const potential = observePotentialDetail(agent.potential_detail_id, id)
    if (potential.level !== undefined) {
      fields.potentialImage = potential.level
      observedFields.push('potentialImage')
    }
    if (potential.warning) warnings.push(`${identity.name}${potential.warning}`)
    fields.skillLevels = convertSnapshotAgentSkills(
      agent.skills,
      mindscape,
      observedFields,
      (ob, maximum, field) => value(ob, 1, maximum, 'agents', index, field),
      (code, message) => issue(code, message, 'agents', index, 'skills'),
    )
    const equippedSourceIds: string[] = []
    let unsupportedEquippedDisc = false
    let invalidEquippedDisc = false
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
        (uid !== undefined && (discReferences.get(uid) ?? 0) > 1)
      ) {
        issue(
          'invalid_equipped_disc_reference',
          '装备盘引用缺失、重复或号位不一致。',
          'agents',
          index,
          'dressed_equips',
        )
        invalidEquippedDisc = true
        continue
      }
      seenSlots.add(slot)
      if ((Math.floor(disc.catalog_id.value / 10) % 10) + 1 !== 5) {
        unsupportedEquippedDisc = true
        continue
      }
      equippedSourceIds[slot - 1] = sourceId(uid!)
    }
    const references =
      invalidEquippedDisc || unsupportedEquippedDisc ? [] : equippedSourceIds.filter(Boolean)
    // The pinned AgentData load contains complete equipment on each observed
    // agent. An empty repeated field means unequipped, not a missing agent.
    // Invalid references and unsupported A/B equipment are still unobserved.
    if (!invalidEquippedDisc && !unsupportedEquippedDisc) observedFields.push('equippedDiscIds')
    if (unsupportedEquippedDisc)
      warnings.push(
        `${identity.name}当前装备包含A/B级盘，尚不支持同步该代理人的装备盘关系；保留原记录。`,
      )
    // An omitted weapon reference is unobserved, not authority to clear an old equipment field.
    const weaponUid = agent.weapon_uid.value
    if (agent.weapon_uid.presence === 'present' && weaponUid === 0) {
      // Only explicit zero has clearing authority. Omitted/invalid references
      // preserve previous equipment, even though protobuf's scalar default is zero.
      fields.wEngineDetails = { id: null, name: null, level: null, refinement: null }
      observedFields.push('wEngineDetails.id')
    } else if (weaponUid !== null && weaponUid !== 0) {
      const engine = engineIndex.get(weaponUid)
      const engineIdentity =
        engine?.catalog_id.value === null || !engine
          ? undefined
          : engineIdentities.get(engine.catalog_id.value)
      if (!engine || !engineIdentity || (engineReferences.get(weaponUid) ?? 0) > 1)
        issue(
          'invalid_equipped_engine_reference',
          '当前装备音擎引用未识别或重复。',
          'agents',
          index,
          'weapon_uid',
        )
      else {
        let engineLevel =
          engine.level.presence === 'present'
            ? value(engine.level, 0, 60, 'agents', index, 'wEngineDetails.level')
            : undefined
        let ascension =
          engine.modification.presence === 'present'
            ? value(engine.modification, 0, 5, 'agents', index, 'wEngineDetails.ascension')
            : undefined
        const refinement =
          engine.phase.presence === 'present'
            ? value(engine.phase, 1, 5, 'agents', index, 'wEngineDetails.refinement')
            : undefined
        // Locked upstream WeaponInfo defaults absent uint32 progression to zero.
        // Enka-linked CN 3.2 WeaponLevel/WeaponStar tables include level 0 and
        // ascension 0 (levels 0..10). Adopt that protocol default only for this
        // complete, uniquely referenced known record with a valid phase and a
        // compatible progression pair. Invalid/malformed observations never default.
        if (refinement !== undefined) {
          const resolvedLevel = engine.level.presence === 'omitted' ? 0 : engineLevel
          const resolvedAscension = engine.modification.presence === 'omitted' ? 0 : ascension
          if (
            resolvedLevel !== undefined &&
            resolvedAscension !== undefined &&
            resolvedLevel >= resolvedAscension * 10 &&
            resolvedLevel <= Math.min(60, (resolvedAscension + 1) * 10)
          ) {
            engineLevel = resolvedLevel
            ascension = resolvedAscension
          } else if (engineLevel !== undefined && ascension !== undefined) {
            issue('invalid_engine_progression', '音擎等级与突破组合不符。', 'agents', index)
            engineLevel = undefined
            ascension = undefined
          }
        }
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
      `${equippedEnginesWithUnobservedProgression}件当前音擎的等级或突破未读到，保留原值；可先导入，再手动补齐。`,
    )
  warnings.push('本次仅检查已出现的代理人和S级盘；未观测资产不删除，快照不构成全量仓库证明。')
  if (result.discs.discs.length && !standardDriveDiscImportSchema.safeParse(result.discs).success)
    issue('invalid_standard_disc_import', '转换后驱动盘不符合标准导入合同。')
  if (!result.discs.discs.length && !result.agents.length)
    issue('empty_observation', '没有可检查的资产记录。')
  result.importable = issues.length === 0
  return result
}
