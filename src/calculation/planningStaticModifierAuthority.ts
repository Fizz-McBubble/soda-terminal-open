import { stableContentHash } from '../gameDataPacks/types'

export const planningStaticModifierSource = Object.freeze({
  repository: 'frzyc/genshin-optimizer',
  commit: 'eabba1f092b282cccb3f028b7253a1db3dac5208',
  license: 'MIT',
  evidenceRefs: [
    'GO:disc.ts:sha256:632854B9B940A1A90477F954BAF1F8970AC5F34ED9FE0C0D96B37AC21A4EE77A',
    'GO:disc.test.ts:sha256:BD1AD5EA5CC9493626AE51EE8A6381F15A345BC06823A535F822B86EFBBCA052',
  ],
})

export type PlanningStaticModifier =
  | { kind: 'panel_percent'; key: 'hp' | 'atk' | 'energyRegen'; value: number }
  | {
      kind: 'panel_additive'
      key: 'critRate' | 'critDamage' | 'anomalyProficiency' | 'penRatio'
      value: number
    }
  | { kind: 'damage_bonus'; damageType: 'physical' | 'fire'; value: number }

/**
 * Model-grade 2-piece subset needed by Billy's current build guidance.
 * Values use panel percentage points so they can be shared with the existing
 * out-of-combat projection without introducing a second unit convention.
 */
export const planningStaticTwoPieceModifiers = Object.freeze({
  'set-astral-voice': { kind: 'panel_percent', key: 'atk', value: 10 },
  'set-branch-blade-song': { kind: 'panel_additive', key: 'critDamage', value: 16 },
  'set-chaos-jazz': { kind: 'panel_additive', key: 'anomalyProficiency', value: 30 },
  'set-fanged-metal': { kind: 'damage_bonus', damageType: 'physical', value: 10 },
  'set-freedom-blues': { kind: 'panel_additive', key: 'anomalyProficiency', value: 30 },
  'set-hormone-punk': { kind: 'panel_percent', key: 'atk', value: 10 },
  'set-inferno-metal': { kind: 'damage_bonus', damageType: 'fire', value: 10 },
  'set-puffer-electro': { kind: 'panel_additive', key: 'penRatio', value: 8 },
  'set-woodpecker-electro': { kind: 'panel_additive', key: 'critRate', value: 8 },
  'set-yunkui-tales': { kind: 'panel_percent', key: 'hp', value: 10 },
} satisfies Record<string, PlanningStaticModifier>)

/** Roster core levels 2–7 map to the six locked upstream core tiers A–F. */
export const billyCrouchingShotDamageBonusByRosterCoreLevel = Object.freeze({
  2: 25,
  3: 29.1,
  4: 33.3,
  5: 37.5,
  6: 41.6,
  7: 45.8,
} as const)

