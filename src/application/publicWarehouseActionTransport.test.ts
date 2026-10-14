import { describe, expect, it } from 'vitest'
import type { WarehouseActionProjection } from './warehouseActionContract'
import { restoreWarehouseObjects, warehouseObjectCodec } from './publicWarehouseObjectTransport'
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
    const previous = {
      ...legacy,
      agentListsVersion: 2,
      retentionTexts: ['original condition'],
      actions: [
        {
          compatibleAgentIds: 0,
          absoluteRetention: {
            ownedUseAgentIds: 0,
            unownedUseAgentIds: 0,
            functionDetail: { $t: 0 },
          },
        },
      ],
    }
    expect(
      unpackPublicWarehouseActions(previous as never).actions[0]!.absoluteRetention,
    ).toMatchObject({ functionDetail: 'original condition', ownedUseAgentIds: ['agent-test'] })
  })

  it('shares repeated field names losslessly and rejects corrupt object references', () => {
    const original = Array.from({ length: 24 }, (_, index) => ({
      currentDiscIdentifier: `disc-${index}`,
      currentScore: index / 3,
      evidenceCondition: { reference: '完整条件', absent: null },
      emptyList: [],
      explicitFalse: false,
    }))
    const codec = warehouseObjectCodec(original)
    const packed = codec.encode(original)
    expect(JSON.stringify({ shapes: codec.shapes, packed }).length).toBeLessThan(
      JSON.stringify(original).length,
    )
    expect(restoreWarehouseObjects(JSON.parse(JSON.stringify(packed)), codec.shapes)).toEqual(
      original,
    )
    for (const bad of [
      { $o: [-1, []] },
      { $o: [0, []] },
      { $o: [0, 'invalid'] },
      { $o: [0, []], extra: true },
      { $o: [1.5, []] },
    ])
      expect(() => restoreWarehouseObjects(bad, codec.shapes)).toThrow('对象资料无效')
    expect(() => warehouseObjectCodec([{ $o: 'reserved' }])).toThrow('对象格式无效')
  })
})
