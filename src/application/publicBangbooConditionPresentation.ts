export type BangbooConditionRequirement = {
  key: string
  label: string
  required: number
  current: number | null
  missing: number | null
  met: boolean | null
  matchingMemberIds: string[]
  group: 'all' | 'any'
}

export type BangbooConditionPresentation = {
  bangbooId: string
  name: string
  stars: number
  activationStatus: 'active' | 'inactive' | 'unknown'
  requirementSummary: string
  progressSummary: string
  requirements: BangbooConditionRequirement[]
  minimumActivatingStars: number | null
  baseSkills: { kind: 'active' | 'chain'; label: string; name: string; description: string }[]
  additionalAbility: { name: string; description: string; effectDescription: string } | null
  sourceVersion: string
  sourceUrl: string | null
}
