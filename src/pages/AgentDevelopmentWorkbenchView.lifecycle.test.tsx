import type { ComponentProps } from 'react'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import { AgentDevelopmentWorkbenchView } from './AgentDevelopmentWorkbenchView'
import { createEmptyRoster } from '../assault/catalog'
import { Workbench } from '../features/agentDevelopmentGolden/AgentDevelopmentWorkbench'
import { workbench } from '../features/agentDevelopmentGolden/AgentDevelopmentGolden.workbench.testFixture'

const mocks = vi.hoisted(() => ({
  golden: null as Record<string, unknown> | null,
  cache: vi.fn(() => true),
  save: vi.fn(),
  refreshCandidates: vi.fn(),
}))
vi.mock('../features/agentDevelopmentGolden', () => ({
  AgentDevelopmentGolden: (props: Record<string, unknown>) => {
    mocks.golden = props
    return null
  },
}))
vi.mock('./agentDevelopmentCandidateSession', () => ({
  cacheDevelopmentCandidateSnapshot: mocks.cache,
  readDevelopmentCandidateSnapshot: vi.fn(),
  refreshDevelopmentCandidatesAfterSave: mocks.refreshCandidates,
}))
vi.mock('../accounts/planningDrafts', () => ({ saveCurrentAgentBuild: mocks.save }))
vi.mock('./agentDevelopmentSavedPlan', () => ({ createAgentDevelopmentSavedPlan: vi.fn() }))
vi.mock('../application/publicDevelopmentWorkbenchRoute', () => ({
  isCurrentDevelopmentWorkbenchRoute: vi.fn(() => true),
}))

type Props = ComponentProps<typeof AgentDevelopmentWorkbenchView>
type RouteResult = Awaited<ReturnType<Props['queryDevelopmentWorkbenchRoute']>>
function props(query: Props['queryDevelopmentCandidateAlternatives']): Props {
  return {
    agentId: 'agent-billy',
    accountId: 'isolated-a',
    agentName: '比利',
    roster: createEmptyRoster('2026-10-04T00:00:00.000Z'),
    workbenchData: { discs: [] } as unknown as Props['workbenchData'],
    savingThisAgent: false,
    editingThisAgent: false,
    candidateSnapshotStale: false,
    retainingDuringSave: false,
    saveRefresh: null,
    editingPresentation: null,
    decisionWorld: {
      status: 'current',
      liveFingerprint: 'isolated-input',
      run: {
        runId: 'isolated-run',
        inputFingerprint: 'isolated-input',
        input: { warehouse: { discs: [] } },
      },
    } as unknown as Props['decisionWorld'],
    queryDevelopmentCandidateAlternatives: query,
    queryDevelopmentWorkbenchRoute: vi.fn().mockResolvedValue({}),
    candidates: [],
    candidateSnapshot: null,
    equipment: null,
    requestedPlanId: null,
    selectedCandidateRank: 1,
    setAnalysisVersion: vi.fn(),
    setWarehouseRefresh: vi.fn(),
    setEditingPresentation: vi.fn(),
    setEditingCurrent: vi.fn(),
    setSaveRefresh: vi.fn(),
    setRouteRead: vi.fn(),
    setLastRouteProjection: vi.fn(),
  }
}
beforeEach(() => vi.clearAllMocks())

it.each(['unmount', 'agent', 'account'] as const)(
  'discards a delayed warehouse match after %s rather than caching it into a departed page',
  async (change) => {
    let resolve!: (value: unknown) => void
    const query = vi.fn(
      () =>
        new Promise((done) => {
          resolve = done
        }),
    )
    const initial = props(query as Props['queryDevelopmentCandidateAlternatives'])
    const view = render(<AgentDevelopmentWorkbenchView {...initial} />, { wrapper: MemoryRouter })
    const analyze = mocks.golden!.onAnalyzeWarehouse as () => Promise<void>
    const pending = analyze()
    if (change === 'unmount') view.unmount()
    else
      view.rerender(
        <AgentDevelopmentWorkbenchView
          {...initial}
          agentId={change === 'agent' ? 'agent-anby' : initial.agentId}
          accountId={change === 'account' ? 'isolated-b' : initial.accountId}
        />,
      )
    await act(async () => {
      resolve({ gaps: [] })
      await pending
    })
    expect(mocks.cache).not.toHaveBeenCalled()
    expect(initial.setAnalysisVersion).not.toHaveBeenCalled()
  },
)

