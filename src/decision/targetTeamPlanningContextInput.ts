import type { CoreWarehouse } from '../accounts/coreFlow'
import type { TargetTeamWarehouseFit } from './targetTeamWarehouseFit'
import type { TargetTeamEquipmentParameterSelection } from './targetTeamAccountBoundBenchmark'
import type { TargetTeamEquipmentModifierProjection } from '../calculation/targetTeamEquipmentModifierProjection'
import type { TeamBuildExecutionIdentity } from './teamBuildExecutionIdentity'
import type { StandardSubstatProbe } from '../calculation/standardSubstatProbe'
import type { SourceResourceGrantDeclaration32 } from '../calculation/sourceMechanismResourceGrants32'
import type { CurrentPlanningScenarioSelection32 } from '../calculation/currentPlanningScenario32'
import type { ReviewedTemplateEventConditionDeclaration32 } from '../calculation/reviewedTemplateEventConditions32'
import type { DeclaredEventGoal32 } from './targetTeamDeclaredEventObjective32'
import type { CurrentWEngineFormulaRuntime } from '../calculation/currentWEnginePersonalPlanningEffects'
import { getCurrentWEngineStaticData } from '../gameDataPacks/currentWEngineStaticCatalog'
import { currentFormulaMechanicContractHash } from '../calculation/currentFormulaMechanicContracts'
import { stableContentHash } from '../gameDataPacks/types'
import {
  CAGE_OF_CONFINED_SIN_RUNTIME_INPUT_KEYS,
  CAGE_OF_CONFINED_SIN_STABLE_ID,
  TRICK_OF_CANDLEGLOW_RUNTIME_INPUT_KEYS,
  TRICK_OF_CANDLEGLOW_STABLE_ID,
  reviewedWEngine33Hash,
  reviewedWEngine33Identity,
} from '../calculation/reviewedWEngine33'

type TargetTeamWEngineRuntimeInputContract = {
  flags?: readonly {
    key: string
    unit: 'boolean'
    recipient: 'equipped_agent'
    meaning: string
  }[]
  numbers?: readonly {
    key: string
    unit: 'fraction_0_to_1'
    recipient: 'equipped_agent'
    appliesTo: 'enemy_hp'
    operator: 'lt'
    threshold: number
  }[]
}

export type TargetTeamWEngineRuntimeDeclaration = {
  agentId: string
  engineId: string
  sourceIdentity: string
  sourceRefs: readonly string[]
  sourceVersion?: string
  sourceProvider?: 'nanoka' | 'go'
  runtimeContract?: TargetTeamWEngineRuntimeInputContract
  runtime: CurrentWEngineFormulaRuntime
}

/** Candidate equipment may vary; the comparison's scene and cultivation may not. */
export function targetTeamObjectiveConditionsIdentity(
  input: Omit<TargetTeamPlanningContextInput, 'fit' | 'modifierProjection'> & {
    buildIntent?: unknown
  },
) {
  return stableContentHash({
    candidate: input.candidate,
    parameters: { ...input.parameters, wEngines: undefined },
    scenario: input.scenarioSelection ?? null,
    declaredEventGoal32: input.declaredEventGoal32 ?? null,
    resourceTimelineDeclaration32: input.resourceTimelineDeclaration32 ?? null,
    eventConditionDeclarations: input.eventConditionDeclarationsByAgentId ?? null,
    calibrationObservations: input.calibrationObservations ?? null,
    buildIntent: input.buildIntent ?? null,
    cultivation: input.candidate.memberIds.map((id) => {
      const member = input.warehouse.roster.agents.find((row) => row.agentId === id)
      return member
        ? {
            agentId: id,
            owned: member.owned,
            level: member.level,
            ascension: member.ascension,
            mindscape: member.mindscape,
            potentialImage: member.potentialImage,
            skillLevels: member.skillLevels,
          }
        : null
    }),
  })
}

/** Locked formula/data identity, not an assertion that a passive has triggered. */
export function targetTeamWEngineRuntimeSource(engineId: string) {
  const engine = getCurrentWEngineStaticData(engineId)
  if (!engine) return null
  if (engineId === TRICK_OF_CANDLEGLOW_STABLE_ID || engineId === CAGE_OF_CONFINED_SIN_STABLE_ID) {
    const reviewed = reviewedWEngine33Identity.sources.find(
      (source) => source.stableId === engineId,
    )
    if (!reviewed) return null
    const sourceRefs = [
      `${reviewed.source.url}#sha256=${reviewed.source.rawSha256}`,
      `nanoka-manifest:#sha256=${reviewed.source.providerManifestSha256}`,
      `reviewed-wengine-${reviewedWEngine33Identity.gameVersion}:${reviewed.stableId}#hash=${reviewedWEngine33Hash}`,
    ]
    const runtimeContract = (
      engineId === CAGE_OF_CONFINED_SIN_STABLE_ID
        ? {
            flags: [
              {
                key: CAGE_OF_CONFINED_SIN_RUNTIME_INPUT_KEYS.basicAttackHitWindowActive,
                unit: 'boolean',
                recipient: 'equipped_agent',
                meaning: '普通攻击命中敌人后16秒装备者攻击力与风属性抗性无视窗口。',
              },
            ],
          }
        : {
            flags: [
              {
                key: TRICK_OF_CANDLEGLOW_RUNTIME_INPUT_KEYS.exSpecialCritWindowActive,
                unit: 'boolean',
                recipient: 'equipped_agent',
                meaning: '强化特殊技触发后40秒装备者暴击率窗口。',
              },
            ],
            numbers: [
              {
                key: TRICK_OF_CANDLEGLOW_RUNTIME_INPUT_KEYS.enemyHpPercent,
                unit: 'fraction_0_to_1',
                recipient: 'equipped_agent',
                appliesTo: 'enemy_hp',
                operator: 'lt',
                threshold: 0.5,
              },
            ],
          }
    ) satisfies TargetTeamWEngineRuntimeInputContract
    const sourceVersion = reviewedWEngine33Identity.gameVersion
    if (reviewed.source.provider !== 'nanoka') return null
    const sourceProvider = 'nanoka' as const
    const sourceIdentity = stableContentHash({
      engineId,
      stableId: reviewed.stableId,
      gameId: reviewed.gameId,
      sourceVersion,
      sourceProvider,
      source: reviewed.source,
      runtimeContract,
    })
    return {
      sourceIdentity,
      sourceRefs,
      sourceVersion,
      sourceProvider,
      runtimeContract,
    }
  }
  const sourceRefs = [
    `${engine.source.formulaPath}#sha256=${engine.source.formulaSha256}`,
    `${engine.source.dataPath}#sha256=${engine.source.dataSha256}`,
    currentFormulaMechanicContractHash,
  ]
  return { sourceIdentity: stableContentHash({ engineId, sourceRefs }), sourceRefs }
}

