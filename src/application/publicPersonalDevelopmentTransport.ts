import type {
  PersonalDevelopmentCandidatesResult,
  PersonalDevelopmentRoute,
} from './publicPersonalDevelopment'
import type { DevelopmentWorkbenchFactsPresentation } from './publicDevelopmentWorkbenchFacts'
import type { DevelopmentDirectoryFacts } from './publicDevelopmentDirectoryFacts'
import { projectPublicDevelopmentAlternatives } from './publicCalculationPlanTransport'
import { buildIntentFingerprintMatches } from './publicBuildIntentFingerprint'

/** Only the existing public candidate projection crosses the browser boundary;
 * the complete solver intent remains inside the worker. */
export function projectPublicPersonalCandidates(result: PersonalDevelopmentCandidatesResult) {
  if (!buildIntentFingerprintMatches(result.buildIntent)) throw new Error('个人搭配身份不匹配。')
  const projected = projectPublicDevelopmentAlternatives(result)
  return {
    ...projected,
    sessionId: result.sessionId,
    sessionContract: result.sessionContract,
    mode: result.mode,
    generationIdentity: result.generationIdentity,
    saveKnowledge: result.saveKnowledge,
    publicProjection: 'soda-public-personal-development/v1' as const,
    buildIntent: {
      ...projected.buildIntent,
      ...(result.buildIntent.independentDirection
        ? { independentDirection: result.buildIntent.independentDirection }
        : {}),
    },
  }
}

export function projectPublicPersonalRoute(value: PersonalDevelopmentRoute) {
  const {
    contract,
    sessionId,
    generationIdentity,
    accountId,
    inputFingerprint,
    selection,
    status,
    selectedDiscFingerprint,
    source,
    panel,
    setRecommendations,
    recordedEvaluation,
    discFacts,
    workbench,
    graduationPanel,
    equipment,
    currentRecordBinding,
    comparisonTarget,
  } = value
  return {
    contract,
    sessionId,
    generationIdentity,
    accountId,
    inputFingerprint,
    selection,
    status,
    selectedDiscFingerprint,
    source,
    panel,
    setRecommendations,
    recordedEvaluation,
    discFacts,
    workbench,
    graduationPanel,
    equipment,
    currentRecordBinding,
    comparisonTarget,
  }
}

export function projectPublicDevelopmentFacts(value: DevelopmentWorkbenchFactsPresentation) {
  const {
    contract,
    authority,
    accountId,
    inputFingerprint,
    selection,
    status,
    selectedDiscFingerprint,
    source,
    panel,
    setRecommendations,
    recordedEvaluation,
    discFacts,
    workbench,
    graduationPanel,
    equipment,
    currentRecordBinding,
    comparisonTarget,
  } = value
  return {
    contract,
    authority,
    accountId,
    inputFingerprint,
    selection,
    status,
    selectedDiscFingerprint,
    source,
    panel,
    setRecommendations,
    recordedEvaluation,
    discFacts,
    workbench,
    graduationPanel,
    equipment,
    currentRecordBinding,
    comparisonTarget,
  }
}
export function projectPublicDirectoryFacts(value: DevelopmentDirectoryFacts) {
  return {
    contract: value.contract,
    authority: value.authority,
    accountId: value.accountId,
    inputFingerprint: value.inputFingerprint,
    decisions: value.decisions,
  }
}
