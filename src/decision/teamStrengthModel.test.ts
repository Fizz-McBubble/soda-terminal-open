import { describe, expect, it, vi } from 'vitest'
import { current31StrengthGoldSet } from './current31StrengthGoldSet'
import {
  current31TeamStrengthCalibrationContractId,
  resolveCurrent31MetaCalibration,
  type Current31MetaCalibration,
} from './current31TeamStrengthCalibration'
import { evaluateCurrent31TeamRating } from './current31TeamRating'
import { reviewedTeamAnalysis } from './reviewedTeamAnalysis'
import { reviewedTeamPublishedStrength } from './reviewedTeamPublishedStrength'
import { inferTeamStrength, inferredStrengthCalibration } from './teamStrengthModel'
import { teamDecisionAuthorityContractId, type TeamRatingResult } from './teamDecisionAuthority'
import strengthArtifact from '../gameDataPacks/generated/team-strength-model.3.1.json'
import {
  extractTeamStrengthMechanicFeatures,
  teamStrengthCoefficientDirections,
  teamStrengthMechanicFeatureNames,
} from './teamStrengthMechanicFeatures'
import { predictStrengthRegression } from './teamStrengthRegression'
import { teamRecommendationScore } from './teamRecommendationScore'
import { constrainTeamStrengthScore } from './teamStrengthModelScore'

const unavailableBenchmark = {
  status: 'unavailable' as const,
  baselineId: null,
  outputIndex: null,
  unsupportedIssueIds: [],
  explanation: 'No reference-performance comparison is used by this test.',
}

const inferredTeam = ['agent-nekomata', 'agent-caesar', 'agent-rina'] as const

function exactKey(memberIds: readonly string[]) {
  return [...memberIds].sort().join('|')
}

function sourceRatedTeams() {
  return [
    ...current31StrengthGoldSet.cases,
    ...current31StrengthGoldSet.versionedTeamStrengthSupplements,
    ...reviewedTeamPublishedStrength.facts,
    ...reviewedTeamAnalysis.records,
  ].map(({ memberIds }) => [...memberIds] as [string, string, string])
}

function mechanicRating(candidateId: string): TeamRatingResult {
  return {
    contract: teamDecisionAuthorityContractId,
    status: 'rated',
    candidateId,
    featureFingerprint: `fixture:${candidateId}`,
    ratingBand: 'A',
    confidence: 'low',
    explanation: 'Fixture mechanic grade; not a strength label.',
    tradeoffs: [],
  }
}

function emptyCalibration(): Current31MetaCalibration {
  return {
    contract: current31TeamStrengthCalibrationContractId,
    status: 'insufficient',
    authority: 'none',
    kernelId: null,
    familyId: null,
    versionPosition: null,
    projectedStrengthBand: null,
    evidenceRefs: [],
    explanation: 'No exact source strength.',
  }
}

function evaluate(
  memberIds: readonly [string, string, string],
  options: { bangbooId?: string | null; reviewedOnly?: boolean } = {},
) {
  return evaluateCurrent31TeamRating({
    candidateId: `model-test:${exactKey(memberIds)}`,
    memberIds,
    bangbooId: options.bangbooId ?? null,
    outputPotentialBand: 'unknown',
    benchmark: unavailableBenchmark,
    reviewedOnly: options.reviewedOnly,
  })
}

