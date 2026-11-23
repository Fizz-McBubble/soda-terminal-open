// @vitest-environment node
import { describe, expect, it } from 'vitest'
import reviewedStrengthModel from '../gameDataPacks/generated/team-strength-model.3.1.json'
import { releasedAgentIds as reviewed31AgentIds } from './current31SemanticEvidence'
import { currentAssetProjection } from '../gameDataPacks/currentAssetProjection'
import {
  baseCurrentAgentEventContracts,
  getCurrentAgentEventContract,
} from '../calculation/currentAgentMechanicContracts'
import { inspectCurrent31FormationMechanicState } from '../teamEngine/current31FormationMechanicAudit'
import { evaluateCurrent31TeamRating } from './current31TeamRating'
import {
  current31TeamIntrinsicIndexStatus,
  lookupCurrent31TeamIntrinsicSummary,
  lookupCurrent31TeamIntrinsicDetails,
} from './current31TeamIntrinsicIndex'

const benchmark = {
  status: 'unavailable' as const,
  baselineId: null,
  outputIndex: null,
  unsupportedIssueIds: [],
  explanation: 'Intrinsic index equality oracle.',
}

const goAgentIds = baseCurrentAgentEventContracts.map((contract) => contract.stableId).sort()
const agentIds = currentAssetProjection.agents
  .filter((agent) => agent.releaseState === 'released' && agent.accountOwnable)
  .map((agent) => agent.stableId)
  .sort((left, right) => left.localeCompare(right))
// Historical coverage stays tied to the frozen 3.1 cohort after model adoption
// extends its reviewed scope to the two current-version subjects.
const oldIds = new Set(reviewed31AgentIds)
const pairCount = (count: number) => (count * (count - 1)) / 2
// Each sorted triple belongs to exactly one first-member partition. Bound the
// individual test's work without sampling or changing the direct oracle.
const oraclePartitions = agentIds.slice(0, -2).map((firstMember, first) => {
  const compared = pairCount(agentIds.length - first - 1)
  const legacyCompared = oldIds.has(firstMember)
    ? pairCount(agentIds.slice(first + 1).filter((id) => oldIds.has(id)).length)
    : 0
  return { firstMember, first, compared, legacyCompared, addedCompared: compared - legacyCompared }
})

