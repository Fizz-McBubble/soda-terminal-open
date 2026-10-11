import { describe, expect, it } from 'vitest'

import {
  current31TeamEngineD1Pack,
  resolveReviewedBelionActivation,
  resolveReviewedBiggestFanActivation,
} from './current31D1Pack'
import { solveTeamEngine } from './solveTeamEngine'
import { effectiveBangbooActivationPredicate, evaluateTeamPredicate } from './teamMethodR1'
import { projectCurrentBangbooComposition } from '../decision/exhaustiveBangbooScoring'
import { resolveCurrentBangbooAdditionalActivation } from '../calculation/currentBangbooMechanicContracts'

function readyInput(memberIds: string[], bangbooId: string) {
  return {
    ownedAgentIds: memberIds,
    ownedBangbooIds: [bangbooId],
    cultivationByAgentId: Object.fromEntries(memberIds.map((id) => [id, 'ready' as const])),
    warehouseReadyAgentIds: memberIds,
  }
}

describe('C4-TE1-D1 extended slices', () => {
  it.each([
    ['agent-claret', 'agent-roxy', 'agent-rina'],
    ['agent-claret', 'agent-billy', 'agent-rina'],
    ['agent-roxy', 'agent-billy', 'agent-rina'],
    ['agent-norma', 'agent-billy', 'agent-rina'],
    ['agent-velina', 'agent-billy', 'agent-rina'],
    ['agent-billy', 'agent-nicole', 'agent-rina'],
  ])('keeps Ultra Jake faction activation consistent for current team %j', (...memberIds) => {
    const rule = current31TeamEngineD1Pack.bangbooRules.find(
      (row) => row.bangbooId === 'bangboo-ultra-jake',
    )!
    if (rule.activation.status !== 'modeled') throw new Error('Ultra Jake activation')
    const agents = memberIds.map(
      (id) => current31TeamEngineD1Pack.agentRules.find((row) => row.agentId === id)!,
    )
    const composition = projectCurrentBangbooComposition(memberIds)!
    const expected = memberIds.some((id) =>
      ['agent-claret', 'agent-roxy', 'agent-norma', 'agent-velina'].includes(id),
    )
    for (const star of [1, 2, 3, 4, 5] as const) {
      expect(
        evaluateTeamPredicate(
          effectiveBangbooActivationPredicate(rule.bangbooId, rule.activation, star),
          { agents, producedTags: new Set(), agentStateById: {} },
        ),
      ).toBe(expected)
      expect(
        resolveCurrentBangbooAdditionalActivation({
          stableId: rule.bangbooId,
          additionalAbilityLevel: star,
          composition,
        }),
      ).toMatchObject({ status: 'supported', active: expected })
    }
  })

  it("adopts Belion's reviewed star-specific Yunkui activation threshold without changing the default star", () => {
    const belion = current31TeamEngineD1Pack.bangbooRules.find(
      (rule) => rule.bangbooId === 'bangboo-belion',
    )
    expect(belion?.activation).toMatchObject({
      status: 'modeled',
      predicate: { kind: 'faction_count', faction: '云岿山', minimum: 2 },
      factionCountMinimumByStar: { 1: 2, 2: 2, 3: 1, 4: 1, 5: 1 },
    })
  })

  it('fails closed to an unknown activation when the reviewed numeric binding changes', () => {
    expect(resolveReviewedBelionActivation(null)).toEqual({
      status: 'unknown',
      description: '狮耶星级激活阈值的已采用数值目录语义绑定失效，待重新审阅。',
      evidence: expect.any(Array),
    })
  })

  it("adopts Biggest Fan's reviewed star-specific Angels of Delusion activation threshold", () => {
    const biggestFan = current31TeamEngineD1Pack.bangbooRules.find(
      (rule) => rule.bangbooId === 'bangboo-biggest-fan',
    )
    expect(biggestFan?.activation).toMatchObject({
      status: 'modeled',
      predicate: { kind: 'faction_count', faction: '妄想天使', minimum: 2 },
      factionCountMinimumByStar: { 1: 2, 2: 2, 3: 1, 4: 1, 5: 1 },
    })
    expect(resolveReviewedBiggestFanActivation(null)).toEqual({
      status: 'unknown',
      description: '阿饭星级激活阈值的已采用数值目录语义绑定失效，待重新审阅。',
      evidence: expect.any(Array),
    })
  })

  it('keeps Biggest Fan blocked at S1–S2 and activates it at S3–S5 for Miyabi-Nangong-Yuzuha', () => {
    const activation = resolveReviewedBiggestFanActivation()
    if (activation.status !== 'modeled') throw new Error('Expected reviewed Biggest Fan activation')
    const agents = ['agent-miyabi', 'agent-nangong', 'agent-yuzuha'].map((agentId) => {
      const agent = current31TeamEngineD1Pack.agentRules.find((item) => item.agentId === agentId)
      if (!agent) throw new Error(`Missing fixture agent: ${agentId}`)
      return agent
    })
    const context = {
      agents,
      producedTags: new Set(agents.flatMap((agent) => agent.produces)),
      agentStateById: {},
    }

    for (const star of [1, 2, 3, 4, 5] as const) {
      expect(
        evaluateTeamPredicate(
          effectiveBangbooActivationPredicate('bangboo-biggest-fan', activation, star),
          context,
        ),
      ).toBe(star >= 3)
    }
  })

  it('keeps the Yixuan-Dialyn-Lucia Belion variant blocked at S1 and closes it at the reviewed S3 threshold', () => {
    const memberIds = ['agent-yixuan', 'agent-lucia', 'agent-dialyn']
    const atDefaultStar = solveTeamEngine(
      current31TeamEngineD1Pack,
      readyInput(memberIds, 'bangboo-belion'),
    ).recommendations.find((candidate) => candidate.kernelId === 'kernel-3.1-yixuan-lucia-dialyn')
    const atReviewedMinimum = solveTeamEngine(current31TeamEngineD1Pack, {
      ...readyInput(memberIds, 'bangboo-belion'),
      bangbooStarsById: { 'bangboo-belion': 3 },
    }).recommendations.find((candidate) => candidate.kernelId === 'kernel-3.1-yixuan-lucia-dialyn')

    expect(atDefaultStar).toMatchObject({
      bangbooId: null,
      bangbooStar: null,
      bangbooSelection: { status: 'no_activation_match', bangbooIds: ['bangboo-belion'] },
    })
    expect(atReviewedMinimum).toMatchObject({
      bangbooId: 'bangboo-belion',
      bangbooStar: 3,
      bangbooSelection: {
        status: 'compatible_fallback',
        bangbooId: 'bangboo-belion',
        bangbooStar: 3,
      },
    })
  })

  it('为 13 个 production kernel 提供唯一的 2 apex / 7 meta / 4 viable 映射', () => {
    const definitions = current31TeamEngineD1Pack.currentMetaStrength.kernelBands
    expect(current31TeamEngineD1Pack.currentMetaStrength.contract).toBe(
      'soda-current-meta-strength/r1',
    )
    expect(definitions).toHaveLength(13)
    expect(definitions.filter(({ band }) => band === 'apex')).toHaveLength(2)
    expect(definitions.filter(({ band }) => band === 'meta')).toHaveLength(7)
    expect(definitions.filter(({ band }) => band === 'viable')).toHaveLength(4)
    expect(current31TeamEngineD1Pack.currentMetaStrength.partialOrder).toEqual([
      expect.objectContaining({
        higherKernelId: 'kernel-3.1-yixuan-lucia-dialyn',
        lowerKernelId: 'kernel-3.1-yixuan-pan-astra',
      }),
    ])
  })

  it('消费完整机制闭环后的 current_limited discovery，扩展到原五个 kernel 之外', () => {
    expect(current31TeamEngineD1Pack.kernels).toHaveLength(13)
    expect(new Set(current31TeamEngineD1Pack.kernels.map((kernel) => kernel.familyId)).size).toBe(
      10,
    )
    const result = solveTeamEngine(
      current31TeamEngineD1Pack,
      readyInput(['agent-yixuan', 'agent-lucia', 'agent-dialyn'], 'bangboo-knightboo'),
    )
    expect(result.recommendations).toContainEqual(
      expect.objectContaining({
        kernelId: 'kernel-3.1-yixuan-lucia-dialyn',
        strengthTier: 'current_strong_candidate',
        classification: 'strong_recommendation',
        sourceIds: expect.arrayContaining([
          'prydwen-yixuan-3.1-2026-08-24',
          'prydwen-lucia-page-candidate',
          'prydwen-dialyn-2.4',
          'source-user-confirmed-gpt-r2-team-matrix-r92',
        ]),
      }),
    )
    expect(
      current31TeamEngineD1Pack.kernels.find(
        (kernel) => kernel.kernelId === 'kernel-3.1-yixuan-lucia-dialyn',
      )?.strengthEvidence.claim,
    ).toContain('不来自 synthesis seed')
  })

  it.each([
    {
      kernelId: 'kernel-3.1-billy-nicole-anby',
      members: ['agent-billy', 'agent-nicole', 'agent-anby'],
      bangbooId: 'bangboo-amillion',
      familyId: 'family-billy-cunning-hares-direct',
    },
    {
      kernelId: 'kernel-3.1-ellen-lycaon-soukaku',
      members: ['agent-ellen', 'agent-lycaon', 'agent-soukaku'],
      bangbooId: 'bangboo-sharkboo',
      familyId: 'family-ellen-ice-stun',
    },
    {
      kernelId: 'kernel-3.1-jane-burnice-lucy',
      members: ['agent-jane', 'agent-burnice', 'agent-lucy'],
      bangbooId: 'bangboo-red-moccus',
      familyId: 'family-jane-disorder',
    },
  ])(
    '将既有语料补成 Team Method 可执行 viable family: $kernelId',
    ({ kernelId, members, bangbooId, familyId }) => {
      const result = solveTeamEngine(current31TeamEngineD1Pack, readyInput(members, bangbooId))
      expect(result.recommendations).toContainEqual(
        expect.objectContaining({
          kernelId,
          familyId,
          memberIds: members,
          bangbooId,
          bangbooStar: 1,
          bangbooSelection: { status: 'selected', bangbooId, bangbooStar: 1 },
          metaBand: 'viable',
          classification: 'stable_usable',
        }),
      )
    },
  )

  it('全资产无收藏按 Meta band，而不是 candidateId 决定前三名', () => {
    const memberIds = current31TeamEngineD1Pack.agentRules.map((rule) => rule.agentId)
    const base = {
      ...readyInput(memberIds, 'bangboo-ariel'),
      ownedBangbooIds: current31TeamEngineD1Pack.bangbooRules.map((rule) => rule.bangbooId),
    }
    const strengthFirst = solveTeamEngine(current31TeamEngineD1Pack, base)

    expect(strengthFirst.recommendations.slice(0, 2).map((team) => team.metaBand)).toEqual([
      'apex',
      'apex',
    ])
    expect(new Set(strengthFirst.recommendations.slice(0, 2).map((team) => team.kernelId))).toEqual(
      new Set(['kernel-3.1-remielle-velina-aria', 'kernel-3.1-ye-dialyn-zhao']),
    )
    expect(strengthFirst.recommendations[2].metaBand).toBe('meta')
    expect(strengthFirst.recommendations.at(-1)?.metaBand).toBe('viable')
    expect(strengthFirst.recommendations.slice(0, 3).map((team) => team.kernelId)).not.toEqual([
      'kernel-3.1-aria-sunna-yuzuha',
      'kernel-3.1-promeia-nangong-yuzuha',
      'kernel-3.1-pyrois-norma-sunna',
    ])
  })

  it('同 band 无比较关系时培养优先可以 soft reorder，但不能越过 apex', () => {
    const memberIds = current31TeamEngineD1Pack.agentRules.map((rule) => rule.agentId)
    const result = solveTeamEngine(current31TeamEngineD1Pack, {
      ...readyInput(memberIds, 'bangboo-ariel'),
      ownedBangbooIds: current31TeamEngineD1Pack.bangbooRules.map((rule) => rule.bangbooId),
      preferredAgentIds: ['agent-promeia', 'agent-nangong', 'agent-yuzuha'],
    })

    expect(result.recommendations.slice(0, 2).every((team) => team.metaBand === 'apex')).toBe(true)
    expect(result.recommendations[2]).toMatchObject({
      kernelId: 'kernel-3.1-promeia-nangong-yuzuha',
      metaBand: 'meta',
      preferredAgentCount: 3,
    })
  })

  it('两个 apex 没有伪造先后关系，培养优先可以在 apex 内 soft reorder', () => {
    const memberIds = current31TeamEngineD1Pack.agentRules.map((rule) => rule.agentId)
    const base = {
      ...readyInput(memberIds, 'bangboo-ariel'),
      ownedBangbooIds: current31TeamEngineD1Pack.bangbooRules.map((rule) => rule.bangbooId),
    }
    const preferYe = solveTeamEngine(current31TeamEngineD1Pack, {
      ...base,
      preferredAgentIds: ['agent-ye-shunguang', 'agent-zhao'],
    })
    const preferRemielle = solveTeamEngine(current31TeamEngineD1Pack, {
      ...base,
      preferredAgentIds: ['agent-remielle', 'agent-velina', 'agent-aria'],
    })

    expect(preferYe.recommendations[0].kernelId).toBe('kernel-3.1-ye-dialyn-zhao')
    expect(preferRemielle.recommendations[0].kernelId).toBe('kernel-3.1-remielle-velina-aria')
  })

  it('evidence-backed partial order 优先于同 band 培养偏好', () => {
    const memberIds = [
      'agent-yixuan',
      'agent-lucia',
      'agent-dialyn',
      'agent-pan-yinhu',
      'agent-astra',
    ]
    const result = solveTeamEngine(current31TeamEngineD1Pack, {
      ...readyInput(memberIds, 'bangboo-belion'),
      ownedBangbooIds: ['bangboo-belion', 'bangboo-knightboo'],
      preferredAgentIds: ['agent-pan-yinhu', 'agent-astra'],
    })

    expect(result.recommendations.map((team) => team.kernelId)).toEqual([
      'kernel-3.1-yixuan-lucia-dialyn',
      'kernel-3.1-yixuan-pan-astra',
    ])
    expect(result.recommendations[0].sourceIds).toContain(
      'prydwen-yixuan-current-team-comparative-2026-08-26',
    )
  })

  it('较低 Meta band 即使包含更多培养优先角色也不能越级', () => {
    const memberIds = [
      'agent-yixuan',
      'agent-pan-yinhu',
      'agent-astra',
      'agent-zhu-yuan',
      'agent-qingyi',
    ]
    const result = solveTeamEngine(current31TeamEngineD1Pack, {
      ...readyInput(memberIds, 'bangboo-belion'),
      ownedBangbooIds: ['bangboo-belion', 'bangboo-resonaboo'],
      preferredAgentIds: ['agent-zhu-yuan', 'agent-qingyi', 'agent-astra'],
    })

    expect(result.recommendations[0].metaBand).toBe('meta')
    expect(result.recommendations[1]).toMatchObject({
      metaBand: 'viable',
      preferredAgentCount: 3,
    })
  })

  it.each([
    {
      kernelId: 'kernel-3.1-ye-dialyn-zhao',
      members: ['agent-ye-shunguang', 'agent-dialyn', 'agent-zhao'],
      bangbooId: 'bangboo-sprout',
      sourceId: 'game8-sprout-ye-team-2026-08-26',
    },
    {
      kernelId: 'kernel-3.1-aria-sunna-yuzuha',
      members: ['agent-aria', 'agent-sunna', 'agent-yuzuha'],
      bangbooId: 'bangboo-biggest-fan',
      sourceId: 'gamevika-biggest-fan-predicate-2026-08-26',
    },
    {
      kernelId: 'kernel-3.1-promeia-nangong-yuzuha',
      members: ['agent-promeia', 'agent-nangong', 'agent-yuzuha'],
      bangbooId: 'bangboo-knightboo',
      sourceId: 'zzz-wiki-knightboo-support-predicate-2026-08-26',
    },
    {
      kernelId: 'kernel-3.1-pyrois-norma-sunna',
      members: ['agent-pyrois', 'agent-norma', 'agent-sunna'],
      bangbooId: 'bangboo-ultra-jake',
      sourceId: 'icyveins-norma-team-2026-07-28',
    },
  ])(
    '将冻结 family 的单一代表 kernel 映射进 production: $kernelId',
    ({ kernelId, members, bangbooId, sourceId }) => {
      const result = solveTeamEngine(current31TeamEngineD1Pack, readyInput(members, bangbooId))
      expect(result.recommendations).toContainEqual(
        expect.objectContaining({
          kernelId,
          memberIds: members,
          bangbooId,
          strengthTier: 'current_strong_candidate',
          score: 0,
          sourceIds: expect.arrayContaining([sourceId]),
        }),
      )
      expect(
        current31TeamEngineD1Pack.kernels.filter((kernel) => kernel.kernelId === kernelId),
      ).toHaveLength(1)
    },
  )

  it('numeric score 不再改变跨 Meta band 排序', () => {
    const remielle = current31TeamEngineD1Pack.kernels.find(
      (kernel) => kernel.kernelId === 'kernel-3.1-remielle-velina-aria',
    )!
    const yixuan = current31TeamEngineD1Pack.kernels.find(
      (kernel) => kernel.kernelId === 'kernel-3.1-yixuan-lucia-dialyn',
    )!
    const result = solveTeamEngine(
      {
        ...current31TeamEngineD1Pack,
        kernels: [
          { ...remielle, strengthEvidence: { ...remielle.strengthEvidence, score: -999 } },
          { ...yixuan, strengthEvidence: { ...yixuan.strengthEvidence, score: 999 } },
        ],
        currentMetaStrength: {
          contract: 'soda-current-meta-strength/r1',
          kernelBands: current31TeamEngineD1Pack.currentMetaStrength.kernelBands.filter(
            ({ kernelId }) => kernelId === remielle.kernelId || kernelId === yixuan.kernelId,
          ),
          partialOrder: [],
        },
      },
      {
        ...readyInput(
          [
            'agent-remielle',
            'agent-velina',
            'agent-aria',
            'agent-yixuan',
            'agent-lucia',
            'agent-dialyn',
          ],
          'bangboo-ariel',
        ),
        ownedBangbooIds: ['bangboo-ariel', 'bangboo-knightboo'],
      },
    )
    expect(result.recommendations.map((candidate) => candidate.kernelId)).toEqual([
      'kernel-3.1-remielle-velina-aria',
      'kernel-3.1-yixuan-lucia-dialyn',
    ])
  })

  it('仪玄、潘引壶与耀嘉音保留强势队伍方向，但不虚构狮耶适配权威', () => {
    const result = solveTeamEngine(
      current31TeamEngineD1Pack,
      readyInput(['agent-yixuan', 'agent-pan-yinhu', 'agent-astra'], 'bangboo-belion'),
    )
    expect(result.recommendations).toContainEqual(
      expect.objectContaining({
        kernelId: 'kernel-3.1-yixuan-pan-astra',
        classification: 'strong_recommendation',
        familyId: 'family-yixuan-rupture',
        bangbooId: 'bangboo-belion',
        bangbooStar: 1,
        bangbooSelection: {
          status: 'compatible_fallback',
          bangbooId: 'bangboo-belion',
          bangbooStar: 1,
          bangbooIds: ['bangboo-belion'],
        },
      }),
    )
  })

  it('朱鸢、青衣与耀嘉音机制闭环但共鸣布适配资料不足', () => {
    const result = solveTeamEngine(
      current31TeamEngineD1Pack,
      readyInput(['agent-zhu-yuan', 'agent-qingyi', 'agent-astra'], 'bangboo-resonaboo'),
    )
    expect(result.recommendations).toContainEqual(
      expect.objectContaining({
        kernelId: 'kernel-3.1-zhu-yuan-qingyi-astra',
        classification: 'stable_usable',
        familyId: 'family-zhu-yuan-stun-shells',
        bangbooId: 'bangboo-resonaboo',
        bangbooStar: 1,
        bangbooSelection: {
          status: 'compatible_fallback',
          bangbooId: 'bangboo-resonaboo',
          bangbooStar: 1,
          bangbooIds: ['bangboo-resonaboo'],
        },
      }),
    )
  })

  it('没有符合条件的邦布时保留队伍方向与类型化缺口', () => {
    const result = solveTeamEngine(
      current31TeamEngineD1Pack,
      readyInput(['agent-yixuan', 'agent-pan-yinhu', 'agent-astra'], 'bangboo-ariel'),
    )
    const candidate = result.recommendations.find(
      (item) => item.kernelId === 'kernel-3.1-yixuan-pan-astra',
    )
    expect(candidate).toMatchObject({
      bangbooId: null,
      bangbooStar: null,
      bangbooSelection: {
        status: 'no_activation_match',
        bangbooIds: ['bangboo-ariel'],
      },
    })
  })

  it('扩展包的角色与核心 ID 唯一', () => {
    expect(new Set(current31TeamEngineD1Pack.agentRules.map((rule) => rule.agentId)).size).toBe(
      current31TeamEngineD1Pack.agentRules.length,
    )
    expect(new Set(current31TeamEngineD1Pack.kernels.map((kernel) => kernel.kernelId)).size).toBe(
      current31TeamEngineD1Pack.kernels.length,
    )
  })
})
