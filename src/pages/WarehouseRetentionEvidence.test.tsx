import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
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
    expect(screen.getAllByText(/剩余强化节点 3 个/)).toHaveLength(4)
    expect(screen.getByText('查看其余 1 个构筑方向')).toBeInTheDocument()
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
    expect(screen.getByText(/保留依据是已具备的功能用途/)).toBeInTheDocument()
    expect(screen.getByText(/副词条当前 28.0 分/)).toBeInTheDocument()
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
    expect(screen.getByText(/剩余强化即使仍有很高的理论上界/)).toBeInTheDocument()
    expect(screen.getByText(/合法最终上界 95.0 分/)).toBeInTheDocument()
    rerender(
      <WarehouseRetentionEvidence
        discLevel={15}
        evidence={evidence({
          reasonKind: 'proven_low_ceiling',
          leadingUses: [use('p1', 50, 42)],
        })}
      />,
    )
    expect(screen.getByText(/严格上界仍低于相关门槛/)).toBeInTheDocument()
    expect(
      screen.getByText(/副词条当前 42.0 分 \/ 保留线 60.0 分 · 合法最终上界 50.0 分/),
    ).toBeInTheDocument()
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
    expect(screen.getByText(/下一步：人工清理复核/)).toBeInTheDocument()
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
    expect(screen.getByText(/已核对范围：当前版本已发布角色/)).toBeInTheDocument()
  })
})
