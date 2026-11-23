import phoenix from '../gameDataPacks/data/reviewed-phoenix-numeric.3.3.json' with { type: 'json' }
import phoenixEventOverlay from '../gameDataPacks/data/phoenix-event-contract.3.3.json' with { type: 'json' }
import severian from '../gameDataPacks/data/reviewed-severian-numeric.3.3.json' with { type: 'json' }
import severianEventOverlay from '../gameDataPacks/data/severian-event-contract.3.3.json' with { type: 'json' }
import { currentGameDataSelection } from '../gameDataPacks/currentGameDataSelection'
import {
  baseCurrentAgentEventContracts,
  getCurrentAgentEventContract,
  type CurrentAgentEventContract,
} from './currentAgentMechanicContracts'
import { stableContentHash } from '../gameDataPacks/types'

export type NanokaNumericSource = (
  | Omit<typeof phoenix.source, 'provider'>
  | Omit<typeof severian.source, 'provider'>
) & { provider: 'nanoka' }
export type CurrentAgentNumericContract = Pick<
  CurrentAgentEventContract,
  'stableId' | 'identity' | 'baseStats' | 'promotionStats' | 'coreStats'
> & {
  externalId?: string
  source:
    | (CurrentAgentEventContract['source'] & { provider: 'genshin_optimizer' })
    | NanokaNumericSource
  initialPassive?: typeof phoenix.initialPassive
}
const phoenixContract: CurrentAgentNumericContract = {
  ...phoenix,
  identity: phoenixEventOverlay.identity,
  source: { ...phoenix.source, provider: 'nanoka' },
}
const phoenixBinding = stableContentHash(phoenixContract)
const severianContract: CurrentAgentNumericContract = {
  ...severian,
  identity: severianEventOverlay.identity,
  source: { ...severian.source, provider: 'nanoka' },
}
const severianBinding = stableContentHash(severianContract)
/** Accept only the reviewed complete numeric/source binding, never a source-tagged lookalike. */
export function isReviewedPhoenixNumericContract(contract: CurrentAgentNumericContract) {
  return (
    contract.source.provider === 'nanoka' &&
    contract.source.rawSha256 ===
      '237c5b060657db1fd8ababe6cd26fb275c325d74a67eda481bde6732c7d93dfe' &&
    contract.source.providerManifestSha256 ===
      '4d30f529d6e0568a130ebe4d79557b30d9c65d2219e77461763df1c4b42cb029' &&
    stableContentHash(contract) === phoenixBinding
  )
}
export function isReviewedSeverianNumericContract(contract: CurrentAgentNumericContract) {
  return (
    contract.source.provider === 'nanoka' &&
    contract.source.rawSha256 ===
      '89f3a03b90fca880851352d6d686e6bbe658411d7b4cdf6b78d2a14a97ff5974' &&
    contract.source.providerManifestSha256 ===
      '4d30f529d6e0568a130ebe4d79557b30d9c65d2219e77461763df1c4b42cb029' &&
    stableContentHash(contract) === severianBinding
  )
}
export function isReviewedNanoka33NumericContract(contract: CurrentAgentNumericContract) {
  return isReviewedPhoenixNumericContract(contract) || isReviewedSeverianNumericContract(contract)
}
export const currentAgentNumericContracts: CurrentAgentNumericContract[] = [
  ...baseCurrentAgentEventContracts.map(
    ({ stableId, identity, baseStats, promotionStats, coreStats, source }) => ({
      stableId,
      identity,
      baseStats,
      promotionStats,
      coreStats,
      source: { ...source, provider: 'genshin_optimizer' as const },
    }),
  ),
  ...(currentGameDataSelection.gameVersion === '3.3' ? [phoenixContract, severianContract] : []),
]
export function getCurrentAgentNumericContract(stableId: string) {
  const numeric = currentAgentNumericContracts.find((agent) => agent.stableId === stableId)
  if (numeric?.source.provider !== 'genshin_optimizer') return numeric
  const event = getCurrentAgentEventContract(stableId)
  if (!event) return undefined
  return {
    ...numeric,
    identity: event.identity,
    baseStats: event.baseStats,
    promotionStats: event.promotionStats,
    coreStats: event.coreStats,
    source: { ...event.source, provider: 'genshin_optimizer' as const },
  }
}
export const sourceBoundPotentialAbsence =
  currentGameDataSelection.gameVersion === '3.3'
    ? [
        {
          stableId: phoenix.stableId,
          externalId: phoenix.externalId,
          source: phoenixContract.source as NanokaNumericSource,
          ...phoenix.potentialAbsence,
        },
        {
          stableId: severian.stableId,
          externalId: severian.externalId,
          source: severianContract.source as NanokaNumericSource,
          ...severian.potentialAbsence,
        },
      ]
    : []

/** Passive level 1 already grants AP; core growth level 1 remains a separate zero row. */
export function resolveCurrentAgentInitialNumericPassive(agentId: string, coreLevel: number) {
  const contract = getCurrentAgentNumericContract(agentId)
  if (!contract || !Number.isInteger(coreLevel) || coreLevel < 1 || coreLevel > 7)
    return { status: 'unsupported' as const, reason: '代理人或核心等级未建立数值来源。' }
  if (
    contract.source.provider === 'genshin_optimizer' ||
    isReviewedSeverianNumericContract(contract)
  )
    return { status: 'supported' as const, anomalyProficiency: 0, sourceRefs: [] as string[] }
  if (
    !isReviewedPhoenixNumericContract(contract) ||
    contract.initialPassive?.condition !== 'unconditional'
  )
    return { status: 'unsupported' as const, reason: '初始被动来源绑定不匹配。' }
  return {
    status: 'supported' as const,
    anomalyProficiency: contract.initialPassive.valuesByCoreLevel[coreLevel - 1]!,
    sourceRefs: [
      `${contract.source.url}#${contract.source.rawSha256}:${contract.source.locators.corePassive}`,
    ],
  }
}
