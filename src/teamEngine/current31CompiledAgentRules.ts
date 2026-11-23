import { agentCatalog } from '../assault/catalogData'
import {
  currentAgentEventContracts,
  getCurrentAgentEventContract,
  currentAgentMechanicIdentity,
  resolveOtherMemberActivationMinimum,
  type AgentTeamActivationPredicate,
} from '../calculation/currentAgentMechanicContracts'
import { currentAgentDecisionMechanicContracts } from '../calculation/currentAgentDecisionMechanicContracts'
import { currentAssetProjection } from '../gameDataPacks/currentAssetProjection'
import { reviewedPotentialTeamActivation } from '../gameDataPacks/reviewedPotentialTeamActivation'
import { reviewedTeammateActivationTerms } from '../gameDataPacks/reviewedTeammateActivationMinimum'
import type { AgentRule, TeamEngineEvidenceRef, TeamPredicate } from './contracts'
import { resolveFieldTimeDemand, type FieldTimeMode } from './fieldTimeDemandOperator'

type Identity = {
  agentId: string
  name: string
  specialty: string
  faction: string
  attribute: string
}

type CategoryKind = 'specialty' | 'faction' | 'attribute'
type CategoryMaps = Record<CategoryKind, ReadonlyMap<string, string>>

function normalizedCategoryPredicate(
  predicate: TeamPredicate,
  identityByAgentId: ReadonlyMap<string, Identity>,
  categoryMaps: CategoryMaps,
): TeamPredicate {
  const canonical = (kind: CategoryKind, value: string) => {
    const mapped = categoryMaps[kind].get(value)
    if (mapped) return mapped
    const eventPeers = currentAgentEventContracts.filter(
      (contract) => contract.identity[kind] === value,
    )
    const currentValues = new Set(
      eventPeers
        .map((contract) => identityByAgentId.get(contract.stableId)?.[kind])
        .filter((entry): entry is string => Boolean(entry)),
    )
    if (currentValues.size === 1) return [...currentValues][0]!
    if ([...identityByAgentId.values()].some((identity) => identity[kind] === value)) return value
    throw new Error(`无法把队伍条件归一化到 current identity：${kind}:${value}`)
  }
  switch (predicate.kind) {
    case 'specialty_count':
      return { ...predicate, specialty: canonical('specialty', predicate.specialty) }
    case 'faction_count':
      return { ...predicate, faction: canonical('faction', predicate.faction) }
    case 'attribute_count':
      return { ...predicate, attribute: canonical('attribute', predicate.attribute) }
    case 'category_sum_minimum':
      return {
        ...predicate,
        terms: predicate.terms.map((term) => ({
          ...term,
          value: canonical(term.kind, term.value),
        })),
      }
    case 'all':
    case 'any':
      return {
        ...predicate,
        predicates: predicate.predicates.map((child) =>
          normalizedCategoryPredicate(child, identityByAgentId, categoryMaps),
        ),
      }
    default:
      return predicate
  }
}

function compileActivationPredicate(
  agentId: string,
  predicate: AgentTeamActivationPredicate,
  canonicalCategoryValue: (kind: CategoryKind, value: string) => string,
): TeamPredicate {
  return {
    kind: 'category_sum_minimum',
    agentId,
    terms: reviewedTeammateActivationTerms(agentId, predicate.terms).map((term) => ({
      kind: term.kind,
      value: canonicalCategoryValue(term.kind, term.value),
    })),
    minimum: resolveOtherMemberActivationMinimum(agentId, predicate),
    dynamicTerms: predicate.dynamicTerms,
  }
}

function capabilitiesFor(agentId: string): AgentRule['capabilities'] {
  const eventContract = getCurrentAgentEventContract(agentId)
  return eventContract?.eventContract.events.some(
    (event) => event.skill === 'assist' && event.actionId.startsWith('DefensiveAssist'),
  )
    ? ['defensive_assist']
    : []
}

function evidenceFor(input: {
  fieldTimeSource: { sourceId: string; locator: string; sourceVersion?: string }
  formulaSource: { commit: string; formulaPath: string }
  formulaVersion: string
  activationLocator: string
}): TeamEngineEvidenceRef[] {
  return [
    {
      sourceId: input.fieldTimeSource.sourceId,
      gameVersion: input.fieldTimeSource.sourceVersion ?? '3.1',
      status: 'candidate',
      locator: input.fieldTimeSource.locator,
    },
    {
      sourceId: `genshin-optimizer-${input.formulaSource.commit}`,
      gameVersion: input.formulaVersion,
      status: 'candidate',
      locator: `${input.formulaSource.formulaPath}; ${input.activationLocator}`,
    },
  ]
}

