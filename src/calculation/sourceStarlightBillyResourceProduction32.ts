const releasePageUrl =
  'https://zzz.gachabase.net/agents/1531/starlight-billy/release/3.2.0/19159270?lang=en'
const releasePageSha256 = '8B00742400EB69462FC15D6F62A2028F657CEC33DD61D242405910515B6AB552'
const guideUrl =
  'https://mobalytics.gg/zzz/builds/starlight-billy-build-guide#determination-build-values'

type StarlightBillyResourceRule32 = {
  eventKey: string
  resource: 'determination' | 'adrenaline'
  operation: 'add' | 'add_per_unit' | 'consume'
  amount: number | null
  unit: 'guide_reported_determination_points' | 'resource_points'
  quantityUnit?: 'effective_seconds'
  conditionKeys: string[]
  cooldownSeconds?: number
  locator: string
  sourceRef?: string
}

type StarlightBillyResourceProductionContract32 = {
  agentId: 'agent-starlight-billy'
  source: {
    commit: string
    path: string
    sha256: string
  }
  rules: StarlightBillyResourceRule32[]
  resourceStates: Array<{
    resource: 'determination'
    unit: 'determination_points'
    minimum: number
    maximum: number
    locator: string
  }>
  nonResourceStates: string[]
  unresolved: string[]
  metadata: {
    gameVersion: string
    gachabaseDesignRevision: number
    gachabaseResourceRevision: number
    gachabasePageUrl: string
    gachabasePageSha256: string
    guideUrl: string
    guideUpdatedAt: string
    observationDate: string
  }
  boundary: string
}

const guideRef = (row: string) => `${guideUrl}:${row}`
const releaseRef = (rawId: number) =>
  `${releasePageUrl}#htmlSha256=${releasePageSha256}:skill_data[id=${rawId}].attack_data[0]`

