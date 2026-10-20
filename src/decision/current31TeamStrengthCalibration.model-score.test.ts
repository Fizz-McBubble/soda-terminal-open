import { describe, expect, it, vi } from 'vitest'
import type { Current31MetaCalibration } from './current31TeamStrengthCalibration'

// Simulate a stale caller that still promotes model output. Projection must
// reject it even when its status, tier and recommendation score are populated.
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

describe('diagnostic model score authority boundary', () => {
  it('rejects legacy promoted model tiers and scores while retaining diagnostics', () => {
    const lower = evaluate(['agent-astra', 'agent-cissia', 'agent-seed'])
    const higher = evaluate(['agent-aria', 'agent-burnice', 'agent-remielle'])
    expect(lower.metaCalibration.authority).toBe('model_inference')
    expect(higher.metaCalibration.authority).toBe('model_inference')
    for (const result of [lower, higher]) {
      expect(result.rating).toMatchObject({
        ratingBand: 'Experimental',
        confidence: 'experimental',
      })
      expect(result.realityCheck.strengthBand).toBeNull()
      expect(result.realityCheck.status).not.toBe('calibrated_band_supported')
      expect(result.metaCalibration.recommendationScore).toBeUndefined()
    }
    expect(lower.metaCalibration.inference?.score).toBe(83)
    expect(higher.metaCalibration.inference?.score).toBe(87)
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
