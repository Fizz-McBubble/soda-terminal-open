import { describe, expect, it } from 'vitest'
import artifact from './teamSystemRankingData.mjs'
import { stableContentHash } from '../gameDataPacks/types'
import { current31TeamIntrinsicIndexStatus } from './current31TeamIntrinsicIndex'
import { teamStrengthMechanicDataFingerprint } from './teamStrengthMechanicFeatures'
import {
  createTeamSystemRankingReader,
  currentSystemRankingSameCoreIntegrationContract,
  currentTeamSystemRankingContract,
  currentTeamSystemRankingProducerContract,
  currentTeamSystemRankingStatus,
  lookupCurrentTeamSystemRanking,
} from './teamSystemRanking'
import {
  teamStrengthStandardFiniteEventConditionsContract,
  teamStrengthStandardFiniteEventConditionsScenario,
} from './teamStrengthStandardFiniteEventConditions'
import { teamSameCoreOutputComparisonPolicy } from './teamSameCoreOutputComparison'
import { teamSameCoreApplicableCoordinatesPolicy } from './teamSameCoreApplicableCoordinates'
import { teamSystemRankingMethodContract } from './teamSystemRankingMethod'

const agentIds = ['agent-a', 'agent-b', 'agent-c', 'agent-d', 'agent-e']
const systems = ['direct_damage', 'attribute_anomaly', 'rupture', 'aftershock', 'sharp']
const statuses = ['ranked', 'unsupported']
const classificationBases = [
  'reviewed_exact_team_output_module',
  'primary_special_output_family',
  'anomaly_output_capacity',
  'standard_direct_output',
]
const reasons = [
  'mechanic_evidence_missing',
  'member_action_evidence_unavailable',
  'invalid_mechanics',
  'no_primary_output',
  'no_classifiable_output',
  'nonfinite_mechanic_capacity',
]

function sourceClosure() {
  return [
    {
      path: 'src/calculation/fixedEventSupportContribution32.ts',
      sha256: 'a'.repeat(64),
    },
    {
      path: 'src/decision/teamSameCoreApplicableCoordinates.ts',
      sha256: 'b'.repeat(64),
    },
    {
      path: 'src/decision/teamSameCoreOutputComparison.ts',
      sha256: 'c'.repeat(64),
    },
    {
      path: 'src/decision/teamStrengthStandardFiniteEventConditions.ts',
      sha256: 'd'.repeat(64),
    },
    {
      path: 'src/decision/teamStrengthSupportContribution.ts',
      sha256: 'e'.repeat(64),
    },
    {
      path: 'src/decision/teamSystemRankingMethod.ts',
      sha256: 'f'.repeat(64),
    },
  ]
}

