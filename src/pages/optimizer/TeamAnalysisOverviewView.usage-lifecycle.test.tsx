import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import type { ComponentProps } from 'react'
import type { CoreWarehouse } from '../../accounts/coreWarehouse'
import { TeamAnalysisOverviewView } from './TeamAnalysisOverviewView'
import { currentTeamAnalysisSession, setCurrentTeamAnalysisSession } from '../teamAnalysisSession'

const mocks = vi.hoisted(() => ({ navigate: vi.fn(), outcome: vi.fn() }))
vi.mock('react-router-dom', () => ({ useNavigate: () => mocks.navigate }))
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
    onPrimaryAction: (item: unknown) => void
  }) => (
    <>
      <button onClick={() => props.onSelect('B')}>Select B</button>
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
function setup(queryTeamRoute: ReturnType<typeof vi.fn>, calculate: ReturnType<typeof vi.fn>) {
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
    capturedAt: new Date(),
    decisionSnapshot: {
      fingerprint: { inputHash: 'fingerprint' },
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
    decisionWorld: {
      status: 'current',
      liveFingerprint: 'fingerprint',
      run: { input: { warehouse: { accountId: 'account' } } },
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
  render(<TeamAnalysisOverviewView {...props} />)
  return props
}
const entry = (id: string) => ({ team: { id, bangbooId: 'bangboo' }, targetCandidateId: id })
beforeEach(() => {
  vi.clearAllMocks()
  setCurrentTeamAnalysisSession(null)
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
