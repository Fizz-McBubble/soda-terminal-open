import { describe, expect, it } from 'vitest'
import {
  selectDefaultTeamRecommendationIds,
  hasDefaultTeamRecommendationEvidence,
  type DefaultTeamRecommendationCandidate,
} from './defaultTeamRecommendationPolicy'
import { extractTeamStrengthMechanicFeatures } from './teamStrengthMechanicFeatures'

function candidate(
  id: string,
  patch: Partial<DefaultTeamRecommendationCandidate> = {},
): DefaultTeamRecommendationCandidate {
  return {
    candidateId: id,
    memberIds: ['primary', 'support', id],
    sourceRecommended: false,
    explicitSelectionOnly: false,
    inferredStrength: true,
    ratingStatus: 'rated',
    ratingBand: 'A+',
    confidence: 'low',
    mechanicallyClosed: true,
    recommendationScore: 80,
    sourceExcluded: false,
    ...patch,
  }
}

describe('source-preserving bounded default inference supplements', () => {
  it('preserves partial support evidence without treating a source conflict as usable', () => {
    const ids = ['agent-astra', 'agent-vivian', 'agent-yuzuha']
    const features = extractTeamStrengthMechanicFeatures(ids)
    expect(hasDefaultTeamRecommendationEvidence(features, ids)).toBe(true)
    for (const field of ['unverifiedProviderIds', 'deferredProviderIds'] as const) {
      expect(
        hasDefaultTeamRecommendationEvidence(
          {
            ...features,
            supportEvidence: { ...features.supportEvidence, [field]: ['provider'] },
          },
          ids,
        ),
      ).toBe(true)
    }
    expect(
      hasDefaultTeamRecommendationEvidence(
        {
          ...features,
          supportEvidence: { ...features.supportEvidence, sourceConflictProviderIds: ['provider'] },
        },
        ids,
      ),
    ).toBe(false)
    expect(
      hasDefaultTeamRecommendationEvidence(
        {
          ...features,
          supportEvidence: { ...features.supportEvidence, reviewedProviderIds: ['provider'] },
        },
        ids,
      ),
    ).toBe(true)
  })

  it('does not treat an absent contract after a roster update as a closed resource mechanism', () => {
    const ids = ['agent-astra', 'agent-vivian', 'agent-yuzuha']
    const features = extractTeamStrengthMechanicFeatures(ids)
    expect(
      hasDefaultTeamRecommendationEvidence(features, ['agent-unreviewed-new', ...ids.slice(1)]),
    ).toBe(false)
  })

  it.each([
    ['agent-aria', 'agent-burnice', 'agent-sunna'],
    ['agent-lucy', 'agent-soldier-11', 'agent-sunna'],
  ])(
    'does not reject the whole team because optional support quantities remain partial: %s / %s / %s',
    (...ids) => {
      expect(
        hasDefaultTeamRecommendationEvidence(extractTeamStrengthMechanicFeatures(ids), ids),
      ).toBe(true)
    },
  )

  it('retains source rows and does not spend a supplement quota on rejected evidence', () => {
    const rejected = candidate('gap')
    const rows = [
      rejected,
      candidate('one'),
      candidate('two'),
      candidate('three'),
      candidate('source', { sourceRecommended: true }),
    ]
    expect([
      ...selectDefaultTeamRecommendationIds(rows, (row) => (row === rejected ? null : 'primary')),
    ]).toEqual(['one', 'two', 'three', 'source'])
  })

  it.each([
    ['below threshold', { recommendationScore: 79 }],
    ['unknown score', { recommendationScore: null }],
    ['nonfinite score', { recommendationScore: Infinity }],
    ['not mechanically closed', { mechanicallyClosed: false }],
    ['fallback or withdrawn source', { sourceExcluded: true }],
    ['explicit author/prepared selection', { explicitSelectionOnly: true }],
    ['hard player constraint', { ratingStatus: 'hard_invalid' }],
    ['Experimental', { ratingBand: 'Experimental', confidence: 'experimental' }],
  ] satisfies [string, Partial<DefaultTeamRecommendationCandidate>][])(
    'rejects %s as a model supplement',
    (_name, patch) => {
      expect([
        ...selectDefaultTeamRecommendationIds(
          [candidate('rejected', patch), candidate('boundary')],
          () => 'primary',
        ),
      ]).toEqual(['boundary'])
    },
  )
  it('uses distinct exact trios and independent primary quotas, retaining source candidates', () => {
    const one = candidate('one')
    const order = [
      one,
      candidate('variant', { memberIds: [...one.memberIds].reverse() }),
      candidate('two'),
      candidate('three'),
      candidate('four'),
      candidate('other-primary', { memberIds: ['other', 'support', 'other-primary'] }),
      candidate('source', {
        sourceRecommended: true,
        recommendationScore: 1,
        mechanicallyClosed: false,
      }),
    ]
    expect([
      ...selectDefaultTeamRecommendationIds(order, (row) =>
        row.memberIds.includes('primary') ? 'primary' : 'other',
      ),
    ]).toEqual(['one', 'variant', 'two', 'three', 'other-primary', 'source'])
  })
  it('requires an actual member as primary output and never promotes missing or conflicted features', () => {
    expect([...selectDefaultTeamRecommendationIds([candidate('missing')], () => null)]).toEqual([])
    expect([
      ...selectDefaultTeamRecommendationIds([candidate('foreign')], () => 'not-a-member'),
    ]).toEqual([])
  })

  it('offers a correctly rated A fallback only when this BOX has no stronger direction', () => {
    const available = candidate('available', { ratingBand: 'A', recommendationScore: 78 })
    const weak = candidate('weak', { ratingBand: 'B', recommendationScore: 69 })
    expect([...selectDefaultTeamRecommendationIds([available, weak], () => 'primary')]).toEqual([
      'available',
    ])
    expect([...selectDefaultTeamRecommendationIds([weak], () => 'primary')]).toEqual([])
    expect([
      ...selectDefaultTeamRecommendationIds([candidate('strong'), available], () => 'primary'),
    ]).toEqual(['strong'])
    expect([
      ...selectDefaultTeamRecommendationIds(
        [{ ...available, mechanicallyClosed: false }],
        () => 'primary',
      ),
    ]).toEqual([])
    expect([
      ...selectDefaultTeamRecommendationIds(
        [{ ...available, sourceExcluded: true }],
        () => 'primary',
      ),
    ]).toEqual([])
    expect(available).toMatchObject({ ratingBand: 'A', recommendationScore: 78 })
  })
})
