import { afterEach, describe, expect, it, vi } from 'vitest'
import * as reviewedDirections from '../gameDataPacks/reviewedTeamSourceDirections'
import * as teamRating from '../decision/current31TeamRating'
import { reviewedTeamAnalysis } from '../decision/reviewedTeamAnalysis'
import { current31TeamEngineD1Pack } from '../teamEngine/current31D1Pack'
import { solveTeamEngine } from '../teamEngine/solveTeamEngine'
import { projectTeamLoadoutCompletionCandidates } from './teamLoadoutCompletionCandidates'

function completionCandidates(availableAgentIds: string[], ownedAgentIds = availableAgentIds) {
  const result = solveTeamEngine(current31TeamEngineD1Pack, {
    ownedAgentIds: availableAgentIds,
    bangbooCandidateIds: [],
  })
  return projectTeamLoadoutCompletionCandidates({
    rejected: result.rejected,
    ownedAgentIds,
    availableAgentIds,
    pack: current31TeamEngineD1Pack,
  })
}

describe('team loadout completion candidates', () => {
  afterEach(() => vi.restoreAllMocks())
  it('retains exact source conditions and distinguishes observed P0 from an unknown account state', () => {
    const input = {
      ownedAgentIds: ['agent-jane', 'agent-remielle'],
      pack: current31TeamEngineD1Pack,
    }
    const unknown = projectTeamLoadoutCompletionCandidates(input).find((candidate) =>
      candidate.memberIds.includes('agent-velina'),
    )!
    const observed = projectTeamLoadoutCompletionCandidates({
      ...input,
      rosterAgents: [{ agentId: 'agent-jane', potentialImage: 0 }],
    }).find((candidate) => candidate.id === unknown.id)!
    expect(unknown.sourceConditions?.length).toBeGreaterThan(0)
    expect(unknown.accountReferenceNotes?.join(' ')).toContain('当前潜能未记录')
    expect(observed.accountReferenceNotes?.join(' ')).toContain('当前潜能0')
    expect(observed.accountReferenceNotes?.join(' ')).toContain('来源参考潜能6')
    expect(observed.accountReferenceNotes?.join(' ')).toContain('不是最低门槛')
    expect(observed.sourceConditions).toEqual(unknown.sourceConditions)
    expect(observed.memberIds).toEqual(unknown.memberIds)
    expect(observed.missingAgentIds).toEqual(['agent-velina'])
  })
  it('shows the source-backed Pyrois and Sunna path when Norma is the missing core member', () => {
    const candidates = completionCandidates(['agent-pyrois', 'agent-sunna'])

    expect(candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          memberIds: ['agent-pyrois', 'agent-norma', 'agent-sunna'],
          ownedAgentIds: ['agent-pyrois', 'agent-sunna'],
          ownedCoreAgentIds: ['agent-pyrois'],
          unavailableOwnedAgentIds: [],
          missingAgentIds: ['agent-norma'],
          missingRole: 'core',
          failureCode: 'missing_core_agent',
        }),
      ]),
    )
  })

  it('removes the path once its missing core member is owned', () => {
    expect(
      completionCandidates(['agent-pyrois', 'agent-sunna', 'agent-norma']).map(
        (candidate) => candidate.kernelId,
      ),
    ).not.toContain('kernel-3.1-pyrois-norma-sunna')
  })

  it('omits acquisition paths that still require a second missing member', () => {
    const candidates = completionCandidates(['agent-pyrois'])

    expect(candidates.map((candidate) => candidate.kernelId)).not.toContain(
      'kernel-3.1-pyrois-norma-sunna',
    )
  })

  it('does not mark a reserved but genuinely owned member as missing', () => {
    const candidates = completionCandidates(
      ['agent-pyrois', 'agent-sunna'],
      ['agent-pyrois', 'agent-norma', 'agent-sunna'],
    )

    expect(candidates.map((candidate) => candidate.kernelId)).not.toContain(
      'kernel-3.1-pyrois-norma-sunna',
    )
  })

  it('does not suggest one acquisition when another required owner is reserved', () => {
    const candidates = completionCandidates(['agent-pyrois'], ['agent-pyrois', 'agent-sunna'])

    expect(candidates.map((candidate) => candidate.kernelId)).not.toContain(
      'kernel-3.1-pyrois-norma-sunna',
    )
  })

  it('filters weak reviewed directions but does not let an old kernel tier hide reviewed strength', () => {
    const viable = completionCandidates(['agent-billy', 'agent-nicole'])
    const nonStrongMeta = completionCandidates(['agent-remielle', 'agent-velina'])

    expect(viable.map((candidate) => candidate.kernelId)).not.toContain(
      'kernel-3.1-billy-nicole-anby',
    )
    expect(nonStrongMeta.map((candidate) => candidate.kernelId)).toContain(
      'kernel-3.1-remielle-velina-burnice',
    )
  })

  it('finds exact reviewed strong directions beyond the legacy kernel/rejection universe', () => {
    const candidates = projectTeamLoadoutCompletionCandidates({
      ownedAgentIds: ['agent-pyrois', 'agent-dialyn'],
      pack: { kernels: [] },
    })
    expect(candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          memberIds: expect.arrayContaining(['agent-pyrois', 'agent-dialyn', 'agent-astra']),
          ownedAgentIds: expect.arrayContaining(['agent-pyrois', 'agent-dialyn']),
          missingAgentIds: ['agent-astra'],
          sourceIds: expect.arrayContaining([expect.stringMatching(/^https:/)]),
        }),
      ]),
    )
  })

  it('retains another source-backed third-member acquisition when one third is already owned', () => {
    const candidates = completionCandidates(['agent-remielle', 'agent-velina', 'agent-aria'])
    expect(candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          memberIds: expect.arrayContaining(['agent-remielle', 'agent-velina', 'agent-burnice']),
          missingAgentIds: ['agent-burnice'],
        }),
      ]),
    )
    expect(
      candidates.some((candidate) =>
        candidate.memberIds.every((id) =>
          ['agent-remielle', 'agent-velina', 'agent-aria'].includes(id),
        ),
      ),
    ).toBe(false)
  })

  it('does not turn model-only scores into acquisition advice', () => {
    const evaluate = vi.spyOn(teamRating, 'evaluateCurrent31TeamRating')
    const candidates = completionCandidates(['agent-billy', 'agent-remielle'])
    expect(candidates.some((candidate) => candidate.memberIds.includes('agent-anby'))).toBe(false)
    expect(evaluate.mock.calls.every(([input]) => input.reviewedOnly === true)).toBe(true)
  })

  it('honors exact-team withdrawal even when another source still supplies a strong band', () => {
    const record = {
      ...reviewedTeamAnalysis.records[0]!,
      memberIds: ['agent-pyrois', 'agent-norma', 'agent-sunna'] as [string, string, string],
      withdrawn: true,
    }
    reviewedTeamAnalysis.records.push(record)
    try {
      expect(
        completionCandidates(['agent-pyrois', 'agent-sunna']).some(
          (candidate) =>
            candidate.memberIds.includes('agent-norma') &&
            candidate.memberIds.includes('agent-sunna'),
        ),
      ).toBe(false)
    } finally {
      reviewedTeamAnalysis.records.pop()
    }
  })

  it('admits a reviewed S+ result and ranks it ahead of an S result', () => {
    const sourceDirections = reviewedDirections.currentReviewedTeamSourceDirections()
    const missingNorma = sourceDirections.find((item) =>
      ['agent-pyrois', 'agent-sunna', 'agent-norma'].every((id) => item.memberIds.includes(id)),
    )!
    const missingDialyn = sourceDirections.find((item) =>
      ['agent-pyrois', 'agent-sunna', 'agent-dialyn'].every((id) => item.memberIds.includes(id)),
    )!
    const base = teamRating.evaluateCurrent31TeamRating({
      candidateId: 's-plus-fixture',
      memberIds: missingNorma.memberIds,
      bangbooId: null,
      outputPotentialBand: 'unknown',
      reviewedOnly: true,
      benchmark: {
        status: 'unavailable',
        baselineId: null,
        outputIndex: null,
        unsupportedIssueIds: [],
        explanation: 'fixture',
      },
    })
    expect(base.rating.status).toBe('rated')
    vi.spyOn(reviewedDirections, 'currentReviewedTeamSourceDirections').mockReturnValue([
      missingDialyn,
      missingNorma,
    ])
    vi.spyOn(teamRating, 'evaluateCurrent31TeamRating').mockImplementation((input) => {
      const result = structuredClone(base)
      if (result.rating.status !== 'rated') throw new Error('Expected rated fixture')
      const band = input.memberIds.includes('agent-norma') ? 'S+' : 'S'
      result.rating.ratingBand = band
      result.metaCalibration.projectedStrengthBand = band
      return result
    })
    const candidates = completionCandidates(['agent-pyrois', 'agent-sunna'])
    expect(candidates.map((candidate) => candidate.missingAgentIds)).toEqual([
      ['agent-norma'],
      ['agent-dialyn'],
    ])
  })

  it.each(['conflict', 'expired', 'hard_rejected', 'model'] as const)(
    'does not cross the shared %s qualification gate',
    (gate) => {
      const memberIds = ['agent-pyrois', 'agent-norma', 'agent-sunna'] as const
      const direction = reviewedDirections
        .currentReviewedTeamSourceDirections()
        .find((item) => memberIds.every((id) => item.memberIds.includes(id)))!
      const real = teamRating.evaluateCurrent31TeamRating({
        candidateId: 'qualification-fixture',
        memberIds,
        bangbooId: null,
        outputPotentialBand: 'unknown',
        reviewedOnly: true,
        benchmark: {
          status: 'unavailable',
          baselineId: null,
          outputIndex: null,
          unsupportedIssueIds: [],
          explanation: 'fixture',
        },
      })
      expect(real.rating).toMatchObject({ status: 'rated', ratingBand: 'A+' })
      const result = structuredClone(real)
      if (gate === 'conflict') result.metaCalibration.evidenceStatus = 'conflict'
      if (gate === 'expired') {
        delete result.metaCalibration.referenceContinuity
        result.mainstreamRecognition.historicalReferenceOnly = true
      }
      if (gate === 'hard_rejected') result.mechanicValidity = 'invalid'
      if (gate === 'model') result.metaCalibration.authority = 'model_inference'
      vi.spyOn(reviewedDirections, 'currentReviewedTeamSourceDirections').mockReturnValue([
        direction,
      ])
      vi.spyOn(teamRating, 'evaluateCurrent31TeamRating').mockReturnValue(result)
      expect(completionCandidates(['agent-pyrois', 'agent-sunna'])).toEqual([])
    },
  )
})
