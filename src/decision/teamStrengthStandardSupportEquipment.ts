import {
  allocateStandardReferenceDiscs,
  standardReferenceDiscAllocationPolicy,
} from '../calculation/standardReferenceDiscAllocation'
import {
  projectFixedEventSupportContribution32,
  type FixedEventSupportInput32,
} from '../calculation/fixedEventSupportContribution32'
import { projectTargetTeamWEngineModifiers } from '../calculation/targetTeamEquipmentModifierProjection'
import type { CurrentWEngineFormulaRuntime } from '../calculation/currentWEnginePersonalPlanningEffects'
import { getCandidateWarehouseConstraintForTeam } from '../gameDataPacks/candidateWarehouseConstraints'
import { resolveBuildIntentWEngineIds } from '../gameDataPacks/buildIntentWEngineIdentity'
import {
  getCurrentWEngineStaticData,
  currentWEngineStaticCatalog,
} from '../gameDataPacks/currentWEngineStaticCatalog'
import { currentFormulaMechanicContractHash } from '../calculation/currentFormulaMechanicContracts'
import { stableContentHash } from '../gameDataPacks/types'
import {
  createTeamStrengthEquippedReferenceMember,
  localStandardReferenceBuildPolicy,
  type StandardReferenceEquipmentSelection,
} from './teamStrengthReferenceBuild'
import type { TeamStrengthReferenceConditions } from './teamStrengthReferenceConditionsTypes'

type ReadyBuild = Extract<
  ReturnType<typeof createTeamStrengthEquippedReferenceMember>,
  { status: 'ready' }
>
export type StandardSupportEquipmentGoal = {
  providerAgentId: 'agent-astra'
  /** Explicit finite equipment state per candidate, never guessed from the character's buff. */
  wEngineRuntimeByEngineId: Readonly<Record<string, CurrentWEngineFormulaRuntime>>
  maxEvaluations?: number
}
export const standardSupportEquipmentPolicy = {
  id: 'astra-fixed-recipient-support-delta-legal48-engine-comparison/v1',
  provider: 'agent-astra',
  objective: 'fixed_event_support_delta',
  equipmentScope: 'provider_wengine_and_static_discs',
  fixedRecipients: 'unchanged_declared_reference_builds',
  searchCompleteness: 'bounded',
  numericalStrengthAdjudication: false,
} as const

/** A local-standard provider slice. Fixed recipients keep their declared historical
 * protocol; this is not an adoption of the whole three-member standard or a cycle. */