function compileRule(
  contract: (typeof currentAgentDecisionMechanicContracts)[number],
  identity: Identity,
  canonicalCategoryValue: (kind: CategoryKind, value: string) => string,
): AgentRule {
  const eventContract = getCurrentAgentEventContract(contract.agentId)
  const fieldTime = contract.fieldTimeContract
  const activation = eventContract?.teamActivationContract
  if (!eventContract || !fieldTime) throw new Error(`AgentRule 编译输入不完整：${contract.agentId}`)
  if (activation?.status !== 'compiled' || !activation.predicate)
    throw new Error(`AgentRule 追加能力合同未编译：${contract.agentId}`)

  // Recommendation-layer resource tags may only consume transition-complete
  // contracts. Partial state names remain useful Mechanic IR evidence, but
  // projecting them here would manufacture an open loop and change candidate
  // eligibility before the missing producer/consumer transitions are known.
  const resources =
    contract.readiness.resourceFlow === 'compiled'
      ? (contract.resourceContract?.resourceFlow.resources ?? [])
      : []
  const produces = resources
    .filter((resource) => resource.producerParameterKeys.length > 0)
    .map((resource) => resource.resource)
  const consumes = resources
    .filter((resource) => resource.consumerParameterKeys.length > 0)
    .map((resource) => resource.resource)
  const effects = [
    ...new Map(
      contract.effectContract.effects.flatMap((effect) =>
        effect.recipients.map((recipient) => {
          const normalizedRecipient = recipient === 'other_agent' ? 'active_agent' : recipient
          const value = {
            tag: effect.effectId,
            recipient: normalizedRecipient,
          } as AgentRule['effects'][number]
          return [`${value.tag}:${value.recipient}`, value] as const
        }),
      ),
    ).values(),
  ]

  return {
    ...identity,
    releaseState: 'released',
    fieldTimeDemand: resolveFieldTimeDemand(fieldTime.mode as FieldTimeMode),
    produces: [...new Set(produces)],
    consumes: [...new Set(consumes)],
    effects,
    capabilities: capabilitiesFor(contract.agentId),
    additionalAbility: {
      status: 'modeled',
      predicate: compileActivationPredicate(
        contract.agentId,
        activation.predicate as AgentTeamActivationPredicate,
        canonicalCategoryValue,
      ),
      description: '按 current 公式中的属性、特性、阵营与账户状态合同判断。',
    },
    evidence: [
      ...evidenceFor({
        fieldTimeSource: fieldTime.source,
        formulaSource: eventContract.source,
        formulaVersion:
          eventContract.source.provider === 'nanoka'
            ? currentAgentMechanicIdentity.gameVersion
            : eventContract.source.commit === '3456cd0f6f5bea10e168074502460dac2fcd6df4'
              ? '3.2'
              : '3.1',
        activationLocator: activation.predicate.locator,
      }),
      ...(contract.agentId === 'agent-pulchra'
        ? [
            {
              sourceId: 'miyoushe-62601585-pulchra-additional-ability',
              gameVersion: '1.6',
              status: 'candidate' as const,
              locator:
                'https://www.miyoushe.com/zzz/article/62601585; op51 image222308369; imageSha256=6e7965ac61fe5c047824cb89a700a3102fda69cdc7a51d1e65518e016e8e8ab8; 队伍中存在强攻或同阵营角色；保留current后续命破分支',
            },
          ]
        : []),
      ...(contract.agentId === 'agent-piper'
        ? [
            {
              sourceId: 'P31-en-piper-additional-ability',
              gameVersion: '3.1',
              status: 'candidate' as const,
              locator:
                'https://www.hoyolab.com/article/46037106 search index confirms Piper Additional Ability update but full text was unavailable; https://zenless.gg/version-3-1-the-long-goodbye-update-announcement/ Agent Skills text updates reproduces the specific other-Anomaly teammate condition; candidate, not independently verified official wording',
            },
            {
              sourceId: 'miyoushe-66657195-piper-additional-ability',
              gameVersion: '2.1',
              status: 'candidate' as const,
              locator:
                'https://www.miyoushe.com/zzz/article/66657195; structured_content op28 insert.fold; unitRawSha256=411dc7a1a06049636ded2b65533007ff9310edb33cfad34b71aee06df25c441b; 额外能力：同步疾驰；触发条件：队伍中存在与自身属性/阵营相同的角色。',
            },
          ]
        : []),
    ],
  }
}

