import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import type { ComponentProps, ReactNode } from 'react'
import type { CoreWarehouse } from '../../accounts/coreWarehouse'
import { TeamAnalysisOverviewView } from './TeamAnalysisOverviewView'
import { CalculationQueryClientContext } from '../../application/accountDecisionWorldHooks'
import type { CalculationQueryClient } from '../../application/calculationQueryContract'
import { planningScenarioSelection32 } from '../../application/publicPlanningScenarioContract'
import { currentTeamAnalysisSession, setCurrentTeamAnalysisSession } from '../teamAnalysisSession'
import { useTeamPickerQueries } from './useTeamPickerQueries'
import { teamLoadoutPresentationContract } from '../teamLoadoutPresentationDto'

const mocks = vi.hoisted(() => ({ navigate: vi.fn(), outcome: vi.fn() }))
vi.mock('react-router-dom', () => ({ useNavigate: () => mocks.navigate }))
// This suite exercises analysis/route lifecycles through the query client.
// Unused dialog and constraint UI must not load the solver graph into the test worker.
vi.mock('../SavedOverviewDeleteDialog', () => ({ SavedOverviewDeleteDialog: () => null }))
vi.mock('../TeamLoadoutOverviewParts', () => ({ TeamConstraintResetPanel: () => null }))
vi.mock('../../usageStatistics/client', () => ({
  beginUsageOperation: () => {
    let finished = false
    return (outcome: string) => {
      if (finished) return
      finished = true
      mocks.outcome(outcome)
    }
  },
}))
vi.mock('../TeamLoadoutOverview', () => ({
  TeamLoadoutOverview: (props: {
    onSelect: (id: string) => void
    onPrimaryAction: (
      item: unknown,
      bangboo?: { bangbooId: string; stars: 1 | 2 | 3 | 4 | 5 },
    ) => void
    recommendationBlock?: { reasons: readonly string[] }
    onReanalyze?: () => void
    scopeActions?: ReactNode
  }) => (
    <>
      {props.scopeActions}
      {props.recommendationBlock ? (
        <>
          <p role="status">{props.recommendationBlock.reasons.join('；')}</p>
          <button onClick={props.onReanalyze}>Retry analysis</button>
        </>
      ) : null}
      <button onClick={() => props.onSelect('B')}>Select B</button>
      <button
        onClick={() =>
          props.onPrimaryAction(
            { id: 'A', kind: 'recommended', detailCandidateId: 'A', destination: '/A' },
            { bangbooId: 'bangboo-robin', stars: 2 },
          )
        }
      >
        Generate selected Bangboo
      </button>
      {['A', 'B'].map((id) => (
        <button
          key={id}
          onClick={() =>
            props.onPrimaryAction({
              id,
              kind: 'recommended',
              detailCandidateId: id,
              destination: '/' + id,
            })
          }
        >
          Generate {id}
        </button>
      ))}
    </>
  ),
}))

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