it('still accepts a delayed match while the same page remains active', async () => {
  const result = {
    status: 'ready',
    gaps: [],
    accountId: 'isolated-a',
    agentId: 'agent-billy',
    runId: 'isolated-run',
    inputFingerprint: 'isolated-input',
    candidates: [],
  }
  const initial = props(vi.fn().mockResolvedValue(result))
  render(<AgentDevelopmentWorkbenchView {...initial} />, { wrapper: MemoryRouter })
  await act(async () => {
    await (mocks.golden!.onAnalyzeWarehouse as () => Promise<void>)()
  })
  expect(mocks.cache).toHaveBeenCalledWith(result)
  expect(initial.setAnalysisVersion).toHaveBeenCalledOnce()
})

it.each(['unmount', 'agent', 'account'] as const)(
  'discards a delayed rejection after %s',
  async (change) => {
    let reject!: (error: Error) => void
    const initial = props(
      vi.fn(
        () =>
          new Promise<Awaited<ReturnType<Props['queryDevelopmentCandidateAlternatives']>>>(
            (_resolve, fail) => {
              reject = fail
            },
          ),
      ),
    )
    const view = render(<AgentDevelopmentWorkbenchView {...initial} />, { wrapper: MemoryRouter })
    const pending = (mocks.golden!.onAnalyzeWarehouse as () => Promise<void>)()
    if (change === 'unmount') view.unmount()
    else
      view.rerender(
        <AgentDevelopmentWorkbenchView
          {...initial}
          agentId={change === 'agent' ? 'agent-anby' : initial.agentId}
          accountId={change === 'account' ? 'isolated-b' : initial.accountId}
        />,
      )
    reject(new Error('旧角色请求失败'))
    await expect(pending).resolves.toBeUndefined()
    expect(mocks.cache).not.toHaveBeenCalled()
    expect(initial.setAnalysisVersion).not.toHaveBeenCalled()
  },
)

it('keeps a reused workbench ready for the new agent and ignores the old rejection during its new match', async () => {
  let rejectOld!: (error: Error) => void
  let resolveNew!: () => void
  const analyzeOld = vi.fn(
    () =>
      new Promise<void>((_resolve, reject) => {
        rejectOld = reject
      }),
  )
  const analyzeNew = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        resolveNew = resolve
      }),
  )
  const navigate = vi.fn()
  const data = {
    ...workbench,
    discs: [],
    hasComparablePlan: false,
    warehouseAnalysis: { status: 'idle' as const, summary: '' },
  }
  const base = { toOverview: vi.fn(), toTop10: navigate, scenario: 'current' as const }
  const user = userEvent.setup()
  const view = render(<Workbench {...base} data={data} onAnalyzeWarehouse={analyzeOld} />, {
    wrapper: MemoryRouter,
  })
  const heading = screen.getByRole('heading', { name: '比利' })
  await user.click(screen.getByRole('button', { name: '比较其他配装' }))
  expect(screen.getByRole('button', { name: '正在搭配…' })).toBeDisabled()
  view.rerender(
    <Workbench
      {...base}
      data={{ ...data, agentId: 'agent-anby', name: '安比' }}
      onAnalyzeWarehouse={analyzeNew}
    />,
  )
  expect(screen.getByRole('heading', { name: '安比' })).toBe(heading)
  expect(screen.getByRole('button', { name: '从仓库搭配' })).toBeEnabled()
  await user.click(screen.getByRole('button', { name: '从仓库搭配' }))
  await act(async () => {
    rejectOld(new Error('旧角色请求失败'))
  })
  expect(screen.getByRole('button', { name: '正在搭配…' })).toBeDisabled()
  expect(screen.queryByText('旧角色请求失败')).not.toBeInTheDocument()
  expect(navigate).not.toHaveBeenCalled()
  expect(analyzeNew).toHaveBeenCalledOnce()
  await act(async () => {
    resolveNew()
  })
  expect(screen.getByRole('button', { name: '从仓库搭配' })).toBeEnabled()
})

