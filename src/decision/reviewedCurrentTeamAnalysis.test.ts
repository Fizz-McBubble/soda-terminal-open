import { afterEach, expect, it, vi } from 'vitest'
import {
  reviewedCurrentTeamAnalysis32,
  reviewedTeamAnalysis,
  resolveReviewedCurrentTeamAnalysis,
  resolveReviewedCurrentTeamPreferences,
} from './reviewedTeamAnalysis'
import { createReviewedTeamAnalysisCatalog } from './reviewedTeamAnalysis'
import originalCurrentReviews from '../gameDataPacks/data/reviewed-team-analysis.3.2.json'
import { reviewedVersionApplicability33 } from '../gameDataPacks/reviewedVersionApplicability33'
import * as mechanicContracts from '../calculation/currentAgentDecisionMechanicContracts'
import { orderComparableTeamCandidates } from './accountDecisionOrdering'
import { evaluateCurrent31TeamRating } from './current31TeamRating'
import * as sourceDirections from '../gameDataPacks/reviewedTeamSourceDirections'
import { current31MainstreamAuthorityEvaluationGate } from './current31MainstreamAuthorityEvaluationGate'

afterEach(() => vi.restoreAllMocks())

function evaluate(
  memberIds: readonly [string, string, string],
  evidenceMode: 'source_reference' | 'independent_evaluation' = 'source_reference',
) {
  return evaluateCurrent31TeamRating({
    memberIds,
    candidateId: memberIds.join('|'),
    bangbooId: null,
    outputPotentialBand: 'unknown',
    benchmark: {
      status: 'unavailable',
      baselineId: null,
      outputIndex: null,
      unsupportedIssueIds: [],
      explanation: 'No battle score or account equipment supplies this reference rating.',
    },
    evidenceMode,
  })
}

it('consumes the current source-qualified local reviews without rewriting frozen legacy labels', () => {
  expect(reviewedTeamAnalysis.gameVersion).toBe('3.1')
  expect(reviewedTeamAnalysis.records).toHaveLength(53)
  expect(reviewedCurrentTeamAnalysis32.records).toHaveLength(32)
  expect(current31MainstreamAuthorityEvaluationGate.evaluationUse).toBe(
    'independent_quality_research',
  )
  expect(
    current31MainstreamAuthorityEvaluationGate.evaluationSets.currentVersion
      .independentCurrentVersionLabelCaseCount,
  ).toBe(0)
  for (const record of reviewedCurrentTeamAnalysis32.records) {
    const result = evaluate(record.memberIds)
    expect(result.featureVector.hardPrunes, record.id).toEqual([])
    expect(result.rating, record.id).toMatchObject({ ratingBand: record.band, confidence: 'low' })
    expect(result.metaCalibration, record.id).toMatchObject({
      authority: 'local_editorial_estimate',
      analysis: { rationale: record.rationale, conditions: record.conditions },
      recommendationScore: record.band === 'A+' ? 84 : record.band === 'A' ? 74 : 64,
    })
    expect(result.metaCalibration.referenceContinuity, record.id).toBeUndefined()
    expect(evaluate(record.memberIds, 'independent_evaluation').metaCalibration.authority).not.toBe(
      'local_editorial_estimate',
    )
  }
})

it('rates the reviewed comparison setup locally without promoting it to mainstream evidence', () => {
  const result = evaluate(['agent-roxy', 'agent-claret', 'agent-rina'])
  expect(result.rating).toMatchObject({ ratingBand: 'A+', confidence: 'low' })
  expect(result.metaCalibration.authority).toBe('local_editorial_estimate')
  expect(result.mainstreamRecognition.status).toBe('unknown')
  expect(result.metaCalibration.analysis?.conditions.join(' ')).toContain('共享站场')
})

it('carries only explicitly reviewed local references into 3.3 with original identities', () => {
  const adopted = createReviewedTeamAnalysisCatalog(
    originalCurrentReviews,
    '3.3',
    reviewedVersionApplicability33,
  )
  for (const record of reviewedCurrentTeamAnalysis32.records) {
    const result = adopted.resolve(record.memberIds)
    expect(result, record.id).toMatchObject({
      band: record.band,
      confidence: 'low',
      evidenceRefs: record.evidenceRefs,
      versionApplicability: {
        targetVersion: '3.3',
        sourceVersion: '3.2',
        reviewVersion: '3.2',
        authority: 'local_editorial_estimate',
        formalPromotion: false,
        importPromotion: false,
        runtimePromotion: false,
      },
    })
    expect(resolveReviewedCurrentTeamAnalysis(record.memberIds, '3.4')).toBeNull()
  }
})

