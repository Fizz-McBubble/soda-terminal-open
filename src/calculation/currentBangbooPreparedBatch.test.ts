import { describe, expect, it } from 'vitest'
import {
  currentBangbooMechanicContractIds,
  prepareCurrentBangbooAdditionalActivation,
  resolveCurrentBangbooAdditionalActivation,
} from './currentBangbooMechanicContracts'
import {
  createBangbooUtilityProjector,
  projectBangbooUtility,
} from './currentBangbooUtilityProjection'
import { projectCurrentBangbooComposition32 } from './currentBangbooCompositionIdentity'
import { currentReviewedTeamSourceDirections } from '../gameDataPacks/reviewedTeamSourceDirections'

const teams = [
  ['agent-anby', 'agent-anton', 'agent-nicole'],
  ['agent-lycaon', 'agent-corin', 'agent-rina'],
  ['agent-yixuan', 'agent-dialyn', 'agent-lucia'],
  ['agent-yixuan', 'agent-lucia', 'agent-yidhari'],
]

describe('scope-local Bangboo preparation preserves all current options', () => {
  it.each(currentReviewedTeamSourceDirections())(
    'retains all released options for source trio $memberIds',
    ({ memberIds }) => {
      const composition = projectCurrentBangbooComposition32(memberIds)!
      expect(composition).not.toBeNull()
      const activate = prepareCurrentBangbooAdditionalActivation(composition)
      const utility = createBangbooUtilityProjector(memberIds)
      for (const stableId of currentBangbooMechanicContractIds) {
        const selection = { stableId, additionalAbilityLevel: 1 }
        const resolved = activate(selection)
        expect(resolved).toEqual(
          resolveCurrentBangbooAdditionalActivation({ ...selection, composition }),
        )
        const input = {
          bangbooId: stableId,
          stars: 1,
          activationStatus:
            resolved.status !== 'supported'
              ? ('unknown' as const)
              : resolved.active
                ? ('active' as const)
                : ('inactive' as const),
        }
        expect(utility(input)).toEqual(projectBangbooUtility({ ...input, memberIds }))
      }
    },
  )

  it('matches the validated direct activation for every released option and legal star', () => {
    for (const memberIds of teams) {
      const composition = projectCurrentBangbooComposition32(memberIds)!
      const prepared = prepareCurrentBangbooAdditionalActivation(composition)
      for (const stableId of currentBangbooMechanicContractIds)
        for (const additionalAbilityLevel of [1, 2, 3, 4, 5]) {
          const selection = { stableId, additionalAbilityLevel }
          expect(prepared(selection)).toEqual(
            resolveCurrentBangbooAdditionalActivation({ ...selection, composition }),
          )
        }
    }
  })

  it('keeps invalid inputs rejected and legacy composition aliases normalized', () => {
    const compositions: Readonly<Record<string, number>>[] = [
      { 'attribute:ice': -1 },
      { 'attribute:ice': 1.5 },
      { 'attribute:ice': NaN },
      { 'attribute:ice': Infinity },
      { 'agent:agent-billy': 1, 'agent:billy': 0 },
    ]
    for (const composition of compositions) {
      const prepared = prepareCurrentBangbooAdditionalActivation(composition)
      for (const selection of [
        { stableId: 'bangboo-bangvolver', additionalAbilityLevel: 1 },
        { stableId: 'bangboo-unknown', additionalAbilityLevel: 2 },
        { stableId: 'bangboo-bangvolver', additionalAbilityLevel: 0 },
        { stableId: 'bangboo-bangvolver', additionalAbilityLevel: 6 },
        { stableId: 'bangboo-bangvolver', additionalAbilityLevel: 1.5 },
      ])
        expect(prepared(selection)).toEqual(
          resolveCurrentBangbooAdditionalActivation({ ...selection, composition }),
        )
    }
  })

  it('isolates the validated composition snapshot from later caller mutation', () => {
    const composition = { 'attribute:electric': 2 }
    const selection = { stableId: 'bangboo-plugboo', additionalAbilityLevel: 1 }
    const prepared = prepareCurrentBangbooAdditionalActivation(composition)
    const before = prepared(selection)
    expect(before).toMatchObject({ status: 'supported', active: true })
    composition['attribute:electric'] = 0
    expect(prepared(selection)).toEqual(before)
    expect(resolveCurrentBangbooAdditionalActivation({ ...selection, composition })).toMatchObject({
      status: 'supported',
      active: false,
    })
    expect(prepareCurrentBangbooAdditionalActivation(composition)(selection)).not.toEqual(before)
  })

  it('preserves every utility, capacity, recipient and reason with full event inputs', () => {
    for (const memberIds of teams) {
      const prepared = createBangbooUtilityProjector(memberIds)
      for (const bangbooId of currentBangbooMechanicContractIds)
        for (const stars of [1, 2, 3, 4, 5])
          for (const activationStatus of ['active', 'inactive', 'unknown'] as const) {
            const input = {
              bangbooId,
              stars,
              activationStatus,
              eventFlags: { on_field_attack: true, enemy_daze_above_50: true },
              accumulators: { enemyCount: 3 },
              enemyCount: 3,
              chainEnemiesHit: 2,
            }
            expect(prepared(input)).toEqual(projectBangbooUtility({ ...input, memberIds }))
          }
    }
  })

  it('does not donate mutable member arrays or ordinary-energy recipients between teams', () => {
    const memberIds = [...teams[0]!]
    const prepared = createBangbooUtilityProjector(memberIds)
    const input = { bangbooId: 'bangboo-butler', stars: 1, activationStatus: 'active' as const }
    const before = prepared(input)
    memberIds.splice(0, 3, ...teams[3]!)
    expect(prepared(input)).toEqual(before)
    expect(createBangbooUtilityProjector(memberIds)(input)).toEqual(
      projectBangbooUtility({ ...input, memberIds }),
    )
    expect(createBangbooUtilityProjector(memberIds)(input)).not.toEqual(before)
    for (const invalidMembers of [['agent-anby'], ['unknown', 'unknown', 'unknown']])
      expect(createBangbooUtilityProjector(invalidMembers)(input)).toEqual(
        projectBangbooUtility({ ...input, memberIds: invalidMembers }),
      )
    const flagInput = {
      bangbooId: 'bangboo-sumoboo',
      stars: 1,
      activationStatus: 'active' as const,
    }
    expect(prepared({ ...flagInput, eventFlags: { enemy_daze_above_50: true } })).not.toEqual(
      prepared({ ...flagInput, eventFlags: { enemy_daze_above_50: false } }),
    )
  })
})
