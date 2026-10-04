import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { WarehouseAbsoluteRetentionEvidence } from '../warehouse/discWarehouseEvidence'
import { WarehouseRetentionEvidence } from './WarehouseRetentionEvidence'

function evidence(
  patch: Partial<WarehouseAbsoluteRetentionEvidence> = {},
): WarehouseAbsoluteRetentionEvidence {
  return {
    disposition: 'observe',
    policyId: 'test-policy',
    policyCalibration: 'approved',
    sourceCoverage: 'complete',
    branchCount: 4,
    bestUseProfileId: 'p1',
    bestUseScore: 42,
    ownedUseAgentIds: ['agent-anby'],
    unownedUseAgentIds: [],
    leadingUses: [],
    reasonKind: 'quality_borderline',
    nextAction: {
      kind: 'review_quality',
      targetLevel: null,
      detail: '核对当前分数。',
      stopWhen: '确认保留线。',
    },
    blockedBy: [],
    witnessProfileIds: [],
    reviewedUseScope: '已支持构筑',
    ...patch,
  }
}

function use(
  profileId: string,
  upper: number,
  current = 42,
): WarehouseAbsoluteRetentionEvidence['leadingUses'][number] {
  return {
    profileId,
    agentId: 'agent-anby',
    mainFit: 'valid',
    setFit: 'valid',
    twoPieceFit: 'valid',
    fourPieceFit: 'incompatible',
    currentScore: current,
    possibleFinalScore: { lower: current, upper },
    functionalMain: false,
    cutoffs: { cleanupBelow: 40, keepFrom: 60, premiumFrom: 85 },
    sourceIds: ['synthetic-source'],
    guidance: {
      mainStats: ['def_flat'],
      subStats: ['crit_rate', 'crit_dmg', 'def_percent'],
      matchedStats: ['crit_rate'],
      minorStats: [],
      unusedStats: ['hp_flat', 'anomaly_proficiency'],
      minimumLines: 2,
      minimumCoreLines: 1,
      twoPieceEffect: '防御力提升16%。',
      fourPieceEffect: '四件套需满足配装条件。',
      sources: [
        { label: 'BWIKI 构筑资料', url: 'https://wiki.biligame.com/zzz/本', sourceVersion: null },
      ],
    },
    investment: {
      policyId: 'synthetic-investment',
      qualified: false,
      meaningfulStats: [],
      coreStats: [],
      spentNodes: 2,
      remainingNodes: 3,
      nextLevel: 9,
      progressFloor: 50,
      potentialTarget: 60,
    },
  }
}

describe('absolute retention evidence', () => {
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
    const { rerender } = render(<WarehouseRetentionEvidence discLevel={0} evidence={source} />)
    expect(screen.getByRole('status')).toHaveTextContent('下一步：可清理')
    expect(screen.queryByText('查看参考评分')).not.toBeInTheDocument()
    expect(screen.queryByText(/尚未校准/)).not.toBeInTheDocument()
    rerender(
      <WarehouseRetentionEvidence
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
    expect(screen.getByText(/不代表成功概率/)).toBeVisible()
  })

  it('prioritizes owned references without calling reserve uses equipped', () => {
    render(
      <WarehouseRetentionEvidence
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

  it('names every blocker even when the affected profile is outside the first three score rows', () => {
    render(
      <WarehouseRetentionEvidence
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
    expect(screen.getByText(/需要核对四件套队伍条件/)).toBeVisible()
    expect(screen.queryByText(/查看来源/)).not.toBeInTheDocument()
    expect(screen.getAllByText('3 次')).toHaveLength(1)
    expect(screen.getByText('查看参考评分').closest('details')?.open).toBe(false)
  })

  it('keeps completed function separate from substat quality at mature level', () => {
    render(
      <WarehouseRetentionEvidence
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

  it('explains a record mismatch without exposing the raw scope', () => {
    render(
      <WarehouseRetentionEvidence
        discLevel={0}
        evidence={evidence({
          reviewedUseScope: '3.1:released-source-backed-guide-and-mechanic-reserve-objectives:r4',
          leadingUses: [],
          blockedBy: [
            {
              kind: 'record',
              field: 'enhancementHistory',
              predicateId: 'record:enhancementHistory',
              detail: 'inconsistent_substat_record',
              sourceIds: ['synthetic-rule-source'],
            },
          ],
        })}
      />,
    )
    expect(screen.getByText(/副词条数值与记录的强化次数不一致/)).toBeInTheDocument()
    expect(screen.queryByText(/inconsistent_substat_record/)).not.toBeInTheDocument()
    expect(screen.queryByText(/released-source-backed/)).not.toBeInTheDocument()
  })

  it('puts actual stat fit first and changes only the displayed purpose when another character is selected', async () => {
    const first = use('ben', 75)
    render(
      <WarehouseRetentionEvidence
        discLevel={0}
        evidence={evidence({
          ownedUseAgentIds: ['agent-ben'],
          leadingUses: [
            {
              ...first,
              agentId: 'agent-ben',
              investment: {
                ...first.investment!,
                meaningfulStats: ['crit_rate'],
                coreStats: ['crit_rate'],
              },
            },
            {
              ...use('claret', 75),
              agentId: 'agent-claret',
              fourPieceFit: 'conditional',
              useState: 'conditional',
            },
          ],
        })}
      />,
    )
    expect(screen.getByText('暴击率有用')).toBeVisible()
    expect(screen.getByText(/生命值.*异常精通.*不计入这个构筑/)).toBeVisible()
    expect(screen.getByText(/目前只有 1 条重点副词条/)).toBeVisible()
    expect(screen.getByText('此用途只取两件效果。')).toBeVisible()
    expect(screen.queryByText(/四件（有使用条件）/)).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /克拉蕾/ }))
    expect(screen.getByText(/四件（有使用条件）/)).toBeVisible()
    expect(screen.getByText(/35%.*不直接放大锐暴/)).toBeVisible()
    expect(screen.getByRole('button', { name: /克拉蕾/ })).toHaveAttribute('aria-pressed', 'true')
  })
})
