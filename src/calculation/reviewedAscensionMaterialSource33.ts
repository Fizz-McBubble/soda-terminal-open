import type { CurrentAgentNumericContract } from './currentAgentNumericContracts'
import { stableContentHash } from '../domain/stableContentHash'

type AscensionMaterialSource33 = {
  provider: string
  url: string
  sourceVersion: string
  sha256: string
  providerManifestSha256: string
}

export type ReviewedAscensionMaterialSteps33 = Array<{
  ascension: number
  levelCapBefore: number
  levelCapAfter: number
  materials: Record<string, number>
  sourceLocator: string
}>

type ReviewedAscensionMaterialRecord33 = {
  contract: string
  agentId: string
  gameId: string
  attribute: string
  specialty: string
  sourceVersion: string
  source: AscensionMaterialSource33
  steps: ReviewedAscensionMaterialSteps33
  levelExperience: {
    experienceToNextLevel: number[]
    totalExperience1To60: number
  }
}

/** The caller binds this shared validator to one reviewed record and numeric source. */
export function resolveReviewedAscensionMaterialSource33<
  Source extends AscensionMaterialSource33,
  Experience extends ReviewedAscensionMaterialRecord33['levelExperience'],
>(
  record: ReviewedAscensionMaterialRecord33 & { source: Source; levelExperience: Experience },
  contract: CurrentAgentNumericContract | undefined,
  binding: {
    baseline: { agentId: string; gameId: string; source: Source }
    contractName: string
    contentHash: string
    isReviewedNumericContract: (contract: CurrentAgentNumericContract) => boolean
  },
) {
  if (
    !contract ||
    !binding.isReviewedNumericContract(contract) ||
    contract.source.provider !== 'nanoka' ||
    record.contract !== binding.contractName ||
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
    stableContentHash(record) !== binding.contentHash ||
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
      agentId: binding.baseline.agentId,
      gameId: binding.baseline.gameId,
      status: 'unknown' as const,
      reason: 'source_identity_or_material_steps_unresolved',
      source: binding.baseline.source,
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
