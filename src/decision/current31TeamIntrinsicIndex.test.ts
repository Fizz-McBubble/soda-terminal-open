import { describe, expect, it } from 'vitest'
import reviewedStrengthModel from '../gameDataPacks/generated/team-strength-model.3.1.json'
import { releasedAgentIds as reviewed31AgentIds } from './current31SemanticEvidence'
import { current31TeamEngineD1Pack } from '../teamEngine/current31D1Pack'
import { inspectCurrent31FormationMechanicState } from '../teamEngine/current31FormationMechanicAudit'
import { evaluateCurrent31TeamRating } from './current31TeamRating'
import {
  current31TeamIntrinsicIndexStatus,
  lookupCurrent31TeamIntrinsicSummary,
} from './current31TeamIntrinsicIndex'

const benchmark = {
  status: 'unavailable' as const,
  baselineId: null,
  outputIndex: null,
  unsupportedIssueIds: [],
  explanation: 'Intrinsic index equality oracle.',
}

const agentIds = current31TeamEngineD1Pack.agentRules
  .map((rule) => rule.agentId)
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
  it('covers the old 58-agent cohort and the explicit two-agent identity extension exactly once', () => {
    expect(oldIds.size).toBe(58)
    expect(agentIds.filter((id) => !oldIds.has(id))).toEqual(['agent-claret', 'agent-roxy'])
    expect(
      [...reviewedStrengthModel.reviewedSubjectIds].sort((left, right) =>
        left.localeCompare(right),
      ),
    ).toEqual(agentIds)
    expect(oraclePartitions.map(({ first }) => first)).toEqual(
      Array.from({ length: agentIds.length - 2 }, (_, first) => first),
    )
    expect(oraclePartitions.reduce((total, partition) => total + partition.legacyCompared, 0)).toBe(
      30_856,
    )
    expect(oraclePartitions.reduce((total, partition) => total + partition.addedCompared, 0)).toBe(
      2 * ((58 * 57) / 2) + 58,
    )
    expect(oraclePartitions.reduce((total, partition) => total + partition.compared, 0)).toBe(
      34_220,
    )
    expect(current31TeamIntrinsicIndexStatus).toMatchObject({ status: 'ready', reason: null })
    expect(
      lookupCurrent31TeamIntrinsicSummary(['agent-not-current', 'agent-billy', 'agent-anby']),
    ).toBeNull()
    expect(
      lookupCurrent31TeamIntrinsicSummary(['agent-billy', 'agent-billy', 'agent-anby']),
    ).toBeNull()
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
