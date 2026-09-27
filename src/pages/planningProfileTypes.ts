import type { BuildKnowledgeProfile } from '../gameDataPacks/buildKnowledge'
import type { ProjectedBuildKnowledgeProfile } from '../gameDataPacks/agentProfile'

export type PlanningProfile = BuildKnowledgeProfile | ProjectedBuildKnowledgeProfile

export type PlanningProfileResolver = (agentId: string) => PlanningProfile
