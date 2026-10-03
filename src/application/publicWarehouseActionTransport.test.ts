import { describe, expect, it } from 'vitest'
import type { WarehouseActionProjection } from './warehouseActionContract'
import {
  packPublicWarehouseActions,
  unpackPublicWarehouseActions,
} from './publicWarehouseActionTransport'

describe('public warehouse action transport', () => {
  it('shares repeated agent lists and restores the exact page contract', () => {
    const agents = Array.from({ length: 80 }, (_, index) => `agent-${index}`)
    const action = {
      disc: { id: 'disc-1', setId: 'set-1', slot: 1, level: 0, mainStat: 'hp_flat' },
      action: 'keep' as const,
      absoluteRetention: {
        disposition: 'keep' as const,
        policyId: 'test',
        policyCalibration: 'candidate' as const,
        sourceCoverage: 'complete' as const,
        branchCount: 1,
        bestUseProfileId: 'branch-1',
        bestUseScore: 90,
        ownedUseAgentIds: [],
        unownedUseAgentIds: agents,
        leadingUses: [],
      },
      recommendationState: 'current' as const,
      reasons: [],
      statuses: [],
      compatibleAgentIds: agents,
      retentionAgentIds: agents,
      usageAgentIds: [],
      affectedAgentIds: agents,
      affectedPlans: [],
      affectedTeams: [],
      alternativeDiscIds: [],
    }
    const original: WarehouseActionProjection = {
      runId: 'run-1',
      fingerprint: 'hash',
      accountId: 'account-1',
      state: 'current',
      sideEffect: 'read_only',
      claim: { status: 'limited', summary: 'test' },
      counts: { keep: 2, enhance: 0, cleanup: 0 },
      actions: [action, { ...action, disc: { ...action.disc, id: 'disc-2' } }],
    }
    const packed = packPublicWarehouseActions(original)
    expect(JSON.stringify(packed).length).toBeLessThan(JSON.stringify(original).length / 3)
    expect(unpackPublicWarehouseActions(JSON.parse(JSON.stringify(packed)))).toEqual(original)
    expect(original.actions[0]?.compatibleAgentIds).toBe(agents)
  })

  it('rejects a malformed list reference instead of losing use evidence', () => {
    expect(() =>
      unpackPublicWarehouseActions({
        agentListsVersion: 1,
        agentLists: [],
        actions: [{ compatibleAgentIds: 4 }],
      } as never),
    ).toThrow('驱动盘分析用途资料无效')
  })

  it('preserves repeated condition and source text and rejects corrupt evidence references', () => {
    const detail = 'A named build condition and its complete evidence must remain visible. '.repeat(
      12,
    )
    const original = {
      actions: Array.from({ length: 12 }, (_, index) => ({
        disc: { id: `disc-${index}` },
        compatibleAgentIds: [],
        absoluteRetention: {
          ownedUseAgentIds: [],
          unownedUseAgentIds: [],
          blockedBy: [{ detail, sourceIds: ['upstream:commit:sha256'.repeat(5)] }],
          leadingUses: [{ functionDetail: detail, currentScore: index / 3 }],
        },
      })),
    } as unknown as WarehouseActionProjection
    const packed = packPublicWarehouseActions(original)
    expect(JSON.stringify(packed).length).toBeLessThan(JSON.stringify(original).length / 3)
    expect(unpackPublicWarehouseActions(JSON.parse(JSON.stringify(packed)))).toEqual(original)
    expect(original.actions[0]!.absoluteRetention!.blockedBy![0]!.detail).toBe(detail)
    expect(() =>
      unpackPublicWarehouseActions({
        agentListsVersion: 2,
        agentLists: [[]],
        retentionTexts: [detail],
        actions: [{ absoluteRetention: { blockedBy: [{ detail: { $t: 2 } }] } }],
      } as never),
    ).toThrow('驱动盘分析证据资料无效')
    const legacy = {
      agentListsVersion: 1,
      agentLists: [['agent-test']],
      actions: [{ compatibleAgentIds: 0 }],
    }
    expect(unpackPublicWarehouseActions(legacy as never).actions[0]!.compatibleAgentIds).toEqual([
      'agent-test',
    ])
  })
})
