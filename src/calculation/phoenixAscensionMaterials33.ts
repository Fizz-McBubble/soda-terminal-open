import data from './phoenixAscensionMaterials33.data.json'
import {
  getCurrentAgentNumericContract,
  isReviewedPhoenixNumericContract,
  type CurrentAgentNumericContract,
} from './currentAgentNumericContracts'
import { currentGameDataSelection } from '../gameDataPacks/currentGameDataSelection'
import {
  resolveReviewedAscensionMaterialSource33,
  type ReviewedAscensionMaterialSteps33,
} from './reviewedAscensionMaterialSource33'

const reviewedContentHash = 'fnv1a-fbb1006b'
export type PhoenixAscensionMaterialData33 = Omit<typeof data, 'steps'> & {
  steps: ReviewedAscensionMaterialSteps33
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
  return resolveReviewedAscensionMaterialSource33(record, contract, {
    baseline: reviewedData,
    contractName: 'soda-phoenix-ascension-materials/v1',
    contentHash: reviewedContentHash,
    isReviewedNumericContract: isReviewedPhoenixNumericContract,
  })
}

export function getPhoenixAscensionMaterialFacts33() {
  return currentGameDataSelection.gameVersion === '3.3' ? resolvePhoenixAscensionSource33() : null
}
