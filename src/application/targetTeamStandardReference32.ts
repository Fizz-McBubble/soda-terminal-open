import {
  prepareTargetTeamStandardReferenceEquipment,
  selectTargetTeamStandardReferenceEquipment,
  standardTeamReferenceConditionAlternatives32,
  targetTeamStandardReferenceEquipmentPolicy,
  type StandardTeamReferencePreparationInput,
} from '../decision/standardTeamReferenceEquipment'
import { frozenMiyabiLuminizeDirection32 } from '../decision/targetTeamLuminizeAssignmentObjective32'
import type { StandardTeamReferenceSelectionBundle } from '../decision/standardTeamReferenceSelection'
import { bindStandardTeamReferenceSelection } from '../decision/standardTeamReferenceSelection'
import { createTeamStrengthCapacityContext } from '../decision/teamStrengthSourceCapacityActions'
import { memberFacts } from '../decision/teamStrengthMemberFacts'
import { bindDeclaredTeamStrengthSupportInput } from '../decision/teamStrengthSupportContribution'
import { currentNormalizedPlanningBaseline } from '../calculation/currentNormalizedPlanningBaseline'
import { supportsPotentialImage } from '../assault/agentCapabilities'
import type { DeclaredEventGoal32 } from '../decision/targetTeamDeclaredEventObjective32'
import { stableContentHash } from '../gameDataPacks/types'
import { preparePlanningBenchmark32 } from './privatePlanningBenchmarkBinding32'
import {
  validatePlanningEventDeclarations32,
  type PlanningEventDeclarationsInput32,
  type PlanningEventDeclarationsMetadata32,
} from './publicPlanningEventDeclarations32'

export type TargetTeamStandardReferenceRequest32 = {
  /** Explicit standard P0/P6 branch, never the account's observation. */
  potentialByAgentId?: Readonly<Record<string, number>>
} & (
  | { stage: 'prepare' }
  | {
      stage: 'select'
      preparedIdentity: string
      sourceBindingFingerprint: string
      /** Omitted only for the existing exact finite Luminize producer. */
      declarations?: PlanningEventDeclarationsInput32
    }
)

/** Separate standard reference, never an observed account or an account fit. */
export type TargetTeamStandardReferenceResult32 = {
  protocol:
    | 'local-standard-s0-a6-3x48-native-objective32'
    | 'local-formed-key-mindscapes-3x48-native-objective32'
  status: 'metadata' | 'selected' | 'unsupported'
  preparedIdentity: string | null
  referenceFingerprint: string | null
  sourceBindingFingerprint: string | null
  metadata: PlanningEventDeclarationsMetadata32 | null
  potentialByAgentId?: Readonly<Record<string, number>>
  /** Snapshot of this synthetic reference, independent of account progression. */
  referenceCultivation?: Array<{
    agentId: string
    level: number
    mindscape: number
    potential: number | null
    baseSkillLevel: number
    effectiveSkillLevel: number
    coreLevel: number
    substatRollBudget: number
  }>
  selectionIdentity: string | null
  objectiveIdentity: string | null
  coverageIdentity: string | null
  searchCompleteness: 'bounded' | null
  searchDiagnostics?: {
    evaluations: number
    unknownEvaluations: number
    differentCoverageEvaluations: number
    allDiscreteCombinationsVisited: boolean
  }
  equipment: Array<{
    agentId: string
    engineId: string
    refinement: number
    branchIdentity: string
    discCount: number
    /** Synthetic standard recipe, never account inventory or private damage. */
    discs?: Array<
      Pick<
        import('../domain/schemas').DriveDisc,
        'slot' | 'setId' | 'level' | 'mainStat' | 'subStats'
      >
    >
  }>
  consumerBindings?: {
    status: 'bound' | 'unsupported'
    selectionIdentity: string
    capacityReferenceIdentity: string | null
    supportReferenceIdentity: string | null
    gaps: string[]
  }
  gaps: string[]
}

/** Both existing consumers receive this same selection, never a second search.
 * This binds finite source contacts; it does not certify a combat cycle. */
