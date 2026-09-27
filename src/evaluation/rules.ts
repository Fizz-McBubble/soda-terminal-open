import { z } from 'zod'
import rawProfiles from '../data/build-profiles.v1.json'
import rawRules from '../data/evaluation-rules.v1.json'
import { statKeySchema } from '../domain/schemas'
import { contentHash } from './contentHash'
import type { EvaluationProfile, EvaluationRules } from './types'

const weightSchema = z.number().min(0).max(1)
const statRuleSchema = z.object({
  label: z.string().min(1),
  rollUnit: z.number().positive(),
  genericWeight: weightSchema,
  subStat: z.boolean(),
})

const evaluationRulesSchema = z.object({
  ruleVersion: z.string().min(1),
  ruleSchemaVersion: z.number().int().positive(),
  gameVersion: z.string().min(1),
  basis: z.literal('transparent-internal-baseline'),
  componentMaximums: z.object({
    quality: z.number().positive(),
    mainStat: z.number().positive(),
    set: z.number().positive(),
  }),
  enhancementNodes: z.array(z.number().int().min(0).max(15)).min(1),
  potential: z.object({ unknownSubStatWeight: weightSchema }),
  conclusionThresholds: z.object({
    unfinished: z.object({
      enhanceFit: z.number().min(0).max(100),
      enhanceExpectedQuality: z.number().min(0).max(100),
      observeFit: z.number().min(0).max(100),
      observeExpectedQuality: z.number().min(0).max(100),
    }),
    completed: z.object({
      treasureQuality: z.number().min(0).max(100),
      treasureFit: z.number().min(0).max(100),
      keepQuality: z.number().min(0).max(100),
      keepFit: z.number().min(0).max(100),
      conditionalQuality: z.number().min(0).max(100),
      conditionalFit: z.number().min(0).max(100),
    }),
  }),
  stats: z.record(statKeySchema, statRuleSchema),
  slots: z.record(z.string(), z.array(statKeySchema)),
  genericMainStatFit: z.record(statKeySchema, weightSchema),
  genericSetFit: z.record(z.string(), weightSchema),
})

export const evaluationProfileSchema = z.object({
  id: z.string().min(1),
  agentId: z.string().min(1),
  name: z.string().min(1),
  version: z.string().min(1),
  statWeights: z.record(z.string(), weightSchema),
  mainStatFit: z.record(z.string(), z.record(z.string(), weightSchema)),
  setFit: z.record(z.string(), weightSchema),
})

export function loadEvaluationRules(): EvaluationRules {
  return evaluationRulesSchema.parse(rawRules) as EvaluationRules
}

export function loadProfiles(): EvaluationProfile[] {
  return z.array(evaluationProfileSchema).parse(rawProfiles) as EvaluationProfile[]
}

export const evaluationRules = loadEvaluationRules()
export const evaluationProfiles = loadProfiles()
export const evaluationRuleContentHash = contentHash(evaluationRules)

export function getProfileContentHash(profile: EvaluationProfile): string {
  return contentHash(profile)
}

export function getProfile(id: string): EvaluationProfile {
  const profile = evaluationProfiles.find((candidate) => candidate.id === id && !candidate.archived)
  if (!profile) throw new Error(`Unknown evaluation profile ${id}`)
  return profile
}

export function replaceRuntimeProfiles(profiles: EvaluationProfile[]) {
  evaluationProfiles.splice(0, evaluationProfiles.length, ...profiles)
}
