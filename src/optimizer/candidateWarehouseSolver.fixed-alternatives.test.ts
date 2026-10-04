import { describe, expect, it } from 'vitest'
import type { DriveDisc } from '../domain/schemas'
import { sampleDiscs } from '../evaluation/fixtures'
import { candidateSetPlansForConstraint } from '../gameDataPacks/candidateWarehouseConstraints'
import {
  candidateConstraintForAgent,
  solveCandidateAgentAlternatives,
  solveCandidateWarehouse,
} from './candidateWarehouseSolver'

describe('single-agent alternatives with a fixed disc', () => {
  const agentId = 'agent-remielle'
  const constraint = candidateConstraintForAgent(agentId)!
  const branch = candidateSetPlansForConstraint(constraint).find((plan) => plan.pattern === '4+2')!
  const primary = branch.primarySetIds[0]!
  const secondaries = branch.secondarySetIds.filter((setId) => setId !== primary).sort()
  const mainStats = [
    'hp_flat',
    'atk_flat',
    'def_flat',
    constraint.mainStats['4']![0]!,
    constraint.mainStats['5']![0]!,
    constraint.mainStats['6']![0]!,
  ] as const
  const inventory: DriveDisc[] = [primary, ...secondaries].flatMap((setId) =>
    mainStats.map((mainStat, index) => ({
      ...sampleDiscs.treasureCandidate,
      id: `${setId}-${index + 1}`,
      slot: (index + 1) as DriveDisc['slot'],
      setId,
      mainStat,
    })),
  )
  const fixedId = `${secondaries.at(-1)!}-5`

  it('retains the fixed recommended secondary while skipping incompatible secondary representatives', () => {
    expect(secondaries.length).toBeGreaterThan(1)
    const before = structuredClone(inventory)
    const alternatives = solveCandidateAgentAlternatives(inventory, agentId, 10, {
      fixedDiscByAgent: { [agentId]: fixedId },
    })
    expect(alternatives.length).toBeGreaterThan(0)
    for (const plan of alternatives) {
      const ids = plan.loadouts[0]!.discs.map(({ disc }) => disc.id)
      expect(ids).toHaveLength(6)
      expect(new Set(ids).size).toBe(6)
      expect(ids).toContain(fixedId)
      expect(plan.inventoryTransition).toBeUndefined()
    }
    expect(inventory).toEqual(before)
  })

  it('still rejects nonexistent and simultaneously excluded fixed discs', () => {
    expect(() =>
      solveCandidateAgentAlternatives(inventory, agentId, 10, {
        fixedDiscByAgent: { [agentId]: 'missing-fixed-disc' },
      }),
    ).toThrow('固定的驱动盘已不存在')
    expect(() =>
      solveCandidateAgentAlternatives(inventory, agentId, 10, {
        fixedDiscByAgent: { [agentId]: fixedId },
        excludedDiscIds: [fixedId],
      }),
    ).toThrow('同一张盘不能同时固定和排除')
    expect(() =>
      solveCandidateWarehouse(inventory, [agentId, 'agent-norma'], 'team', {
        fixedDiscByAgent: { [agentId]: fixedId, 'agent-norma': fixedId },
      }),
    ).toThrow('同一张固定盘不能分配给多个代理人')
  })
})
