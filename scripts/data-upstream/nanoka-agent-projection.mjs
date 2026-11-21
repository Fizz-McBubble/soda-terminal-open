/** Offline Nanoka numeric overlay. Source parameter records are not combat hits. */
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { collectSkillParameters } from './nanoka-release-audit.mjs'

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')
const fail = (message) => {
  throw new Error(message)
}
const number = (value, locator) => {
  if (!Number.isFinite(value)) fail(`Missing/non-finite numeric source: ${locator}`)
  return value
}
const linear = (base, growth, divisor, locator) => ({
  kind: 'linear_skill_level',
  base: number(base, locator) / divisor,
  growthPerLevel: number(growth, `${locator}_growth`) / divisor,
  minimumLevel: 1,
  maximumLevel: 16,
})

// Property IDs, rather than translated labels, define core panel destinations.
const coreProperties = {
  12101: ['atk', 1],
  12201: ['impact', 1],
  21101: ['crit_dmg_', 10000],
  31401: ['anomMas', 1],
}

/** Only numerical source fields are normalized; no prose-derived effects. */
export function projectNanokaNumeric(raw) {
  const s = raw.stats
  const baseStats = {
    atk_base: number(s?.attack, 'stats.attack'),
    atk_growth: number(s.attack_growth, 'stats.attack_growth') / 10000,
    def_base: number(s.defence, 'stats.defence'),
    def_growth: number(s.defence_growth, 'stats.defence_growth') / 10000,
    hp_base: number(s.hp_max, 'stats.hp_max'),
    hp_growth: number(s.hp_growth, 'stats.hp_growth') / 10000,
    anomMas: number(s.element_abnormal_power, 'stats.element_abnormal_power'),
    anomProf: number(s.element_mystery, 'stats.element_mystery'),
    impact: number(s.break_stun, 'stats.break_stun'),
    enerRegen: number(s.sp_recover, 'stats.sp_recover') / 100,
  }
  const promotionStats = []
  const promotionLevelBounds = []
  const coreStats = []
  const unsupportedCoreProperties = []
  for (let index = 1; index <= 6; index++) {
    const row = raw.level?.[index]
    promotionStats.push({
      hp: number(row?.hp_max, `level.${index}.hp_max`),
      atk: number(row.attack, `level.${index}.attack`),
      def: number(row.defence, `level.${index}.defence`),
    })
    promotionLevelBounds.push({
      minimum: number(row.level_min, `level.${index}.level_min`),
      maximum: number(row.level_max, `level.${index}.level_max`),
    })
    const extra = raw.extra_level?.[index]?.extra
    if (!extra) fail(`Missing core panel source: extra_level.${index}.extra`)
    const core = {}
    for (const [id, prop] of Object.entries(extra)) {
      if (String(prop.prop) !== id) fail(`Core property identity mismatch: ${id}`)
      const mapping = coreProperties[id]
      if (!mapping) {
        unsupportedCoreProperties.push({ coreUpgrade: index, propertyId: id, raw: prop })
        continue
      }
      core[mapping[0]] = number(prop.value, `extra_level.${index}.extra.${id}.value`) / mapping[1]
    }
    coreStats.push(core)
  }
  const parameters = collectSkillParameters(raw.skill)
  const groups = new Map()
  for (const [skill, group] of Object.entries(raw.skill)) {
    for (const id of Object.keys(collectSkillParameters(group))) {
      if (groups.has(id) && groups.get(id) !== skill) fail(`Ambiguous skill group: ${id}`)
      groups.set(id, skill)
    }
  }
  const events = Object.entries(parameters).map(([id, p]) => {
    const resources = {}
    for (const field of ['sp_recovery', 'fever_recovery', 'rp_recovery']) {
      if (field in p || `${field}_growth` in p)
        resources[field] = {
          operator: linear(p[field], p[`${field}_growth`], 1, `${id}.${field}`),
          unit: `nanoka_raw_${field}`,
          displayedPointDivisor: null,
          status: 'raw_only_scale_not_adopted',
        }
    }
    for (const field of ['sp_consume', 'ether_purify']) {
      if (field in p)
        resources[field] = {
          operator: { kind: 'constant', value: number(p[field], `${id}.${field}`) },
          unit: `nanoka_raw_${field}`,
          displayedPointDivisor: null,
          status: 'raw_only_scale_not_adopted',
        }
    }
    return {
      eventId: `${groups.get(id)}.nanoka-${id}.source-parameter`,
      skill: groups.get(id),
      actionId: `nanoka-${id}`,
      sourceSkillId: id,
      eventGranularity: 'source_skill_parameter_aggregate_not_individual_hit',
      operators: {
        damageMultiplier: linear(
          p.damage_percentage,
          p.damage_percentage_growth,
          10000,
          `${id}.damage_percentage`,
        ),
        dazeMultiplier: linear(p.stun_ratio, p.stun_ratio_growth, 10000, `${id}.stun_ratio`),
        anomalyBuildup: {
          kind: 'constant',
          value: number(p.attribute_infliction, `${id}.attribute_infliction`) / 100,
        },
      },
      sourceParameters: p,
      sourceLocator: `skill.${groups.get(id)}:param.${id}`,
      resourceParameters: resources,
      formulaProjection: 'unsupported_nanoka_source_parameters_only',
      formulaBinding: {
        status: 'unsupported',
        reason:
          'Parameter identity alone does not prove action hit count, damage attribute, scaling stat, damage type or conditional effects',
      },
    }
  })
  return {
    baseStats,
    promotionStats,
    promotionLevelBounds,
    coreStats,
    additionalBaseStats: {
      critRate_: number(s.crit, 'stats.crit') / 100,
      critDMG_: number(s.crit_damage, 'stats.crit_damage') / 100,
      pen_: number(s.pen_rate, 'stats.pen_rate') / 100,
      pen: number(s.pen_delta, 'stats.pen_delta'),
      maxEnergy: number(s.sp_bar_point, 'stats.sp_bar_point'),
    },
    unsupportedCoreProperties,
    eventContract: {
      schema: 'soda-agent-event-contract/v1',
      operatorKinds: ['linear_skill_level', 'constant'],
      eventDimensions: ['direct_damage', 'daze_buildup', 'anomaly_buildup'],
      interpretation: 'numeric_source_inventory_requires_explicit_formula_binding',
      events,
    },
  }
}