describe('current 3.1 build-time team intrinsic index', () => {
  it('smoke: saved details retain the exact trio and are isolated across queries', () => {
    const ids = ['agent-claret', 'agent-norma', 'agent-rina'] as const
    const a = lookupCurrent31TeamIntrinsicDetails(ids, 'first')!
    const b = lookupCurrent31TeamIntrinsicDetails([...ids].reverse(), 'second')!
    expect(a.rating.status).toBe('rated')
    expect(a.featureVector.memberIds).toEqual([...ids].sort())
    expect(a.formedTeamReference.members.map((row) => row.agentId).sort()).toEqual([...ids].sort())
    expect(b.rating.candidateId).toBe('second')
    a.formedTeamReference.members[0]!.mindscape = 0
    expect(b.formedTeamReference.members[0]!.mindscape).toBeGreaterThan(0)
    expect(lookupCurrent31TeamIntrinsicDetails(['unknown', ...ids.slice(1)], 'missing')).toBeNull()
  })
  it('smoke: binds current adoption and matches representative old and new summaries', () => {
    expect(current31TeamIntrinsicIndexStatus).toMatchObject({
      status: 'ready',
      reason: null,
      referenceContinuity: null,
    })
    for (const memberIds of [
      ['agent-yixuan', 'agent-ju-fufu', 'agent-lucia'],
      ['agent-billy', 'agent-anby', 'agent-nicole'],
      ['agent-claret', 'agent-roxy', 'agent-koleda'],
      ['agent-claret', 'agent-roxy', 'agent-rina'],
      ['agent-manato', 'agent-lucia', 'agent-ju-fufu'],
      ['agent-yixuan', 'agent-pan-yinhu', 'agent-ju-fufu'],
      ['agent-jane', 'agent-burnice', 'agent-caesar'],
      ['agent-zhu-yuan', 'agent-qingyi', 'agent-nicole'],
    ] as const) {
      const indexed = lookupCurrent31TeamIntrinsicSummary(memberIds)
      const direct = evaluateCurrent31TeamRating({
        candidateId: 'smoke',
        memberIds,
        bangbooId: null,
        outputPotentialBand: 'unknown',
        benchmark,
      })
      expect(indexed).toMatchObject({
        ratingStatus: direct.rating.status,
        metaAuthority: direct.metaCalibration.authority,
        recommendationScore: direct.metaCalibration.recommendationScore ?? null,
      })
      if (memberIds.includes('agent-claret' as never))
        expect(indexed?.metaAuthority).not.toBe('strength_gold')
      if (
        memberIds.includes('agent-jane' as never) ||
        memberIds.includes('agent-zhu-yuan' as never)
      ) {
        expect(indexed?.metaAuthority).toBe('none')
        expect(indexed?.recommendationScore).toBeNull()
        expect(indexed?.ratingBand).toBe('Experimental')
      }
    }
  })
  it('smoke: covers the old 58 and GO 60 cohorts plus the Phoenix and Severian extensions exactly once', () => {
    expect(oldIds.size).toBe(58)
    expect(agentIds).toHaveLength(62)
    expect(goAgentIds).toHaveLength(60)
    expect(agentIds.filter((id) => !oldIds.has(id))).toEqual([
      'agent-claret',
      'agent-phoenix',
      'agent-roxy',
      'agent-severian',
    ])
    expect(
      agentIds.filter((id) => !['agent-phoenix', 'agent-severian'].includes(id)).sort(),
    ).toEqual(goAgentIds)
    expect((goAgentIds.length * (goAgentIds.length - 1) * (goAgentIds.length - 2)) / 6).toBe(34_220)
    expect(
      [...reviewedStrengthModel.reviewedSubjectIds].sort((left, right) =>
        left.localeCompare(right),
      ),
    ).toEqual(goAgentIds)
    expect(oraclePartitions.map(({ first }) => first)).toEqual(
      Array.from({ length: agentIds.length - 2 }, (_, first) => first),
    )
    expect(oraclePartitions.reduce((total, partition) => total + partition.legacyCompared, 0)).toBe(
      30_856,
    )
    expect(oraclePartitions.reduce((total, partition) => total + partition.addedCompared, 0)).toBe(
      2 * ((58 * 57) / 2) + 58 + pairCount(60) + pairCount(61),
    )
    expect(oraclePartitions.reduce((total, partition) => total + partition.compared, 0)).toBe(
      37_820,
    )
    expect(current31TeamIntrinsicIndexStatus).toMatchObject({ status: 'ready', reason: null })
    expect(
      lookupCurrent31TeamIntrinsicSummary(['agent-not-current', 'agent-billy', 'agent-anby']),
    ).toBeNull()
    expect(
      lookupCurrent31TeamIntrinsicSummary(['agent-billy', 'agent-billy', 'agent-anby']),
    ).toBeNull()
  })

  it('smoke: binds Phoenix local references to the reviewed aggregate event boundary', () => {
    const memberIds = ['agent-phoenix', 'agent-velina', 'agent-remielle'] as const
    const indexed = lookupCurrent31TeamIntrinsicSummary(memberIds)
    const direct = evaluateCurrent31TeamRating({
      candidateId: 'phoenix-smoke',
      memberIds,
      bangbooId: null,
      outputPotentialBand: 'unknown',
      benchmark,
    })
    expect(indexed).toMatchObject({
      ratingStatus: 'rated',
      ratingBand: 'S',
      confidence: 'low',
      metaAuthority: 'local_editorial_estimate',
      mechanicValidity: 'partial',
      mechanicallyClosed: true,
    })
    expect(direct.rating).toMatchObject({ status: 'rated', ratingBand: 'S', confidence: 'low' })
    expect(inspectCurrent31FormationMechanicState(memberIds)).toMatchObject({
      ruleComplete: true,
      resourceLoopClosed: true,
      fieldTimeWithinBudget: true,
    })
    expect(direct.interaction.status).toBe('supported')
    expect(getCurrentAgentEventContract('agent-phoenix')?.eventContract.events).toHaveLength(20)
    expect(
      getCurrentAgentEventContract('agent-phoenix')?.eventContract.events.every(
        (event) => event.formulaBinding?.formalEligible === false,
      ),
    ).toBe(true)
    const unknown = lookupCurrent31TeamIntrinsicSummary([
      'agent-phoenix',
      'agent-jane',
      'agent-yuzuha',
    ])
    expect(unknown).not.toBeNull()
    expect(unknown?.ratingBand).not.toBe('S')
    expect(unknown?.metaAuthority).toBe('none')
    expect(unknown?.mechanicallyClosed).toBe(false)
  })

  it.each(oraclePartitions)(
    'matches the direct evaluator for first member $firstMember ($compared triples)',
    ({
      first,
      compared: expectedCompared,
      legacyCompared: expectedLegacy,
      addedCompared: expectedAdded,
    }) => {
      let legacyCompared = 0
      let addedCompared = 0
      let compared = 0
      for (let second = first + 1; second < agentIds.length - 1; second += 1) {
        for (let third = second + 1; third < agentIds.length; third += 1) {
          const memberIds = [agentIds[first]!, agentIds[second]!, agentIds[third]!] as const
          const indexed = lookupCurrent31TeamIntrinsicSummary(memberIds)
          const direct = evaluateCurrent31TeamRating({
            candidateId: `oracle:${memberIds.join('+')}`,
            memberIds,
            bangbooId: null,
            outputPotentialBand: 'unknown',
            // Match the source/mechanic-only index producer. Diagnostic payloads
            // are not serialized; default-mode smoke cases above remain separate.
            reviewedOnly: true,
            benchmark,
          })
          const mechanic = inspectCurrent31FormationMechanicState(memberIds)
          expect(indexed, memberIds.join('|')).toMatchObject({
            ratingStatus: direct.rating.status,
            ratingBand: direct.rating.status === 'rated' ? direct.rating.ratingBand : null,
            confidence: direct.rating.status === 'rated' ? direct.rating.confidence : null,
            recommendationScore: direct.metaCalibration.recommendationScore ?? null,
            mechanicValidity: direct.mechanicValidity,
            mainstreamStatus: direct.mainstreamRecognition.status,
            metaAuthority: direct.metaCalibration.authority,
            mechanicallyClosed:
              mechanic.ruleComplete &&
              mechanic.activationAtBase &&
              mechanic.resourceLoopClosed &&
              mechanic.fieldTimeWithinBudget,
            hasPreliminaryDirection: direct.metaCalibration.authority === 'recovered_preliminary',
          })
          if (memberIds.every((id) => oldIds.has(id))) legacyCompared += 1
          else addedCompared += 1
          compared += 1
        }
      }
      expect(legacyCompared).toBe(expectedLegacy)
      expect(addedCompared).toBe(expectedAdded)
      expect(compared).toBe(expectedCompared)
    },
    60_000,
  )
})
