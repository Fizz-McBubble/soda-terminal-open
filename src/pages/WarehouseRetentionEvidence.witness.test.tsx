import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { evidence, use } from './WarehouseRetentionEvidence.testFixture'
import { WarehouseRetentionEvidence } from './WarehouseRetentionEvidence'

describe('absolute retention witness guidance', () => {
  it('names an impossible investment policy without asking the player to repair their disc', () => {
    render(
      <WarehouseRetentionEvidence
        discLevel={0}
        evidence={evidence({
          disposition: 'review',
          reasonKind: 'missing_fact',
          nextAction: {
            kind: 'complete_data',
            targetLevel: null,
            detail: '单独校准投入门槛。',
            stopWhen: '暂停强化和清理。',
          },
          blockedBy: [
            {
              kind: 'policy',
              field: 'investment.capacity.2.atk_flat',
              predicateId: 'capacity-test',
              detail: '合法容量1条，门槛2条。',
              sourceIds: ['synthetic-policy'],
            },
          ],
        })}
      />,
    )
    expect(screen.getByRole('status')).toHaveTextContent('暂留，投入门槛待校准')
    expect(screen.getByText(/该用途的投入门槛需单独校准/)).toBeVisible()
    expect(screen.getByText(/2 号位投入门槛/)).toBeVisible()
    expect(screen.queryByText(/investment\.capacity|等待资料确认/)).not.toBeInTheDocument()
  })
  it.each(['keep', 'try_upgrade'] as const)(
    'keeps alternative conditions separate from the sufficient valid %s guidance',
    async (action) => {
      const blocker = {
        kind: 'conditional_use' as const,
        field: 'mainStats.6.energy_regen',
        profileId: 'alternative',
        agentId: 'agent-lycaon',
        predicateId: 'alternative-team-condition',
        detail: '需确认这项额外用途的队伍前提。',
        sourceIds: ['synthetic-source'],
      }
      const source = evidence({
        disposition: action === 'keep' ? 'keep' : 'observe',
        reasonKind: action === 'keep' ? 'quality_keep' : 'try_next_upgrade',
        bestUseProfileId: 'valid-witness',
        witnessProfileIds: ['valid-witness'],
        ownedUseAgentIds: ['agent-lycaon'],
        unownedUseAgentIds: ['agent-anby'],
        nextAction: {
          kind: action,
          targetLevel: action === 'try_upgrade' ? 3 : null,
          detail: '当前成立的用途足以支持此建议。',
          stopWhen: '沿用当前用途的投入门槛。',
        },
        leadingUses: [
          { ...use('valid-witness', 90, 78), useState: 'valid' },
          {
            ...use('alternative', 100, 90),
            agentId: 'agent-lycaon',
            mainFit: 'conditional',
            useState: 'conditional',
            blockers: [blocker],
          },
        ],
      })
      const before = structuredClone(source)
      render(<WarehouseRetentionEvidence evidence={source} discLevel={0} />)
      expect(screen.getByRole('status')).toHaveTextContent(
        action === 'keep' ? '下一步：保留' : '下一步：先强化到 +3',
      )
      expect(screen.getByRole('button', { name: /安比/ })).toHaveAttribute('aria-pressed', 'true')
      expect(screen.getByRole('button', { name: /莱卡恩/ })).toHaveAttribute(
        'aria-pressed',
        'false',
      )
      expect(screen.getByRole('group', { name: '全部待确认事项' })).not.toBeVisible()
      await userEvent.click(screen.getByText('其他用途待确认事项'))
      expect(screen.getByRole('group', { name: '全部待确认事项' })).toHaveTextContent(
        blocker.detail,
      )
      expect(screen.getByText('这些条件只影响相应用途，不改变上方建议。')).toBeVisible()
      await userEvent.click(screen.getByRole('button', { name: /莱卡恩/ }))
      expect(screen.getByText('上述用途有队伍或配装条件，确认后再投入。')).toBeVisible()
      expect(screen.getByRole('status')).toHaveTextContent(
        action === 'keep' ? '下一步：保留' : '下一步：先强化到 +3',
      )
      expect(source).toEqual(before)
    },
  )

  it('uses the sufficient witness when another branch belongs to the same character', () => {
    render(
      <WarehouseRetentionEvidence
        discLevel={0}
        evidence={evidence({
          witnessProfileIds: ['valid-witness'],
          leadingUses: [
            { ...use('valid-witness', 90), useState: 'valid' },
            { ...use('alternative', 100), mainFit: 'conditional', useState: 'conditional' },
          ],
        })}
      />,
    )
    expect(screen.queryByText('上述用途有队伍或配装条件，确认后再投入。')).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /安比/ })).toHaveLength(1)
  })
})
