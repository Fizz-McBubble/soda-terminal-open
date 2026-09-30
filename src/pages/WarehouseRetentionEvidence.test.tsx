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
    expect(screen.queryByText('查看评分与强化依据')).not.toBeInTheDocument()
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
    await userEvent.click(screen.getByText('查看评分与强化依据'))
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
    expect(screen.getByText(/需要核对四件套队伍条件/)).toBeInTheDocument()
    expect(screen.getAllByText(/还可强化 3 次/)).toHaveLength(4)
    expect(screen.getByText('查看评分与强化依据').closest('details')?.open).toBe(false)
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
    expect(screen.getByText(/仍可能出现极端的好结果/)).toBeInTheDocument()
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

  it('uses player-facing branch, field, and stat labels while retaining policy and source provenance', () => {
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
    expect(text).toContain('品质策略：test-policy')
    expect(text).toContain('来源 synthetic-source')
    const mainCopy = [...screen.getByRole('region', { name: '绝对品质与成长证据' }).children]
      .filter((element) => element.tagName !== 'DETAILS')
      .map((element) => element.textContent)
      .join(' ')
    expect(mainCopy).not.toMatch(
      /base-0|fnv1a|functionalTarget|numericWeights|mainStats\.6\.energy_regen/,
    )
  })

  it('explains a record mismatch and keeps the raw scope inside provenance', () => {
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
    const scope = screen.getByText(/用途范围标识：/)
    expect(scope.closest('details')?.open).toBe(false)
    expect(screen.getByText(/范围：当前版本已发布角色/)).toBeInTheDocument()
  })
})