/** Unrounded growth basis; menu floor is exposed separately. Core is 0..6. */
export function evaluateNanokaPanel(projection, { level, ascension, coreUpgrade }) {
  if (
    !Number.isInteger(level) ||
    level < 1 ||
    level > 60 ||
    !Number.isInteger(ascension) ||
    ascension < 0 ||
    ascension > 5 ||
    !Number.isInteger(coreUpgrade) ||
    coreUpgrade < 0 ||
    coreUpgrade > 6
  )
    fail('Invalid level/ascension/coreUpgrade')
  const bounds = projection.promotionLevelBounds[ascension]
  if (level < Math.max(1, bounds.minimum) || level > bounds.maximum)
    fail('Level outside selected ascension bounds')
  const core = coreUpgrade ? projection.coreStats[coreUpgrade - 1] : {}
  const values = {}
  for (const stat of ['hp', 'atk', 'def'])
    values[stat] =
      projection.baseStats[`${stat}_base`] +
      projection.baseStats[`${stat}_growth`] * (level - 1) +
      projection.promotionStats[ascension][stat] +
      (core[stat] ?? 0)
  for (const stat of ['anomMas', 'anomProf', 'impact', 'enerRegen'])
    values[stat] = projection.baseStats[stat] + (core[stat] ?? 0)
  if (core.crit_dmg_ !== undefined) values.crit_dmg_ = core.crit_dmg_
  return {
    basis: 'source_growth_plus_promotion_plus_core_no_passive_or_equipment',
    values,
    menuWhiteBase: Object.fromEntries(
      ['hp', 'atk', 'def'].map((stat) => [stat, Math.floor(values[stat])]),
    ),
  }
}

export function evaluateNanokaOperator(operator, skillLevel) {
  if (!Number.isInteger(skillLevel) || skillLevel < 1 || skillLevel > 16)
    fail('Invalid skill level')
  return operator.kind === 'constant'
    ? operator.value
    : operator.base + operator.growthPerLevel * (skillLevel - 1)
}

