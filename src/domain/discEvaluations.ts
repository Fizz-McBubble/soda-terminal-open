import { contentHash } from '../application/contentHash'
import {
  evaluationRuleContentHash,
  evaluationRules,
  getProfile,
  getProfileContentHash,
} from '../evaluation/rules'
import type { EvaluationSnapshot } from '../evaluation/types'
import type { DiscEvaluation, DiscEvaluationStatus, DriveDisc } from './schemas'

const genericTemplateVersion = 'generic-v1'
const genericTemplateContentHash = contentHash({ mode: 'generic', version: genericTemplateVersion })

export type EvaluationVersionContext = {
  ruleVersion: string
  ruleContentHash: string
  gameDataVersion: string
  getTemplateVersion: (templateId: string) => { version: string; contentHash: string } | undefined
}

export type DiscEvaluationResolution = {
  status: DiscEvaluationStatus
  currentEvaluation: DiscEvaluation | null
  displayEvaluation: DiscEvaluation | null
  isDisplayHistorical: boolean
}

export function getDriveDiscVersion(disc: DriveDisc): string {
  return contentHash({
    setId: disc.setId,
    slot: disc.slot,
    level: disc.level,
    mainStat: disc.mainStat,
    subStats: disc.subStats.map(({ stat, value, upgrades }) => ({ stat, value, upgrades })),
    dataVersion: disc.dataVersion,
  })
}

export function getCurrentEvaluationVersionContext(): EvaluationVersionContext {
  return {
    ruleVersion: evaluationRules.ruleVersion,
    ruleContentHash: evaluationRuleContentHash,
    gameDataVersion: evaluationRules.gameVersion,
    getTemplateVersion(templateId) {
      if (templateId === 'generic') {
        return { version: genericTemplateVersion, contentHash: genericTemplateContentHash }
      }
      try {
        const profile = getProfile(templateId)
        return { version: profile.version, contentHash: getProfileContentHash(profile) }
      } catch {
        return undefined
      }
    },
  }
}

export function createDiscEvaluation(
  disc: DriveDisc,
  snapshot: EvaluationSnapshot,
  source: DiscEvaluation['source'] = 'manual',
): DiscEvaluation {
  const templateId = snapshot.profileId ?? 'generic'
  const templateVersion = snapshot.profileVersion ?? genericTemplateVersion
  const templateContentHash = snapshot.profileContentHash ?? genericTemplateContentHash

  return {
    id: crypto.randomUUID(),
    discId: disc.id,
    discVersion: getDriveDiscVersion(disc),
    templateId,
    templateVersion,
    templateContentHash,
    ruleVersion: snapshot.ruleVersion,
    ruleContentHash: snapshot.ruleContentHash,
    gameDataVersion: snapshot.gameVersion,
    evaluatedAt: snapshot.evaluatedAt,
    status: 'valid',
    source,
    snapshot: structuredClone(snapshot),
  }
}

export function isEvaluationCurrent(
  evaluation: DiscEvaluation,
  disc: DriveDisc,
  context: EvaluationVersionContext = getCurrentEvaluationVersionContext(),
): boolean {
  if (evaluation.status !== 'valid') return false
  const template = context.getTemplateVersion(evaluation.templateId)
  return Boolean(
    template &&
    evaluation.discVersion === getDriveDiscVersion(disc) &&
    evaluation.ruleVersion === context.ruleVersion &&
    evaluation.ruleContentHash === context.ruleContentHash &&
    evaluation.gameDataVersion === context.gameDataVersion &&
    evaluation.templateVersion === template.version &&
    evaluation.templateContentHash === template.contentHash,
  )
}

function newestFirst(left: DiscEvaluation, right: DiscEvaluation) {
  return right.evaluatedAt.localeCompare(left.evaluatedAt) || right.id.localeCompare(left.id)
}

function getLatestSuccessfulEvaluation(evaluations: DiscEvaluation[]) {
  return evaluations.find((item) => item.status === 'valid' && item.snapshot) ?? null
}

function getEnhancementNodeIndex(level: number) {
  return evaluationRules.enhancementNodes.indexOf(level)
}

export function areEvaluationsComparable(current: DiscEvaluation, previous: DiscEvaluation) {
  const currentSnapshot = current.snapshot as EvaluationSnapshot | undefined
  const previousSnapshot = previous.snapshot as EvaluationSnapshot | undefined
  if (!currentSnapshot || !previousSnapshot) return false
  if (current.status !== 'valid' || previous.status !== 'valid') return false
  if (previous.evaluatedAt >= current.evaluatedAt) return false
  if (current.discId !== previous.discId) return false
  if (current.templateId !== previous.templateId) return false
  if (current.templateVersion !== previous.templateVersion) return false
  if (current.templateContentHash !== previous.templateContentHash) return false
  if (current.ruleVersion !== previous.ruleVersion) return false
  if (current.ruleContentHash !== previous.ruleContentHash) return false
  if (current.gameDataVersion !== previous.gameDataVersion) return false
  if (currentSnapshot.input.setId !== previousSnapshot.input.setId) return false
  if (currentSnapshot.input.slot !== previousSnapshot.input.slot) return false
  if (currentSnapshot.input.mainStat !== previousSnapshot.input.mainStat) return false

  const currentNode = getEnhancementNodeIndex(currentSnapshot.input.level)
  const previousNode = getEnhancementNodeIndex(previousSnapshot.input.level)
  return currentNode >= 0 && previousNode >= 0 && currentNode - previousNode === 1
}

export function findPreviousComparableEvaluation(
  current: DiscEvaluation,
  evaluations: DiscEvaluation[],
) {
  return (
    evaluations
      .filter((item) => item.discId === current.discId && item.id !== current.id)
      .sort(newestFirst)
      .find((item) => areEvaluationsComparable(current, item)) ?? null
  )
}

export function resolveDiscEvaluation(
  disc: DriveDisc,
  evaluations: DiscEvaluation[],
  context: EvaluationVersionContext = getCurrentEvaluationVersionContext(),
): DiscEvaluationResolution {
  const history = evaluations.filter((item) => item.discId === disc.id).sort(newestFirst)
  const latestAttempt = history[0] ?? null
  const latestSuccessful = getLatestSuccessfulEvaluation(history)

  if (latestAttempt?.status === 'failed' || latestAttempt?.status === 'needs_review') {
    return {
      status: latestAttempt.status,
      currentEvaluation: latestAttempt,
      displayEvaluation: latestSuccessful,
      isDisplayHistorical: Boolean(latestSuccessful),
    }
  }

  if (latestSuccessful && isEvaluationCurrent(latestSuccessful, disc, context)) {
    return {
      status: 'valid',
      currentEvaluation: latestSuccessful,
      displayEvaluation: latestSuccessful,
      isDisplayHistorical: false,
    }
  }

  if (latestSuccessful) {
    return {
      status: 'stale',
      currentEvaluation: latestSuccessful,
      displayEvaluation: latestSuccessful,
      isDisplayHistorical: true,
    }
  }

  return {
    status: 'pending',
    currentEvaluation: null,
    displayEvaluation: null,
    isDisplayHistorical: false,
  }
}
