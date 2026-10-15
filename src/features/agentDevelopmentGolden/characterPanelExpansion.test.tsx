import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { workbench } from './AgentDevelopmentGolden.workbench.testFixture'
import { WorkbenchPanelSnapshot } from './WorkbenchPanelSnapshot'
import { Top10StatTable } from './Top10StatTable'
import type { GoldenTop10Data, LoadoutRow } from './types'

const baseline: LoadoutRow = {
  rank: 0,
  label: '当前实装',
  fit: '',
  panel: '',
  sets: '',
  effective: '',
  swaps: 0,
  conflict: '',
  cost: '',
  staticDps: null,
  statDeltaSummary: '',
  finalStats: { pen: 18, fireDamageBonus: 0, iceDamageBonus: 0 },
}
const comparison: GoldenTop10Data = {
  panelScopeKey: 'account-a:agent-a',
  agentName: '代理人',
  baseline,
  candidates: [],
  discs: [],
  coreStats: [],
  statPresentation: 'static_panel',
  allStats: [
    { key: 'pen', label: '穿透值', unit: '', highlight: false },
    { key: 'fireDamageBonus', label: '火属性伤害加成', unit: '%', highlight: false, detail: true },
    { key: 'iceDamageBonus', label: '冰属性伤害加成', unit: '%', highlight: false, detail: true },
    { key: 'maxEnergy', label: '能量上限', unit: '', highlight: false, detail: true },
  ],
}

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  )
})
afterEach(() => vi.unstubAllGlobals())

function openPopover(panel: HTMLElement) {
  const toggle = new Event('toggle')
  Object.defineProperty(toggle, 'newState', { value: 'open' })
  fireEvent(panel, toggle)
}

function valuesFor(table: HTMLElement, label: string) {
  const row = within(table)
    .getByRole('cell', { name: label, hidden: true })
    .closest('[role="row"]')!
  return within(row as HTMLElement)
    .getAllByRole('cell', { hidden: true })
    .map((cell) => cell.textContent)
}