/** The pinned bytes, stable identity and provider live version are all required. */
export function projectPhoenix({
  bytes,
  expectedSha256,
  sourceVersion,
  language = 'zh',
  providerManifestBytes,
  expectedProviderManifestSha256,
}) {
  if (!/^[a-f0-9]{64}$/i.test(expectedSha256 ?? '') || hash(bytes) !== expectedSha256.toLowerCase())
    fail('Nanoka source SHA256 mismatch')
  if (
    !/^[a-f0-9]{64}$/i.test(expectedProviderManifestSha256 ?? '') ||
    !providerManifestBytes ||
    hash(providerManifestBytes) !== expectedProviderManifestSha256.toLowerCase()
  )
    fail('Nanoka provider manifest SHA256 mismatch or missing expected pin')
  const providerManifest = JSON.parse(providerManifestBytes)
  if (sourceVersion !== '3.3' || providerManifest?.zzz?.live !== sourceVersion)
    fail('Phoenix projection requires Nanoka live 3.3')
  if (!['zh', 'en'].includes(language)) fail('Unsupported source language')
  const raw = JSON.parse(bytes)
  if (raw.id !== 1641) fail('Phoenix source identity mismatch')
  const numeric = projectNanokaNumeric(raw)
  return {
    schema: 'soda-nanoka-agent-numeric-overlay/v1',
    gameVersion: '3.3',
    agentId: 'agent-phoenix',
    externalId: '1641',
    name: raw.name,
    identity: {
      rawRarity: raw.rarity,
      rawSpecialty: raw.weapon_type,
      rawAttribute: raw.element_type,
      rawFaction: raw.camp,
    },
    ...numeric,
    unitContract: {
      damage_percentage: { divisor: 10000, unit: 'dimensionless_damage_multiplier' },
      stun_ratio: { divisor: 10000, unit: 'dimensionless_daze_multiplier' },
      attribute_infliction: { divisor: 100, unit: 'anomaly_buildup_points' },
      stat_growth: { divisor: 10000, unit: 'flat_stat_per_character_level' },
      sp_recover: { divisor: 100, unit: 'energy_points_per_second' },
      crit: { divisor: 100, unit: 'percentage_points' },
      resources:
        'Retained as named Nanoka raw units; do not use for resource payability until independently mapped',
    },
    source: {
      provider: 'Nanoka',
      sourceVersion,
      language,
      url: `https://static.nanoka.cc/zzz/${sourceVersion}/${language}/character/1641.json`,
      sha256: hash(bytes),
      providerManifestSha256: hash(providerManifestBytes),
      licenseStatus: 'redistribution_not_confirmed',
      originRelationship: 'Nanoka source; not a Genshin Optimizer formula sheet or MIT asset',
    },
    unsupportedMechanics: {
      status: 'unsupported',
      dimensions: [
        'conditional_passives',
        'team_activation',
        'mindscape_effects',
        'potential_effects',
        'abloom',
        'resource_timeline',
        'complete_rotation',
        'exact_dps',
      ],
      sourceLocators: ['passive', 'talent', 'potential', 'potential_detail', 'skill.*.description'],
      reason:
        'Prose preserved in pinned raw source; no arbitrary numeric extraction or cycle inference',
    },
  }
}

export function readFrozenPhoenix(root, { language = 'zh', expectedProviderManifestSha256 } = {}) {
  if (!/^[a-f0-9]{64}$/i.test(expectedProviderManifestSha256 ?? ''))
    fail('Explicit expected provider manifest SHA256 pin required')
  const manifestBytes = readFileSync(join(root, 'nanoka-detail-manifest.json'))
  const manifest = JSON.parse(manifestBytes)
  const providerBytes = readFileSync(join(root, 'nanoka-manifest.json'))
  const path = join(root, 'nanoka', '3.3', language, 'character', '1641.json')
  const url = `https://static.nanoka.cc/zzz/3.3/${language}/character/1641.json`
  const records = manifest.items.filter((item) => item.url === url)
  if (records.length !== 1) fail('Missing/ambiguous frozen Phoenix manifest entry')
  const bytes = readFileSync(path)
  if (bytes.length !== records[0].bytes) fail('Nanoka source byte length mismatch')
  const result = projectPhoenix({
    bytes,
    expectedSha256: records[0].sha256,
    sourceVersion: '3.3',
    language,
    providerManifestBytes: providerBytes,
    expectedProviderManifestSha256,
  })
  result.source.detailManifestSha256 = hash(manifestBytes)
  result.source.providerManifestSha256 = hash(providerBytes)
  return result
}

