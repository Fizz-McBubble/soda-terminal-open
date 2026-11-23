import { mocks, type Props, type RouteResult } from './agentDevelopmentWorkbenchViewLifecycleMocks'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ReturnLocation } from './AgentLoadoutComparisonPage.testFixture'
import { expect, it, vi } from 'vitest'
import { AgentDevelopmentWorkbenchView } from './AgentDevelopmentWorkbenchView'
import {
  createWorkbenchViewProps as props,
  createWorkbenchCandidateResult as candidateResult,
} from './agentDevelopmentWorkbenchViewTestSupport'
import { Workbench } from '../features/agentDevelopmentGolden/AgentDevelopmentWorkbench'
import { workbench } from '../features/agentDevelopmentGolden/AgentDevelopmentGolden.workbench.testFixture'
import { developmentCurrentRecordBinding } from '../application/publicDevelopmentWorkbenchRoute'

it('does not publish a saved edit refresh into an account the player switched to', async () => {
  let resolve!: (value: Props['decisionWorld']['run']) => void
  const initial = props(vi.fn())
  initial.workbenchData = workbench
  initial.queryDevelopmentWorkbenchRoute = vi.fn(
    async (_runId, selection, record) =>
      ({
        status: 'ready',
        accountId: initial.accountId,
        selection,
        currentRecordBinding: record ? developmentCurrentRecordBinding(record) : undefined,
      }) as RouteResult,
  )
  initial.editingThisAgent = true
  initial.editingPresentation = {
    accountId: initial.accountId,
    presentation: initial.workbenchData,
  }
  initial.decisionWorld = {
    ...initial.decisionWorld,
    refresh: vi.fn(
      () =>
        new Promise<Props['decisionWorld']['run']>((done) => {
          resolve = done
        }),
    ),
  }
  const view = render(<AgentDevelopmentWorkbenchView {...initial} />, {
    wrapper: MemoryRouter,
  })
  let pending!: Promise<void>
  await act(async () => {
    pending = mocks.editor!.onSaved(initial.roster)
  })
  view.rerender(<AgentDevelopmentWorkbenchView {...initial} accountId="isolated-b" />)
  await act(async () => {
    resolve(initial.decisionWorld.run)
    await pending
  })
  expect(initial.queryDevelopmentWorkbenchRoute).toHaveBeenCalledOnce()
  expect(initial.setRouteRead).not.toHaveBeenCalled()
  expect(initial.setEditingCurrent).toHaveBeenCalledTimes(1)
})

it('opens comparison on the same candidate shown in the workbench, including a clamped route', async () => {
  const initial = props(vi.fn())
  initial.selectedCandidateRank = 25
  initial.workbenchData = {
    ...initial.workbenchData,
    selectedCandidateRank: 2,
  }
  render(
    <MemoryRouter initialEntries={['/development/agent-billy?candidate=25']}>
      <AgentDevelopmentWorkbenchView {...initial} />
      <ReturnLocation />
    </MemoryRouter>,
  )
  await act(async () => {
    ;(mocks.golden!.onNavigate as (view: string) => void)('top10')
  })
  expect(screen.getByTestId('returned-location')).toHaveTextContent(
    '/development/agent-billy/loadouts?candidate=2',
  )
})

it('retains committed current facts and panel after analysis failure, with editing and retry available', async () => {
  const initial = props(vi.fn())
  initial.workbenchData = workbench
  initial.editingThisAgent = true
  initial.editingPresentation = {
    accountId: initial.accountId,
    presentation: workbench,
  }
  const savedRoster = {
    ...initial.roster,
    agents: initial.roster.agents.map((agent) =>
      agent.agentId === initial.agentId ? { ...agent, level: 59 } : agent,
    ),
  }
  initial.decisionWorld = {
    ...initial.decisionWorld,
    refresh: vi.fn().mockResolvedValue(null),
  }
  initial.queryDevelopmentWorkbenchRoute = vi.fn(
    async (_runId, selection, record) =>
      ({
        status: 'ready',
        accountId: initial.accountId,
        selection,
        currentRecordBinding: record ? developmentCurrentRecordBinding(record) : undefined,
        workbench: {
          slices: {
            currentPanel: {
              availability: 'available',
              facts: [{ label: '攻击力', current: '1234' }],
            },
          },
        },
        panel: { source: '当前已装备', result: { status: 'ok' } },
      }) as RouteResult,
  )
  const view = render(<AgentDevelopmentWorkbenchView {...initial} />, {
    wrapper: MemoryRouter,
  })
  await act(async () => {
    await mocks.editor!.onSaved(savedRoster)
  })
  const retained = vi.mocked(initial.setSaveRefresh).mock.calls.at(-1)![0] as NonNullable<
    Props['saveRefresh']
  >
  expect(retained.phase).toBe('failed')
  expect(retained.stage).toBe('account')
  expect(retained.presentation.level).toBe(59)
  expect(retained.presentation.panelFacts[0].value).toBe('1234')
  expect(initial.setSaveRefresh).not.toHaveBeenCalledWith(null)
  view.rerender(
    <AgentDevelopmentWorkbenchView
      {...initial}
      editingThisAgent={false}
      savingThisAgent={false}
      saveRefresh={retained}
    />,
  )
  expect((mocks.golden!.workbench as Props['workbenchData']).level).toBe(59)
  expect(mocks.golden!.onEditCurrent).toBeTypeOf('function')
  expect(mocks.golden!.currentUpdate as { message: string }).toMatchObject({
    message: '养成建议更新失败',
    tone: 'failed',
  })
  expect((mocks.golden!.currentUpdate as { onRetry: unknown }).onRetry).toBeTypeOf('function')
})

