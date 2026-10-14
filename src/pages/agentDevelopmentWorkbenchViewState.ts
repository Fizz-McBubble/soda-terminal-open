import type { ComponentProps, Dispatch, SetStateAction } from 'react'
import type {
  useAccountDecisionWorld,
  useDevelopmentCandidateAlternativesCalculation,
  useDevelopmentWorkbenchRouteCalculation,
} from '../application/accountDecisionWorld'
import type { findCurrentDevelopmentWorkbenchEquipment } from '../application/publicDevelopmentWorkbenchPresentation'
import type { DevelopmentWorkbenchRoutePresentation } from '../application/publicDevelopmentWorkbenchRoute'
import type { GoldenWorkbenchData } from '../features/agentDevelopmentGolden'
import type { AgentDevelopmentCurrentEditor } from './AgentDevelopmentCurrentEditor'
import type { readDevelopmentCandidateSnapshot } from './agentDevelopmentCandidateSession'

type CandidateSnapshot = NonNullable<ReturnType<typeof readDevelopmentCandidateSnapshot>>

type EditingPresentation = { accountId: string; presentation: GoldenWorkbenchData }

export type SaveRefresh = EditingPresentation & {
  agentId: string
  kind?: 'current_record'
  phase?: 'updating' | 'failed'
  record?: ComponentProps<typeof AgentDevelopmentCurrentEditor>['roster']['agents'][number]
  error?: string
}

export type WarehouseRefresh = SaveRefresh & { inputFingerprint: string | null }

export type RouteRead = { key: string; value: DevelopmentWorkbenchRoutePresentation }

export type RouteProjection = {
  accountId: string
  agentId: string
  value: DevelopmentWorkbenchRoutePresentation
}

export type Props = {
  agentId: string
  accountId: string
  agentName: string
  roster: ComponentProps<typeof AgentDevelopmentCurrentEditor>['roster']
  workbenchData: GoldenWorkbenchData
  savingThisAgent: boolean
  editingThisAgent: boolean
  candidateSnapshotStale: boolean
  retainingDuringSave: boolean
  saveRefresh: SaveRefresh | null
  editingPresentation: EditingPresentation | null
  decisionWorld: ReturnType<typeof useAccountDecisionWorld>
  queryDevelopmentCandidateAlternatives: ReturnType<
    typeof useDevelopmentCandidateAlternativesCalculation
  >
  queryDevelopmentWorkbenchRoute: ReturnType<typeof useDevelopmentWorkbenchRouteCalculation>
  candidates: CandidateSnapshot['candidates']
  candidateSnapshot: CandidateSnapshot | null
  equipment: ReturnType<typeof findCurrentDevelopmentWorkbenchEquipment>
  requestedPlanId: string | null
  selectedCandidateRank: number
  setAnalysisVersion: Dispatch<SetStateAction<number>>
  setWarehouseRefresh: Dispatch<SetStateAction<WarehouseRefresh | null>>
  setEditingPresentation: Dispatch<SetStateAction<EditingPresentation | null>>
  setEditingCurrent: Dispatch<SetStateAction<boolean>>
  setSaveRefresh: Dispatch<SetStateAction<SaveRefresh | null>>
  setRouteRead: Dispatch<SetStateAction<RouteRead | null>>
  setLastRouteProjection: Dispatch<SetStateAction<RouteProjection | null>>
}
