import { expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { evidence, retentionUse } from './WarehouseRetentionEvidence.testFixture'
import { WarehouseRetentionEvidence } from './WarehouseRetentionEvidence'
import { warehouseTestDisc } from '../warehouse/discWarehouseAnalysis.testFixtures'

function setUse(
  profileId: string,
  values: {
    setId: string
    setName: string
    role: 'primary' | 'secondary' | 'potential' | 'conditional' | 'mismatch'
  },
) {
  const sample = retentionUse(profileId, 72)
  const plan = {
    pattern: '4+2' as const,
    primarySets: [{ id: 'set-main', name: '主套' }],
    secondarySets: [{ id: 'set-sub', name: '副套' }],
    conditionDetails: [],
  }
  const qualityPlan = {
    pattern: plan.pattern,
    primarySetIds: plan.primarySets.map((set) => set.id),
    secondarySetIds: plan.secondarySets.map((set) => set.id),
  }
  return {
    ...sample,
    branchSetPlan: qualityPlan,
    setFit:
      values.role === 'mismatch'
        ? ('incompatible' as const)
        : values.role === 'conditional'
          ? ('conditional' as const)
          : ('valid' as const),
    recommendationSetFit:
      values.role === 'primary' || values.role === 'secondary'
        ? ('valid' as const)
        : values.role === 'conditional'
          ? ('conditional' as const)
          : ('incompatible' as const),
    twoPieceFit:
      values.role === 'mismatch'
        ? ('incompatible' as const)
        : values.role === 'conditional'
          ? ('conditional' as const)
          : ('valid' as const),
    fourPieceFit:
      values.role === 'primary'
        ? ('valid' as const)
        : values.role === 'mismatch'
          ? ('incompatible' as const)
          : values.role === 'conditional'
            ? ('conditional' as const)
            : ('incompatible' as const),
    guidance: {
      ...sample.guidance!,
      currentSet: { id: values.setId, name: values.setName },
      branchSetPlan: plan,
      twoPieceEffect: `${values.setName}两件效果。`,
      fourPieceEffect: `${values.setName}四件效果。`,
    },
  }
}

export function registerWarehouseRetentionEvidenceCases() {
  it('omits an equipment-only secondary explanation while preserving independent analysis', () => {
    const source = evidence({
      nextAction: {
        kind: 'keep',
        targetLevel: null,
        detail: '当前正在装备。',
        stopWhen: '当前保护生效期间保留此盘。',
      },
    })
    const { rerender } = render(
      <WarehouseRetentionEvidence
        ownedAgentIds={new Set()}
        evidence={source}
        discLevel={15}
        showRecommendation={false}
        showSecondaryReason
      />,
    )
    expect(screen.queryByText('查看词条分析说明')).not.toBeInTheDocument()
    rerender(
      <WarehouseRetentionEvidence
        ownedAgentIds={new Set()}
        discLevel={15}
        evidence={evidence({ reasonKind: 'proven_low_ceiling' })}
        showRecommendation={false}
        showSecondaryReason
      />,
    )
    expect(screen.getByText('查看词条分析说明')).toBeInTheDocument()
  })
  it('lets keyboard close and select the same applicable agent again', async () => {
    render(
      <WarehouseRetentionEvidence
        ownedAgentIds={new Set(['agent-anby'])}
        evidence={evidence({ leadingUses: [retentionUse('keyboard-role', 70)] })}
        discLevel={15}
      />,
    )
    const trigger = screen.getByRole('button', { name: /安比/ })
    await userEvent.click(trigger)
    expect(screen.getByRole('dialog', { name: /安比/ })).toBeVisible()
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: /安比/ })).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
    await userEvent.click(trigger)
    expect(screen.getByRole('dialog', { name: /安比/ })).toBeVisible()
  })

  it('explains a record mismatch without exposing the raw scope', () => {
    render(
      <WarehouseRetentionEvidence
        ownedAgentIds={new Set(['agent-anby'])}
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

  it('shows stat fit only after selecting an applicable character', async () => {
    const first = retentionUse('ben', 75)
    render(
      <WarehouseRetentionEvidence
        ownedAgentIds={new Set(['agent-anby'])}
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
              ...retentionUse('claret', 75),
              agentId: 'agent-claret',
              fourPieceFit: 'conditional',
              useState: 'conditional',
            },
          ],
        })}
      />,
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByText('暴击率符合用途')).not.toBeInTheDocument()
    const agents = screen.getAllByRole('button', { name: /查看.*词条匹配/ })
    await userEvent.click(agents[0]!)
    let dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('暴击率符合用途')).toBeVisible()
    expect(within(dialog).getByText(/这个号位通常要至少 2 条/)).toBeVisible()
    expect(within(dialog).queryByRole('heading', { name: '推荐套装' })).not.toBeInTheDocument()
    expect(within(dialog).queryByText(/四件（需满足条件）/)).not.toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: '关闭' }))
    await userEvent.click(screen.getAllByRole('button', { name: /查看.*词条匹配/ })[1]!)
    dialog = screen.getByRole('dialog')
    expect(within(dialog).queryByRole('heading', { name: '推荐套装' })).not.toBeInTheDocument()
    expect(within(dialog).getByText(/35% 转为初始暴击率，不直接提高锐暴伤害/)).toBeVisible()
  })

  it.each([
    ['primary', 'set-main', '主套', '可作为主套', '推荐套装'],
    ['secondary', 'set-sub', '副套', '可作为副套', '推荐套装'],
    ['potential', 'set-potential', '潜力套', '词条适合，套装需调整', null],
    ['conditional', 'set-conditional', '条件套', '词条适合，套装待确认', null],
  ] as const)(
    'lists only exact recommended set relationships: %s',
    async (role, setId, setName, expectedRole, planHeading) => {
      const disc = warehouseTestDisc(`synthetic-${role}`, { setId, slot: 3 })
      render(
        <WarehouseRetentionEvidence
          evidence={evidence({
            leadingUses: [setUse(`agent-anby:${role}`, { setId, setName, role })],
          })}
          disc={disc}
          discLevel={3}
          ownedAgentIds={new Set(['agent-anby'])}
        />,
      )
      if (planHeading) {
        await userEvent.click(screen.getByRole('button', { name: /查看.*词条匹配/ }))
        const dialog = screen.getByRole('dialog')
        expect(within(dialog).getByText(expectedRole)).toBeVisible()
        expect(within(dialog).getByText(planHeading)).toBeVisible()
        expect(within(dialog).queryByText('套装效果')).not.toBeInTheDocument()
        expect(within(dialog).getByText('推荐套装')).toBeVisible()
        expect(within(dialog).queryByText(/需搭配另.*同套驱动盘/)).not.toBeInTheDocument()
      } else {
        expect(screen.queryByRole('list', { name: '适用角色' })).not.toBeInTheDocument()
        expect(screen.queryByText('推荐套装')).not.toBeInTheDocument()
      }
      expect(screen.queryByText(/当前这张盘未激活该效果/)).not.toBeInTheDocument()
    },
  )

  it('does not call a named 4+2 main set valid when only its two-piece effect is supported', () => {
    const disc = warehouseTestDisc('synthetic-main-two-only', {
      setId: 'set-main',
      slot: 3,
    })
    const use = setUse('agent-anby:main-two-only', {
      setId: 'set-main',
      setName: '主套',
      role: 'primary',
    })
    render(
      <WarehouseRetentionEvidence
        evidence={evidence({
          leadingUses: [{ ...use, fourPieceFit: 'incompatible', setFit: 'valid' }],
        })}
        disc={disc}
        discLevel={3}
        ownedAgentIds={new Set(['agent-anby'])}
      />,
    )
    expect(screen.queryByRole('list', { name: '适用角色' })).not.toBeInTheDocument()
    expect(screen.queryByText('可作为主套')).not.toBeInTheDocument()
    expect(screen.queryByText('推荐套装')).not.toBeInTheDocument()
    expect(screen.queryByText(/当前这张盘未激活该效果/)).not.toBeInTheDocument()
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
    expect(screen.getByRole('status')).toHaveTextContent('保留，暂不强化')
    expect(screen.getByText('先保留，暂不强化或清理。')).toBeVisible()
    expect(screen.queryByText('按字段补齐资料。')).not.toBeInTheDocument()
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
    expect(screen.getByText('先保留，暂不清理。')).toBeVisible()
    expect(screen.getByRole('status')).not.toHaveTextContent(/清理候选|试强化/)
  })

  it('reports an old cross-set use as mismatched instead of presenting it as suitable', () => {
    const disc = warehouseTestDisc('synthetic-mismatch', { setId: 'set-other', slot: 3 })
    render(
      <WarehouseRetentionEvidence
        evidence={evidence({
          leadingUses: [
            setUse('agent-anby:mismatch', {
              setId: 'set-other',
              setName: '其他套',
              role: 'mismatch',
            }),
          ],
        })}
        disc={disc}
        discLevel={3}
        ownedAgentIds={new Set(['agent-anby'])}
      />,
    )
    expect(screen.queryByRole('list', { name: '适用角色' })).not.toBeInTheDocument()
    expect(screen.getByText('暂无适用角色')).toBeVisible()
    expect(screen.queryByRole('button', { name: /词条匹配/ })).not.toBeInTheDocument()
    expect(screen.queryByText('该用途的套装组合')).not.toBeInTheDocument()
  })
}
