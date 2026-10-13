import { describe, expect, it } from 'vitest'
import { currentBangbooDirectory } from '../assault/catalog'
import { getCurrentAgentEventContract } from '../calculation/currentAgentMechanicContracts'
import {
  targetTeamBangbooOptions,
  resolveTargetTeamBangbooOption,
  reviewedSourceBangbooOptions,
  maxTargetTeamBangbooRecommendations,
} from './targetTeamSourceBangbooOptions'

describe('targetTeamSourceBangbooOptions recommendation shortlist and policies', () => {
  it('retains the most prioritized valid exact 3-agent reviewed option as default (slot 0)', () => {
    const memberIds = ['agent-anby', 'agent-anton', 'agent-nicole'] as const
    const reviewed = reviewedSourceBangbooOptions({ memberIds }).filter(
      (row) => row.activationStatus === 'active',
    )
    const options = targetTeamBangbooOptions({ memberIds })
    expect(options.length).toBeLessThanOrEqual(maxTargetTeamBangbooRecommendations)
    expect(options.length).toBeGreaterThan(0)
    expect(options[0]!.bangbooId).toBe('bangboo-plugboo')
    expect(options[0]!.bangbooId).toBe(reviewed[0]!.bangbooId)
    expect(options[0]!.activationStatus).toBe('active')
    expect(options[0]!.recommendationReason).toContain('资料推荐')
  })
  it('does not recommend inactive raised-star choices or duplicate IDs', () => {
    const options = targetTeamBangbooOptions({
      memberIds: ['agent-yixuan', 'agent-lucia', 'agent-dialyn'],
      bangbooStarsById: { 'bangboo-belion': 1 },
    })
    expect(options.every((row) => row.activationStatus === 'active')).toBe(true)
    expect(options.map((row) => row.bangbooId)).not.toContain('bangboo-belion')
    expect(new Set(options.map((row) => row.bangbooId)).size).toBe(options.length)
    expect(options.length).toBeLessThanOrEqual(3)
  })
  it('uses three real rupture members to verify no normal-energy recommendation priority', () => {
    const memberIds = ['agent-yixuan', 'agent-yidhari', 'agent-banyue'] as const
    for (const id of memberIds)
      expect(getCurrentAgentEventContract(id)?.identity.specialty).toBe('rupture')
    const options = targetTeamBangbooOptions({ memberIds })
    expect(options).toHaveLength(3)
    expect(options.every((row) => row.activationStatus === 'active')).toBe(true)
    expect(options.map((row) => row.primaryPurpose)).not.toContain('energy')
  })
  it('retains all 41 released manual choices and every explicit star, including inactive base skills', () => {
    const memberIds = ['agent-jane', 'agent-velina', 'agent-yuzuha'] as const
    const directory = currentBangbooDirectory.filter((row) => row.releaseState === 'released')
    expect(directory).toHaveLength(41)
    for (const entry of directory) {
      for (const stars of [1, 2, 3, 4, 5] as const) {
        const resolved = resolveTargetTeamBangbooOption(
          { memberIds, bangbooStarsById: { [entry.id]: stars } },
          entry.id,
        )
        expect(resolved, entry.id).not.toBeNull()
        expect(resolved!.bangbooId).toBe(entry.id)
        expect(resolved!.defaultStars).toBe(stars)
      }
    }
    const inactive = resolveTargetTeamBangbooOption(
      { memberIds, bangbooStarsById: { 'bangboo-butler': 1 } },
      'bangboo-butler',
    )
    expect(inactive!.activationStatus).toBe('inactive')
    expect(inactive!.recommendationReason).toContain('本队未激活额外能力')
  })
})
