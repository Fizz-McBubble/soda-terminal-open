import type { ComponentProps } from 'react'
import { vi } from 'vitest'
import { createEmptyRoster } from '../assault/catalog'
import type { AgentDevelopmentWorkbenchView } from './AgentDevelopmentWorkbenchView'
type Props = ComponentProps<typeof AgentDevelopmentWorkbenchView>

export function createWorkbenchViewProps(
  query: Props['queryDevelopmentCandidateAlternatives'],
): Props {
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