it('does not publish a candidate before its matching route is ready, and keeps errors local', async () => {
  const result = {
    status: 'ready',
    gaps: [],
    accountId: 'isolated-a',
    agentId: 'agent-billy',
    runId: 'isolated-run',
    inputFingerprint: 'isolated-input',
    candidates: [],
  }
  let reject!: (error: Error) => void
  const initial = props(vi.fn().mockResolvedValue(result))
  initial.queryDevelopmentWorkbenchRoute = vi.fn(
    () =>
      new Promise<RouteResult>((_resolve, fail) => {
        reject = fail
      }),
  )
  render(<AgentDevelopmentWorkbenchView {...initial} />, { wrapper: MemoryRouter })
  const pending = (mocks.golden!.onAnalyzeWarehouse as () => Promise<void>)()
  await act(async () => {
    await Promise.resolve()
  })
  expect(initial.queryDevelopmentWorkbenchRoute).toHaveBeenCalledOnce()
  expect(mocks.cache).not.toHaveBeenCalled()
  expect(initial.setAnalysisVersion).not.toHaveBeenCalled()
  reject(new Error('route unavailable'))
  await expect(pending).rejects.toThrow('route unavailable')
  expect(mocks.cache).not.toHaveBeenCalled()
  expect(initial.setWarehouseRefresh).toHaveBeenCalledOnce()
})

it.each(['fingerprint', 'rank'] as const)(
  'rejects a delayed projection after the %s changes',
  async (change) => {
    const result = {
      status: 'ready',
      gaps: [],
      accountId: 'isolated-a',
      agentId: 'agent-billy',
      runId: 'isolated-run',
      inputFingerprint: 'isolated-input',
      candidates: [],
    }
    let resolve!: (value: RouteResult) => void
    const initial = props(vi.fn().mockResolvedValue(result))
    initial.queryDevelopmentWorkbenchRoute = vi.fn(
      () =>
        new Promise<RouteResult>((done) => {
          resolve = done
        }),
    )
    const view = render(<AgentDevelopmentWorkbenchView {...initial} />, { wrapper: MemoryRouter })
    const pending = (mocks.golden!.onAnalyzeWarehouse as () => Promise<void>)()
    await act(async () => {
      await Promise.resolve()
    })
    view.rerender(
      <AgentDevelopmentWorkbenchView
        {...initial}
        selectedCandidateRank={change === 'rank' ? 2 : 1}
        decisionWorld={
          {
            ...initial.decisionWorld,
            liveFingerprint: change === 'fingerprint' ? 'updated-input' : 'isolated-input',
          } as Props['decisionWorld']
        }
      />,
    )
    resolve({} as RouteResult)
    await expect(pending).rejects.toThrow('仓库或配装选择已变化')
    expect(mocks.cache).not.toHaveBeenCalled()
    expect(initial.setAnalysisVersion).not.toHaveBeenCalled()
  },
)

it('does not refresh or redirect a new agent after an already requested save finishes', async () => {
  let resolve!: () => void
  mocks.save.mockImplementation(
    () =>
      new Promise<void>((done) => {
        resolve = done
      }),
  )
  const initial = props(vi.fn())
  initial.equipment = {} as NonNullable<Props['equipment']>
  initial.candidates = [
    {
      loadouts: [
        {
          discs: Array.from({ length: 6 }, (_, index) => ({
            disc: { id: `isolated-${index}` },
          })),
        },
      ],
    },
  ] as Props['candidates']
  const view = render(<AgentDevelopmentWorkbenchView {...initial} />, { wrapper: MemoryRouter })
  const save = mocks.golden!.onSavePlan as (rank: number) => Promise<void>
  const pending = save(1)
  expect(mocks.save).toHaveBeenCalledOnce()
  view.rerender(<AgentDevelopmentWorkbenchView {...initial} agentId="agent-anby" />)
  await act(async () => {
    resolve()
    await pending
  })
  expect(mocks.refreshCandidates).not.toHaveBeenCalled()
  expect(initial.setRouteRead).not.toHaveBeenCalled()
  expect(initial.setAnalysisVersion).not.toHaveBeenCalled()
})