it('stops at a retryable panel failure without misreporting the account-wide refresh', async () => {
  const initial = props(vi.fn())
  initial.workbenchData = workbench
  initial.editingThisAgent = true
  initial.editingPresentation = {
    accountId: initial.accountId,
    presentation: workbench,
  }
  initial.queryDevelopmentWorkbenchRoute = vi
    .fn()
    .mockRejectedValue(new Error('当前面板查询超时。'))
  initial.decisionWorld = {
    ...initial.decisionWorld,
    refresh: vi.fn(),
  }
  const view = render(<AgentDevelopmentWorkbenchView {...initial} />, {
    wrapper: MemoryRouter,
  })
  await act(async () => {
    await mocks.editor!.onSaved(initial.roster)
  })
  const retained = vi.mocked(initial.setSaveRefresh).mock.calls.at(-1)![0] as NonNullable<
    Props['saveRefresh']
  >
  expect(retained).toMatchObject({
    phase: 'failed',
    stage: 'panel',
    error: '资料已保存。当前面板查询超时。',
  })
  expect(initial.decisionWorld.refresh).not.toHaveBeenCalled()
  view.rerender(
    <AgentDevelopmentWorkbenchView
      {...initial}
      editingThisAgent={false}
      savingThisAgent={false}
      saveRefresh={retained}
    />,
  )
  expect(mocks.golden!.currentUpdate).toMatchObject({
    message: '面板更新失败',
    detail: undefined,
    tone: 'failed',
  })
  expect((mocks.golden!.currentUpdate as { message: string }).message).not.toMatch(/重新编辑/)
  expect((mocks.golden!.currentUpdate as { onRetry: unknown }).onRetry).toBeTypeOf('function')
})

it('recreates a missing run when retrying the saved panel without saving again', async () => {
  const initial = props(vi.fn())
  initial.workbenchData = workbench
  initial.editingThisAgent = true
  const recoveredRun = initial.decisionWorld.run!
  const refresh = vi.fn().mockResolvedValue(recoveredRun)
  initial.decisionWorld = {
    ...initial.decisionWorld,
    status: 'error',
    run: null,
    refresh,
  } as Props['decisionWorld']
  initial.queryDevelopmentWorkbenchRoute = vi.fn(
    async (_runId, selection, record) =>
      ({
        status: 'ready',
        accountId: initial.accountId,
        selection,
        currentRecordBinding: record ? developmentCurrentRecordBinding(record) : undefined,
        workbench: {
          slices: { currentPanel: { availability: 'available', facts: [] } },
        },
        panel: { source: '当前已装备', result: { status: 'ok' } },
      }) as unknown as RouteResult,
  )
  render(<AgentDevelopmentWorkbenchView {...initial} />, {
    wrapper: MemoryRouter,
  })
  await act(async () => {
    await mocks.editor!.onSaved(initial.roster)
  })
  expect(initial.queryDevelopmentWorkbenchRoute).toHaveBeenCalledWith(
    recoveredRun.runId,
    expect.anything(),
    expect.anything(),
  )
  expect(initial.setSaveRefresh).toHaveBeenLastCalledWith(null)
  expect(mocks.save).not.toHaveBeenCalled()
})

