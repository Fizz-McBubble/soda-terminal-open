import { getCurrentDriveDiscFormulaData } from '../gameDataPacks/currentDriveDiscFormulaCatalog'
import { getCurrentWEngineStaticData } from '../gameDataPacks/currentWEngineStaticCatalog'
import { getCurrentAgentDecisionMechanicContract } from '../calculation/currentAgentDecisionMechanicContracts'
import {
  personalFunctionalConditionsSchema32,
  personalFunctionalConditionFields32,
} from '../calculation/personalFunctionalConditions32'

/** Keep saved, currently unequipped declarations, but never apply them to a
 * different source. Validate both the value and the pinned source identity. */
export function resolvePersonalFunctionalConditions32(input: {
  agentId: string
  engineId: string
  discs: readonly { setId: string }[]
  declaration?: unknown
}) {
  const empty = {
    engineFlags: {} as Record<string, boolean>,
    stacks: {} as Record<string, number>,
    discFlags: {} as Record<string, boolean>,
    references: {} as Record<string, boolean | number>,
    sourceRefs: [] as string[],
  }
  if (input.declaration === undefined) return { status: 'supported' as const, ...empty }
  const parsed = personalFunctionalConditionsSchema32.safeParse(input.declaration)
  if (!parsed.success)
    return { status: 'unsupported' as const, blockers: ['功能条件包含未知字段或超出来源范围。'] }
  const counts = new Map<string, number>()
  for (const disc of input.discs) counts.set(disc.setId, (counts.get(disc.setId) ?? 0) + 1)
  const activeFields = personalFunctionalConditionFields32({
    agentId: input.agentId,
    engineIds: [input.engineId],
    discSetIds: [...counts].filter(([, count]) => count >= 4).map(([id]) => id),
  })
  for (const field of activeFields) {
    const value =
      field.kind === 'boolean'
        ? (parsed.data.flags as Record<string, boolean> | undefined)?.[field.key]
        : (parsed.data.stacks as Record<string, number> | undefined)?.[field.key]
    if (value === undefined) continue
    const actualHash = field.engineId
      ? getCurrentWEngineStaticData(field.engineId)?.source.formulaSha256
      : field.discSetId
        ? getCurrentDriveDiscFormulaData(field.discSetId)?.fourPieceFormula.sha256
        : getCurrentAgentDecisionMechanicContract(input.agentId)?.effectContract.source
            .formulaSha256
    if (!actualHash || !field.sourceRefs.some((ref) => ref.endsWith(`#${actualHash}`)))
      return {
        status: 'unsupported' as const,
        blockers: [`功能条件来源身份已变化：${field.label}`],
      }
    if (
      field.key === 'morale_consumed' &&
      getCurrentAgentDecisionMechanicContract(input.agentId)?.effectContract.runtimeDefaults
        .references['dm.core.max_morale'] !== 100
    )
      return { status: 'unsupported' as const, blockers: ['莱特士气上限来源已变化。'] }
    if (field.kind === 'integer' && field.engineId) {
      const capIndices: Record<string, number> = {
        'HellfireGears:exSpecialUsed': 3,
        'IceJadeTeapot:teariffic': 2,
        'SpectralGaze:spiritLock': 3,
        'YesterdayCalls:physExSpecialUsed': 3,
      }
      const pinnedDataHashes: Record<string, string> = {
        'wengine-14110': '08B72EBF91AC91DABD86FE45A863F3613CA8FB2EBBC3FD94F8F489AD476F6992',
        'wengine-14125': 'F033E39AF0BBA6831AA26E20C772B5852FF680B27367F895C9366B86FE71E628',
        'wengine-14136': '1920AD33FFFFDDABE47C9B748ABD59FA4D4DF900C4A9EB49B8433742F6652DC7',
        'wengine-14148': '02DC31CE50309E76F90BEACBA5D1CD62A96D8890AB0BA646037DAD2CF92C8A7F',
      }
      const engine = getCurrentWEngineStaticData(field.engineId)
      const index = capIndices[field.key]
      if (
        !engine ||
        index === undefined ||
        engine.source.dataSha256 !== pinnedDataHashes[field.engineId] ||
        engine.passiveParameterTable.length !== 5 ||
        engine.passiveParameterTable.some((row) => row.params[index] !== field.max)
      )
        return {
          status: 'unsupported' as const,
          blockers: [`功能条件层数上限来源已变化：${field.label}`],
        }
      empty.sourceRefs.push(`${engine.source.dataPath}#${engine.source.dataSha256}`)
    }
    empty.sourceRefs.push(...field.sourceRefs)
    if (field.agentId) empty.references[field.key] = value as boolean | number
    else if (field.kind === 'integer') empty.stacks[field.key] = value as number
    else if (field.discSetId) empty.discFlags[field.key] = value as boolean
    else empty.engineFlags[field.key] = value as boolean
  }
  return { status: 'supported' as const, ...empty }
}