describe('team strength model fallback', () => {
  it('never lowers a prediction when only a usable capacity grows, or rewards a proven cost', () => {
    for (const memberIds of [...sourceRatedTeams(), inferredTeam]) {
      const features = extractTeamStrengthMechanicFeatures(memberIds)
      if (!features.eligibility.eligible) continue
      const baseline = predictStrengthRegression(strengthArtifact.regression, features.values)
      teamStrengthCoefficientDirections.forEach((direction, index) => {
        if (!direction) return
        const increased = [...features.values]
        increased[index]! += 0.1
        const delta = predictStrengthRegression(strengthArtifact.regression, increased) - baseline
        expect(
          direction * delta,
          `${exactKey(memberIds)}:${teamStrengthMechanicFeatureNames[index]}`,
        ).toBeGreaterThanOrEqual(-1e-10)
      })
    }
  })
  it('does not penalize the actual source-bound Nekomata potential-six capacity', () => {
    const ids = ['agent-anby', 'agent-nekomata', 'agent-nicole']
    const p0 = extractTeamStrengthMechanicFeatures(ids)
    const p6 = extractTeamStrengthMechanicFeatures(
      ids,
      {},
      {
        potentialByAgentId: { 'agent-nekomata': 6 },
        evidenceRefs: ['https://www.miyoushe.com/zzz/article/76994144'],
      },
    )
    expect(p6.values[p6.featureNames.indexOf('reference_potential_crit_damage')]).toBe(0.6)
    expect(
      predictStrengthRegression(strengthArtifact.regression, p6.values),
    ).toBeGreaterThanOrEqual(predictStrengthRegression(strengthArtifact.regression, p0.values))
  })
  it('leaves all 105 exact source-rated teams unchanged', () => {
    const teams = sourceRatedTeams()
    expect(teams).toHaveLength(105)
    expect(new Set(teams.map(exactKey))).toHaveLength(105)

    for (const memberIds of teams) {
      const key = exactKey(memberIds)
      const sourceCalibration = resolveCurrent31MetaCalibration({
        memberIds,
        bangbooId: null,
        predictedRating: mechanicRating(`source:${key}`),
        benchmark: unavailableBenchmark,
      })
      expect(sourceCalibration.projectedStrengthBand, key).not.toBeNull()
      expect(sourceCalibration.authority, key).not.toBe('model_inference')
      expect(inferredStrengthCalibration(sourceCalibration, memberIds), key).toEqual(
        sourceCalibration,
      )
    }
  })

  it('rates a current trio with no exact source and exposes a finite reference score', () => {
    const sourceKeys = new Set(sourceRatedTeams().map(exactKey))
    expect(sourceKeys.has(exactKey(inferredTeam))).toBe(false)

    const result = evaluate(inferredTeam)
    expect(result.mainstreamRecognition.status).toBe('unknown')
    expect(result.metaCalibration).toMatchObject({
      status: 'aligned',
      authority: 'model_inference',
      confidenceCeiling: 'low',
    })
    expect(result.metaCalibration.inference).toBeDefined()
    expect(result.metaCalibration.recommendationScore).toBe(result.metaCalibration.inference?.score)
    expect(Number.isFinite(result.metaCalibration.recommendationScore)).toBe(true)
    expect(Number.isInteger(result.metaCalibration.recommendationScore)).toBe(true)
    expect(result.rating).toMatchObject({
      status: 'rated',
      ratingBand: result.metaCalibration.inference?.band,
      confidence: 'low',
    })
  })

  it('is invariant to member order and Bangboo while recomputing a changed third member', () => {
    const reversed = [...inferredTeam].reverse() as [string, string, string]
    expect(inferTeamStrength(reversed)).toEqual(inferTeamStrength(inferredTeam))

    const withoutBangboo = evaluate(inferredTeam)
    const withBangboo = evaluate(reversed, { bangbooId: 'bangboo-amillion' })
    expect(withBangboo.metaCalibration.inference).toEqual(withoutBangboo.metaCalibration.inference)
    expect(withBangboo.rating.status).toBe('rated')
    expect(withoutBangboo.rating.status).toBe('rated')
    if (withBangboo.rating.status !== 'rated' || withoutBangboo.rating.status !== 'rated')
      throw new Error('Expected model-rated teams')
    expect([withBangboo.rating.ratingBand, withBangboo.rating.confidence]).toEqual([
      withoutBangboo.rating.ratingBand,
      withoutBangboo.rating.confidence,
    ])

    const replacement = inferTeamStrength(['agent-nekomata', 'agent-caesar', 'agent-astra'])
    expect(replacement).not.toBeNull()
    expect(replacement?.score).not.toBe(inferTeamStrength(inferredTeam)?.score)
  })

  it('keeps missing-output protection while field-time competition is a diagnostic', () => {
    const supports = inferTeamStrength(['agent-astra', 'agent-yuzuha', 'agent-rina'])
    const carries = inferTeamStrength(['agent-ellen', 'agent-soldier-11', 'agent-nekomata'])

    expect(supports?.guardrails.noPrimaryOutput).toBe(true)
    expect(supports?.band).not.toBe('S')
    expect(carries?.guardrails.severeFieldCompetition).toBe(true)
    expect(
      constrainTeamStrengthScore(94, { noPrimaryOutput: false, severeFieldCompetition: true }),
    ).toBe(94)
  })

  it('preserves the model reference score and the existing reviewed tier/fit score', () => {
    const teams = [inferredTeam, ...sourceRatedTeams().slice(0, 4)]
    const authorities = new Set<string>()
    for (const ids of teams) {
      const result = evaluate(ids as readonly [string, string, string])
      authorities.add(result.metaCalibration.authority)
      const expected =
        result.metaCalibration.inference?.score ??
        teamRecommendationScore(result.realityCheck.strengthBand, result.featureVector)
      expect(result.metaCalibration.recommendationScore).toBe(expected ?? undefined)
      if (result.metaCalibration.authority !== 'model_inference' && expected !== null)
        expect(expected % 2).toBe(0)
    }
    expect(authorities.has('model_inference')).toBe(true)
    expect([...authorities].some((authority) => authority !== 'model_inference')).toBe(true)
  })

  it('exposes the same score from fallback calibration and the final production projection', () => {
    const calibration = inferredStrengthCalibration(emptyCalibration(), inferredTeam)
    const projected = evaluate(inferredTeam)
    expect(calibration.authority).toBe('model_inference')
    expect(calibration.recommendationScore).toBe(inferTeamStrength(inferredTeam)?.score)
    expect(projected.metaCalibration.recommendationScore).toBe(calibration.recommendationScore)
    expect(projected.metaCalibration.inference?.band).toBe(calibration.projectedStrengthBand)
  })

  it('does not cross reviewed-only, hard-prune, or source-conflict gates', () => {
    const reviewedOnly = evaluate(inferredTeam, { reviewedOnly: true })
    expect(reviewedOnly.metaCalibration.authority).not.toBe('model_inference')
    expect(reviewedOnly.metaCalibration.inference).toBeUndefined()
    expect(reviewedOnly.rating).toMatchObject({
      status: 'rated',
      ratingBand: 'Experimental',
      confidence: 'experimental',
    })

    const baseline = evaluate(inferredTeam)
    const pruned = evaluateCurrent31TeamRating({
      candidateId: 'model-test:hard-pruned',
      memberIds: inferredTeam,
      bangbooId: null,
      outputPotentialBand: 'unknown',
      benchmark: unavailableBenchmark,
      hardPrunes: [
        {
          reason: 'required_mechanic_impossible',
          subjectId: 'fixture-impossible-mechanic',
          explanation: 'The required mechanic is explicitly impossible.',
          evidenceRefs: [baseline.featureVector.evidence[0]!.evidenceId],
        },
      ],
    })
    expect(pruned.mechanicValidity).toBe('invalid')
    expect(pruned.metaCalibration.authority).not.toBe('model_inference')
    expect(pruned.realityCheck.status).toBe('mechanic_rejected')
    expect(pruned.rating.status).toBe('hard_invalid')

    const conflict = { ...emptyCalibration(), evidenceStatus: 'conflict' as const }
    expect(inferredStrengthCalibration(conflict, inferredTeam)).toBe(conflict)
  })

  it('does not replace an explicit withdrawn exact-team assessment', async () => {
    vi.resetModules()
    vi.doMock('./reviewedTeamAnalysis', async (importOriginal) => {
      const actual = await importOriginal<typeof import('./reviewedTeamAnalysis')>()
      return {
        ...actual,
        reviewedTeamAnalysis: {
          ...actual.reviewedTeamAnalysis,
          records: [
            ...actual.reviewedTeamAnalysis.records,
            {
              ...actual.reviewedTeamAnalysis.records[0]!,
              id: 'fixture-withdrawn-model-team',
              memberIds: [...inferredTeam],
              withdrawn: true,
            },
          ],
        },
      }
    })

    try {
      const isolated = await import('./teamStrengthModel')
      const calibration = emptyCalibration()
      expect(isolated.inferredStrengthCalibration(calibration, inferredTeam)).toBe(calibration)
    } finally {
      vi.doUnmock('./reviewedTeamAnalysis')
      vi.resetModules()
    }
  })
})
