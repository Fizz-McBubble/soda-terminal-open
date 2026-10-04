import type { ComponentProps } from 'react'
import { act, render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import { AgentDevelopmentWorkbenchView } from './AgentDevelopmentWorkbenchView'
import { createEmptyRoster } from '../assault/catalog'

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

type Props = ComponentProps<typeof AgentDevelopmentWorkbenchView>
function props(query: Props['queryDevelopmentCandidateAlternatives']): Props {
  return {
    agentId: 'agent-billy',
    accountId: 'isolated-a',
    agentName: '比利',
    roster: createEmptyRoster('2026-10-04T00:00:00.000Z'),
    workbenchData: {} as Props['workbenchData'],
    savingThisAgent: false,
    editingThisAgent: false,
    candidateSnapshotStale: false,
    retainingDuringSave: false,
    saveRefresh: null,
    editingPresentation: null,
    decisionWorld: {
      status: 'current',
      run: { runId: 'isolated-run' },
    } as Props['decisionWorld'],
    queryDevelopmentCandidateAlternatives: query,
    queryDevelopmentWorkbenchRoute: vi.fn(),
    candidates: [],
    candidateSnapshot: null,
    equipment: null,
    requestedPlanId: null,
    setAnalysisVersion: vi.fn(),
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
  const result = { gaps: [] }
  const initial = props(vi.fn().mockResolvedValue(result))
  render(<AgentDevelopmentWorkbenchView {...initial} />, { wrapper: MemoryRouter })
  await act(async () => {
    await (mocks.golden!.onAnalyzeWarehouse as () => Promise<void>)()
  })
  expect(mocks.cache).toHaveBeenCalledWith(result)
  expect(initial.setAnalysisVersion).toHaveBeenCalledOnce()
})

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
