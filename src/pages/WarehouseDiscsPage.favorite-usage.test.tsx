import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import * as worldModule from '../application/accountDecisionWorld'
import type { WarehouseActionItem } from '../application/warehouseActionContract'
import { createEmptyRoster } from '../assault/catalog'
import { sampleDiscs } from '../evaluation/fixtures'
import { WarehouseDiscsPage } from './WarehouseDiscsPage'
import { WarehouseUsedAgents } from './WarehouseUsedAgents'
import { WarehouseActionDrawer } from './WarehouseActionDrawer'

const disc = { ...sampleDiscs.treasureCandidate, id: 'favorite-disc' }
function item(): WarehouseActionItem {
  return {
    disc,
    action: 'keep',
    retentionBasis: 'account_fit',
    recommendationState: 'current',
    reasons: [],
    statuses: [],
    compatibleAgentIds: [],
    usageAgentIds: [],
    affectedAgentIds: [],
    affectedPlans: [],
    affectedTeams: [],
    alternativeDiscIds: [],
  }
}

describe('warehouse favorite and actual usage presentation', () => {
  afterEach(() => vi.restoreAllMocks())
  it('renders each exact user once and omits an empty users list', () => {
    const { rerender } = render(<WarehouseUsedAgents agentIds={['agent-nicole', 'agent-nicole']} />)
    const list = screen.getByRole('list', { name: '使用角色' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(1)
    expect(within(list).getByRole('img', { name: /妮可/ })).toHaveAttribute(
      'data-visual-slot',
      'agent.square-avatar',
    )
    rerender(<WarehouseUsedAgents agentIds={[]} />)
    expect(screen.queryByRole('list', { name: '使用角色' })).not.toBeInTheDocument()
  })

  it('explains an old flat team reference without showing teammates as disc users', () => {
    render(
      <WarehouseActionDrawer
        item={{
          ...item(),
          affectedPlans: [{ id: 'old-team', name: '旧队伍方案', state: 'saved', active: false }],
          affectedTeams: [
            {
              candidateId: 'old-team',
              memberIds: ['agent-nicole', 'agent-billy', 'agent-anby'],
              status: 'needs_confirmation',
              decisionAuthority: null,
            },
          ],
        }}
        disc={disc}
        discs={[disc]}
        decisionLabel="建议保留"
        relations={['已保存方案使用']}
      />,
    )
    expect(screen.getByText('方案已引用，未记录具体分配代理人。')).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: '使用角色' })).not.toBeInTheDocument()
    const impact = screen.getByRole('heading', { name: '队伍影响' }).closest('section')!
    expect(impact).toHaveTextContent('妮可')
    expect(impact).toHaveTextContent('比利')
    expect(screen.getByText(/旧队伍方案/)).toBeInTheDocument()
  })

  it('omits retired favorite controls and keeps sorting in the filter bar', async () => {
    const other = { ...disc, id: 'ordinary-disc' }
    const actions = [
      item(),
      { ...item(), disc: other, retentionBasis: 'account_fit' as const, statuses: [], reasons: [] },
    ]
    vi.spyOn(worldModule, 'useAccountDecisionWorld').mockReturnValue({
      status: 'current',
      run: {
        warehouseActions: {
          state: 'current',
          actions,
          counts: { keep: 2, enhance: 0, cleanup: 0 },
        },
        input: {
          warehouse: {
            account: { id: 'isolated-favorite' },
            discs: [disc, other],
            roster: createEmptyRoster(),
          },
        },
      },
    } as never)
    const before = structuredClone(actions)
    render(
      <MemoryRouter>
        <WarehouseDiscsPage />
      </MemoryRouter>,
    )
    await userEvent.click(screen.getByText(/更多筛选/))
    expect(screen.queryByRole('combobox', { name: '收藏状态' })).not.toBeInTheDocument()
    for (const name of ['品质与保护', '核对状态', '用途范围'])
      expect(screen.queryByRole('combobox', { name })).not.toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: '等级/强化' })).toBeVisible()
    expect(screen.getByRole('combobox', { name: '方案使用' })).toBeVisible()
    expect(
      screen.getByRole('combobox', { name: '排序方式' }).closest('.warehouse-analysis-filters'),
    ).not.toBeNull()
    expect(screen.getByText('驱动盘 · 2 张')).toBeInTheDocument()
    await userEvent.click(screen.getByText(/更多筛选/))
    await userEvent.click(screen.getAllByRole('button', { name: /查看 .*详情，/ })[0]!)
    await userEvent.click(screen.getByRole('button', { name: /^继续观察/ }))
    expect(screen.getByText('驱动盘 · 0 张')).toBeInTheDocument()
    expect(screen.queryByText(/已暂时定位到当前排序中的第一张/)).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('combobox', { name: '排序方式' }))
    await userEvent.click(screen.getByRole('option', { name: '培养优先' }))
    expect(screen.getByRole('combobox', { name: '排序方式' })).toHaveValue('development')
    await userEvent.click(screen.getByRole('button', { name: '清除全部筛选' }))
    expect(screen.getByRole('combobox', { name: '排序方式' })).toHaveValue('catalog')
    expect(screen.getByText('驱动盘 · 2 张')).toBeInTheDocument()
    expect(actions).toEqual(before)
  })
})
