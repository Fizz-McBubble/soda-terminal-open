import { memberFacts, type Member } from './teamStrengthMemberFacts'
import {
  teamStrengthBackgroundAction,
  teamStrengthBackgroundActionIdentity,
} from './teamStrengthBackgroundActions'
import { supportsPotentialImage } from '../assault/agentCapabilities'
import { getCurrentAgentEventContract } from '../calculation/currentAgentMechanicContracts'
import { getCurrentAgentDecisionMechanicContract } from '../calculation/currentAgentDecisionMechanicContracts'
import { compileNormalizedAgentEventSchedule } from '../calculation/currentNormalizedPlanningBaseline'
import { resolveCurrentReleasedIdentity } from '../gameDataPacks/currentReleasedIdentityMap'
import { stableContentHash } from '../gameDataPacks/types'
import { teamAnomalyCapacityFeatureNames } from './teamStrengthAnomalyCapacityCoordinates'
import { current31TeamEngineD1Pack } from '../teamEngine/current31D1Pack'
import { evaluateTeamPredicate, type TeamContext } from '../teamEngine/teamMethodR1'
import { requiredAgentResources } from '../teamEngine/teamResourceRequirements'
import { sourceBoundAgentSupportFingerprint } from '../calculation/sourceBoundAgentSupport'
import { reviewedExternalSupportFactsFingerprint } from '../gameDataPacks/reviewedExternalSupportFacts'
import { reviewedGenericEffectDispositionsFingerprint } from '../gameDataPacks/reviewedExternalEffectDispositions'
import { reviewedPotentialDefinitions } from '../gameDataPacks/reviewedPotentialDefinitions'
import { reviewedPotentialCalculationIdentity } from '../gameDataPacks/reviewedPotentialIdentity'
import { prepareReviewedPotentialEvents32 } from '../calculation/reviewedPotentialPreparedEvents32'
import { bindReviewedPotentialApplications } from '../calculation/potentialApplicationBinding'
import { currentPlanningConsumerPolicyIdentity32 } from '../calculation/currentPlanningConsumerPolicyIdentity32'
import { teamStrengthSourceActionSemantics } from './teamStrengthActionFacts'
import { anomalyDamageCoreIdentity } from '../calculation/anomalyDamageCore'
import {
  projectTeamStrengthSourceCapacity,
  resolveTeamStrengthRecipientContext,
  teamStrengthSourceCapacityIdentity,
} from './teamStrengthSourceCapacity'
import {
  createTeamStrengthReferenceRuntimeMember,
  teamStrengthReferenceStateIdentity,
} from './teamStrengthReferenceState'
import type {
  ResolvedTeamStrengthReferenceConditions,
  TeamStrengthReferenceConditions,
} from './teamStrengthReferenceConditions'
import {
  projectTeamStrengthSupportContactEvidence,
  teamStrengthSupportContactIdentity,
} from './teamStrengthSupportContributionFeatures'
import {
  compatibleCapabilities,
  selfCapabilitySourceFingerprint,
  type SupportRecipientContext,
} from './teamStrengthSupportCapabilities'
import {
  teamStrengthMechanicFeatureNames,
  teamStrengthCoefficientDirections,
  type TeamStrengthMechanicFeatures,
} from './teamStrengthMechanicFeatureContract'
export {
  teamStrengthMechanicFeatureNames,
  teamStrengthCoefficientDirections,
  type TeamStrengthMechanicFeatures,
  type TeamStrengthMechanicFeatureName,
} from './teamStrengthMechanicFeatureContract'
const ruleById = new Map(current31TeamEngineD1Pack.agentRules.map((rule) => [rule.agentId, rule]))
const outputSpecialties = new Set(['attack', 'anomaly', 'rupture', 'armorer'])
const fieldBudget = 1.35
export const teamStrengthMechanicFeaturesVersion =
  'reference-mindscape-and-coactive-source-contact-features/v19' as const
