import { describe, expect, it, vi } from 'vitest'
import { teamDynamicFixture, legalTeamDisc } from './teamDynamicIntegration.testFixture'
import { sourceBranchDiscs } from './targetTeamWarehouseFit.testFixture'
import { createTargetTeamAssignmentObjective } from './targetTeamAssignmentObjective'
import { calculateTargetTeamWarehouseFit } from './targetTeamWarehouseFit'
import { compileTargetTeamPlanningContext } from './targetTeamPlanningContext'
import {
  dynamicLegalInventory,
  compileDynamicCandidateLoadout,
} from '../optimizer/teamDynamicDomain'
import { candidateConstraintToDiscProfile } from '../gameDataPacks/candidateWarehouseConstraints'
import { optimizeAccountBuilds } from '../optimizer/optimizeAccountBuilds'
import { createLocalCalculationQueryClient } from '../application/localCalculationQueryClient'
import { calculationQueryContractVersion } from '../application/calculationQueryContract'
import {
  query,
  registerLocalCalculationQueryFixture,
} from '../application/localCalculationQueryClient.testFixture'
import { ensureBundledGameDataPacks } from '../gameDataPacks/repository'
import { readCurrentGameDataRuntimeSelection } from '../gameDataPacks/runtimeSelection'
import { computeBuildIntentFingerprint } from './buildIntent'

const { createDatabase } = registerLocalCalculationQueryFixture()

