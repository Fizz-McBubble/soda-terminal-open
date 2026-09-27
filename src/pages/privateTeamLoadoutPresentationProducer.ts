import type {
  AccountDecisionRun,
  TargetTeamWarehouseFitQueryResult,
} from '../application/calculationQueryContract'
import {
  teamLoadoutPresentationContract,
  type TeamExecutionPresentationDto,
  type TeamOverviewPresentationDto,
} from './teamLoadoutPresentationDto'
import {
  buildTeamLoadoutOverviewModel,
  projectTargetTeamFitsIntoOverviewModel,
} from './teamLoadoutOverviewModel'
import { presentTeamExecution } from './teamExecutionPresentation'
import { createTeamExecutionAttributePanel } from './teamExecutionAttributePanel'

/** Private Query producer. The browser consumes only its serialized result. */
export function projectPrivateTeamOverview(
  run: AccountDecisionRun,
  context: TeamOverviewPresentationDto['context'] = {
    agentId: null,
    planId: null,
    discId: null,
  },
  source?: Pick<AccountDecisionRun, 'runId' | 'input'>,
  fits: readonly TargetTeamWarehouseFitQueryResult[] = [],
): TeamOverviewPresentationDto {
  const warehouse = source?.input.warehouse ?? run.input.warehouse
  if (source && source.input.warehouse.accountId !== run.input.warehouse.accountId)
    throw new Error('Remaining BOX source account does not match the detached run.')
  if (!warehouse.accountId) throw new Error('Team presentation requires an account.')
  return {
    contract: teamLoadoutPresentationContract,
    runId: run.runId,
    accountId: warehouse.accountId,
    inputFingerprint: run.snapshot.fingerprint.inputHash,
    context,
    overviewModel: projectTargetTeamFitsIntoOverviewModel(
      buildTeamLoadoutOverviewModel({
        decision: run.snapshot,
        savedPlans: source?.input.drafts ?? run.input.drafts,
        warehouse,
        availableDiscIds: warehouse.discs.map((disc) => disc.id),
        ownedAgentIds: warehouse.roster.agents
          .filter((agent) => agent.owned)
          .map((agent) => agent.agentId),
        availableAgentIds: source
          ? run.input.warehouse.roster.agents
              .filter((agent) => agent.owned)
              .map((agent) => agent.agentId)
          : undefined,
        contextAgentId: context.agentId,
        contextPlanId: context.planId,
        contextDiscId: context.discId,
      }),
      Object.fromEntries(fits.map((fit, index) => [String(index), fit])),
    ),
  }
}

/** The exact target fit and captured warehouse are required for the 18-disc view. */
export function projectPrivateTeamExecution(
  run: AccountDecisionRun,
  fit: TargetTeamWarehouseFitQueryResult,
): TeamExecutionPresentationDto {
  const warehouse = run.input.warehouse
  if (!warehouse.accountId) throw new Error('Team presentation requires an account.')
  if (
    fit.memberIds.length !== 3 ||
    new Set(fit.memberIds).size !== 3 ||
    fit.targetExecution.memberIds.length !== 3 ||
    fit.targetExecution.memberIds.some((id) => !fit.memberIds.includes(id))
  )
    throw new Error('Target fit member identity does not match its execution.')
  const attributePanelsByAgent = Object.fromEntries(
    fit.targetExecution.members.flatMap((member) => {
      const agent = warehouse.roster.agents.find((item) => item.agentId === member.agentId)
      return agent
        ? [
            [
              member.agentId,
              createTeamExecutionAttributePanel({
                agent,
                member,
                discs: warehouse.discs,
                wEngines: warehouse.roster.wEngines,
                memberIds: fit.targetExecution.memberIds,
              }),
            ] as const,
          ]
        : []
    }),
  )
  const view = presentTeamExecution(fit.targetExecution, warehouse, fit.warehousePlan.loadouts)
  // Fail closed: a fit that solved 18 unique discs must never be transported as a presentation with
  // empty or partial members. Without this guard the browser would silently render three empty
  // six-disc lists from a "ready" DTO.
  if (fit.status === 'ready' && fit.uniqueDiscCount === 18) {
    const members = view.members.filter((member) => fit.memberIds.includes(member.agentId))
    const discIds = members.flatMap((member) => member.discIds)
    const discFacts = members.flatMap((member) => member.discFacts)
    if (
      members.length !== 3 ||
      members.some((member) => member.discIds.length !== 6 || member.discFacts.length !== 6) ||
      discIds.length !== 18 ||
      new Set(discIds).size !== 18 ||
      discFacts.length !== 18
    )
      throw new Error(
        '目标队伍已求解 18 张唯一驱动盘，但展示投影丢失了盘面；已停止返回不一致的结果。',
      )
  }
  return {
    contract: teamLoadoutPresentationContract,
    runId: run.runId,
    accountId: warehouse.accountId,
    inputFingerprint: run.snapshot.fingerprint.inputHash,
    candidateId: fit.candidateId,
    memberIds: [...fit.memberIds] as [string, string, string],
    view,
    attributePanelsByAgent,
  }
}
