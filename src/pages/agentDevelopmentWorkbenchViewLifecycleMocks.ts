import { beforeEach, vi } from 'vitest'
import type { ComponentProps } from 'react'
import type { AgentDevelopmentWorkbenchView } from './AgentDevelopmentWorkbenchView'

const mockState = vi.hoisted(() => ({
  golden: null as Record<string, unknown> | null,
  editor: null as {
    onSaved: (roster: Props['roster']) => Promise<void>
  } | null,
  cache: vi.fn(() => true),
  save: vi.fn(),
  refreshCandidates: vi.fn(),
}))
vi.mock('../features/agentDevelopmentGolden', () => ({
  AgentDevelopmentGolden: (props: Record<string, unknown>) => {
    mockState.golden = props
    return null
  },
}))
vi.mock('./agentDevelopmentCandidateSession', () => ({
  cacheDevelopmentCandidateSnapshot: mockState.cache,
  readDevelopmentCandidateSnapshot: vi.fn(),
  refreshDevelopmentCandidatesAfterSave: mockState.refreshCandidates,
}))
vi.mock('../accounts/planningDrafts', () => ({
  saveCurrentAgentBuild: mockState.save,
}))
vi.mock('./AgentDevelopmentCurrentEditor', () => ({
  AgentDevelopmentCurrentEditor: (props: {
    onSaved: (roster: Props['roster']) => Promise<void>
  }) => {
    mockState.editor = props
    return null
  },
}))
vi.mock('./AgentLoadoutComparisonPage', () => ({
  AgentLoadoutComparisonPage: () => null,
}))
vi.mock('./agentDevelopmentSavedPlan', () => ({
  createAgentDevelopmentSavedPlan: vi.fn(),
}))
vi.mock('../application/publicDevelopmentWorkbenchRoute', async (original) => ({
  ...(await original<typeof import('../application/publicDevelopmentWorkbenchRoute')>()),
  isCurrentDevelopmentWorkbenchRoute: vi.fn(() => true),
}))

export type Props = ComponentProps<typeof AgentDevelopmentWorkbenchView>
export type RouteResult = Awaited<ReturnType<Props['queryDevelopmentWorkbenchRoute']>>
beforeEach(() => vi.clearAllMocks())

export const mocks = mockState
