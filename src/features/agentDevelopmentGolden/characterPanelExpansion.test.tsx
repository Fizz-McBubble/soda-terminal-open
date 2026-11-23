import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { workbench } from './AgentDevelopmentGolden.workbench.testFixture'
import { WorkbenchPanelSnapshot } from './WorkbenchPanelSnapshot'
import { Top10StatTable } from './Top10StatTable'
import type { GoldenTop10Data, LoadoutRow } from './types'
import { createEmptyRoster } from '../../assault/catalog'
import {
  developmentAnalysisRecoveryDisplay,
  developmentCommittedCurrentDisplay,
  developmentCommittedCurrentDisplayFailure,
} from '../../pages/developmentCommittedCurrentDisplay'
import type { DevelopmentWorkbenchRoutePresentation } from '../../application/publicDevelopmentWorkbenchRoute'
import { finiteComparisonPanelStats } from '../../pages/agentLoadoutComparisonPanelValues'

const baseline: LoadoutRow = {
  rank: 0,
  label: '当前装备',
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

function valuesFor(table: HTMLElement, label: string) {
  const row = within(table)
    .getByRole('cell', { name: label, hidden: true })
    .closest('[role="row"]')!
  return within(row as HTMLElement)
    .getAllByRole('cell', { hidden: true })
    .map((cell) => cell.textContent)
}

describe('character panel local disclosures', () => {
  it('shows a cultivation target only when the prioritized stat has a displayable target', () => {
    const stat = { key: 'pen', label: '穿透值', unit: '' as const, highlight: true }
    const makeData = (target: string | undefined) => ({
      ...comparison,
      allStats: [{ ...stat, target }],
    })
    const selected = { ...baseline, rank: 1, finalStats: { pen: 0 } }
    const { rerender } = render(
      <Top10StatTable
        data={makeData(undefined)}
        selectedRow={selected}
        baselineAvailable
        baselineLabel="当前装备"
      />,
    )
    for (const target of [undefined, null, '', '   ', '100（可选）'] as const) {
      rerender(
        <Top10StatTable
          data={makeData(target as string | undefined)}
          selectedRow={selected}
          baselineAvailable
          baselineLabel="当前装备"
        />,
      )
      const cell = screen.getByRole('cell', { name: '穿透值' })
      expect(cell).not.toHaveTextContent('培养目标')
      expect(cell.closest('[role="row"]')).toHaveClass('is-priority')
    }
    rerender(
      <Top10StatTable
        data={makeData('0')}
        selectedRow={selected}
        baselineAvailable
        baselineLabel="当前装备"
      />,
    )
    expect(screen.getByRole('cell', { name: '穿透值' })).toHaveTextContent('培养目标 0')
    rerender(
      <Top10StatTable
        data={makeData('30+')}
        selectedRow={selected}
        baselineAvailable
        baselineLabel="当前装备"
      />,
    )
    expect(screen.getByRole('cell', { name: '穿透值' })).toHaveTextContent('培养目标 30+')
  })
  it.each([
    ['agent-claret', 'sharpEnergyGenerationRate', '锐能获得效率'],
    ['agent-starlight-billy', 'adrenalineGenerationRate', '闪能获得效率'],
    ['agent-banyue', 'adrenalineGenerationRate', '闪能获得效率'],
    ['agent-yidhari', 'adrenalineGenerationRate', '闪能获得效率'],
    ['agent-manato', 'adrenalineGenerationRate', '闪能获得效率'],
  ])(
    'omits unsupported special resource efficiency for %s without hiding other unknown fields',
    (agentId, key, name) => {
      const capacity =
        agentId === 'agent-claret'
          ? { key: 'maxSharpEnergy', name: '锐能上限' }
          : { key: 'maxAdrenaline', name: '闪能最大值' }
      const source = { key, name, value: '—' }
      const subject = {
        ...workbench,
        agentId,
        panelFacts: [source, { ...capacity, value: '—' }],
      }
      const { container } = render(<WorkbenchPanelSnapshot subject={subject} />)
      const full = container.querySelector('.panel-snapshot__full-grid')!
      expect(within(full as HTMLElement).queryByText(name)).not.toBeInTheDocument()
      expect(full).toHaveTextContent(`${capacity.name}—`)
      expect(container.querySelector('.stat-grid')!.children).toHaveLength(10)
      expect(subject.panelFacts[0]).toBe(source)
      expect(source.value).toBe('—')
    },
  )

  it.each([
    ['agent-yixuan', 'adrenalineGenerationRate', '闪能获得效率', 0],
    ['agent-yixuan', 'adrenalineGenerationRate', '闪能获得效率', 25],
    ['agent-claret', 'sharpEnergyGenerationRate', '锐能获得效率', 0],
    ['agent-claret', 'sharpEnergyGenerationRate', '锐能获得效率', 25],
  ] as const)('retains supported %s %s (%s) at %s%%', (agentId, key, name, value) => {
    const { container } = render(
      <WorkbenchPanelSnapshot
        subject={{
          ...workbench,
          agentId,
          panelFacts: [
            {
              key,
              name,
              value: `${value}%`,
              currentValue: value,
            },
          ],
        }}
      />,
    )
    expect(container.querySelector('.panel-snapshot__full-grid')).toHaveTextContent(
      `${name}${value}%`,
    )
  })

  it('keeps the game ten fields fixed and complete attributes in one disclosure with distinct resources', () => {
    const subject = {
      ...workbench,
      panelFacts: [
        { key: 'atk', name: '攻击力', value: '1234' },
        {
          key: 'energyGenerationRate',
          name: '能量获得效率',
          value: '0%',
          currentValue: 100,
          detail: true,
          group: 'resource' as const,
        },
        {
          key: 'maxEnergy',
          name: '能量上限',
          value: '—',
          currentValue: undefined,
          detail: true,
          group: 'resource' as const,
        },
        {
          key: 'maxSharpEnergy',
          name: '锐能上限',
          value: '120',
          currentValue: 120,
          detail: true,
          group: 'resource' as const,
        },
      ],
    }
    const { container, rerender } = render(<WorkbenchPanelSnapshot subject={subject} />)
    const grid = container.querySelector('.stat-grid')!
    expect(grid).not.toHaveTextContent('能量获得效率')
    expect(grid).not.toHaveTextContent('能量上限')
    const details = container.querySelector('.panel-snapshot__full-grid')!
    expect(details).toHaveTextContent('能量获得效率0%')
    expect(details).toHaveTextContent('能量上限—')
    expect(details.closest('[popover]')).toHaveAttribute('popover', 'auto')
    expect(screen.getByRole('button', { name: '完整属性' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
    expect(grid.children).toHaveLength(10)
    expect(grid).not.toHaveTextContent('锐能上限')
    rerender(<WorkbenchPanelSnapshot subject={{ ...subject, agentId: 'agent-claret' }} />)
    expect(container.querySelector('.panel-snapshot__full-grid')).toHaveTextContent('锐能上限120')
    expect(container.querySelector('.panel-snapshot__full-grid')).not.toHaveTextContent(
      '能量获得效率',
    )
    expect(screen.queryByRole('button', { name: '查看完整面板' })).not.toBeInTheDocument()
  })

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
    expect(originalGrid).not.toHaveAttribute('aria-hidden')
    expect(originalGrid).not.toHaveClass('panel-snapshot__placeholder')
    expect(originalGrid).toHaveTextContent('1234')
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
    expect(screen.getByRole('alert')).toHaveTextContent('暂未更新')
    const grid = view.container.querySelector('.panel-snapshot__main-grid')!
    expect(grid.children).toHaveLength(10)
    expect([...grid.querySelectorAll('dd')].every((value) => value.textContent === '—')).toBe(true)
    expect(screen.getByRole('button', { name: '完整属性' })).toBeDisabled()
    const retry = developmentCommittedCurrentDisplay(failed, agent)
    expect(retry.currentPanel.refreshState).toBe('updating')
    expect(retry.currentPanel.refreshPlaceholderSummary).toBe(before.currentPanel.summary)
    view.rerender(<WorkbenchPanelSnapshot subject={retry} />)
    expect(screen.getByRole('status')).toHaveTextContent('正在更新')
  })

  it('keeps the last numerical panel visible while a stale account analysis recovers', () => {
    const pending = developmentAnalysisRecoveryDisplay(workbench, 'updating')
    const view = render(<WorkbenchPanelSnapshot subject={pending} />)
    const grid = view.container.querySelector('.stat-grid')!
    expect(grid).not.toHaveAttribute('aria-hidden')
    expect(grid.textContent).not.toBe('')
    expect(screen.getByRole('status')).toHaveTextContent('正在按最新账户资料更新当前面板')
    expect(view.container.querySelector('.panel-snapshot')).toHaveAttribute('aria-busy', 'true')

    const failed = developmentAnalysisRecoveryDisplay(workbench, 'failed')
    view.rerender(<WorkbenchPanelSnapshot subject={failed} />)
    expect(view.container.querySelector('.stat-grid')).toBe(grid)
    expect(screen.getByRole('alert')).toHaveTextContent('已保留上次结果')
    expect(view.container.querySelector('.panel-snapshot')).toHaveAttribute('aria-busy', 'false')
  })
  it('shows resource details once and preserves graduation placement', () => {
    const subject = {
      ...workbench,
      panelFacts: [
        { key: 'pen', name: '穿透值', value: '18', focus: true },
        { key: 'maxEnergy', name: '能量上限', value: '—', detail: true },
      ],
    }
    const { container } = render(<WorkbenchPanelSnapshot subject={subject} />)
    const grid = container.querySelector('.stat-grid')!
    const full = container.querySelector('.panel-snapshot__full-grid')!
    expect(full).toHaveTextContent('能量上限—')
    expect(
      within(full as HTMLElement)
        .getByText('穿透值')
        .closest('div'),
    ).toHaveClass('focus')
    expect(grid.children).toHaveLength(10)
    expect(container.querySelector('.panel-graduation-targets')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '查看完整面板' })).not.toBeInTheDocument()
  })

  it('closes old complete attributes when the panel or target context changes', () => {
    const subject = {
      ...workbench,
      panelFacts: [{ key: 'energyRegen', name: '能量自动回复', value: '1.92', currentValue: 1.92 }],
    }
    const view = render(<WorkbenchPanelSnapshot subject={subject} />)
    const button = screen.getByRole('button', { name: '完整属性' })
    const popup = document.getElementById(button.getAttribute('popovertarget')!)!
    const event = new Event('toggle')
    Object.defineProperty(event, 'newState', { value: 'open' })
    fireEvent(popup, event)
    expect(button).toHaveAttribute('aria-expanded', 'true')
    view.rerender(
      <WorkbenchPanelSnapshot
        subject={{
          ...subject,
          graduation: { ...subject.graduation, panel: [{ name: '攻击力', value: '2500' }] },
        }}
      />,
    )
    expect(screen.getByRole('button', { name: '完整属性' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
    expect(view.container.querySelector('.panel-snapshot__main-grid')).toHaveTextContent(
      '能量自动回复1.92',
    )
  })

  it('keeps menu precision and resource-efficiency basis consistent in compared totals and differences', () => {
    const data = {
      ...comparison,
      baseline: { ...baseline, finalStats: { energyRegen: 1.92, energyGenerationRate: 100 } },
      allStats: [
        { key: 'energyRegen', label: '能量自动回复', unit: '' as const, highlight: false },
        {
          key: 'energyGenerationRate',
          label: '能量获得效率',
          unit: '%' as const,
          highlight: false,
        },
      ],
    }
    render(
      <Top10StatTable
        data={data}
        selectedRow={{
          ...baseline,
          rank: 1,
          finalStats: { energyRegen: 2.34, energyGenerationRate: 120 },
        }}
        baselineAvailable
        baselineLabel="当前装备"
      />,
    )
    const table = screen.getByRole('table', { name: '属性对比' })
    expect(valuesFor(table, '能量自动回复')).toEqual(['能量自动回复', '1.92', '+0.42', '2.34'])
    expect(valuesFor(table, '能量获得效率')).toEqual(['能量获得效率', '0%', '+20%', '20%'])
    expect(data.baseline.finalStats.energyGenerationRate).toBe(100)
  })

  it('keeps resource values and changed attributes visible across schemes and account changes', () => {
    const selected = {
      ...baseline,
      rank: 1,
      finalStats: { pen: 27, fireDamageBonus: 30, iceDamageBonus: 0 },
    }
    const props = { data: comparison, baselineAvailable: true, baselineLabel: '当前装备' }
    const before = JSON.stringify({ comparison, selected })
    const { rerender } = render(<Top10StatTable {...props} selectedRow={selected} />)
    let table = screen.getByRole('table', { name: '属性对比' })
    expect(valuesFor(table, '火属性伤害加成')).toEqual(['火属性伤害加成', '0%', '+30%', '30%'])
    expect(valuesFor(table, '能量上限')).toEqual(['能量上限', '—', '—', '—'])
    expect(within(table).queryByRole('cell', { name: '冰属性伤害加成' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '查看完整面板' })).not.toBeInTheDocument()
    rerender(
      <Top10StatTable
        {...props}
        selectedRow={{ ...selected, rank: 2, finalStats: { pen: 36, fireDamageBonus: 0 } }}
      />,
    )
    table = screen.getByRole('table', { name: '属性对比' })
    expect(valuesFor(table, '穿透值')).toEqual(['穿透值', '18', '+18', '36'])
    rerender(
      <Top10StatTable
        {...props}
        data={{ ...comparison, panelScopeKey: 'account-b:agent-b' }}
        selectedRow={selected}
      />,
    )
    expect(valuesFor(screen.getByRole('table', { name: '属性对比' }), '火属性伤害加成')).toEqual([
      '火属性伤害加成',
      '0%',
      '+30%',
      '30%',
    ])
    expect(JSON.stringify({ comparison, selected })).toBe(before)
  })

  it('does not display unsupported panel placeholders as real zeroes, while preserving known zeroes', () => {
    const unsupported = finiteComparisonPanelStats({ status: 'unsupported', values: { pen: 0 } })
    const { rerender } = render(
      <Top10StatTable
        data={comparison}
        selectedRow={{ ...baseline, rank: 1, finalStats: unsupported }}
        baselineAvailable
        baselineLabel="已保存方案"
      />,
    )
    expect(valuesFor(screen.getByRole('table', { name: '属性对比' }), '穿透值')).toEqual([
      '穿透值',
      '18',
      '—',
      '—',
    ])
    const knownZero = finiteComparisonPanelStats({ status: 'ok', values: { pen: 0 } })
    rerender(
      <Top10StatTable
        data={comparison}
        selectedRow={{ ...baseline, rank: 1, finalStats: knownZero }}
        baselineAvailable
        baselineLabel="已保存方案"
      />,
    )
    expect(valuesFor(screen.getByRole('table', { name: '属性对比' }), '穿透值')).toEqual([
      '穿透值',
      '18',
      '-18',
      '0',
    ])
    rerender(
      <Top10StatTable
        data={{ ...comparison, baseline: { ...baseline, finalStats: { pen: 0 } } }}
        selectedRow={{ ...baseline, rank: 1, finalStats: { pen: 0 } }}
        baselineAvailable
        baselineLabel="已保存方案"
      />,
    )
    expect(valuesFor(screen.getByRole('table', { name: '属性对比' }), '穿透值')).toEqual([
      '穿透值',
      '0',
      '0',
      '0',
    ])
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
        baselineLabel="当前装备"
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
    expect(within(table).getAllByRole('cell', { name: '穿透值' })).toHaveLength(1)
  })

  it('retains unchanged nonzero attributes and resources when the comparison baseline changes', () => {
    const data: GoldenTop10Data = {
      ...comparison,
      baseline: { ...baseline, finalStats: { ...baseline.finalStats, iceDamageBonus: 10 } },
    }
    const selected: LoadoutRow = { ...data.baseline, rank: 1 }
    const { rerender } = render(
      <Top10StatTable
        data={data}
        selectedRow={selected}
        baselineAvailable
        baselineLabel="当前装备"
      />,
    )
    let table = screen.getByRole('table', { name: '属性对比' })
    expect(valuesFor(table, '冰属性伤害加成')).toEqual(['冰属性伤害加成', '10%', '0%', '10%'])
    expect(valuesFor(table, '能量上限')).toEqual(['能量上限', '—', '—', '—'])
    expect(within(table).queryByRole('cell', { name: '火属性伤害加成' })).not.toBeInTheDocument()
    rerender(
      <Top10StatTable
        data={data}
        selectedRow={selected}
        baselineAvailable={false}
        baselineLabel="未记录当前六盘"
      />,
    )
    table = screen.getByRole('table', { name: '属性对比' })
    expect(valuesFor(table, '冰属性伤害加成')).toEqual(['冰属性伤害加成', '10%'])
    expect(valuesFor(table, '能量上限')).toEqual(['能量上限', '—'])
  })

  it('preserves all rows and zero totals in disc contribution mode', () => {
    render(
      <Top10StatTable
        data={{ ...comparison, statPresentation: 'disc_contribution' }}
        selectedRow={baseline}
        baselineAvailable
        baselineLabel="当前装备"
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
