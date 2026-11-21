import { describe, expect, it } from 'vitest'
import artifact from '../gameDataPacks/generated/generic-team-ranking.v1.json'
import {
  createGenericTeamRankingReader,
  currentGenericTeamRankingStatus,
  lookupCurrentGenericTeamRanking,
} from './teamGenericRanking'
import { selectDefaultTeamRecommendationPool } from './defaultTeamRecommendationSelection'
import { projectGenericTeamRating, compareGenericTeamReferences } from './teamGenericRankingMethod'
import { originalTeamRankingCases } from './originalTeamRankingCases'
import { seal } from './teamGenericRanking.compact.testFixture'
import type { TeamRatingResult } from './teamDecisionAuthority'
// The exact original nine remain adopted-artifact regressions; current
// method-only evidence does not replace this batch-six promotion gate.
const pairs = originalTeamRankingCases.map((c) => [c.left, c.right, c.referencePreference] as const)
const ids = (team: readonly string[]) => team.map((id) => 'agent-' + id)
describe('adopted generic ranking and consumer', () => {
  it('provides one current full-domain product authority', () => {
    expect(currentGenericTeamRankingStatus.status).toBe('ready')
    expect(currentGenericTeamRankingStatus.coverage?.total).toBe(37_820)
    expect(currentGenericTeamRankingStatus.coverage?.recommended).toBeGreaterThan(100)
  })
  it.each(pairs)('preserves the applicable coarse judgement for %j versus %j', (a, b, expected) => {
    const left = lookupCurrentGenericTeamRanking(ids(a))
    const right = lookupCurrentGenericTeamRanking(ids(b))
    expect(left?.genericOrder?.status).toBe('recommended')
    expect(right?.genericOrder?.status).toBe('recommended')
    const asReference = (value: NonNullable<typeof left>) => ({
      key: '',
      status: value.genericOrder!.status,
      band: value.genericOrder!.band,
      confidence: value.genericOrder!.confidence,
      authority: value.genericOrder!.sourceAuthority,
      displayOrder: value.genericOrder!.displayOrder,
      referenceInterval: value.genericOrder!.referenceInterval,
      reason: null,
    })
    expect(compareGenericTeamReferences(asReference(left!), asReference(right!))).toBe(expected)
  })
  it('retains reviewed directions without inventing a conventional damage owner', () => {
    const team = ids(['sigrid', 'norma', 'astra'])
    const ranking = lookupCurrentGenericTeamRanking(team)
    expect(ranking?.genericOrder?.status).toBe('recommended')
    const result = selectDefaultTeamRecommendationPool(
      [
        {
          candidateId: 'sigrid',
          memberIds: team,
          sourceRecommended: false,
          explicitSelectionOnly: false,
          inferredStrength: false,
          ratingStatus: 'rated',
          ratingBand: 'A+',
          confidence: 'low',
          mechanicallyClosed: false,
          recommendationScore: null,
          sourceExcluded: false,
          teamSystemRanking: ranking,
        },
      ],
      () => null,
    )
    expect(result.defaultIds.has('sigrid')).toBe(true)
  })
  it('does not promote model-only exploration merely because it has a system classification', () => {
    const row = artifact.rows.find((row) => row[3] === 1)!
    const team = row.slice(0, 3).map((i) => artifact.agentIds[i]!)
    const ranking = lookupCurrentGenericTeamRanking(team)
    expect(ranking?.genericOrder).toMatchObject({ status: 'exploration', band: null })
    const modelRating: TeamRatingResult = {
      contract: 'soda-team-decision-authority/v1',
      status: 'rated',
      candidateId: 'model',
      featureFingerprint: 'model-only',
      ratingBand: 'S',
      confidence: 'high',
      explanation: 'diagnostic model',
      tradeoffs: [],
    }
    expect(projectGenericTeamRating(modelRating, ranking)).toMatchObject({
      status: 'rated',
      ratingBand: 'Experimental',
      confidence: 'experimental',
    })
    const result = selectDefaultTeamRecommendationPool(
      [
        {
          candidateId: 'explore',
          memberIds: team,
          sourceRecommended: true,
          explicitSelectionOnly: false,
          inferredStrength: true,
          ratingStatus: 'rated',
          ratingBand: 'S',
          confidence: 'high',
          mechanicallyClosed: true,
          recommendationScore: 100,
          sourceExcluded: false,
          teamSystemRanking: ranking,
        },
      ],
      () => team[0]!,
    )
    expect(result.defaultIds.size).toBe(0)
  })
  it('rejects stale identity without a legacy capacity-rank fallback', () => {
    const content = { ...artifact }
    delete (content as Partial<typeof content>).contentHash
    expect(
      createGenericTeamRankingReader(seal({ ...content, intrinsicIndexContentHash: 'stale' }))
        .status.status,
    ).toBe('unavailable')
  })
  it('rejects duplicate/missing trios even if the caller recomputes its own hash', () => {
    const content = { ...artifact }
    delete (content as Partial<typeof content>).contentHash
    const rows = [...content.rows]
    rows[0] = rows[1]!
    expect(createGenericTeamRankingReader(seal({ ...content, rows })).status.status).toBe(
      'unavailable',
    )
  })
  it('rejects source-free recommended rows and model promotion', () => {
    const content = { ...artifact }
    delete (content as Partial<typeof content>).contentHash
    const sourceKey = Object.keys(content.evidence)[0]! as keyof typeof content.evidence
    const evidence = {
      ...content.evidence,
      [sourceKey]: { ...content.evidence[sourceKey]!, sourceRefs: [] },
    }
    expect(createGenericTeamRankingReader(seal({ ...content, evidence })).status.status).toBe(
      'unavailable',
    )
  })
})
