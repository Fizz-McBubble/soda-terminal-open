import data from './severianAscensionMaterials33.data.json'
import {
  getCurrentAgentNumericContract,
  isReviewedSeverianNumericContract,
  type CurrentAgentNumericContract,
} from './currentAgentNumericContracts'
import { currentGameDataSelection } from '../gameDataPacks/currentGameDataSelection'
import {
  resolveReviewedAscensionMaterialSource33,
  type ReviewedAscensionMaterialSteps33,
} from './reviewedAscensionMaterialSource33'

const reviewedContentHash = 'fnv1a-ead0b0f5'
export type SeverianAscensionMaterialData33 = Omit<typeof data, 'steps'> & {
  steps: ReviewedAscensionMaterialSteps33
}
const reviewedData = data as unknown as SeverianAscensionMaterialData33
export const severianAscensionMaterials33Identity = Object.freeze({
  contract: data.contract,
  agentId: data.agentId,
  sourceVersion: data.sourceVersion,
  rawSha256: data.source.sha256,
  providerManifestSha256: data.source.providerManifestSha256,
  stepCount: data.steps.length,
  contentHash: reviewedContentHash,
})

/** A testable source seam: altered records cannot inherit the reviewed binding. */
export function resolveSeverianAscensionSource33(
  record: SeverianAscensionMaterialData33 = reviewedData,
  contract: CurrentAgentNumericContract | undefined = getCurrentAgentNumericContract(
    'agent-severian',
  ),
) {
  return resolveReviewedAscensionMaterialSource33(record, contract, {
    baseline: reviewedData,
    contractName: 'soda-severian-ascension-materials/v1',
    contentHash: reviewedContentHash,
    isReviewedNumericContract: isReviewedSeverianNumericContract,
  })
}

export function getSeverianAscensionMaterialFacts33() {
  return currentGameDataSelection.gameVersion === '3.3' ? resolveSeverianAscensionSource33() : null
}
