import type {
  AgentRule,
  BangbooRule,
  CurrentMetaStrengthR1,
  PairSynergyKernel,
  TeamEngineEvidenceRef,
} from './contracts'
import { defineTeamMethodKernel } from './teamMethodR1'

const localGuide = (
  sourceId: string,
  gameVersion: string,
  locator: string,
): TeamEngineEvidenceRef => ({ sourceId, gameVersion, status: 'limited', locator })

const currentGuide = (sourceId: string, locator: string): TeamEngineEvidenceRef => ({
  sourceId,
  gameVersion: '3.1',
  status: 'candidate',
  locator,
})

const billyGuide = localGuide(
  'miyoushe-post-57541339',
  '1.1',
  'Billy additional ability, chain/ultimate loop and Cunning Hares formation; reused as cross-version static mechanics only',
)
const nicoleGuide = localGuide(
  'miyoushe-post-68488252',
  '2.2',
  'Nicole defense shred, Ether amplification, quick assist and Zhu Yuan/Qingyi/Nicole formation',
)
const lucyGuide = localGuide(
  'miyoushe-post-68852865',
  '2.2',
  'Lucy Cheer On team attack buff, quick assist and same-attribute/faction/Rupture predicate',
)
const soukakuGuide = localGuide(
  'miyoushe-post-64658713',
  '1.7',
  'Soukaku Fly the Flag attack transfer, Ice damage buff, quick assist and Ice/faction predicate',
)
const janeGuide = localGuide(
  'miyoushe-post-63855075',
  '1.7',
  'Jane Passion, Assault, Flinch, anomaly accumulation and Jane/Burnice/Lucy disorder formation',
)
const ellenGuide = localGuide(
  'miyoushe-post-65170849',
  '2.0',
  'Ellen Flash Freeze, Ice burst window, current potential predicate and Ellen/Lycaon/Soukaku formation',
)
const billyCurrent = currentGuide(
  'icyveins-billy-team-3.1-2026-07-28',
  'Current 3.1 Cunning Hares team: Billy/Nicole/Anby; Billy is an early-account viable damage option, not a meta claim',
)
const ellenCurrent = currentGuide(
  'hostedgg-ellen-team-3.1-2026-08',
  'Current 3.1 mono-Ice formation: Ellen/Lycaon/Soukaku and stun-window rotation',
)
const janeCurrent = currentGuide(
  'icyveins-jane-potential-3.1-2026-07-27',
  'Current 3.1 Jane Potential update and reliable on-field anomaly role; formation remains source-constrained Candidate',
)
const l3Formation: TeamEngineEvidenceRef = {
  sourceId: 'l3-40356c64ad0d6d5a5e01-teams-modes',
  gameVersion: '3.1',
  status: 'limited',
  locator: 'Source-constrained complete assemblies; formation evidence only',
}

const sameAttributeOrFaction = (attribute: string, faction: string) => ({
  kind: 'any' as const,
  predicates: [
    { kind: 'attribute_count' as const, attribute, minimum: 2 },
    { kind: 'faction_count' as const, faction, minimum: 2 },
  ],
})

