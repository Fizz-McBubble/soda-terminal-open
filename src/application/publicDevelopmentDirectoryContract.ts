import type { SkillNextLevelDisplay } from '../decision/skillInvestmentProjection'

export type DevelopmentDirectoryDecision = {
  agentId: string
  current: {
    status: 'formal' | 'candidate' | 'unsupported' | 'stale'
    summary: string
  }
  staleSummary: string
  authority: {
    teamRating: string
    cultivationPriority: string
    confidence: string
  } | null
  skills: Array<{
    key: 'basic' | 'dodge' | 'assist' | 'special' | 'chain' | 'core'
    label: string
    targetLevel: number | null
    recommended?: string
    targetType?: 'exact_integer' | 'minimum_reference' | 'soda_derived'
    exactTarget?: number | null
    minimumReference?: number | null
    sodaDerived: {
      band: string
      targetLevel: number
      baseTargetLevel?: number
      label: string
    } | null
    priority: boolean
    nextLevel?: SkillNextLevelDisplay | null
  }>
}

export type DevelopmentDirectoryProjection = {
  contract: 'soda-development-directory/v1'
  runId: string
  accountId: string
  inputFingerprint: string
  decisions: DevelopmentDirectoryDecision[]
}
