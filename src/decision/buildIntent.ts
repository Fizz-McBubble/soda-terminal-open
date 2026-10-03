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
  type ReviewedTeamAgentState,
} from '../gameDataPacks/reviewedTeamDiscConditions'

export const buildIntentContract = 'soda-build-intent/v1' as const

type BuildIntentConstraints = {
  priorityAgentIds: string[]
  fixedDiscByAgent: Record<string, string>
  excludedDiscIds: string[]
  allowLocked: boolean
  panelInputsByAgent?: AccountOptimizerOptions['panelInputsByAgent']
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
    /** Normalized condition input: missing potential uses the product default; explicit 0 is retained. */
    agentPotentialById: Record<string, number>
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
  agentPotentialById?: Record<string, number>
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
  /** Optional account state; omitted potential resolves through the existing planning default. */
  agentStateById?: Readonly<Record<string, ReviewedTeamAgentState>>
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
      agentPotentialById: reviewedTeamPotentialByAgentId({
        memberIds: agentIds,
        agentStateById: input.agentStateById,
      }),
    },
    recommendations: recommendations(agentIds, {
      memberIds: agentIds,
      agentStateById: input.agentStateById,
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
      agentPotentialById: reviewedTeamPotentialByAgentId({
        memberIds: agentIds,
        agentStateById: input.agentStateById,
      }),
    },
    recommendations: recommendations(agentIds, {
      memberIds: agentIds,
      agentStateById: input.agentStateById,
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
          recommendations(memberIds, { memberIds, agentStateById: input.agentStateById }),
        )
      : recommendations(agentIds),
    teamCount: input.teamCount,
    lockedCandidateIds: unique(input.lockedCandidateIds ?? []),
    ...(resolvedTeams ? { resolvedTeams, agentPotentialById } : {}),
    ...(input.equipmentParametersByCandidateId
      ? {
          equipmentParametersByCandidateId: structuredClone(input.equipmentParametersByCandidateId),
        }
      : {}),
  })
}

export function optimizerOptionsFromBuildIntent(
  intent: AgentIndependentBuildIntent | TeamJointBuildIntent,
): AccountOptimizerOptions {
  return {
    priorityAgentIds: [...intent.constraints.priorityAgentIds],
    fixedDiscByAgent: { ...intent.constraints.fixedDiscByAgent },
    excludedDiscIds: [...intent.constraints.excludedDiscIds],
    allowLocked: intent.constraints.allowLocked,
    ...(intent.constraints.panelInputsByAgent
      ? { panelInputsByAgent: structuredClone(intent.constraints.panelInputsByAgent) }
      : {}),
  }
}

export function optimizerOptionsFromPortfolioBuildIntent(
  intent: PortfolioJointBuildIntent,
): AccountOptimizerOptions {
  if (intent.agentIds.length !== intent.teamCount * 3)
    throw new Error(`多队 Build Intent 尚未闭合 ${intent.teamCount * 3} 名成员。`)
  return { priorityAgentIds: [...intent.agentIds], allowLocked: true }
}
