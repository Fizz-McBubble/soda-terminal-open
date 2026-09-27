import { l3BoxTeamTemplates } from '../gameDataPacks/l3BoxTeamTemplateProjection'
import type { AgentRule, TeamEngineEvidenceRef, TeamEnginePack } from './contracts'
import { current31VerticalSliceMetaStrength } from './currentMetaStrengthR1'
import { defineTeamMethodKernel } from './teamMethodR1'

const officialRelease: TeamEngineEvidenceRef = {
  sourceId: 'official-3.1-live-remielle',
  gameVersion: '3.1',
  status: 'formal',
  locator: 'Version 3.1 live scope and Remielle release',
}

const remielleGuide: TeamEngineEvidenceRef = {
  sourceId: 'prydwen-remielle-3.1-2026-08-24',
  gameVersion: '3.1',
  status: 'candidate',
  locator: 'Additional Ability, synergy and team analysis',
}

const currentArchetypeGuide: TeamEngineEvidenceRef = {
  sourceId: 'ldshop-remielle-team-2026-07-29',
  gameVersion: '3.1',
  status: 'candidate',
  locator: 'Remielle / anomaly driver / Velina / Ariel team variants',
}

function anomalyAgent(
  agentId: string,
  name: string,
  faction: string,
  attribute: string,
  fieldTimeDemand: number,
  produces: string[],
): AgentRule {
  return {
    agentId,
    name,
    releaseState: 'released',
    specialty: 'anomaly',
    faction,
    attribute,
    fieldTimeDemand,
    produces: ['anomaly_rotation', ...produces],
    consumes: [],
    effects: [],
    additionalAbility: {
      status: 'modeled',
      predicate: {
        kind: 'any',
        predicates: [
          { kind: 'specialty_count', specialty: 'anomaly', minimum: 2 },
          { kind: 'faction_count', faction, minimum: 2 },
        ],
      },
      description: '需要异常或同阵营队友。',
    },
    evidence: [currentArchetypeGuide],
  }
}

const agentRules: AgentRule[] = [
  {
    agentId: 'agent-remielle',
    name: '蕾米埃尔·丹',
    releaseState: 'released',
    specialty: 'anomaly',
    faction: '达识结社',
    attribute: 'auric-ink',
    fieldTimeDemand: 0.2,
    produces: ['anomaly_rotation', 'refringe', 'luminize'],
    consumes: ['anomaly_rotation'],
    effects: [{ tag: 'team_attack', recipient: 'team' }],
    additionalAbility: {
      status: 'modeled',
      predicate: {
        kind: 'any',
        predicates: [
          { kind: 'specialty_count', specialty: 'anomaly', minimum: 2 },
          { kind: 'faction_count', faction: '达识结社', minimum: 2 },
        ],
      },
      description: '需要另一名异常或达识结社队友。',
    },
    evidence: [
      officialRelease,
      remielleGuide,
      {
        sourceId: 'miyoushe-77017654-remielle-additional-ability',
        gameVersion: '3.1',
        status: 'candidate',
        locator:
          'https://www.miyoushe.com/zzz/article/77017654 image 257114628, op 79: 额外能力激活条件；异常或达识结社队友',
      },
    ],
  },
  {
    ...anomalyAgent('agent-velina', '维琳娜', '罗斯凯利法·外务筹策局', 'wind', 0.4, [
      'wind_anomaly',
      'anomaly_amplification',
    ]),
    effects: [{ tag: 'anomaly_amplification', recipient: 'team' }],
    additionalAbility: {
      status: 'modeled',
      predicate: {
        kind: 'any',
        predicates: [
          { kind: 'specialty_count', specialty: 'anomaly', minimum: 2 },
          { kind: 'attribute_count', attribute: 'wind', minimum: 2 },
        ],
      },
      description: '需要另一名异常或风属性队友。',
    },
    evidence: [
      currentArchetypeGuide,
      {
        sourceId: 'miyoushe-76052835-velina-additional-ability',
        gameVersion: '3.0',
        status: 'candidate',
        locator:
          'https://www.miyoushe.com/zzz/article/76052835 image 254552508, op 199: 额外能力激活条件；异常或同属性队友',
      },
    ],
  },
  {
    ...anomalyAgent('agent-aria', '爱芮', '妄想天使', 'ether', 0.65, [
      'ether_anomaly',
      'anomaly_driver',
    ]),
    additionalAbility: {
      status: 'modeled',
      predicate: {
        kind: 'any',
        predicates: [
          { kind: 'specialty_count', specialty: 'stun', minimum: 1 },
          { kind: 'specialty_count', specialty: 'support', minimum: 1 },
          { kind: 'faction_count', faction: '妄想天使', minimum: 2 },
          { kind: 'specialty_count', specialty: 'anomaly', minimum: 2 },
        ],
      },
      description: '需要击破、支援、同阵营或其他异常队友。',
    },
    evidence: [
      {
        sourceId: 'prydwen-aria-3.1-2026-08-24',
        gameVersion: '3.1',
        status: 'candidate',
        locator: 'Core Passive & Additional Ability',
      },
      {
        sourceId: 'nanoka-3.1-aria-1501-additional-ability',
        gameVersion: '3.1',
        status: 'candidate',
        locator:
          'https://static.nanoka.cc/zzz/3.1/zh/character/1501.json; passive.level.1501049.desc[1]; sha256=d2610095c6d441de080800a6a90399344db6c9f0734c571e8456eadd3b6646a7',
      },
    ],
  },
  anomalyAgent('agent-burnice', '柏妮思', '卡吕冬之子', 'fire', 0.35, [
    'fire_anomaly',
    'off_field_anomaly',
    'anomaly_driver',
  ]),
  {
    ...anomalyAgent('agent-promeia', '普罗米娅', '坎卜斯黑枝', 'ice', 0.65, [
      'ice_anomaly',
      'anomaly_driver',
    ]),
    additionalAbility: {
      status: 'modeled',
      predicate: {
        kind: 'any',
        predicates: [
          { kind: 'specialty_count', specialty: 'anomaly', minimum: 2 },
          { kind: 'specialty_count', specialty: 'support', minimum: 1 },
        ],
      },
      description: '需要异常或支援队友。',
    },
    evidence: [
      {
        sourceId: 'prydwen-promeia-3.1-2026-08-24',
        gameVersion: '3.1',
        status: 'candidate',
        locator: 'Core Passive & Additional Ability',
      },
    ],
  },
  {
    agentId: 'agent-nicole',
    name: '妮可',
    releaseState: 'released',
    specialty: 'support',
    faction: '狡兔屋',
    attribute: 'ether',
    fieldTimeDemand: 0.25,
    produces: ['defense_shred'],
    consumes: [],
    effects: [{ tag: 'defense_shred', recipient: 'active_agent' }],
    additionalAbility: {
      status: 'not_modeled',
      description: '本垂直切片不将妮可规则用于当前推荐。',
    },
    evidence: [],
  },
]

