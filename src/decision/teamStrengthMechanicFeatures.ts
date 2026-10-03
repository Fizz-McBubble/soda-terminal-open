import {
  getCurrentAgentEventContract,
  resolveCurrentAgentEvent,
} from '../calculation/currentAgentMechanicContracts'
import { getCurrentAgentDecisionMechanicContract } from '../calculation/currentAgentDecisionMechanicContracts'
import { compileNormalizedAgentEventSchedule } from '../calculation/currentNormalizedPlanningBaseline'
import type { UpstreamExpressionIR } from '../calculation/currentUpstreamExpressionIR'
import { resolveCurrentReleasedIdentity } from '../gameDataPacks/currentReleasedIdentityMap'
import { stableContentHash } from '../gameDataPacks/types'
import { current31TeamEngineD1Pack } from '../teamEngine/current31D1Pack'
import { evaluateTeamPredicate, type TeamContext } from '../teamEngine/teamMethodR1'
import { requiredAgentResources } from '../teamEngine/teamResourceRequirements'
import { sourceBoundAgentSupportFingerprint } from '../calculation/sourceBoundAgentSupport'
import { reviewedExternalSupportFactsFingerprint } from '../gameDataPacks/reviewedExternalSupportFacts'
import { reviewedGenericEffectDispositionsFingerprint } from '../gameDataPacks/reviewedExternalEffectDispositions'
import {
  compatibleCapabilities,
  effectReceivers,
  expressionReferences,
  type SupportRecipientContext,
} from './teamStrengthSupportCapabilities'
/** Source facts and structural capacities, never a team label, agent tier, or DPS. */
export const teamStrengthMechanicFeatureNames = [
  'direct_action_scale',
  'anomaly_action_buildup',
  'rupture_action_multiplier',
  'stun_action_scale',
  'background_action_scale',
  'field_time_demand',
  'field_time_excess',
  'output_role_count',
  'background_output_count',
  'inactive_additional_ability_fraction',
  'unmet_resource_fraction',
  'different_attribute_anomaly_pair',
  'compatible_damage_capability',
  'compatible_attack_capability',
  'compatible_critical_capability',
  'compatible_defense_reduction_capability',
  'compatible_resistance_reduction_capability',
  'compatible_anomaly_capability',
  'compatible_sheer_force_capability',
  'compatible_stun_capability',
] as const
export type TeamStrengthMechanicFeatureName = (typeof teamStrengthMechanicFeatureNames)[number]
export type TeamStrengthMechanicFeatures = {
  featureNames: typeof teamStrengthMechanicFeatureNames
  values: number[]
  playstyleCapacities: {
    secondDirectAction: number
    secondStunAction: number
    secondBackgroundAction: number
    secondAnomalyBuildup: number
    multiProvider: number
  }
  dataFingerprint: string
  eligibility: { eligible: boolean; reasons: string[] }
  reliability: 'supported' | 'partial'
  supportEvidence: {
    unverifiedProviderIds: string[]
    reviewedProviderIds: string[]
    deferredProviderIds: string[]
    sourceConflictProviderIds: string[]
    sharpCoverage: number
    lacerationCoverage: number
    attributeConditionalRecipientIds: string[]
  }
  /** Validation grouping only. Neither identity field enters values. */
  primaryOutputAgentId: string | null
  coreGroup: string
  guardrails: {
    noPrimaryOutput: boolean
    severeFieldCompetition: boolean
    inactiveAdditionalAbility: boolean
    openResourceLoop: boolean
  }
  limitations: string[]
}
const ruleById = new Map(current31TeamEngineD1Pack.agentRules.map((rule) => [rule.agentId, rule]))
const outputSpecialties = new Set(['attack', 'anomaly', 'rupture', 'armorer'])
const fieldBudget = 1.35
export const teamStrengthMechanicFeaturesVersion = 'source-fact-team-features/v6' as const
/** Only inputs actually used here; guide rows, evidence counts and labels are excluded. */
export const teamStrengthMechanicDataFingerprint = stableContentHash({
  version: teamStrengthMechanicFeaturesVersion,
  features: teamStrengthMechanicFeatureNames,
  fieldBudget,
  sourceBoundAgentSupportFingerprint,
  reviewedExternalSupportFactsFingerprint,
  reviewedGenericEffectDispositionsFingerprint,
  reference: { level: 60, skillLevel: 11, mindscape: 0, potential: 0 },
  agents: [...ruleById.values()]
    .sort((left, right) => left.agentId.localeCompare(right.agentId))
    .map((rule) => {
      const event = getCurrentAgentEventContract(rule.agentId)
      const decision = getCurrentAgentDecisionMechanicContract(rule.agentId)
      return {
        agentId: rule.agentId,
        identity: event?.identity,
        baseStats: event?.baseStats,
        events: event?.eventContract.events,
        fieldTimeDemand: rule.fieldTimeDemand,
        fieldTimeMode: decision?.fieldTimeContract?.mode,
        activation: {
          status: rule.additionalAbility.status,
          predicate:
            rule.additionalAbility.status === 'modeled' ? rule.additionalAbility.predicate : null,
        },
        produces: rule.produces,
        consumes: rule.consumes,
        resourceReadiness: decision?.readiness.resourceFlow,
        effects: decision?.effectContract.effects.map((effect) => ({
          effectId: effect.effectId,
          recipients: effect.recipients,
          expression: effect.numericExpression.expressionIr,
          todoBoundary: effect.numericExpression.todoBoundary,
          dependencyKinds: effect.numericExpression.dependencyKinds,
          classification: effect.numericExpression.classification,
          genericConditionalIdentifiers: effect.numericExpression.genericConditionalIdentifiers,
        })),
      }
    }),
})
type Member = {
  agentId: string
  specialty: string
  attribute: string
  demand: number
  attack: number
  impact: number
  anomalyMastery: number
  damageMultiplier: number
  dazeMultiplier: number
  anomalyBuildup: number
  hpToSheer: boolean
  actionReady: boolean
}
const memberCache = new Map<string, Member>()
function memberFacts(agentId: string): Member | null {
  const cached = memberCache.get(agentId)
  if (cached) return cached
  const contract = getCurrentAgentEventContract(agentId)
  const rule = ruleById.get(agentId)
  if (!contract || !rule) return null
  const schedule = compileNormalizedAgentEventSchedule({ agentId })
  const events =
    schedule.status === 'supported'
      ? schedule.eventUsages.map((usage) =>
          resolveCurrentAgentEvent({
            stableId: agentId,
            eventId: usage.eventId,
            skillLevel: usage.skillLevel,
          }),
        )
      : []
  const resolved = events.filter((event) => event.status === 'supported')
  // Use one source action. The baseline's 2..6 repetitions are local policy,
  // not observed speed, and would count field-time assumptions twice here.
  const result: Member = {
    agentId,
    specialty: contract.identity.specialty,
    attribute: contract.identity.attribute,
    demand: rule.fieldTimeDemand,
    attack: contract.baseStats.atk_base + contract.baseStats.atk_growth * 59,
    impact: contract.baseStats.impact,
    anomalyMastery: contract.baseStats.anomMas,
    damageMultiplier: resolved.reduce((sum, event) => sum + event.damageMultiplier, 0),
    dazeMultiplier: resolved.reduce((sum, event) => sum + event.dazeMultiplier, 0),
    anomalyBuildup: resolved.reduce((sum, event) => sum + event.anomalyBuildup, 0),
    hpToSheer:
      getCurrentAgentDecisionMechanicContract(agentId)?.effectContract.effects.some(
        (effect) =>
          !/^m[1-6](?:_|$)/i.test(effect.effectId) &&
          effectReceivers(effect.numericExpression.expressionIr as UpstreamExpressionIR).some(
            (receiver) => /ownBuff\..*sheerForce/.test(receiver.path),
          ) &&
          expressionReferences(
            effect.numericExpression.expressionIr as UpstreamExpressionIR,
          ).includes('own.final.hp'),
      ) ?? false,
    actionReady:
      events.length > 0 &&
      resolved.length === events.length &&
      resolved.every((event) =>
        [event.damageMultiplier, event.dazeMultiplier, event.anomalyBuildup].every(
          (value) => Number.isFinite(value) && value >= 0,
        ),
      ),
  }
  memberCache.set(agentId, result)
  return result
}