/** Explicit finite states may fill unknowns but never contradict prepared source facts. */
export function resolveTargetTeamWEngineRuntime(input: {
  memberIds: readonly string[]
  parameters: Pick<TargetTeamEquipmentParameterSelection, 'wEngines'>
  declarations?: readonly TargetTeamWEngineRuntimeDeclaration[]
  prepared?: Readonly<Record<string, CurrentWEngineFormulaRuntime>>
}) {
  const runtimeByAgentId = structuredClone(input.prepared ?? {}) as Record<
    string,
    CurrentWEngineFormulaRuntime
  >
  const blockers: string[] = []
  const seen = new Set<string>()
  for (const declaration of input.declarations ?? []) {
    const source = targetTeamWEngineRuntimeSource(declaration.engineId)
    const selected = input.parameters.wEngines.filter((row) => row.agentId === declaration.agentId)
    if (
      seen.has(declaration.agentId) ||
      !input.memberIds.includes(declaration.agentId) ||
      selected.length !== 1 ||
      selected[0]!.engineId !== declaration.engineId ||
      !source ||
      source.sourceIdentity !== declaration.sourceIdentity ||
      stableContentHash([...source.sourceRefs].sort()) !==
        stableContentHash([...declaration.sourceRefs].sort()) ||
      source.sourceVersion !== declaration.sourceVersion ||
      source.sourceProvider !== declaration.sourceProvider ||
      ('runtimeContract' in source &&
        stableContentHash(source.runtimeContract) !==
          stableContentHash(declaration.runtimeContract ?? null))
    ) {
      blockers.push(`音擎有限状态的成员、装备或锁定来源身份不一致：${declaration.agentId}`)
      continue
    }
    seen.add(declaration.agentId)
    const previous = runtimeByAgentId[declaration.agentId] ?? {}
    const next: CurrentWEngineFormulaRuntime = { ...previous }
    for (const group of ['flags', 'numbers', 'accumulators', 'recipients'] as const) {
      const values = declaration.runtime[group]
      if (!values) continue
      for (const [key, value] of Object.entries(values)) {
        const known = previous[group]?.[key]
        if (known !== undefined && known !== value)
          blockers.push(`音擎有限状态与已核来源准备冲突：${declaration.agentId}/${group}/${key}`)
      }
      Object.assign(next, { [group]: { ...previous[group], ...values } })
    }
    runtimeByAgentId[declaration.agentId] = next
  }
  return blockers.length
    ? { status: 'unsupported' as const, blockers, fingerprint: stableContentHash(input) }
    : {
        status: 'supported' as const,
        runtimeByAgentId,
        identity: stableContentHash({
          declarations: input.declarations ?? [],
          prepared: input.prepared ?? {},
        }),
      }
}

export type TargetTeamPlanningContextInput = {
  warehouse: CoreWarehouse
  candidate: TeamBuildExecutionIdentity
  fit: Pick<
    TargetTeamWarehouseFit,
    'status' | 'uniqueDiscCount' | 'memberIds' | 'loadouts' | 'fingerprint'
  >
  parameters: TargetTeamEquipmentParameterSelection
  modifierProjection: TargetTeamEquipmentModifierProjection
  rosterHash: string
  warehouseHash: string
  planningHash: string
  capturedAt: string
  scenarioSelection?: CurrentPlanningScenarioSelection32
  declaredEventGoal32?: DeclaredEventGoal32
  wEngineRuntimeDeclarations?: readonly TargetTeamWEngineRuntimeDeclaration[]
  resourceTimelineDeclaration32?: import('../calculation/resourceTimelineDeclarationContract32').ResourceTimelineDeclaration32
  /** Explicit comparison preparation; never a player's observed battle state. */
  eventConditionDeclarationsByAgentId?: Readonly<
    Record<string, ReviewedTemplateEventConditionDeclaration32>
  >
  /** Internal, read-only sensitivity probe; never a saved physical loadout. */
  statProbesByAgentId?: Readonly<Record<string, StandardSubstatProbe>>
  /** Explicit independent fixture conditions, never populated from source UI
   * defaults or promoted to a player/account observation. */
  calibrationObservations?: {
    authority: 'independent_calibration'
    id: string
    referencesByAgentId: Readonly<Record<string, Readonly<Record<string, unknown>>>>
    resourceGrantDeclaration32?: SourceResourceGrantDeclaration32
  }
}