describe('production dynamic team inventory integration', () => {
  it('carries the real local query result into the existing plan and comparison consumer', async () => {
    const input = teamDynamicFixture()
    const db = createDatabase()
    await db.open()
    await ensureBundledGameDataPacks(db)
    const client = createLocalCalculationQueryClient({
      readRuntimeSelection: () => readCurrentGameDataRuntimeSelection(db),
    })
    const request = query('dynamic-production-query', input.candidate.memberIds)
    request.input.warehouse = input.warehouse
    const run = await client.calculateAccountDecision(request)
    const candidate = run.snapshot.teamEngine.recommendations.find(
      (row) =>
        [...row.memberIds].sort().join('|') === [...input.candidate.memberIds].sort().join('|'),
    )
    expect(candidate).toBeDefined()
    const result = await client.calculateTargetTeamWarehouseFit({
      contractVersion: calculationQueryContractVersion,
      kind: 'target_team_warehouse_fit',
      runId: run.runId,
      candidateId: candidate!.candidateId,
      equipmentParameters: input.parameters,
    })
    expect(result.status).toBe('ready')
    expect(result.warehousePlan.solver?.search?.domain).toBe('game_legal_inventory')
    expect(result.uniqueDiscCount).toBe(18)
    expect(result.warehousePlan.loadouts.flatMap((row) => row.discs)).toHaveLength(18)
  }, 30000)
  it('evaluates the current physical 18 discs first and finds a main stat outside source priorities', () => {
    const input = teamDynamicFixture()
    for (const row of input.buildIntent.recommendations)
      row.constraint!.mainStats = {
        '4': ['atk_percent'],
        '5': ['atk_percent'],
        '6': ['atk_percent'],
      }
    input.buildIntent.fingerprint = computeBuildIntentFingerprint(input.buildIntent)
    const baseline = compileTargetTeamPlanningContext(input)
    expect(baseline.status).toBe('supported')
    if (baseline.status !== 'supported') throw new Error('fixture missing combat conditions')
    expect(baseline.coverage.excludedEffects).toEqual([])
    const extra = legalTeamDisc(21, {
      id: 'critical-main-outside-source',
      mainStat: 'crit_dmg',
      setId: 'set-hormone-punk',
    })
    extra.subStats = legalTeamDisc(21).subStats.map((row) =>
      row.stat === 'crit_dmg' ? { stat: 'atk_percent', value: 3, upgrades: 0 } : row,
    )
    input.warehouse.discs.push(extra)
    expect(
      input.buildIntent.recommendations.every(
        (row) => !row.constraint!.mainStats['4']!.includes(extra.mainStat),
      ),
    ).toBe(true)
    const objective = createTargetTeamAssignmentObjective(input)
    const evaluate = vi.fn(objective.evaluate)
    const result = calculateTargetTeamWarehouseFit({
      warehouse: input.warehouse,
      buildIntent: input.buildIntent,
      bangbooSelection: { status: 'selected', bangbooId: input.parameters.bangbooId! },
      teamAssignmentObjective: { ...objective, evaluate },
    })
    expect(
      evaluate.mock.calls[0]![0].flatMap((row) => row.discs.map((choice) => choice.disc.id)).sort(),
    ).toEqual(input.fit.loadouts.flatMap((row) => row.discIds).sort())
    expect(result.status).toBe('ready')
    expect(result.uniqueDiscCount).toBe(18)
    expect(result.warehousePlan.solver?.search?.domain).toBe('game_legal_inventory')
    expect(evaluate(result.warehousePlan.loadouts)).toBeGreaterThan(baseline.totalDamage)
    expect(result.warehousePlan.loadouts.some((row) => row.setPattern === 'scattered')).toBe(true)
    expect(
      result.warehousePlan.loadouts
        .flatMap((row) => row.discs)
        .filter((row) => row.disc.id === extra.id),
    ).toHaveLength(1)
    // One physical improvement competes across all three members. The complete
    // team goal, rather than each member's source score, chooses its recipient.
    const allocations = input.candidate.memberIds.map((recipient) =>
      input.fit.loadouts.map((row) => {
        const profile = candidateConstraintToDiscProfile(
          input.buildIntent.recommendations.find((item) => item.agentId === row.agentId)!
            .constraint!,
        )!
        const selected = row.discIds
          .map((id) => input.warehouse.discs.find((disc) => disc.id === id)!)
          .map((disc) => (row.agentId === recipient && disc.slot === extra.slot ? extra : disc))
        return compileDynamicCandidateLoadout(selected, profile)!
      }),
    )
    const expectedValue = Math.max(...allocations.map((rows) => evaluate(rows) ?? -Infinity))
    expect(evaluate(result.warehousePlan.loadouts)).toBeCloseTo(expectedValue)
    const originalScore = input.fit.loadouts.reduce((sum, row) => {
      const profile = candidateConstraintToDiscProfile(
        input.buildIntent.recommendations.find((item) => item.agentId === row.agentId)!.constraint!,
      )!
      return (
        sum +
        compileDynamicCandidateLoadout(
          row.discIds.map((id) => input.warehouse.discs.find((disc) => disc.id === id)!),
          profile,
        )!.totalScore
      )
    }, 0)
    expect(result.warehousePlan.totalScore).toBeLessThan(originalScore)
    const originalIds = result.loadouts.flatMap((row) => row.discIds).sort()
    input.buildIntent.recommendations.forEach((recommendation) =>
      recommendation.constraint?.setPlans?.reverse(),
    )
    input.buildIntent.fingerprint = computeBuildIntentFingerprint(input.buildIntent)
    const reordered = calculateTargetTeamWarehouseFit({
      warehouse: input.warehouse,
      buildIntent: input.buildIntent,
      bangbooSelection: { status: 'selected', bangbooId: input.parameters.bangbooId! },
      teamAssignmentObjective: createTargetTeamAssignmentObjective(input),
    })
    expect(reordered.loadouts.flatMap((row) => row.discIds).sort()).toEqual(originalIds)
  })
  it('rejects inconsistent enhancement history and every repeated physical identity', () => {
    const input = teamDynamicFixture()
    const invalid = legalTeamDisc(18)
    invalid.subStats[0]!.value = 99
    const duplicate = legalTeamDisc(19)
    input.warehouse.discs.push(invalid, duplicate, { ...duplicate })
    expect(dynamicLegalInventory(input.warehouse.discs)).toHaveLength(18)
  })
  it('keeps explicit fixed and excluded physical resources in the game-legal objective domain', () => {
    const input = teamDynamicFixture()
    const fixedId = input.fit.loadouts[0]!.discIds[0]!
    const excluded = legalTeamDisc(18, { id: 'excluded-improvement' })
    input.warehouse.discs.push(excluded)
    input.buildIntent.constraints.fixedDiscByAgent = { [input.candidate.memberIds[0]]: fixedId }
    input.buildIntent.constraints.excludedDiscIds = [excluded.id]
    const result = calculateTargetTeamWarehouseFit({
      warehouse: input.warehouse,
      buildIntent: input.buildIntent,
      bangbooSelection: { status: 'selected', bangbooId: input.parameters.bangbooId! },
      teamAssignmentObjective: createTargetTeamAssignmentObjective(input),
    })
    expect(
      result.loadouts.find((row) => row.agentId === input.candidate.memberIds[0])!.discIds,
    ).toContain(fixedId)
    expect(result.loadouts.flatMap((row) => row.discIds)).not.toContain(excluded.id)
    expect(result.uniqueDiscCount).toBe(18)
  })
  it('visits an atomic 4/5/6 change whose intermediate moves do not improve the supplied full goal', () => {
    const input = teamDynamicFixture()
    const extras = [3, 4, 5].map((slot) =>
      legalTeamDisc(18 + slot, {
        id: `linked-main-${slot}`,
        mainStat: slot === 3 ? 'crit_dmg' : slot === 4 ? 'physical_dmg' : 'hp_percent',
      }),
    )
    extras[0]!.subStats = extras[0]!.subStats.map((row) =>
      row.stat === 'crit_dmg' ? { stat: 'atk_percent', value: 3, upgrades: 0 } : row,
    )
    extras[2]!.subStats = extras[2]!.subStats.map((row) =>
      row.stat === 'hp_percent' ? { stat: 'atk_percent', value: 18, upgrades: 5 } : row,
    )
    input.warehouse.discs.push(...extras)
    const result = optimizeAccountBuilds(
      input.warehouse.discs,
      input.buildIntent.recommendations.map(
        (row) => candidateConstraintToDiscProfile(row.constraint!)!,
      ),
      {
        priorityAgentIds: [...input.candidate.memberIds],
        teamAssignmentObjective: {
          domain: 'game_legal_inventory',
          fingerprint: 'synthetic-atomic-threshold',
          baselineDiscIdsByAgent: Object.fromEntries(
            input.fit.loadouts.map((row) => [row.agentId, row.discIds]),
          ),
          evaluate: (loadouts) =>
            loadouts.some(
              (row) =>
                row.discs.filter((choice) => choice.disc.id.startsWith('linked-main')).length === 3,
            )
              ? 1
              : 0,
        },
      },
    )
    expect(
      result.global.some(
        (row) =>
          row.discs.filter((choice) => choice.disc.id.startsWith('linked-main')).length === 3,
      ),
    ).toBe(true)
    expect(
      new Set(result.global.flatMap((row) => row.discs.map((choice) => choice.disc.id))).size,
    ).toBe(18)
  })
  it('does not make an unknown newly triggered four-piece win against a fully covered baseline', () => {
    const input = teamDynamicFixture()
    const goal = createTargetTeamAssignmentObjective(input)
    const assignments = input.fit.loadouts.map((row) => ({
      agentId: row.agentId,
      discs: row.discIds.map((id) => ({
        disc: input.warehouse.discs.find((disc) => disc.id === id)!,
      })),
    }))
    expect(goal.evaluate(assignments as never)).not.toBeNull()
    const extras = [0, 1, 2, 3].map((slot) =>
      legalTeamDisc(18 + slot, { id: `unknown-trigger-${slot}`, setId: 'set-astral-voice' }),
    )
    input.warehouse.discs.push(...extras)
    const changed = assignments.map((row, member) =>
      member
        ? row
        : {
            ...row,
            discs: row.discs.map((choice, slot) => (slot < 4 ? { disc: extras[slot]! } : choice)),
          },
    )
    expect(goal.evaluate(changed as never)).toBeNull()
    // Repeated unknown gap identities do not certify a different stat dependency.
    const unknownBaseline = createTargetTeamAssignmentObjective(input)
    expect(unknownBaseline.evaluate(changed as never)).toBeNull()
  })
  it('preserves useful source recommendation and original branch search when equipped baseline has an unavailable dynamic objective', () => {
    const input = teamDynamicFixture()
    input.warehouse.discs.push(
      ...input.candidate.memberIds.flatMap((agentId, member) =>
        sourceBranchDiscs(agentId, 400 + member).map((sourceDisc, slot) => {
          const disc = legalTeamDisc(member * 6 + slot, {
            id: sourceDisc.id,
            setId: sourceDisc.setId,
            mainStat: sourceDisc.mainStat,
          })
          disc.subStats = disc.subStats.map((row) =>
            row.stat === disc.mainStat
              ? { stat: 'def_flat', value: 15 * (row.upgrades + 1), upgrades: row.upgrades }
              : row,
          )
          return disc
        }),
      ),
    )
    const unknownEquipment = [0, 1, 2, 3].map((slot) =>
      legalTeamDisc(18 + slot, { id: `equipped-unknown-${slot}`, setId: 'set-astral-voice' }),
    )
    input.warehouse.discs.push(...unknownEquipment)
    const firstAgentId = input.candidate.memberIds[0]!
    const originalEquipped = input.fit.loadouts.find((row) => row.agentId === firstAgentId)!.discIds
    const equippedWithUnknown = [
      ...unknownEquipment.map((disc) => disc.id),
      originalEquipped[4]!,
      originalEquipped[5]!,
    ]
    input.fit.loadouts = input.fit.loadouts.map((row) =>
      row.agentId === firstAgentId ? { ...row, discIds: equippedWithUnknown } : row,
    )
    input.warehouse.roster.agents = input.warehouse.roster.agents.map((agent) =>
      agent.agentId === firstAgentId ? { ...agent, equippedDiscIds: equippedWithUnknown } : agent,
    )
    const objective = createTargetTeamAssignmentObjective(input)
    expect(
      objective.evaluate(
        input.fit.loadouts.map((row) => ({
          agentId: row.agentId,
          discs: row.discIds.map((id) => ({
            disc: input.warehouse.discs.find((d) => d.id === id)!,
          })),
        })) as never,
      ),
    ).toBeNull()

    const fitInput = {
      warehouse: input.warehouse,
      buildIntent: input.buildIntent,
      bangbooSelection: { status: 'selected' as const, bangbooId: input.parameters.bangbooId! },
    }
    const source = calculateTargetTeamWarehouseFit(fitInput)
    expect(source.status).toBe('ready')
    const before = JSON.stringify(input.warehouse)
    const result = calculateTargetTeamWarehouseFit({
      ...fitInput,
      teamAssignmentObjective: objective,
    })

    expect(result.status).toBe('ready')
    expect(result.uniqueDiscCount).toBe(18)
    const firstAgentResultDiscs = result.loadouts.find(
      (row) => row.agentId === firstAgentId,
    )!.discIds
    expect(firstAgentResultDiscs).not.toEqual(equippedWithUnknown)
    expect(firstAgentResultDiscs.some((id) => unknownEquipment.map((d) => d.id).includes(id))).toBe(
      false,
    )
    expect(result.sourceBranchSearch.status).not.toBe('dynamic_objective')
    expect(['preferred', 'conflict_fallback', 'not_needed']).toContain(
      result.sourceBranchSearch.status,
    )
    expect(result.loadouts).toEqual(source.loadouts)
    expect(result.sourceBranchSearch).toEqual(source.sourceBranchSearch)
    expect(JSON.stringify(input.warehouse)).toBe(before)
  })
})
