import data from './phoenixAscensionMaterials33.data.json'
import {
  getCurrentAgentNumericContract,
  isReviewedPhoenixNumericContract,
  type CurrentAgentNumericContract,
} from './currentAgentNumericContracts'
import { currentGameDataSelection } from '../gameDataPacks/currentGameDataSelection'
import { stableContentHash } from '../domain/stableContentHash'

const reviewedContentHash = 'fnv1a-fbb1006b'
export type PhoenixAscensionMaterialData33 = Omit<typeof data, 'steps'> & {
  steps: Array<{
    ascension: number
    levelCapBefore: number
    levelCapAfter: number
    materials: Record<string, number>
    sourceLocator: string
  }>
}
const reviewedData = data as unknown as PhoenixAscensionMaterialData33
export const phoenixAscensionMaterials33Identity = Object.freeze({
  contract: data.contract,
  agentId: data.agentId,
  sourceVersion: data.sourceVersion,
  rawSha256: data.source.sha256,
  providerManifestSha256: data.source.providerManifestSha256,
  stepCount: data.steps.length,
  contentHash: reviewedContentHash,
})

/** A testable source seam: altered records cannot inherit the reviewed binding. */
export function resolvePhoenixAscensionSource33(
  record: PhoenixAscensionMaterialData33 = reviewedData,
  contract: CurrentAgentNumericContract | undefined = getCurrentAgentNumericContract(
    'agent-phoenix',
  ),
) {
  if (
    !contract ||
    !isReviewedPhoenixNumericContract(contract) ||
    contract.source.provider !== 'nanoka' ||
    record.contract !== 'soda-phoenix-ascension-materials/v1' ||
    record.agentId !== contract.stableId ||
    record.gameId !== contract.externalId ||
    record.attribute !== contract.identity.attribute ||
    record.specialty !== contract.identity.specialty ||
    record.sourceVersion !== '3.3' ||
    record.source.sourceVersion !== '3.3' ||
    record.source.provider !== 'nanoka' ||
    record.source.sha256 !== contract.source.rawSha256 ||
    record.source.providerManifestSha256 !== contract.source.providerManifestSha256 ||
    record.source.url !== contract.source.url ||
    stableContentHash(record) !== reviewedContentHash ||
    record.steps.length !== 5 ||
    record.steps.some(
      (step, index) =>
        step.ascension !== index + 1 ||
        step.levelCapBefore !== (index + 1) * 10 ||
        step.levelCapAfter !== (index + 2) * 10 ||
        step.sourceLocator !== `level[${index + 1}].materials` ||
        !Object.keys(step.materials).length ||
        Object.entries(step.materials).some(
          ([id, quantity]) => !/^\d+$/.test(id) || !Number.isSafeInteger(quantity) || quantity <= 0,
        ),
    ) ||
    record.levelExperience.experienceToNextLevel.length !== 60 ||
    record.levelExperience.experienceToNextLevel[59] !== 0 ||
    record.levelExperience.experienceToNextLevel
      .slice(0, 59)
      .some((quantity) => !Number.isSafeInteger(quantity) || quantity <= 0) ||
    record.levelExperience.totalExperience1To60 !==
      record.levelExperience.experienceToNextLevel.reduce((total, quantity) => total + quantity, 0)
  )
    return {
      agentId: data.agentId,
      gameId: data.gameId,
      status: 'unknown' as const,
      reason: 'source_identity_or_material_steps_unresolved',
      source: data.source,
    }
  return {
    agentId: record.agentId,
    gameId: record.gameId,
    status: 'supported' as const,
    attribute: record.attribute,
    specialty: record.specialty,
    source: { ...record.source },
    steps: structuredClone(record.steps),
    levelExperience: structuredClone(record.levelExperience),
  }
}

export function getPhoenixAscensionMaterialFacts33() {
  return currentGameDataSelection.gameVersion === '3.3' ? resolvePhoenixAscensionSource33() : null
}