function bindStandardConsumers(bundle: StandardTeamReferenceSelectionBundle) {
  const reference = bundle.prepared.referenceInput
  const ids = reference.candidate.memberIds
  const conditions = bundle.prepared.referenceConditions ?? {
    potentialByAgentId: reference.parameters.potentialByAgentId ?? {},
    evidenceRefs: [targetTeamStandardReferenceEquipmentPolicy.id],
  }
  const unavailable = (gaps: string[]) => ({
    status: 'unsupported' as const,
    selectionIdentity: bundle.selection.identity,
    capacityReferenceIdentity: null,
    supportReferenceIdentity: null,
    gaps,
  })
  const bound = bindStandardTeamReferenceSelection(bundle, {
    memberIds: ids,
    referenceConditions: conditions,
  })
  if (bound.status !== 'ready') return unavailable([bound.reason])
  const members = ids.flatMap((id) => {
    const member = memberFacts(id)
    return member ? [member] : []
  })
  if (members.length !== 3) return unavailable(['标准三人缺少当前来源动作身份。'])
  const capacity = createTeamStrengthCapacityContext(members, conditions, bundle)
  if (capacity.status === 'unsupported')
    return unavailable(capacity.gaps.flatMap((row) => row.fields))
  const subjectAgentId = ids.find((id) => capacity.usages.get(id)?.length)
  if (!subjectAgentId) return unavailable(['标准三人没有可绑定的有限来源动作。'])
  const support = bindDeclaredTeamStrengthSupportInput({
    memberIds: [ids[0]!, ids[1]!, ids[2]!],
    subjectAgentId,
    eventUsages: capacity.usages.get(subjectAgentId)!,
    baseline: {
      ...currentNormalizedPlanningBaseline,
      enemy: { ...currentNormalizedPlanningBaseline.enemy, stunMultiplier: 1 },
    },
    equipmentModifierBuckets: [],
    equipmentEffectExclusions: [],
    referenceConditions: conditions,
    standardTeamReferenceSelection: bundle,
  })
  if (support.status !== 'ready') return unavailable(support.blockers)
  if (
    support.builds.some(
      (row) =>
        row.identity !==
        bound.builds.find((build) => build.runtimeMember.agentId === row.agentId)?.identity,
    )
  )
    return unavailable(['标准来源接触与支援绑定采用了不同装备。'])
  return {
    status: 'bound' as const,
    selectionIdentity: bundle.selection.identity,
    capacityReferenceIdentity: capacity.standardReferenceIdentity,
    supportReferenceIdentity: stableContentHash(support.builds),
    gaps: [],
  }
}

/** Called only after a player selects one exact team. The independent seed and
 * metadata are issued here, rather than relabeling an account declaration. */
