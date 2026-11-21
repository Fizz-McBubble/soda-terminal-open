import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import * as decisionWorld from '../application/accountDecisionWorld'
import { createEmptyRoster } from '../assault/catalog'
import { sampleDiscs } from '../evaluation/fixtures'
import { WarehouseDiscsPage } from './WarehouseDiscsPage'
import { choosePlayerSelect } from '../testing/choosePlayerSelect'
import { clearCatalogBrowseContexts } from '../components/assets/r6/useCatalogBrowseState'
import type { AccountPlanningDraft } from '../accounts/types'

function input(count = 80) {
  return {
    drafts: [] as AccountPlanningDraft[],
    activePlanIds: {},
    warehouse: {
      accountId: 'pending-account',
      account: { id: 'pending-account' },
      roster: createEmptyRoster(),
      discs: Array.from({ length: count }, (_, index) => ({
        ...sampleDiscs.treasureCandidate,
        id: `pending-${index}`,
        rarity: 'S' as const,
        slot: index % 2 ? 5 : 4,
        level: index % 2 ? 15 : 0,
      })),
    },
  }
}
afterEach(() => vi.restoreAllMocks())
beforeEach(clearCatalogBrowseContexts)
describe('warehouse factual inventory before analysis', () => {
  it('links the exact saved team associated with the incoming disc before analysis completes', () => {
    const liveInput = input(2)
    const plan: AccountPlanningDraft = {
      scopedId: 'pending-account:saved-team',
      accountId: 'pending-account',
      id: 'saved-team',
      kind: 'team',
      name: '仓库直达保存队伍',
      state: 'saved',
      selection: {
        agentIds: ['agent-miyabi', 'agent-lucy', 'agent-vivian'],
        bangbooId: null,
        scenario: '',
      },
      manualOverrides: {
        wEngineDirection: '',
        discDirection: '',
        progressionDirection: '',
        notes: '',
      },
      warehouseRefs: ['pending-1'],
      knowledgeRefs: [],
      comparisonCapability: 'direction',
      createdAt: '2026-11-21T00:00:00Z',
      updatedAt: '2026-11-21T00:00:00Z',
      revision: 1,
    }
    liveInput.drafts.push(plan, { ...plan, id: 'instead', warehouseRefs: ['pending-0'] })
    vi.spyOn(decisionWorld, 'useAccountDecisionWorld').mockReturnValue({
      status: 'loading',
      liveInput,
      refresh: vi.fn(),
    } as never)
    render(
      <MemoryRouter
        initialEntries={['/warehouse/discs?account=pending-account&selected=pending-1']}
      >
        <WarehouseDiscsPage />
      </MemoryRouter>,
    )
    const trigger = screen.getByRole('button', { name: '1 个关联方案' })
    const dialog = document.getElementById(trigger.getAttribute('popovertarget')!)!
    expect(dialog).toHaveAttribute('role', 'dialog')
    const links = within(dialog).getAllByRole('link', { hidden: true })
    expect(links).toHaveLength(1)
    expect(links[0]).toHaveAttribute('href', '/loadouts/plans/saved-team')
  })

  it('restores the account browse context after leaving, isolates other accounts and honors an explicit incoming disc', async () => {
    const a = input()
    a.warehouse.discs[3]!.level = 6
    const before = JSON.stringify(a)
    const spy = vi.spyOn(decisionWorld, 'useAccountDecisionWorld').mockReturnValue({
      status: 'loading',
      run: null,
      liveInput: a,
      refresh: vi.fn(),
    } as never)
    const mount = (path = '/warehouse/discs') =>
      render(
        <MemoryRouter initialEntries={[path]}>
          <WarehouseDiscsPage />
        </MemoryRouter>,
      )
    let view = mount()
    await choosePlayerSelect(screen.getByRole('combobox', { name: '号位' }), '5')
    const selected = document.querySelectorAll<HTMLButtonElement>('.warehouse-pending-row')[7]!
    const selectedLabel = selected.getAttribute('aria-label')
    fireEvent.click(selected)
    fireEvent.scroll(document.querySelector('.warehouse-action-list__body')!, {
      target: { scrollTop: 600 },
    })
    view.unmount()
    view = mount()
    expect(screen.getByRole('combobox', { name: '号位' })).toHaveValue('5')
    expect(document.querySelector('.warehouse-pending-row[aria-pressed="true"]')).toHaveAttribute(
      'aria-label',
      selectedLabel,
    )
    expect(document.querySelector('.warehouse-action-list__body')!.scrollTop).toBe(600)
    view.unmount()
    const b = {
      warehouse: { ...a.warehouse, accountId: 'other-account', account: { id: 'other-account' } },
    }
    spy.mockReturnValue({ status: 'loading', run: null, liveInput: b, refresh: vi.fn() } as never)
    view = mount()
    expect(screen.getByRole('combobox', { name: '号位' })).toHaveValue('')
    expect(document.querySelector('.warehouse-action-list__body')!.scrollTop).toBe(0)
    view.unmount()
    spy.mockReturnValue({ status: 'loading', run: null, liveInput: a, refresh: vi.fn() } as never)
    mount('/warehouse/discs?account=pending-account&selected=pending-3')
    expect(screen.getByRole('combobox', { name: '号位' })).toHaveValue('5')
    expect(document.querySelector('.warehouse-pending-detail')).toHaveTextContent('强化等级 +6')
    expect(JSON.stringify(a)).toBe(before)
  })

  it('shows active filter chips and clears only the requested condition', async () => {
    vi.spyOn(decisionWorld, 'useAccountDecisionWorld').mockReturnValue({
      status: 'loading',
      run: null,
      liveInput: input(),
      refresh: vi.fn(),
    } as never)
    render(
      <MemoryRouter>
        <WarehouseDiscsPage />
      </MemoryRouter>,
    )
    await choosePlayerSelect(screen.getByRole('combobox', { name: '号位' }), '5')
    await choosePlayerSelect(screen.getByRole('combobox', { name: '等级/强化' }), '15')
    expect(screen.getByRole('group', { name: '已启用的更多筛选' })).toHaveTextContent(
      '强化等级 +15',
    )
    fireEvent.click(screen.getByRole('button', { name: '取消强化等级 +15 筛选' }))
    expect(screen.getByRole('combobox', { name: '号位' })).toHaveValue('5')
    expect(screen.queryByRole('group', { name: '已启用的更多筛选' })).not.toBeInTheDocument()
  })
  it('shows bounded actual records and disabled unknown classifications; preserves filters and selection when results arrive', async () => {
    const liveInput = input()
    const refresh = vi.fn()
    const cancelCalculation = vi.fn()
    const spy = vi.spyOn(decisionWorld, 'useAccountDecisionWorld').mockReturnValue({
      status: 'loading',
      run: null,
      liveInput,
      refresh,
      calculation: { phase: 'analyzing', startedAt: Date.now() - 12000 },
      cancelCalculation,
    } as never)
    const view = render(
      <MemoryRouter>
        <WarehouseDiscsPage />
      </MemoryRouter>,
    )
    expect(screen.getByText('已读取 80 张 S 级驱动盘，建议待分析')).toBeInTheDocument()
    expect(document.querySelectorAll('.warehouse-pending-row')).toHaveLength(36)
    const summary = screen.getByRole('group', { name: '驱动盘建议' })
    expect(within(summary).getAllByText('待分析')).toHaveLength(3)
    expect(
      within(summary)
        .getAllByRole('button')
        .every((button) => button.hasAttribute('disabled')),
    ).toBe(true)
    expect(screen.getByRole('combobox', { name: '适用角色' })).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent('正在核对品质与用途 · 已等待 12 秒')
    await choosePlayerSelect(screen.getByRole('combobox', { name: '号位' }), '5')
    expect(screen.getByText('驱动盘 · 40 张')).toBeInTheDocument()
    const pendingRow = document.querySelector<HTMLButtonElement>('.warehouse-pending-row')!
    fireEvent.click(pendingRow)
    const selectedId = liveInput.warehouse.discs.find((disc) => disc.slot === 5)!.id
    const actions = liveInput.warehouse.discs.map((disc) => ({
      disc,
      action: 'keep',
      recommendationState: 'current',
      reasons: [],
      statuses: [],
      affectedAgentIds: [],
      compatibleAgentIds: [],
      usageAgentIds: [],
      affectedPlans: [],
      affectedTeams: [],
      alternativeDiscIds: [],
    }))
    spy.mockReturnValue({
      status: 'current',
      liveInput,
      refresh,
      run: {
        input: liveInput,
        warehouseActions: {
          state: 'current',
          actions,
          counts: { keep: 80, enhance: 0, cleanup: 0 },
        },
      },
    } as never)
    view.rerender(
      <MemoryRouter>
        <WarehouseDiscsPage />
      </MemoryRouter>,
    )
    expect(screen.getByRole('combobox', { name: '号位' })).toHaveValue('5')
    expect(screen.getByText('驱动盘 · 40 张')).toBeInTheDocument()
    expect(document.querySelector('.warehouse-action-row[aria-pressed="true"]')).toBeInTheDocument()
    expect(selectedId).toBe('pending-1')
    expect(screen.getByRole('combobox', { name: '适用角色' })).not.toBeDisabled()
  })
  it('supports keyboard End across the virtual window and resets the tab stop when factual filters change', async () => {
    vi.spyOn(decisionWorld, 'useAccountDecisionWorld').mockReturnValue({
      status: 'loading',
      run: null,
      liveInput: input(),
      refresh: vi.fn(),
    } as never)
    render(
      <MemoryRouter>
        <WarehouseDiscsPage />
      </MemoryRouter>,
    )
    const first = document.querySelector<HTMLButtonElement>('.warehouse-pending-row')!
    first.focus()
    fireEvent.keyDown(first, { key: 'End' })
    expect(document.activeElement).toHaveAttribute('data-row-index', '79')
    expect(document.querySelectorAll('.warehouse-pending-row')).toHaveLength(36)
    await choosePlayerSelect(screen.getByRole('combobox', { name: '号位' }), '5')
    const tabStop = document.querySelector<HTMLButtonElement>(
      '.warehouse-pending-row[tabindex="0"]',
    )!
    expect(tabStop).toHaveAttribute('data-row-index', '0')
    expect(document.querySelector('.warehouse-action-list__body')!.scrollTop).toBe(0)
    tabStop.focus()
    fireEvent.keyDown(tabStop, { key: 'End' })
    expect(document.activeElement).toHaveAttribute('data-row-index', '39')
  })
  it('allows cancellation and explicit retry without hiding the factual warehouse', () => {
    const liveInput = input(2)
    const refresh = vi.fn()
    const cancelCalculation = vi.fn()
    const spy = vi.spyOn(decisionWorld, 'useAccountDecisionWorld').mockReturnValue({
      status: 'loading',
      run: null,
      liveInput,
      refresh,
      calculation: { phase: 'preparing_rules', startedAt: null },
      cancelCalculation,
    } as never)
    const view = render(
      <MemoryRouter>
        <WarehouseDiscsPage />
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByRole('button', { name: '取消分析' }))
    expect(cancelCalculation).toHaveBeenCalledOnce()
    spy.mockReturnValue({
      status: 'loading',
      run: null,
      liveInput,
      refresh,
      calculation: null,
      calculationCancelled: true,
    } as never)
    view.rerender(
      <MemoryRouter>
        <WarehouseDiscsPage />
      </MemoryRouter>,
    )
    expect(screen.getByRole('status')).toHaveTextContent('分析已取消')
    expect(document.querySelectorAll('.warehouse-pending-row')).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: '重新分析' }))
    expect(refresh).toHaveBeenCalledOnce()
  })

  it.each([10, 80])(
    'transfers focus to the matching action row for %i discs on projection arrival without stealing filter focus',
    async (count) => {
      const liveInput = input(count)
      const refresh = vi.fn()
      const spy = vi.spyOn(decisionWorld, 'useAccountDecisionWorld').mockReturnValue({
        status: 'loading',
        run: null,
        liveInput,
        refresh,
      } as never)
      const view = render(
        <MemoryRouter>
          <WarehouseDiscsPage />
        </MemoryRouter>,
      )
      const pendingRows = document.querySelectorAll<HTMLButtonElement>('.warehouse-pending-row')
      expect(pendingRows.length).toBeGreaterThan(0)
      // Focus the second pending row
      const targetPendingRow = pendingRows[1]!
      targetPendingRow.focus()
      expect(document.activeElement).toBe(targetPendingRow)
      if (count === 80) fireEvent.keyDown(targetPendingRow, { key: 'End' })

      const actions = liveInput.warehouse.discs.map((disc) => ({
        disc,
        action: 'keep',
        recommendationState: 'current',
        reasons: [],
        statuses: [],
        affectedAgentIds: [],
        compatibleAgentIds: [],
        usageAgentIds: [],
        affectedPlans: [],
        affectedTeams: [],
        alternativeDiscIds: [],
      }))
      // Projection arrives
      spy.mockReturnValue({
        status: 'current',
        liveInput,
        refresh,
        run: {
          input: liveInput,
          warehouseActions: {
            state: 'current',
            actions,
            counts: { keep: 10, enhance: 0, cleanup: 0 },
          },
        },
      } as never)
      view.rerender(
        <MemoryRouter>
          <WarehouseDiscsPage />
        </MemoryRouter>,
      )

      // Focus should be smoothly transferred to the action row for the same disc (index 1)
      const activeRow = document.activeElement
      expect(activeRow).toHaveClass('warehouse-action-row')
      expect(activeRow).toHaveAttribute('data-row-index', count === 80 ? '79' : '1')

      // Now test that if focus is on a filter control, projection update does NOT steal focus
      const slotSelect = screen.getByRole('combobox', { name: '号位' })
      slotSelect.focus()
      expect(document.activeElement).toBe(slotSelect)

      // Re-render / update projection
      view.rerender(
        <MemoryRouter>
          <WarehouseDiscsPage />
        </MemoryRouter>,
      )
      expect(document.activeElement).toBe(slotSelect)
    },
  )

  it('renders virtual scroll notices outside warehouse-action-list__body to keep pure spacer offset', () => {
    const liveInput = input(10)
    const actions = liveInput.warehouse.discs.map((disc) => ({
      disc,
      action: 'keep',
      recommendationState: 'current',
      reasons: [],
      statuses: [],
      affectedAgentIds: [],
      compatibleAgentIds: [],
      usageAgentIds: [],
      affectedPlans: [],
      affectedTeams: [],
      alternativeDiscIds: [],
    }))
    vi.spyOn(decisionWorld, 'useAccountDecisionWorld').mockReturnValue({
      status: 'current',
      liveInput,
      refresh: vi.fn(),
      run: {
        input: liveInput,
        warehouseActions: {
          state: 'current',
          actions,
          counts: { keep: 10, enhance: 0, cleanup: 0 },
        },
      },
    } as never)
    render(
      <MemoryRouter
        initialEntries={['/warehouse/discs?account=pending-account&selected=non-existent-disc']}
      >
        <WarehouseDiscsPage />
      </MemoryRouter>,
    )

    const notice = screen.getByText('原选择已不在当前结果，已暂时定位到当前排序中的第一张。')
    expect(notice).toBeInTheDocument()
    const listBody = document.querySelector('.warehouse-action-list__body')!
    expect(listBody).toBeInTheDocument()
    // The notice must NOT be inside the scrollable body
    expect(listBody.contains(notice)).toBe(false)
    // The spacer must be the first child inside listBody
    expect(listBody.firstElementChild).toHaveClass('warehouse-action-list__spacer')
  })
})