type Props = ComponentProps<typeof TeamAnalysisOverviewView>
function setup(
  queryTeamRoute: ReturnType<typeof vi.fn>,
  calculate: ReturnType<typeof vi.fn>,
  remainingBox = false,
  options: { blockers?: string[]; runLost?: boolean } = {},
) {
  const warehouse: CoreWarehouse = {
    accountId: 'account',
    account: null,
    discs: [],
    roster: {
      schemaVersion: 3,
      sourceCompleteness: 'complete',
      agents: [],
      bangboos: [],
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  }
  const result = {
    appSessionId: 'app',
    warehouse,
    analysisRunId: 'run',
    inputFingerprint: 'fingerprint',
    ...(remainingBox ? { sourceRunId: 'source', reservations: [{ planId: 'saved-first' }] } : {}),
    capturedAt: new Date(),
    decisionSnapshot: {
      decisionAuthority: {
        status: options.blockers ? 'blocked' : 'ready',
        blockers: options.blockers ?? [],
      },
      fingerprint: { inputHash: remainingBox ? 'remaining-fingerprint' : 'fingerprint' },
      hardConstraints: { active: [] },
      portfolioInput: { preference: { teamCount: 1 } },
    },
    overviewModel: { groups: [], initialSelectedId: null },
    targetTeamFits: {},
  }
  // Synthetic lifecycle stub: presentation and producer snapshot contain only
  // the fields consumed here; TeamLoadoutOverview is mocked above.
  const analysis = { kind: 'complete', result } as unknown as Props['analysis']
  setCurrentTeamAnalysisSession(analysis)
  const props = {
    analysis,
    accountSummary: { accountId: 'account', appSessionId: 'app', hydrating: false },
    decisionWorld: {
      status: 'current',
      ...(options.runLost
        ? { analysisIssue: { kind: 'run_lost', message: '当前分析暂不可用，请重新分析。' } }
        : {}),
      liveFingerprint: 'fingerprint',
      run: {
        runId: remainingBox ? 'source' : 'run',
        input: { warehouse: { accountId: 'account' } },
      },
    },
    queryTeamRoute,
    calculateTargetTeamWarehouseFit: calculate,
    prepareRequest: { current: 0 },
    analysisRequest: { current: 0 },
    setPreparingItemId: vi.fn(),
    setPreparationError: vi.fn(),
    setRequestedSelectedId: vi.fn(),
    setOverviewFeedback: vi.fn(),
    queueFitOverview: vi.fn(),
    setAnalysis: vi.fn(),
    setLastCompleteAnalysis: vi.fn(),
    startAnalysis: vi.fn(),
    startRemainingBoxAnalysis: vi.fn(),
  } as unknown as Props
  const client = { calculateTargetTeamWarehouseFit: calculate } as unknown as CalculationQueryClient
  render(
    <CalculationQueryClientContext.Provider value={client}>
      <TeamAnalysisOverviewView {...props} />
    </CalculationQueryClientContext.Provider>,
  )
  return props
}
const entry = (id: string) => ({ team: { id, bangbooId: 'bangboo' }, targetCandidateId: id })
beforeEach(() => {
  vi.clearAllMocks()
  setCurrentTeamAnalysisSession(null)
})

it.each([false, true])(
  'passes an authority block to the page and retries the same analysis scope (remaining BOX: %s)',
  (remainingBox) => {
    const query = vi.fn()
    const calculate = vi.fn()
    const reason = '通用队伍榜单尚未就绪，请更新资料后重试。'
    const props = setup(query, calculate, remainingBox, { blockers: [reason], runLost: true })
    expect(screen.getByText(reason)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '重新分析' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Retry analysis' }))
    expect(
      remainingBox ? props.startRemainingBoxAnalysis : props.startAnalysis,
    ).toHaveBeenCalledOnce()
    if (!remainingBox) expect(props.startAnalysis).toHaveBeenCalledWith({ forceRefresh: true })
    expect(
      remainingBox ? props.startAnalysis : props.startRemainingBoxAnalysis,
    ).not.toHaveBeenCalled()
    expect(query).not.toHaveBeenCalled()
    expect(calculate).not.toHaveBeenCalled()
  },
)

it('passes the selected Bangboo and stars into the exact target calculation', async () => {
  const calculate = vi.fn().mockResolvedValue({ status: 'ready', candidateId: 'A' })
  setup(
    vi.fn().mockResolvedValue({
      ...entry('A'),
      team: { id: 'A', bangbooId: null },
      automaticBangboo: null,
    }),
    calculate,
  )
  fireEvent.click(screen.getByText('Generate selected Bangboo'))
  await waitFor(() =>
    expect(calculate).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'run',
        candidateId: 'A',
        playerBangbooSelection: { teamKey: 'A', bangbooId: 'bangboo-robin', bangbooStars: 2 },
      }),
    ),
  )
  await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/A'))
})

it('reuses a source-bound equipment baseline, then recalculates with the selected Bangboo', async () => {
  const scenarioSelection = planningScenarioSelection32('declared-stun-comparison')
  const potentialByAgentId = { 'agent-billy': 0 }
  const calculate = vi
    .fn()
    .mockResolvedValueOnce({
      status: 'ready',
      candidateId: 'A',
      scenarioSelection,
      standardReferenceRequest32: {
        stage: 'select',
        preparedIdentity: 'baseline-with-ariel',
        sourceBindingFingerprint: 'binding-with-ariel',
        potentialByAgentId,
      },
      effectiveEquipmentParameters: {
        wEngines: [],
        bangbooId: 'bangboo-ariel',
        bangbooStars: 5,
      },
    })
    .mockResolvedValueOnce({
      status: 'ready',
      candidateId: 'A',
      effectiveEquipmentParameters: {
        wEngines: [],
        bangbooId: 'bangboo-robin',
        bangbooStars: 2,
      },
    })
  setup(vi.fn().mockResolvedValue(entry('A')), calculate)
  fireEvent.click(screen.getByText('Generate selected Bangboo'))
  await waitFor(() => expect(calculate).toHaveBeenCalledTimes(2))
  expect(calculate.mock.calls[1]).toEqual([
    'run',
    'A',
    {
      wEngines: [],
      bangbooId: 'bangboo-robin',
      bangbooStars: 2,
    },
    scenarioSelection,
    undefined,
    undefined,
    { stage: 'prepare', potentialByAgentId },
  ])
  expect(
    currentTeamAnalysisSession?.result.targetTeamFits.A.effectiveEquipmentParameters?.bangbooId,
  ).toBe('bangboo-robin')
})

