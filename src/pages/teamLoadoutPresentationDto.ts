import type { TeamLoadoutOverviewModel } from './teamLoadoutOverviewTypes'
import type { TeamExecutionPresentation } from './teamExecutionPresentation'

export const teamLoadoutPresentationContract = 'soda-team-loadout-presentation/v1' as const

export type TeamPresentationIdentity = {
  runId: string
  accountId: string
  inputFingerprint: string
}

export type TeamOverviewPresentationDto = TeamPresentationIdentity & {
  contract: typeof teamLoadoutPresentationContract
  context: {
    agentId: string | null
    planId: string | null
    discId: string | null
  }
  overviewModel: TeamLoadoutOverviewModel
}

export type TeamExecutionPresentationDto = TeamPresentationIdentity & {
  contract: typeof teamLoadoutPresentationContract
  candidateId: string
  memberIds: [string, string, string]
  view: TeamExecutionPresentation
  attributePanelsByAgent?: Record<
    string,
    import('./teamExecutionAttributePanel').TeamExecutionAttributePanel
  >
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function matchesIdentity(value: Record<string, unknown>, expected: TeamPresentationIdentity) {
  return (
    value.contract === teamLoadoutPresentationContract &&
    value.runId === expected.runId &&
    value.accountId === expected.accountId &&
    value.inputFingerprint === expected.inputFingerprint
  )
}

function matchesTeamMemberIdentities(
  memberIds: readonly unknown[],
  members: readonly unknown[],
  expectedMemberIds: readonly string[],
) {
  if (
    memberIds.length !== 3 ||
    expectedMemberIds.length !== 3 ||
    new Set(memberIds).size !== 3 ||
    new Set(expectedMemberIds).size !== 3 ||
    memberIds.some((id, index) => id !== expectedMemberIds[index])
  )
    return false
  const presentedMemberIds = members.flatMap((member) =>
    record(member) && typeof member.agentId === 'string' ? [member.agentId] : [],
  )
  return (
    presentedMemberIds.length === 3 &&
    new Set(presentedMemberIds).size === 3 &&
    presentedMemberIds.every((id) => memberIds.includes(id))
  )
}

/** Older or foreign results have no trusted presentation. Recompute through a current Query. */
export function acceptTeamOverviewPresentation(
  value: unknown,
  expected: TeamPresentationIdentity & TeamOverviewPresentationDto['context'],
): TeamOverviewPresentationDto | null {
  if (!record(value) || !matchesIdentity(value, expected)) return null
  const context = value.context
  const model = value.overviewModel
  if (
    !record(context) ||
    context.agentId !== expected.agentId ||
    context.planId !== expected.planId ||
    context.discId !== expected.discId ||
    !record(model) ||
    !record(model.answer) ||
    !record(model.coverage) ||
    !Array.isArray(model.groups) ||
    !model.groups.every(
      (group) =>
        record(group) &&
        Array.isArray(group.items) &&
        group.items.every((family: unknown) => record(family) && Array.isArray(family.variants)),
    )
  )
    return null
  return value as TeamOverviewPresentationDto
}

export function acceptTeamExecutionPresentation(
  value: unknown,
  expected: TeamPresentationIdentity & { candidateId: string; memberIds: readonly string[] },
): TeamExecutionPresentationDto | null {
  if (!record(value) || !matchesIdentity(value, expected)) return null
  if (
    value.candidateId !== expected.candidateId ||
    !Array.isArray(value.memberIds) ||
    value.memberIds.length !== 3 ||
    value.memberIds.some((id: unknown, index: number) => id !== expected.memberIds[index]) ||
    !record(value.view) ||
    !Array.isArray(value.view.members) ||
    value.view.members.length !== 3 ||
    !matchesTeamMemberIdentities(value.memberIds, value.view.members, expected.memberIds) ||
    !value.view.members.every(
      (member: unknown) =>
        record(member) && Array.isArray(member.discIds) && Array.isArray(member.discFacts),
    )
  )
    return null
  return value as TeamExecutionPresentationDto
}
