import phoenix from '../gameDataPacks/data/reviewed-phoenix-numeric.3.3.json' with { type: 'json' }
import { currentGameDataSelection } from '../gameDataPacks/currentGameDataSelection'
import {
  currentAgentEventContracts,
  getCurrentAgentEventContract,
  type CurrentAgentEventContract,
} from './currentAgentMechanicContracts'
import { stableContentHash } from '../gameDataPacks/types'

export type NanokaNumericSource = Omit<typeof phoenix.source, 'provider'> & { provider: 'nanoka' }
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
  source: { ...phoenix.source, provider: 'nanoka' },
}
const phoenixBinding = stableContentHash(phoenixContract)
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
export const currentAgentNumericContracts: CurrentAgentNumericContract[] = [
  ...currentAgentEventContracts.map(
    ({ stableId, identity, baseStats, promotionStats, coreStats, source }) => ({
      stableId,
      identity,
      baseStats,
      promotionStats,
      coreStats,
      source: { ...source, provider: 'genshin_optimizer' as const },
    }),
  ),
  ...(currentGameDataSelection.gameVersion === '3.3' ? [phoenixContract] : []),
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
      ]
    : []

/** Passive level 1 already grants AP; core growth level 1 remains a separate zero row. */
export function resolveCurrentAgentInitialNumericPassive(agentId: string, coreLevel: number) {
  const contract = getCurrentAgentNumericContract(agentId)
  if (!contract || !Number.isInteger(coreLevel) || coreLevel < 1 || coreLevel > 7)
    return { status: 'unsupported' as const, reason: '代理人或核心等级未建立数值来源。' }
  if (contract.source.provider === 'genshin_optimizer')
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