export const current31LegacyCoverageAgentRules: AgentRule[] = [
  {
    agentId: 'agent-billy',
    name: '比利',
    releaseState: 'released',
    specialty: 'damage',
    faction: '狡兔屋',
    attribute: 'physical',
    fieldTimeDemand: 0.7,
    produces: ['physical_direct', 'crouching_shot', 'chain_ultimate_stack'],
    consumes: ['stun_window', 'chain_ultimate_stack'],
    effects: [],
    additionalAbility: {
      status: 'modeled',
      predicate: sameAttributeOrFaction('physical', '狡兔屋'),
      description: '需要同属性或同阵营队友，以连携叠层强化终结技。',
    },
    evidence: [billyGuide, billyCurrent],
  },
  {
    agentId: 'agent-anby',
    name: '安比',
    releaseState: 'released',
    specialty: 'stun',
    faction: '狡兔屋',
    attribute: 'electric',
    fieldTimeDemand: 0.45,
    produces: ['stun_window', 'daze'],
    consumes: [],
    effects: [{ tag: 'stun_window', recipient: 'enemy' }],
    additionalAbility: {
      status: 'modeled',
      predicate: sameAttributeOrFaction('electric', '狡兔屋'),
      description: '需要同属性或同阵营队友。',
    },
    evidence: [billyCurrent],
  },
  {
    agentId: 'agent-nicole',
    name: '妮可',
    releaseState: 'released',
    specialty: 'support',
    faction: '狡兔屋',
    attribute: 'ether',
    fieldTimeDemand: 0.15,
    produces: ['defense_shred', 'ether_damage_amp', 'quick_assist'],
    consumes: [],
    effects: [
      { tag: 'defense_shred', recipient: 'enemy' },
      { tag: 'ether_damage_amp', recipient: 'enemy' },
    ],
    additionalAbility: {
      status: 'modeled',
      predicate: sameAttributeOrFaction('ether', '狡兔屋'),
      description: '需要同属性或同阵营队友。',
    },
    evidence: [nicoleGuide, billyCurrent],
  },
  {
    agentId: 'agent-ellen',
    name: '艾莲',
    releaseState: 'released',
    specialty: 'damage',
    faction: '维多利亚家政',
    attribute: 'ice',
    fieldTimeDemand: 0.7,
    produces: ['flash_freeze_charge', 'ice_burst'],
    consumes: ['flash_freeze_charge', 'stun_window'],
    effects: [],
    additionalAbility: {
      status: 'modeled',
      predicate: {
        kind: 'any',
        predicates: [
          { kind: 'attribute_count', attribute: 'ice', minimum: 2 },
          { kind: 'faction_count', faction: '维多利亚家政', minimum: 2 },
        ],
      },
      description: '需要同属性或同阵营队友；开启潜能后也可由击破队友触发。',
    },
    evidence: [ellenGuide, ellenCurrent],
  },
  {
    agentId: 'agent-lycaon',
    name: '莱卡恩',
    releaseState: 'released',
    specialty: 'stun',
    faction: '维多利亚家政',
    attribute: 'ice',
    fieldTimeDemand: 0.45,
    produces: ['stun_window', 'ice_res_shred'],
    consumes: [],
    effects: [
      { tag: 'stun_multiplier', recipient: 'enemy' },
      { tag: 'ice_res_shred', recipient: 'enemy' },
    ],
    additionalAbility: {
      status: 'modeled',
      predicate: sameAttributeOrFaction('ice', '维多利亚家政'),
      description: '需要同属性或同阵营队友；开启潜能后也可由异常队友触发。',
    },
    evidence: [ellenGuide, ellenCurrent],
  },
  {
    agentId: 'agent-soukaku',
    name: '苍角',
    releaseState: 'released',
    specialty: 'support',
    faction: '对空洞特别行动部第六课',
    attribute: 'ice',
    fieldTimeDemand: 0.15,
    produces: ['vortex', 'team_attack', 'ice_damage_amp', 'quick_assist'],
    consumes: ['vortex'],
    effects: [
      { tag: 'team_attack', recipient: 'active_agent' },
      { tag: 'ice_damage_amp', recipient: 'team' },
    ],
    additionalAbility: {
      status: 'modeled',
      predicate: sameAttributeOrFaction('ice', '对空洞特别行动部第六课'),
      description: '需要同属性或同阵营队友。',
    },
    evidence: [soukakuGuide, ellenCurrent],
  },
  {
    agentId: 'agent-jane',
    name: '简',
    releaseState: 'released',
    specialty: 'anomaly',
    faction: '新艾利都治安局',
    attribute: 'physical',
    fieldTimeDemand: 0.7,
    produces: ['passion', 'physical_anomaly', 'assault', 'flinch'],
    consumes: ['passion'],
    effects: [{ tag: 'flinch', recipient: 'enemy' }],
    additionalAbility: {
      status: 'modeled',
      predicate: {
        kind: 'any',
        predicates: [
          { kind: 'specialty_count', specialty: 'anomaly', minimum: 2 },
          { kind: 'faction_count', faction: '新艾利都治安局', minimum: 2 },
        ],
      },
      description: '需要另一名异常或同阵营队友。',
    },
    evidence: [janeGuide, janeCurrent],
  },
  {
    agentId: 'agent-lucy',
    name: '露西',
    releaseState: 'released',
    specialty: 'support',
    faction: '卡吕冬之子',
    attribute: 'fire',
    fieldTimeDemand: 0.15,
    produces: ['team_attack', 'quick_assist', 'guard_boars'],
    consumes: [],
    effects: [{ tag: 'team_attack', recipient: 'team' }],
    additionalAbility: {
      status: 'modeled',
      predicate: {
        kind: 'any',
        predicates: [
          { kind: 'attribute_count', attribute: 'fire', minimum: 2 },
          { kind: 'faction_count', faction: '卡吕冬之子', minimum: 2 },
          { kind: 'specialty_count', specialty: 'rupture', minimum: 1 },
        ],
      },
      description: '需要同属性、同阵营或命破队友。',
    },
    evidence: [lucyGuide, janeGuide],
  },
]