function candidateArtifact() {
  const triples: number[][] = []
  for (let first = 0; first < agentIds.length; first += 1)
    for (let second = first + 1; second < agentIds.length; second += 1)
      for (let third = second + 1; third < agentIds.length; third += 1)
        triples.push([first, second, third])
  const rows = triples.map(([first, second, third], ordinal) => {
    const systemIndex = ordinal % systems.length
    const rank = Math.floor(ordinal / systems.length) + 1
    return [first!, second!, third!, 0, systemIndex, rank, rank, ordinal % 4, -1]
  })
  const systemCounts = Object.fromEntries(
    systems.map((system, index) => [system, rows.filter((row) => row[4] === index).length]),
  )
  const basisCounts = Object.fromEntries(
    classificationBases.map((basis, index) => [
      basis,
      rows.filter((row) => row[7] === index).length,
    ]),
  )
  const closure = sourceClosure()
  const content = {
    contract: currentTeamSystemRankingContract,
    producerProtocol: currentTeamSystemRankingProducerContract,
    gameVersion: '3.3',
    intrinsicIndexContentHash: current31TeamIntrinsicIndexStatus.contentHash,
    mechanicDataFingerprint: teamStrengthMechanicDataFingerprint,
    methodContract: teamSystemRankingMethodContract,
    adoptionStatus: 'production',
    productionEligible: true,
    agentIds,
    systems,
    statuses,
    classificationBases,
    reasons,
    rows,
    sameCoreOutput: {
      protocol: currentSystemRankingSameCoreIntegrationContract,
      comparisonContract: teamSameCoreOutputComparisonPolicy.contract,
      productionEligible: teamSameCoreOutputComparisonPolicy.productionEligible,
      conditionPolicy: 'explicit-only',
      standardConditionIdentity: {
        baseline: 'fixture',
        finiteEventConditions: teamStrengthStandardFiniteEventConditionsContract,
        finiteEventConditionScenario: teamStrengthStandardFiniteEventConditionsScenario,
        applicableCoordinateContract: teamSameCoreApplicableCoordinatesPolicy.contract,
        applicableCoordinateSystems: teamSameCoreApplicableCoordinatesPolicy.systems,
      },
      boundary: 'declared finite event only',
      records: [
        {
          memberIds: ['agent-a', 'agent-b', 'agent-c'],
          subjectAgentId: 'agent-a',
          protocol: 'fixture',
          status: 'supported',
          referenceIdentity: 'fnv1a-fixture',
          referenceStatus: 'explicit_numeric',
          sourceAuthority: 'strength_gold',
          eventPacketIdentity: 'fnv1a-event',
          outputSystem: 'direct_damage',
          baselineIdentity: 'fnv1a-baseline',
          eventUsages: [],
          declaredReferences: {},
          fixedEventValue: 100,
          consumedBuckets: [],
          unknownEffectKeys: [],
          blockers: [],
          boundary: 'declared finite event only',
        },
      ],
      coverage: {
        declaredTeams: 1,
        supported: 1,
        partial: 0,
        unsupported: 0,
        evaluation: {
          evaluated: 1,
          supportedTeams: 1,
          partialTeams: 0,
          unsupportedTeams: 0,
          tracedTeams: 1,
        },
      },
      unknownEffectCounts: {},
    },
    coverage: {
      total: rows.length,
      ranked: rows.length,
      unsupported: 0,
      systems: systemCounts,
      reasons: Object.fromEntries(reasons.map((reason) => [reason, 0])),
      classificationBases: basisCounts,
    },
    validation: {
      fixedCounterexamples: {
        contract: 'soda-team-system-ranking-fixed-counterexamples/v1',
        total: 9,
        preserved: 9,
        crossOwnerIncomparable: 8,
        boundaryViolations: 0,
        records: Array.from({ length: 9 }, (_, index) => ({
          id:
            index === 7 ? 'dialyn-sunna-ye-shunguang__trigger-ye-shunguang-zhao' : `pair-${index}`,
          samePrimaryOutput: index === 7,
          relation: 'incomparable',
        })),
      },
      standardFiniteEvent: {
        contract: 'soda-team-standard-finite-event-replay/v1',
        scenario: teamStrengthStandardFiniteEventConditionsScenario,
        total: 3,
        supported: 3,
        ordered: 3,
        boundary: 'declared finite event only',
        records: [
          ['dialyn-sunna-ye-shunguang__trigger-ye-shunguang-zhao', 'right'],
          ['ye-sunna-billy__ye-zhao-billy', 'right'],
          ['ye-dialyn-billy__ye-trigger-billy', 'left'],
        ].map(([id, relation]) => ({
          id,
          leftStatus: 'supported',
          rightStatus: 'supported',
          relation,
          fixedEventDelta: relation === 'left' ? 100 : -100,
          conditionIdentity: { left: 'fnv1a-left', right: 'fnv1a-right' },
          sourceIdentity: {
            left: {
              referenceConditionInstance: 'fnv1a-observation-left',
              planningConditions: {
                version: 'planning32-source-condition-domains-v7',
                sourceHash: 'fnv1a-catalog',
              },
            },
            right: {
              referenceConditionInstance: 'fnv1a-observation-right',
              planningConditions: {
                version: 'planning32-source-condition-domains-v7',
                sourceHash: 'fnv1a-catalog',
              },
            },
          },
          observationLayer: {
            left: { status: 'standard_reference', sourceAuthority: 'strength_gold' },
            right: { status: 'standard_reference', sourceAuthority: 'strength_gold' },
          },
          bindings: {
            left: [
              {
                referenceKey: 'fixture',
                recipientAgentIds: ['agent-ye-shunguang'],
                sourceRefs: ['fixture:source'],
              },
            ],
            right: [
              {
                referenceKey: 'fixture',
                recipientAgentIds: ['agent-ye-shunguang'],
                sourceRefs: ['fixture:source'],
              },
            ],
          },
        })),
      },
    },
    inputFingerprints: {
      intrinsicIndex: current31TeamIntrinsicIndexStatus.contentHash,
      mechanicData: teamStrengthMechanicDataFingerprint,
      methodContract: teamSystemRankingMethodContract,
      methodSha256: 'method',
      generatorSha256: 'generator',
      sourceClosureIdentity: stableContentHash(closure),
      sourceClosureSha256: 'e'.repeat(64),
      sourceClosure: closure,
    },
  }
  return { ...content, contentHash: stableContentHash(content) }
}