export function selectStandardSupportEquipment(input: {
  goal: StandardSupportEquipmentGoal
  fixedInput: FixedEventSupportInput32
  builds: readonly ReadyBuild[]
  referenceConditions?: TeamStrengthReferenceConditions
}) {
  const { goal, fixedInput, builds } = input
  if (goal.providerAgentId !== 'agent-astra')
    return { status: 'unsupported' as const, reason: '当前标准支援切片仅采用已核验的耀嘉音来源。' }
  const provider = builds.find((row) => row.runtimeMember.agentId === goal.providerAgentId)
  if (!provider || fixedInput.subjectAgentId === goal.providerAgentId)
    return { status: 'unsupported' as const, reason: '标准支援目标需要固定的其他接受者。' }
  if (fixedInput.baselineReferencesByAgentId?.[goal.providerAgentId]?.idyllic_cadenza !== true)
    return { status: 'unsupported' as const, reason: '缺少显式耀嘉音支援开启状态。' }
  const recommendation = getCandidateWarehouseConstraintForTeam(goal.providerAgentId, {
    memberIds: fixedInput.memberIds,
    agentStateById: Object.fromEntries(
      builds.map((row) => [
        row.runtimeMember.agentId,
        {
          potentialImage: row.runtimeMember.potential,
          mindscape: row.runtimeMember.mindscape,
        },
      ]),
    ),
  })
  if (!recommendation) return { status: 'unsupported' as const, reason: '缺少当前队伍音擎方向。' }
  const directions = recommendation.wEngineDirections.map(
    (direction) =>
      direction.match(/^(wengine-\d+)(?=$|[（(])/u)?.[1] ??
      direction.match(/^[^（）()：:]*[（(](wengine-\d+)[)）]/u)?.[1] ??
      direction,
  )
  const engineIds = resolveBuildIntentWEngineIds(goal.providerAgentId, directions)
  const objectiveIdentity = stableContentHash({
    policy: standardSupportEquipmentPolicy,
    cultivation: localStandardReferenceBuildPolicy,
    formula: currentFormulaMechanicContractHash,
    engineCatalog: currentWEngineStaticCatalog.contentHash,
    allocationPolicy: standardReferenceDiscAllocationPolicy,
    recommendation: recommendation.contentHash,
    fixedInput,
    fixedBuilds: builds.map((row) => row.identity),
    goal,
    engineIds,
  })
  const diagnostics: {
    engineId: string
    status: string
    reason?: string
    value?: number
    allocation?: unknown
  }[] = []
  const choices: {
    selection: StandardReferenceEquipmentSelection
    build: ReadyBuild
    value: number
    boundInput: FixedEventSupportInput32
  }[] = []
  for (const engineId of [...engineIds].sort()) {
    const engine = getCurrentWEngineStaticData(engineId)
    if (!engine || engine.specialty !== 'support') {
      diagnostics.push({ engineId, status: 'ineligible', reason: '来源音擎缺失或职业不适用。' })
      continue
    }
    const runtime = goal.wEngineRuntimeByEngineId[engineId]
    if (!runtime) {
      diagnostics.push({ engineId, status: 'unknown', reason: '未声明该音擎有限状态。' })
      continue
    }
    const refinement = engine.rarity === 'S' ? 1 : 5
    const project = (discs: ReadyBuild['equipment']['discs']) => {
      const selection = {
        engineId,
        refinement,
        discs,
        objectiveIdentity,
        identity: stableContentHash({ objectiveIdentity, engineId, refinement, discs }),
      }
      const build = createTeamStrengthEquippedReferenceMember({
        agentId: goal.providerAgentId,
        memberIds: fixedInput.memberIds,
        referenceConditions: input.referenceConditions,
        standardEquipmentSelection: selection,
      })
      if (build.status !== 'ready') return null
      const members = fixedInput.members.map((member) =>
        member.agentId === goal.providerAgentId ? build.runtimeMember : member,
      )
      const gear = projectTargetTeamWEngineModifiers({
        memberIds: fixedInput.memberIds,
        members,
        selectionScope: 'declared_subset',
        parameters: {
          wEngines: [{ agentId: goal.providerAgentId, engineId, refinement }],
        },
        runtimeByAgentId: { [goal.providerAgentId]: runtime },
      })
      const ownEngine = gear.wEngines.find((row) => row.agentId === goal.providerAgentId)
      if (
        gear.status !== 'supported' ||
        ownEngine?.passiveStatus !== 'supported' ||
        !ownEngine.specialtyMatches
      )
        return null
      // Other members' engine passives remain outside the pre-existing fixed
      // reference slice. Only the varied provider's declared engine is added.
      const boundInput: FixedEventSupportInput32 = {
        ...fixedInput,
        members,
        equipmentModifierBuckets: [
          ...fixedInput.equipmentModifierBuckets,
          ...gear.directRuntime.buckets,
        ],
        equipmentEffectExclusions: [
          ...fixedInput.equipmentEffectExclusions,
          ...gear.directRuntime.exclusions,
        ],
      }
      const result = projectFixedEventSupportContribution32(boundInput)
      if (result.status === 'unsupported') return null
      const value = result.contributions.find(
        (row) => row.providerAgentId === goal.providerAgentId,
      )?.supportDelta
      if (value === null || value === undefined || !Number.isFinite(value)) return null
      return { selection, build, value, boundInput }
    }
    const allocation = allocateStandardReferenceDiscs({
      discs: provider.equipment.discs,
      objectiveIdentity: stableContentHash({
        objectiveIdentity,
        engineId,
        refinement,
        source: engine.source,
      }),
      maxEvaluations: goal.maxEvaluations,
      evaluate: (discs) => project([...discs])?.value ?? null,
    })
    if (allocation.status === 'unsupported') {
      diagnostics.push({ engineId, status: 'unknown', reason: allocation.reason })
      continue
    }
    const selected = project(allocation.discs)
    if (!selected) {
      diagnostics.push({ engineId, status: 'unknown', reason: '最终完整装备目标不可执行。' })
      continue
    }
    choices.push(selected)
    diagnostics.push({
      engineId,
      status: 'compared',
      value: selected.value,
      allocation: allocation.diagnostics,
    })
  }
  choices.sort(
    (a, b) => b.value - a.value || a.selection.engineId.localeCompare(b.selection.engineId),
  )
  const best = choices[0]
  if (!best)
    return {
      status: 'unsupported' as const,
      reason: '没有已闭合有限条件下可比较的48次支援配装。',
      objectiveIdentity,
      diagnostics,
    }
  return {
    status: 'supported' as const,
    ...best,
    objectiveIdentity,
    diagnostics,
    comparisonCoverage: diagnostics.every(
      (row) => row.status === 'compared' || row.status === 'ineligible',
    )
      ? ('complete' as const)
      : ('partial' as const),
    policy: standardSupportEquipmentPolicy,
  }
}