const maximum = (members: Member[], value: (member: Member) => number) =>
  members.length ? Math.max(...members.map(value)) : 0

// Preserve the second member's capacity without summing mutually exclusive
// actions into a fabricated throughput figure. No role-based tier bonus.
const second = (members: Member[], value: (member: Member) => number) =>
  [...members].map(value).sort((left, right) => right - left)[1] ?? 0

/** Pure exact-trio extraction. Missing guides and missing observations are not eligibility gates. */
export function extractTeamStrengthMechanicFeatures(
  inputMemberIds: readonly string[],
  recipientContext: SupportRecipientContext = {},
): TeamStrengthMechanicFeatures {
  const ids = inputMemberIds.map(resolveCurrentReleasedIdentity).sort()
  const invalidIdentity = ids.length !== 3 || new Set(ids).size !== 3
  const members = ids.flatMap((id) => {
    const member = memberFacts(id)
    return member ? [member] : []
  })
  const reasons = [
    ...(invalidIdentity ? ['需要三名不重复的代理人。'] : []),
    ...(members.length !== ids.length ? ['部分代理人缺少当前机制身份。'] : []),
  ]
  if (reasons.length)
    return {
      featureNames: teamStrengthMechanicFeatureNames,
      values: teamStrengthMechanicFeatureNames.map(() => 0),
      playstyleCapacities: {
        secondDirectAction: 0,
        secondStunAction: 0,
        secondBackgroundAction: 0,
        secondAnomalyBuildup: 0,
        multiProvider: 0,
      },
      dataFingerprint: teamStrengthMechanicDataFingerprint,
      eligibility: { eligible: false, reasons },
      reliability: 'partial',
      supportEvidence: {
        unverifiedProviderIds: [],
        reviewedProviderIds: [],
        deferredProviderIds: [],
        sourceConflictProviderIds: [],
        sharpCoverage: 0,
        lacerationCoverage: 0,
        attributeConditionalRecipientIds: [],
      },
      primaryOutputAgentId: null,
      coreGroup: 'unsupported',
      guardrails: {
        noPrimaryOutput: true,
        severeFieldCompetition: false,
        inactiveAdditionalAbility: false,
        openResourceLoop: false,
      },
      limitations: reasons,
    }
  const rules = ids.map((id) => ruleById.get(id)!)
  const producedTags = new Set(rules.flatMap((rule) => rule.produces))
  const context: TeamContext = {
    agents: rules,
    producedTags,
    agentStateById: Object.fromEntries(ids.map((id) => [id, { mindscape: 0, potentialImage: 0 }])),
  }
  const abilityById = new Map(
    rules.map((rule) => [
      rule.agentId,
      rule.additionalAbility.status === 'none' ||
        (rule.additionalAbility.status === 'modeled' &&
          evaluateTeamPredicate(rule.additionalAbility.predicate, context)),
    ]),
  )
  const inactiveAbilities = [...abilityById.values()].filter((active) => !active).length
  const requirements = rules.flatMap((rule) => requiredAgentResources(rule.consumes))
  const unmetRequirements = requirements.filter((tag) => !producedTags.has(tag)).length
  const resourceUnknown = ids.some(
    (id) =>
      getCurrentAgentDecisionMechanicContract(id)?.readiness.resourceFlow ===
      'mechanic_contract_pending',
  )
  const output = members.filter((member) => outputSpecialties.has(member.specialty))
  const frontline = output.filter((member) => member.demand >= 0.7)
  const background = output.filter((member) => member.demand <= 0.3)
  const anomalies = output.filter((member) => member.specialty === 'anomaly')
  const fieldDemand = members.reduce((sum, member) => sum + member.demand, 0)
  const capabilities = compatibleCapabilities(members, abilityById, context, recipientContext)
  const primary = [...output].sort(
    (left, right) => right.demand - left.demand || left.agentId.localeCompare(right.agentId),
  )[0]
  const guardrails = {
    noPrimaryOutput: output.length === 0,
    severeFieldCompetition: frontline.length >= 3,
    inactiveAdditionalAbility: inactiveAbilities > 0,
    openResourceLoop: unmetRequirements > 0,
  }
  const missingOutputActions = output.filter((member) => !member.actionReady)
  const values = [
    Math.log1p(
      maximum(
        output.filter((member) => member.specialty === 'attack'),
        (member) => member.attack * member.damageMultiplier,
      ),
    ),
    Math.log1p(
      maximum(anomalies, (member) => (member.anomalyBuildup * member.anomalyMastery) / 100),
    ),
    Math.log1p(
      maximum(
        output.filter((member) => member.specialty === 'rupture'),
        (member) => member.damageMultiplier,
      ),
    ),
    Math.log1p(
      maximum(
        members.filter((member) => member.specialty === 'stun'),
        (member) => (member.impact * member.dazeMultiplier) / 100,
      ),
    ),
    Math.log1p(
      maximum(
        background.filter((member) => member.specialty !== 'armorer'),
        (member) => member.attack * member.damageMultiplier,
      ),
    ),
    fieldDemand,
    Math.max(0, fieldDemand - fieldBudget),
    output.length,
    background.length,
    inactiveAbilities / 3,
    unmetRequirements / Math.max(1, requirements.length),
    Number(new Set(anomalies.map((member) => member.attribute)).size >= 2),
    capabilities.coverage('damage'),
    capabilities.coverage('attack'),
    capabilities.coverage('critical'),
    capabilities.coverage('defense'),
    capabilities.coverage('resistance'),
    capabilities.coverage('anomaly'),
    capabilities.coverage('sheer'),
    capabilities.coverage('stun'),
  ]
  // Keep multiple-member capacities available for review, not learned tier
  // bonuses: the current label set did not validate those extra coefficients.
  const playstyleCapacities = {
    secondDirectAction: second(
      output.filter((member) => member.specialty === 'attack'),
      (member) => member.attack * member.damageMultiplier,
    ),
    secondStunAction: second(
      members.filter((member) => member.specialty === 'stun'),
      (member) => (member.impact * member.dazeMultiplier) / 100,
    ),
    secondBackgroundAction: second(
      background.filter((member) => member.specialty !== 'armorer'),
      (member) => member.attack * member.damageMultiplier,
    ),
    secondAnomalyBuildup: second(
      anomalies,
      (member) => (member.anomalyBuildup * member.anomalyMastery) / 100,
    ),
    multiProvider: capabilities.multiProvider,
  }
  const limitations = [
    '代表动作、站场预算和增益能力描述机制规模，不是实战频率、持续覆盖或伤害。',
    'M0/P0 基础能力；高影和潜能路线需要另行说明。',
    '未量化专有伤害通道的持续覆盖；不把仅限以太帷幕衍生伤害或追加攻击的增益泛用于所有输出。',
    ...(capabilities.conditional ? ['条件增益仅表示对接受者相容的能力，不假定条件持续触发。'] : []),
    ...(output.some((member) => member.specialty === 'armorer')
      ? ['锋御计入输出角色；锐化与锐暴覆盖独立展示，未给未校准的专有伤害通道新增模型系数。']
      : []),
    ...(capabilities.attributeConditionalRecipients.length
      ? ['浸染 / 涤净属性尚未给定，相应非风属性增益未计入覆盖。']
      : []),
    ...(resourceUnknown ? ['部分资源转换未完整表达；未将缺失资料当作资源无法满足。'] : []),
    ...(capabilities.unverifiedProviders.length
      ? [
          '部分外部效果尚未绑定具体来源事实；覆盖值仅统计已确认能力，不能解释为这些角色没有其他能力。',
        ]
      : []),
    ...(capabilities.deferredProviders.length
      ? ['具名外部效果的通道或战斗时序尚未进入当前特征，未据此增加队伍效用。']
      : []),
    ...(capabilities.sourceConflictProviders.length
      ? ['具名角色来源页面存在版本冲突，未据此推断通用团队增益。']
      : []),
    ...(!members.every((member) => member.actionReady) ? ['部分代表动作缺少可比较数值。'] : []),
    ...(guardrails.noPrimaryOutput
      ? ['没有通常承担主要输出的角色，不能只按增益数量认定强队。']
      : []),
    ...(guardrails.severeFieldCompetition
      ? ['三名主要输出都需求较长站场，存在明显轮转竞争。']
      : []),
  ]
  return {
    featureNames: teamStrengthMechanicFeatureNames,
    values,
    playstyleCapacities,
    dataFingerprint: teamStrengthMechanicDataFingerprint,
    eligibility: {
      eligible: missingOutputActions.length === 0,
      reasons: missingOutputActions.length ? ['主要输出缺少可比较的代表动作数值。'] : [],
    },
    reliability:
      resourceUnknown ||
      capabilities.unverifiedProviders.length > 0 ||
      capabilities.reviewedProviders.length > 0 ||
      capabilities.deferredProviders.length > 0 ||
      capabilities.sourceConflictProviders.length > 0 ||
      !members.every((member) => member.actionReady)
        ? 'partial'
        : 'supported',
    supportEvidence: {
      unverifiedProviderIds: capabilities.unverifiedProviders,
      reviewedProviderIds: capabilities.reviewedProviders,
      deferredProviderIds: capabilities.deferredProviders,
      sourceConflictProviderIds: capabilities.sourceConflictProviders,
      sharpCoverage: capabilities.coverage('sharp'),
      lacerationCoverage: capabilities.coverage('laceration'),
      attributeConditionalRecipientIds: capabilities.attributeConditionalRecipients,
    },
    primaryOutputAgentId: primary?.agentId ?? null,
    coreGroup: primary ? `primary:${primary.agentId}` : 'no-primary-output',
    guardrails,
    limitations,
  }
}
