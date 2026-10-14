import { describe, expect, it, vi } from 'vitest'
import type { Current31MetaCalibration } from './current31TeamStrengthCalibration'

// Isolate the projection contract from generated-model freshness. The full
// model suite separately checks real inference after the owner regenerates it.
vi.mock('./teamStrengthModel', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./teamStrengthModel')>()
  return {
    ...actual,
    inferredStrengthCalibration(
      calibration: Current31MetaCalibration,
      memberIds: readonly string[],
      disabled = false,
    ) {
      if (disabled || calibration.projectedStrengthBand) return calibration
      const score = memberIds.includes('agent-astra') ? 83 : 87
      return {
        ...calibration,
        status: 'aligned' as const,
        authority: 'model_inference' as const,
        projectedStrengthBand: 'A+' as const,
        confidenceCeiling: 'low' as const,
        recommendationScore: score,
        inference: { score, band: 'A+' as const },
      }
    },
  }
})

import { evaluateCurrent31TeamRating } from './current31TeamRating'
import { teamRecommendationScore } from './teamRecommendationScore'

const benchmark = {
  status: 'unavailable' as const,
  baselineId: null,
  outputIndex: null,
  unsupportedIssueIds: [],
  explanation: 'Projection fixture; no measured combat output.',
}

function evaluate(memberIds: readonly [string, string, string]) {
  return evaluateCurrent31TeamRating({
    candidateId: `projection:${memberIds.join('|')}`,
    memberIds,
    bangbooId: null,
    outputPotentialBand: 'unknown',
    benchmark,
  })
}

describe('model reference recommendation score projection', () => {
  it('keeps distinct same-tier model scores visible instead of replacing them with fit scores', () => {
    const lower = evaluate(['agent-astra', 'agent-cissia', 'agent-seed'])
    const higher = evaluate(['agent-aria', 'agent-burnice', 'agent-remielle'])
    expect(lower.metaCalibration.authority).toBe('model_inference')
    expect(higher.metaCalibration.authority).toBe('model_inference')
    expect(lower.rating).toMatchObject({ ratingBand: 'A+', confidence: 'low' })
    expect(higher.rating).toMatchObject({ ratingBand: 'A+', confidence: 'low' })
    expect(lower.metaCalibration.recommendationScore).toBe(83)
    expect(higher.metaCalibration.recommendationScore).toBe(87)
    expect(lower.metaCalibration.recommendationScore).toBeLessThan(
      higher.metaCalibration.recommendationScore!,
    )
    expect(teamRecommendationScore(lower.realityCheck.strengthBand, lower.featureVector)).toBe(
      teamRecommendationScore(higher.realityCheck.strengthBand, higher.featureVector),
    )
  })

  it('keeps the reviewed source tier and its established fit score', () => {
    const reviewed = evaluate(['agent-aria', 'agent-remielle', 'agent-velina'])
    expect(reviewed.metaCalibration.authority).toBe('strength_gold')
    expect(reviewed.metaCalibration.inference).toBeUndefined()
    expect(reviewed.metaCalibration.recommendationScore).toBe(
      teamRecommendationScore(reviewed.realityCheck.strengthBand, reviewed.featureVector),
    )
  })
})
