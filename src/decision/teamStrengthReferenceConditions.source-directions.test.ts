import { describe, expect, it } from 'vitest'
import { currentReviewedTeamSourceDirections } from '../gameDataPacks/reviewedTeamSourceDirections'
import { nonEditorialTrainingTeams } from './teamStrengthReferenceConditionsData'
import {
  computeTeamStrengthReferenceConditionsIdentity,
  currentTeamStrengthReferenceConditions,
  teamStrengthReferenceConditionTeamIdentity,
} from './teamStrengthReferenceConditions'

describe('exact source conditions beyond editorial labels', () => {
  it('preserves all retained source conditions and provenance for the existing label domain', () => {
    const directions = new Map(
      currentReviewedTeamSourceDirections().map((row) => [
        [...row.memberIds].sort().join('|'),
        row,
      ]),
    )
    let covered = 0
    for (const team of nonEditorialTrainingTeams) {
      const direction = directions.get(team.key)
      if (!direction?.conditions.length) continue
      covered += 1
      const result = currentTeamStrengthReferenceConditions(team.memberIds)
      expect(result.unhandledConditions.map((row) => row.rawDescription)).toEqual(
        expect.arrayContaining(direction.conditions),
      )
      expect(result.evidenceRefs).toEqual(
        expect.arrayContaining(direction.sourceRefs.map((row) => row.url)),
      )
      expect(result.sourceContext).toMatchObject({
        direction: { memberIds: direction.memberIds, conditions: direction.conditions },
      })
      expect(
        (result.sourceContext as { direction: { sourceRefs: unknown[] } }).direction.sourceRefs,
      ).toMatchObject(
        direction.sourceRefs.map(({ id, url, sourceVersion, contentHash }) => ({
          id,
          url,
          sourceVersion,
          contentHash,
        })),
      )
      expect(result.unhandledConditions.every((row) => row.numericalized === false)).toBe(true)
      expect(result.sourceAuthority).toBe(team.authority)
    }
    expect(covered).toBe(47)
  })

  it.each([
    [['agent-jane', 'agent-vivian', 'agent-yuzuha'], 'agent-jane'],
    [['agent-remielle', 'agent-jane', 'agent-velina'], 'agent-jane'],
    [['agent-jane', 'agent-velina', 'agent-yuzuha'], 'agent-jane'],
    [['agent-miyabi', 'agent-lycaon', 'agent-soukaku'], 'agent-lycaon'],
    [['agent-astra', 'agent-orphie-magus', 'agent-soldier-0-anby'], 'agent-soldier-0-anby'],
  ])('binds the already verified guide principal for %j', (members, principal) => {
    const result = currentTeamStrengthReferenceConditions(members as string[])
    expect(result.potentialByAgentId).toEqual({ [principal as string]: 6 })
    expect(result.agentConditions.find((row) => row.agentId === principal)).toMatchObject({
      status: 'explicit_numeric',
      numericLevelBasis: 'source_reference_configuration',
    })
    expect(
      result.agentConditions
        .filter((row) => row.agentId !== principal)
        .every((row) => row.numericLevel === null),
    ).toBe(true)
  })

  it('invalidates both condition identities when exact source conditions change', () => {
    const ids = ['agent-remielle', 'agent-jane', 'agent-velina']
    const result = currentTeamStrengthReferenceConditions(ids)
    const context = result.sourceContext as { direction: { conditions: string[] } }
    const original = context.direction.conditions[0]!
    const globalBefore = computeTeamStrengthReferenceConditionsIdentity()
    const teamBefore = teamStrengthReferenceConditionTeamIdentity(ids)
    try {
      context.direction.conditions[0] = `${original} changed source condition`
      expect(computeTeamStrengthReferenceConditionsIdentity()).not.toBe(globalBefore)
      expect(teamStrengthReferenceConditionTeamIdentity(ids)).not.toBe(teamBefore)
    } finally {
      context.direction.conditions[0] = original
    }
  })
})
