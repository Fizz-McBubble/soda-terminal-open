import artifact from '../gameDataPacks/generated/team-strength-model.3.1.json'
import { currentReleasedIdentityMap } from '../gameDataPacks/currentReleasedIdentityMap'
import { currentVersionProjection } from '../gameDataPacks/currentVersionProjection'
import { stableContentHash } from '../gameDataPacks/types'
import {
  extractTeamStrengthMechanicFeatures,
  teamStrengthMechanicFeatureNames,
  teamStrengthMechanicDataFingerprint,
} from './teamStrengthMechanicFeatures'
import { assertValidStrengthRegression, predictStrengthRegression } from './teamStrengthRegression'
import { TeamStrengthNumericError, type TeamStrengthNumericIssue } from './teamStrengthNumericError'
import { constrainTeamStrengthScore, strengthBandForScore } from './teamStrengthModelScore'
import type { Current31MetaCalibration } from './current31TeamStrengthCalibration'
import { reviewedTeamAnalysis } from './reviewedTeamAnalysis'
import { isReviewedFallbackTeam } from './reviewedTeamRecommendationDisposition'
import {
  currentTeamStrengthReferenceConditions,
  teamStrengthReferenceConditionsIdentity,
} from './teamStrengthReferenceConditions'

export const teamStrengthModelPolicy = {
  contract: artifact.contract,
  modelFingerprint: stableContentHash(artifact),
  gameVersion: artifact.gameVersion,
  reviewedForVersion: artifact.reviewedForVersion,
  trainingCount: artifact.regression.sampleCount,
  confidence: 'low' as const,
}

const inferenceCache = new Map<string, ReturnType<typeof infer>>()
const inferenceIssues = new Map<string, TeamStrengthNumericIssue>()
let modelValidation: 'unchecked' | 'ready' | TeamStrengthNumericError = 'unchecked'

function modelNumericIssue(): TeamStrengthNumericIssue | null {
  if (modelValidation === 'unchecked') {
    try {
      assertValidStrengthRegression(artifact.regression)
      modelValidation = 'ready'
    } catch (error) {
      if (!(error instanceof TeamStrengthNumericError)) throw error
      modelValidation = error
    }
  }
  return modelValidation instanceof TeamStrengthNumericError ? modelValidation.code : null
}
const reviewedSubjectIds: readonly string[] | null = artifact.reviewedSubjectIds
const withdrawnKeys = new Set(
  reviewedTeamAnalysis.records
    .filter((row) => row.withdrawn)
    .map((row) => [...row.memberIds].sort().join('|')),
)

function infer(memberIds: readonly string[]) {
  if (modelNumericIssue()) return null
  if (
    ![artifact.gameVersion, artifact.reviewedForVersion].includes(
      currentVersionProjection.gameVersion,
    ) ||
    (artifact.reviewedForVersion ?? artifact.gameVersion) !==
      currentReleasedIdentityMap.gameVersion ||
    (reviewedSubjectIds !== null && memberIds.some((id) => !reviewedSubjectIds.includes(id))) ||
    artifact.mechanicDataFingerprint !== teamStrengthMechanicDataFingerprint ||
    (artifact as { referenceConditionsIdentity?: string }).referenceConditionsIdentity !==
      teamStrengthReferenceConditionsIdentity ||
    JSON.stringify(artifact.featureNames) !== JSON.stringify(teamStrengthMechanicFeatureNames)
  )
    return null
  const referenceConditions = currentTeamStrengthReferenceConditions(memberIds)
  const features = extractTeamStrengthMechanicFeatures(memberIds, {}, referenceConditions)
  if (!features.eligibility.eligible) return null
  let score: number
  try {
    const rawScore = predictStrengthRegression(artifact.regression, features.values)
    score = constrainTeamStrengthScore(rawScore, features.guardrails)
  } catch (error) {
    if (!(error instanceof TeamStrengthNumericError)) throw error
    inferenceIssues.set([...memberIds].sort().join('|'), error.code)
    return null
  }
  return {
    contract: teamStrengthModelPolicy.contract,
    modelFingerprint: teamStrengthModelPolicy.modelFingerprint,
    score,
    band: strengthBandForScore(score),
    primaryOutputAgentId: features.primaryOutputAgentId,
    reliability: features.reliability,
    limitations: features.limitations,
    guardrails: features.guardrails,
    referenceConditions,
    confidence: 'low' as const,
  }
}

/** This path never asks whether a guide lists the exact trio. All three members
 * contribute fresh mechanism/recipient features; no sibling tier is inherited. */
export function inferTeamStrength(memberIds: readonly string[]) {
  const key = [...memberIds].sort().join('|')
  if (!inferenceCache.has(key)) inferenceCache.set(key, infer(memberIds))
  return inferenceCache.get(key)!
}

export function getTeamStrengthInferenceIssue(memberIds: readonly string[]) {
  return modelNumericIssue() ?? inferenceIssues.get([...memberIds].sort().join('|')) ?? null
}

export type TeamStrengthInference = NonNullable<ReturnType<typeof inferTeamStrength>>

export function inferredStrengthCalibration(
  calibration: Current31MetaCalibration,
  memberIds: readonly string[],
  disabled = false,
): Current31MetaCalibration {
  if (
    disabled ||
    calibration.projectedStrengthBand ||
    calibration.evidenceStatus === 'conflict' ||
    // Explicit source fallback guidance must not be promoted to a mainstream
    // tier by an unvalidated regression. Exact reviewed tiers still win above.
    isReviewedFallbackTeam(memberIds) ||
    withdrawnKeys.has([...memberIds].sort().join('|'))
  )
    return calibration
  const inference = inferTeamStrength(memberIds)
  if (!inference) {
    const issue = getTeamStrengthInferenceIssue(memberIds)
    if (!issue) return calibration
    return {
      ...calibration,
      status: 'insufficient',
      authority: 'none',
      evidenceStatus: 'unknown',
      projectedStrengthBand: null,
      recommendationScore: undefined,
      inference: undefined,
      evidenceRefs: [
        ...calibration.evidenceRefs,
        `model:${teamStrengthModelPolicy.modelFingerprint}`,
        `model_unavailable:${issue}`,
      ],
      explanation: '暂时无法计算这支队伍的强度参考。',
    }
  }
  return {
    ...calibration,
    status: 'aligned',
    authority: 'model_inference',
    confidenceCeiling: 'low',
    kernelId: null,
    familyId: null,
    versionPosition: null,
    projectedStrengthBand: inference.band,
    // The bounded source-tier reference estimate supplies both the inferred
    // band and its visible recommendation score; it is never damage or DPS.
    recommendationScore: inference.score,
    inference,
    evidenceRefs: [`model:${inference.modelFingerprint}`],
    explanation: '依据当前三人机制特征与已审阅队伍校准的参考判断；低置信度，不代表实测伤害。',
  }
}