describe('character panel local popovers', () => {
  it('keeps detail rows outside the summary grid and preserves graduation placement', () => {
    const subject = {
      ...workbench,
      panelScopeKey: 'a:agent',
      panelFacts: [
        { key: 'pen', name: '穿透值', value: '18', focus: true },
        { key: 'maxEnergy', name: '能量上限', value: '—', detail: true },
      ],
    }
    const { rerender, container } = render(<WorkbenchPanelSnapshot subject={subject} />)
    const grid = container.querySelector('.stat-grid')!
    const graduation = container.querySelector('.panel-graduation-targets')!
    const panel = container.querySelector('.character-panel-more [popover]') as HTMLElement
    expect(grid).toHaveTextContent('穿透值')
    expect(grid).not.toHaveTextContent('能量上限')
    expect(panel).toHaveAttribute('popover', 'auto')
    expect(panel).toHaveAttribute('aria-label', '角色完整面板')
    expect(panel.querySelector('[popovertargetaction="hide"]')).toHaveAttribute(
      'aria-label',
      '关闭完整面板',
    )
    const trigger = screen.getByRole('button', { name: '查看完整面板' })
    expect(trigger).toHaveAttribute('popovertarget', panel.id)
    openPopover(panel)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(within(panel).getByText('能量上限')).toBeInTheDocument()
    expect(within(panel).getByText('穿透值')).toBeInTheDocument()
    expect(within(panel).getByText('穿透值').closest('div')).toHaveClass('focus')
    expect(within(grid as HTMLElement).getByText('穿透值').closest('div')).toHaveClass('focus')
    expect(container.querySelector('.stat-grid')).toBe(grid)
    expect(grid.children).toHaveLength(1)
    expect(container.querySelector('.panel-graduation-targets')).toBe(graduation)
    rerender(<WorkbenchPanelSnapshot subject={{ ...subject, panelScopeKey: 'b:agent' }} />)
    expect(container.querySelector('.character-panel-more [popover]')).not.toBe(panel)
    expect(screen.getByRole('button', { name: '查看完整面板' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
    rerender(<WorkbenchPanelSnapshot subject={subject} />)
    expect(screen.getByRole('button', { name: '查看完整面板' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
  })

  it('retains the comparison baseline, changed detail rows, and unknown values in a local table', () => {
    const selected = {
      ...baseline,
      rank: 1,
      finalStats: { pen: 27, fireDamageBonus: 30, iceDamageBonus: 0 },
    }
    const props = { data: comparison, baselineAvailable: true, baselineLabel: '当前实装' }
    const { rerender, container } = render(<Top10StatTable {...props} selectedRow={selected} />)
    const mainTable = screen.getByRole('table', { name: '属性对比' })
    expect(valuesFor(mainTable, '火属性伤害加成')).toEqual(['火属性伤害加成', '0%', '+30%', '30%'])
    expect(
      within(mainTable).queryByRole('cell', { name: '冰属性伤害加成' }),
    ).not.toBeInTheDocument()
    const panel = container.querySelector('.character-panel-more [popover]') as HTMLElement
    expect(panel).toHaveAttribute('aria-label', '完整属性对比')
    openPopover(panel)
    // JSDOM does not open native popovers; role checks here cover DOM semantics.
    const detailTable = within(panel).getByRole('table', { name: '完整属性对比', hidden: true })
    expect(valuesFor(detailTable, '穿透值')).toEqual(['穿透值', '18', '+9', '27'])
    expect(valuesFor(detailTable, '能量上限')).toEqual(['能量上限', '—', '—', '—'])
    expect(valuesFor(detailTable, '火属性伤害加成')).toEqual([
      '火属性伤害加成',
      '0%',
      '+30%',
      '30%',
    ])
    expect(within(mainTable).queryByRole('cell', { name: '能量上限' })).not.toBeInTheDocument()
    rerender(
      <Top10StatTable
        {...props}
        selectedRow={{ ...selected, rank: 2, finalStats: { pen: 36, fireDamageBonus: 0 } }}
      />,
    )
    expect(valuesFor(mainTable, '穿透值')).toEqual(['穿透值', '18', '+18', '36'])
    expect(screen.getByRole('button', { name: '查看完整面板' })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    rerender(
      <Top10StatTable
        {...props}
        data={{ ...comparison, panelScopeKey: 'account-b:agent-a' }}
        selectedRow={baseline}
      />,
    )
    expect(container.querySelector('.character-panel-more [popover]')).not.toBe(panel)
    expect(screen.getByRole('button', { name: '查看完整面板' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
    rerender(<Top10StatTable {...props} selectedRow={selected} />)
    expect(screen.getByRole('button', { name: '查看完整面板' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
  })

  it('marks priority and changed rows in the complete comparison without changing values', () => {
    const { container } = render(<Top10StatTable
      data={{ ...comparison, allStats: comparison.allStats.map((stat) => ({ ...stat, highlight: stat.key === 'pen' })) }}
      selectedRow={{ ...baseline, rank: 1, finalStats: { ...baseline.finalStats, pen: 27 } }}
      baselineAvailable baselineLabel="当前实装"
    />)
    const panel = container.querySelector('.character-panel-more [popover]') as HTMLElement
    const cell = within(panel).getByRole('cell', { name: '穿透值', hidden: true })
    const row = cell.closest('[role="row"]')!
    expect(row).toHaveClass('is-priority', 'is-changed')
    expect(within(row as HTMLElement).getAllByRole('cell', { hidden: true }).slice(1).map((item) => item.textContent)).toEqual(['18', '+9', '27'])
  })

  it('preserves all rows and zero totals in disc contribution mode', () => {
    render(
      <Top10StatTable
        data={{ ...comparison, statPresentation: 'disc_contribution' }}
        selectedRow={baseline}
        baselineAvailable
        baselineLabel="当前实装"
      />,
    )
    expect(screen.getByText('六张驱动盘的副词条合计，不含主词条和套装效果。')).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: '冰属性伤害加成' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '查看完整面板' })).not.toBeInTheDocument()
  })
})
