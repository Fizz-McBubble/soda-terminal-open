import { expect, it, vi } from 'vitest'
import {
  inferTeamStrength,
  inferredStrengthCalibration,
  teamStrengthModelPolicy,
} from './teamStrengthModel'
import { currentVersionProjection } from '../gameDataPacks/currentVersionProjection'
import { currentReleasedIdentityMap } from '../gameDataPacks/currentReleasedIdentityMap'
import { current31TeamStrengthCalibrationContractId } from './current31TeamStrengthCalibration'

// Isolate the expired artifact before loading any production module. The
// damaged-model tests in the other file must not supply this fixture's cache.
vi.mock('../gameDataPacks/generated/team-strength-model.3.1.json', async (importOriginal) => {
  const actual = await importOriginal<{ default: Record<string, unknown> }>()
  const stale = { ...actual.default, reviewedForVersion: '3.2' }
  return { ...stale, default: stale }
})

it('keeps the production freshness guard closed for stale inputs in both evidence modes', () => {
  const memberIds = ['agent-nekomata', 'agent-caesar', 'agent-rina']
  expect(teamStrengthModelPolicy.reviewedForVersion).toBe('3.2')
  expect(currentVersionProjection.gameVersion).toBe('3.3')
  expect(currentReleasedIdentityMap.gameVersion).toBe('3.3')
  expect(inferTeamStrength(memberIds)).toBeNull()
  expect(inferTeamStrength(memberIds, 'independent_evaluation')).toBeNull()
  const unavailable = inferredStrengthCalibration(
    {
      contract: current31TeamStrengthCalibrationContractId,
      status: 'insufficient',
      authority: 'none',
      kernelId: null,
      familyId: null,
      versionPosition: null,
      projectedStrengthBand: null,
      evidenceRefs: [],
      explanation: 'No exact source strength.',
    },
    memberIds,
  )
  expect(unavailable.inference).toBeUndefined()
  expect(unavailable.projectedStrengthBand).toBeNull()
  expect(unavailable.recommendationScore).toBeUndefined()
})
