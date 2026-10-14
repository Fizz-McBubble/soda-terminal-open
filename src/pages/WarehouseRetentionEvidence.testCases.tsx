import { expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { evidence, use } from './WarehouseRetentionEvidence.testFixture'
import { WarehouseRetentionEvidence } from './WarehouseRetentionEvidence'

export function registerWarehouseRetentionEvidenceCases() {
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

  it('puts actual stat fit first and changes only the displayed purpose when another character is selected', async () => {
    const first = use('ben', 75)
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
}
