import type { AccountOptimizerOptions } from '../optimizer/optimizeAccountBuilds'
import { candidatePanelObjectiveVersion } from '../optimizer/optimizeBuild'
import { computeBuildIntentFingerprint } from '../application/publicBuildIntentFingerprint'
import {
  reviewedAuthorComparisonMembership32,
  type AuthorComparisonMembership32,
} from './reviewedAuthorComparisonMembership32'
export {
  computeBuildIntentFingerprint,
  buildIntentFingerprintMatches,
} from '../application/publicBuildIntentFingerprint'
import type { TargetTeamEquipmentParameterSelection } from './targetTeamAccountBoundBenchmark'
import {
  getCandidateWarehouseConstraint,
  getCandidateWarehouseConstraintForTeam,
  type CandidateWarehouseRecommendation,
} from '../gameDataPacks/candidateWarehouseConstraints'
import {
  reviewedTeamPotentialByAgentId,
  reviewedTeamMindscapeByAgentId,
  type ReviewedTeamAgentState,
} from '../gameDataPacks/reviewedTeamDiscConditions'

export const buildIntentContract = 'soda-build-intent/v1' as const

type BuildIntentConstraints = {
  priorityAgentIds: string[]
  fixedDiscByAgent: Record<string, string>
  excludedDiscIds: string[]
  allowLocked: boolean
  panelInputsByAgent?: AccountOptimizerOptions['panelInputsByAgent']
  effectiveCritObjectivesByAgent?: AccountOptimizerOptions['effectiveCritObjectivesByAgent']
  panelObjectiveVersion?: typeof candidatePanelObjectiveVersion
}

export type BuildIntentRecommendation = CandidateWarehouseRecommendation

export type AgentIndependentBuildIntent = {
  contract: typeof buildIntentContract
  scope: 'agent_independent'
  resourcePolicy: 'advisory'
  agentIds: [string]
  recommendations: BuildIntentRecommendation[]
  constraints: BuildIntentConstraints
  fingerprint: string
}

export type TeamJointBuildIntent = {
  contract: typeof buildIntentContract
  scope: 'team_joint'
  resourcePolicy: 'within_team_exclusive'
  agentIds: [string, string, string]
  exactTeam: {
    candidateId: string
    bangbooId: string | null
    authorComparisonMembership?: AuthorComparisonMembership32
    scenarioTags: string[]
    /** Observed or explicitly selected potential; unknown never unlocks a source prerequisite. */
    agentPotentialById: Record<string, number | null>
    /** Optional only for historical snapshots; new intents always preserve unknown as null. */
    agentMindscapeById?: Record<string, number | null>
    selectedDirectionIdByAgentId?: Record<string, string>
  }
  recommendations: BuildIntentRecommendation[]
  constraints: BuildIntentConstraints
  fingerprint: string
}

export type PortfolioJointBuildIntent = {
  contract: typeof buildIntentContract
  scope: 'portfolio_joint'
  resourcePolicy: 'cross_team_exclusive'
  agentIds: string[]
  recommendations: BuildIntentRecommendation[]
  teamCount: number
  lockedCandidateIds: string[]
  equipmentParametersByCandidateId?: Record<string, TargetTeamEquipmentParameterSelection>
  /** Present only when every resolved agent has an exact team boundary. */
  resolvedTeams?: [string, string, string][]
  /** Condition inputs retained with exact teams so the solve fingerprint cannot hide a potential change. */
  agentPotentialById?: Record<string, number | null>
  agentMindscapeById?: Record<string, number | null>
  selectedDirectionIdByAgentId?: Record<string, string>
  fingerprint: string
}

export type BuildIntent =
  | AgentIndependentBuildIntent
  | TeamJointBuildIntent
  | PortfolioJointBuildIntent

function unique(values: readonly string[]) {
  return [...new Set(values.filter(Boolean))]
}

type TeamConditionInput = {
  memberIds: readonly string[]
  agentStateById?: Readonly<Record<string, ReviewedTeamAgentState>>
  selectedDirectionIdByAgentId?: Readonly<Record<string, string>>
}

function normalizedSelectedDirections(
  memberIds: readonly string[],
  selected?: Readonly<Record<string, string>>,
) {
  return Object.fromEntries(
    [...new Set(memberIds)].sort().flatMap((id) => (selected?.[id] ? [[id, selected[id]!]] : [])),
  )
}

