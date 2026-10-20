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
import type {
  Current31MetaCalibration,
  TeamStrengthEvidenceMode,
} from './current31TeamStrengthCalibration'
import { reviewedTeamAnalysis } from './reviewedTeamAnalysis'
import { isReviewedFallbackTeam } from './reviewedTeamRecommendationDisposition'
import {
  currentTeamStrengthReferenceConditions,
  teamStrengthReferenceConditionsIdentity,
} from './teamStrengthReferenceConditions'
import { resolveTeamStrengthRecipientContext } from './teamStrengthSourceCapacity'
import {
  resolveTeamStrengthReferenceMindscape,
  teamStrengthReferenceStateIdentity,
} from './teamStrengthReferenceState'
import type { ResolvedTeamStrengthReferenceConditions } from './teamStrengthReferenceConditionsTypes'

export const teamStrengthModelPolicy = {
  contract: artifact.contract,
  modelFingerprint: stableContentHash(artifact),
  gameVersion: artifact.gameVersion,
  reviewedForVersion: artifact.reviewedForVersion,
  trainingCount: artifact.regression.sampleCount,
  confidence: 'low' as const,
  diagnosticOnly: true as const,
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

function inferenceKey(memberIds: readonly string[], evidenceMode: TeamStrengthEvidenceMode) {
  return `${evidenceMode}:${[...memberIds].sort().join('|')}`
}

/** The frozen model's declared baseline, without source-selected team overrides.
 * This is diagnostic input, not proof of the new equipment/cycle standard. */
function isolatedDiagnosticReferenceConditions(
  memberIds: readonly string[],
): ResolvedTeamStrengthReferenceConditions {
  const normalizedMemberIds = [...memberIds].sort()
  const conditions = {
    potentialByAgentId: {},
    evidenceRefs: [],
    status: 'standard_reference' as const,
    sourceAuthority: 'none' as const,
    normalizedMemberIds,
    calculationAssumption:
      'level60-base-skill11-core7-s0-a6-supported-p6-explicit-override' as const,
    teamStrengthReferenceStateIdentity,
    agentConditions: normalizedMemberIds.map((agentId) => ({
      agentId,
      status: 'unrecorded' as const,
      numericLevel: null,
      numericLevelBasis: null,
      mindscapeLevel: resolveTeamStrengthReferenceMindscape(agentId),
      minimumDemonstratedLevel: null,
      demonstrationEvidence: null,
      requirementSource: null,
      evidenceRefs: [],
    })),
    unhandledConditions: [],
    diagnostics: ['独立诊断采用模型声明的本地基线，不读取作者构筑或来源标签。'],
    sourceContext: { authority: null, direction: null },
  }
  return { ...conditions, identity: stableContentHash(conditions) }
}

function infer(memberIds: readonly string[], evidenceMode: TeamStrengthEvidenceMode) {
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
  const referenceConditions =
    evidenceMode === 'independent_evaluation'
      ? isolatedDiagnosticReferenceConditions(memberIds)
      : currentTeamStrengthReferenceConditions(memberIds)
  const features = extractTeamStrengthMechanicFeatures(
    memberIds,
    resolveTeamStrengthRecipientContext(memberIds, referenceConditions),
    referenceConditions,
  )
  if (!features.eligibility.eligible) return null
  let score: number
  try {
    const rawScore = predictStrengthRegression(artifact.regression, features.values)
    score = constrainTeamStrengthScore(rawScore, features.guardrails)
  } catch (error) {
    if (!(error instanceof TeamStrengthNumericError)) throw error
    inferenceIssues.set(inferenceKey(memberIds, evidenceMode), error.code)
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
    diagnosticOnly: true as const,
  }
}

/** This path never asks whether a guide lists the exact trio. All three members
 * contribute fresh mechanism/recipient features; no sibling tier is inherited. */
export function inferTeamStrength(
  memberIds: readonly string[],
  evidenceMode: TeamStrengthEvidenceMode = 'source_reference',
) {
  const key = inferenceKey(memberIds, evidenceMode)
  if (!inferenceCache.has(key)) inferenceCache.set(key, infer(memberIds, evidenceMode))
  return inferenceCache.get(key)!
}

export function getTeamStrengthInferenceIssue(
  memberIds: readonly string[],
  evidenceMode: TeamStrengthEvidenceMode = 'source_reference',
) {
  return modelNumericIssue() ?? inferenceIssues.get(inferenceKey(memberIds, evidenceMode)) ?? null
}

export type TeamStrengthInference = NonNullable<ReturnType<typeof inferTeamStrength>>

export function inferredStrengthCalibration(
  calibration: Current31MetaCalibration,
  memberIds: readonly string[],
  disabled = false,
  sourceEvidenceIsolated = false,
): Current31MetaCalibration {
  if (
    disabled ||
    calibration.projectedStrengthBand ||
    calibration.evidenceStatus === 'conflict' ||
    // Explicit source fallback guidance must not be promoted to a mainstream
    // tier by an unvalidated regression. Exact reviewed tiers still win above.
    (!sourceEvidenceIsolated &&
      (isReviewedFallbackTeam(memberIds) || withdrawnKeys.has([...memberIds].sort().join('|'))))
  )
    return calibration
  const evidenceMode = sourceEvidenceIsolated ? 'independent_evaluation' : 'source_reference'
  const inference = inferTeamStrength(memberIds, evidenceMode)
  if (!inference) {
    const issue = getTeamStrengthInferenceIssue(memberIds, evidenceMode)
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
    // A model result remains inspectable without granting tier or ordering
    // authority. Keep the exact source/legacy evidence state intact.
    recommendationScore: undefined,
    inference,
    evidenceRefs: [...calibration.evidenceRefs, `model:${inference.modelFingerprint}`],
  }
}