it('keeps the reviewed fixed-core alternatives below the preferred Manato lineup within a band', () => {
  const preferred = ['agent-manato', 'agent-lucia', 'agent-ju-fufu']
  const alternative = ['agent-manato', 'agent-lucia', 'agent-koleda']
  const unrelated = ['agent-anton', 'agent-qingyi', 'agent-rina']
  expect(
    orderComparableTeamCandidates(
      [alternative, unrelated, preferred],
      () => 'A',
      (ids) => ids,
    ),
  ).toEqual([preferred, unrelated, alternative])
  expect(
    resolveReviewedCurrentTeamPreferences(sourceDirections.currentReviewedTeamSourceDirections()),
  ).toHaveLength(2)
  expect(
    orderComparableTeamCandidates(
      [alternative, preferred],
      (ids) => (ids === preferred ? 'A+' : 'A'),
      (ids) => ids,
    ),
  ).toEqual([alternative, preferred])
})

it('withdraws both a local band and its preferences when a pinned member formula changes', () => {
  const original = mechanicContracts.getCurrentAgentDecisionMechanicContract
  vi.spyOn(mechanicContracts, 'getCurrentAgentDecisionMechanicContract').mockImplementation(
    (id) => {
      const contract = original(id)
      return id === 'agent-manato' && contract?.effectContract
        ? {
            ...contract,
            effectContract: {
              ...contract.effectContract,
              source: { ...contract.effectContract.source, formulaSha256: 'changed' },
            },
          }
        : contract
    },
  )
  expect(
    resolveReviewedCurrentTeamAnalysis(['agent-manato', 'agent-lucia', 'agent-ju-fufu'], '3.2'),
  ).toBeNull()
  expect(
    resolveReviewedCurrentTeamAnalysis(['agent-manato', 'agent-lucia', 'agent-ju-fufu'], '3.3'),
  ).toBeNull()
  expect(
    resolveReviewedCurrentTeamPreferences(sourceDirections.currentReviewedTeamSourceDirections()),
  ).toEqual([])
})

it('rejects a local preference that borrows a judgement from another core', () => {
  const changed = structuredClone(reviewedCurrentTeamAnalysis32)
  const row = changed.records.find((record) => record.preferredOver?.length)!
  row.preferredOver = [
    {
      memberIds: ['agent-roxy', 'agent-claret', 'agent-rina'],
      rationale: 'invalid cross-core priority',
    },
  ]
  const dataset = Object.fromEntries(
    Object.entries(changed).filter(([key]) => key !== 'contentHash'),
  )
  expect(() => createReviewedTeamAnalysisCatalog(dataset, '3.2')).toThrow('shared core')
})

it('keeps the source-listed Lighter alternative searchable without declaring an inactive ability complete', () => {
  const ids = ['agent-manato', 'agent-lucia', 'agent-lighter'] as const
  expect(
    sourceDirections
      .currentReviewedTeamSourceDirections()
      .some((row) => [...row.memberIds].sort().join('|') === [...ids].sort().join('|')),
  ).toBe(true)
  expect(resolveReviewedCurrentTeamAnalysis(ids, '3.2')).toBeNull()
  expect(evaluate(ids).rating).toMatchObject({ status: 'rated', ratingBand: 'Experimental' })
})

it('does not borrow the current review for another trio or another game version', () => {
  const record = reviewedCurrentTeamAnalysis32.records[0]!
  expect(resolveReviewedCurrentTeamAnalysis([...record.memberIds].reverse(), '3.2')).toMatchObject({
    band: record.band,
  })
  expect(resolveReviewedCurrentTeamAnalysis(record.memberIds, '3.3')).toBeNull()
  expect(
    resolveReviewedCurrentTeamAnalysis([...record.memberIds, 'bangboo-amillion'], '3.2'),
  ).toBeNull()
})

it('rejects a current review when its cited source content has changed', () => {
  const memberIds = ['agent-claret', 'agent-norma', 'agent-rina'] as const
  const original = sourceDirections.currentReviewedTeamSourceDirections
  vi.spyOn(sourceDirections, 'currentReviewedTeamSourceDirections').mockImplementation((version) =>
    original(version).map((row) => ({
      ...row,
      sourceRefs: row.sourceRefs.map((source) => ({ ...source, contentHash: 'changed-source' })),
    })),
  )
  expect(evaluate(memberIds).metaCalibration.projectedStrengthBand).toBeNull()
})