function recommendations(
  agentIds: readonly string[],
  teamCondition?: TeamConditionInput,
): BuildIntentRecommendation[] {
  return agentIds.map((agentId) => {
    const constraint = teamCondition
      ? getCandidateWarehouseConstraintForTeam(agentId, teamCondition)
      : getCandidateWarehouseConstraint(agentId)
    return { agentId, constraint: constraint ? structuredClone(constraint) : null }
  })
}

function constraints(
  options: AccountOptimizerOptions,
  defaultPriorityAgentIds: readonly string[],
): BuildIntentConstraints {
  return {
    priorityAgentIds: unique(options.priorityAgentIds ?? defaultPriorityAgentIds),
    fixedDiscByAgent: Object.fromEntries(Object.entries(options.fixedDiscByAgent ?? {}).sort()),
    excludedDiscIds: unique(options.excludedDiscIds ?? []).sort(),
    allowLocked: options.allowLocked ?? true,
    ...(options.panelInputsByAgent
      ? {
          panelInputsByAgent: structuredClone(options.panelInputsByAgent),
          panelObjectiveVersion: candidatePanelObjectiveVersion,
        }
      : {}),
    ...(options.effectiveCritObjectivesByAgent
      ? { effectiveCritObjectivesByAgent: structuredClone(options.effectiveCritObjectivesByAgent) }
      : {}),
  }
}

function withFingerprint<T extends Omit<BuildIntent, 'fingerprint'>>(
  intent: T,
): T & {
  fingerprint: string
} {
  return {
    ...intent,
    fingerprint: computeBuildIntentFingerprint(intent),
  }
}

export function compileAgentBuildIntent(input: {
  agentId: string
  developmentPriorityAgentIds?: readonly string[]
  optimizerOptions?: AccountOptimizerOptions
}): AgentIndependentBuildIntent {
  if (!input.agentId) throw new Error('单人 Build Intent 缺少代理人身份。')
  return withFingerprint({
    contract: buildIntentContract,
    scope: 'agent_independent',
    resourcePolicy: 'advisory',
    agentIds: [input.agentId],
    recommendations: recommendations([input.agentId]),
    constraints: constraints(input.optimizerOptions ?? {}, input.developmentPriorityAgentIds ?? []),
  })
}

export function compileTeamBuildIntent(input: {
  candidateId: string
  memberIds: readonly [string, string, string]
  bangbooId: string
  scenarioTags?: readonly string[]
  /** Optional account state; omitted potential remains unknown for source matching. */
  agentStateById?: Readonly<Record<string, ReviewedTeamAgentState>>
  selectedDirectionIdByAgentId?: Readonly<Record<string, string>>
  optimizerOptions?: AccountOptimizerOptions
}): TeamJointBuildIntent {
  if (!input.candidateId || !input.bangbooId)
    throw new Error('队伍 Build Intent 缺少精确候选或邦布身份。')
  if (new Set(input.memberIds).size !== 3)
    throw new Error('队伍 Build Intent 必须包含三名不同代理人。')
  const agentIds: [string, string, string] = [
    input.memberIds[0],
    input.memberIds[1],
    input.memberIds[2],
  ]
  return withFingerprint({
    contract: buildIntentContract,
    scope: 'team_joint',
    resourcePolicy: 'within_team_exclusive',
    agentIds,
    exactTeam: {
      candidateId: input.candidateId,
      bangbooId: input.bangbooId,
      scenarioTags: unique(input.scenarioTags ?? []).sort(),
      agentMindscapeById: reviewedTeamMindscapeByAgentId({
        memberIds: agentIds,
        agentStateById: input.agentStateById,
      }),
      selectedDirectionIdByAgentId: normalizedSelectedDirections(
        agentIds,
        input.selectedDirectionIdByAgentId,
      ),
      agentPotentialById: reviewedTeamPotentialByAgentId({
        memberIds: agentIds,
        agentStateById: input.agentStateById,
      }),
    },
    recommendations: recommendations(agentIds, {
      memberIds: agentIds,
      agentStateById: input.agentStateById,
      selectedDirectionIdByAgentId: input.selectedDirectionIdByAgentId,
    }),
    constraints: constraints(input.optimizerOptions ?? {}, agentIds),
  })
}

