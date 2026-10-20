import {
  createPanelDetailSubject,
  createAnomalyRankingData,
  createLegacyReferenceData,
} from './workbenchTargetsAndSave.testFixture'
import {
  describe,
  render,
  screen,
  waitFor,
  userEvent,
  expect,
  it,
  vi,
  AgentDevelopmentGolden,
  workbench,
} from './AgentDevelopmentGolden.workbench.testFixture'
import type { GoldenTop10Data } from './AgentDevelopmentGolden.workbench.testFixture'
import { agentDevelopmentSkillRecommendations } from '../../pages/agentDevelopmentSkillRecommendations'
import { getProjectedBuildKnowledgeProfile } from '../../gameDataPacks/agentProfile'
import { Top10StatTable } from './Top10StatTable'
import { WorkbenchPanelSnapshot } from './WorkbenchPanelSnapshot'

describe('AgentDevelopmentGolden warehouse candidate controls', () => {
  it('keeps the workbench summary and only applicable or nonzero full-panel details', () => {
    const { container } = render(<WorkbenchPanelSnapshot subject={createPanelDetailSubject()} />)
    const summary = container.querySelector('.stat-grid')!
    const full = container.querySelector('.character-panel-more__facts')!
    expect(summary).toHaveTextContent('穿透值')
    expect(summary).not.toHaveTextContent('锐能上限')
    expect(full).toHaveTextContent('穿透值')
    expect(full).toHaveTextContent('火属性伤害加成')
    expect(full).toHaveTextContent('锐能上限')
    expect(full).not.toHaveTextContent('冰属性伤害加成')
  })
  it('shows declared anomaly ranking scope in the existing summary and explanation', async () => {
    const { container } = render(
      <AgentDevelopmentGolden initialView="top10" top10={createAnomalyRankingData()} />,
    )
    expect(container.querySelector('.comparison-summary-intro__note')).toHaveTextContent(
      '按同条件单次异常结算排序，不含循环收益。',
    )
    await userEvent.setup().click(screen.getByRole('button', { name: '排序与计算限制' }))
    expect(screen.getByText(/按同条件单次异常结算排序，仅覆盖已声明结算/)).toHaveTextContent(
      '搜索预算已用尽',
    )
    expect(screen.queryByText(/按已覆盖模型目标排序/)).not.toBeInTheDocument()
  })
  it('guards old public optional and combat-only references without hiding actual rows', () => {
    const data = createLegacyReferenceData()
    const baseline = data.baseline
    render(
      <Top10StatTable
        data={data}
        selectedRow={baseline}
        baselineAvailable
        baselineLabel="当前实装"
      />,
    )
    expect(screen.getByRole('cell', { name: '生命值' })).not.toHaveTextContent('毕业推荐')
    expect(screen.getByRole('cell', { name: '防御力' })).not.toHaveTextContent('毕业推荐')
    expect(screen.getByRole('table', { name: '属性对比' })).toHaveTextContent('8,020')
    expect(screen.getByRole('cell', { name: '攻击力' })).toHaveTextContent('毕业推荐 3000+')
    expect(screen.getByRole('cell', { name: '攻击力' })).not.toHaveTextContent('攻略')
  })
  it('renders Seed numeric references while preserving source minima and confirmed priorities', () => {
    const directions = getProjectedBuildKnowledgeProfile('agent-seed').recommendation!.skillPriority
    const { skills } = agentDevelopmentSkillRecommendations('agent-seed', directions, [])
    const { container } = render(
      <AgentDevelopmentGolden
        initialView="workbench"
        workbench={{
          ...workbench,
          agentId: 'agent-seed',
          graduation: { ...workbench.graduation, skills },
        }}
      />,
    )
    const levels = [
      ...container.querySelectorAll(
        '.skill-comparison__target[aria-label="技能推荐等级"] > div > span',
      ),
    ]
    expect(levels.map((node) => node.querySelector('b')?.textContent)).toEqual([
      '12',
      '7',
      '7',
      '11',
      '11',
      '7',
    ])
    expect(skills.find((skill) => skill.key === 'special')?.targetType).toBe('minimum_reference')
    expect(
      levels
        .filter((node) => node.classList.contains('priority'))
        .map((node) => node.querySelector('small')?.textContent),
    ).toEqual(['普攻', '核心技'])
  })
  it('keeps the saved candidate selected when refreshed results move it to another rank', async () => {
    const user = userEvent.setup()
    const save = vi.fn().mockResolvedValue(undefined)
    const candidate: GoldenTop10Data['candidates'][number] = {
      rank: 1,
      label: '已选实体方案',
      fit: '100',
      panel: '',
      sets: '主套甲',
      effective: '12',
      swaps: 0,
      conflict: '',
      cost: '',
      staticDps: null,
      statDeltaSummary: '',
      finalStats: {},
      discIds: ['disc-1', 'disc-2', 'disc-3', 'disc-4', 'disc-5', 'disc-6'],
    }
    const other = { ...candidate, rank: 2, label: '另一实体方案', sets: '主套乙' }
    const data: GoldenTop10Data = {
      agentName: '比利',
      baseline: { ...candidate, rank: 0 },
      candidates: [candidate, other],
      discs: workbench.discs,
      coreStats: [],
      allStats: [],
      selectedCandidateRank: 1,
      statPresentation: 'disc_contribution',
    }
    const { rerender } = render(
      <AgentDevelopmentGolden initialView="top10" top10={data} onSavePlan={save} />,
    )
    rerender(
      <AgentDevelopmentGolden
        initialView="top10"
        top10={{
          ...data,
          selectedCandidateRank: 2,
          candidates: [
            { ...other, rank: 1 },
            { ...candidate, rank: 2 },
          ],
        }}
        onSavePlan={save}
      />,
    )
    expect(screen.getByRole('heading', { name: '已选实体方案 · 六盘明细' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '保存为养成方案' }))
    await waitFor(() => expect(save).toHaveBeenCalledWith(2))
  })
  it('opens same-page account editing without navigating away', async () => {
    const edit = vi.fn()
    render(
      <AgentDevelopmentGolden initialView="workbench" workbench={workbench} onEditCurrent={edit} />,
    )
    await userEvent.setup().click(screen.getByRole('button', { name: '编辑当前状态' }))
    expect(edit).toHaveBeenCalledOnce()
    expect(screen.queryByRole('link', { name: '在我的资产编辑' })).not.toBeInTheDocument()
  })

  it('keeps sourced target conditions beside the target numbers in the main panel', () => {
    render(
      <AgentDevelopmentGolden
        initialView="workbench"
        workbench={{
          ...workbench,
          graduation: {
            ...workbench.graduation,
            panelConditions: ['仅适用于说明中的队伍与音擎条件'],
          },
        }}
      />,
    )
    const conditionButton = screen.getByRole('button', { name: '适用条件' })
    expect(
      document.getElementById(conditionButton.getAttribute('popovertarget')!),
    ).toHaveTextContent('仅适用于说明中的队伍与音擎条件')
    expect(screen.getByRole('region', { name: '毕业推荐' })).toHaveTextContent('3000')
  })
  it('keeps only required targets inline and puts optional values and conditions in one popover', () => {
    const { container } = render(
      <AgentDevelopmentGolden
        initialView="workbench"
        workbench={{
          ...workbench,
          graduation: {
            ...workbench.graduation,
            panel: [
              { name: '攻击力', value: '1700–2000（可选）' },
              { name: '冲击力', value: '166–190+' },
              { name: '暴击率', value: '50%+' },
              { name: '暴击伤害', value: '100%–120%（可选）' },
            ],
            panelConditions: ['按队伍与音擎选择'],
          },
        }}
      />,
    )
    const inlineTargets = container.querySelectorAll(
      '.panel-graduation-targets__items > .panel-graduation-targets__item',
    )
    expect(Array.from(inlineTargets, (item) => item.textContent)).toEqual([
      '冲击力166–190+',
      '暴击率50%+',
    ])
    const trigger = screen.getByRole('button', { name: '更多' })
    const popup = document.getElementById(trigger.getAttribute('popovertarget')!)
    expect(popup).toHaveAttribute('popover', 'auto')
    expect(popup).toHaveTextContent('攻击力1700–2000（可选）')
    expect(popup).toHaveTextContent('暴击伤害100%–120%（可选）')
    expect(popup).toHaveTextContent('按队伍与音擎选择')
    expect(screen.queryByRole('button', { name: '适用条件' })).not.toBeInTheDocument()
  })
  it('shows sourced attribute directions without inventing a graduation target or a standalone engine-help row', () => {
    const { container } = render(
      <AgentDevelopmentGolden
        initialView="workbench"
        workbench={{
          ...workbench,
          graduation: {
            ...workbench.graduation,
            panel: [],
            panelDirection: '暴击率 / 防御力百分比',
            engineConditions: ['按队伍需求选择'],
          },
        }}
      />,
    )
    expect(screen.getByRole('region', { name: '副词条方向' })).toHaveTextContent(
      '暴击率 / 防御力百分比',
    )
    expect(screen.queryByText('资料待补齐')).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: '毕业推荐' })).not.toBeInTheDocument()
    expect(container.querySelector('.current-state-actions')).toContainElement(
      screen.getByRole('button', { name: '音擎说明' }),
    )
    expect(container.querySelector('.current-engine-plan > .explanation')).toBeNull()
  })
  it('renders an optional potential-only skill reference without replacing regular targets', () => {
    render(
      <AgentDevelopmentGolden
        initialView="workbench"
        workbench={{
          ...workbench,
          graduation: {
            ...workbench.graduation,
            potentialSkillReference: {
              conditionLabel: '潜能6/6参考（未用于当前方案）',
              skills: [
                ['普攻', '16级'],
                ['闪避', '16级'],
                ['支援', '16级'],
                ['特殊', '16级'],
                ['连携', '16级'],
                ['核心', '7级'],
              ].map(([label, recommended]) => ({ label, recommended })),
            },
          },
        }}
      />,
    )

    expect(screen.getByRole('region', { name: '技能推荐等级' })).toHaveTextContent('普攻12')
    const potentialReference = screen.getByRole('region', {
      name: '潜能6/6参考（未用于当前方案）',
    })
    expect(potentialReference).toHaveTextContent('普攻16')
    expect(potentialReference).toHaveTextContent('核心7')
  })

  it('omits the potential-only skill reference when no historical candidate exists', () => {
    render(<AgentDevelopmentGolden initialView="workbench" workbench={workbench} />)

    expect(
      screen.queryByRole('region', { name: '潜能6/6参考（未用于当前方案）' }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('region', { name: '技能推荐等级' })).toHaveTextContent('普攻12')
  })
  it('shows selected candidate main-stat differences directly above its discs', () => {
    render(
      <AgentDevelopmentGolden
        initialView="workbench"
        workbench={{ ...workbench, candidateDifferences: ['6号位：冲击力（建议异常掌控）'] }}
      />,
    )
    expect(screen.getByRole('status', { name: '与推荐主词条的差异' })).toHaveTextContent(
      '6号位：冲击力（建议异常掌控）',
    )
  })
  it('shows a complete baseline without inventing a replacement candidate', () => {
    const top10: GoldenTop10Data = {
      agentName: '比利',
      baseline: {
        rank: 0,
        label: '当前实装',
        fit: '比较基准',
        panel: '当前方案',
        sets: '啄木鸟电音 4件 + 河豚电音 2件',
        effective: '12',
        swaps: 0,
        conflict: '单人参考，不占用驱动盘',
        cost: '无新增成本',
        staticDps: null,
        statDeltaSummary: '—',
        finalStats: {},
        discIds: ['disc-1', 'disc-2', 'disc-3', 'disc-4', 'disc-5', 'disc-6'],
      },
      candidates: [],
      discs: workbench.discs,
      coreStats: [],
      allStats: [],
      statPresentation: 'disc_contribution',
      baselineAvailability: 'available',
    }

    render(<AgentDevelopmentGolden initialView="top10" top10={top10} onSavePlan={vi.fn()} />)

    expect(screen.getByRole('heading', { name: '当前实装' })).toBeInTheDocument()
    expect(
      screen.getByText('这份方案已配齐 6 张驱动盘，暂时没有其他匹配方案。'),
    ).toBeInTheDocument()
    expect(screen.getByText('可重新搭配，查找其他搭配。')).toBeInTheDocument()
    expect(screen.getByText('6 / 6')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '保存为养成方案' })).not.toBeInTheDocument()
  })

  it('does not switch a routed directory to an empty local workbench', async () => {
    const user = userEvent.setup()
    const onOpenAgent = vi.fn()
    render(
      <AgentDevelopmentGolden
        initialView="overview"
        onOpenAgent={onOpenAgent}
        directoryAgents={[
          {
            agentId: 'agent-billy',
            name: '比利',
            rarity: 'A',
            favorite: false,
            visual: { kind: 'avatar', src: '', fallback: 'initials' },
            level: 60,
            mindscape: 6,
            status: '已有方案',
            guideNote: '已有方案',
            plan: '已保存方案',
            reliableTarget: true,
          },
        ]}
      />,
    )
    await user.click(screen.getByRole('button', { name: '进入养成' }))
    expect(onOpenAgent).toHaveBeenCalledWith('agent-billy')
    expect(screen.getByRole('list', { name: '代理人养成总览' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('keeps the current content until the external route navigation completes', async () => {
    const user = userEvent.setup()
    const onNavigate = vi.fn()
    render(<AgentDevelopmentGolden workbench={workbench} onNavigate={onNavigate} />)
    await user.click(screen.getByRole('button', { name: '比较其他配装' }))
    expect(onNavigate).toHaveBeenCalledWith('top10')
    expect(screen.getByRole('heading', { name: '比利' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '返回养成' }))
    expect(onNavigate).toHaveBeenLastCalledWith('overview')
    expect(screen.getByRole('heading', { name: '比利' })).toBeInTheDocument()
  })

  it('keeps a stable panel heading across preview and saved states', () => {
    render(
      <AgentDevelopmentGolden
        workbench={{
          ...workbench,
          currentPanel: { ...workbench.currentPanel, title: '方案预览面板' },
        }}
      />,
    )
    expect(screen.getByRole('heading', { name: '当前面板' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '方案预览面板' })).not.toBeInTheDocument()
  })

  it('saves the candidate already selected by the solve context', async () => {
    const user = userEvent.setup()
    const savePlan = vi.fn().mockResolvedValue(undefined)
    render(<AgentDevelopmentGolden workbench={workbench} onSavePlan={savePlan} />)

    expect(screen.queryByRole('tab')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '保存配装' }))
    await waitFor(() => expect(savePlan).toHaveBeenCalledWith(2))
  })
})

describe('retaining equipped six-disc reference', () => {
  it('selects the equipped rank zero while keeping saved reference and alternatives visible without writing', async () => {
    const user = userEvent.setup()
    const save = vi.fn()
    const select = vi.fn()
    const row: GoldenTop10Data['baseline'] = {
      rank: 0,
      label: '保留当前实装',
      fit: '—',
      panel: '',
      sets: '当前六盘',
      effective: '—',
      swaps: 0,
      conflict: '',
      cost: '',
      staticDps: null,
      statDeltaSummary: '',
      finalStats: {},
      discIds: workbench.discs.map((d) => d.id) as [string, string, string, string, string, string],
    }
    render(
      <AgentDevelopmentGolden
        initialView="top10"
        top10={{
          agentName: '比利',
          baseline: row,
          currentLoadout: row,
          currentPlan: { ...row, rank: -1, label: '已保存方案', sets: '保存六盘' },
          candidates: [{ ...row, rank: 1, label: '方案 1', sets: '候选六盘' }],
          discs: workbench.discs,
          coreStats: [],
          allStats: [],
          statPresentation: 'disc_contribution',
          baselineKind: 'actual',
          selectedCandidateRank: 1,
        }}
        onSavePlan={save}
        onSelectCandidatePlan={select}
      />,
    )
    await user.click(screen.getByRole('button', { name: /比较基准.*当前实装.*当前六盘/ }))
    expect(select).toHaveBeenLastCalledWith(0)
    expect(screen.getByRole('heading', { name: '保留当前实装 · 六盘明细' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '保留当前实装' })).toBeDisabled()
    expect(save).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: /已保存方案.*保存六盘/ }))
    expect(select).toHaveBeenLastCalledWith(-1)
    expect(screen.getByRole('heading', { name: '已保存方案 · 六盘明细' })).toBeInTheDocument()
  })
})