export function projectSeverian({
  bytes,
  expectedSha256,
  sourceVersion,
  language = 'zh',
  providerManifestBytes,
  expectedProviderManifestSha256,
}) {
  if (!/^[a-f0-9]{64}$/i.test(expectedSha256 ?? '') || hash(bytes) !== expectedSha256.toLowerCase())
    fail('Nanoka source SHA256 mismatch')
  if (
    !/^[a-f0-9]{64}$/i.test(expectedProviderManifestSha256 ?? '') ||
    !providerManifestBytes ||
    hash(providerManifestBytes) !== expectedProviderManifestSha256.toLowerCase()
  )
    fail('Nanoka provider manifest SHA256 mismatch or missing expected pin')
  const providerManifest = JSON.parse(providerManifestBytes)
  if (sourceVersion !== '3.3' || providerManifest?.zzz?.live !== sourceVersion)
    fail('Severian projection requires Nanoka live 3.3')
  if (!['zh', 'en'].includes(language)) fail('Unsupported source language')
  const raw = JSON.parse(bytes)
  if (raw.id !== 1631) fail('Severian source identity mismatch')
  const numeric = projectNanokaNumeric(raw)
  return {
    schema: 'soda-nanoka-agent-numeric-overlay/v1',
    gameVersion: '3.3',
    agentId: 'agent-severian',
    externalId: '1631',
    name: raw.name,
    identity: {
      rawRarity: raw.rarity,
      rawSpecialty: raw.weapon_type,
      rawAttribute: raw.element_type,
      rawFaction: raw.camp,
    },
    ...numeric,
    unitContract: {
      damage_percentage: { divisor: 10000, unit: 'dimensionless_damage_multiplier' },
      stun_ratio: { divisor: 10000, unit: 'dimensionless_daze_multiplier' },
      attribute_infliction: { divisor: 100, unit: 'anomaly_buildup_points' },
      stat_growth: { divisor: 10000, unit: 'flat_stat_per_character_level' },
      sp_recover: { divisor: 100, unit: 'energy_points_per_second' },
      crit: { divisor: 100, unit: 'percentage_points' },
      resources:
        'Retained as named Nanoka raw units; do not use for resource payability until independently mapped',
    },
    source: {
      provider: 'Nanoka',
      sourceVersion,
      language,
      url: `https://static.nanoka.cc/zzz/${sourceVersion}/${language}/character/1631.json`,
      sha256: hash(bytes),
      providerManifestSha256: hash(providerManifestBytes),
      licenseStatus: 'redistribution_not_confirmed',
      originRelationship: 'Nanoka source; not a Genshin Optimizer formula sheet or MIT asset',
    },
    unsupportedMechanics: {
      status: 'unsupported',
      dimensions: [
        'conditional_passives',
        'team_activation',
        'mindscape_effects',
        'potential_effects',
        'resource_timeline',
        'complete_rotation',
        'exact_dps',
      ],
      sourceLocators: ['passive', 'talent', 'potential', 'potential_detail', 'skill.*.description'],
      reason:
        'Prose preserved in pinned raw source; no arbitrary numeric extraction or cycle inference',
    },
  }
}

export function readFrozenSeverian(root, { language = 'zh', expectedProviderManifestSha256 } = {}) {
  if (!/^[a-f0-9]{64}$/i.test(expectedProviderManifestSha256 ?? ''))
    fail('Explicit expected provider manifest SHA256 pin required')
  const manifestBytes = readFileSync(join(root, 'nanoka-detail-manifest.json'))
  const manifest = JSON.parse(manifestBytes)
  const providerBytes = readFileSync(join(root, 'nanoka-manifest.json'))
  const path = join(root, 'nanoka', '3.3', language, 'character', '1631.json')
  const url = `https://static.nanoka.cc/zzz/3.3/${language}/character/1631.json`
  const records = manifest.items.filter((item) => item.url === url)
  if (records.length !== 1) fail('Missing/ambiguous frozen Severian manifest entry')
  const bytes = readFileSync(path)
  if (bytes.length !== records[0].bytes) fail('Nanoka source byte length mismatch')
  const result = projectSeverian({
    bytes,
    expectedSha256: records[0].sha256,
    sourceVersion: '3.3',
    language,
    providerManifestBytes: providerBytes,
    expectedProviderManifestSha256,
  })
  result.source.detailManifestSha256 = hash(manifestBytes)
  result.source.providerManifestSha256 = hash(providerBytes)
  return result
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argument = (name) => process.argv[process.argv.indexOf(name) + 1]
  if (
    !process.argv.includes('--frozen-root') ||
    !process.argv.includes('--output') ||
    !process.argv.includes('--provider-manifest-sha256')
  )
    fail(
      'Usage: --frozen-root <fixed-input-directory> --provider-manifest-sha256 <expected-pin> --output <new-json-path>',
    )
  const result = readFrozenPhoenix(argument('--frozen-root'), {
    expectedProviderManifestSha256: argument('--provider-manifest-sha256'),
  })
  result.panelExamples = [
    { level: 1, ascension: 0, coreUpgrade: 0 },
    { level: 60, ascension: 5, coreUpgrade: 6 },
  ].map((input) => ({ input, ...evaluateNanokaPanel(result, input) }))
  writeFileSync(resolve(argument('--output')), `${JSON.stringify(result, null, 2)}\n`, {
    flag: 'wx',
  })
  console.log(
    JSON.stringify({
      agentId: result.agentId,
      events: result.eventContract.events.length,
      sourceSha256: result.source.sha256,
    }),
  )
}
