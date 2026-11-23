import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { format, resolveConfig } from 'prettier'
import { readFrozenPhoenix } from './nanoka-agent-projection.mjs'

const root = fileURLToPath(new URL('../..', import.meta.url))
const defaultOutput = resolve(root, 'src/gameDataPacks/data/phoenix-event-contract.3.3.json')
const providerManifestSha256 = '4d30f529d6e0568a130ebe4d79557b30d9c65d2219e77461763df1c4b42cb029'
const rawSha256 = '237c5b060657db1fd8ababe6cd26fb275c325d74a67eda481bde6732c7d93dfe'

const argument = (name) => {
  const index = process.argv.indexOf(name)
  return index < 0 ? undefined : process.argv[index + 1]
}
const frozenRoot = argument('--frozen-root')
const output = resolve(argument('--output') ?? defaultOutput)

if (!frozenRoot)
  throw new Error(
    'Usage: project-phoenix-event-contract33.mjs --frozen-root <directory> [--output <json>]',
  )

const projection = readFrozenPhoenix(frozenRoot, {
  expectedProviderManifestSha256: providerManifestSha256,
})
if (projection.source.sha256 !== rawSha256) throw new Error('Phoenix source SHA256 drifted.')

const raw = JSON.parse(readFileSync(join(frozenRoot, 'nanoka/3.3/zh/character/1641.json')))
// IDs and action groups are reviewed against both description and parameter sections.
// The index identifies a source aggregate/alternative, never an individual combat hit.
const bindings = [
  ['1641001', 'BasicAttackLifeJudgment', 0, 'basic', '普通攻击：裁生'],
  ['1641002', 'BasicAttackLifeJudgment', 1, 'basic', '普通攻击：裁生'],
  ['1641003', 'BasicAttackLifeJudgment', 2, 'basic', '普通攻击：裁生'],
  ['1641004', 'BasicAttackLifeJudgment', 3, 'basic', '普通攻击：裁生'],
  ['1641005', 'BasicAttackPurifyingFlame', 0, 'basic', '普通攻击：焚罪'],
  ['1641006', 'BasicAttackMeltdown', 0, 'basic', '普通攻击：熔毁'],
  ['1641007', 'SpecialAttackFireSnatch', 0, 'special', '特殊技：掠火'],
  ['1641023', 'EXSpecialAttackSearingSlash', 0, 'exSpecial', '强化特殊技：燎斩'],
  ['1641008', 'EXSpecialAttackDazzlingFlame', 0, 'exSpecial', '强化特殊技：眩焰'],
  ['1641009', 'EXSpecialAttackFallingSun', 0, 'exSpecial', '强化特殊技：坠阳'],
  ['1641010', 'DashAttackLeaningIn', 0, 'dash', '冲刺攻击：倾身'],
  ['1641011', 'DodgeCounterTwiceThroughFlame', 0, 'dodgeCounter', '闪避反击：业火两渡'],
  ['1641012', 'ChainAttackLifeFromDespair', 0, 'chain', '连携技：绝处逢生'],
  ['1641013', 'UltimateRebirth', 0, 'ultimate', '终结技：万死重明'],
  ['1641019', 'UltimateSoulSearchingBlaze', 0, 'ultimate', '烬火追魂'],
  ['1641014', 'QuickAssistFirstAid', 0, 'quickAssist', '快速支援：急救'],
  ['1641015', 'DefensiveAssistSeasonedMedic', 0, 'defensiveAssist', '招架支援：久病成医'],
  ['1641016', 'DefensiveAssistSeasonedMedic', 1, 'defensiveAssist', '招架支援：久病成医'],
  ['1641017', 'DefensiveAssistSeasonedMedic', 2, 'defensiveAssist', '招架支援：久病成医'],
  ['1641018', 'AssistFollowUpRegenerativeTherapy', 0, 'assistFollowUp', '支援突击：再生疗法'],
]
const bindingById = new Map(bindings.map((row) => [row[0], row]))
if (projection.eventContract.events.length !== bindings.length)
  throw new Error('Phoenix event population drifted; review action bindings.')
const events = projection.eventContract.events.map((event) => {
  const binding = bindingById.get(event.sourceSkillId)
  if (!binding) throw new Error(`Unreviewed Phoenix skill ID: ${event.sourceSkillId}`)
  const [, actionId, hitIndex, damageType, sourceName] = binding
  const descriptions = raw.skill[event.skill].description
  const description = descriptions.find((entry) => entry.name === sourceName && entry.desc)
  const parameters = descriptions.find((entry) => entry.name === sourceName && entry.param)
  if (!description || !parameters?.param.some((p) => event.sourceSkillId in (p.param ?? {})))
    throw new Error(`Phoenix action/description binding drifted: ${sourceName}`)
  const defensive = damageType === 'defensiveAssist'
  if (!defensive && !description.desc.includes('火属性伤害'))
    throw new Error(`Phoenix damage attribute needs review: ${sourceName}`)
  const requiredState =
    {
      1641005: 'fan_flame_at_least_90',
      1641006: 'special_without_perfect_parry',
      1641023: 'promotion_at_least_1',
      1641008: 'energy_at_least_40',
      1641009: 'dazzling_flame_then_energy_at_least_40',
      1641010: 'after_dodge',
      1641011: 'perfect_dodge_counter_available',
      1641012: 'chain_trigger_available',
      1641013: 'ultimate_decibels_ready',
      1641014: 'quick_assist_trigger_available',
      1641015: 'incoming_light_parry',
      1641016: 'incoming_heavy_parry',
      1641017: 'incoming_chain_parry',
      1641018: 'after_defensive_assist',
      1641019: 'life_depleted_then_reentry',
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
    attribute: defensive ? 'physical' : 'fire',
    eventModifierRefs: [],
  }
})
const eventSha256 = createHash('sha256').update(JSON.stringify(events)).digest('hex').toUpperCase()

const artifact = {
  schema: 'soda-current-agent-event-overlay/v1',
  gameVersion: '3.3',
  agentId: 'agent-phoenix',
  stableId: 'agent-phoenix',
  externalId: '1641',
  upstreamKey: 'Phoenix',
  identity: {
    rarity: 'S',
    attribute: 'fire',
    specialty: 'anomaly',
    faction: 'KrampusComplianceAuthority',
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
        { kind: 'specialty', value: 'anomaly' },
        { kind: 'faction', value: 'KrampusComplianceAuthority' },
      ],
      minimum: 3,
      dynamicTerms: [],
      evaluationBoundary: 'base_mindscape_static_team_identity',
      locator: '1641.json#passive.level.1641501.desc[1]',
      normalizedFrom: 'active_at_minimum',
    },
  },
  source: {
    repository: 'https://static.nanoka.cc',
    commit: `sha256:${rawSha256}`,
    license: 'redistribution_not_confirmed',
    statsPath: 'nanoka/3.3/zh/character/1641.json',
    statsSha256: rawSha256.toUpperCase(),
    formulaPath: 'nanoka/3.3/zh/character/1641.json#skill.*.param',
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
    'Conditional passives, abloom, resource transitions, complete rotation and exact DPS remain outside this contract.',
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