it('keeps the last workbench presentation when a stale account refresh fails', () => {
  const initial = props(vi.fn())
  const retry = vi.fn()
  initial.workbenchData = workbench
  initial.analysisRefresh = {
    key: 'stale-input',
    phase: 'failed',
    error: '本次分析超时；已保留上次结果。',
    onRetry: retry,
  }
  initial.decisionWorld = {
    ...initial.decisionWorld,
    status: 'error',
    run: null,
    liveInput: initial.decisionWorld.run!.input,
    message: '本次分析超时。',
  } as Props['decisionWorld']

  render(<AgentDevelopmentWorkbenchView {...initial} />, {
    wrapper: MemoryRouter,
  })

  expect(mocks.golden!.workbench).toEqual({
    ...workbench,
    saveScopeKey: expect.any(String),
  })
  expect(mocks.golden!.currentUpdate).toMatchObject({
    message: '养成建议更新失败',
    detail: undefined,
    tone: 'failed',
  })
  ;(mocks.golden!.currentUpdate as { onRetry: () => void }).onRetry()
  expect(retry).toHaveBeenCalledOnce()
})

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
    const view = render(<AgentDevelopmentWorkbenchView {...initial} />, {
      wrapper: MemoryRouter,
    })
    const analyze = mocks.golden!.onAnalyzeWarehouse as () => Promise<void>
    const pending = analyze()
    await waitFor(() =>
      expect(initial.queryDevelopmentCandidateAlternatives).toHaveBeenCalledOnce(),
    )
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
  render(<AgentDevelopmentWorkbenchView {...initial} />, {
    wrapper: MemoryRouter,
  })
  await act(async () => {
    await (mocks.golden!.onAnalyzeWarehouse as () => Promise<void>)()
  })
  expect(mocks.cache).toHaveBeenCalledWith(result)
  expect(initial.setAnalysisVersion).toHaveBeenCalledOnce()
  expect(initial.queryDevelopmentWorkbenchRoute).toHaveBeenCalledOnce()
})

it('caches and hands a default compare result to comparison without publishing the workbench route', async () => {
  const result = candidateResult()
  const initial = props(vi.fn().mockResolvedValue(result))
  initial.workbenchData = workbench
  render(<AgentDevelopmentWorkbenchView {...initial} />, {
    wrapper: MemoryRouter,
  })

  await act(async () => {
    await (mocks.golden!.onAnalyzeWarehouse as (intent: string) => Promise<void>)('compare')
  })

  expect(mocks.cache).toHaveBeenCalledWith(result)
  expect(initial.queryDevelopmentWorkbenchRoute).not.toHaveBeenCalled()
  expect(initial.setRouteRead).not.toHaveBeenCalled()
  expect(initial.setLastRouteProjection).not.toHaveBeenCalled()
  expect(initial.setAnalysisVersion).not.toHaveBeenCalled()
})

it('keeps route publication and cleanup for an explicit generate request', async () => {
  const result = candidateResult()
  const initial = props(vi.fn().mockResolvedValue(result))
  initial.workbenchData = workbench
  render(<AgentDevelopmentWorkbenchView {...initial} />, {
    wrapper: MemoryRouter,
  })

  await act(async () => {
    await (mocks.golden!.onAnalyzeWarehouse as (intent: string) => Promise<void>)('generate')
  })

  expect(initial.queryDevelopmentWorkbenchRoute).toHaveBeenCalledOnce()
  expect(mocks.cache).toHaveBeenCalledWith(result)
  expect(initial.setRouteRead).toHaveBeenCalledOnce()
  expect(initial.setLastRouteProjection).toHaveBeenCalledOnce()
  expect(initial.setAnalysisVersion).toHaveBeenCalledOnce()
})

it('keeps the verified route path for explicit comparison parameters', async () => {
  const result = candidateResult()
  const initial = props(vi.fn().mockResolvedValue(result))
  initial.workbenchData = workbench
  initial.candidateSnapshot = {
    candidateParametersByRank: { 1: { potential: 0 } },
  } as unknown as Props['candidateSnapshot']
  render(<AgentDevelopmentWorkbenchView {...initial} />, {
    wrapper: MemoryRouter,
  })

  await act(async () => {
    await (mocks.golden!.onAnalyzeWarehouse as (intent: string) => Promise<void>)('compare')
  })

  expect(initial.queryDevelopmentWorkbenchRoute).toHaveBeenCalledOnce()
  expect(initial.setRouteRead).toHaveBeenCalledOnce()
  expect(initial.setAnalysisVersion).toHaveBeenCalledOnce()
})

