import {
  createPanelDetailSubject,
  createAnomalyRankingData,
  createLegacyReferenceData,
  createLegacyEngineDirectionWorkbench,
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
import { within } from '@testing-library/react'
import { developmentSkillRecommendations } from '../../application/developmentSkillRecommendations'
import { createEmptyRoster } from '../../accounts/rosterHydration'
import { Top10StatTable } from './Top10StatTable'
import { WorkbenchPanelSnapshot } from './WorkbenchPanelSnapshot'

describe('AgentDevelopmentGolden warehouse candidate controls', () => {
  it('retains supplementary and resource fields in complete attributes without moving game-menu positions', () => {
    const { container } = render(<WorkbenchPanelSnapshot subject={createPanelDetailSubject()} />)
    const summary = container.querySelector('.stat-grid')!
    const details = container.querySelector('.panel-snapshot__full-grid')!
    expect(details).toHaveTextContent('穿透值')
    expect(details).toHaveTextContent('火属性伤害加成')
    expect(details).toHaveTextContent('锐能上限—')
    expect(details).toHaveTextContent('冰属性伤害加成0%')
    expect(summary).toHaveTextContent('锐能自动累积—')
    expect(summary.children).toHaveLength(10)
    expect(summary).not.toHaveTextContent('冰属性伤害加成')
    expect(screen.queryByRole('button', { name: '查看完整面板' })).not.toBeInTheDocument()
  })
  it('shows declared anomaly ranking scope in the existing summary', () => {
    const { container } = render(
      <AgentDevelopmentGolden initialView="top10" top10={createAnomalyRankingData()} />,
    )
    expect(container.querySelector('.comparison-summary-intro__note')).toHaveTextContent(
      '同条件下先比较单次异常伤害；伤害相同时参考推荐套装。',
    )
    expect(screen.queryByText(/按已覆盖属性与输出目标排序/)).not.toBeInTheDocument()
  })
  it('guards old public optional and combat-only references without hiding actual rows', () => {
    const data = createLegacyReferenceData()
    const baseline = data.baseline
    render(
      <Top10StatTable
        data={data}
        selectedRow={baseline}
        baselineAvailable
        baselineLabel="当前装备"
      />,
    )
    expect(screen.getByRole('cell', { name: '生命值' })).not.toHaveTextContent('培养目标')
    expect(screen.getByRole('cell', { name: '防御力' })).not.toHaveTextContent('培养目标')
    expect(screen.getByRole('table', { name: '属性对比' })).toHaveTextContent('8020')
    expect(screen.getByRole('cell', { name: '攻击力' })).toHaveTextContent('培养目标 3000+')
    expect(screen.getByRole('cell', { name: '攻击力' })).not.toHaveTextContent('攻略')
  })
  it('renders Seed numeric references while preserving source minima and confirmed priorities', () => {
    const actor = createEmptyRoster('2026-11-01T00:00:00Z').agents.find(
      (agent) => agent.agentId === 'agent-seed',
    )!
    const { skills } = developmentSkillRecommendations({ ...actor, mindscape: 0 })
    const { container } = render(
      <AgentDevelopmentGolden
        initialView="workbench"
        workbench={{
          ...workbench,
          agentId: 'agent-seed',
          mindscape: 0,
          skills: workbench.skills.map((skill) => ({ ...skill, value: 1 })),
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
    ).toEqual(['普攻', '特殊', '连携', '核心技'])
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

  it('keeps sourced target conditions in a disclosure beside the cultivation targets', () => {
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
    const trigger = screen.getByRole('button', { name: '适用条件' })
    const popup = document.getElementById(trigger.getAttribute('popovertarget')!)!
    const conditions = within(popup).getByRole('region', { name: '适用条件', hidden: true })
    expect(trigger.closest('.panel-graduation-targets')).toBeInTheDocument()
    expect(conditions.closest('.current-overview__panel')).toBeInTheDocument()
    expect(conditions).toHaveTextContent('仅适用于说明中的队伍与音擎条件')
    expect(popup).toHaveAttribute('popover', 'auto')
    expect(screen.getByRole('region', { name: '培养目标' })).toHaveTextContent('3000')
  })
  it('keeps all source target values in source order and separates their applicability disclosure', () => {
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
      '攻击力1700–2000（可选）',
      '冲击力166–190+',
      '暴击率50%+',
      '暴击伤害100%–120%（可选）',
    ])
    const trigger = screen.getByRole('button', { name: '适用条件' })
    const popup = document.getElementById(trigger.getAttribute('popovertarget')!)
    expect(popup).toHaveAttribute('popover', 'auto')
    expect(popup).toHaveTextContent('按队伍与音擎选择')
    expect(popup).not.toHaveTextContent('1700')
  })
  it('keeps optional source advice readable beside a fixed four-target primary region', () => {
    const { container } = render(
      <WorkbenchPanelSnapshot
        subject={{
          ...workbench,
          graduation: {
            ...workbench.graduation,
            panel: [
              {
                name: '攻击力',
                value: '2500–3100（可选）',
                placement: 'reference',
                semantic: {
                  requirement: 'optional',
                  boundary: 'minimum',
                  observation: 'out_of_combat',
                },
              },
              { name: '生命值', value: '9500+' },
              { name: '防御力', value: '800+' },
              { name: '暴击率', value: '70%–80%' },
              { name: '暴击伤害', value: '140%–160%' },
            ],
          },
        }}
      />,
    )
    const inlineTargets = container.querySelectorAll(
      '.panel-graduation-targets__items > .panel-graduation-targets__item',
    )
    expect(Array.from(inlineTargets, (item) => item.textContent)).toEqual([
      '生命值9500+',
      '防御力800+',
      '暴击率70%–80%',
      '暴击伤害140%–160%',
    ])
    expect(screen.queryByRole('button', { name: '更多推荐' })).not.toBeInTheDocument()
    expect(container.querySelector('.panel-graduation-targets__references')).toHaveTextContent(
      '攻击力可选2500–3100',
    )
    expect(container.querySelector('.panel-graduation-targets__optional')).not.toBeInTheDocument()
  })
  it('shows an all-optional target without inventing a mandatory requirement or an empty disclosure', () => {
    const { container } = render(
      <WorkbenchPanelSnapshot
        subject={{
          ...workbench,
          graduation: {
            ...workbench.graduation,
            panelConditions: [],
            panel: [
              {
                name: '攻击力',
                value: '2500–3100（可选）',
                placement: 'primary',
                semantic: {
                  requirement: 'optional',
                  boundary: 'minimum',
                  observation: 'out_of_combat',
                },
              },
            ],
          },
        }}
      />,
    )
    expect(container.querySelector('.panel-graduation-targets__items')).toHaveTextContent(
      '攻击力2500–3100',
    )
    expect(container.querySelector('.panel-graduation-targets__kind')).toHaveTextContent('可选参考')
    expect(screen.queryByRole('button', { name: '适用条件' })).not.toBeInTheDocument()
  })
  it('shows attribute directions and suppresses unreviewed engine prose without a separate help row', () => {
    const { container, rerender } = render(
      <AgentDevelopmentGolden
        initialView="workbench"
        workbench={createLegacyEngineDirectionWorkbench()}
      />,
    )
    expect(screen.getByRole('region', { name: '培养目标' })).toHaveTextContent(
      '暴击率 / 防御力百分比',
    )
    expect(screen.queryByText('资料待补齐')).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: '毕业推荐' })).not.toBeInTheDocument()
    const engineRegion = screen.getByRole('region', { name: '当前音擎与推荐' })
    expect(engineRegion).not.toHaveTextContent(/按队伍需求选择|沿用一般培养参考/)
    const trigger = screen.getByRole('button', { name: '选择说明' })
    const popup = document.getElementById(trigger.getAttribute('popovertarget')!)!
    expect(popup).toHaveTextContent('仿制星徽引擎')
    expect(popup).not.toHaveTextContent(/按队伍需求选择|沿用一般培养参考/)
    expect(screen.queryByRole('region', { name: '音擎适用条件' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '音擎说明' })).not.toBeInTheDocument()
    expect(container.querySelector('.current-engine-plan > .explanation')).toBeNull()
    rerender(
      <AgentDevelopmentGolden
        initialView="workbench"
        workbench={createLegacyEngineDirectionWorkbench('agent-unreviewed-fixture')}
      />,
    )
    expect(screen.queryByRole('button', { name: '选择说明' })).not.toBeInTheDocument()
  })
  it('uses one P6 target set without an extra source row and highlights paid investment', () => {
    const acceptedSkills = [
      ['普攻', '12'],
      ['闪避', '9'],
      ['支援', '9'],
      ['特殊', '11'],
      ['连携', '10'],
      ['核心技', '7'],
    ].map(([label, recommended], index) => ({
      label,
      recommended,
      priority: index === 0 || index === 5,
    }))
    const { container } = render(
      <AgentDevelopmentGolden
        initialView="workbench"
        workbench={{
          ...workbench,
          supportsPotential: true,
          potential: 6,
          mindscape: 5,
          graduation: {
            ...workbench.graduation,
            skills: acceptedSkills,
            potentialSkillReference: {
              conditionLabel: '潜能6/6参考（未用于当前方案）',
              skills: [
                ['普攻', '16+'],
                ['闪避', '12'],
                ['支援', '≥12'],
                ['特殊', '16+'],
                ['连携', '12+'],
                ['核心', '待确认'],
              ].map(([label, recommended]) => ({ label, recommended })),
            },
          },
        }}
      />,
    )

    expect(screen.getAllByRole('region', { name: '技能推荐等级' })).toHaveLength(1)
    expect(screen.getByText(/潜能 6/)).toBeInTheDocument()
    expect(screen.queryByText('潜能6/6参考（未用于当前方案）')).not.toBeInTheDocument()
    expect(container.querySelector('.skill-comparison__target-source')).toBeNull()
    const targets = screen.getByRole('region', { name: '技能推荐等级' })
    expect(targets).toHaveTextContent('普攻16')
    expect(targets).toHaveTextContent('闪避12')
    expect(targets).toHaveTextContent('支援12')
    expect(targets).toHaveTextContent('特殊16')
    expect(targets).toHaveTextContent('连携12')
    expect([...targets.querySelectorAll(':scope > div > span')].at(-1)).toHaveTextContent(
      '核心技待确认',
    )
    expect(targets).not.toHaveTextContent('普攻12')
    expect(targets).not.toHaveTextContent('16+')
    expect(targets).not.toHaveTextContent('≥12')
    expect(targets).not.toHaveTextContent('12+')
    expect(container.querySelectorAll('.skill-comparison__target span.priority')).toHaveLength(2)
  })

  it.each([0, 3, 5, null, undefined])(
    'keeps trusted ordinary targets when observed potential is %s',
    (potential) => {
      render(
        <AgentDevelopmentGolden
          initialView="workbench"
          workbench={{
            ...workbench,
            supportsPotential: true,
            potential: potential ?? undefined,
            graduation: {
              ...workbench.graduation,
              potentialSkillReference: {
                conditionLabel: '潜能6/6参考（未用于当前方案）',
                skills: [{ label: '普攻', recommended: '16+' }],
              },
            },
          }}
        />,
      )

      expect(
        screen.getByText(potential == null ? /潜能未记录/ : new RegExp(`潜能 ${potential}`)),
      ).toBeInTheDocument()
      expect(screen.getByRole('region', { name: '技能推荐等级' })).toHaveTextContent('普攻12')
      expect(screen.getByRole('region', { name: '技能推荐等级' })).not.toHaveTextContent('普攻16+')
    },
  )
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
        label: '当前装备',
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

    expect(screen.getByRole('heading', { name: '当前装备' })).toBeInTheDocument()
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

  it('identifies the source of the visible panel across preview, saved and current states', () => {
    const { rerender } = render(
      <AgentDevelopmentGolden
        workbench={{
          ...workbench,
          currentPanel: { ...workbench.currentPanel, title: '方案预览面板' },
        }}
      />,
    )
    expect(screen.getByRole('heading', { name: '配装预览面板' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '方案预览面板' })).not.toBeInTheDocument()
    rerender(<AgentDevelopmentGolden workbench={{ ...workbench, mode: 'saved' }} />)
    expect(screen.getByRole('heading', { name: '方案面板' })).toBeInTheDocument()
    rerender(<AgentDevelopmentGolden workbench={{ ...workbench, discSource: '当前已装备' }} />)
    expect(screen.getByRole('heading', { name: '当前面板' })).toBeInTheDocument()
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
      label: '保留当前装备',
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
    await user.click(screen.getByRole('button', { name: /比较基准.*当前装备.*当前六盘/ }))
    expect(select).toHaveBeenLastCalledWith(0)
    expect(screen.getByRole('heading', { name: '保留当前装备 · 六盘明细' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '保留当前装备' })).toBeDisabled()
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
      label: '当前装备',
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
