import { createGenericTeamRankingReader } from './teamGenericRanking'
import { stableContentHash } from '../gameDataPacks/types'
import { currentVersionProjection } from '../gameDataPacks/currentVersionProjection'
import { current31TeamIntrinsicIndexStatus } from './current31TeamIntrinsicIndex'
import { teamStrengthMechanicDataFingerprint } from './teamStrengthMechanicFeatures'
import {
  teamGenericRankingPolicy,
  genericRankingAuthorities,
  genericRankingBands,
  genericRankingConfidences,
  genericRankingClassificationBases,
} from './teamGenericRankingMethod'
import { genericFinitePlayIdentity, type GenericPlayDetails } from './teamGenericPlayBinding'
import type { TeamMechanismDirection } from './teamMechanismDirection'
import {
  buildTeamMechanismCatalog,
  type TeamPlayMechanismProof,
} from '../domain/teamPlayMechanismContract'
import { formedTeamCultivation } from './formedTeamCultivation'
const fixtureDetails = new WeakMap<object, GenericPlayDetails>()
const seal = <T extends object>(content: T) => {
  const sealed = { ...content, contentHash: stableContentHash(content) }
  if (fixtureDetails.has(content)) fixtureDetails.set(sealed, fixtureDetails.get(content)!)
  return sealed
}
// Structural reader/producer fixture, never a production rating or accuracy
// sample. Current identities are required even for a synthetic encoding probe.
function compactFixture() {
  const input = {
    contract: teamGenericRankingPolicy.contract,
    producer: 'soda-generic-team-ranking-producer/v1',
    gameVersion: currentVersionProjection.gameVersion,
    intrinsicIndexContentHash: current31TeamIntrinsicIndexStatus.contentHash,
    mechanicDataFingerprint: teamStrengthMechanicDataFingerprint,
    policy: teamGenericRankingPolicy,
    agentIds: ['agent-alice', 'agent-aria', 'agent-astra', 'agent-anby'],
    statuses: ['recommended', 'exploration', 'unsupported'],
    bands: [...genericRankingBands],
    confidences: [...genericRankingConfidences],
    authorities: [...genericRankingAuthorities],
    systems: ['direct_damage', 'attribute_anomaly', 'rupture', 'aftershock', 'sharp'],
    sourceRefs: ['source:declared-mechanic'],
    classificationBases: [...genericRankingClassificationBases],
    playIdentities: [] as string[],
    mechanismCatalog: buildTeamMechanismCatalog([]),
    proofs: [
      [0, 2, 0],
      [-1, 3],
    ],
    rows: [
      [0, 1, 2, 0, -1, -1, 4, 1, 0, 0, 0],
      [0, 1, 3, 1, -1, -1, -1, 0, 1, 1, -1],
      [0, 2, 3, 1, -1, -1, -1, 0, 2, 1, -1],
      [1, 2, 3, 1, -1, -1, -1, 0, 3, 1, -1],
    ],
    evidence: {} as Record<
      string,
      {
        sourceRefs: string[]
        sourceAuthority: string
        primaryOutputAgentId: string | null
        classificationBasis: string | null
      }
    >,
    evidenceCoverage: { gradedReferences: 0, compactRows: 4 },
    coverage: { total: 4, recommended: 1, exploration: 3, unsupported: 0 },
  }
  const memberIds = input.agentIds.slice(0, 3)
  const [primary, ...peers] = memberIds
  const proof: TeamPlayMechanismProof = {
    contract: 'team-play-mechanism/v1',
    roleChecks: memberIds.map((agentId, index) => ({
      agentId,
      role: index ? 'support' : 'primary_output',
      qualified: true,
      basis: [`source:${agentId}`],
      channels: [index ? 'buff' : 'output'],
    })),
    requirements: [
      ...(['action', 'resource', 'primary_route', 'original_anomaly'] as const).map((kind) => ({
        agentId: primary!,
        kind,
        status: 'required' as const,
        bindingKeys: [kind === 'resource' ? 'resource:output' : 'event:output'],
        referenceKeys: [],
        sourceRefs: ['source:output'],
      })),
      ...peers.flatMap((agentId) => [
        {
          agentId,
          kind: 'action' as const,
          status: 'required' as const,
          bindingKeys: [`event:${agentId}`],
          referenceKeys: [],
          sourceRefs: [`source:${agentId}`],
        },
        ...(['effect', 'recipient'] as const).map((kind) => ({
          agentId,
          recipientAgentId: primary!,
          kind,
          status: 'required' as const,
          bindingKeys: [`effect:${agentId}`],
          referenceKeys: [],
          sourceRefs: [`source:${agentId}`],
        })),
        {
          agentId,
          kind: 'field_handoff' as const,
          status: 'required' as const,
          bindingKeys: [`event:${agentId}`],
          referenceKeys: [],
          sourceRefs: [`source:${agentId}`],
        },
      ]),
    ],
  }
  const play: NonNullable<TeamMechanismDirection['playability']> = {
    contract: 'finite-three-member-play/v2',
    memberIds,
    primaryOutputAgentId: primary!,
    outputSystem: 'attribute_anomaly',
    roles: [
      {
        agentId: primary!,
        role: 'primary_output',
        purpose: '输出',
        eventIds: ['event:output'],
        sourceRefs: ['source:output'],
      },
      ...peers.map((agentId) => ({
        agentId,
        role: 'support' as const,
        purpose: '增益',
        eventIds: [`event:${agentId}`],
        sourceRefs: [`source:${agentId}`],
      })),
    ],
    contributions: peers.map((agentId) => ({
      providerAgentId: agentId,
      recipientAgentId: primary!,
      role: 'support',
      effectKeys: [`effect:${agentId}`],
      eventIds: [`event:${agentId}`],
      state: 'conditional',
      sourceRefs: [`source:${agentId}`],
    })),
    conditions: [
      {
        agentId: primary!,
        kind: 'resource',
        label: '资源',
        referenceKeys: ['resource:output'],
        sourceRefs: ['source:output'],
      },
      {
        agentId: primary!,
        kind: 'original_anomaly',
        label: '原始异常积蓄动作',
        referenceKeys: ['event:output'],
        sourceRefs: ['source:output'],
      },
      ...peers.flatMap((agentId) => [
        {
          agentId,
          kind: 'trigger' as const,
          label: '触发',
          referenceKeys: [`event:${agentId}`],
          sourceRefs: [`source:${agentId}`],
        },
        {
          agentId,
          kind: 'recipient' as const,
          label: '接受者',
          referenceKeys: [`effect:${agentId}`],
          sourceRefs: [`source:${agentId}`],
        },
      ]),
    ],
    reason: '各成员执行来源动作并交接增益',
    tradeoffs: ['输出强度未知'],
    mechanismProof: proof,
  }
  const direction: TeamMechanismDirection = {
    status: 'conditional',
    primaryOutputAgentId: primary!,
    evidenceRefs: [...input.sourceRefs],
    recipients: peers.map((agentId) => ({
      providerAgentId: agentId,
      recipientAgentId: primary!,
      effectIdentity: `effect:${agentId}`,
    })),
    playability: play,
    variants: [play],
    boundary: '条件玩法',
  }
  input.mechanismCatalog = buildTeamMechanismCatalog([
    { row: 0, key: [...memberIds].sort().join('|'), variants: direction.variants },
  ])
  const details: GenericPlayDetails = {
    formedTeamReference: formedTeamCultivation(memberIds),
    prerequisiteStatus: 'eligible',
    primaryOutputAgentId: direction.primaryOutputAgentId,
    mechanismDirection: direction,
  }
  fixtureDetails.set(input, details)
  input.playIdentities = [
    genericFinitePlayIdentity(input.intrinsicIndexContentHash!, memberIds, details)!,
  ]
  return input
}

function readFixture(input: ReturnType<typeof seal<ReturnType<typeof compactFixture>>>) {
  const details = fixtureDetails.get(input)!
  return createGenericTeamRankingReader(input, {
    status: 'ready',
    contentHash: current31TeamIntrinsicIndexStatus.contentHash,
    lookup: () => (details ? structuredClone(details) : null),
  })
}

export { fixtureDetails, seal, compactFixture, readFixture }
