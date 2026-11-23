import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { evidence, retentionUse } from './WarehouseRetentionEvidence.testFixture'
import { WarehouseRetentionEvidence } from './WarehouseRetentionEvidence'

function teamCondition(profileId: string, agentId = 'agent-anby') {
  return {
    kind: 'conditional_use' as const,
    field: 'mainStats.6.energy_regen',
    profileId,
    agentId,
    predicateId: 'alternative-team-condition',
    detail: '需要队友装备静听嘉音四件套。',
    sourceIds: ['synthetic-source'],
  }
}

describe('absolute retention witness guidance', () => {
  it('names an impossible investment policy without asking the player to repair their disc', async () => {
    render(
      <WarehouseRetentionEvidence
        ownedAgentIds={new Set(['agent-anby'])}
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
    expect(screen.getByRole('status')).toHaveTextContent('保留，暂不强化')
    expect(screen.getByText('先保留，暂不继续强化。')).toBeVisible()
    expect(screen.queryByText('查看本用途条件')).not.toBeInTheDocument()
    expect(screen.queryByText(/investment\.capacity|先确认用途/)).not.toBeInTheDocument()
  })
  it.each(['keep', 'try_upgrade'] as const)(
    'keeps alternative conditions separate from the sufficient valid %s guidance',
    async (action) => {
      const blocker = teamCondition('alternative', 'agent-lycaon')
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
          { ...retentionUse('valid-witness', 90, 78), useState: 'valid' },
          {
            ...retentionUse('alternative', 100, 90),
            agentId: 'agent-lycaon',
            mainFit: 'conditional',
            useState: 'conditional',
            blockers: [blocker],
          },
        ],
      })
      const before = structuredClone(source)
      render(
        <WarehouseRetentionEvidence
          ownedAgentIds={new Set(['agent-anby'])}
          evidence={source}
          discLevel={0}
        />,
      )
      expect(screen.getByRole('status')).toHaveTextContent(
        action === 'keep' ? '下一步：保留' : '下一步：先强化到 +3',
      )
      expect(screen.getByRole('button', { name: /安比/ })).toHaveAttribute('aria-expanded', 'false')
      expect(screen.getByRole('button', { name: /莱卡恩/ })).toHaveAttribute(
        'aria-expanded',
        'false',
      )
      expect(screen.queryByRole('group', { name: '具体使用条件' })).not.toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: /安比/ }))
      let dialog = screen.getByRole('dialog', { name: /安比/ })
      expect(dialog).toBeVisible()
      expect(screen.getByRole('button', { name: /安比/ })).toHaveAttribute('aria-expanded', 'true')
      expect(within(dialog).queryByText('查看本用途条件')).not.toBeInTheDocument()
      await userEvent.click(within(dialog).getByRole('button', { name: '关闭' }))
      await userEvent.click(screen.getByRole('button', { name: /莱卡恩/ }))
      dialog = screen.getByRole('dialog', { name: /莱卡恩/ })
      expect(within(dialog).getByText('查看本用途条件')).toBeVisible()
      await userEvent.click(within(dialog).getByText('查看本用途条件'))
      expect(within(dialog).getByRole('group', { name: '具体使用条件' })).toHaveTextContent(
        blocker.detail,
      )
      expect(screen.getByRole('status')).toHaveTextContent(
        action === 'keep' ? '下一步：保留' : '下一步：先强化到 +3',
      )
      expect(source).toEqual(before)
    },
  )

  it('shows one role entry and keeps both branches of that character separately selectable', async () => {
    render(
      <WarehouseRetentionEvidence
        ownedAgentIds={new Set(['agent-anby'])}
        discLevel={0}
        evidence={evidence({
          witnessProfileIds: ['valid-witness'],
          leadingUses: [
            {
              ...retentionUse('valid-witness', 90),
              profileLabel: '震星迪斯科四件套',
              useState: 'valid',
            },
            {
              ...retentionUse('alternative', 100),
              profileLabel: '摇摆爵士四件套',
              blockers: [teamCondition('alternative')],
              mainFit: 'conditional',
              useState: 'conditional',
            },
          ],
        })}
      />,
    )
    expect(screen.queryByText('查看本用途条件')).not.toBeInTheDocument()
    const roles = screen.getAllByRole('button', { name: /安比/ })
    expect(roles).toHaveLength(1)
    await userEvent.click(roles[0]!)
    const dialog = screen.getByRole('dialog', { name: /安比/ })
    await userEvent.selectOptions(
      within(dialog).getByLabelText('推荐用途'),
      within(dialog).getByRole('option', { name: /摇摆爵士四件套/ }),
    )
    await userEvent.click(within(dialog).getByText('查看本用途条件'))
    expect(within(dialog).getByRole('group', { name: '具体使用条件' })).toHaveTextContent(
      teamCondition('alternative').detail,
    )
  })

  it('retains every same-role profile behind one role entry and keeps a late decisive profile visible', async () => {
    const profiles = Array.from({ length: 6 }, (_, index) => ({
      ...retentionUse(`agent-anby:base-${index}`, 90),
      blockers: index === 4 ? [teamCondition(`agent-anby:base-${index}`)] : [],
      useState: index === 4 ? ('conditional' as const) : ('valid' as const),
    }))
    render(
      <WarehouseRetentionEvidence
        ownedAgentIds={new Set(['agent-anby'])}
        discLevel={0}
        evidence={evidence({ leadingUses: profiles, witnessProfileIds: [profiles[5]!.profileId] })}
      />,
    )
    const roles = screen.getAllByRole('button', { name: /安比/ })
    expect(roles).toHaveLength(1)
    await userEvent.click(roles[0]!)
    const dialog = screen.getByRole('dialog', { name: /安比/ })
    const selector = within(dialog).getByLabelText('推荐用途')
    expect(within(selector).getAllByRole('option')).toHaveLength(6)
    expect(selector).toHaveValue(profiles[5]!.profileId)
    await userEvent.selectOptions(selector, profiles[4]!.profileId)
    await userEvent.click(within(dialog).getByText('查看本用途条件'))
    expect(within(dialog).getByRole('group', { name: '具体使用条件' })).toHaveTextContent(
      teamCondition('alternative').detail,
    )
  })
})
