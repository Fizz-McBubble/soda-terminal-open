import { projectDevelopmentWorkbenchEquipmentFacts } from './developmentWorkbenchPresentationProjection'
import { projectDevelopmentWorkbenchReadProjection } from './developmentWorkbenchReadProjection'
import {
  developmentWorkbenchFactsFingerprint,
  type DevelopmentWorkbenchFactsPresentation,
  type DevelopmentWorkbenchFactsRequest,
} from './publicDevelopmentWorkbenchFacts'

/** Read current or saved account facts; this producer cannot resolve candidate loadouts. */
export function projectDevelopmentWorkbenchFacts(
  request: DevelopmentWorkbenchFactsRequest,
): DevelopmentWorkbenchFactsPresentation {
  const { input, selection, currentRecord } = request
  return projectDevelopmentWorkbenchReadProjection({
    input,
    base: {
      contract: 'soda-development-workbench-facts/v1' as const,
      authority: 'not_evaluated' as const,
      accountId: input.warehouse.accountId ?? '',
      inputFingerprint: developmentWorkbenchFactsFingerprint(request),
      selection,
    },
    currentRecord,
    equipment: (agent) =>
      projectDevelopmentWorkbenchEquipmentFacts(input.warehouse, selection.agentId, agent),
  })
}
