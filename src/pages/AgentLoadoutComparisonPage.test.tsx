import { getQueryComparisonMock } from './AgentLoadoutComparisonPage.testMock'
import { createEmptyRoster } from '../assault/catalog'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import * as planningDrafts from '../accounts/planningDrafts'
import { useAccountDecisionWorld } from '../application/accountDecisionWorld'
import type { DevelopmentCandidateAlternativesQueryResult } from '../application/calculationQueryContract'
import { projectDevelopmentCandidatePresentation } from '../application/developmentCandidatePresentation'
import { projectDevelopmentComparisonPanels } from '../application/developmentComparisonPanelProjection'
import type { DriveDisc } from '../domain/schemas'
import { AgentLoadoutComparisonPage } from './AgentLoadoutComparisonPage'
import { candidateMainStatDifferences } from './candidateMainStatDifferences'
import { agentDevelopmentMainStatDifferences } from './agentDevelopmentMainStatDifferences'
import { cacheDevelopmentCandidateSnapshot } from './agentDevelopmentCandidateSession'
import { ReturnLocation } from './AgentLoadoutComparisonPage.testFixture'
describe('golden warehouse comparison adapter', () => {
  it('describes only recorded 4/5/6 main-stat differences against the candidate constraint', () => {
    const discsWithImpactSixth: DriveDisc[] = [1, 2, 3, 4, 5, 6].map((slot) => ({
      id: `disc-${slot}`,
      setId: 'fanged-metal',
      slot: slot as DriveDisc['slot'],
      level: 15,
      rarity: 'S' as const,
      mainStat: (slot === 4
        ? 'anomaly_proficiency'
        : slot === 5
          ? 'ether_dmg'
          : slot === 6
            ? 'impact'
            : 'atk_percent') as DriveDisc['mainStat'],
      subStats: [],
      locked: false,
      favorite: false,
      tags: [],
      createdAt: '2026-09-07T00:00:00.000Z',
      updatedAt: '2026-09-07T00:00:00.000Z',
      dataVersion: '3.1',
    }))

    expect(candidateMainStatDifferences('agent-aria', discsWithImpactSixth)).toEqual([
      '6号位：冲击力（建议异常掌控）',
    ])
    expect(
      agentDevelopmentMainStatDifferences(
        projectDevelopmentCandidatePresentation('agent-aria').recommendedMainStats,
        discsWithImpactSixth,
      ),
    ).toEqual(candidateMainStatDifferences('agent-aria', discsWithImpactSixth))
    expect(
      candidateMainStatDifferences(
        'agent-aria',
        discsWithImpactSixth.map((disc) =>
          disc.slot === 6 ? { ...disc, mainStat: 'anomaly_mastery' as const } : disc,
        ),
      ),
    ).toEqual([])
  })

  it('returns to the existing agent page when a candidate session record is unavailable', () => {
    vi.mocked(useAccountDecisionWorld).mockReturnValueOnce({
      status: 'current',
      run: {
        input: {
          warehouse: {
            accountId: 'comparison-account',
            roster: { agents: [{ agentId: 'agent-billy', owned: true }] },
          },
        },
      },
    } as unknown as ReturnType<typeof useAccountDecisionWorld>)

    render(
      <MemoryRouter initialEntries={['/development/agent-billy/compare']}>
        <Routes>
          <Route path="/development/:agentId/compare" element={<AgentLoadoutComparisonPage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: '本次匹配记录不可用' })).toBeInTheDocument()
    expect(screen.getByText(/请回到养成页重新搭配驱动盘/)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: '返回养成' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: '返回养成，重新搭配' })).toHaveAttribute(
      'href',
      '/development/agent-billy',
    )
  })

  it('does not reopen a previous account’s candidate snapshot while the decision run is stale', () => {
    sessionStorage.clear()
    cacheDevelopmentCandidateSnapshot({
      contract: 'soda-development-candidate-alternatives/v1',
      comparisonContract: 'soda-explicit-development-comparison/v1',
      comparisonFingerprint: 'fixture-comparison',
      runId: 'previous-account-run',
      capturedAt: '2026-09-07T00:00:00.000Z',
      inputFingerprint: 'previous-account-fingerprint',
      accountId: 'previous-account',
      agentId: 'agent-billy',
      status: 'ready',
      sideEffect: 'read_only',
      buildIntent: {
        contract: 'soda-build-intent/v1',
        scope: 'agent_independent',
        fingerprint: 'previous-account-intent',
      },
      baseline: [],
      candidates: [],
      gaps: [],
    } as unknown as DevelopmentCandidateAlternativesQueryResult)
    vi.mocked(useAccountDecisionWorld).mockReturnValueOnce({
      status: 'stale',
      liveFingerprint: 'current-account-fingerprint',
      run: {
        input: {
          warehouse: {
            accountId: 'previous-account',
            roster: { agents: [{ agentId: 'agent-billy', owned: true }] },
          },
        },
      },
      liveInput: {
        warehouse: {
          accountId: 'current-account',
          roster: { agents: [{ agentId: 'agent-billy', owned: true }] },
        },
      },
    } as unknown as ReturnType<typeof useAccountDecisionWorld>)

    render(
      <MemoryRouter initialEntries={['/development/agent-billy/compare']}>
        <Routes>
          <Route path="/development/:agentId/compare" element={<AgentLoadoutComparisonPage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: '本次匹配记录不可用' })).toBeInTheDocument()
    expect(screen.queryByText('方案 1')).not.toBeInTheDocument()
    sessionStorage.clear()
    vi.mocked(useAccountDecisionWorld).mockReset()
  })

  it('keeps a selected candidate in the return route and does not claim the warehouse lacks a disc', async () => {
    const user = userEvent.setup()
    const saveCurrentAgentBuild = vi
      .spyOn(planningDrafts, 'saveCurrentAgentBuild')
      .mockImplementation(async (accountId, input) => ({
        ...input,
        accountId,
        id: 'saved-aria',
        scopedId: 'comparison-account:saved-aria',
        kind: 'agent',
        savedRole: 'current_reference',
        state: 'saved',
        revision: 1,
        createdAt: '2026-09-12T00:00:00Z',
        updatedAt: '2026-09-12T00:00:00Z',
      }))
    sessionStorage.clear()
    const candidateDiscs: DriveDisc[] = [1, 2, 3, 4, 5, 6].map((slot) => ({
      id: `aria-disc-${slot}`,
      setId: 'set-swing-jazz',
      slot: slot as DriveDisc['slot'],
      level: 15,
      rarity: 'S',
      mainStat: (slot === 4
        ? 'anomaly_proficiency'
        : slot === 5
          ? 'ether_dmg'
          : slot === 6
            ? 'impact'
            : ['hp_flat', 'atk_flat', 'def_flat'][slot - 1]) as DriveDisc['mainStat'],
      subStats: [],
      locked: false,
      favorite: false,
      tags: [],
      createdAt: '2026-09-07T00:00:00.000Z',
      updatedAt: '2026-09-07T00:00:00.000Z',
      dataVersion: '3.1',
    }))
    const candidateOneDiscs = candidateDiscs.map((disc) => ({
      ...disc,
      id: `aria-candidate-one-disc-${disc.slot}`,
    }))
    const comparisonAgent = {
      ...createEmptyRoster().agents.find((agent) => agent.agentId === 'agent-aria')!,
      owned: true,
      level: 60,
      skillLevels: { basic: 12, dodge: 12, assist: 12, special: 12, chain: 12, core: 7 },
      wEngineDetails: { id: 'wengine-13001', name: '街头巨星', level: 60, refinement: 1 },
    }
    const comparisonCandidates = [
      {
        loadouts: [
          {
            discs: candidateOneDiscs.map((disc) => ({
              disc: disc.slot === 6 ? { ...disc, mainStat: 'anomaly_mastery' as const } : disc,
            })),
          },
        ],
      },
      { loadouts: [{ discs: candidateDiscs.map((disc) => ({ disc })) }] },
    ] as DevelopmentCandidateAlternativesQueryResult['candidates']
    cacheDevelopmentCandidateSnapshot({
      contract: 'soda-development-candidate-alternatives/v1',
      comparisonContract: 'soda-explicit-development-comparison/v1',
      comparisonFingerprint: 'fixture-comparison',
      comparisonOptions: {
        wEngines: [{ engineId: 'wengine-13001', name: '街头巨星' }],
        potentialSupported: false,
      },
      runId: 'aria-route-run',
      capturedAt: '2026-09-07T00:00:00.000Z',
      inputFingerprint: 'aria-fingerprint',
      accountId: 'comparison-account',
      agentId: 'agent-aria',
      status: 'ready',
      sideEffect: 'read_only',
      buildIntent: {
        contract: 'soda-build-intent/v1',
        scope: 'agent_independent',
        fingerprint: 'aria-intent',
      },
      baseline: candidateDiscs,
      candidates: [
        {
          totalScore: 426.6,
          loadouts: [
            {
              totalScore: 426.6,
              setPattern: '4+2',
              discs: candidateOneDiscs.map((disc) => ({
                disc: disc.slot === 6 ? { ...disc, mainStat: 'anomaly_mastery' as const } : disc,
                effectiveRolls: 4,
              })),
            },
          ],
        },
        {
          totalScore: 412.56,
          inventoryTransition: true,
          loadouts: [
            {
              totalScore: 412.56,
              setPattern: '4+2',
              discs: candidateDiscs.map((disc) => ({ disc, effectiveRolls: 4 })),
            },
          ],
        },
      ],
      presentation: projectDevelopmentCandidatePresentation('agent-aria'),
      panelPresentation: {
        ...projectDevelopmentComparisonPanels({
          warehouse: {
            accountId: 'comparison-account',
            discs: [...candidateDiscs, ...candidateOneDiscs],
            roster: { agents: [comparisonAgent] },
          } as Parameters<typeof projectDevelopmentComparisonPanels>[0]['warehouse'],
          drafts: [],
          agentId: 'agent-aria',
          baseline: candidateDiscs,
          candidates: comparisonCandidates,
        }),
      },
      gaps: [],
    } as unknown as DevelopmentCandidateAlternativesQueryResult)
    vi.mocked(useAccountDecisionWorld).mockReturnValue({
      status: 'current',
      refresh: vi.fn().mockImplementation(async () => {
        vi.mocked(useAccountDecisionWorld).mockReturnValue({
          ...useAccountDecisionWorld(),
          status: 'current',
          liveFingerprint: 'after-save',
        } as ReturnType<typeof useAccountDecisionWorld>)
        return { runId: 'after-save-run' }
      }),
      liveFingerprint: 'aria-fingerprint',
      run: {
        runId: 'aria-route-run',
        input: {
          warehouse: {
            accountId: 'comparison-account',
            discs: [...candidateDiscs, ...candidateOneDiscs],
            roster: {
              agents: [comparisonAgent],
            },
          },
        },
      },
    } as unknown as ReturnType<typeof useAccountDecisionWorld>)

    const view = render(
      <MemoryRouter initialEntries={['/development/agent-aria/compare']}>
        <Routes>
          <Route path="/development/:agentId/compare" element={<AgentLoadoutComparisonPage />} />
          <Route path="/development/:agentId" element={<ReturnLocation />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.queryByRole('heading', { name: '方案面板' })).not.toBeInTheDocument()
    expect(screen.getByRole('table', { name: '属性对比' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '副词条合计' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /方案 2/ }))
    expect(screen.getByRole('navigation', { name: '仓库方案比较' })).toHaveTextContent('副套待补齐')
    expect(screen.getByLabelText('当前方案操作')).toHaveTextContent('6号位：冲击力（建议异常掌控）')
    expect(screen.queryByText(/仓库缺少/)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '返回养成' }))
    expect(screen.getByTestId('returned-location')).toHaveTextContent(
      '/development/agent-aria?candidate=2',
    )
    view.unmount()

    render(
      <MemoryRouter initialEntries={['/development/agent-aria/compare']}>
        <Routes>
          <Route path="/development/:agentId/compare" element={<AgentLoadoutComparisonPage />} />
          <Route path="/development/:agentId" element={<ReturnLocation />} />
        </Routes>
      </MemoryRouter>,
    )
    await user.click(screen.getByRole('button', { name: /方案 2/ }))
    expect(screen.queryByText('显式音擎与潜能比较')).not.toBeInTheDocument()
    expect(screen.queryByText('3.2 逐次事件声明基准')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '读取条件定义' })).not.toBeInTheDocument()
    expect(saveCurrentAgentBuild).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: '重新搭配' }))
    await waitFor(() =>
      expect(getQueryComparisonMock()).toHaveBeenLastCalledWith('aria-route-run', 'agent-aria'),
    )
    expect(comparisonAgent.wEngineDetails.level).toBe(60)
    expect(saveCurrentAgentBuild).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: '保存为养成方案' }))
    await waitFor(() =>
      expect(saveCurrentAgentBuild).toHaveBeenCalledWith(
        'comparison-account',
        expect.objectContaining({
          selection: { agentIds: ['agent-aria'], bangbooId: null, scenario: expect.any(String) },
          warehouseRefs: candidateDiscs.map((disc) => disc.id),
          manualOverrides: expect.objectContaining({
            progressionDirection:
              '核心技优先升至 F；普攻 11+；闪避 7+；支援技 9+；特殊技 9+；终结技 11+',
          }),
        }),
      ),
    )
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '保存为养成方案' })).not.toBeDisabled(),
    )
    expect(screen.getByRole('heading', { name: '方案比较' })).toBeInTheDocument()
    expect(screen.queryByTestId('returned-location')).not.toBeInTheDocument()
    const currentPlanButton = screen.getByRole('button', { name: /已保存方案/ })
    expect(currentPlanButton).toHaveTextContent('摇摆爵士 6件')
    await user.click(currentPlanButton)
    expect(currentPlanButton).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '已保存方案' })).toBeDisabled()
    expect(screen.getByLabelText('当前方案操作')).toHaveTextContent('6 / 6')
    const savedPayload = saveCurrentAgentBuild.mock.calls[0]?.[1]
    expect(savedPayload?.solutionContext.comparisonParameters).toBeUndefined()
    expect(savedPayload?.comparisonCapability).toBe('direction')
    expect(savedPayload?.candidateWarehouse?.inventoryTransition).toBe(true)
    expect(savedPayload?.warehouseRefs).toEqual(candidateDiscs.map((disc) => disc.id))
    expect(savedPayload?.warehouseRefs).not.toEqual(candidateOneDiscs.map((disc) => disc.id))
    expect(
      savedPayload?.warehouseRefs.some((id) => candidateOneDiscs.some((disc) => disc.id === id)),
    ).toBe(false)
    await user.click(screen.getByRole('button', { name: '返回养成' }))
    expect(screen.getByTestId('returned-location')).toHaveTextContent(
      '/development/agent-aria?plan=saved-aria',
    )
    sessionStorage.clear()
    vi.mocked(useAccountDecisionWorld).mockReset()
    saveCurrentAgentBuild.mockRestore()
  })
})