/** Only inputs actually used here; guide rows, evidence counts and labels are excluded. */
export const teamStrengthMechanicDataFingerprint = stableContentHash({
  version: teamStrengthMechanicFeaturesVersion,
  potentialDefinitions: reviewedPotentialDefinitions.map(reviewedPotentialCalculationIdentity),
  preparedConsumerIdentity: currentPlanningConsumerPolicyIdentity32,
  features: teamStrengthMechanicFeatureNames,
  coefficientDirections: teamStrengthCoefficientDirections,
  fieldBudget,
  sourceBoundAgentSupportFingerprint,
  selfCapabilitySourceFingerprint,
  reviewedExternalSupportFactsFingerprint,
  reviewedGenericEffectDispositionsFingerprint,
  reference: teamStrengthReferenceStateIdentity,
  supportContact: teamStrengthSupportContactIdentity,
  sourceCapacity: teamStrengthSourceCapacityIdentity,
  backgroundAction: teamStrengthBackgroundActionIdentity,
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
  referenceConditions: TeamStrengthReferenceConditions = {
    potentialByAgentId: {},
    evidenceRefs: [],
  },
  options: { includeSupportContributionEvidence?: boolean } = {},
): TeamStrengthMechanicFeatures {
  const ids = inputMemberIds.map(resolveCurrentReleasedIdentity).sort()
  const invalidIdentity = ids.length !== 3 || new Set(ids).size !== 3
  const invalidPotentialReference =
    Object.entries(referenceConditions.potentialByAgentId).some(
      ([id, potential]) =>
        !ids.includes(id) ||
        !Number.isInteger(potential) ||
        potential < 0 ||
        potential > 6 ||
        (potential > 0 && !supportsPotentialImage(id)),
    ) ||
    (Object.values(referenceConditions.potentialByAgentId).some((level) => level > 0) &&
      referenceConditions.evidenceRefs.length === 0)
  const runtimeById = new Map<string, ReturnType<typeof createTeamStrengthReferenceRuntimeMember>>()
  const members = ids.flatMap((id) => {
    const member = memberFacts(id)
    if (!member) return []
    // Cached intrinsic stats do not certify a currently available action contract.
    const schedule = compileNormalizedAgentEventSchedule({ agentId: id })
    if (invalidPotentialReference) return [member]
    const runtime = createTeamStrengthReferenceRuntimeMember(id, referenceConditions)
    runtimeById.set(id, runtime)
    return [
      {
        ...member,
        attack: runtime.initialStats.atk,
        defense: runtime.initialStats.def,
        impact: runtime.initialStats.impact,
        anomalyMastery: runtime.initialStats.anomMas,
        actionReady: member.actionReady && schedule.status === 'supported',
      },
    ]
  })
  const reasons = [
    ...(invalidIdentity ? ['需要三名不重复的代理人。'] : []),
    ...(members.length !== ids.length ? ['部分代理人缺少当前机制身份。'] : []),
    ...(invalidPotentialReference ? ['非零潜能参考必须有适用主体、合法等级与具名条件依据。'] : []),
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
    agentStateById: Object.fromEntries(
      ids.map((id) => [
        id,
        {
          mindscape: runtimeById.get(id)!.mindscape,
          potentialImage: runtimeById.get(id)!.potential ?? 0,
        },
      ]),
    ),
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
  const direct = output.filter((member) => member.actionFacts.direct !== null)
  const directScale = (member: Member) => {
    const packet = member.actionFacts.direct
    const semantics = teamStrengthSourceActionSemantics(packet)
    return (
      (semantics?.scalingAttribute === 'defense' ? member.defense : member.attack) *
      (packet?.damageMultiplier ?? 0)
    )
  }
  const frontline = output.filter((member) => member.demand >= 0.7)
  const backgroundActionEvidence = members.map(teamStrengthBackgroundAction)
  const background = members.filter((member) =>
    backgroundActionEvidence.some((row) => row.agentId === member.agentId && row.action !== null),
  )
  const backgroundScale = (member: Member) =>
    member.attack *
    (backgroundActionEvidence.find((row) => row.agentId === member.agentId)?.action
      ?.damageMultiplier ?? 0)
  const anomalies = output.filter((member) => member.specialty === 'anomaly')
  // A specialty/attribute label alone does not prove a second anomaly channel.
  // Keep special damage (for example lumiflux) separate from reviewed disorder
  // capacity, and require a source-backed positive buildup packet for each side.
  const anomalyPairAttributes = new Set(
    anomalies
      .filter(
        (member) =>
          member.actionFacts.anomaly !== null &&
          Object.hasOwn(anomalyDamageCoreIdentity.disorderTimeMultipliers, member.attribute),
      )
      .map((member) => member.attribute),
  )
  const fieldDemand = members.reduce((sum, member) => sum + member.demand, 0)
  const effectiveRecipientContext = Object.keys(recipientContext).length
    ? recipientContext
    : resolveTeamStrengthRecipientContext(ids, referenceConditions)
  const capabilities = compatibleCapabilities(
    members,
    abilityById,
    context,
    effectiveRecipientContext,
    referenceConditions,
  )
  const sourceCapacityEvidence = projectTeamStrengthSourceCapacity(
    members,
    abilityById,
    referenceConditions,
    effectiveRecipientContext,
  )
  const potentialEffects = members.flatMap((member) => {
    const runtimeMember = runtimeById.get(member.agentId)!
    const potential = runtimeMember.potential ?? 0
    if (potential === 0) return []
    const schedule = compileNormalizedAgentEventSchedule({ agentId: member.agentId })
    if (schedule.status !== 'supported') return []
    const preparation = prepareReviewedPotentialEvents32({
      member: runtimeMember,
      eventUsages: schedule.eventUsages,
      memberIds: ids,
    })
    return Object.values(preparation?.potentialEvents ?? {}).flatMap((event) =>
      bindReviewedPotentialApplications({
        member: {
          agentId: member.agentId,
          potential,
          initialStats: runtimeMember.initialStats,
          provenance: 'planning_baseline',
        },
        event,
      }).filter((effect) => effect.status === 'applied' && effect.targetKind === 'self'),
    )
  })
  const potentialCapacity = (kind: (typeof potentialEffects)[number]['valueKind']) =>
    Math.max(
      0,
      ...potentialEffects
        .filter((effect) => effect.valueKind === kind)
        .map((effect) => effect.value),
    )
  const potentialStatCapacity = (effectId: string) =>
    Math.max(
      0,
      ...potentialEffects
        .filter((effect) => effect.valueKind === 'stat_bonus' && effect.effectId === effectId)
        .map((effect) => effect.value),
    )
  const primary = [...output].sort(
    (left, right) => right.demand - left.demand || left.agentId.localeCompare(right.agentId),
  )[0]
  const contactRecipients = [...output]
    .sort((left, right) => right.demand - left.demand || left.agentId.localeCompare(right.agentId))
    .slice(0, 2)
  // Retain distinct providers for one recipient. A larger gain to a stun or
  // secondary actor cannot stand in for the primary actor's contact gain.
  // Different source states remain capacities, never simultaneous uptime.
  const primarySourceAction = sourceCapacityEvidence.actions.find(
    (row) => row.agentId === primary?.agentId,
  )
  const secondarySourceAction = sourceCapacityEvidence.actions
    .filter(
      (row) =>
        row.agentId !== primary?.agentId &&
        row.value !== null &&
        row.value > 0 &&
        members.some(
          (member) =>
            member.agentId === row.agentId &&
            (outputSpecialties.has(member.specialty) || member.specialty === 'stun'),
        ),
    )
    .sort(
      (left, right) => right.value! - left.value! || left.agentId.localeCompare(right.agentId),
    )[0]
  const recipientProviderGains = (action: typeof primarySourceAction) => {
    if (!action?.eventPacketIdentity || action.value === null || !Number.isFinite(action.value))
      return []
    const byProvider = new Map<string, number>()
    for (const contact of sourceCapacityEvidence.contacts) {
      if (
        contact.recipientAgentId !== action.agentId ||
        contact.providerAgentId === action.agentId ||
        contact.eventPacketIdentity !== action.eventPacketIdentity ||
        contact.relativeGain === null
      )
        continue
      byProvider.set(
        contact.providerAgentId,
        Math.max(byProvider.get(contact.providerAgentId) ?? 0, contact.relativeGain),
      )
    }
    return [...byProvider.values()].sort((left, right) => right - left)
  }
  const primaryRecipientGains = recipientProviderGains(primarySourceAction)
  const secondaryRecipientGains = recipientProviderGains(secondarySourceAction)
  // Counterfactual contacts are an explicit diagnostic input. The deployed
  // model must opt in when it actually consumes them; ordinary extraction must
  // not execute unused damage evaluations for every legal trio.
  const supportContributionEvidence = options.includeSupportContributionEvidence
    ? projectTeamStrengthSupportContactEvidence({
        memberIds: ids,
        recipients: contactRecipients.map((member) => ({
          agentId: member.agentId,
          action: member.actionFacts.damage,
        })),
        referenceConditions,
      })
    : undefined
  const guardrails = {
    noPrimaryOutput: output.length === 0,
    severeFieldCompetition: frontline.length >= 3,
    inactiveAdditionalAbility: inactiveAbilities > 0,
    openResourceLoop: unmetRequirements > 0,
  }
  const missingOutputActions = output.filter((member) => !member.actionReady)
  const values = [
    Math.log1p(maximum(direct, directScale)),
    Math.log1p(
      maximum(anomalies, (member) => (member.anomalyBuildup * member.anomalyMastery) / 100),
    ),
    Math.log1p(
      maximum(
        output.filter((member) => member.actionFacts.sheer !== null),
        (member) => member.actionFacts.sheer?.damageMultiplier ?? 0,
      ),
    ),
    Math.log1p(
      maximum(
        members.filter((member) => member.specialty === 'stun'),
        (member) => (member.impact * member.dazeMultiplier) / 100,
      ),
    ),
    Math.log1p(maximum(background, backgroundScale)),
    fieldDemand,
    Math.max(0, fieldDemand - fieldBudget),
    output.length,
    background.length,
    inactiveAbilities / 3,
    unmetRequirements / Math.max(1, requirements.length),
    Number(anomalyPairAttributes.size >= 2),
    capabilities.coverage('damage'),
    capabilities.coverage('attack'),
    capabilities.coverage('critical'),
    capabilities.coverage('defense'),
    capabilities.coverage('resistance'),
    capabilities.coverage('anomaly'),
    capabilities.coverage('sheer'),
    capabilities.coverage('stun'),
    Math.log1p(second(direct, directScale)),
    Math.log1p(
      second(
        members.filter((member) => member.specialty === 'stun'),
        (member) => (member.impact * member.dazeMultiplier) / 100,
      ),
    ),
    Math.log1p(second(background, backgroundScale)),
    Math.log1p(
      second(anomalies, (member) => (member.anomalyBuildup * member.anomalyMastery) / 100),
    ),
    capabilities.multiProvider,
    Math.log1p(
      maximum(
        output.filter((member) => member.actionFacts.sharp !== null),
        (member) => member.defense * (member.actionFacts.sharp?.damageMultiplier ?? 0),
      ),
    ),
    Math.log1p(
      maximum(
        output.filter((member) => member.specialty === 'armorer'),
        (member) => member.lacerationMultiplier,
      ),
    ),
    capabilities.coverage('sharp'),
    capabilities.coverage('laceration'),
    potentialCapacity('damage_bonus'),
    potentialStatCapacity('potential_focus_attack'),
    potentialCapacity('crit_damage'),
    potentialStatCapacity('potential_penetration'),
    potentialCapacity('resistance_ignore'),
    capabilities.selfCoverage('damage'),
    capabilities.selfCoverage('attack'),
    capabilities.selfCoverage('critical'),
    capabilities.selfCoverage('anomaly_critical'),
    capabilities.selfCoverage('sheer'),
    capabilities.selfCoverage('sharp'),
    capabilities.selfCoverage('laceration'),
    capabilities.coverage('anomaly_critical'),
    capabilities.selfCoverage('anomaly_proficiency'),
    capabilities.selfCoverage('anomaly_mastery'),
    capabilities.selfCoverage('anomaly'),
    capabilities.coverage('aftershock_damage'),
    capabilities.coverage('aftershock_critical'),
    capabilities.coverage('aftershock_defense'),
    capabilities.selfCoverage('aftershock_damage'),
    capabilities.selfCoverage('aftershock_stun'),
    capabilities.coverage('anomaly_proficiency'),
    capabilities.coverage('anomaly_mastery'),
    Math.log1p(
      Math.max(
        0,
        ...sourceCapacityEvidence.actions
          .filter((row) => row.agentId === primary?.agentId)
          .map((row) => row.value ?? 0),
      ),
    ),
    // Real source damage from stun/support actors is retained independently
    // of primary-output role priors. It never turns three supports into a DPS team.
    Math.log1p(
      Math.max(
        0,
        ...sourceCapacityEvidence.actions
          .filter((row) =>
            members.some(
              (member) =>
                member.agentId === row.agentId &&
                member.agentId !== primary?.agentId &&
                (outputSpecialties.has(member.specialty) || member.specialty === 'stun'),
            ),
          )
          .map((row) => row.value ?? 0),
      ),
    ),
    primaryRecipientGains[0] ?? 0,
    primaryRecipientGains[1] ?? 0,
    sourceCapacityEvidence.anomalyProficiencyGain,
    sourceCapacityEvidence.anomalyMasteryGain,
    sourceCapacityEvidence.stunCapacity,
    ...teamAnomalyCapacityFeatureNames.map(
      (name) => sourceCapacityEvidence.anomalyCoordinates[name],
    ),
    secondaryRecipientGains[0] ?? 0,
  ]
  // Additional source capacities are learned jointly; none is a fixed role bonus
  // or a claim that mutually exclusive actions form continuous throughput.
  const playstyleCapacities = {
    secondDirectAction: second(direct, directScale),
    secondStunAction: second(
      members.filter((member) => member.specialty === 'stun'),
      (member) => (member.impact * member.dazeMultiplier) / 100,
    ),
    secondBackgroundAction: second(background, backgroundScale),
    secondAnomalyBuildup: second(
      anomalies,
      (member) => (member.anomalyBuildup * member.anomalyMastery) / 100,
    ),
    multiProvider: capabilities.multiProvider,
  }
  const resolvedReference =
    'status' in referenceConditions
      ? (referenceConditions as ResolvedTeamStrengthReferenceConditions)
      : null
  const limitations = [
    ...backgroundActionEvidence
      .filter((row) => row.status === 'unknown')
      .map(
        (row) => `${row.agentId}: ${row.blockers.join('; ')}; source=${row.sourceRefs.join(',')}`,
      ),
    '代表动作、站场预算和增益能力描述机制规模，不是实战频率、持续覆盖或伤害。',
    '普通直伤与异常积蓄按来源分别保留；动作包容量未给出各通道的实战贡献比例，第二输出不表示同时满额输出。',
    ...new Set(members.flatMap((member) => member.actionLimitations)),
    ...(resolvedReference?.diagnostics ?? []),
    Object.values(referenceConditions.potentialByAgentId).some((level) => level > 0)
      ? '采用显式潜能等级与逐事件准备条件；未显式指定的适用主体按评级协议P6，不表示当前账户已达到。'
      : '评级按60级、技能11、核心7、M0及当前版本适用主体P6；作者未知条件保留为未知，不改变本地协议。',
    '未量化专有伤害通道的持续覆盖；不把仅限以太帷幕衍生伤害或追加攻击的增益泛用于所有输出。',
    ...(capabilities.conditional ? ['条件增益仅表示对接受者相容的能力，不假定条件持续触发。'] : []),
    ...(output.some((member) => member.specialty === 'armorer')
      ? ['锋御动作按来源防御倍率表达；锐化/毁伤通道与相容受益者分别建模，非实战持续伤害。']
      : []),
    ...(capabilities.attributeConditionalRecipients.length
      ? ['浸染 / 涤净属性尚未给定，相应非风属性增益未计入覆盖。']
      : []),
    ...(resourceUnknown ? ['部分资源转换未完整表达；未将缺失资料当作资源无法满足。'] : []),
    ...(sourceCapacityEvidence.gaps.length
      ? ['有限接触中未解析的来源条件保留在具名提供者/字段诊断；不补成零收益或持续覆盖。']
      : []),
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
    sourceCapacityEvidence,
    backgroundActionEvidence,
    supportContributionEvidence,
    values,
    playstyleCapacities,
    dataFingerprint: teamStrengthMechanicDataFingerprint,
    eligibility: {
      eligible: missingOutputActions.length === 0,
      reasons: missingOutputActions.length ? ['主要输出缺少可比较的代表动作数值。'] : [],
    },
    reliability:
      backgroundActionEvidence.some((row) => row.status === 'unknown') ||
      resourceUnknown ||
      capabilities.unverifiedProviders.length > 0 ||
      capabilities.reviewedProviders.length > 0 ||
      capabilities.deferredProviders.length > 0 ||
      capabilities.sourceConflictProviders.length > 0 ||
      sourceCapacityEvidence.gaps.length > 0 ||
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