it('does not cache a compare result after the account changes while the route module is pending', async () => {
  let resolve!: (value: ReturnType<typeof candidateResult>) => void
  const initial = props(
    vi.fn(
      () =>
        new Promise<ReturnType<typeof candidateResult>>((done) => {
          resolve = done
        }),
    ) as Props['queryDevelopmentCandidateAlternatives'],
  )
  initial.workbenchData = workbench
  const view = render(<AgentDevelopmentWorkbenchView {...initial} />, {
    wrapper: MemoryRouter,
  })
  const pending = (mocks.golden!.onAnalyzeWarehouse as (intent: string) => Promise<void>)('compare')
  await waitFor(() => expect(initial.queryDevelopmentCandidateAlternatives).toHaveBeenCalledOnce())
  view.rerender(<AgentDevelopmentWorkbenchView {...initial} accountId="isolated-b" />)
  await act(async () => {
    resolve(candidateResult())
    await pending
  })

  expect(mocks.cache).not.toHaveBeenCalled()
  expect(initial.queryDevelopmentWorkbenchRoute).not.toHaveBeenCalled()
  expect(initial.setAnalysisVersion).not.toHaveBeenCalled()
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
    const view = render(<AgentDevelopmentWorkbenchView {...initial} />, {
      wrapper: MemoryRouter,
    })
    const pending = (mocks.golden!.onAnalyzeWarehouse as () => Promise<void>)()
    await waitFor(() =>
      expect(initial.queryDevelopmentCandidateAlternatives).toHaveBeenCalledOnce(),
    )
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
  const base = {
    toOverview: vi.fn(),
    toTop10: navigate,
    scenario: 'current' as const,
  }
  const user = userEvent.setup()
  const view = render(<Workbench {...base} data={data} onAnalyzeWarehouse={analyzeOld} />, {
    wrapper: MemoryRouter,
  })
  const heading = screen.getByRole('heading', { name: '比利' })
  await user.click(screen.getByRole('button', { name: '从仓库搭配并比较' }))
  expect(screen.getByRole('button', { name: '正在搭配…' })).toBeDisabled()
  view.rerender(
    <Workbench
      {...base}
      data={{ ...data, agentId: 'agent-anby', name: '安比' }}
      onAnalyzeWarehouse={analyzeNew}
    />,
  )
  expect(screen.getByRole('heading', { name: '安比' })).toBe(heading)
  expect(screen.getByRole('button', { name: '从仓库搭配并比较' })).toBeEnabled()
  await user.click(screen.getByRole('button', { name: '从仓库搭配并比较' }))
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
  expect(screen.getByRole('button', { name: '从仓库搭配并比较' })).toBeEnabled()
})

it('does not publish a candidate before its matching route is ready, and keeps errors local', async () => {
  const result = { ...candidateResult(), candidates: [] }
  let reject!: (error: Error) => void
  const initial = props(vi.fn().mockResolvedValue(result))
  initial.queryDevelopmentWorkbenchRoute = vi.fn(
    () =>
      new Promise<RouteResult>((_resolve, fail) => {
        reject = fail
      }),
  )
  render(<AgentDevelopmentWorkbenchView {...initial} />, {
    wrapper: MemoryRouter,
  })
  const pending = (mocks.golden!.onAnalyzeWarehouse as () => Promise<void>)()
  await waitFor(() => expect(initial.queryDevelopmentWorkbenchRoute).toHaveBeenCalledOnce())
  expect(mocks.cache).not.toHaveBeenCalled()
  expect(initial.setAnalysisVersion).not.toHaveBeenCalled()
  reject(new Error('route unavailable'))
  await expect(pending).rejects.toThrow('route unavailable')
  expect(mocks.cache).not.toHaveBeenCalled()
  expect(initial.setAnalysisVersion).not.toHaveBeenCalled()
  const refreshCalls = vi.mocked(initial.setWarehouseRefresh).mock.calls
  expect(refreshCalls).toHaveLength(2)
  const [[started], [settle]] = refreshCalls
  if (!started || typeof started === 'function' || typeof settle !== 'function') {
    throw new Error('Expected refresh start followed by a local failure transition')
  }
  expect(started).toMatchObject({
    accountId: initial.accountId,
    agentId: initial.agentId,
    inFlight: true,
    presentation: initial.workbenchData,
  })
  expect(settle(started)).toEqual({ ...started, inFlight: false })
})

it.each(['fingerprint', 'rank'] as const)(
  'rejects a delayed projection after the %s changes',
  async (change) => {
    const result = { ...candidateResult(), candidates: [] }
    let resolve!: (value: RouteResult) => void
    const initial = props(vi.fn().mockResolvedValue(result))
    initial.queryDevelopmentWorkbenchRoute = vi.fn(
      () =>
        new Promise<RouteResult>((done) => {
          resolve = done
        }),
    )
    const view = render(<AgentDevelopmentWorkbenchView {...initial} />, {
      wrapper: MemoryRouter,
    })
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
