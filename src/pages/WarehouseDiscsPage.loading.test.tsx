import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import * as decisionWorld from '../application/accountDecisionWorld'
import { createEmptyRoster } from '../assault/catalog'
import { sampleDiscs } from '../evaluation/fixtures'
import { WarehouseDiscsPage } from './WarehouseDiscsPage'
import { choosePlayerSelect } from '../testing/choosePlayerSelect'

function input(count = 80) {
  return {
    warehouse: {
      accountId: 'pending-account',
      account: { id: 'pending-account' },
      roster: createEmptyRoster(),
      discs: Array.from({ length: count }, (_, index) => ({
        ...sampleDiscs.treasureCandidate,
        id: `pending-${index}`,
        slot: index % 2 ? 5 : 4,
        level: index % 2 ? 15 : 0,
      })),
    },
  }
}
afterEach(() => vi.restoreAllMocks())
describe('warehouse factual inventory before analysis', () => {
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
    expect(screen.getByText('已读取 80 张驱动盘，建议待分析。')).toBeInTheDocument()
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
