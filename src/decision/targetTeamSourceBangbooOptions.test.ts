import { projectBangbooUtility } from '../calculation/currentBangbooUtilityProjection'
import { getCurrentBangbooContractRequirements } from '../calculation/currentBangbooMechanicContracts'
import { describe, expect, it } from 'vitest'
import { currentBangbooDirectory } from '../assault/catalog'
import { getCurrentAgentEventContract } from '../calculation/currentAgentMechanicContracts'
import {
  targetTeamBangbooOptions,
  resolveTargetTeamBangbooOption,
  reviewedSourceBangbooOptions,
  recommendedTargetBangbooDefault,
  maxTargetTeamBangbooRecommendations,
} from './targetTeamSourceBangbooOptions'

describe('targetTeamSourceBangbooOptions recommendation shortlist and policies', () => {
  it('smoke: supports Phoenix composition without inventing events or restricting unranked exploration', () => {
    const memberIds = ['agent-phoenix', 'agent-velina', 'agent-remielle']
    const options = targetTeamBangbooOptions({ memberIds })
    expect(options.length).toBeGreaterThan(0)
    expect(options.every((row) => row.activationStatus === 'active')).toBe(true)
    expect(getCurrentAgentEventContract('agent-phoenix')).toBeNull()
    expect(options.every((option) => option.recipientFit !== 'unknown')).toBe(true)
    const recoveryOption = resolveTargetTeamBangbooOption({ memberIds }, 'bangboo-exploreboo')!
    const recovery = projectBangbooUtility({
      memberIds,
      bangbooId: recoveryOption.bangbooId,
      stars: recoveryOption.defaultStars,
      activationStatus: recoveryOption.activationStatus,
    })
    expect(recovery.baseUtilities.length).toBeGreaterThan(0)
    expect(recovery.recipientFit).not.toBe('unknown')
    expect(
      resolveTargetTeamBangbooOption({ memberIds }, 'bangboo-rocketboo')?.activationStatus,
    ).toBe('inactive')
    const invalidStars = { 'bangboo-rocketboo': 1 as const }
    Reflect.set(invalidStars, 'bangboo-rocketboo', 6)
    expect(
      resolveTargetTeamBangbooOption(
        { memberIds, bangbooStarsById: invalidStars },
        'bangboo-rocketboo',
      ),
    ).toBeNull()
    const attackTypeBoo = currentBangbooDirectory.find((row) =>
      getCurrentBangbooContractRequirements(row.id)?.compositionKeys.some((key) =>
        key.startsWith('attack_type:'),
      ),
    )
    expect(attackTypeBoo).toBeDefined()
    expect(
      resolveTargetTeamBangbooOption({ memberIds }, attackTypeBoo!.id)?.activationStatus,
    ).not.toBe('unknown')
    expect(
      targetTeamBangbooOptions({ memberIds: ['agent-phoenix', 'agent-jane', 'agent-yuzuha'] })
        .length,
    ).toBeGreaterThan(0)
  })

  it('does not promote Brawler above a sourced Amillion using a fabricated whole-active bonus', () => {
    const memberIds = ['agent-anby', 'agent-billy', 'agent-nicole'] as const
    const brawler = resolveTargetTeamBangbooOption({ memberIds }, 'bangboo-brawlerboo')!
    const amillion = resolveTargetTeamBangbooOption({ memberIds }, 'bangboo-amillion')!
    expect(brawler.comparableSlice!.value).toBeLessThan(amillion.comparableSlice!.value)
    expect(targetTeamBangbooOptions({ memberIds })[0]?.bangbooId).toBe('bangboo-amillion')
  })
  it('retains the most prioritized valid exact 3-agent reviewed option as default (slot 0)', () => {
    const memberIds = ['agent-anby', 'agent-anton', 'agent-nicole'] as const
    const reviewed = reviewedSourceBangbooOptions({ memberIds }).filter(
      (row) => row.activationStatus === 'active',
    )
    const options = targetTeamBangbooOptions({ memberIds })
    expect(options.length).toBeLessThanOrEqual(maxTargetTeamBangbooRecommendations)
    expect(options.length).toBeGreaterThan(0)
    // afa03138 source replay already selected Electroboo before the 3.3 adoption.
    expect(options[0]!.bangbooId).toBe('bangboo-electroboo')
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
    expect(options.map((row) => row.recipientFit)).not.toContain('not_applicable')
    expect(options.map((row) => row.bangbooId)).not.toContain('bangboo-booressure')
    expect(recommendedTargetBangbooDefault({ memberIds })?.bangbooId).not.toBe('bangboo-booressure')
    for (const bangbooId of ['bangboo-butler', 'bangboo-booressure']) {
      const manual = resolveTargetTeamBangbooOption(
        { memberIds, bangbooStarsById: { [bangbooId]: 1 } },
        bangbooId,
      )
      expect(manual?.bangbooId).toBe(bangbooId)
      expect(manual?.defaultStars).toBe(1)
      expect(manual?.comparableSlice).toBeUndefined()
    }
    const esme = resolveTargetTeamBangbooOption(
      { memberIds, bangbooStarsById: { 'bangboo-miss-esme': 3 } },
      'bangboo-miss-esme',
    )
    expect(esme?.primaryPurpose).toBe('sustain')
    expect(esme?.recipientFit).not.toBe('not_applicable')
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
