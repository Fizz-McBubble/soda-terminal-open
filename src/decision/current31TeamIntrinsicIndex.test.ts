import { describe, expect, it } from 'vitest'
import reviewedStrengthModel from '../gameDataPacks/generated/team-strength-model.3.1.json'
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
        expect(indexed?.metaAuthority).toBe('model_inference')
        expect(indexed?.recommendationScore).toEqual(expect.any(Number))
        expect(indexed?.ratingBand).not.toBe('Experimental')
      }
    }
  })
  it('matches the direct evaluator for the old 58-agent cohort and the explicit two-agent identity extension', () => {
    const agentIds = current31TeamEngineD1Pack.agentRules
      .map((rule) => rule.agentId)
      .sort((left, right) => left.localeCompare(right))
    const oldIds = new Set(reviewedStrengthModel.reviewedSubjectIds)
    expect(oldIds.size).toBe(58)
    expect(agentIds.filter((id) => !oldIds.has(id))).toEqual(['agent-claret', 'agent-roxy'])
    let legacyCompared = 0
    let addedCompared = 0
    let compared = 0
    for (let first = 0; first < agentIds.length - 2; first += 1) {
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
    }
    expect(current31TeamIntrinsicIndexStatus).toMatchObject({ status: 'ready', reason: null })
    expect(
      lookupCurrent31TeamIntrinsicSummary(['agent-not-current', 'agent-billy', 'agent-anby']),
    ).toBeNull()
    expect(
      lookupCurrent31TeamIntrinsicSummary(['agent-billy', 'agent-billy', 'agent-anby']),
    ).toBeNull()
    expect(legacyCompared).toBe(30_856)
    expect(addedCompared).toBe(2 * ((58 * 57) / 2) + 58)
    expect(compared).toBe(34_220)
  }, 60_000)
})