function remielleKernel(
  id: string,
  thirdAgentId: string,
  tier: 'current_strong_candidate' | 'current_viable_candidate',
  score: number,
  claim: string,
) {
  return defineTeamMethodKernel({
    currentVersion: '3.1',
    identity: {
      kernelId: id,
      familyId: 'family-remielle-multi-anomaly',
      label: '蕾米埃尔·维琳娜三异常核心',
    },
    formation: {
      coreAgentIds: ['agent-remielle', 'agent-velina'],
      eligibleThirdAgentIds: [thirdAgentId],
      allowedInactiveAdditionalAbilityAgentIds: thirdAgentId === 'agent-aria' ? ['agent-aria'] : [],
    },
    mechanismClosure: {
      requiredTeamPredicates: [
        { kind: 'specialty_count', specialty: 'anomaly', minimum: 3 },
        { kind: 'distinct_attribute_count', minimum: 3 },
      ],
      requiredProducedTags: ['anomaly_rotation', 'anomaly_driver'],
    },
    effectCoverage: { requiredEffectTags: ['team_attack', 'anomaly_amplification'] },
    scenarios: { scenarioTags: ['multi_attribute_anomaly', 'sustained_boss'] },
    currentStrength: { tier, score, claim, refs: [remielleGuide, currentArchetypeGuide] },
  })
}

const kernels = [
  remielleKernel(
    'kernel-3.1-remielle-velina-aria',
    'agent-aria',
    'current_strong_candidate',
    85,
    '双人核心与爱芮形成三属性异常闭环；强度仍为 3.1 Candidate 证据。',
  ),
  remielleKernel(
    'kernel-3.1-remielle-velina-burnice',
    'agent-burnice',
    'current_viable_candidate',
    72,
    '柏妮思提供后台火异常，与双人核心形成可闭环的多属性轮转。',
  ),
  remielleKernel(
    'kernel-3.1-remielle-velina-promeia',
    'agent-promeia',
    'current_viable_candidate',
    70,
    '普罗米娅提供冰异常驱动，与双人核心形成可闭环的多属性轮转。',
  ),
]

export const current31TeamEngineVerticalSlice: TeamEnginePack = {
  contract: 'soda-team-engine/v1',
  gameVersion: '3.1',
  agentRules,
  kernels,
  currentMetaStrength: current31VerticalSliceMetaStrength,
  bangbooRules: [
    {
      bangbooId: 'bangboo-ariel',
      name: '艾瑞儿',
      releaseState: 'released',
      activation: {
        status: 'modeled',
        predicate: { kind: 'agent_present', agentId: 'agent-remielle' },
        description: '额外能力要求队伍中存在蕾米埃尔。',
        evidence: [
          {
            sourceId: 'game-evidence-3.1-ariel-54023',
            gameVersion: '3.1',
            status: 'candidate',
            locator: 'Additional Ability requires Remielle',
          },
        ],
      },
      suitability: {
        status: 'modeled',
        familyIds: ['family-remielle-multi-anomaly'],
        scenarioTags: ['multi_attribute_anomaly'],
        description: '艾瑞儿的蕾米埃尔在队机制与多属性异常 family、场景效果承接一致。',
        validationEvidence: [currentArchetypeGuide],
        evidence: [currentArchetypeGuide],
      },
      provenance: [officialRelease, currentArchetypeGuide],
      evidence: [officialRelease, currentArchetypeGuide],
    },
  ],
  legacyAssemblies: l3BoxTeamTemplates.map((template) => ({
    assemblyId: template.templateId,
    label: template.label,
    memberIds: template.members.map((member) => member.agentId) as [string, string, string],
    bangbooId: template.bangbooId,
    reason: `只有旧模板可组成证据；${template.strength.boundary}`,
    sourceIds: [...template.source.sourceIds],
  })),
}