export function prepareTargetTeamStandardReference32(
  input: StandardTeamReferencePreparationInput,
  request?: TargetTeamStandardReferenceRequest32,
): {
  result: TargetTeamStandardReferenceResult32
  bundle?: StandardTeamReferenceSelectionBundle
} {
  const base: TargetTeamStandardReferenceResult32 = {
    protocol: 'local-formed-key-mindscapes-3x48-native-objective32',
    status: 'unsupported',
    preparedIdentity: null,
    referenceFingerprint: null,
    sourceBindingFingerprint: null,
    metadata: null,
    selectionIdentity: null,
    objectiveIdentity: null,
    coverageIdentity: null,
    searchCompleteness: null,
    equipment: [],
    gaps: [],
  }
  const potential = request?.potentialByAgentId
  if (
    potential &&
    Object.entries(potential).some(
      ([id, level]) =>
        !input.input.candidate.memberIds.includes(id) ||
        !supportsPotentialImage(id) ||
        !Number.isInteger(level) ||
        level < 0 ||
        level > 6 ||
        (input.referenceConditions?.potentialByAgentId[id] !== undefined &&
          input.referenceConditions.potentialByAgentId[id] !== level),
    )
  )
    throw new Error('标准潜能条件必须属于当前三人及已开放主体，且不得与既有标准声明冲突。')
  const prepared = prepareTargetTeamStandardReferenceEquipment(
    potential
      ? {
          ...input,
          referenceConditions: {
            ...input.referenceConditions,
            potentialByAgentId: { ...input.referenceConditions?.potentialByAgentId, ...potential },
            evidenceRefs: [
              ...(input.referenceConditions?.evidenceRefs ?? []),
              targetTeamStandardReferenceEquipmentPolicy.id,
            ],
          },
        }
      : input,
  )
  if (prepared.status !== 'supported') return { result: { ...base, gaps: [prepared.reason] } }
  const reference = prepared.referenceInput
  const referenceFingerprint = stableContentHash({
    protocol: base.protocol,
    policy: targetTeamStandardReferenceEquipmentPolicy,
    prepared: prepared.identity,
  })
  const binding = {
    runId: `standard-reference:${prepared.identity}`,
    candidateId: reference.candidate.candidateId,
    accountFingerprint: referenceFingerprint,
    capturedAt: reference.capturedAt,
    warehouse: reference.warehouse,
    fit: reference.fit,
    selectedEquipment: { ...reference.parameters, source: 'source_defaults' as const },
    equipmentConditionAlternatives32: standardTeamReferenceConditionAlternatives32(prepared),
  }
  const issued = preparePlanningBenchmark32(binding)
  const result = {
    ...base,
    preparedIdentity: prepared.identity,
    referenceFingerprint,
    sourceBindingFingerprint: issued.sourceBindingFingerprint,
    metadata: issued.metadata,
    potentialByAgentId: { ...reference.parameters.potentialByAgentId },
    referenceCultivation: reference.candidate.memberIds.map((agentId) => {
      const member = reference.warehouse.roster.agents.find((row) => row.agentId === agentId)!
      const effectiveSkillLevel = member.skillLevels.basic
      const coreLevel = member.skillLevels.core
      if (typeof effectiveSkillLevel !== 'number' || typeof coreLevel !== 'number')
        throw new Error('标准培养基线缺少已声明的有效技能或核心等级。')
      return {
        agentId,
        level: member.level,
        mindscape: member.mindscape,
        potential: supportsPotentialImage(agentId) ? (member.potentialImage ?? null) : null,
        baseSkillLevel: targetTeamStandardReferenceEquipmentPolicy.cultivation.baseSkillLevel,
        effectiveSkillLevel,
        coreLevel,
        substatRollBudget: targetTeamStandardReferenceEquipmentPolicy.search.allocation.totalRolls,
      }
    }),
    gaps: [...issued.gaps],
  }
  // A named, finite static goal already has its own producer. Other teams need
  // explicit conditions from this standard vocabulary, not guessed event counts.
  if (request?.stage === 'prepare')
    return {
      result: {
        ...result,
        status: issued.metadata && !issued.gaps.length ? 'metadata' : 'unsupported',
      },
    }
  let goal: DeclaredEventGoal32 | undefined
  if (request?.stage === 'select') {
    if (
      request.preparedIdentity !== prepared.identity ||
      request.sourceBindingFingerprint !== issued.sourceBindingFingerprint ||
      issued.gaps.length ||
      !issued.metadata ||
      (request.declarations
        ? validatePlanningEventDeclarations32(request.declarations, issued.metadata).gaps.length
        : !frozenMiyabiLuminizeDirection32(reference))
    )
      throw new Error('标准参考的来源、培养、分支或逐次条件已变化，请重新读取标准条件。')
    if (request.declarations)
      goal = {
        declarations: structuredClone(request.declarations),
        sourceBindingFingerprint: issued.sourceBindingFingerprint,
        referenceAccountFingerprint: referenceFingerprint,
        referenceFit: {
          fingerprint: reference.fit.fingerprint,
          loadouts: reference.fit.loadouts.map(({ agentId, discIds }) => ({
            agentId,
            discIds: [...discIds],
          })),
        },
        referenceSelectedEquipment: binding.selectedEquipment,
        equipmentConditionAlternatives32: binding.equipmentConditionAlternatives32,
      }
  } else if (!frozenMiyabiLuminizeDirection32(reference)) {
    return {
      result: {
        ...result,
        status: issued.metadata && !issued.gaps.length ? 'metadata' : 'unsupported',
        gaps: [...result.gaps, '标准整队目标尚未取得该参考的逐次事件条件。'],
      },
    }
  }
  const selection = selectTargetTeamStandardReferenceEquipment({
    prepared,
    declaredEventGoal32: goal,
  })
  if (selection.status !== 'supported') return { result: { ...result, gaps: [selection.reason] } }
  const bundle = { prepared, selection, declaredEventGoal32: goal }
  return {
    result: {
      ...result,
      status: 'selected',
      // This DTO carries no private candidate damage, DPS or strength label.
      selectionIdentity: selection.identity,
      objectiveIdentity: selection.objectiveIdentity,
      coverageIdentity: selection.coverageIdentity,
      searchCompleteness: selection.diagnostics.searchCompleteness,
      searchDiagnostics: {
        evaluations: selection.diagnostics.evaluations,
        unknownEvaluations: selection.diagnostics.unknownEvaluations,
        differentCoverageEvaluations: selection.diagnostics.differentCoverageEvaluations,
        allDiscreteCombinationsVisited: selection.diagnostics.allDiscreteCombinationsVisited,
      },
      equipment: selection.selections.map((row) => ({
        agentId: row.agentId,
        engineId: row.engineId,
        refinement: row.refinement,
        branchIdentity: row.branchIdentity,
        discCount: row.discs.length,
        discs: row.discs.map(({ slot, setId, level, mainStat, subStats }) => ({
          slot,
          setId,
          level,
          mainStat,
          subStats: structuredClone(subStats),
        })),
      })),
      consumerBindings: bindStandardConsumers(bundle),
      gaps: [],
    },
    bundle,
  }
}
