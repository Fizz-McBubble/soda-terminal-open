const pageUrl = 'https://zzz.gachabase.net/agents/1261/jane/release/3.2.0/18761130?lang=en'
const pageSha256 = '4AFE84BC8F38684A673989216B84961E004F3E4B28285718391C08734B42D1A8'
const rawSourceCommit = '462563ec0f8ffc7493f6e2a46f64f8b34ea2d547'
const rawSourceUrl = `https://git.mero.moe/dimbreath/ZenlessData/src/commit/${rawSourceCommit}`
const abilityConfigSha256 = '0D620AD57A9286FD335A7301FA9E0E947F0E2BA886A163A3A765136304A9DFD8'
const enhanceLevelManageSha256 = 'D23AD2F148B2F8A2700EF8DEE5ED48B3FE4731C6B7CC6213D11672F81A6F6125'
const pointDivisor = 10000

type JaneResourceRule32 = {
  eventKey: string
  resource: 'passion_stream'
  operation: 'add' | 'consume' | 'set_to_cap'
  amount: number | null
  unit: 'release_displayed_passion_points' | 'source_defined_full_gauge'
  conditionKeys: string[]
  locator: string
  sourceRef?: string
}

type JaneActionResourceRow32 = {
  eventKey: string
  rawId: number
  normalGainRaw: number
  passionCostRaw: number
  locator: string
}

type JaneResourceProductionContract32 = {
  agentId: 'agent-jane'
  source: {
    commit: string
    path: string
    sha256: string
  }
  rules: JaneResourceRule32[]
  resourceStates?: Array<{
    resource: 'passion_stream'
    unit: 'release_displayed_passion_points'
    minimum: number
    maximum: number
    locator: string
  }>
  nonResourceStates: string[]
  unresolved: string[]
  metadata: {
    gameVersion: string
    designRevision: number
    resourceRevision: number
    pageUrl: string
    pageSha256: string
    rawToDisplayedPointDivisor: number
    observationDate: string
    rawSource: {
      repository: string
      commit: string
      files: Array<{
        path: string
        sha256: string
        locator: string
      }>
    }
    mindscapeTwoReplacement: {
      perfectDodge: number
      defensiveAssist: number
      appliedToBaseline: false
      locator: string
    }
  }
  boundary: string
}

