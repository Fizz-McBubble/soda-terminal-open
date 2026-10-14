import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { evidence, use } from './WarehouseRetentionEvidence.testFixture'
import { WarehouseRetentionEvidence } from './WarehouseRetentionEvidence'
import { RetentionScoreDetails } from './WarehouseRetentionDetails'
import { registerWarehouseRetentionEvidenceCases } from './WarehouseRetentionEvidence.testCases'

describe('absolute retention evidence', () => {
  it('uses actual ownership even when an owned reference has no qualifying retention use', () => {
    const source = evidence({
      ownedUseAgentIds: [],
      unownedUseAgentIds: [],
      leadingUses: [
        { ...use('reserve', 25, 20), agentId: 'agent-lycaon' },
        { ...use('owned-low-value', 15, 10), agentId: 'agent-nicole' },
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
    const rows = within(screen.getByRole('list', { name: '参考角色用途' })).getAllByRole('listitem')
    expect(rows[0]).toHaveTextContent('妮可已拥有')
    expect(within(rows[0]!).queryByTitle('未拥有，可作储备用途')).not.toBeInTheDocument()
    expect(rows[1]).toHaveTextContent('莱卡恩储备')
    expect(screen.getByText('参考角色')).toBeInTheDocument()
    expect(screen.queryByText('适用角色')).not.toBeInTheDocument()
    expect(source).toEqual(before)
  })

  it.each([false, true])(
    'only calls an empty substat direction functional when functionalMain=%s',
    (functionalMain) => {
      const row = use('empty-direction', 25, 20)
      render(
        <WarehouseRetentionEvidence
          ownedAgentIds={new Set()}
          discLevel={15}
          evidence={evidence({
            leadingUses: [{ ...row, functionalMain, guidance: { ...row.guidance!, subStats: [] } }],
          })}
        />,
      )
      expect(
        screen.getByText(functionalMain ? '以主词条功能为主。' : '当前用途未列出重点副词条。'),
      ).toBeVisible()
      expect(
        screen.queryByText(functionalMain ? '当前用途未列出重点副词条。' : '以主词条功能为主。'),
      ).not.toBeInTheDocument()
    },
  )

  it('translates collection locators and merges equal visible conditions without changing evidence', () => {
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
      blockedBy: [
        blocker,
        { ...blocker, profileId: 'agent-dialyn:base-1', predicateId: 'another-branch' },
        { ...blocker, predicateId: 'different-threshold', detail: '整套配装需达到60%暴击率。' },
        {
          ...blocker,
          profileId: 'agent-lycaon:reviewed-miyoushe-73045858-lycaon-potential-illustrated-teams',
          agentId: 'agent-lycaon',
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
    const conditions = screen.getByRole('group', { name: '全部待确认事项' })
    expect(within(conditions).getAllByRole('listitem')).toHaveLength(4)
    expect(
      within(conditions).getAllByText(
        '琉音（常规构筑） · 4 号位·暴击率：整套配装需达到50%暴击率。',
      ),
    ).toHaveLength(1)
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
    expect(screen.getByText('当前正在装备。')).toBeVisible()
    expect(screen.queryByText(/不需要继续强化/)).not.toBeInTheDocument()
  })
  it('shows a short trial first and reveals scores only when requested', async () => {
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
          leadingUses: [use('trial', 79.4, 21)],
        })}
      />,
    )
    expect(screen.getByRole('status')).toHaveTextContent('下一步：先强化到 +3')
    expect(screen.getByText('强化后重新分析，不再推荐就停手。')).toBeVisible()
    expect(screen.getByText('21.0 分')).not.toBeVisible()
    await userEvent.click(screen.getByText('查看参考评分'))
    expect(screen.getByText('21.0 分')).toBeVisible()
    expect(screen.getByText('21.0–79.4 分')).toBeVisible()
    expect(screen.getByText('仅供副词条筛选，不是伤害收益。')).toBeVisible()
    expect(screen.getByText('当前副词条评分')).toBeVisible()
    expect(screen.getByText('同号位保留参考')).toBeVisible()
  })

  it('explains a maxed disc without suggesting more enhancement or a redundant range', async () => {
    const base = use('maxed', 57.777, 57.777)
    const maxed = {
      ...base,
      investment: { ...base.investment!, remainingNodes: 0, nextLevel: null },
    }
    const before = structuredClone(maxed)
    render(<RetentionScoreDetails evidence={evidence()} use={maxed} />)
    await userEvent.click(screen.getByText('查看参考评分'))
    expect(screen.getByText('57.8 分')).toBeVisible()
    expect(screen.getByText('60.0 分')).toBeVisible()
    expect(screen.getByText('已满级')).toBeVisible()
    expect(screen.queryByText('满级后评分范围')).not.toBeInTheDocument()
    expect(screen.queryByText('剩余强化')).not.toBeInTheDocument()
    expect(screen.getByText('查看参考评分').closest('details')?.querySelectorAll('p')).toHaveLength(
      1,
    )
    expect(maxed).toEqual(before)
  })

  it('keeps missing and non-finite scores as pending instead of displaying fabricated numbers', async () => {
    const pending = { ...use('pending', Infinity, NaN), cutoffs: null }
    render(<RetentionScoreDetails evidence={evidence()} use={pending} />)
    await userEvent.click(screen.getByText('查看参考评分'))
    expect(screen.getAllByText('待确认')).toHaveLength(3)
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
          leadingUses: [use('reserve', 80), { ...use('owned', 75), agentId: 'agent-nicole' }],
        })}
      />,
    )
    const references = screen.getByRole('list', { name: '参考角色用途' })
    const rows = within(references).getAllByRole('listitem')
    expect(rows[0]).toHaveTextContent('妮可')
    expect(rows[0]).toHaveTextContent('已拥有')
    expect(rows[1]).toHaveTextContent('储备')
    expect(within(rows[1]!).getByTitle('未拥有，可作储备用途')).toBeVisible()
    expect(references).not.toHaveTextContent('正在使用')
  })

  it('does not ask the player to supply unpublished action facts or clear uncalibrated rarities', () => {
    const { rerender } = render(
      <WarehouseRetentionEvidence
        ownedAgentIds={new Set(['agent-anby'])}
        discLevel={0}
        evidence={evidence({
          reasonKind: 'missing_fact',
          nextAction: {
            kind: 'complete_data',
            targetLevel: null,
            detail: '按字段补齐资料。',
            stopWhen: '暂停投入和清理。',
          },
        })}
      />,
    )
    expect(screen.getByRole('status')).toHaveTextContent('暂留，等待资料确认')
    expect(screen.getByText(/暂不建议继续投入或清理/)).toBeVisible()
    rerender(
      <WarehouseRetentionEvidence
        ownedAgentIds={new Set(['agent-anby'])}
        discLevel={0}
        evidence={evidence({
          reasonKind: 'missing_fact',
          blockedBy: [
            {
              kind: 'policy',
              field: 'calibration',
              predicateId: 'rarity-A',
              detail: 'A级尚未校准',
              sourceIds: [],
            },
          ],
        })}
      />,
    )
    expect(screen.getByText(/这一类盘的清理标准尚未校准/)).toBeVisible()
  })

  it('preserves expandable alternative blockers outside the first three score rows', async () => {
    render(
      <WarehouseRetentionEvidence
        ownedAgentIds={new Set(['agent-anby'])}
        discLevel={6}
        evidence={evidence({
          leadingUses: [
            use('p1', 80),
            use('p2', 78),
            use('p3', 70),
            {
              ...use('p4', 65),
              blockers: [
                {
                  kind: 'conditional_use',
                  profileId: 'p4',
                  agentId: 'agent-anby',
                  field: 'fourPieceUses',
                  predicateId: 'four-piece-context',
                  detail: '需要核对四件套队伍条件',
                  sourceIds: ['synthetic-source'],
                },
              ],
            },
          ],
        })}
      />,
    )
    expect(screen.getByText(/需要核对四件套队伍条件/)).not.toBeVisible()
    await userEvent.click(screen.getByText('其他用途待确认事项'))
    expect(screen.getByText(/需要核对四件套队伍条件/)).toBeVisible()
    expect(screen.queryByText(/查看来源/)).not.toBeInTheDocument()
    expect(screen.getAllByText('3 次')).toHaveLength(1)
    expect(screen.getByText('查看参考评分').closest('details')?.open).toBe(false)
  })

  it('keeps completed function separate from substat quality at mature level', () => {
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
              ...use('function', 28, 28),
              functionalMain: true,
              functionalState: 'ready',
              functionDetail: '能量回复主词条已生效',
            },
          ],
        })}
      />,
    )
    expect(screen.getByText(/主词条已能发挥所需功能/)).toBeInTheDocument()
    expect(screen.getAllByText('28.0 分').length).toBeGreaterThan(0)
    expect(screen.queryByText(/试强化/)).not.toBeInTheDocument()
  })

  it('distinguishes low investment with large remaining upside from a strict low ceiling', () => {
    const shared = use('p1', 95)
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
    expect(screen.getByText(/当前词条不满足继续强化标准/)).toBeInTheDocument()
    expect(screen.getByText('42.0–95.0 分')).toBeInTheDocument()
    rerender(
      <WarehouseRetentionEvidence
        ownedAgentIds={new Set(['agent-anby'])}
        discLevel={15}
        evidence={evidence({
          reasonKind: 'proven_low_ceiling',
          leadingUses: [use('p1', 50, 42)],
        })}
      />,
    )
    expect(screen.getByText(/即使后续强化全部往有利方向发展/)).toBeInTheDocument()
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
          leadingUses: [use('p1', 50)],
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
              ...use(profileId, 70),
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
    const text = screen.getByRole('region', { name: '绝对品质与成长证据' }).textContent ?? ''
    expect(text).toContain('常规构筑')
    expect(text).toContain('功能目标')
    expect(text).toContain('品质标尺')
    expect(text).toContain('6 号位·能量自动回复')
    expect(text).toContain('四件套条件')
    expect(text).toContain('冲击力')
    expect(text).toContain('异常掌控')
    expect(screen.queryByText(/查看来源/)).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'BWIKI 构筑资料' })).not.toBeInTheDocument()
    expect(text).not.toMatch(/原资料未标注游戏版本|旧攻略沿用|这份分析未附/)
    expect(screen.getByRole('group', { name: '全部待确认事项' })).toBeVisible()
    expect(text).not.toMatch(/test-policy|synthetic-source|fnv1a|synthetic-investment/)
    const mainCopy = [...screen.getByRole('region', { name: '绝对品质与成长证据' }).children]
      .filter((element) => element.tagName !== 'DETAILS')
      .map((element) => element.textContent)
      .join(' ')
    expect(mainCopy).not.toMatch(
      /base-0|fnv1a|functionalTarget|numericWeights|mainStats\.6\.energy_regen/,
    )
  })

  registerWarehouseRetentionEvidenceCases()
})