/** A source-qualified explicit disc fit has no invented Bangboo or combat context. */
export function compileAuthorComparisonTeamBuildIntent(input: {
  candidateId: string
  memberIds: readonly [string, string, string]
  ownedAgentIds: readonly string[]
  agentStateById?: Readonly<Record<string, ReviewedTeamAgentState>>
  selectedDirectionIdByAgentId?: Readonly<Record<string, string>>
  optimizerOptions?: AccountOptimizerOptions
}): TeamJointBuildIntent {
  const membership = reviewedAuthorComparisonMembership32(input.memberIds, input.ownedAgentIds)
  if (!input.candidateId || !membership)
    throw new Error('作者比较队伍的来源、成员或拥有资格已失效。')
  const agentIds: [string, string, string] = [...input.memberIds]
  return withFingerprint({
    contract: buildIntentContract,
    scope: 'team_joint',
    resourcePolicy: 'within_team_exclusive',
    agentIds,
    exactTeam: {
      candidateId: input.candidateId,
      bangbooId: null,
      scenarioTags: [],
      authorComparisonMembership: membership,
      agentMindscapeById: reviewedTeamMindscapeByAgentId({
        memberIds: agentIds,
        agentStateById: input.agentStateById,
      }),
      selectedDirectionIdByAgentId: normalizedSelectedDirections(
        agentIds,
        input.selectedDirectionIdByAgentId,
      ),
      agentPotentialById: reviewedTeamPotentialByAgentId({
        memberIds: agentIds,
        agentStateById: input.agentStateById,
      }),
    },
    recommendations: recommendations(agentIds, {
      memberIds: agentIds,
      agentStateById: input.agentStateById,
      selectedDirectionIdByAgentId: input.selectedDirectionIdByAgentId,
    }),
    constraints: constraints(input.optimizerOptions ?? {}, agentIds),
  })
}

export function compilePortfolioBuildIntent(input: {
  teamCount: number
  lockedCandidateIds?: readonly string[]
  resolvedAgentIds?: readonly string[]
  /** Required for source-conditioned team directions; without it the portfolio remains a safe baseline. */
  resolvedTeams?: readonly (readonly [string, string, string])[]
  equipmentParametersByCandidateId?: Record<string, TargetTeamEquipmentParameterSelection>
  agentStateById?: Readonly<Record<string, ReviewedTeamAgentState>>
  selectedDirectionIdByAgentId?: Readonly<Record<string, string>>
}): PortfolioJointBuildIntent {
  if (!Number.isSafeInteger(input.teamCount) || input.teamCount < 1 || input.teamCount > 3)
    throw new Error('多队 Build Intent 仅支持 1 至 3 队。')
  const resolvedTeams = input.resolvedTeams?.map((members): [string, string, string] => [
    members[0],
    members[1],
    members[2],
  ])
  if (resolvedTeams && resolvedTeams.length !== input.teamCount)
    throw new Error(`多队 Build Intent 必须提供 ${input.teamCount} 组精确三人队伍。`)
  if (resolvedTeams?.some((members) => new Set(members).size !== 3))
    throw new Error('多队 Build Intent 的每组队伍必须包含三名不同代理人。')
  const flattenedTeamIds = resolvedTeams?.flat() ?? []
  if (
    resolvedTeams &&
    input.resolvedAgentIds &&
    (input.resolvedAgentIds.length !== flattenedTeamIds.length ||
      input.resolvedAgentIds.some((agentId, index) => agentId !== flattenedTeamIds[index]))
  )
    throw new Error('多队 Build Intent 的 resolvedTeams 必须与 resolvedAgentIds 保持同序一致。')
  const agentIds = unique(resolvedTeams ? flattenedTeamIds : (input.resolvedAgentIds ?? []))
  if (agentIds.length && agentIds.length !== input.teamCount * 3)
    throw new Error(`多队 Build Intent 尚未闭合 ${input.teamCount * 3} 名成员。`)
  const agentPotentialById = resolvedTeams
    ? reviewedTeamPotentialByAgentId({
        memberIds: flattenedTeamIds,
        agentStateById: input.agentStateById,
      })
    : undefined
  return withFingerprint({
    contract: buildIntentContract,
    scope: 'portfolio_joint',
    resourcePolicy: 'cross_team_exclusive',
    agentIds,
    recommendations: resolvedTeams
      ? resolvedTeams.flatMap((memberIds) =>
          recommendations(memberIds, {
            memberIds,
            agentStateById: input.agentStateById,
            selectedDirectionIdByAgentId: input.selectedDirectionIdByAgentId,
          }),
        )
      : recommendations(agentIds),
    teamCount: input.teamCount,
    lockedCandidateIds: unique(input.lockedCandidateIds ?? []),
    ...(resolvedTeams
      ? {
          resolvedTeams,
          agentPotentialById,
          agentMindscapeById: reviewedTeamMindscapeByAgentId({
            memberIds: flattenedTeamIds,
            agentStateById: input.agentStateById,
          }),
          selectedDirectionIdByAgentId: normalizedSelectedDirections(
            flattenedTeamIds,
            input.selectedDirectionIdByAgentId,
          ),
        }
      : {}),
    ...(input.equipmentParametersByCandidateId
      ? {
          equipmentParametersByCandidateId: structuredClone(input.equipmentParametersByCandidateId),
        }
      : {}),
  })
}