describe('comparison set summary wrapping', () => {
  it('keeps the full set/count items in baseline and candidate text without removing the filter', () => {
    const sets = '啄啄沙龙 4件 + 月光骑士颂 2件'
    const row: GoldenTop10Data['baseline'] = {
      rank: 0,
      label: '当前实装',
      fit: '—',
      panel: '',
      sets,
      effective: '—',
      swaps: 0,
      conflict: '',
      cost: '',
      staticDps: null,
      statDeltaSummary: '',
      finalStats: {},
      discIds: workbench.discs.map((d) => d.id) as [string, string, string, string, string, string],
    }
    const { container } = render(
      <AgentDevelopmentGolden
        initialView="top10"
        top10={{
          agentName: '比利',
          baseline: row,
          candidates: [{ ...row, rank: 1, label: '方案 1', sets: `4+2：${sets}` }],
          discs: workbench.discs,
          coreStats: [],
          allStats: [],
          statPresentation: 'disc_contribution',
          baselineKind: 'actual',
        }}
      />,
    )
    const baseline = container.querySelector('.comparison-baseline > strong')!
    const candidate = container.querySelector('.comparison-candidate__identity > small')!
    expect(baseline.textContent).toBe(sets)
    expect(candidate.textContent).toBe(`4+2：${sets}`)
    for (const summary of [baseline, candidate]) {
      expect(
        Array.from(
          summary.querySelectorAll('.comparison-set-item__count'),
          (node) => node.textContent,
        ),
      ).toEqual([' 4件', ' 2件'])
      expect(summary.querySelectorAll('.comparison-set-item')).toHaveLength(2)
      expect(summary.querySelectorAll('.comparison-set-summary')).toHaveLength(1)
    }
    expect(screen.getByRole('button', { name: '仅无冲突' })).toBeEnabled()
  })
})
