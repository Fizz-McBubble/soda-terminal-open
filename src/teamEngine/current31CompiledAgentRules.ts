import { agentCatalog } from '../assault/catalogData'
import {
  currentAgentEventContracts,
  getCurrentAgentEventContract,
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

const identityByAgentId = new Map<string, Identity>(
  agentCatalog.map(([agentId, name, specialty, , , attribute, faction]) => [
    agentId,
    { agentId, name, specialty, faction, attribute },
  ]),
)

function resolveIdentity(agentId: string) {
  const existing = identityByAgentId.get(agentId)
  if (existing) return existing
  const asset = currentAssetProjection.agents.find((entry) => entry.stableId === agentId)
  const upstream = getCurrentAgentEventContract(agentId)
  const factionPeer = upstream
    ? currentAgentEventContracts.find(
        (candidate) =>
          candidate.identity.faction === upstream.identity.faction &&
          identityByAgentId.has(candidate.stableId),
      )
    : null
  const peerIdentity = factionPeer ? identityByAgentId.get(factionPeer.stableId) : null
  if (!upstream || !asset?.specialty || !asset.attribute || !peerIdentity)
    throw new Error(`current identity 无法从既有 authority 归一化：${agentId}`)
  const resolved = {
    agentId,
    name: asset.playerName,
    specialty: asset.specialty,
    faction: peerIdentity.faction,
    attribute: asset.attribute,
  }
  identityByAgentId.set(agentId, resolved)
  return resolved
}

function localCategoryValue(kind: 'specialty' | 'faction' | 'attribute', upstreamValue: string) {
  const upstreamPeer = currentAgentEventContracts.find(
    (contract) => contract.identity[kind] === upstreamValue,
  )
  const local = upstreamPeer ? identityByAgentId.get(upstreamPeer.stableId) : null
  if (!local)
    throw new Error(`无法把上游追加能力分类映射到 current identity：${kind}:${upstreamValue}`)
  return local[kind]
}

function compileActivationPredicate(
  agentId: string,
  predicate: AgentTeamActivationPredicate,
): TeamPredicate {
  return {
    kind: 'category_sum_minimum',
    agentId,
    terms: reviewedTeammateActivationTerms(agentId, predicate.terms).map((term) => ({
      kind: term.kind,
      value: localCategoryValue(term.kind, term.value),
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
  fieldTimeSource: { sourceId: string; locator: string }
  formulaSource: { commit: string; formulaPath: string }
  activationLocator: string
}): TeamEngineEvidenceRef[] {
  return [
    {
      sourceId: input.fieldTimeSource.sourceId,
      gameVersion: '3.1',
      status: 'candidate',
      locator: input.fieldTimeSource.locator,
    },
    {
      sourceId: `genshin-optimizer-${input.formulaSource.commit}`,
      gameVersion: '3.1',
      status: 'candidate',
      locator: `${input.formulaSource.formulaPath}; ${input.activationLocator}`,
    },
  ]
}

function compileRule(contract: (typeof currentAgentDecisionMechanicContracts)[number]): AgentRule {
  const identity = resolveIdentity(contract.agentId)
  const eventContract = getCurrentAgentEventContract(contract.agentId)
  const fieldTime = contract.fieldTimeContract
  const activation = eventContract?.teamActivationContract
  if (!identity || !eventContract || !fieldTime)
    throw new Error(`AgentRule 编译输入不完整：${contract.agentId}`)
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
      ),
      description: '按 current 公式中的属性、特性、阵营与账户状态合同判断。',
    },
    evidence: [
      ...evidenceFor({
        fieldTimeSource: fieldTime.source,
        formulaSource: eventContract.source,
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
  const existingIds = new Set(existingRules.map((rule) => rule.agentId))
  const enrichedExisting = existingRules.map((rule) => ({
    ...rule,
    capabilities: capabilitiesFor(rule.agentId),
  }))
  const compiled = currentAgentDecisionMechanicContracts
    .filter((contract) => !existingIds.has(contract.agentId))
    .map(compileRule)
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
  if (new Set(result.map((rule) => rule.agentId)).size !== result.length)
    throw new Error('AgentRule 编译结果存在重复 stable id')
  return Object.freeze(result)
}

export const current31CompiledAgentRuleContract = Object.freeze({
  contract: 'soda-current-agent-rule-compiler/v1',
  sourceFactGap: 0,
  adapterCount: 0,
  operatorCount: 1,
  boundary:
    '从 current identity、Decision Mechanic IR、事件合同和 field-time mode 编译；不按 specialty 默认站场，不把 observed synergy 当强度排序或协同全集。',
})