export const reviewedStarlightBillyResourceProductionContract32: StarlightBillyResourceProductionContract32 =
  {
    agentId: 'agent-starlight-billy',
    source: {
      commit: '3456cd0f6f5bea10e168074502460dac2fcd6df4',
      path: 'libs/zzz/dm-localization/assets/locales/en/char_StarlightBilly_gen.json',
      sha256: '6D1551380D231BF44916757F82FB55D725D600702E70E29743BB3AFEDE29756A',
    },
    rules: [
      {
        eventKey: 'basic.BasicAttackKnightsTechnique.hit-0',
        resource: 'determination',
        operation: 'add',
        amount: 1.9,
        unit: 'guide_reported_determination_points',
        conditionKeys: [],
        locator: "Basic Attack: Knight's Technique / 1st hit",
        sourceRef: `${guideRef('knight-technique-hit-1')}|${releaseRef(1531001)}`,
      },
      {
        eventKey: 'basic.BasicAttackKnightsTechnique.hit-1',
        resource: 'determination',
        operation: 'add',
        amount: 2.2,
        unit: 'guide_reported_determination_points',
        conditionKeys: [],
        locator: "Basic Attack: Knight's Technique / 2nd hit",
        sourceRef: `${guideRef('knight-technique-hit-2')}|${releaseRef(1531002)}`,
      },
      {
        eventKey: 'basic.BasicAttackKnightsTechnique.hit-2',
        resource: 'determination',
        operation: 'add',
        amount: 1.4,
        unit: 'guide_reported_determination_points',
        conditionKeys: [],
        locator: "Basic Attack: Knight's Technique / 3rd hit",
        sourceRef: `${guideRef('knight-technique-hit-3')}|${releaseRef(1531003)}`,
      },
      {
        eventKey: 'basic.BasicAttackKnightsTechnique.hit-3',
        resource: 'determination',
        operation: 'add',
        amount: 5.6,
        unit: 'guide_reported_determination_points',
        conditionKeys: [],
        locator: "Basic Attack: Knight's Technique / 4th hit",
        sourceRef: `${guideRef('knight-technique-hit-4')}|${releaseRef(1531004)}`,
      },
      {
        eventKey: 'dodge.DashAttackStarlightRetribution.hit-0',
        resource: 'determination',
        operation: 'add',
        amount: 0.8,
        unit: 'guide_reported_determination_points',
        conditionKeys: [],
        locator: 'Dash Attack: Starlight Retribution',
        sourceRef: guideRef('dash-starlight-retribution'),
      },
      {
        eventKey: 'dodge.DodgeCounterDuelKing.hit-0',
        resource: 'determination',
        operation: 'add',
        amount: 3.5,
        unit: 'guide_reported_determination_points',
        conditionKeys: [],
        locator: 'Dodge Counter: Duel King',
        sourceRef: guideRef('dodge-counter-duel-king'),
      },
      {
        eventKey: 'dodge.DodgeCounterAfterfireSpin.hit-0',
        resource: 'determination',
        operation: 'add',
        amount: 2.8,
        unit: 'guide_reported_determination_points',
        conditionKeys: [],
        locator: 'Dodge Counter: Afterfire Spin',
        sourceRef: guideRef('dodge-counter-afterfire-spin'),
      },
      {
        eventKey: 'perfect_dodge',
        resource: 'determination',
        operation: 'add',
        amount: 3,
        unit: 'guide_reported_determination_points',
        conditionKeys: [],
        cooldownSeconds: 0.5,
        locator: 'Any Perfect Dodge',
        sourceRef: guideRef('any-perfect-dodge'),
      },
      {
        eventKey: 'assist.QuickAssistStarlightPowerOfBonds.hit-0',
        resource: 'determination',
        operation: 'add',
        amount: 1.7,
        unit: 'guide_reported_determination_points',
        conditionKeys: [],
        locator: 'Quick Assist: Starlight - Power of Bonds',
        sourceRef: guideRef('quick-assist'),
      },
      {
        eventKey: 'defensive_assist_light',
        resource: 'determination',
        operation: 'add',
        amount: 2.6,
        unit: 'guide_reported_determination_points',
        conditionKeys: [],
        locator: "Defensive Assist: Hero's Entrance / Light",
        sourceRef: guideRef('defensive-assist-light'),
      },
      {
        eventKey: 'defensive_assist_heavy_chain',
        resource: 'determination',
        operation: 'add',
        amount: 4.6,
        unit: 'guide_reported_determination_points',
        conditionKeys: [],
        locator: "Defensive Assist: Hero's Entrance / Heavy or Chain parry",
        sourceRef: guideRef('defensive-assist-heavy-chain'),
      },
      {
        eventKey: 'assist.AssistFollowUpVillainsExit.hit-0',
        resource: 'determination',
        operation: 'add',
        amount: 3.1,
        unit: 'guide_reported_determination_points',
        conditionKeys: [],
        locator: "Assist Follow-Up: Villain's Exit",
        sourceRef: guideRef('assist-follow-up'),
      },
      {
        eventKey: 'drive_suppression_activation',
        resource: 'determination',
        operation: 'add',
        amount: 4,
        unit: 'guide_reported_determination_points',
        conditionKeys: [],
        locator: 'Special Attack: Drive Suppression',
        sourceRef: guideRef('special-drive-suppression'),
      },
      {
        eventKey: 'drive_suppression_counter',
        resource: 'determination',
        operation: 'add',
        amount: 5,
        unit: 'guide_reported_determination_points',
        conditionKeys: [],
        locator: 'Special Attack: Drive Suppression / counter',
        sourceRef: guideRef('special-drive-suppression-counter'),
      },
      {
        eventKey: 'special.SpecialAttackRunWild.hit-0',
        resource: 'determination',
        operation: 'add',
        amount: 2.1,
        unit: 'guide_reported_determination_points',
        conditionKeys: [],
        locator: 'Special Attack: Run Wild',
        sourceRef: guideRef('special-run-wild'),
      },
      {
        eventKey: 'special.EXSpecialAttackCoolWheelie.hit-0',
        resource: 'determination',
        operation: 'add',
        amount: 10,
        unit: 'guide_reported_determination_points',
        conditionKeys: [],
        locator: 'EX Special Attack: Cool Wheelie / 2 base + 8 additional',
        sourceRef: guideRef('ex-cool-wheelie'),
      },
      {
        eventKey: 'special.EXSpecialAttackHighTractionWheels.hit-0',
        resource: 'determination',
        operation: 'add',
        amount: 8.4,
        unit: 'guide_reported_determination_points',
        conditionKeys: [],
        locator: 'EX Special Attack: High-Traction Wheels',
        sourceRef: guideRef('ex-high-traction-wheels'),
      },
      {
        eventKey: 'special.EXSpecialAttackRockingFootwork.hit-0',
        resource: 'determination',
        operation: 'add',
        amount: 9.2,
        unit: 'guide_reported_determination_points',
        conditionKeys: [],
        locator: 'EX Special Attack: Rocking Footwork',
        sourceRef: guideRef('ex-rocking-footwork'),
      },
      {
        eventKey: 'chain.ChainAttackKnightsSwagger.hit-0',
        resource: 'determination',
        operation: 'add',
        amount: 4.5,
        unit: 'guide_reported_determination_points',
        conditionKeys: [],
        locator: "Chain Attack: Knight's Swagger / hit component",
        sourceRef: guideRef('chain-attack-hit-component'),
      },
      {
        eventKey: 'chain_activation',
        resource: 'determination',
        operation: 'add',
        amount: 15,
        unit: 'guide_reported_determination_points',
        conditionKeys: [],
        locator: "Chain Attack: Knight's Swagger / activation component",
        sourceRef: guideRef('chain-attack-activation-component'),
      },
      {
        eventKey: 'chain.UltimateStarlightKnightFlyingKick.hit-0',
        resource: 'determination',
        operation: 'add',
        amount: 6.3,
        unit: 'guide_reported_determination_points',
        conditionKeys: [],
        locator: 'Ultimate: Starlight Knight Flying Kick',
        sourceRef: guideRef('ultimate'),
      },
      {
        eventKey: 'active_combat_clock',
        resource: 'determination',
        operation: 'add_per_unit',
        amount: 2,
        unit: 'guide_reported_determination_points',
        quantityUnit: 'effective_seconds',
        conditionKeys: ['in_combat'],
        locator: 'Passive Regen Rate / 0.2 every 0.1s',
        sourceRef: guideRef('passive-regeneration'),
      },
      {
        eventKey: 'full_throttle_activation',
        resource: 'determination',
        operation: 'consume',
        amount: 100,
        unit: 'guide_reported_determination_points',
        conditionKeys: ['at_least_100_determination'],
        locator: 'Basic Attack: Full-Throttle Starlight / cost',
        sourceRef: guideRef('full-throttle-cost'),
      },
      {
        eventKey: 'battlefield_entry',
        resource: 'adrenaline',
        operation: 'add',
        amount: 60,
        unit: 'resource_points',
        conditionKeys: ['entry_grant_cooldown_ready'],
        locator: 'core.desc.6.1',
      },
    ],
    resourceStates: [
      {
        resource: 'determination',
        unit: 'determination_points',
        minimum: 0,
        maximum: 120,
        locator: 'core.desc.6.3',
      },
    ],
    nonResourceStates: [],
    unresolved: [
      'Determination values are guide-reported and release-action corroborated at one-decimal precision; exact client fractional values are not claimed.',
      'Initial Determination, encounter timing and the full attack sequence remain explicit inputs.',
      'The Lost Void Stunt Show 10 Determination per second modifier remains separate from the ordinary passive rate.',
    ],
    metadata: {
      gameVersion: '3.2.0',
      gachabaseDesignRevision: 19159270,
      gachabaseResourceRevision: 19159270,
      gachabasePageUrl: releasePageUrl,
      gachabasePageSha256: releasePageSha256,
      guideUrl,
      guideUpdatedAt: '2026-09-25',
      observationDate: '2026-10-18',
    },
    boundary:
      'Source-reported attack grants, passive regeneration and the 100-point cost. Initial state, effective timing, receipt/overflow ordering and a complete cycle remain declared inputs.',
  }
