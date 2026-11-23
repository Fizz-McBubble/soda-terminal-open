import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { format, resolveConfig } from 'prettier'
import { readFrozenSeverian } from './nanoka-agent-projection.mjs'

const root = fileURLToPath(new URL('../..', import.meta.url))
const defaultOutput = resolve(root, 'src/gameDataPacks/data/severian-event-contract.3.3.json')
const providerManifestSha256 = '4d30f529d6e0568a130ebe4d79557b30d9c65d2219e77461763df1c4b42cb029'
const rawSha256 = '89f3a03b90fca880851352d6d686e6bbe658411d7b4cdf6b78d2a14a97ff5974'

const argument = (name) => {
  const index = process.argv.indexOf(name)
  return index < 0 ? undefined : process.argv[index + 1]
}
const frozenRoot = argument('--frozen-root')
const output = resolve(argument('--output') ?? defaultOutput)

if (!frozenRoot)
  throw new Error(
    'Usage: project-severian-event-contract33.mjs --frozen-root <directory> [--output <json>]',
  )

const projection = readFrozenSeverian(frozenRoot, {
  expectedProviderManifestSha256: providerManifestSha256,
})
if (projection.source.sha256 !== rawSha256) throw new Error('Severian source SHA256 drifted.')

const raw = JSON.parse(readFileSync(join(frozenRoot, 'nanoka/3.3/zh/character/1631.json')))
// IDs and action groups are reviewed against both description and parameter sections.
// The index identifies a source aggregate/alternative, never an individual combat hit.
const bindings = [
  ['1631001', 'BasicAttackSwiftEdge', 0, 'basic', '普通攻击：疾锋'],
  ['1631002', 'BasicAttackSwiftEdge', 1, 'basic', '普通攻击：疾锋'],
  ['1631003', 'BasicAttackSwiftEdge', 2, 'basic', '普通攻击：疾锋'],
  ['1631004', 'BasicAttackSwiftEdge', 3, 'basic', '普通攻击：疾锋'],
  ['1631020', 'BasicAttackSwiftEdge', 4, 'basic', '普通攻击：疾锋'],
  ['1631005', 'BasicAttackFierceVortex', 0, 'basic', '普通攻击：烈旋'],
  ['1631006', 'BasicAttackGaleShadowHunt', 0, 'basic', '普通攻击：苍风影猎'],
  ['1631010', 'DashAttackColdAssault', 0, 'dash', '冲刺攻击：凛袭'],
  ['1631011', 'DodgeCounterTipKill', 0, 'dodgeCounter', '闪避反击：梢杀'],
  ['1631007', 'SpecialAttackInstantWindSlash', 0, 'special', '特殊技：瞬风斩破'],
  ['1631008', 'EXSpecialAttackInstantWindRuin', 0, 'exSpecial', '强化特殊技：瞬风裂毁'],
  ['1631009', 'EXSpecialAttackInstantWindRuin', 1, 'exSpecial', '强化特殊技：瞬风裂毁'],
  ['1631012', 'ChainAttackColdBladeHarvest', 0, 'chain', '连携技：冽刃收割'],
  ['1631013', 'UltimateAnnihilatingWindCalamity', 0, 'ultimate', '终结技：戮灭的风灾'],
  ['1631014', 'QuickAssistFrontlineOrder', 0, 'quickAssist', '快速支援：火线调令'],
  ['1631015', 'DefensiveAssistNoProvocation', 0, 'defensiveAssist', '招架支援：寻衅禁止'],
  ['1631016', 'DefensiveAssistNoProvocation', 1, 'defensiveAssist', '招架支援：寻衅禁止'],
  ['1631017', 'DefensiveAssistNoProvocation', 2, 'defensiveAssist', '招架支援：寻衅禁止'],
  ['1631018', 'AssistFollowUpStopWarWithWar', 0, 'assistFollowUp', '支援突击：以戈止戈'],
  ['1631019', 'EntrySkillClearingMoment', 0, 'quickAssist', '登场技：清场时刻'],
]
const bindingById = new Map(bindings.map((row) => [row[0], row]))
if (projection.eventContract.events.length !== bindings.length)
  throw new Error('Severian event population drifted; review action bindings.')