const actionRows: readonly JaneActionResourceRow32[] = [
  {
    eventKey: 'basic.BasicAttackDancingBlades.hit-0',
    rawId: 1261001,
    normalGainRaw: 41695,
    passionCostRaw: 33356,
    locator: 'Basic Attack: Dancing Blades / 1st hit',
  },
  {
    eventKey: 'basic.BasicAttackDancingBlades.hit-1',
    rawId: 1261002,
    normalGainRaw: 66493,
    passionCostRaw: 53194,
    locator: 'Basic Attack: Dancing Blades / 2nd hit',
  },
  {
    eventKey: 'basic.BasicAttackDancingBlades.hit-2',
    rawId: 1261003,
    normalGainRaw: 82623,
    passionCostRaw: 66098,
    locator: 'Basic Attack: Dancing Blades / 3rd hit',
  },
  {
    eventKey: 'basic.BasicAttackDancingBlades.hit-3',
    rawId: 1261004,
    normalGainRaw: 155541,
    passionCostRaw: 124433,
    locator: 'Basic Attack: Dancing Blades / 4th hit',
  },
  {
    eventKey: 'basic.BasicAttackDancingBlades.hit-4',
    rawId: 1261005,
    normalGainRaw: 80264,
    passionCostRaw: 64211,
    locator: 'Basic Attack: Dancing Blades / 5th hit',
  },
  {
    eventKey: 'basic.BasicAttackDancingBlades.hit-5',
    rawId: 1261006,
    normalGainRaw: 251293,
    passionCostRaw: 201034,
    locator: 'Basic Attack: Dancing Blades / 6th hit',
  },
  {
    eventKey: 'basic.BasicAttackSalchowJump.hit-0',
    rawId: 1261007,
    normalGainRaw: 249960,
    passionCostRaw: 249960,
    locator: 'Basic Attack: Salchow Jump / first hit',
  },
  {
    eventKey: 'basic.BasicAttackSalchowJump.hit-1',
    rawId: 1261030,
    normalGainRaw: 352000,
    passionCostRaw: 352000,
    locator: 'Basic Attack: Salchow Jump / finishing move',
  },
  {
    eventKey: 'dodge.DashAttackEdgeJump.hit-0',
    rawId: 1261011,
    normalGainRaw: 97500,
    passionCostRaw: 0,
    locator: 'Dash Attack: Edge Jump / 1st hit',
  },
  {
    eventKey: 'dodge.DashAttackEdgeJump.hit-1',
    rawId: 1261012,
    normalGainRaw: 97500,
    passionCostRaw: 0,
    locator: 'Dash Attack: Edge Jump / 2nd hit',
  },
  {
    eventKey: 'dodge.DashAttackPhantomThrust.hit-0',
    rawId: 1261013,
    normalGainRaw: 0,
    passionCostRaw: 113961,
    locator: 'Dash Attack: Phantom Thrust',
  },
  {
    eventKey: 'dodge.DodgeCounterSwiftShadow.hit-0',
    rawId: 1261014,
    normalGainRaw: 54167,
    passionCostRaw: 0,
    locator: 'Dodge Counter: Swift Shadow / 1st hit',
  },
  {
    eventKey: 'dodge.DodgeCounterSwiftShadow.hit-1',
    rawId: 1261015,
    normalGainRaw: 54167,
    passionCostRaw: 0,
    locator: 'Dodge Counter: Swift Shadow / 2nd hit',
  },
  {
    eventKey: 'dodge.DodgeCounterSwiftShadowDance.hit-0',
    rawId: 1261016,
    normalGainRaw: 0,
    passionCostRaw: 100000,
    locator: 'Dodge Counter: Swift Shadow Dance',
  },
  {
    eventKey: 'special.SpecialAttackAerialSweep.hit-0',
    rawId: 1261009,
    normalGainRaw: 78750,
    passionCostRaw: 126000,
    locator: 'Special Attack: Aerial Sweep',
  },
  {
    eventKey: 'special.EXSpecialAttackAerialSweepClearout.hit-0',
    rawId: 1261010,
    normalGainRaw: 425544,
    passionCostRaw: 212772,
    locator: 'EX Special Attack: Aerial Sweep - Clearout',
  },
  {
    eventKey: 'special.EXSpecialAttackAerialSweepOnslaught.hit-0',
    rawId: 1261024,
    normalGainRaw: 407686,
    passionCostRaw: 173961,
    locator: 'EX Special Attack: Aerial Sweep - Onslaught',
  },
  {
    eventKey: 'assist.QuickAssistDarkThorn.hit-0',
    rawId: 1261019,
    normalGainRaw: 158334,
    passionCostRaw: 0,
    locator: 'Quick Assist: Dark Thorn',
  },
  {
    eventKey: 'assist.QuickAssistLutzJump.hit-0',
    rawId: 1261020,
    normalGainRaw: 0,
    passionCostRaw: 149960,
    locator: 'Quick Assist: Lutz Jump',
  },
  {
    eventKey: 'assist.AssistFollowUpGaleSweep.hit-0',
    rawId: 1261008,
    normalGainRaw: 134000,
    passionCostRaw: 134000,
    locator: 'Assist Follow-Up: Gale Sweep',
  },
]

function sourceRef(rawId: number, index: 0 | 1) {
  return `${pageUrl}#htmlSha256=${pageSha256}:skill_data[id=${rawId}].attack_data[${index}]`
}

function rawRef(path: string, sha256: string, locator: string) {
  return `${rawSourceUrl}/${path}#sha256=${sha256}:${locator}`
}

function actionRules(row: JaneActionResourceRow32): JaneResourceRule32[] {
  const rules: JaneResourceRule32[] = []
  if (row.normalGainRaw > 0) {
    rules.push({
      eventKey: row.eventKey,
      resource: 'passion_stream',
      operation: 'add',
      amount: row.normalGainRaw / pointDivisor,
      unit: 'release_displayed_passion_points',
      conditionKeys: ['passion_stream_normal_state'],
      locator: `${row.locator}:attack_data[0]`,
      sourceRef: sourceRef(row.rawId, 0),
    })
  }
  if (row.passionCostRaw > 0) {
    rules.push({
      eventKey: row.eventKey,
      resource: 'passion_stream',
      operation: 'consume',
      amount: row.passionCostRaw / pointDivisor,
      unit: 'release_displayed_passion_points',
      conditionKeys: ['passion_stream_active'],
      locator: `${row.locator}:attack_data[1]`,
      sourceRef: sourceRef(row.rawId, 1),
    })
  }
  return rules
}

/**
 * Current 3.2 release action_data for Jane's Passion Stream. The site stores
 * displayed points scaled by 10,000. The current client's EnhanceLevelManage
 * ability supplies the 100-point cap and the combat recovery amounts.
 */
