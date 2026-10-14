import { createTeamStrengthEquippedReferenceMember } from './teamStrengthReferenceBuild'
import type { TeamStrengthReferenceConditions } from './teamStrengthReferenceConditionsTypes'
import {
  compareFixedEventSupportContribution32,
  projectFixedEventSupportContribution32,
  type FixedEventSupportInput32,
} from '../calculation/fixedEventSupportContribution32'
import { stableContentHash } from '../gameDataPacks/types'

export type DeclaredTeamStrengthSupportInput = Omit<FixedEventSupportInput32, 'members'> & {
  referenceConditions?: TeamStrengthReferenceConditions
}

export function bindDeclaredTeamStrengthSupportInput(input: DeclaredTeamStrengthSupportInput) {
  const builds = input.memberIds.map((agentId) =>
    createTeamStrengthEquippedReferenceMember({
      agentId,
      memberIds: input.memberIds,
      referenceConditions: input.referenceConditions,
    }),
  )
  const unsupported = builds.filter((row) => row.status === 'unsupported')
  if (unsupported.length)
    return { status: 'unsupported' as const, blockers: unsupported.map((row) => row.reason) }
  const ready = builds.filter((row) => row.status === 'ready')
  return {
    status: 'ready' as const,
    input: { ...input, members: ready.map((row) => row.runtimeMember) },
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
