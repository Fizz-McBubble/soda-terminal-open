import { describe, expect, it } from 'vitest'
import type { WarehouseActionProjection } from './warehouseActionContract'
import { restoreWarehouseObjects, warehouseObjectCodec } from './publicWarehouseObjectTransport'
import {
  packPublicWarehouseActions,
  unpackPublicWarehouseActions,
} from './publicWarehouseActionTransport'

describe('public warehouse action transport', () => {
  it('keeps distinct JSON object shapes and preserves ordinary string keys through v4', () => {
    const evidence = [
      { a: 1, b: 2 },
      { ['a\u0000b']: 3 },
      JSON.parse('{"__proto__":{"label":"literal evidence field"}}'),
    ]
    const original = {
      actions: Array.from({ length: 25 }, (_, index) => ({
        disc: { id: `disc-${index}` },
        evidence,
      })),
    } as unknown as WarehouseActionProjection
    const wire = JSON.stringify(packPublicWarehouseActions(original))
    expect(unpackPublicWarehouseActions(JSON.parse(wire))).toStrictEqual(original)
  })

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

  it('validates each v3 row against its shape and resolves nested text references', () => {
    const projection = {
      agentListsVersion: 3 as const,
      agentLists: [['agent-test']],
      retentionTexts: ['已核验的配装条件'],
      objectShapes: [['compatibleAgentIds', 'reasons']],
      actions: [{ $o: [0, [0, [{ $t: 0 }]]] }, { $o: [0, [0, [{ $t: 0 }]]] }],
    }
    const restore = (actions: unknown[]) =>
      unpackPublicWarehouseActions({ ...projection, actions } as never).actions
    const decoded = restore(projection.actions)
    expect(decoded.map((item) => item.reasons)).toEqual([
      ['已核验的配装条件'],
      ['已核验的配装条件'],
    ])
    decoded[0]!.reasons.push('只改变第一条')
    expect(decoded[1]!.reasons).toEqual(['已核验的配装条件'])
    expect(() => restore([projection.actions[0], { $o: [0, [0]] }])).toThrow('对象资料无效')
    expect(() => restore([projection.actions[0], { $o: [0, [0, [{ $t: 3 }]]] }])).toThrow(
      '证据资料无效',
    )
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

  it('counts a shared nested shape for every wire occurrence', () => {
    const child = { warehouseConditionSource: null, warehouseConditionSatisfied: false }
    const branch = { child }
    const batch = [child, branch, branch, { nested: [branch, child] }]
    const codec = warehouseObjectCodec(batch)
    const wire = JSON.stringify(codec.encodeAll(batch))
    const copies: unknown[] = JSON.parse(JSON.stringify(batch))
    const copyCodec = warehouseObjectCodec(copies)
    expect(codec.shapes[0]).toEqual(Object.keys(child))
    expect(codec.shapes).toEqual(copyCodec.shapes)
    expect(wire).toBe(JSON.stringify(copyCodec.encodeAll(copies)))
    expect(restoreWarehouseObjects(JSON.parse(wire), codec.shapes)).toEqual(batch)
  })

  it('v4 deduplicates repeated packed sub-objects losslessly with isolated clones and strict validation', () => {
    const repeatedUse = {
      profileId: 'branch-main-dps-4pc',
      agentId: 'agent-miyabi',
      role: 'primary_dps',
      score: 82.5,
      matchedConditions: ['冰套四件', '核心暴击达标', '双暴副词条有效'],
      sourceRefs: ['source:nanoka:3.3', 'source:prydwen:miyabi'],
    }
    const original = {
      actions: Array.from({ length: 40 }, (_, index) => ({
        disc: { id: `disc-${index}`, setId: 'set-branch-blade-song', slot: (index % 6) + 1 },
        compatibleAgentIds: ['agent-miyabi', 'agent-ellen'],
        absoluteRetention: {
          ownedUseAgentIds: ['agent-miyabi'],
          unownedUseAgentIds: [],
          leadingUses: [
            { ...repeatedUse },
            { ...repeatedUse, profileId: 'branch-anomaly-2pc', score: 74.2 },
          ],
          blockedBy: [{ reason: '已被方案引用', refs: ['plan-1', 'plan-2'] }],
        },
      })),
    } as unknown as WarehouseActionProjection
    const packed = packPublicWarehouseActions(original) as Record<string, unknown>
    expect(packed.agentListsVersion).toBe(4)
    expect(Array.isArray(packed.sharedValues)).toBe(true)
    expect((packed.sharedValues as unknown[]).length).toBeGreaterThan(0)
    const wire = JSON.stringify(packed)
    expect(wire.length).toBeLessThan(JSON.stringify(original).length / 4)
    const restored = unpackPublicWarehouseActions(JSON.parse(wire))
    expect(restored).toEqual(original)
    // Verify decoded discs receive independent mutable clones (zero aliasing)
    const uses0 = (
      restored.actions[0]!.absoluteRetention as unknown as { leadingUses: { score: number }[] }
    ).leadingUses
    const uses1 = (
      restored.actions[1]!.absoluteRetention as unknown as { leadingUses: { score: number }[] }
    ).leadingUses
    uses0[0]!.score = 999
    expect(uses1[0]!.score).toBe(82.5)
    // Reject corrupt or forward-referencing $v markers
    expect(() =>
      unpackPublicWarehouseActions({
        agentListsVersion: 4,
        agentLists: [],
        retentionTexts: [],
        objectShapes: [],
        sharedValues: [{ $v: 0 }],
        actions: [],
      } as never),
    ).toThrow('共享值资料无效')
    expect(() =>
      unpackPublicWarehouseActions({
        agentListsVersion: 4,
        agentLists: [],
        retentionTexts: [],
        objectShapes: [],
        sharedValues: [{ ok: true }],
        actions: [{ $v: 5 }],
      } as never),
    ).toThrow('共享值资料无效')
  })
})
