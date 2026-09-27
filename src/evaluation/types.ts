import type { DriveDisc, StatKey } from '../domain/schemas'
import type { SubStatHistory } from './subStatHistory'

export type EvaluationMode = 'generic' | 'profile'
export type EnhancementAction = 'enhance' | 'observe' | 'stop_enhancing'
export type CompletedAction = 'treasure' | 'keep' | 'conditional_keep' | 'low_priority'
export type Conclusion = EnhancementAction | CompletedAction

export type ScoreContribution = {
  source: 'sub_stat' | 'main_stat' | 'set'
  key: string
  label: string
  rawScore: number
  normalizedScore: number
  weight: number
}

export type ScoreResult = {
  raw: number
  normalized: number
  maximumRaw: number
  contributions: ScoreContribution[]
}

export type PotentialRange = {
  remainingEnhancementNodes: number
  unlocksRemaining: number
  scoreableEnhancements: number
  conservative: number
  expected: number
  ideal: number
  levelAtMaximum: 15
}

export type EvaluationSnapshot = {
  snapshotVersion: 4
  evaluatedAt: string
  ruleVersion: string
  ruleSchemaVersion: number
  ruleContentHash: string
  gameVersion: string
  mode: EvaluationMode
  profileId: string | null
  profileVersion: string | null
  profileContentHash: string | null
  inputDataVersion: string
  inputContentHash: string
  input: DriveDisc
  subStatHistory: SubStatHistory
  qualityScore: ScoreResult
  genericFitScore: ScoreResult
  profileFitScore: ScoreResult | null
  selectedFitScore: ScoreResult
  potential: PotentialRange
  conclusion: Conclusion
  reasons: string[]
  risks: string[]
}

export type StatRule = {
  label: string
  rollUnit: number
  genericWeight: number
  subStat: boolean
}

export type EvaluationRules = {
  ruleVersion: string
  ruleSchemaVersion: number
  gameVersion: string
  basis: 'transparent-internal-baseline'
  componentMaximums: { quality: number; mainStat: number; set: number }
  enhancementNodes: number[]
  potential: { unknownSubStatWeight: number }
  conclusionThresholds: {
    unfinished: {
      enhanceFit: number
      enhanceExpectedQuality: number
      observeFit: number
      observeExpectedQuality: number
    }
    completed: {
      treasureQuality: number
      treasureFit: number
      keepQuality: number
      keepFit: number
      conditionalQuality: number
      conditionalFit: number
    }
  }
  stats: Record<StatKey, StatRule>
  slots: Record<string, StatKey[]>
  genericMainStatFit: Record<StatKey, number>
  genericSetFit: Record<string, number>
}

export type EvaluationProfile = {
  id: string
  agentId: string
  name: string
  version: string
  statWeights: Partial<Record<StatKey, number>>
  mainStatFit: Record<string, Partial<Record<StatKey, number>>>
  setFit: Record<string, number>
  role?: 'damage' | 'anomaly' | 'stun' | 'support' | 'defense'
  isDefault?: boolean
  sourceTemplateId?: string | null
  archived?: boolean
  createdAt?: string
  updatedAt?: string
}
