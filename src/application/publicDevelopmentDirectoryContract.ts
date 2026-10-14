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
