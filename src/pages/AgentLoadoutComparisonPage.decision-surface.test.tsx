import './AgentLoadoutComparisonPage.testMock'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AgentDevelopmentGolden } from '../features/agentDevelopmentGolden'
import { discs, benchmark } from './AgentLoadoutComparisonPage.testFixture'
import { projectDevelopmentComparisonPanels } from '../application/developmentComparisonPanelProjection'
import { characterPanelLabels } from './agentDevelopmentWorkbenchViewModel'
import { Top10StatTable } from '../features/agentDevelopmentGolden/Top10StatTable'
import { Top10 } from '../features/agentDevelopmentGolden/AgentDevelopmentTop10'
import type { CoreWarehouse } from '../accounts/coreFlow'
import type { GoldenTop10Data } from '../features/agentDevelopmentGolden/types'
describe('golden warehouse comparison adapter', () => {
  it('keeps candidates with identical discs but different calculation contexts selectable and saves the selected rank', async () => {
    const ids = discs.map((disc) => disc.id) as [string, string, string, string, string, string]
    const base: GoldenTop10Data['baseline'] = {
      rank: 0,
      label: '当前实装',
      fit: '400',
      panel: '4+2',
      sets: '啄木鸟电音 4件 + 河豚电音 2件',
      effective: '30',
      swaps: 0,
      conflict: '',
      cost: '—',
      staticDps: null,
      statDeltaSummary: '—',
      finalStats: {},
      discIds: ids,
    }
    const save = vi.fn().mockResolvedValue(undefined)
    render(
      <Top10
        back={() => {}}
        scenario="ordinary"
        onSavePlan={save}
        data={{
          agentName: '比利',
          baseline: base,
          baselineKind: 'actual',
          baselineAvailability: 'available',
          currentLoadout: base,
          discs,
          coreStats: [],
          allStats: [],
          statPresentation: 'static_panel',
          candidates: [
            { ...base, rank: 1, label: '潜能0方案' },
            { ...base, rank: 2, label: '潜能6方案' },
          ],
          valueBenchmarks: [benchmark(1), benchmark(2)],
        }}
      />,
    )
    expect(screen.getByRole('button', { name: /潜能0方案/ })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /潜能6方案/ }))
    await userEvent.click(screen.getByRole('button', { name: '保存为养成方案' }))
    await waitFor(() => expect(save).toHaveBeenCalledWith(2))
  })

  it('renders all ten actual attributes with the real adopted Roxy targets', () => {
    const projection = projectDevelopmentComparisonPanels({
      warehouse: {
        accountId: 'test',
        discs: [],
        roster: { agents: [] },
      } as unknown as CoreWarehouse,
      drafts: [],
      agentId: 'agent-roxy',
      baseline: [],
      candidates: [],
    })
    const row = {
      rank: 0,
      label: '当前方案',
      finalStats: { 生命值: 8020, 防御力: 630 },
    } as unknown as GoldenTop10Data['baseline']
    render(
      <Top10StatTable
        data={{
          agentName: '洛茜',
          baseline: row,
          candidates: [],
          discs: [],
          coreStats: [],
          statPresentation: 'static_panel',
          allStats: characterPanelLabels.map((label) => ({
            key: label,
            label,
            unit: '',
            highlight: false,
            target: projection.targetDisplayByLabel[label],
          })),
        }}
        selectedRow={row}
        baselineAvailable
        baselineLabel="当前实装"
      />,
    )
    const table = screen.getByRole('table', { name: '属性对比' })
    for (const label of characterPanelLabels)
      expect(screen.getByRole('cell', { name: label })).toBeInTheDocument()
    expect(table).toHaveTextContent('8,020')
    expect(table).toHaveTextContent('630')
    expect(screen.getByRole('cell', { name: '生命值' })).not.toHaveTextContent('参考')
    expect(screen.getByRole('cell', { name: '防御力' })).not.toHaveTextContent('参考')
    expect(table).toHaveTextContent('参考')
    expect(table).not.toHaveTextContent('攻略参考')
    expect(table).not.toHaveTextContent('毕业推荐')
  })
  it('keeps a generated six-disc candidate saveable without a recorded game loadout', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const candidate = {
      rank: 1,
      label: '方案 1',
      fit: '412.56',
      panel: '4+2',
      sets: '啄木鸟电音 4件 + 河豚电音 2件',
      effective: '30',
      swaps: null,
      conflict: '',
      cost: '—',
      staticDps: null,
      statDeltaSummary: '—',
      finalStats: { crit_rate: 14.4 },
      discIds: ['disc-1', 'disc-2', 'disc-3', 'disc-4', 'disc-5', 'disc-6'] as [
        string,
        string,
        string,
        string,
        string,
        string,
      ],
    }
    render(
      <AgentDevelopmentGolden
        embedded
        initialView="top10"
        top10={{
          agentName: '比利',
          discs,
          baseline: { ...candidate, rank: 0 },
          candidates: [candidate],
          coreStats: [{ key: 'crit_rate', label: '暴击率', unit: '%' as const, highlight: true }],
          allStats: [{ key: 'crit_rate', label: '暴击率', unit: '%' as const, highlight: true }],
          statPresentation: 'disc_contribution',
          baselineAvailability: 'unavailable',
          baselineKind: 'none',
          baselineLabel: '尚无比较基线',
        }}
        onSavePlan={save}
      />,
    )
    expect(screen.getByText('暂无当前实装，可先查看仓库方案。')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '方案 1 · 六盘明细' })).toBeInTheDocument()
    expect(screen.getByRole('table', { name: '副词条合计' })).toHaveTextContent('14.4%')
    expect(screen.queryByText('当前实装')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '保存为养成方案' }))
    await waitFor(() => expect(save).toHaveBeenCalledWith(1))
  })

  it('shows candidate, six-disc, stat and save evidence as one decision surface', async () => {
    const positive = benchmark(2)
    const limitedPositive = {
      ...positive,
      candidateDisposition: 'unresolved' as const,
      coverage: {
        ...positive.coverage,
        generalConclusion: 'limited' as const,
        reasons: ['换装改变了未计入的套装效果。'],
      },
    }
    const zeroBaseline = {
      ...limitedPositive,
      planningDpsDelta: 10,
      planningDpsPercentDelta: null,
    }
    const save = vi.fn().mockResolvedValue(undefined)
    const reanalyze = vi.fn().mockResolvedValue(undefined)
    const navigate = vi.fn()
    const user = userEvent.setup()
    render(
      <AgentDevelopmentGolden
        embedded
        initialView="top10"
        top10={{
          agentName: '比利',
          discs,
          baseline: {
            rank: 0,
            label: '当前实装',
            fit: '比较基准',
            panel: '当前方案',
            sets: '当前方案',
            effective: '24',
            swaps: 0,
            conflict: '无冲突',
            cost: '无新增成本',
            staticDps: null,
            statDeltaSummary: '—',
            finalStats: { crit_rate: 12, crit_dmg: 48, atk_percent: 18 },
            discIds: ['disc-1', 'disc-2', 'disc-3', 'disc-4', 'disc-5', 'disc-6'],
          },
          candidates: [
            {
              rank: 1,
              label: '候选方案 1',
              fit: '412.56',
              panel: '4+2',
              sets: '4+2：啄木鸟电音 4件 + 河豚电音 2件',
              effective: '30',
              swaps: 3,
              conflict: '无冲突',
              cost: '3 张替换',
              staticDps: null,
              statDeltaSummary: '暴击率 +2.4%',
              finalStats: { crit_rate: 14.4, crit_dmg: 52.8, atk_percent: 24 },
              discIds: ['disc-1', 'disc-2', 'disc-3', 'disc-4', 'disc-5', 'disc-6'],
            },
            {
              rank: 2,
              label: '候选方案 2',
              fit: '401.12',
              panel: '4+2',
              sets: '4+2：激素朋克 4件 + 河豚电音 2件',
              effective: '28',
              swaps: 4,
              conflict: '无冲突',
              cost: '4 张替换',
              staticDps: null,
              statDeltaSummary: '攻击力% +6%',
              finalStats: { crit_rate: 13, crit_dmg: 50, atk_percent: 30 },
              mainStatDifferences: ['6号位：冲击力（建议异常掌控）'],
              discIds: ['disc-1', 'disc-2', 'disc-3', 'disc-4', 'disc-5', 'disc-6'],
            },
            {
              rank: 3,
              label: '候选方案 3',
              fit: '400.00',
              panel: '4+2',
              sets: '4+2：固定事件零基线候选',
              effective: '26',
              swaps: 4,
              conflict: '无冲突',
              cost: '4 张替换',
              staticDps: null,
              statDeltaSummary: '固定事件 +10',
              finalStats: { crit_rate: 13, crit_dmg: 50, atk_percent: 30 },
              discIds: ['disc-1', 'disc-2', 'disc-3', 'disc-4', 'disc-5', 'disc-6'],
            },
          ],
          valueBenchmarks: [limitedPositive, benchmark(-1), zeroBaseline],
          coreStats: [
            { key: 'crit_rate', label: '暴击率', unit: '%', highlight: true },
            { key: 'crit_dmg', label: '暴击伤害', unit: '%', highlight: true },
          ],
          allStats: [
            { key: 'crit_rate', label: '暴击率', unit: '%', highlight: true },
            { key: 'crit_dmg', label: '暴击伤害', unit: '%', highlight: true },
            { key: 'atk_percent', label: '攻击力%', unit: '%', highlight: false },
          ],
          statPresentation: 'disc_contribution',
        }}
        onSavePlan={save}
        onReanalyzeWarehouse={reanalyze}
        onNavigate={navigate}
      />,
    )
    expect(screen.getByRole('heading', { name: '方案比较' })).toBeInTheDocument()
    expect(screen.getByText('有效副属性 30 次命中')).toBeInTheDocument()
    expect(screen.queryByText('有效强化 30 次')).not.toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: '仓库方案比较' })).toBeInTheDocument()
    expect(screen.getByLabelText('当前方案操作')).toHaveTextContent(
      '4+2：啄木鸟电音 4件 + 河豚电音 2件',
    )
    expect(screen.getByLabelText('当前方案操作')).toHaveTextContent('近似输出 +20.00%')
    expect(screen.getByLabelText('当前方案操作')).toHaveTextContent(
      '按代表动作近似比较，部分效果可能未计入。',
    )
    expect(screen.getByRole('navigation', { name: '仓库方案比较' })).not.toHaveTextContent(
      '预计收益 +20.00%',
    )
    expect(screen.getByRole('heading', { name: '候选方案 1 · 六盘明细' })).toBeInTheDocument()
    expect(screen.queryByText('当前选择', { exact: true })).not.toBeInTheDocument()
    expect(screen.queryByText('所选方案使用的驱动盘。', { exact: true })).not.toBeInTheDocument()
    expect(screen.getByLabelText('当前方案操作')).toHaveTextContent('6 / 6')
    expect(screen.queryByRole('button', { name: '按静态 DPS排序' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /查看全部属性/ })).not.toBeInTheDocument()
    expect(screen.getByRole('cell', { name: '攻击力%' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /方案 2/ }))
    expect(screen.getByLabelText('当前方案操作')).toHaveTextContent(
      '4+2：激素朋克 4件 + 河豚电音 2件',
    )
    expect(screen.getByLabelText('当前方案操作')).toHaveTextContent('近似输出 -10.00%')
    expect(screen.getByLabelText('当前方案操作')).toHaveTextContent(
      '按代表动作近似比较，部分效果可能未计入。',
    )
    expect(screen.getByLabelText('当前方案操作')).not.toHaveTextContent('推荐')
    expect(screen.getByLabelText('当前方案操作')).toHaveTextContent('6号位：冲击力（建议异常掌控）')
    expect(screen.getByRole('navigation', { name: '仓库方案比较' })).not.toHaveTextContent(
      '6号位：冲击力（建议异常掌控）',
    )
    await user.click(screen.getByRole('button', { name: /方案 3/ }))
    expect(screen.getByLabelText('当前方案操作')).toHaveTextContent(
      '近似输出 +10（无法换算百分比）',
    )
    await user.click(screen.getByRole('button', { name: /方案 2/ }))
    await user.click(screen.getByRole('button', { name: '重新搭配' }))
    await waitFor(() => expect(reanalyze).toHaveBeenCalledTimes(1))
    expect(screen.getByRole('status')).toHaveTextContent('搭配完成，方案已刷新。')
    await user.click(screen.getByRole('button', { name: '保存为养成方案' }))
    expect(save).toHaveBeenCalledWith(2)
    const back = screen.getByRole('button', { name: '返回养成' })
    expect(back).toHaveClass('back-navigation')
    await user.click(back)
    expect(navigate).toHaveBeenCalledWith('workbench')
  })

  it('keeps missing baseline, all five priority stats and stale-save states explicit', async () => {
    const user = userEvent.setup()
    const save = vi.fn()
    const fiveStats = ['攻击力', '暴击率', '暴击伤害', '异常精通', '穿透值'].map((label) => ({
      key: label,
      label,
      unit: '' as const,
      highlight: true,
    }))
    render(
      <AgentDevelopmentGolden
        embedded
        initialView="top10"
        top10={{
          agentName: '蕾米耶尔',
          discs,
          baseline: {
            rank: 0,
            label: '当前实装',
            fit: '比较基准',
            panel: '当前方案',
            sets: '当前方案',
            effective: '—',
            swaps: 0,
            conflict: '无冲突',
            cost: '无新增成本',
            staticDps: null,
            statDeltaSummary: '—',
            finalStats: {},
          },
          candidates: [
            {
              rank: 1,
              label: '方案 1',
              fit: '412.56',
              panel: '4+2',
              sets: '4+2：谶羽之誓 4件 + 河豚电音 2件',
              effective: '30',
              swaps: null,
              conflict: '无冲突',
              cost: '替换数量待核对',
              staticDps: null,
              statDeltaSummary: '当前盘未关联完整六盘',
              finalStats: {},
              discIds: ['disc-1', 'disc-2', 'disc-3', 'disc-4', 'disc-5', 'disc-6'],
            },
          ],
          coreStats: fiveStats,
          allStats: fiveStats.map((stat) => ({ ...stat, target: '3000' })),
          statPresentation: 'disc_contribution',
          baselineAvailability: 'unavailable',
          snapshot: { capturedAt: '2026-09-07T00:00:00Z', stale: true },
        }}
        onSavePlan={save}
        onNavigate={vi.fn()}
      />,
    )

    expect(screen.getByRole('navigation', { name: '仓库方案比较' })).toHaveTextContent(
      '可先查看并保存生成方案。',
    )
    expect(screen.getByText('暂无当前实装，可先查看仓库方案。')).toBeInTheDocument()
    expect(screen.getByLabelText('当前方案操作')).not.toHaveTextContent('待核对')
    expect(screen.queryByText('预计收益暂不可比较')).not.toBeInTheDocument()
    expect(
      screen.queryByText('适配评分用于比较词条和搭配，不代表伤害提升。保存方案不会自动更换装备。'),
    ).not.toBeInTheDocument()
    expect(screen.queryByText('6 张替换')).not.toBeInTheDocument()
    expect(screen.queryByText('需替换')).not.toBeInTheDocument()
    expect(screen.getByText('六张驱动盘的副词条合计，不含主词条和套装效果。')).toBeInTheDocument()
    expect(screen.queryByText(/攻略参考|毕业推荐/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '查看全部属性（5）' })).not.toBeInTheDocument()
    expect(screen.getByRole('cell', { name: '穿透值' })).toBeInTheDocument()
    const saveButton = screen.getByRole('button', { name: '保存为养成方案' })
    expect(saveButton).toBeDisabled()
    await user.click(saveButton)
    expect(save).not.toHaveBeenCalled()
    expect(screen.getByRole('status')).toHaveTextContent('装备已更新，重新搭配后即可保存。')
    expect(screen.getByRole('status').closest('header')).toHaveClass('comparison-detail__summary')
  })
})