const kernel = (facts: {
  kernelId: string
  familyId: string
  label: string
  coreAgentIds: [string, string]
  eligibleThirdAgentIds: string[]
  predicates: PairSynergyKernel['requiredTeamPredicates']
  producedTags: string[]
  effectTags: string[]
  scenarioTags: string[]
  claim: string
  refs: TeamEngineEvidenceRef[]
}) =>
  defineTeamMethodKernel({
    currentVersion: '3.1',
    identity: { kernelId: facts.kernelId, familyId: facts.familyId, label: facts.label },
    formation: {
      coreAgentIds: facts.coreAgentIds,
      eligibleThirdAgentIds: facts.eligibleThirdAgentIds,
      allowedInactiveAdditionalAbilityAgentIds: [],
    },
    mechanismClosure: {
      requiredTeamPredicates: facts.predicates,
      requiredProducedTags: facts.producedTags,
    },
    effectCoverage: { requiredEffectTags: facts.effectTags },
    scenarios: { scenarioTags: facts.scenarioTags },
    currentStrength: {
      tier: 'current_viable_candidate',
      score: 0,
      claim: facts.claim,
      refs: facts.refs,
    },
  })

export const current31LegacyCoverageKernels: PairSynergyKernel[] = [
  kernel({
    kernelId: 'kernel-3.1-billy-nicole-anby',
    familyId: 'family-billy-cunning-hares-direct',
    label: '比利·妮可狡兔屋直伤核心',
    coreAgentIds: ['agent-billy', 'agent-nicole'],
    eligibleThirdAgentIds: ['agent-anby'],
    predicates: [
      { kind: 'specialty_count', specialty: 'damage', minimum: 1 },
      { kind: 'specialty_count', specialty: 'stun', minimum: 1 },
      { kind: 'specialty_count', specialty: 'support', minimum: 1 },
    ],
    producedTags: ['physical_direct', 'stun_window', 'defense_shred'],
    effectTags: ['stun_window', 'defense_shred'],
    scenarioTags: ['physical_direct', 'crowd_control', 'early_account'],
    claim:
      '当前 3.1 来源仍将比利、妮可、安比列为可执行狡兔屋队；定位为低成本稳定可用，不作高强度结论。',
    refs: [billyGuide, nicoleGuide, billyCurrent],
  }),
  kernel({
    kernelId: 'kernel-3.1-ellen-lycaon-soukaku',
    familyId: 'family-ellen-ice-stun',
    label: '艾莲·莱卡恩冰失衡核心',
    coreAgentIds: ['agent-ellen', 'agent-lycaon'],
    eligibleThirdAgentIds: ['agent-soukaku'],
    predicates: [
      { kind: 'specialty_count', specialty: 'damage', minimum: 1 },
      { kind: 'specialty_count', specialty: 'stun', minimum: 1 },
      { kind: 'specialty_count', specialty: 'support', minimum: 1 },
      { kind: 'attribute_count', attribute: 'ice', minimum: 3 },
    ],
    producedTags: ['ice_burst', 'stun_window', 'team_attack', 'ice_damage_amp'],
    effectTags: ['stun_multiplier', 'ice_res_shred', 'team_attack', 'ice_damage_amp'],
    scenarioTags: ['ice_damage', 'stun_window_burst'],
    claim:
      '艾莲、莱卡恩、苍角仍能形成冰伤、失衡、减抗与展旗增益闭环；当前只列稳定可用，不声称版本最优。',
    refs: [ellenGuide, soukakuGuide, ellenCurrent, l3Formation],
  }),
  kernel({
    kernelId: 'kernel-3.1-jane-burnice-lucy',
    familyId: 'family-jane-disorder',
    label: '简·柏妮思物火紊乱核心',
    coreAgentIds: ['agent-jane', 'agent-burnice'],
    eligibleThirdAgentIds: ['agent-lucy'],
    predicates: [
      { kind: 'specialty_count', specialty: 'anomaly', minimum: 2 },
      { kind: 'specialty_count', specialty: 'support', minimum: 1 },
    ],
    producedTags: ['physical_anomaly', 'fire_anomaly', 'team_attack'],
    effectTags: ['flinch', 'team_attack'],
    scenarioTags: ['physical_fire_disorder', 'sustained_boss'],
    claim:
      '简与柏妮思交替施加物理、火异常，露西补足全队攻击与快速支援；3.1 简已获得潜能更新，但该具体编队仍保持可用 Candidate。',
    refs: [janeGuide, lucyGuide, janeCurrent, l3Formation],
  }),
]

