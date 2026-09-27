import type { GoldenWorkbenchData } from '../features/agentDevelopmentGolden'

export type DevelopmentWorkbenchEquipmentDecision = {
  agentId: string
  supportsPotential: boolean
  potential: number | null
  engine: GoldenWorkbenchData['engine']
  graduationEngines: GoldenWorkbenchData['graduation']['engines']
  targetPanel: Pick<
    NonNullable<
      ReturnType<typeof import('../gameDataPacks/currentBuildAuthority').getCurrentBuildTargetPanel>
    >,
    'value' | 'status' | 'conditions'
  > | null
  potentialSkillReference: GoldenWorkbenchData['graduation']['potentialSkillReference'] | null
  hasMechanicsWithoutPriority: boolean
  historicalDiscReferences: string[]
  discSetConditions: string[]
  engineConditions: string[]
  skillRecommendation: ReturnType<
    typeof import('../pages/agentDevelopmentSkillRecommendations').agentDevelopmentSkillRecommendations
  >
  graduationTeams: GoldenWorkbenchData['graduation']['teams']
  setNames: Record<string, string>
  profileSave: {
    scenario: string
    profileId: string
    status: 'formal' | 'candidate' | 'missing'
    version: string
    source: string
    progressionDirections: string[]
  }
  graduationDisplay: {
    mainStats: GoldenWorkbenchData['graduation']['discs']['mainStats']
    mainStatAlternatives: GoldenWorkbenchData['graduation']['discs']['mainStatAlternatives']
    subStats: string
    unresolvedSetDirections: string[]
    setUnavailableReason: string
    gaps: string[]
    sources: Array<{
      label: string
      kind: 'official_fact' | 'community_candidate'
      updatedAt: string
    }>
    constraintSources: Array<{ id: string; sourceVersion: string | null }>
  }
}

export type DevelopmentWorkbenchPresentation = {
  contract: 'soda-development-workbench/v1'
  runId: string
  accountId: string
  inputFingerprint: string
  agents: DevelopmentWorkbenchEquipmentDecision[]
}

export function findCurrentDevelopmentWorkbenchEquipment(
  presentation: DevelopmentWorkbenchPresentation | undefined,
  expected: { runId: string; accountId: string; inputFingerprint: string; agentId: string },
): DevelopmentWorkbenchEquipmentDecision | null {
  if (
    presentation?.contract !== 'soda-development-workbench/v1' ||
    presentation.runId !== expected.runId ||
    presentation.accountId !== expected.accountId ||
    presentation.inputFingerprint !== expected.inputFingerprint ||
    !Array.isArray(presentation.agents)
  )
    return null
  const item = presentation.agents.find((entry) => entry.agentId === expected.agentId)
  if (
    !item ||
    typeof item.supportsPotential !== 'boolean' ||
    (item.potential !== null && !Number.isFinite(item.potential)) ||
    typeof item.engine?.name !== 'string' ||
    !Array.isArray(item.engine.options) ||
    !Array.isArray(item.graduationEngines) ||
    typeof item.hasMechanicsWithoutPriority !== 'boolean' ||
    !Array.isArray(item.historicalDiscReferences) ||
    !Array.isArray(item.discSetConditions) ||
    !Array.isArray(item.engineConditions) ||
    !Array.isArray(item.skillRecommendation?.priority) ||
    !Array.isArray(item.skillRecommendation.skills) ||
    typeof item.skillRecommendation.targets !== 'object' ||
    !Array.isArray(item.graduationTeams) ||
    !item.setNames ||
    typeof item.setNames !== 'object' ||
    typeof item.profileSave?.scenario !== 'string' ||
    typeof item.profileSave.profileId !== 'string' ||
    !Array.isArray(item.profileSave.progressionDirections) ||
    !Array.isArray(item.graduationDisplay?.mainStats) ||
    typeof item.graduationDisplay.subStats !== 'string'
  )
    return null
  return item
}