export function compileCurrent31AgentRules(existingRules: readonly AgentRule[]) {
  const assetById = new Map(
    currentAssetProjection.agents.map((asset) => [asset.stableId, asset] as const),
  )
  const existingById = new Map(existingRules.map((rule) => [rule.agentId, rule] as const))
  const legacyFactionById = new Map<string, string>(
    agentCatalog.map(([agentId, , , , , , faction]) => [agentId, faction] as const),
  )
  const factionByUpstream = new Map<string, string>()
  for (const [agentId, faction] of [
    ...legacyFactionById,
    ...existingRules.map((rule) => [rule.agentId, rule.faction.trim()] as const),
  ]) {
    const upstreamFaction = getCurrentAgentEventContract(agentId)?.identity.faction
    if (upstreamFaction && faction && !factionByUpstream.has(upstreamFaction))
      factionByUpstream.set(upstreamFaction, faction)
  }
  const identityByAgentId = new Map<string, Identity>()
  for (const [agentId, asset] of assetById) {
    const event = getCurrentAgentEventContract(agentId)
    const directFaction =
      existingById.get(agentId)?.faction.trim() || legacyFactionById.get(agentId)
    const faction = directFaction || (event && factionByUpstream.get(event.identity.faction))
    if (!event || !faction) throw new Error(`全部代理人身份合同不完整：${agentId}`)
    identityByAgentId.set(agentId, {
      agentId,
      name: asset.playerName,
      specialty: asset.specialty ?? event.identity.specialty,
      faction,
      attribute: asset.attribute ?? event.identity.attribute,
    })
  }
  if (identityByAgentId.size !== currentAssetProjection.agents.length)
    throw new Error('current identity 存在重复或缺失 stable id')
  const categoryMaps: CategoryMaps = {
    specialty: new Map(
      existingRules.map((rule) => [rule.specialty, identityByAgentId.get(rule.agentId)!.specialty]),
    ),
    faction: new Map(
      existingRules.map((rule) => [rule.faction, identityByAgentId.get(rule.agentId)!.faction]),
    ),
    attribute: new Map(
      existingRules.map((rule) => [rule.attribute, identityByAgentId.get(rule.agentId)!.attribute]),
    ),
  }
  const canonicalCategoryValue = (kind: CategoryKind, value: string) => {
    const mapped = categoryMaps[kind].get(value)
    if (mapped) return mapped
    const peers = currentAgentEventContracts
      .filter((contract) => contract.identity[kind] === value)
      .map((contract) => identityByAgentId.get(contract.stableId)?.[kind])
      .filter((entry): entry is string => Boolean(entry))
    const unique = new Set(peers)
    if (unique.size === 1) return [...unique][0]!
    if ([...identityByAgentId.values()].some((identity) => identity[kind] === value)) return value
    throw new Error(`无法把上游追加能力分类映射到 current identity：${kind}:${value}`)
  }
  const existingIds = new Set(existingRules.map((rule) => rule.agentId))
  const enrichedExisting = existingRules.map((rule) => ({
    ...rule,
    ...identityByAgentId.get(rule.agentId)!,
    capabilities: capabilitiesFor(rule.agentId),
  }))
  const compiled = currentAgentDecisionMechanicContracts
    .filter((contract) => !existingIds.has(contract.agentId))
    .map((contract) =>
      compileRule(contract, identityByAgentId.get(contract.agentId)!, canonicalCategoryValue),
    )
    .sort((left, right) => left.agentId.localeCompare(right.agentId))
  const result = [...enrichedExisting, ...compiled].map((rule): AgentRule => {
    const delta = reviewedPotentialTeamActivation.find((entry) => entry.agentId === rule.agentId)
    if (!delta || rule.additionalAbility.status !== 'modeled') return rule
    return {
      ...rule,
      additionalAbility: {
        ...rule.additionalAbility,
        predicate: {
          kind: 'any',
          predicates: [
            rule.additionalAbility.predicate,
            {
              kind: 'all',
              predicates: [
                { kind: 'potential_minimum', agentId: rule.agentId, minimum: delta.minimum },
                {
                  kind: 'category_sum_minimum',
                  agentId: rule.agentId,
                  terms: [{ kind: 'specialty', value: delta.specialty }],
                  minimum: 1,
                  dynamicTerms: [],
                },
              ],
            },
          ],
        },
      },
      evidence: [
        ...rule.evidence,
        {
          sourceId: `miyoushe-${delta.source.postId}-potential-activation`,
          gameVersion: delta.source.sourceVersion,
          status: 'candidate',
          locator: delta.source.locators.join('; '),
        },
      ],
    }
  })
  const normalized = result
    .map((rule) => ({
      ...rule,
      ...identityByAgentId.get(rule.agentId)!,
      additionalAbility:
        rule.additionalAbility.status === 'modeled'
          ? {
              ...rule.additionalAbility,
              predicate: normalizedCategoryPredicate(
                rule.additionalAbility.predicate,
                identityByAgentId,
                categoryMaps,
              ),
            }
          : rule.additionalAbility,
    }))
    .sort((left, right) => left.agentId.localeCompare(right.agentId))
  if (new Set(normalized.map((rule) => rule.agentId)).size !== normalized.length)
    throw new Error('AgentRule 编译结果存在重复 stable id')
  return Object.freeze(normalized)
}

export const current31CompiledAgentRuleContract = Object.freeze({
  contract: 'soda-current-agent-rule-compiler/v2',
  sourceFactGap: 0,
  adapterCount: 0,
  operatorCount: 1,
  boundary:
    '以 current 61 人资产身份为唯一名称、特性与属性口径，把英文阵营和上游 attack/auric-ink 条件映射到本地队伍合同；不按 specialty 默认站场，不把 observed synergy 当强度排序或协同全集。',
})
