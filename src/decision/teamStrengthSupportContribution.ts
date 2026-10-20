import {
  bindStandardTeamReferenceSelection,
  bindStandardTeamContactEquipment,
  type StandardTeamReferenceSelectionBundle,
} from './standardTeamReferenceSelection'
import { getCurrentAgentEventContract } from '../calculation/currentAgentMechanicContracts'
import { createTeamStrengthEquippedReferenceMember } from './teamStrengthReferenceBuild'
import type { TeamStrengthReferenceConditions } from './teamStrengthReferenceConditionsTypes'
import {
  compareFixedEventSupportContribution32,
  projectFixedEventSupportContribution32,
  type FixedEventSupportInput32,
} from '../calculation/fixedEventSupportContribution32'
import { stableContentHash } from '../gameDataPacks/types'
import {
  selectStandardSupportEquipment,
  type StandardSupportEquipmentGoal,
} from './teamStrengthStandardSupportEquipment'

export type DeclaredTeamStrengthSupportInput = Omit<FixedEventSupportInput32, 'members'> & {
  referenceConditions?: TeamStrengthReferenceConditions
  standardSupportEquipmentGoal?: StandardSupportEquipmentGoal
  standardTeamReferenceSelection?: StandardTeamReferenceSelectionBundle
}
export type StandardTeamReferenceEvidence = {
  identity: string
  selection: StandardTeamReferenceSelectionBundle['selection']
}

export function bindDeclaredTeamStrengthSupportInput(input: DeclaredTeamStrengthSupportInput) {
  if (input.standardTeamReferenceSelection && input.standardSupportEquipmentGoal)
    return {
      status: 'unsupported' as const,
      blockers: ['整队标准配装不能同时重新优化单一支援装备。'],
    }
  const standard = input.standardTeamReferenceSelection
    ? bindStandardTeamReferenceSelection(input.standardTeamReferenceSelection, {
        memberIds: input.memberIds,
        referenceConditions: input.referenceConditions,
      })
    : undefined
  if (standard?.status === 'unsupported')
    return { status: 'unsupported' as const, blockers: [standard.reason] }
  const builds =
    standard?.status === 'ready'
      ? standard.builds
      : input.memberIds.map((agentId) =>
          createTeamStrengthEquippedReferenceMember({
            agentId,
            memberIds: input.memberIds,
            referenceConditions: input.referenceConditions,
          }),
        )
  const unsupported = builds.filter((row) => row.status === 'unsupported')
  if (unsupported.length)
    return { status: 'unsupported' as const, blockers: unsupported.map((row) => row.reason) }
  let ready = builds.filter((row) => row.status === 'ready')
  const { standardSupportEquipmentGoal, standardTeamReferenceSelection, ...fixed } = input
  if (
    standard?.status === 'ready' &&
    input.eventUsages.some((usage) => {
      const event = getCurrentAgentEventContract(usage.ownerAgentId)?.eventContract.events.find(
        (event) => event.eventId === usage.eventId,
      )
      return (
        !event ||
        standard.builds.find((build) => build.runtimeMember.agentId === usage.ownerAgentId)
          ?.runtimeMember.skillLevels[event.skill] !== usage.skillLevel
      )
    })
  )
    return {
      status: 'unsupported' as const,
      blockers: ['标准事件技能等级与完整三人培养协议不一致。'],
    }
  const standardEquipment =
    standard?.status === 'ready'
      ? bindStandardTeamContactEquipment(standard, input.eventUsages)
      : undefined
  if (standardEquipment?.status === 'unsupported')
    return { status: 'unsupported' as const, blockers: [standardEquipment.reason] }
  const declaredReferences =
    standardEquipment?.status === 'ready' ? standardEquipment.referencesByAgentId : undefined
  if (
    declaredReferences &&
    Object.entries(input.baselineReferencesByAgentId ?? {}).some(([id, refs]) =>
      Object.entries(refs).some(
        ([key, value]) =>
          stableContentHash(declaredReferences[id]?.[key]) !== stableContentHash(value),
      ),
    )
  )
    return {
      status: 'unsupported' as const,
      blockers: ['标准接触来源条件与同一有限目标声明冲突。'],
    }
  let boundInput: FixedEventSupportInput32 &
    Pick<DeclaredTeamStrengthSupportInput, 'referenceConditions'> = {
    ...fixed,
    members: ready.map((row) => row.runtimeMember),
    ...(declaredReferences ? { baselineReferencesByAgentId: declaredReferences } : {}),
    ...(standardEquipment?.status === 'ready'
      ? {
          equipmentModifierBuckets: [
            ...fixed.equipmentModifierBuckets,
            ...standardEquipment.buckets,
          ],
          equipmentEffectExclusions: [
            ...fixed.equipmentEffectExclusions,
            ...standardEquipment.exclusions,
          ],
        }
      : {}),
  }
  const selection = standardSupportEquipmentGoal
    ? selectStandardSupportEquipment({
        goal: standardSupportEquipmentGoal,
        fixedInput: boundInput,
        builds: ready,
        referenceConditions: input.referenceConditions,
      })
    : undefined
  if (selection?.status === 'unsupported')
    return {
      status: 'unsupported' as const,
      blockers: [selection.reason],
      standardEquipmentEvidence: selection,
    }
  if (selection?.status === 'supported') {
    ready = ready.map((row) =>
      row.runtimeMember.agentId === standardSupportEquipmentGoal!.providerAgentId
        ? selection.build
        : row,
    )
    boundInput = { ...boundInput, ...selection.boundInput }
  }
  return {
    status: 'ready' as const,
    input: boundInput,
    standardEquipmentEvidence: selection,
    standardTeamReferenceEvidence:
      standard?.status === 'ready' && standardTeamReferenceSelection
        ? ({
            identity: standard.identity,
            selection: standardTeamReferenceSelection.selection,
          } satisfies StandardTeamReferenceEvidence)
        : undefined,
    builds: ready.map((row) => ({
      agentId: row.runtimeMember.agentId,
      identity: row.identity,
      sourceRefs: row.sourceRefs,
      limitations: row.limitations,
      equipment: row.equipment,
    })),
  }
}

