import type { AccountPlanningDraft, PlanningSolutionContext } from './types'

export const planningSolutionContextContract = 'soda-solution-context/v1' as const
export const legacyActiveDevelopmentPlansKey = 'development.active-agent-plan-ids' as const

export function buildExactTeamVariantKey(input: {
  memberIds: readonly string[]
  bangbooId: string | null
  /** Preserved only for callers whose exact execution recorded a resolved star. */
  bangbooStar?: number
  scenario: string
}) {
  return [
    `agents:${[...input.memberIds].sort().join('|')}`,
    `bangboo:${input.bangbooId ?? 'unbound'}`,
    ...(input.bangbooStar === undefined ? [] : [`bangbooStar:${input.bangbooStar}`]),
    `scenario:${encodeURIComponent(input.scenario || 'general')}`,
  ].join('::')
}

/**
 * Order-independent identity for one simultaneous portfolio.  Each inner key
 * still retains its exact three members, Bangboo, and scenario.
 */
export function buildExactTeamPortfolioVariantKey(
  teams: readonly {
    memberIds: readonly string[]
    bangbooId: string | null
    bangbooStar?: number
    scenario: string
  }[],
) {
  return `portfolio:${teams
    .map(buildExactTeamVariantKey)
    .sort((left, right) => left.localeCompare(right))
    .join('||')}`
}

export function legacyPlanningSolutionContext(
  draft: Pick<
    AccountPlanningDraft,
    'id' | 'kind' | 'selection' | 'candidateWarehouse' | 'knowledgeRefs'
  >,
): PlanningSolutionContext {
  const scope = draft.kind === 'agent' ? 'agent_independent' : 'team_joint'
  return {
    contract: planningSolutionContextContract,
    scope,
    resourcePolicy: scope === 'agent_independent' ? 'advisory' : 'within_team_exclusive',
    sourceCandidateId: `legacy:${draft.id}`,
    inputFingerprint: 'legacy-unavailable',
    solverMethod: 'legacy-migration',
    gameVersion: draft.knowledgeRefs[0]?.version ?? 'unknown',
    knowledgeVersion:
      draft.knowledgeRefs
        .map((item) => item.version)
        .sort()
        .join('|') || 'unknown',
    exactVariantKey:
      scope === 'team_joint'
        ? buildExactTeamVariantKey({
            memberIds: draft.selection.agentIds,
            bangbooId: draft.selection.bangbooId,
            scenario: draft.selection.scenario,
          })
        : null,
  }
}
