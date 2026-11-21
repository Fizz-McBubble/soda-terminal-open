import snapshot from './data/reviewed-workbench-engine-guidance.3.3.json'

export type ReviewedWorkbenchEngineOption = {
  id: string
  name: string
  category: 'signature' | 'general' | 'conditional' | 'budget'
  condition: string
  sourceRefs: readonly string[]
  sourceRefinements: readonly number[]
}

export type ReviewedWorkbenchEngineGuidance = {
  name: string
  reviewedForVersion: string
  reviewedAt: string
  reviewedOptions: readonly ReviewedWorkbenchEngineOption[]
  displayEngineIds: readonly string[]
}

/** Qualitative player choices only. This table does not add calculation or team eligibility. */
export const reviewedWorkbenchEngineGuidance33 = snapshot.agents as Readonly<
  Record<string, ReviewedWorkbenchEngineGuidance>
>

export const reviewedWorkbenchEngineGuidanceVersion33 = snapshot.gameVersion

export function getReviewedWorkbenchEngineGuidance33(
  agentId: string,
): ReviewedWorkbenchEngineGuidance | undefined {
  return reviewedWorkbenchEngineGuidance33[agentId]
}