/** Rating development uses the same sourced event calculation as gear and
 * team planning. A finite contribution is not a coarse team-strength label. */
export function projectDeclaredTeamStrengthSupportContribution(
  input: DeclaredTeamStrengthSupportInput,
) {
  const bound = bindDeclaredTeamStrengthSupportInput(input)
  if (bound.status === 'unsupported') return bound
  const result = projectFixedEventSupportContribution32(bound.input)
  return {
    ...result,
    referenceBuilds: bound.builds,
    referenceIdentity: stableContentHash(bound.builds),
    numericalStrengthAdjudication: false as const,
    standardEquipmentEvidence: bound.standardEquipmentEvidence,
    standardTeamReferenceEvidence: bound.standardTeamReferenceEvidence,
  }
}

export function compareDeclaredTeamStrengthSupportContribution(
  left: DeclaredTeamStrengthSupportInput,
  right: DeclaredTeamStrengthSupportInput,
) {
  const a = bindDeclaredTeamStrengthSupportInput(left)
  const b = bindDeclaredTeamStrengthSupportInput(right)
  if (a.status === 'unsupported' || b.status === 'unsupported')
    return {
      status: 'unsupported' as const,
      blockers: [
        ...(a.status === 'unsupported' ? a.blockers : []),
        ...(b.status === 'unsupported' ? b.blockers : []),
      ],
    }
  const common = left.memberIds.filter((id) => right.memberIds.includes(id))
  const commonSources = (bound: typeof a) =>
    bound.builds
      .filter((row) => common.includes(row.agentId))
      .map((row) => ({
        agentId: row.agentId,
        equipment: row.equipment,
        sourceRefs: row.sourceRefs,
      }))
      .sort((x, y) => x.agentId.localeCompare(y.agentId))
  if (stableContentHash(commonSources(a)) !== stableContentHash(commonSources(b)))
    return {
      status: 'unsupported' as const,
      blockers: ['换支援比较须保持共同成员的装备及来源一致。'],
    }
  const result = compareFixedEventSupportContribution32(a.input, b.input)
  return { ...result, referenceBuilds: { left: a.builds, right: b.builds } }
}