const events = projection.eventContract.events.map((event) => {
  const binding = bindingById.get(event.sourceSkillId)
  if (!binding) throw new Error(`Unreviewed Severian skill ID: ${event.sourceSkillId}`)
  const [, actionId, hitIndex, damageType, sourceName] = binding
  const descriptions = raw.skill[event.skill].description
  const description = descriptions.find((entry) => entry.name === sourceName && entry.desc)
  const parameters = descriptions.find((entry) => entry.name === sourceName && entry.param)
  if (!description || !parameters?.param.some((p) => event.sourceSkillId in (p.param ?? {})))
    throw new Error(`Severian action/description binding drifted: ${sourceName}`)
  const defensive = damageType === 'defensiveAssist'
  if (!defensive && !description.desc.includes('风属性伤害'))
    throw new Error(`Severian damage attribute needs review: ${sourceName}`)
  const requiredState =
    {
      1631020: 'fourth_hit_perfect_dodge',
      1631005: 'counter_dodge_or_shimmer_shadow_trigger',
      1631006: 'flowing_breath_at_least_100',
      1631010: 'after_dodge',
      1631011: 'perfect_dodge_counter_available',
      1631008: 'energy_at_least_40',
      1631009: 'hold_after_ex_special_additional_energy_up_to_40',
      1631012: 'chain_trigger_available',
      1631013: 'ultimate_decibels_ready',
      1631014: 'quick_assist_trigger_available',
      1631015: 'incoming_light_parry',
      1631016: 'incoming_heavy_parry',
      1631017: 'incoming_chain_parry',
      1631018: 'after_defensive_assist',
      1631019: 'poised_wind_entry_available',
    }[event.sourceSkillId] ?? null
  return {
    eventId: event.eventId,
    skill: event.skill,
    actionId,
    hitIndex,
    sourceSkillId: event.sourceSkillId,
    eventGranularity: event.eventGranularity,
    operators: event.operators,
    sourceParameters: event.sourceParameters,
    resourceParameters: event.resourceParameters,
    sourceLocator: event.sourceLocator,
    scalingAttribute: 'atk',
    formulaFamily: 'standard_direct_damage',
    damageType,
    formulaProjection: 'reviewed_source_aggregate',
    formulaBinding: {
      status: 'limited',
      reason:
        'Reviewed action aggregate and damage channel; conditional additions, individual hits and resource/timing closure remain unbound.',
      sourceName,
      descriptionLocator: `skill.${event.skill}.description:${sourceName}`,
      requiredState,
      automaticPlanningEligible: !requiredState && !defensive && damageType !== 'ultimate',
      formalEligible: false,
    },
    attribute: defensive ? 'physical' : 'wind',
    eventModifierRefs: [],
  }
})
const eventSha256 = createHash('sha256').update(JSON.stringify(events)).digest('hex').toUpperCase()

const artifact = {
  schema: 'soda-current-agent-event-overlay/v1',
  gameVersion: '3.3',
  agentId: 'agent-severian',
  stableId: 'agent-severian',
  externalId: '1631',
  upstreamKey: 'Severian',
  identity: {
    rarity: 'S',
    attribute: 'wind',
    specialty: 'attack',
    faction: 'CriminalInvestigationSpecialResponseTeam',
  },
  baseStats: projection.baseStats,
  promotionStats: projection.promotionStats,
  coreStats: projection.coreStats,
  eventContract: {
    schema: projection.eventContract.schema,
    operatorKinds: projection.eventContract.operatorKinds,
    eventDimensions: projection.eventContract.eventDimensions,
    interpretation:
      'limited_nanoka_source_parameter_projection_not_exact_hit_sequence_or_formula_authority',
    events,
  },
  teamActivationContract: {
    status: 'compiled',
    predicate: {
      kind: 'category_sum_minimum',
      terms: [
        { kind: 'specialty', value: 'support' },
        { kind: 'specialty', value: 'stun' },
        { kind: 'faction', value: 'CriminalInvestigationSpecialResponseTeam' },
      ],
      minimum: 2,
      dynamicTerms: [],
      evaluationBoundary: 'base_mindscape_static_team_identity',
      locator: '1631.json#passive.level.1631501.desc[1]',
      normalizedFrom: 'active_at_minimum',
    },
  },
  source: {
    repository: 'https://static.nanoka.cc',
    commit: `sha256:${rawSha256}`,
    license: 'redistribution_not_confirmed',
    statsPath: 'nanoka/3.3/zh/character/1631.json',
    statsSha256: rawSha256.toUpperCase(),
    formulaPath: 'nanoka/3.3/zh/character/1631.json#skill.*.param',
    formulaSha256: eventSha256,
    formulaOrigin: 'soda_reviewed_source_aggregate_projection',
    formulaSha256Definition: 'sha256(JSON.stringify(events)); not an upstream formula sheet',
    provider: 'nanoka',
    providerManifestSha256: providerManifestSha256.toUpperCase(),
    rawSha256: rawSha256.toUpperCase(),
    url: projection.source.url,
    licenseStatus: projection.source.licenseStatus,
  },
  limitations: [
    'Nanoka parameter rows are source aggregates, not individual combat hits.',
    'Conditional passives, flowing-breath/shimmer-shadow/poised-wind transitions, complete rotation and exact DPS remain outside this contract.',
    'The event overlay supports mechanism coverage and limited fixed-event comparison only; it is not formal formula adoption.',
  ],
}

mkdirSync(dirname(output), { recursive: true })
writeFileSync(
  output,
  await format(JSON.stringify(artifact, null, 2), {
    ...(await resolveConfig(defaultOutput)),
    parser: 'json',
  }),
)
console.log(
  JSON.stringify({
    output,
    agentId: artifact.agentId,
    events: events.length,
    rawSha256,
    eventSha256,
  }),
)
