import { describe, expect, it } from 'vitest'
import {
  compareCalculationContexts,
  createCalculationContext,
  type CalculationContextInput,
} from './calculationContext'

function input(): CalculationContextInput {
  return {
    schemaVersion: 'calculation-context-v2',
    contextId: 'audit-context',
    gameVersion: '3.2',
    canonical: {
      packageId: 'audit-package',
      packageVersion: '1',
      gameVersion: '3.2',
      contentHash: 'audit-package-hash',
      status: 'formal',
      rollbackPackageId: null,
    },
    accountSnapshot: {
      accountId: 'synthetic-audit-account',
      rosterHash: 'roster',
      warehouseHash: 'warehouse',
      planningHash: 'planning',
      capturedAt: '2026-10-02T00:00:00.000Z',
      stale: false,
    },
    scope: { kind: 'agent', agentIds: ['audit-agent'] },
    actors: [
      {
        agentId: 'audit-agent',
        level: 60,
        mindscape: 0,
        potential: null,
        skillLevels: null,
        wEngine: null,
        discs: [],
        finalStatsHash: null,
      },
    ],
    bangboo: { id: 'bangboo-a', level: 60, coreLevel: 5 },
    scenario: {
      playModeId: 'training',
      scenarioId: 'audit-enemy',
      scenarioHash: 'enemy-hash',
      enemy: null,
    },
    cycle: null,
    objective: 'formal_damage',
    constraintsHash: 'audit-constraints',
    evidence: [],
  }
}

describe('strict calculation comparison identity', () => {
  it.each(['id', 'level', 'coreLevel', 'none'] as const)(
    'rejects a change to Bangboo %s',
    (field) => {
      const left = createCalculationContext(input())
      const changed = input()
      if (field === 'none') changed.bangboo = null
      else if (field === 'id') changed.bangboo!.id = 'bangboo-b'
      else changed.bangboo![field] = 1
      const right = createCalculationContext(changed)
      expect(left.comparabilityKey).not.toBe(right.comparabilityKey)
      expect(compareCalculationContexts(left, right)).toEqual({
        comparable: false,
        mismatchKinds: ['bangboo'],
      })
    },
  )

  it.each(['packageVersion', 'gameVersion', 'status', 'rollbackPackageId'] as const)(
    'rejects a change to canonical %s',
    (field) => {
      const left = createCalculationContext(input())
      const changed = input()
      if (field === 'status') changed.canonical.status = 'candidate'
      else changed.canonical[field] = 'other'
      const right = createCalculationContext(changed)
      expect(left.comparabilityKey).not.toBe(right.comparabilityKey)
      expect(compareCalculationContexts(left, right)).toEqual({
        comparable: false,
        mismatchKinds: ['canonical'],
      })
    },
  )

  it.each([true, false])('keeps identical Bangboo presence %s comparable', (present) => {
    const left = input()
    if (!present) left.bangboo = null
    const right = structuredClone(left)
    right.contextId = 'another-result'
    right.accountSnapshot.capturedAt = '2026-10-03T00:00:00.000Z'
    expect(
      compareCalculationContexts(createCalculationContext(left), createCalculationContext(right)),
    ).toEqual({ comparable: true, mismatchKinds: [] })
  })
})