const authorityCore = {
  schema: 'soda-planning-static-modifier-authority/v1',
  gameVersion: '3.1',
  source: planningStaticModifierSource,
  twoPieceModifiers: planningStaticTwoPieceModifiers,
  billy: {
    actionId: 'BasicAttackFullFirepower',
    coreDamageBonusByRosterCoreLevel: billyCrouchingShotDamageBonusByRosterCoreLevel,
    mindscapeSixDamageBonusPerStack: 6,
    mindscapeSixMaxStacks: 5,
    streetSuperstarApplicability: 'ultimate_only_not_basic',
    evidenceRefs: [
      'GO:Billy.ts:sha256:91202DCC7AAE626B739B6657EA903BF83C9C9FFBE353F0442C2D01B3F1FF240E',
      'GO:Billy.json:sha256:EC555A3E843C3145A2374551D649843792B2EBE46ABDAE8104958E439CE478B2',
      'GO:StreetSuperstar.ts:sha256:900E24C9254E44474F74F7805354CD8FE79C1CD9C5DAB43F0C71F62A8C3AD1F2',
    ],
  },
  nekomata: {
    actionId: 'BasicAttackKittySlash',
    coreDamageBonusByRosterCoreLevel: { 2: 30, 3: 35, 4: 40, 5: 45, 6: 50, 7: 55 },
    mindscapeOnePhysicalResistanceIgnore: 16,
    mindscapeFourCritRatePerStack: 7,
    mindscapeFourMaxStacks: 2,
    mindscapeSixCritDamagePerStack: 18,
    mindscapeSixMaxStacks: 3,
    steelCushionPhysicalDamageByRefinement: { 1: 20, 2: 25, 3: 30, 4: 35, 5: 40 },
    steelCushionBehindDamageByRefinement: { 1: 25, 2: 31.5, 3: 38, 4: 44, 5: 50 },
    evidenceRefs: [
      'GO:Nekomata.ts:sha256:C411CB4139307402CDCC0F39C9B5E41E0A76E1BA3F88E0F1746DB454B807D5D9',
      'GO:Nekomata.json:sha256:ECEA79B87E044463E5DBF7E818D09ACD0256E0E906EE1DAB266F862D8BC43AD4',
      'GO:SteelCushion.ts:sha256:39360E37B6A70E8422CC1EBF6AFB907F139ADC18DD79944EC757ED0F17E94E0D',
      'GO:SteelCushion.json:sha256:6DDF03C26CB8301A6B52279DC89F210D897889172D2619BB7214498B804FF84E',
    ],
  },
  manato: {
    actionId: 'BasicAttackBlazingWindMistySlash',
    hpToSheerForceRatio: 0.1,
    coreBasicCritDamageByRosterCoreLevel: { 2: 25, 3: 29.2, 4: 33.3, 5: 37.5, 6: 41.7, 7: 45.8 },
    coreMoltenEdgeCritRate: 10,
    coreMoltenEdgeFireDamageByRosterCoreLevel: { 2: 10, 3: 11.7, 4: 13.3, 5: 15, 6: 16.7, 7: 20 },
    grillOWispFireDamageByRefinement: { 1: 15, 2: 17.25, 3: 19.5, 4: 21.75, 5: 24 },
    grillOWispCritRateByRefinement: { 1: 15, 2: 17.25, 3: 19.5, 4: 21.75, 5: 24 },
    yunkuiFourPieceCritRatePerStack: 4,
    yunkuiFourPieceMaxStacks: 3,
    yunkuiFourPieceSheerDamageAtMaxStacks: 10,
    evidenceRefs: [
      'GO:Manato.ts:sha256:E78424D27BF2028F7DBBE1C38C6B18E484585F5899E7C4C8E9992041158860E3',
      'GO:Manato.json:sha256:67C95DFAE577349430D862A7E7D3EFC6EE2AA1E89CFA6B0E82EF36222C220DDE',
      'GO:GrillOWisp.ts:sha256:921B078D343F97165F1458D111127175F9EFEB26A8E85B39047AC5952C72BB9D',
      'GO:GrillOWisp.json:sha256:3DDC71F5F846071F3B1325BC31B613286DD1AA6555E0F750891538F8F38B961D',
    ],
  },
  piper: {
    settlementId: 'physical-anomaly-single-owner',
    rainforestAttackPercentPerStackByRefinement: {
      1: 2.5,
      2: 2.8,
      3: 3.2,
      4: 3.6,
      5: 4,
    },
    rainforestMaxStacks: 10,
    evidenceRefs: [
      'GO:Piper.ts:sha256:8CCE9CDB49198E028624842D97FF7970AB4F075299D123C21E2EA7DE1D11BA52',
      'GO:Piper.json:sha256:459C94D7F1D3BD379D9ECFD01C7B42E3C3E0DED2C1EB1045ED3F5D782E3F8B22',
      'GO:RainforestGourmet.ts:sha256:C8E35555D6E447AB7E60FD239AC1CF5CA2D18A8F913DDEB98C8F8257648320BF',
      'GO:RainforestGourmet.json:sha256:3C901F336FA3BF029EB3422B32BD8C1315889C532A67277DB32D27E286ED0E61',
    ],
  },
  boundary:
    'Only listed static two-piece fields and named Billy/Nekomata/Manato/Piper event modifiers are Formal; active four-piece effects remain condition-gated.',
} as const

export const planningStaticModifierAuthority = Object.freeze({
  ...authorityCore,
  contentHash: stableContentHash(authorityCore),
})
