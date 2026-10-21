// This suite verifies the frozen 3.2 source/media contract; 3.3 adoption has separate current suites.
vi.mock('./currentGameDataSelection', () => ({
  currentGameDataSelection: {
    gameVersion: '3.2',
    packageId: 'game-base-3.2.0-current',
    phase: 'phase_ii',
  },
}))
import { describe, expect, it, vi } from 'vitest'
import { currentAgentDirectory } from '../assault/catalog'
import { getReviewedAgentAttackTypes32 } from './reviewedAgentAttackTypes32'
import { projectCurrentBangbooComposition32 } from '../calculation/currentBangbooCompositionIdentity'
import { describeBangbooConditions } from '../decision/bangbooConditionPresentation'
import { resolveTargetTeamBangbooOption } from '../decision/targetTeamSourceBangbooOptions'

describe('source-reviewed attack types and Boollseye consumers', () => {
  it('covers 60 identities with sourced single and multiple types', () => {
    const counts = { slash: 0, strike: 0, pierce: 0 }
    for (const agent of currentAgentDirectory) {
      const types = getReviewedAgentAttackTypes32(agent.id)
      expect(types, agent.id).not.toBeNull()
      types!.forEach((type) => counts[type]++)
    }
    expect(currentAgentDirectory).toHaveLength(60)
    expect(counts).toEqual({ slash: 32, strike: 24, pierce: 9 })
    expect(getReviewedAgentAttackTypes32('agent-harumasa')).toEqual(['pierce', 'slash'])
    expect(getReviewedAgentAttackTypes32('agent-caesar')).toEqual(['slash', 'strike'])
    expect(getReviewedAgentAttackTypes32('agent-nonexistent')).toBeNull()
    expect(
      projectCurrentBangbooComposition32(['agent-harumasa', 'agent-caesar', 'agent-claret']),
    ).toMatchObject({ 'attack_type:slash': 3, 'attack_type:strike': 2, 'attack_type:pierce': 1 })
  })

  it('uses a known zero, one or multiple Pierce members consistently through choice and display', () => {
    for (const [memberIds, count] of [
      [['agent-sunna', 'agent-aria', 'agent-nangong'], 0],
      [['agent-grace', 'agent-anby', 'agent-nicole'], 1],
      [['agent-grace', 'agent-harumasa', 'agent-billy'], 3],
    ] as const) {
      const condition = describeBangbooConditions({
        memberIds,
        bangbooId: 'bangboo-boollseye',
        stars: 5,
      })
      expect(condition.activationStatus).toBe(count > 0 ? 'active' : 'inactive')
      expect(condition.requirements[0]).toMatchObject({
        required: 1,
        current: count,
        met: count > 0,
      })
      expect(
        resolveTargetTeamBangbooOption({ memberIds }, 'bangboo-boollseye')?.activationStatus,
      ).toBe(condition.activationStatus)
    }
    expect(projectCurrentBangbooComposition32(['agent-grace', 'agent-grace'])).toBeNull()
    expect(projectCurrentBangbooComposition32(['agent-nonexistent'])).toBeNull()
  })
})
