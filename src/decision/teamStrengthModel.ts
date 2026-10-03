import artifact from '../gameDataPacks/generated/team-strength-model.3.1.json'
import { currentReleasedIdentityMap } from '../gameDataPacks/currentReleasedIdentityMap'
import { currentVersionProjection } from '../gameDataPacks/currentVersionProjection'
import { stableContentHash } from '../gameDataPacks/types'
import {
  extractTeamStrengthMechanicFeatures,
  teamStrengthMechanicFeatureNames,
  teamStrengthMechanicDataFingerprint,
} from './teamStrengthMechanicFeatures'
import { predictStrengthRegression } from './teamStrengthRegression'
import { constrainTeamStrengthScore, strengthBandForScore } from './teamStrengthModelScore'
import type { Current31MetaCalibration } from './current31TeamStrengthCalibration'
import { reviewedTeamAnalysis } from './reviewedTeamAnalysis'
import { isReviewedFallbackTeam } from './reviewedTeamRecommendationDisposition'

export const teamStrengthModelPolicy = {
  contract: artifact.contract,
  modelFingerprint: stableContentHash(artifact),
  gameVersion: artifact.gameVersion,
  reviewedForVersion: artifact.reviewedForVersion,
  trainingCount: artifact.regression.sampleCount,
  confidence: 'low' as const,
}

const inferenceCache = new Map<string, ReturnType<typeof infer>>()
const reviewedSubjectIds: readonly string[] | null = artifact.reviewedSubjectIds
const withdrawnKeys = new Set(
  reviewedTeamAnalysis.records
    .filter((row) => row.withdrawn)
    .map((row) => [...row.memberIds].sort().join('|')),
)

function infer(memberIds: readonly string[]) {
  if (
    ![artifact.gameVersion, artifact.reviewedForVersion].includes(
      currentVersionProjection.gameVersion,
    ) ||
    (artifact.reviewedForVersion ?? artifact.gameVersion) !==
      currentReleasedIdentityMap.gameVersion ||
    (reviewedSubjectIds !== null && memberIds.some((id) => !reviewedSubjectIds.includes(id))) ||
    artifact.mechanicDataFingerprint !== teamStrengthMechanicDataFingerprint ||
    JSON.stringify(artifact.featureNames) !== JSON.stringify(teamStrengthMechanicFeatureNames)
  )
    return null
  const features = extractTeamStrengthMechanicFeatures(memberIds)
  if (!features.eligibility.eligible) return null
  const rawScore = predictStrengthRegression(artifact.regression, features.values)
  const score = constrainTeamStrengthScore(rawScore, features.guardrails)
  return {
    contract: teamStrengthModelPolicy.contract,
    modelFingerprint: teamStrengthModelPolicy.modelFingerprint,
    score,
    band: strengthBandForScore(score),
    primaryOutputAgentId: features.primaryOutputAgentId,
    reliability: features.reliability,
    limitations: features.limitations,
    guardrails: features.guardrails,
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
  if (!inference) return calibration
  return {
    ...calibration,
    status: 'aligned',
    authority: 'model_inference',
    confidenceCeiling: 'low',
    kernelId: null,
    familyId: null,
    versionPosition: null,
    projectedStrengthBand: inference.band,
    recommendationScore: inference.score,
    inference,
    evidenceRefs: [`model:${inference.modelFingerprint}`],
    explanation: '依据当前三人机制特征与已审阅队伍校准的参考判断；低置信度，不代表实测伤害。',
  }
}
