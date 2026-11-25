import { expect, it } from 'vitest'
import { lookupCurrent31TeamIntrinsicDetails } from './current31TeamIntrinsicIndex'
import { selectSavedDefaultTeamAdmissionPlay } from './defaultTeamAdmissionPlay'
import {
  preparedBoxBangbooAlternatives,
  preparedBoxFormationRanking,
} from './preparedBoxFormationRanking'
import { targetTeamBangbooOptions } from './targetTeamSourceBangbooOptions'
import {
  currentGenericTeamRankingStatus,
  lookupCurrentGenericTeamRanking,
  lookupCurrentGenericTeamRankingForPlay,
} from './teamGenericRanking'

it('replays distinct default plays and exploration rows against the current bound catalog', () => {
  const catalog = currentGenericTeamRankingStatus.contentHash
  for (const members of [
    ['agent-astra', 'agent-miyabi', 'agent-nangong'],
    ['agent-sunna', 'agent-miyabi', 'agent-nangong'],
    ['agent-anby', 'agent-lycaon', 'agent-koleda'],
  ]) {
    const direction = lookupCurrent31TeamIntrinsicDetails(members, 'control')?.mechanismDirection
    const play = direction && selectSavedDefaultTeamAdmissionPlay(members, direction, catalog)
    const live =
      (play && lookupCurrentGenericTeamRankingForPlay(members, play)) ||
      lookupCurrentGenericTeamRanking(members)
    expect(preparedBoxFormationRanking([...members].reverse(), catalog)).toEqual(live)
    expect(preparedBoxFormationRanking(members, 'stale')).toBeUndefined()
  }
  expect(
    preparedBoxFormationRanking(['agent-anby', 'agent-anby', 'unknown'], catalog),
  ).toBeUndefined()
})

it('returns an independent graduated score on re-opening a ranked trio', () => {
  const members = ['agent-aria', 'agent-nangong', 'agent-sunna']
  const catalog = currentGenericTeamRankingStatus.contentHash
  const original = preparedBoxFormationRanking(members, catalog)
  expect(original?.graduatedScore).toBeDefined()
  const reopened = preparedBoxFormationRanking([...members].reverse(), catalog)
  expect(reopened?.graduatedScore).toEqual(original?.graduatedScore)
  expect(reopened?.graduatedScore).not.toBe(original?.graduatedScore)
})

it('returns the same activation alternatives as the current team data, in order', () => {
  const members = ['agent-aria', 'agent-nangong', 'agent-sunna']
  const catalog = currentGenericTeamRankingStatus.contentHash
  const options = targetTeamBangbooOptions({ memberIds: members }).map(({ bangbooId }) => bangbooId)
  expect(options.length).toBeGreaterThan(0)
  expect(preparedBoxBangbooAlternatives([...members].reverse(), catalog)).toEqual(options)
  expect(preparedBoxBangbooAlternatives(members, 'stale')).toBeUndefined()
})
