import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { evidence, retentionUse } from './WarehouseRetentionEvidence.testFixture'
import { WarehouseRetentionEvidence } from './WarehouseRetentionEvidence'
import { absoluteDiscRetentionCatalog } from '../warehouse/absoluteDiscRetentionCatalog'
import { warehouseTestDisc } from '../warehouse/discWarehouseAnalysis.testFixtures'
import { reviewedWarehouseCondition } from './warehouseReviewedConditions'
import { RetentionScoreDetails } from './WarehouseRetentionDetails'
import { registerWarehouseRetentionEvidenceCases } from './WarehouseRetentionEvidence.testCases'

async function openAgent(name?: RegExp) {
  const trigger = name
    ? screen.getByRole('button', { name })
    : screen.getAllByRole('button', { name: /查看.*词条匹配/ })[0]!
  await userEvent.click(trigger)
  return screen.getByRole('dialog', { name: name ?? /词条匹配/ })
}

describe('absolute retention evidence', () => {
  it('shows the saved finite Luminize use without presenting a complete team-damage claim', () => {
    const source = evidence({
      reasonKind: 'quality_borderline',
      nextAction: {
        basis: 'finite_luminize_static_preparation_positive_use',
        kind: 'keep',
        targetLevel: null,
        detail: '在已保存的辉映比较条件下，同槽替换可提高该项收益，作为备选盘保留。',
        stopWhen: '此用途只适用于对应配装与条件，不改变盘面品质，也不作为其他盘的清理依据。',
      },
    })
    render(
      <WarehouseRetentionEvidence ownedAgentIds={new Set()} evidence={source} discLevel={15} />,
    )
    expect(screen.getByText('下一步：保留')).toBeVisible()
    expect(screen.getByText('当前方案中可提升辉映收益，留作备选。')).toBeVisible()
    expect(screen.queryByText(source.nextAction!.detail)).not.toBeInTheDocument()
    expect(screen.queryByText(source.nextAction!.stopWhen)).not.toBeInTheDocument()
  })

  it.each(['quality_keep', 'quality_borderline', 'no_supported_use'] as const)(
    'shows the complete-build retention basis independently of absolute quality (%s)',
    (reasonKind) => {
      const source = evidence({
        reasonKind,
        nextAction: {
          basis: 'complete_build_positive_use',
          kind: 'keep',
          targetLevel: null,
          detail: '已核对完整配装的同槽替换收益，作为该方案的备选盘保留。',
          stopWhen: '此用途只适用于对应配装与条件，不改变盘面品质，也不作为其他盘的清理依据。',
        },
      })
      const before = structuredClone(source)
      render(
        <WarehouseRetentionEvidence ownedAgentIds={new Set()} evidence={source} discLevel={15} />,
      )
      expect(screen.getByText('下一步：保留')).toBeVisible()
      expect(screen.getByText('同槽替换能提升当前配装，留作备选。')).toBeVisible()
      expect(screen.queryByText(source.nextAction!.stopWhen)).not.toBeInTheDocument()
      expect(source).toEqual(before)
    },
  )
  it('uses actual ownership even when an owned reference has no qualifying retention use', () => {
    const source = evidence({
      ownedUseAgentIds: [],
      unownedUseAgentIds: [],
      leadingUses: [
        { ...retentionUse('reserve', 25, 20), agentId: 'agent-lycaon' },
        { ...retentionUse('owned-low-value', 15, 10), agentId: 'agent-nicole' },
      ],
    })
    const before = structuredClone(source)
    render(
      <WarehouseRetentionEvidence
        ownedAgentIds={new Set(['agent-nicole'])}
        evidence={source}
        discLevel={15}
      />,
    )
    const rows = within(screen.getByRole('list', { name: '适用角色' })).getAllByRole('listitem')
    expect(rows[0]).toHaveTextContent('妮可')
    expect(rows[0]).toHaveTextContent('已拥有')
    expect(within(rows[0]!).queryByTitle('未拥有，可作储备用途')).not.toBeInTheDocument()
    expect(rows[1]).toHaveTextContent('莱卡恩')
    expect(rows[1]).toHaveTextContent('未拥有')
    expect(screen.getByRole('heading', { name: '适用角色' })).toBeVisible()
    expect(source).toEqual(before)
  })

  it('groups multiple branches under one role without merging distinct set conditions', async () => {
    const first = {
      ...retentionUse('agent-anby:base-0', 80, 62),
      fourPieceFit: 'valid' as const,
      branchSetPlan: {
        pattern: '4+2' as const,
        primarySetIds: ['set-a'],
        secondarySetIds: ['set-b'],
      },
      guidance: {
        ...retentionUse('agent-anby:base-0', 80, 62).guidance!,
        branchSetPlan: {
          pattern: '4+2' as const,
          primarySets: [{ id: 'set-a', name: '套装甲' }],
          secondarySets: [{ id: 'set-b', name: '套装乙' }],
          conditionDetails: [],
        },
      },
    }
    const second = {
      ...retentionUse('agent-anby:condition-team', 78, 60),
      useState: 'conditional' as const,
      fourPieceFit: 'valid' as const,
      branchSetPlan: {
        pattern: '4+2' as const,
        primarySetIds: ['set-a'],
        secondarySetIds: ['set-b'],
      },
      guidance: {
        ...retentionUse('agent-anby:condition-team', 78, 60).guidance!,
        branchSetPlan: {
          pattern: '4+2' as const,
          primarySets: [{ id: 'set-a', name: '套装甲' }],
          secondarySets: [{ id: 'set-b', name: '套装乙' }],
          conditionDetails: ['需要队伍持续触发异常。'],
        },
      },
    }
    render(
      <WarehouseRetentionEvidence
        ownedAgentIds={new Set(['agent-nicole'])}
        disc={warehouseTestDisc('synthetic-main-set', { setId: 'set-a', slot: 3 })}
        discLevel={0}
        evidence={evidence({
          witnessProfileIds: [first.profileId],
          leadingUses: [
            first,
            second,
            {
              ...retentionUse('agent-nicole:base-0', 70, 55),
              agentId: 'agent-nicole',
              fourPieceFit: 'valid' as const,
              branchSetPlan: {
                pattern: '4+2' as const,
                primarySetIds: ['set-a'],
                secondarySetIds: ['set-b'],
              },
              guidance: {
                ...retentionUse('agent-nicole:base-0', 70, 55).guidance!,
                currentSet: { id: 'set-a', name: '套装甲' },
                branchSetPlan: {
                  pattern: '4+2' as const,
                  primarySets: [{ id: 'set-a', name: '套装甲' }],
                  secondarySets: [{ id: 'set-b', name: '套装乙' }],
                  conditionDetails: [],
                },
              },
            },
          ],
        })}
      />,
    )
    const roles = screen.getByRole('list', { name: '适用角色' })
    expect(within(roles).getAllByRole('listitem')).toHaveLength(2)
    expect(within(roles).getAllByRole('button', { name: /安比/ })).toHaveLength(1)
    expect(within(roles).getByRole('button', { name: /妮可/ })).toHaveTextContent('已拥有')
    await userEvent.click(within(roles).getByRole('button', { name: /安比/ }))
    const dialog = screen.getByRole('dialog', { name: /安比/ })
    await userEvent.selectOptions(within(dialog).getByLabelText('推荐用途'), second.profileId)
    expect(
      within(within(dialog).getByRole('group', { name: '词条匹配' })).getByText('60.0 分'),
    ).toBeVisible()
    expect(within(dialog).getByText(/套装甲/)).toBeVisible()
    expect(within(dialog).getByText(/套装乙/)).toBeVisible()
    expect(within(dialog).getByText('需要队伍持续触发异常。')).toBeVisible()
  })

  it('explains when no recommended role is confirmed', () => {
    render(
      <WarehouseRetentionEvidence
        ownedAgentIds={new Set()}
        discLevel={0}
        evidence={evidence({ leadingUses: [] })}
      />,
    )
    expect(screen.getByRole('heading', { name: '适用角色' })).toBeVisible()
    expect(screen.getByText('暂无适用角色')).toBeVisible()
    expect(screen.queryByRole('list', { name: '适用角色' })).not.toBeInTheDocument()
  })

  it.each([false, true])(
    'only calls an empty substat direction functional when functionalMain=%s',
    async (functionalMain) => {
      const row = retentionUse('empty-direction', 25, 20)
      render(
        <WarehouseRetentionEvidence
          ownedAgentIds={new Set()}
          discLevel={15}
          evidence={evidence({
            leadingUses: [{ ...row, functionalMain, guidance: { ...row.guidance!, subStats: [] } }],
          })}
        />,
      )
      await openAgent()
      const requirements = screen.getByText('词条要求').nextElementSibling!
      expect(requirements).toHaveTextContent('防御力。')
      expect(requirements.querySelectorAll('p')).toHaveLength(functionalMain ? 2 : 1)
      if (functionalMain) expect(requirements).toHaveTextContent('以主词条功能为主。')
      else expect(requirements).not.toHaveTextContent(/以主词条功能为主|暴击率|暴击伤害/)
    },
  )

  it('translates collection locators and merges equal visible conditions without changing evidence', async () => {
    const blocker = {
      kind: 'conditional_use' as const,
      field: 'mainStats.4.crit_rate',
      profileId: 'agent-dialyn:base-0',
      agentId: 'agent-dialyn',
      predicateId: 'first-branch',
      detail: '整套配装需达到50%暴击率。',
      sourceIds: ['synthetic-source'],
    }
    const source = evidence({
      leadingUses: [{ ...retentionUse('agent-dialyn:base-0', 70), agentId: 'agent-dialyn' }],
      blockedBy: [
        blocker,
        { ...blocker, predicateId: 'another-branch' },
        { ...blocker, predicateId: 'different-threshold', detail: '整套配装需达到60%暴击率。' },
        {
          ...blocker,
          detail:
            '73045858-1.png：激发潜能ON；驱动盘推荐分区6冲击力/能量恢复；下方莱卡恩+苍角+雅、莱卡恩+雨果+莱特。',
        },
        {
          ...blocker,
          predicateId: 'other-image',
          detail:
            '009-build.jpg：潜能4/6；驱动盘推荐分区6冲击力；下方琉音+莱卡恩+雅；整套暴击率需50%。',
        },
      ],
    })
    const before = structuredClone(source)
    render(
      <WarehouseRetentionEvidence
        ownedAgentIds={new Set(['agent-anby'])}
        evidence={source}
        discLevel={2}
      />,
    )
    await openAgent()
    await userEvent.click(screen.getByText('查看本用途条件'))
    const conditions = screen.getByRole('group', { name: '具体使用条件' })
    expect(within(conditions).getAllByRole('listitem')).toHaveLength(4)
    expect(within(conditions).getAllByText(/整套配装需达到50%暴击率。/)).toHaveLength(1)
    expect(conditions).toHaveTextContent('整套配装需达到60%暴击率。')
    expect(conditions).toHaveTextContent('需核对莱卡恩激发潜能是否达到6/6')
    expect(conditions).toHaveTextContent('用途是否适用于莱卡恩+苍角+雅或莱卡恩+雨果+莱特队伍')
    expect(conditions).toHaveTextContent(
      '6号位冲击力或能量自动回复仅作候选方向，需结合整套配装确认',
    )
    expect(conditions).toHaveTextContent('潜能4/6')
    expect(conditions).toHaveTextContent('适用队伍：琉音+莱卡恩+雅；整套暴击率需50%')
    expect(conditions.textContent).not.toMatch(
      /\.png|\.jpg|73045858|009-build|推荐分区|下方|潜能ON/,
    )
    expect(source).toEqual(before)
  })

  it.each([
    [
      'agent-miyabi:reviewed-miyoushe-77017654-miyabi-remielle-anomaly',
      '星见雅',
      '0至1影',
      '6号位异常掌控',
      '副词条可选暴击率、暴击伤害',
    ],
    [
      'agent-yanagi:reviewed-miyoushe-77017654-yanagi-remielle-velina-disorder',
      '柳',
      '维琳娜',
      '5号位穿透率或电属性伤害',
      '6号位异常掌控或能量自动回复',
    ],
  ])(
    'projects reviewed conditions for %s without exposing collection coordinates',
    async (profileId, role, condition, main, extra) => {
      const profile = absoluteDiscRetentionCatalog.profiles.find((entry) => entry.id === profileId)!
      const detail = profile.conditionEvidence![0]!.detail
      expect(detail).toContain('spanSha256')
      const sample = retentionUse(profile.id, 60)
      const currentSetId = `synthetic-current-set:${profile.agentId}`
      const branchSetPlan = {
        pattern: '4+2' as const,
        primarySetIds: [currentSetId, `${currentSetId}:alternative`],
        secondarySetIds: [`${currentSetId}:secondary`],
      }
      const source = evidence({
        leadingUses: [
          {
            ...sample,
            agentId: profile.agentId,
            fourPieceFit: 'valid' as const,
            branchSetPlan,
            guidance: {
              ...sample.guidance!,
              branchSetPlan: {
                pattern: branchSetPlan.pattern,
                primarySets: [
                  { id: currentSetId, name: '自由蓝调' },
                  { id: `${currentSetId}:alternative`, name: '自由蓝调替代套装' },
                ],
                secondarySets: [{ id: `${currentSetId}:secondary`, name: '法厄同之歌' }],
                conditionDetails: [detail],
              },
            },
          },
        ],
        blockedBy: [
          {
            kind: 'conditional_use',
            field: 'conditionEvidence',
            profileId,
            agentId: profile.agentId,
            predicateId: 'test',
            detail,
            sourceIds: ['synthetic-source'],
          },
        ],
      })
      const before = structuredClone(source)
      const { container } = render(
        <WarehouseRetentionEvidence
          evidence={source}
          disc={warehouseTestDisc(`reviewed-${profile.agentId}`, {
            setId: currentSetId,
            slot: 3,
          })}
          discLevel={15}
          ownedAgentIds={new Set()}
        />,
      )
      await openAgent(new RegExp(role))
      await userEvent.click(screen.getByText('查看本用途条件'))
      const projected = screen.getByRole('group', { name: '具体使用条件' })
      expect(projected).toHaveTextContent(role)
      expect(projected).toHaveTextContent(condition)
      expect(projected).toHaveTextContent(main)
      expect(projected).toHaveTextContent(extra)
      expect(projected).toHaveTextContent('自由蓝调四件、法厄同之歌两件')
      const selectedConditions = screen.getByText('使用条件').parentElement!
      expect(selectedConditions).toHaveTextContent(main)
      expect(selectedConditions).toHaveTextContent(extra)
      expect(container.textContent).not.toMatch(
        /77017654|UTF.?16|spanSha256|text:016|BD78B6|016[789]|0170/i,
      )
      expect(source).toEqual(before)
    },
  )

  it('keeps the reviewed branch boundaries and rejects mismatched evidence', () => {
    const profile = absoluteDiscRetentionCatalog.profiles.find((entry) =>
      entry.id.endsWith('miyabi-remielle-anomaly-m2plus'),
    )!
    const detail = profile.conditionEvidence![0]!.detail
    expect(reviewedWarehouseCondition(profile.id, detail)).toContain('2影及以上')
    expect(reviewedWarehouseCondition(profile.id, detail)).toContain('原套装方向仍可保留')
    expect(reviewedWarehouseCondition(profile.id, `${detail} changed`)).toBeNull()
    expect(reviewedWarehouseCondition('agent-other:reviewed-unknown', detail)).toBeNull()
    const experimental = absoluteDiscRetentionCatalog.profiles.find((entry) =>
      entry.id.endsWith('miyabi-remielle-yanagi-experimental'),
    )!
    expect(
      reviewedWarehouseCondition(experimental.id, experimental.conditionEvidence![0]!.detail),
    ).toContain('需主动选择的实验方向，高配条件尚未明确')
  })

  it('shows specific alternative conditions and omits internal or unresolved facts', async () => {
    const base = {
      kind: 'conditional_use' as const,
      field: 'mainStats.1.hp_flat',
      profileId: 'agent-soukaku:main-alt-0',
      agentId: 'agent-soukaku',
      predicateId: 'test',
      sourceIds: ['synthetic'],
    }
    const source = evidence({
      leadingUses: [
        {
          ...retentionUse('agent-soukaku:main-alt-0', 70),
          agentId: 'agent-soukaku',
          blockers: [
            { ...base, detail: '来源编号 123456 hash=abcdef1234567890；HP scaling unresolved' },
            {
              ...base,
              predicateId: 'missing',
              kind: 'missing_fact',
              detail: '该用途资料尚未确认。',
            },
            { ...base, predicateId: 'team', detail: '需要队友装备静听嘉音四件套。' },
          ],
        },
      ],
    })
    const before = structuredClone(source)
    render(
      <WarehouseRetentionEvidence evidence={source} discLevel={15} ownedAgentIds={new Set()} />,
    )
    await openAgent()
    await userEvent.click(screen.getByText('查看本用途条件'))
    const conditions = screen.getByRole('group', { name: '具体使用条件' })
    expect(conditions).toHaveTextContent('需要队友装备静听嘉音四件套')
    expect(conditions).not.toHaveTextContent('1 号位')
    expect(conditions).not.toHaveTextContent('hash')
    expect(within(conditions).getAllByRole('listitem')).toHaveLength(1)
    expect(source).toEqual(before)
  })

  it('keeps A/B guidance simple without fabricated scores or uncalibrated warnings', () => {
    const source = evidence({
      disposition: 'cleanup_candidate',
      reasonKind: 'approved_rarity_cleanup',
      reviewedUseScope: 'approved-ab-cleanup-20260930',
      nextAction: {
        kind: 'manual_cleanup',
        targetLevel: null,
        detail: 'A/B 级盘直接列为清理候选。',
        stopWhen: '受保护时保留。',
      },
    })
    const { rerender } = render(
      <WarehouseRetentionEvidence
        ownedAgentIds={new Set(['agent-anby'])}
        discLevel={0}
        evidence={source}
      />,
    )
    expect(screen.getByRole('status')).toHaveTextContent('下一步：可清理')
    expect(screen.queryByText('查看参考评分')).not.toBeInTheDocument()
    expect(screen.queryByText(/尚未校准/)).not.toBeInTheDocument()
    rerender(
      <WarehouseRetentionEvidence
        ownedAgentIds={new Set(['agent-anby'])}
        discLevel={0}
        evidence={{
          ...source,
          nextAction: {
            kind: 'keep',
            targetLevel: null,
            detail: '当前正在装备。',
            stopWhen: '当前保护生效期间保留此盘。',
          },
        }}
      />,
    )
    expect(screen.getByRole('status')).toHaveTextContent('下一步：保留')
    expect(screen.getByText('这张盘正在装备。')).toBeVisible()
    expect(screen.queryByText(/不需要继续强化/)).not.toBeInTheDocument()
  })
  it('shows the trial and purpose score directly after selecting an applicable agent', async () => {
    render(
      <WarehouseRetentionEvidence
        ownedAgentIds={new Set(['agent-anby'])}
        discLevel={0}
        evidence={evidence({
          reasonKind: 'try_next_upgrade',
          nextAction: {
            kind: 'try_upgrade',
            targetLevel: 3,
            detail: '仅建议试到 +3，记录后重新分析。',
            stopWhen: '阶段结构不达标时停止。',
          },
          leadingUses: [retentionUse('trial', 79.4, 21)],
        })}
      />,
    )
    const dialog = await openAgent()
    expect(screen.getByRole('status')).toHaveTextContent('下一步：先强化到 +3')
    expect(screen.getByText('强化后重新分析，不再推荐就停手。')).toBeVisible()
    expect(within(dialog).getByText('21.0 分')).toBeVisible()
    expect(within(dialog).getByText('21.0–79.4 分')).toBeVisible()
    expect(within(dialog).getByText('词条匹配')).toBeVisible()
    expect(screen.queryByText('保留参考')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /安比/ })).toHaveAttribute('aria-expanded', 'true')
    expect(within(dialog).getByText('这盘与用途')).toBeVisible()
    expect(within(dialog).getByText('暴击率符合用途')).toBeVisible()
    expect(
      within(within(dialog).getByRole('group', { name: '词条匹配' })).queryByText('所选用途'),
    ).not.toBeInTheDocument()
    expect(
      within(dialog).queryByText('按该角色用途所需副词条及强化次数计算。'),
    ).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '参考说明' })).not.toBeInTheDocument()
  })

  it('explains a maxed disc without suggesting more enhancement or a redundant range', () => {
    const base = retentionUse('maxed', 57.777, 57.777)
    const maxed = {
      ...base,
      investment: { ...base.investment!, remainingNodes: 0, nextLevel: null },
    }
    const before = structuredClone(maxed)
    render(<RetentionScoreDetails evidence={evidence()} use={maxed} />)
    expect(screen.getByText('57.8 分')).toBeVisible()
    expect(screen.queryByText('60.0 分')).not.toBeInTheDocument()
    expect(screen.getByText('已满级')).toBeVisible()
    expect(screen.queryByText('强化后可能范围')).not.toBeInTheDocument()
    expect(screen.queryByText('还可强化')).not.toBeInTheDocument()
    expect(screen.queryByText('查看参考评分')).not.toBeInTheDocument()
    expect(screen.getByRole('group', { name: '词条匹配' }).querySelector('details')).toBeNull()
    expect(maxed).toEqual(before)
  })

  it('omits non-finite score rows and preserves the known remaining upgrades', () => {
    const pending = { ...retentionUse('pending', Infinity, NaN), cutoffs: null }
    render(<RetentionScoreDetails evidence={evidence()} use={pending} />)
    const scores = screen.getByRole('group', { name: '词条匹配' })
    expect(scores).toHaveTextContent('还可强化3 次')
    expect(scores).not.toHaveTextContent(/当前|强化后可能范围|分/)
    expect(screen.queryByText('保留参考')).not.toBeInTheDocument()
    expect(screen.queryByText(/NaN|Infinity/)).not.toBeInTheDocument()
    expect(screen.queryByText(/最不利和最有利/)).not.toBeInTheDocument()
  })

  it('omits reference scores when no scored use is available', () => {
    render(<RetentionScoreDetails evidence={evidence()} />)
    expect(screen.queryByText('查看参考评分')).not.toBeInTheDocument()
  })

  it('prioritizes owned references without calling reserve uses equipped', () => {
    render(
      <WarehouseRetentionEvidence
        ownedAgentIds={new Set(['agent-nicole'])}
        discLevel={0}
        evidence={evidence({
          ownedUseAgentIds: ['agent-nicole'],
          leadingUses: [
            retentionUse('reserve', 80),
            { ...retentionUse('owned', 75), agentId: 'agent-nicole' },
          ],
        })}
      />,
    )
    const references = screen.getByRole('list', { name: '适用角色' })
    const rows = within(references).getAllByRole('listitem')
    expect(rows[0]).toHaveTextContent('妮可')
    expect(rows[0]).toHaveTextContent('已拥有')
    expect(rows[1]).toHaveTextContent('未拥有')
    expect(references).not.toHaveTextContent('正在使用')
  })

  it('keeps conditions scoped to the selected use outside the first three roles', async () => {
    const selectedBlockers = [
      {
        kind: 'conditional_use' as const,
        profileId: 'p1',
        agentId: 'agent-anby',
        field: 'fourPieceUses',
        predicateId: 'selected-context',
        detail: '需要当前角色达到二影。',
        sourceIds: ['synthetic-source'],
      },
    ]
    const otherBlockers = [
      {
        kind: 'conditional_use' as const,
        profileId: 'p4',
        agentId: 'agent-nicole',
        field: 'fourPieceUses',
        predicateId: 'other-context',
        detail: '需要队友装备静听嘉音四件套。',
        sourceIds: ['synthetic-source'],
      },
    ]
    render(
      <WarehouseRetentionEvidence
        ownedAgentIds={new Set(['agent-anby'])}
        discLevel={6}
        evidence={evidence({
          leadingUses: [
            { ...retentionUse('p1', 80), blockers: selectedBlockers },
            retentionUse('p2', 78),
            retentionUse('p3', 70),
            {
              ...retentionUse('p4', 65),
              agentId: 'agent-nicole',
              blockers: otherBlockers,
            },
          ],
        })}
      />,
    )
    await openAgent()
    expect(screen.queryByText(/需要队友装备静听嘉音四件套/)).not.toBeInTheDocument()
    expect(screen.getByRole('group', { name: '词条匹配' })).toBeVisible()
    await userEvent.click(screen.getByText('查看本用途条件'))
    expect(screen.getByText(/需要当前角色达到二影/)).toBeVisible()
    expect(screen.queryByText(/需要队友装备静听嘉音四件套/)).not.toBeInTheDocument()
    expect(screen.queryByText(/查看来源/)).not.toBeInTheDocument()
    expect(screen.getAllByText('3 次')).toHaveLength(1)
    expect(screen.getByRole('group', { name: '词条匹配' })).toBeVisible()
  })

  it('keeps completed function separate from substat quality at mature level', async () => {
    render(
      <WarehouseRetentionEvidence
        ownedAgentIds={new Set(['agent-anby'])}
        discLevel={15}
        evidence={evidence({
          disposition: 'keep',
          reasonKind: 'functional_ready',
          bestUseScore: 28,
          nextAction: {
            kind: 'keep',
            targetLevel: null,
            detail: '功能条件已具备。',
            stopWhen: '用途变化时复核。',
          },
          leadingUses: [
            {
              ...retentionUse('function', 28, 28),
              functionalMain: true,
              functionalState: 'ready',
              functionDetail: '能量回复主词条已生效',
            },
          ],
        })}
      />,
    )
    await openAgent()
    expect(screen.getByText(/主词条已能发挥所需功能/)).toBeInTheDocument()
    expect(screen.getAllByText('28.0 分').length).toBeGreaterThan(0)
    expect(screen.queryByText(/试强化/)).not.toBeInTheDocument()
  })

  it('distinguishes low investment with large remaining upside from a strict low ceiling', async () => {
    const shared = retentionUse('p1', 95)
    const { rerender } = render(
      <WarehouseRetentionEvidence
        ownedAgentIds={new Set(['agent-anby'])}
        discLevel={6}
        evidence={evidence({
          reasonKind: 'low_investment_value',
          leadingUses: [shared],
        })}
      />,
    )
    await openAgent()
    expect(screen.getByText(/当前词条不满足继续强化标准/)).toBeInTheDocument()
    expect(screen.getByText('42.0–95.0 分')).toBeInTheDocument()
    rerender(
      <WarehouseRetentionEvidence
        ownedAgentIds={new Set(['agent-anby'])}
        discLevel={15}
        evidence={evidence({
          reasonKind: 'proven_low_ceiling',
          leadingUses: [retentionUse('p1', 50, 42)],
        })}
      />,
    )
    expect(screen.getByText(/后续强化潜力不足/)).toBeInTheDocument()
    expect(screen.getByText('42.0–50.0 分')).toBeInTheDocument()
    expect(screen.queryByText(/理论上界，也不自动证明/)).not.toBeInTheDocument()
  })

  it('does not call upper 50 versus target 60 a trial', () => {
    render(
      <WarehouseRetentionEvidence
        ownedAgentIds={new Set(['agent-anby'])}
        discLevel={6}
        evidence={evidence({
          reasonKind: 'proven_low_ceiling',
          leadingUses: [retentionUse('p1', 50)],
          nextAction: {
            kind: 'manual_cleanup',
            targetLevel: null,
            detail: '请人工复核。',
            stopWhen: '确认实际装备状态。',
          },
        })}
      />,
    )
    expect(screen.queryByText(/试强化/)).not.toBeInTheDocument()
    expect(screen.getByText(/下一步：复核后可清理/)).toBeInTheDocument()
  })

  it('shows readable conditions and source links without internal identifiers even when expanded', async () => {
    const profileId = 'agent-anby:base-0:fnv1a123456'
    const fields = [
      'functionalTarget',
      'numericWeights',
      'mainStats.6.energy_regen',
      'fourPiece.set-x',
    ]
    render(
      <WarehouseRetentionEvidence
        ownedAgentIds={new Set(['agent-anby'])}
        discLevel={15}
        evidence={evidence({
          leadingUses: [
            {
              ...retentionUse(profileId, 70),
              functionalState: 'ready',
              functionDetail: 'energy_regen、impact、anomaly_mastery 已满足',
              sourceIds: ['synthetic-source'],
            },
          ],
          blockedBy: fields.map((field) => ({
            kind: 'missing_fact',
            field,
            profileId,
            agentId: 'agent-anby',
            predicateId: `${profileId}:${field}`,
            detail: '需要核对 energy_regen 的来源',
            sourceIds: ['synthetic-source'],
          })),
        })}
      />,
    )
    const dialog = await openAgent()
    const text = dialog.textContent ?? ''
    expect(text).not.toContain('功能目标')
    expect(text).not.toContain('品质标尺')
    expect(text).toContain('冲击力')
    expect(text).toContain('异常掌控')
    expect(screen.queryByText(/查看来源/)).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'BWIKI 构筑资料' })).not.toBeInTheDocument()
    expect(text).not.toMatch(/原资料未标注游戏版本|旧攻略沿用|这份分析未附/)
    expect(screen.queryByText('查看本用途条件')).not.toBeInTheDocument()
    expect(text).not.toMatch(/test-policy|synthetic-source|fnv1a|synthetic-investment/)
    const region = screen.getByRole('region', { name: '适用角色' })
    const mainCopy = [...region.children]
      .filter((element) => element.tagName !== 'DETAILS')
      .map((element) => element.textContent)
      .join(' ')
    expect(mainCopy).not.toMatch(
      /base-0|fnv1a|functionalTarget|numericWeights|mainStats\.6\.energy_regen/,
    )
  })

  registerWarehouseRetentionEvidenceCases()
})