/** Integrity of a frozen snapshot is separate from current guidance eligibility. */
export function currentBuildIntentRecommendationState(intent: BuildIntent) {
  const staleAgentIds: string[] = []
  const currentFor = (agentId: string) => {
    if (intent.scope === 'agent_independent') return getCandidateWarehouseConstraint(agentId)
    const memberIds =
      intent.scope === 'team_joint'
        ? intent.agentIds
        : intent.resolvedTeams?.find((members) => members.includes(agentId))
    if (!memberIds) return getCandidateWarehouseConstraint(agentId)
    const potentials =
      intent.scope === 'team_joint'
        ? intent.exactTeam.agentPotentialById
        : intent.agentPotentialById
    const mindscapes =
      intent.scope === 'team_joint'
        ? intent.exactTeam.agentMindscapeById
        : intent.agentMindscapeById
    const selectedDirections =
      intent.scope === 'team_joint'
        ? intent.exactTeam.selectedDirectionIdByAgentId
        : intent.selectedDirectionIdByAgentId
    return getCandidateWarehouseConstraintForTeam(agentId, {
      memberIds,
      selectedDirectionIdByAgentId: selectedDirections,
      agentStateById: Object.fromEntries(
        memberIds.map((id) => [
          id,
          { potentialImage: potentials?.[id], mindscape: mindscapes?.[id] },
        ]),
      ),
    })
  }
  for (const recommendation of intent.recommendations) {
    const current = currentFor(recommendation.agentId)
    if ((current?.contentHash ?? null) !== (recommendation.constraint?.contentHash ?? null))
      staleAgentIds.push(recommendation.agentId)
  }
  return {
    status: staleAgentIds.length ? ('stale' as const) : ('current' as const),
    staleAgentIds,
  }
}

function assertCurrentBuildIntentRecommendations(intent: BuildIntent) {
  const state = currentBuildIntentRecommendationState(intent)
  if (state.status === 'stale')
    throw new Error(`构筑指导或分支已更新，请重新生成方案：${state.staleAgentIds.join('、')}`)
}

export function optimizerOptionsFromBuildIntent(
  intent: AgentIndependentBuildIntent | TeamJointBuildIntent,
): AccountOptimizerOptions {
  assertCurrentBuildIntentRecommendations(intent)
  return {
    priorityAgentIds: [...intent.constraints.priorityAgentIds],
    fixedDiscByAgent: { ...intent.constraints.fixedDiscByAgent },
    excludedDiscIds: [...intent.constraints.excludedDiscIds],
    allowLocked: intent.constraints.allowLocked,
    ...(intent.constraints.panelInputsByAgent
      ? { panelInputsByAgent: structuredClone(intent.constraints.panelInputsByAgent) }
      : {}),
    ...(intent.constraints.effectiveCritObjectivesByAgent
      ? {
          effectiveCritObjectivesByAgent: structuredClone(
            intent.constraints.effectiveCritObjectivesByAgent,
          ),
        }
      : {}),
  }
}

export function optimizerOptionsFromPortfolioBuildIntent(
  intent: PortfolioJointBuildIntent,
): AccountOptimizerOptions {
  assertCurrentBuildIntentRecommendations(intent)
  if (intent.agentIds.length !== intent.teamCount * 3)
    throw new Error(`多队 Build Intent 尚未闭合 ${intent.teamCount * 3} 名成员。`)
  return { priorityAgentIds: [...intent.agentIds], allowLocked: true }
}
