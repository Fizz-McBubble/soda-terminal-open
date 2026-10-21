import data from './agentAscensionMaterials32.data.json'
import lockedSkillMaterials from './skillInvestmentMaterials32.data.json'
import { getCurrentAgentEventContract } from './currentAgentMechanicContracts'
import { stableContentHash } from '../gameDataPacks/types'
import { currentGameDataSelection } from '../gameDataPacks/currentGameDataSelection'
import { getPhoenixAscensionMaterialFacts33 } from './phoenixAscensionMaterials33'

type MaterialStep = {
  ascension: number
  levelCapBefore: number
  levelCapAfter: number
  materials: Record<string, number>
  sourceLocator: string
}

type MaterialSource = { url: string; sourceVersion: string; sha256: string }
type SupportedMaterialRecord = {
  agentId: string
  gameId: string
  status: 'supported'
  attribute: string
  specialty: string
  source: MaterialSource
  steps: readonly MaterialStep[]
}
type UnknownMaterialRecord = {
  agentId: string
  gameId: string
  status: 'unknown'
  reason: string
  source: MaterialSource
}
type RawMaterialRecord = {
  agentId: string
  gameId: string
  status: string
  reason?: string
  attribute?: string
  specialty?: string
  source: MaterialSource
  steps?: MaterialStep[]
}
const byAgentId = new Map(
  (data.records as unknown as readonly RawMaterialRecord[]).map((record) => [
    record.agentId,
    record,
  ]),
)
const lockedSources = new Map(lockedSkillMaterials.rows.map((row) => [row.agentId, row]))

export const agentAscensionMaterials32Identity = Object.freeze({
  contract: data.contract,
  sourceVersion: data.sourceVersion,
  recordCount: data.records.length,
  supportedCount: data.records.filter((record) => record.status === 'supported').length,
  contentHash: stableContentHash(data),
})

export function getAgentAscensionMaterialFacts(
  agentId: string,
): SupportedMaterialRecord | UnknownMaterialRecord | null {
  if (agentId === 'agent-phoenix')
    return currentGameDataSelection.gameVersion === '3.3'
      ? getPhoenixAscensionMaterialFacts33()
      : null
  const record = byAgentId.get(agentId)
  if (!record) return null
  if (record.status !== 'supported')
    return { ...record, status: 'unknown', reason: record.reason ?? 'source_materials_unavailable' }
  const contract = getCurrentAgentEventContract(agentId)
  const locked = lockedSources.get(agentId)
  if (
    contract?.externalId !== record.gameId ||
    contract.identity.attribute !== record.attribute ||
    contract.identity.specialty !== record.specialty ||
    record.source.sourceVersion !== data.sourceVersion ||
    record.source.sourceVersion !== '3.2' ||
    locked?.source.sha256 !== record.source.sha256 ||
    !/^[A-F0-9]{64}$/.test(record.source.sha256) ||
    record.steps?.length !== 5 ||
    record.steps.some(
      (step, index) =>
        step.ascension !== index + 1 ||
        step.levelCapBefore !== (index + 1) * 10 ||
        step.levelCapAfter !== (index + 2) * 10 ||
        !Object.keys(step.materials).length ||
        Object.entries(step.materials).some(
          ([id, quantity]) => !/^\d+$/.test(id) || !Number.isSafeInteger(quantity) || quantity <= 0,
        ),
    )
  )
    return { ...record, status: 'unknown', reason: 'source_identity_or_material_steps_unresolved' }
  return {
    ...record,
    status: 'supported',
    attribute: record.attribute!,
    specialty: record.specialty!,
    steps: record.steps!,
  }
}

export function resolveAgentAscensionMaterials(input: {
  agentId: string
  currentAscension: number
  targetAscension: number
}) {
  const { agentId, currentAscension, targetAscension } = input
  if (
    !Number.isInteger(currentAscension) ||
    !Number.isInteger(targetAscension) ||
    currentAscension < 0 ||
    currentAscension > 5 ||
    targetAscension < 0 ||
    targetAscension > 5 ||
    targetAscension < currentAscension
  )
    return { status: 'unknown' as const, reason: 'invalid_ascension_range' as const }

  const record = getAgentAscensionMaterialFacts(agentId)
  if (!record) return { status: 'unknown' as const, reason: 'agent_not_in_locked_source' }
  if (targetAscension === currentAscension)
    return {
      status: 'no_upgrade' as const,
      denny: 0,
      materials: {} as Record<string, number>,
      steps: [] as MaterialStep[],
    }
  if (record.status !== 'supported') return { status: 'unknown' as const, reason: record.reason }

  const steps = record.steps.filter(
    (step) => step.ascension > currentAscension && step.ascension <= targetAscension,
  )
  const materials: Record<string, number> = {}
  let denny = 0
  for (const step of steps) {
    for (const [itemId, quantity] of Object.entries(step.materials)) {
      materials[itemId] = (materials[itemId] ?? 0) + quantity
    }
    denny += step.materials['10'] ?? 0
  }
  return { status: 'supported' as const, agentId, gameId: record.gameId, denny, materials, steps }
}