const bangbooEvidence = (sourceId: string, locator: string): TeamEngineEvidenceRef =>
  currentGuide(sourceId, locator)

export const current31LegacyCoverageBangbooRules: BangbooRule[] = [
  {
    bangbooId: 'bangboo-amillion',
    name: '艾米莉安',
    releaseState: 'released',
    activation: {
      status: 'modeled',
      predicate: { kind: 'faction_count', faction: '狡兔屋', minimum: 2 },
      description: '额外能力要求至少两名狡兔屋代理人。',
      evidence: [
        bangbooEvidence(
          'zzz-wiki-amillion-activation',
          'Amillion Street Code: at least two Cunning Hares',
        ),
      ],
    },
    suitability: {
      status: 'modeled',
      familyIds: ['family-billy-cunning-hares-direct'],
      scenarioTags: ['physical_direct', 'early_account'],
      description: '艾米莉安的狡兔屋激活机制与比利直伤 family、队伍组成和效果承接一致。',
      validationEvidence: [billyCurrent],
      evidence: [billyCurrent],
    },
    provenance: [billyCurrent, l3Formation],
    evidence: [billyCurrent, l3Formation],
  },
  {
    bangbooId: 'bangboo-sharkboo',
    name: '鲨牙布',
    releaseState: 'released',
    activation: {
      status: 'modeled',
      predicate: { kind: 'attribute_count', attribute: 'ice', minimum: 2 },
      description: '额外能力要求至少两名冰属性代理人。',
      evidence: [
        bangbooEvidence(
          'hoyolab-bangboo-introduction-30636256',
          'Sharkboo requires two or more Ice agents',
        ),
      ],
    },
    suitability: {
      status: 'modeled',
      familyIds: ['family-ellen-ice-stun'],
      scenarioTags: ['ice_damage', 'stun_window_burst'],
      description: '鲨牙布的双冰激活机制与艾莲冰队 family、失衡窗口效果承接一致。',
      validationEvidence: [ellenCurrent, l3Formation],
      evidence: [ellenCurrent, l3Formation],
    },
    provenance: [ellenCurrent, l3Formation],
    evidence: [ellenCurrent, l3Formation],
  },
  {
    bangbooId: 'bangboo-red-moccus',
    name: '赤红莫库斯',
    releaseState: 'released',
    activation: {
      status: 'modeled',
      predicate: { kind: 'faction_count', faction: '卡吕冬之子', minimum: 2 },
      description: '额外能力要求至少两名卡吕冬之子代理人。',
      evidence: [
        bangbooEvidence(
          'game8-red-moccus-activation-464060',
          'Drifting Technique: at least two Sons of Calydon',
        ),
      ],
    },
    suitability: {
      status: 'modeled',
      familyIds: ['family-jane-disorder'],
      scenarioTags: ['physical_fire_disorder'],
      description: '赤红莫库斯的卡吕冬激活机制与简柏紊乱 family、队伍组成和效果承接一致。',
      validationEvidence: [l3Formation],
      evidence: [l3Formation],
    },
    provenance: [l3Formation],
    evidence: [l3Formation],
  },
]

export const current31LegacyCoverageMetaBands: CurrentMetaStrengthR1['kernelBands'] = [
  { kernelId: 'kernel-3.1-billy-nicole-anby', band: 'viable', refs: [billyCurrent] },
  { kernelId: 'kernel-3.1-ellen-lycaon-soukaku', band: 'viable', refs: [ellenCurrent] },
  { kernelId: 'kernel-3.1-jane-burnice-lucy', band: 'viable', refs: [janeCurrent, l3Formation] },
]