it('allows B while A is pending and keeps B claimed when A returns late', async () => {
  const a = deferred<unknown>()
  const b = deferred<unknown>()
  const calculate = vi.fn((_run: string, id: string) => (id === 'A' ? a.promise : b.promise))
  const props = setup(
    vi.fn((_result: unknown, id: string) => Promise.resolve(entry(id))),
    calculate,
  )
  fireEvent.click(screen.getByText('Generate A'))
  await waitFor(() => expect(calculate).toHaveBeenCalledTimes(1))
  fireEvent.click(screen.getByText('Select B'))
  fireEvent.click(screen.getByText('Generate B'))
  await waitFor(() => expect(calculate).toHaveBeenCalledTimes(2))
  await act(async () => {
    a.resolve({ status: 'ready', candidateId: 'A' })
  })
  expect(mocks.outcome.mock.calls).toEqual([['cancelled']])
  expect(mocks.navigate).not.toHaveBeenCalled()
  expect(currentTeamAnalysisSession?.result.targetTeamFits).toEqual({})
  fireEvent.click(screen.getByText('Generate B'))
  expect(calculate).toHaveBeenCalledTimes(2)
  await act(async () => {
    b.resolve({ status: 'ready', candidateId: 'B' })
  })
  expect(currentTeamAnalysisSession?.result.targetTeamFits).toEqual({
    B: { status: 'ready', candidateId: 'B' },
  })
  expect(mocks.navigate.mock.calls).toEqual([['/B']])
  expect(mocks.outcome.mock.calls).toEqual([['cancelled'], ['success']])
  expect(props.queueFitOverview).toHaveBeenCalledOnce()
})

it('records cancellation when a superseded route returns before calculation', async () => {
  const a = deferred<unknown>()
  const calculate = vi.fn().mockResolvedValue({ status: 'ready', candidateId: 'B' })
  setup(
    vi.fn((_result: unknown, id: string) => (id === 'A' ? a.promise : Promise.resolve(entry(id)))),
    calculate,
  )
  fireEvent.click(screen.getByText('Generate A'))
  fireEvent.click(screen.getByText('Select B'))
  fireEvent.click(screen.getByText('Generate B'))
  await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/B'))
  await act(async () => {
    a.resolve(entry('A'))
  })
  expect(calculate.mock.calls).toEqual([['run', 'B']])
  expect(mocks.outcome.mock.calls).toEqual([['success'], ['cancelled']])
  expect(mocks.navigate.mock.calls).toEqual([['/B']])
})

it('calculates a current remaining-BOX fit despite its detached input fingerprint', async () => {
  const calculate = vi.fn().mockResolvedValue({ status: 'ready', candidateId: 'A' })
  const props = setup(vi.fn().mockResolvedValue(entry('A')), calculate, true)
  fireEvent.click(screen.getByText('Generate A'))
  await waitFor(() => expect(calculate).toHaveBeenCalledWith('run', 'A'))
  expect(currentTeamAnalysisSession?.result.targetTeamFits).toEqual({
    A: { status: 'ready', candidateId: 'A' },
  })
  expect(props.queueFitOverview).toHaveBeenCalledOnce()
})

it('refreshes the exact remaining overview after a fit and keeps the source reservations', async () => {
  setup(vi.fn(), vi.fn(), true)
  const active = currentTeamAnalysisSession!
  const fits = {
    A: { status: 'ready', candidateId: 'A' },
  } as unknown as typeof active.result.targetTeamFits
  setCurrentTeamAnalysisSession({ ...active, result: { ...active.result, targetTeamFits: fits } })
  const model = { answer: {}, coverage: {}, groups: [] }
  const query = vi.fn().mockResolvedValue({
    contract: teamLoadoutPresentationContract,
    runId: 'run',
    accountId: 'account',
    inputFingerprint: 'remaining-fingerprint',
    context: { agentId: null, planId: null, discId: null },
    overviewModel: model,
  })
  const { result } = renderHook(() =>
    useTeamPickerQueries({
      calculationClient: { queryTeamOverviewPresentation: query } as unknown as Parameters<
        typeof useTeamPickerQueries
      >[0]['calculationClient'],
      releaseRun: vi.fn(),
      setAnalysis: vi.fn(),
      setOverviewFeedback: vi.fn(),
    }),
  )
  act(() => result.current.queueFitOverview(active.result, fits))
  await waitFor(() =>
    expect(query).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'run',
        sourceRunId: 'source',
        reservedPlanIds: ['saved-first'],
        fitCandidateIds: ['A'],
      }),
    ),
  )
  await waitFor(() => expect(currentTeamAnalysisSession?.result.fitOverviewModel).toEqual(model))
})