function reseal(artifactToChange: ReturnType<typeof candidateArtifact>) {
  const content = { ...artifactToChange } as Record<string, unknown>
  delete content.contentHash
  return { ...content, contentHash: stableContentHash(content) }
}

describe('current team system ranking production consumer', () => {
  it('keeps the adopted v3 artifact non-production while stale v2 remains closed', () => {
    expect(artifact).toHaveProperty('contract', currentTeamSystemRankingContract)
    expect(artifact).toHaveProperty('producerProtocol', currentTeamSystemRankingProducerContract)
    expect(artifact).toMatchObject({
      adoptionStatus: 'development_candidate',
      productionEligible: false,
    })
    expect(currentTeamSystemRankingStatus).toMatchObject({
      status: 'unavailable',
      reason: 'ranking production eligibility missing',
      productionEligible: null,
    })
    expect(lookupCurrentTeamSystemRanking(['agent-remielle', 'agent-velina', 'agent-aria'])).toBe(
      null,
    )
    if (!artifact || typeof artifact !== 'object' || Array.isArray(artifact))
      throw new Error('ranking artifact must be an object')
    const staleV2Reader = createTeamSystemRankingReader({
      ...artifact,
      contract: 'soda-current-team-system-ranking/v2',
    })
    expect(staleV2Reader.status).toMatchObject({
      status: 'unavailable',
      reason: 'contract mismatch',
      productionEligible: null,
    })
    expect(staleV2Reader.lookup(['agent-remielle', 'agent-velina', 'agent-aria'])).toBeNull()
  })

  it('validates the complete artifact before the current method eligibility gate', () => {
    const artifactValue = candidateArtifact()
    const reader = createTeamSystemRankingReader(artifactValue)
    expect(reader.status).toMatchObject({
      status: 'unavailable',
      reason: 'ranking method is not production eligible',
    })
    expect(reader.lookup(['agent-a', 'agent-b', 'agent-c'])).toBeNull()
  })

  it('fails closed on incomplete dictionaries, row identities and dense-rank depth', () => {
    const dictionary = candidateArtifact()
    dictionary.systems = ['direct_damage']
    expect(createTeamSystemRankingReader(reseal(dictionary)).status.reason).toBe(
      'ranking dictionaries invalid',
    )

    const duplicate = candidateArtifact()
    duplicate.rows[1] = [...duplicate.rows[0]!]
    expect(createTeamSystemRankingReader(reseal(duplicate)).status.reason).toBe(
      'duplicate row identity',
    )

    const conflictingRank = candidateArtifact()
    conflictingRank.rows[1]![6] = 9
    expect(createTeamSystemRankingReader(reseal(conflictingRank)).status.reason).toBe(
      'ranking depth is not increasing for attribute_anomaly',
    )
  })

  it('fails closed on missing helper closure, incomplete fixed pairs and partial event leakage', () => {
    const closure = candidateArtifact()
    closure.inputFingerprints.sourceClosure = closure.inputFingerprints.sourceClosure.filter(
      (row) => row.path !== 'src/decision/teamSameCoreOutputComparison.ts',
    )
    closure.inputFingerprints.sourceClosureIdentity = stableContentHash(
      closure.inputFingerprints.sourceClosure,
    )
    expect(createTeamSystemRankingReader(reseal(closure)).status.reason).toBe(
      'source closure missing required ranking helper',
    )

    const fixed = candidateArtifact()
    fixed.validation.fixedCounterexamples!.records!.pop()
    expect(createTeamSystemRankingReader(reseal(fixed)).status.reason).toBe(
      'fixed counterexample replay incomplete',
    )

    const partial = candidateArtifact()
    partial.sameCoreOutput.records[0] = {
      ...(partial.sameCoreOutput.records[0] as unknown as Record<string, unknown>),
      status: 'partial',
      fixedEventValue: 100,
      unknownEffectKeys: ['unresolved-effect'],
    } as unknown as (typeof partial.sameCoreOutput.records)[number]
    partial.sameCoreOutput.coverage.supported = 0
    partial.sameCoreOutput.coverage.partial = 1
    partial.sameCoreOutput.coverage.evaluation!.supportedTeams = 0
    partial.sameCoreOutput.coverage.evaluation!.partialTeams = 1
    expect(createTeamSystemRankingReader(reseal(partial)).status.reason).toBe(
      'partial same-core record is not fail-closed',
    )
  })
})
