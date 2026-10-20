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
    sourceRecommended: true,
    explicitSelectionOnly: false,
    inferredStrength: false,
    ratingStatus: 'rated',
    ratingBand: 'A+',
    confidence: 'low',
    mechanicallyClosed: true,
    recommendationScore: 80,
    sourceExcluded: false,
    ...patch,
  }
}

describe('source-preserving default recommendations', () => {
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

  it('retains source rows while model-only supplements remain outside the default pool', () => {
    const rejected = candidate('gap')
    const rows = [
      { ...rejected, sourceRecommended: false },
      candidate('one', { sourceRecommended: false }),
      candidate('two', { sourceRecommended: false }),
      candidate('three', { sourceRecommended: false }),
      candidate('source', { sourceRecommended: true }),
    ]
    expect([
      ...selectDefaultTeamRecommendationIds(rows, (row) => (row === rejected ? null : 'primary')),
    ]).toEqual(['source'])
  })

  it.each([
    ['not mechanically closed', { mechanicallyClosed: false }],
    ['fallback or withdrawn source', { sourceExcluded: true }],
    ['explicit author/prepared selection', { explicitSelectionOnly: true }],
    ['hard player constraint', { ratingStatus: 'hard_invalid' }],
    ['Experimental', { ratingBand: 'Experimental', confidence: 'experimental' }],
  ] satisfies [string, Partial<DefaultTeamRecommendationCandidate>][])(
    'rejects %s from confirmed source defaults',
    (_name, patch) => {
      expect([
        ...selectDefaultTeamRecommendationIds(
          [candidate('rejected', patch), candidate('boundary')],
          () => 'primary',
        ),
      ]).toEqual(['boundary'])
    },
  )
  it('retains every source candidate without manufacturing a same-band score order', () => {
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
        mechanicallyClosed: true,
      }),
    ]
    expect([
      ...selectDefaultTeamRecommendationIds(order, (row) =>
        row.memberIds.includes('primary') ? 'primary' : 'other',
      ),
    ]).toEqual(['one', 'variant', 'two', 'three', 'four', 'other-primary', 'source'])
  })
  it('requires an actual member as primary output and never promotes missing or conflicted features', () => {
    expect([...selectDefaultTeamRecommendationIds([candidate('missing')], () => null)]).toEqual([])
    expect([
      ...selectDefaultTeamRecommendationIds([candidate('foreign')], () => 'not-a-member'),
    ]).toEqual([])
  })

  it('admits source-rated teams independently of the retired score thresholds', () => {
    const available = candidate('available', { ratingBand: 'A', recommendationScore: 78 })
    const weak = candidate('weak', {
      ratingBand: 'B',
      sourceRecommended: false,
      recommendationScore: 99,
    })
    expect([...selectDefaultTeamRecommendationIds([available, weak], () => 'primary')]).toEqual([
      'available',
    ])
    expect([...selectDefaultTeamRecommendationIds([weak], () => 'primary')]).toEqual([])
    expect([
      ...selectDefaultTeamRecommendationIds(
        [
          candidate('unknown-score', { ratingBand: 'A', recommendationScore: null }),
          candidate('low-score', { ratingBand: 'A', recommendationScore: 1 }),
        ],
        () => 'primary',
      ),
    ]).toEqual(['unknown-score', 'low-score'])
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
