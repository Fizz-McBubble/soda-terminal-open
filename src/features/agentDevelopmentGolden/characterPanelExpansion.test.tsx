import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { workbench } from './AgentDevelopmentGolden.workbench.testFixture'
import { WorkbenchPanelSnapshot } from './WorkbenchPanelSnapshot'
import { Top10StatTable } from './Top10StatTable'
import type { GoldenTop10Data, LoadoutRow } from './types'
import { createEmptyRoster } from '../../assault/catalog'
import {
  developmentCommittedCurrentDisplay,
  developmentCommittedCurrentDisplayFailure,
} from '../../pages/developmentCommittedCurrentDisplay'
import type { DevelopmentWorkbenchRoutePresentation } from '../../application/publicDevelopmentWorkbenchRoute'

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
    {
      key: 'maxEnergy',
      label: '能量上限',
      unit: '',
      highlight: false,
      detail: true,
      group: 'resource',
    },
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

describe('character panel local disclosures', () => {
  it('retains hidden natural panel structure while saved facts are pending, then replaces it with settled facts', () => {
    const agent = createEmptyRoster().agents[0]!
    const subject = {
      ...workbench,
      panelFacts: [
        { name: '攻击力', value: '1234' },
        { name: '能量上限', value: '120', detail: true },
      ],
    }
    const view = render(<WorkbenchPanelSnapshot subject={subject} />)
    const originalGrid = view.container.querySelector('.stat-grid')!
    const pending = developmentCommittedCurrentDisplay(subject, agent)
    view.rerender(<WorkbenchPanelSnapshot subject={pending} />)
    expect(view.container.querySelector('.stat-grid')).toBe(originalGrid)
    expect(originalGrid).toHaveAttribute('aria-hidden', 'true')
    expect(originalGrid).toHaveClass('panel-snapshot__placeholder')
    expect(screen.getByRole('status')).toHaveTextContent('正在更新当前面板')
    expect(screen.queryByRole('button', { name: '查看完整面板' })).not.toBeInTheDocument()
    expect(view.container.querySelector('.panel-snapshot')).toHaveAttribute('aria-busy', 'true')
    const route = {
      panel: null,
      workbench: {
        slices: {
          currentPanel: {
            availability: 'available',
            facts: [{ label: '攻击力', current: '2345' }],
          },
        },
      },
    } as unknown as DevelopmentWorkbenchRoutePresentation
    const settled = developmentCommittedCurrentDisplay(pending, agent, route)
    view.rerender(<WorkbenchPanelSnapshot subject={settled} />)
    expect(view.container.querySelector('.stat-grid')).not.toHaveAttribute('aria-hidden')
    expect(view.container.querySelector('.stat-grid')).toHaveTextContent('2345')
    expect(view.container.querySelector('.stat-grid')).not.toHaveTextContent('1234')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(view.container.querySelector('.panel-snapshot')).toHaveAttribute('aria-busy', 'false')
    expect(developmentCommittedCurrentDisplayFailure(settled)).toBe(settled)
  })

  it('retains an unavailable panel placeholder through failure and permits a fresh update', () => {
    const agent = createEmptyRoster().agents[0]!
    const before = {
      ...workbench,
      currentPanel: {
        availability: 'unavailable' as const,
        summary: '音擎突破未确认，请补充当前资料。',
      },
    }
    const pending = developmentCommittedCurrentDisplay(before, agent)
    const failed = developmentCommittedCurrentDisplayFailure(pending)
    const view = render(<WorkbenchPanelSnapshot subject={failed} />)
    expect(view.container.querySelector('.panel-snapshot')).toHaveAttribute('aria-busy', 'false')
    expect(screen.getByRole('status')).toHaveTextContent('更新失败')
    expect(view.container.querySelector('.panel-snapshot__unavailable')).toHaveTextContent(
      before.currentPanel.summary,
    )
    expect(view.container.querySelector('.panel-snapshot__unavailable')).toHaveAttribute(
      'aria-hidden',
      'true',
    )
    const retry = developmentCommittedCurrentDisplay(failed, agent)
    expect(retry.currentPanel.refreshState).toBe('updating')
    expect(retry.currentPanel.refreshPlaceholderSummary).toBe(before.currentPanel.summary)
    view.rerender(<WorkbenchPanelSnapshot subject={retry} />)
    expect(screen.getByRole('status')).toHaveTextContent('正在更新')
  })
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
    expect(
      within(grid as HTMLElement)
        .getByText('穿透值')
        .closest('div'),
    ).toHaveClass('focus')
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

  it('keeps inline details across schemes and resets for another account or agent', () => {
    const selected = {
      ...baseline,
      rank: 1,
      finalStats: { pen: 27, fireDamageBonus: 30, iceDamageBonus: 0 },
    }
    const props = { data: comparison, baselineAvailable: true, baselineLabel: '当前实装' }
    const before = JSON.stringify({ comparison, selected })
    const { rerender, container } = render(<Top10StatTable {...props} selectedRow={selected} />)
    const mainTable = screen.getByRole('table', { name: '属性对比' })
    expect(valuesFor(mainTable, '火属性伤害加成')).toEqual(['火属性伤害加成', '0%', '+30%', '30%'])
    expect(
      within(mainTable).queryByRole('cell', { name: '冰属性伤害加成' }),
    ).not.toBeInTheDocument()
    const trigger = screen.getByRole('button', { name: '查看完整面板' })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    trigger.focus()
    fireEvent.click(trigger)
    const panel = screen.getByRole('region', { name: '完整属性对比' })
    expect(trigger).toHaveAttribute('aria-controls', panel.id)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(trigger).toHaveFocus()
    expect(container.querySelector('[popover]')).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    const detailTable = within(panel).getByRole('table', { name: '资源与循环对比' })
    expect(valuesFor(detailTable, '能量上限')).toEqual(['能量上限', '—', '—', '—'])
    expect(within(panel).queryByRole('cell', { name: '穿透值' })).not.toBeInTheDocument()
    expect(within(panel).queryByRole('cell', { name: '火属性伤害加成' })).not.toBeInTheDocument()
    expect(within(panel).queryByRole('cell', { name: '冰属性伤害加成' })).not.toBeInTheDocument()
    expect(within(mainTable).queryByRole('cell', { name: '能量上限' })).not.toBeInTheDocument()
    fireEvent.click(trigger)
    expect(panel).not.toBeVisible()
    expect(trigger).toHaveFocus()
    fireEvent.click(trigger)
    expect(JSON.stringify({ comparison, selected })).toBe(before)
    rerender(
      <Top10StatTable
        {...props}
        selectedRow={{ ...selected, rank: 2, finalStats: { pen: 36, fireDamageBonus: 0 } }}
      />,
    )
    expect(valuesFor(screen.getByRole('table', { name: '属性对比' }), '穿透值')).toEqual([
      '穿透值',
      '18',
      '+18',
      '36',
    ])
    expect(screen.getByRole('button', { name: '收起完整面板' })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    expect(screen.getByRole('region', { name: '完整属性对比' })).toBe(panel)
    fireEvent.click(screen.getByRole('button', { name: '收起完整面板' }))
    rerender(<Top10StatTable {...props} selectedRow={selected} />)
    expect(screen.getByRole('button', { name: '查看完整面板' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
    fireEvent.click(screen.getByRole('button', { name: '查看完整面板' }))
    rerender(
      <Top10StatTable
        {...props}
        data={{ ...comparison, panelScopeKey: 'account-b:agent-a' }}
        selectedRow={baseline}
      />,
    )
    expect(screen.queryByRole('region', { name: '完整属性对比' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '查看完整面板' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
    fireEvent.click(screen.getByRole('button', { name: '查看完整面板' }))
    rerender(
      <Top10StatTable
        {...props}
        data={{ ...comparison, panelScopeKey: 'account-b:agent-b' }}
        selectedRow={selected}
      />,
    )
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

  it('marks priority and changed rows in the summary without duplicating them in details', () => {
    const { container } = render(
      <Top10StatTable
        data={{
          ...comparison,
          allStats: comparison.allStats.map((stat) => ({ ...stat, highlight: stat.key === 'pen' })),
        }}
        selectedRow={{ ...baseline, rank: 1, finalStats: { ...baseline.finalStats, pen: 27 } }}
        baselineAvailable
        baselineLabel="当前实装"
      />,
    )
    const table = within(container).getByRole('table', { name: '属性对比' })
    const cell = within(table).getByRole('cell', { name: '穿透值' })
    const row = cell.closest('[role="row"]')!
    expect(row).toHaveClass('is-priority', 'is-changed')
    expect(
      within(row as HTMLElement)
        .getAllByRole('cell', { hidden: true })
        .slice(1)
        .map((item) => item.textContent),
    ).toEqual(['18', '+9', '27'])
    fireEvent.click(screen.getByRole('button', { name: '查看完整面板' }))
    expect(
      within(screen.getByRole('region', { name: '完整属性对比' })).queryByRole('cell', {
        name: '穿透值',
      }),
    ).not.toBeInTheDocument()
  })

  it('groups supplementary fields and resources, keeping expansion across baseline and disc changes', () => {
    const data: GoldenTop10Data = {
      ...comparison,
      baseline: { ...baseline, finalStats: { ...baseline.finalStats, iceDamageBonus: 10 } },
    }
    const selected: LoadoutRow = {
      ...data.baseline,
      rank: 1,
      discIds: [
        'scheme-disc-1',
        'scheme-disc-2',
        'scheme-disc-3',
        'scheme-disc-4',
        'scheme-disc-5',
        'scheme-disc-6',
      ],
    }
    const differentScheme: LoadoutRow = {
      ...selected,
      discIds: [
        'scheme-disc-1',
        'scheme-disc-2',
        'scheme-disc-3',
        'scheme-disc-4',
        'scheme-disc-5',
        'replacement-disc-6',
      ],
    }
    const { rerender } = render(
      <Top10StatTable
        data={data}
        selectedRow={selected}
        baselineAvailable
        baselineLabel="当前实装"
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: '查看完整面板' }))
    const panel = screen.getByRole('region', { name: '完整属性对比' })
    expect(
      valuesFor(within(panel).getByRole('table', { name: '辅助属性对比' }), '冰属性伤害加成'),
    ).toEqual(['冰属性伤害加成', '10%', '—', '10%'])
    expect(within(panel).getByRole('heading', { name: '资源与循环' })).toBeInTheDocument()
    expect(within(panel).queryByRole('cell', { name: '火属性伤害加成' })).not.toBeInTheDocument()
    rerender(
      <Top10StatTable
        data={data}
        selectedRow={selected}
        baselineAvailable
        baselineLabel="另一比较方案"
      />,
    )
    expect(screen.getByRole('button', { name: '收起完整面板' })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    rerender(
      <Top10StatTable
        data={data}
        selectedRow={differentScheme}
        baselineAvailable
        baselineLabel="另一比较方案"
      />,
    )
    expect(screen.getByRole('button', { name: '收起完整面板' })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    expect(screen.getByRole('region', { name: '完整属性对比' })).toBe(panel)
    rerender(
      <Top10StatTable
        data={{ ...data, baseline: { ...data.baseline, discIds: differentScheme.discIds } }}
        selectedRow={differentScheme}
        baselineAvailable={false}
        baselineLabel="未记录当前六盘"
      />,
    )
    expect(screen.getByRole('button', { name: '收起完整面板' })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    expect(
      within(screen.getByRole('region', { name: '完整属性对比' }))
        .getByRole('table', { name: '资源与循环对比' })
        .querySelectorAll('[role="columnheader"]'),
    ).toHaveLength(2)
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

  it('keeps the title without empty expansion and ignores an unavailable baseline when choosing extra rows', () => {
    render(
      <Top10StatTable
        data={{
          ...comparison,
          baseline: { ...baseline, finalStats: { ...baseline.finalStats, iceDamageBonus: 20 } },
          allStats: comparison.allStats.filter((stat) => stat.key !== 'maxEnergy'),
        }}
        selectedRow={baseline}
        baselineAvailable={false}
        baselineLabel="未记录当前六盘"
      />,
    )
    expect(screen.getByRole('heading', { name: '属性对比' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '查看完整面板' })).not.toBeInTheDocument()
    const table = screen.getByRole('table', { name: '属性对比' })
    expect(valuesFor(table, '穿透值')).toEqual(['穿透值', '18'])
    expect(within(table).queryByRole('cell', { name: '冰属性伤害加成' })).not.toBeInTheDocument()
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((cell) => cell.textContent),
    ).toEqual(['属性', '方案', '属性', '方案'])
  })
})
