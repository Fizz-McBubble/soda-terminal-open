import {
  describe,
  expect,
  it,
  buildTeamLoadoutOverviewModel,
  decisionWithResultLayers,
} from './teamLoadoutOverviewModel.testFixture'
import type {
  AccountPlanningDraft,
  AccountDecisionSnapshot,
  TeamEngineCandidate,
} from './teamLoadoutOverviewModel.testFixture'

describe('team loadout overview result layers', () => {
  it('projects reviewed one-member completion even when the Engine has no rejected kernels', () => {
    const decision = decisionWithResultLayers()
    decision.teamEngine.rejected = []
    const model = buildTeamLoadoutOverviewModel({
      decision,
      savedPlans: [],
      ownedAgentIds: ['agent-pyrois', 'agent-dialyn'],
      availableAgentIds: ['agent-pyrois', 'agent-dialyn'],
    })
    expect(
      model.groups.find((group) => group.kind === 'development')?.completionCandidates,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          memberIds: expect.arrayContaining(['agent-pyrois', 'agent-dialyn', 'agent-astra']),
          missingAgentIds: ['agent-astra'],
        }),
      ]),
    )
  })

  it('does not infer completion facts when the adapter did not provide the current owned roster', () => {
    const decision = decisionWithResultLayers()
    const rejected: TeamEngineCandidate = {
      candidateId: 'kernel-3.1-pyrois-norma-sunna:agent-pyrois+agent-norma+agent-sunna',
      kernelId: 'kernel-3.1-pyrois-norma-sunna',
      familyId: 'family-pyrois-norma-chain-burst',
      label: '佩洛伊斯 · 诺姆 · 千夏',
      memberIds: ['agent-pyrois', 'agent-norma', 'agent-sunna'],
      bangbooId: null,
      bangbooSelection: { status: 'not_evaluated', reason: '核心成员尚未齐全。' },
      scenarioTags: [],
      classification: 'cannot_close',
      strengthTier: 'current_strong_candidate',
      metaBand: 'meta',
      score: 0,
      preferredAgentCount: 0,
      claim: '缺少双人核心成员：agent-norma。',
      failures: [{ code: 'missing_core_agent', detail: '缺少双人核心成员：agent-norma。' }],
      trace: [],
      sourceIds: ['icyveins-norma-team-2026-07-28'],
    }
    ;(decision.teamEngine as { rejected?: TeamEngineCandidate[] }).rejected = [rejected]

    const model = buildTeamLoadoutOverviewModel({ decision, savedPlans: [] })

    expect(
      model.groups.find((group) => group.kind === 'development')?.completionCandidates ?? [],
    ).toEqual([])
  })

  it('uses Account Decision order and categorical authority without exposing raw DPS as the answer', () => {
    const decision = decisionWithResultLayers()
    decision.boxNumericDecision = {
      ranked: [
        { candidateId: 'team-fourth', rank: 1, teamPlanningDps: 999_999 },
        { candidateId: 'team-first', rank: 2, teamPlanningDps: 1 },
      ],
    } as AccountDecisionSnapshot['boxNumericDecision']
    const model = buildTeamLoadoutOverviewModel({ decision, savedPlans: [] })
    const primary = model.groups.find((group) => group.kind === 'recommended')?.items[0]
      ?.variants[0]

    expect(primary).toMatchObject({
      id: 'decision:team-first',
      cultivationPriority: 'ready_now',
      teamRatingBand: 'S',
      confidence: 'high',
      outputPotentialBand: 'excellent',
      authorityReasons: ['权威顺位 1'],
    })
    expect(model.answer.summary).toContain('优先推荐有攻略支持的队伍，选定后搭配装备')
    expect(model.answer.summary).not.toContain('DPS')
  })

  it('keeps Authority order when execution states differ', () => {
    const model = buildTeamLoadoutOverviewModel({
      decision: decisionWithResultLayers(),
      savedPlans: [],
    })
    const recommended = model.groups.find((group) => group.kind === 'recommended')
    expect(recommended?.items).toHaveLength(7)
    expect(recommended?.items.flatMap((family) => family.variants.map((item) => item.id))).toEqual([
      'decision:team-first',
      'decision:team-progress',
      'decision:team-second',
      'decision:team-third',
      'decision:team-fourth',
      'decision:team-fifth',
      'decision:team-direction',
    ])
    expect(recommended?.items.flatMap((family) => family.variants)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'decision:team-progress',
          executionStatus: null,
          stateLabel: '待配装',
        }),
        expect.objectContaining({ id: 'decision:team-direction', kind: 'direction' }),
      ]),
    )
  })

  it('does not demote a higher-ranked Authority direction because its 18-disc fit was not run', () => {
    const decision = decisionWithResultLayers()
    if (decision.decisionAuthority.status !== 'ready') throw new Error('fixture should be ready')
    const source = decision.decisionAuthority.recommendations[0]!
    const strongerUnsolved = {
      ...source,
      candidateId: 'authority-stronger-unsolved',
      memberIds: ['agent-strong-a', 'agent-strong-b', 'agent-strong-c'] as [string, string, string],
      bangbooId: 'bangboo-strong',
    }
    decision.decisionAuthority.consumerRecommendations = [
      strongerUnsolved,
      ...decision.decisionAuthority.recommendations,
    ]

    const model = buildTeamLoadoutOverviewModel({ decision, savedPlans: [] })
    const recommended = model.groups.find((group) => group.kind === 'recommended')!
    const stronger = recommended.items[0]!.variants[0]!

    expect(stronger).toMatchObject({
      id: 'decision:authority-stronger-unsolved',
      kind: 'direction',
      teamRatingBand: 'S',
      cultivationPriority: 'ready_now',
    })
    expect(stronger.gaps).toEqual([])
    expect(stronger.primaryLabel).toBe('搭配装备')
    expect(stronger.gaps).not.toContain('agent-strong-a尚未配齐6张驱动盘。')
    expect(recommended.items[1]!.variants[0]!.id).toBe('decision:team-first')
  })

  it('asks the player to select a Bangboo before generating an unassessed direction', () => {
    const decision = decisionWithResultLayers()
    decision.teamExecutions = []

    const model = buildTeamLoadoutOverviewModel({ decision, savedPlans: [] })
    const direction = model.groups
      .flatMap((group) => group.items)
      .flatMap((family) => family.variants)
      .find((item) => item.id === 'decision:team-direction')

    expect(direction).toMatchObject({
      bangbooId: null,
      executionStatus: null,
      advice: '选择邦布并生成本队配装。',
    })
  })

  it('keeps every initial recommendation reachable without claiming a completed target fit', () => {
    const model = buildTeamLoadoutOverviewModel({
      decision: decisionWithResultLayers(),
      savedPlans: [],
    })
    const recommendedItems = model.groups
      .filter((group) => group.kind === 'recommended')
      .flatMap((group) => group.items.flatMap((family) => family.variants))
    expect(recommendedItems).toHaveLength(7)
    expect(
      recommendedItems.every((item) => item.kind === 'direction' && item.executionStatus === null),
    ).toBe(true)
    expect(recommendedItems.map((item) => item.destination)).toEqual([
      '/loadouts/team/team-first',
      '/loadouts/team/team-progress',
      '/loadouts/team/team-second',
      '/loadouts/team/team-third',
      '/loadouts/team/team-fourth',
      '/loadouts/team/team-fifth',
      '/loadouts/team/team-direction',
    ])
    expect(new Set(recommendedItems.map((item) => item.id)).size).toBe(7)
    expect(recommendedItems.every((item) => item.primaryLabel === '搭配装备')).toBe(true)
    expect(model.initialSelectedId).toBe(
      model.groups.find((group) => group.kind === 'recommended')?.items[0]?.id,
    )
  })

  it('keeps current recommendations ahead of saved history and collapsible directions', () => {
    const decision = decisionWithResultLayers()
    decision.claims.overall.blockers = ['当前角色不是已支持的直接伤害闭环。']
    const savedPlan = {
      id: 'saved-team-plan',
      kind: 'team',
      name: '历史保存队伍',
      selection: {
        agentIds: ['agent-saved-0', 'agent-saved-1', 'agent-saved-2'],
        bangbooId: 'bangboo-saved',
      },
      warehouseRefs: [],
      updatedAt: '2026-08-26T00:00:00.000Z',
    } as unknown as AccountPlanningDraft
    const model = buildTeamLoadoutOverviewModel({
      decision,
      savedPlans: [savedPlan],
      contextPlanId: savedPlan.id,
    })

    expect(model.groups.map((group) => group.kind)).toEqual(['recommended', 'saved'])
    expect(model.groups[0]?.label).toBe('当前推荐')
    expect(model.groups[1]?.label).toBe('已保存方案')
    expect(model.initialSelectedId).toBe(model.groups[0]?.items[0]?.id)
    expect(model.answer.blockers).toEqual([])
  })

  it('rejoins saved history to only the current exact member, Bangboo, and core authority identity', () => {
    const decision = decisionWithResultLayers()
    const current = decision.teamEngine.recommendations[0]!
    const savedRefs = Array.from({ length: 18 }, (_, index) => `saved-disc-${index}`)
    const saved = {
      id: 'saved-exact-identity',
      kind: 'team',
      name: '旧名称不会参与匹配',
      selection: {
        // Member ordering is historical presentation only; the stable member set still matches.
        agentIds: [...current.memberIds].reverse(),
        bangbooId: current.bangbooId,
        scenario: 'old-scenario',
      },
      solutionContext: { sourceCandidateId: 'retired-candidate-id' },
      teamEquipmentParameters: {
        wEngines: [{ agentId: current.memberIds[0], engineId: 'historic-engine', refinement: 1 }],
        bangbooId: current.bangbooId,
        bangbooStars: 6,
        source: 'player_confirmed',
      },
      warehouseRefs: [],
      candidateWarehouse: {
        totalScore: 999_999,
        loadouts: [
          { agentId: current.memberIds[0], discIds: savedRefs.slice(0, 6) },
          { agentId: current.memberIds[1], discIds: savedRefs.slice(6, 12) },
          { agentId: current.memberIds[2], discIds: savedRefs.slice(12, 18) },
        ],
      },
      updatedAt: '2026-09-07T00:00:00.000Z',
    } as unknown as AccountPlanningDraft
    const wrongBangboo = {
      ...saved,
      id: 'saved-other-bangboo',
      selection: { ...saved.selection, bangbooId: 'bangboo-other' },
    } as AccountPlanningDraft
    const unmatchedMembers = {
      ...saved,
      id: 'saved-other-members',
      selection: {
        ...saved.selection,
        agentIds: ['agent-not-current-a', 'agent-not-current-b', 'agent-not-current-c'],
      },
    } as AccountPlanningDraft
    const conflictingReferences = {
      ...saved,
      id: 'saved-conflicting-references',
      warehouseRefs: [...savedRefs.slice(0, 17), 'saved-disc-conflict'],
    } as AccountPlanningDraft

    const model = buildTeamLoadoutOverviewModel({
      decision,
      savedPlans: [saved, wrongBangboo, unmatchedMembers, conflictingReferences],
      availableDiscIds: savedRefs.slice(0, 17),
    })
    const variants = model.groups
      .find((group) => group.kind === 'saved')!
      .items.map((family) => family.variants[0]!)
    const exact = variants.find((item) => item.id === `saved:${saved.id}`)!

    expect(exact).toMatchObject({
      // Synthetic fixture members can prove the saved equipment/Bangboo crosswalk, but they
      // cannot inherit a current exact-three strength judgment.
      teamRatingBand: null,
      confidence: null,
      planningDps: null,
      planningDpsStatus: 'unsupported',
      bangbooAuthority: 'authoritative',
      reason: expect.stringContaining('已保存 18 张不同驱动盘'),
    })
    expect(exact.gaps).toContain(
      '已保存的驱动盘中有 1 张当前不在仓库；原记录已保留，未自动缩减或替换。',
    )
    expect(variants.find((item) => item.id === `saved:${wrongBangboo.id}`)).toMatchObject({
      teamRatingBand: null,
      planningDps: null,
    })
    expect(variants.find((item) => item.id === `saved:${unmatchedMembers.id}`)).toMatchObject({
      teamRatingBand: null,
      planningDps: null,
    })
    const conflicting = variants.find((item) => item.id === `saved:${conflictingReferences.id}`)!
    expect(conflicting.gaps).toEqual(
      expect.arrayContaining([
        '当前保存了 19/18 张不同驱动盘',
        '保存记录中的驱动盘信息不一致；已完整保留，需重新匹配后才能作为当前方案。',
      ]),
    )
    expect(conflicting.readiness).toBe(
      '已保存的驱动盘数量或记录不一致，需要重新匹配。原方案仍保留。',
    )
  })

  it('distinguishes same-named saved plans by their actual members and Bangboo', () => {
    const decision = decisionWithResultLayers()
    const discRefs = (prefix: string) =>
      Array.from({ length: 18 }, (_, index) => `${prefix}-${index}`)
    const savedPlan = (id: string, agentIds: [string, string, string]) =>
      ({
        id,
        kind: 'team',
        name: '已保存 18 引用',
        selection: {
          agentIds,
          bangbooId: 'bangboo-ariel',
          scenario: 'saved-history',
        },
        warehouseRefs: discRefs(id),
        updatedAt: '2026-09-08T00:00:00.000Z',
      }) as unknown as AccountPlanningDraft
    const aria = savedPlan('saved-aria', ['agent-aria', 'agent-remielle', 'agent-velina'])
    const promeia = savedPlan('saved-promeia', ['agent-promeia', 'agent-remielle', 'agent-velina'])

    const model = buildTeamLoadoutOverviewModel({ decision, savedPlans: [aria, promeia] })
    const variants = model.groups
      .find((group) => group.kind === 'saved')!
      .items.map((family) => family.variants[0]!)
    const ariaItem = variants.find((item) => item.id === 'saved:saved-aria')!
    const promeiaItem = variants.find((item) => item.id === 'saved:saved-promeia')!

    expect(ariaItem.title).toBe(promeiaItem.title)
    expect(ariaItem.reason).toContain('爱芮')
    expect(promeiaItem.reason).toContain('普罗米娅')
    expect(ariaItem.reason).toContain('艾瑞儿')
    expect(promeiaItem.reason).toContain('艾瑞儿')
    expect(ariaItem.reason).toContain('已保存 18 张不同驱动盘')
    expect(promeiaItem.reason).toContain('已保存 18 张不同驱动盘')
    expect(ariaItem.reason).not.toBe(promeiaItem.reason)
  })
})

it('keeps a one-agent empty result actionable without unrelated acquisition lists or absent directions', () => {
  const decision = decisionWithResultLayers()
  decision.teamEngine.recommendations = []
  decision.decisionAuthority.recommendations = []
  decision.claims.overall.status = 'unsupported'
  decision.claims.overall.blockers = ['缺少双人核心成员：爱芮、千夏。']
  const model = buildTeamLoadoutOverviewModel({
    decision,
    savedPlans: [],
    ownedAgentIds: ['agent-koleda'],
  })
  expect(model.answer.summary).toContain('不足三名')
  expect(model.answer.summary).not.toContain('下方')
  expect(model.answer.blockers).toEqual([])
})
