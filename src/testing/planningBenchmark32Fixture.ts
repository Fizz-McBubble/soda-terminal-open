import {
  planningEventDeclarations32Contract,
  planningEventDeclarationsMetadataFingerprint32,
  type PlanningEventDeclarationsMetadata32,
  type PlanningEventConditionDefinition32,
} from '../application/publicPlanningEventDeclarations32'

/** Shared test-only 20-second, one-event vocabulary; each caller supplies its original subject and sources. */
export function createPlanningBenchmarkMetadata32Fixture(input: {
  ownerAgentId: string
  sourceRefs: string[]
  conditions?: PlanningEventConditionDefinition32[]
}): PlanningEventDeclarationsMetadata32 {
  const metadata: PlanningEventDeclarationsMetadata32 = {
    contract: planningEventDeclarations32Contract,
    gameVersion: '3.2',
    phaseId: 'phase_ii',
    sourceFingerprint: '',
    declaredDurationSeconds: 20,
    memberIds: [input.ownerAgentId],
    events: [
      {
        ownerAgentId: input.ownerAgentId,
        eventId: 'hit',
        skillLevel: 12,
        requiresWindsweptObservation: false,
        sourceRefs: [...input.sourceRefs],
        conditions: structuredClone(input.conditions ?? []),
      },
    ],
  }
  metadata.sourceFingerprint = planningEventDeclarationsMetadataFingerprint32(metadata)
  return metadata
}