export const reviewedJaneResourceProductionContract32: JaneResourceProductionContract32 = {
  agentId: 'agent-jane',
  source: {
    commit: '3456cd0f6f5bea10e168074502460dac2fcd6df4',
    path: 'libs/zzz/dm-localization/assets/locales/en/char_Jane_gen.json',
    sha256: 'CA43022212633181D9B04C66BB8A94F713D123DFD7B74451ACCBEF1F50624911',
  },
  rules: [
    ...actionRows.flatMap(actionRules),
    {
      eventKey: 'chain_activation',
      resource: 'passion_stream',
      operation: 'set_to_cap',
      amount: null,
      unit: 'source_defined_full_gauge',
      conditionKeys: [],
      locator: 'chain.ChainAttackFlowersOfSin.desc.2',
    },
    {
      eventKey: 'ultimate_activation',
      resource: 'passion_stream',
      operation: 'set_to_cap',
      amount: null,
      unit: 'source_defined_full_gauge',
      conditionKeys: [],
      locator: 'chain.UltimateFinalCurtain.desc.2',
    },
    {
      eventKey: 'chain_activation',
      resource: 'passion_stream',
      operation: 'consume',
      amount: 35,
      unit: 'release_displayed_passion_points',
      conditionKeys: [],
      locator: 'Chain Attack: Flowers of Sin:attack_data[1]',
      sourceRef: sourceRef(1261017, 1),
    },
    {
      eventKey: 'ultimate_activation',
      resource: 'passion_stream',
      operation: 'consume',
      amount: 35,
      unit: 'release_displayed_passion_points',
      conditionKeys: [],
      locator: 'Ultimate: Final Curtain:attack_data[1]',
      sourceRef: sourceRef(1261018, 1),
    },
    {
      eventKey: 'perfect_dodge',
      resource: 'passion_stream',
      operation: 'add',
      amount: 20,
      unit: 'release_displayed_passion_points',
      conditionKeys: [],
      locator: 'AbilityConfigTemplateTb row id=11261001 AS_EvadeRecoverAmount',
      sourceRef: rawRef(
        'FileCfg/AbilityConfigTemplateTb.json',
        abilityConfigSha256,
        'OFGELKMDKKB=11261001.DEDJOCOIEDK=AS_EvadeRecoverAmount:20',
      ),
    },
    {
      eventKey: 'defensive_assist_activation',
      resource: 'passion_stream',
      operation: 'add',
      amount: 30,
      unit: 'release_displayed_passion_points',
      conditionKeys: [],
      locator: 'AbilityConfigTemplateTb row id=11261001 AS_ParryRecoverAmount',
      sourceRef: rawRef(
        'FileCfg/AbilityConfigTemplateTb.json',
        abilityConfigSha256,
        'OFGELKMDKKB=11261001.GACKDGIOIDJ=AS_ParryRecoverAmount:30',
      ),
    },
  ],
  resourceStates: [
    {
      resource: 'passion_stream',
      unit: 'release_displayed_passion_points',
      minimum: 0,
      maximum: 100,
      locator:
        'JaneDoe_EnhanceLevelManage: AbilityMixins[2].PropertyActions[1].ValueRangeActions[0].Val=100; OnAbilityTrigger[1].Amount=100',
    },
  ],
  nonResourceStates: ['passion_attack_bonus'],
  unresolved: [
    'Mindscape 2 replaces the baseline 20 Perfect Dodge and 30 Defensive Assist amounts with 30 and 40; this baseline contract does not infer the player mindscape or apply the replacement.',
  ],
  metadata: {
    gameVersion: '3.2.0',
    designRevision: 18761130,
    resourceRevision: 18779629,
    pageUrl,
    pageSha256,
    rawToDisplayedPointDivisor: pointDivisor,
    observationDate: '2026-10-18',
    rawSource: {
      repository: 'https://git.mero.moe/dimbreath/ZenlessData',
      commit: rawSourceCommit,
      files: [
        {
          path: 'Data/JsonBytes/NewAbility/AvatarAbility/JaneDoeAbility/JaneDoe_EnhanceLevelManage.json',
          sha256: enhanceLevelManageSha256,
          locator:
            'AbilityMixins[2].PropertyActions[1].ValueRangeActions[0].Val=100; OnAbilityTrigger[1].Amount=100',
        },
        {
          path: 'FileCfg/AbilityConfigTemplateTb.json',
          sha256: abilityConfigSha256,
          locator: 'OFGELKMDKKB=11261001 AS_EvadeRecoverAmount=20 AS_ParryRecoverAmount=30',
        },
      ],
    },
    mindscapeTwoReplacement: {
      perfectDodge: 30,
      defensiveAssist: 40,
      appliedToBaseline: false,
      locator:
        'LevelAbilityConfigTemplateTb JaneDoe_CardS3_Base_01_Upgrade_02: AS_EvadeRecoverAmount_New=30, AS_ParryRecoverAmount_New=40',
    },
  },
  boundary:
    'Current release action rows and current-client baseline state/recovery values only. Initial Passion Stream, mindscape-two replacement, receipt ordering and a complete cycle remain explicit inputs or boundaries.',
}
