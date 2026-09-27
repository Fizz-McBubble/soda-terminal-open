import { getAccountPreference, saveAccountPreference } from './accountPreferenceRepository'
import type { SodaDatabase } from '../db/databaseCore'

const preferenceKey = 'optimizer.team-portfolio-v1'

export type TeamPortfolioPreference = {
  /** Number of saved/locked teams. Runtime feasibility is bounded by the available candidates. */
  teamCount: number
  templateIds: string[]
  favoriteAgentIds: string[]
  fixedAgentIds: string[]
  fixedBangbooIds: string[]
  planIdsByAgent: Record<string, string>
}

export const defaultTeamPortfolioPreference: TeamPortfolioPreference = {
  teamCount: 1,
  templateIds: [],
  favoriteAgentIds: [],
  fixedAgentIds: [],
  fixedBangbooIds: [],
  planIdsByAgent: {},
}

function stringList(value: unknown) {
  return Array.isArray(value)
    ? [...new Set(value.filter((item): item is string => typeof item === 'string'))]
    : []
}

export function normalizeTeamPortfolioPreference(value: unknown): TeamPortfolioPreference {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return { ...defaultTeamPortfolioPreference }
  const candidate = value as Partial<TeamPortfolioPreference>
  const planIdsByAgent = Object.fromEntries(
    Object.entries(candidate.planIdsByAgent ?? {}).filter(
      (entry): entry is [string, string] =>
        typeof entry[0] === 'string' && typeof entry[1] === 'string',
    ),
  )
  return {
    teamCount:
      typeof candidate.teamCount === 'number' &&
      Number.isSafeInteger(candidate.teamCount) &&
      candidate.teamCount > 0
        ? candidate.teamCount
        : 1,
    templateIds: stringList(candidate.templateIds),
    favoriteAgentIds: stringList(candidate.favoriteAgentIds),
    fixedAgentIds: stringList(candidate.fixedAgentIds),
    fixedBangbooIds: stringList(candidate.fixedBangbooIds),
    planIdsByAgent,
  }
}

export async function getTeamPortfolioPreference(accountId: string, db?: SodaDatabase) {
  return normalizeTeamPortfolioPreference(await getAccountPreference(accountId, preferenceKey, db))
}

/** Persists planning intent only; active plans, planning drafts, and account assets stay untouched. */
export async function saveTeamPortfolioPreference(
  accountId: string,
  preference: TeamPortfolioPreference,
  db?: SodaDatabase,
) {
  const normalized = normalizeTeamPortfolioPreference(preference)
  await saveAccountPreference(accountId, preferenceKey, normalized, db)
  return normalized
}

export type ActiveTeamHardConstraint =
  | { kind: 'fixed_team'; value: string }
  | { kind: 'fixed_agent'; value: string }
  | { kind: 'fixed_bangboo'; value: string }
  | { kind: 'fixed_plan'; value: string; agentId: string }

export function enumerateActiveTeamHardConstraints(
  preference: TeamPortfolioPreference,
): ActiveTeamHardConstraint[] {
  return [
    ...preference.templateIds.map((value) => ({ kind: 'fixed_team' as const, value })),
    ...preference.fixedAgentIds.map((value) => ({ kind: 'fixed_agent' as const, value })),
    ...preference.fixedBangbooIds.map((value) => ({ kind: 'fixed_bangboo' as const, value })),
    ...Object.entries(preference.planIdsByAgent).map(([agentId, value]) => ({
      kind: 'fixed_plan' as const,
      value,
      agentId,
    })),
  ]
}

/** Clears only team-solving hard inputs. Legacy favorites, planning drafts and assets stay intact. */
export function resetTeamRecommendationConstraints(
  preference: TeamPortfolioPreference,
): TeamPortfolioPreference {
  return {
    ...normalizeTeamPortfolioPreference(preference),
    teamCount: 1,
    templateIds: [],
    fixedAgentIds: [],
    fixedBangbooIds: [],
    planIdsByAgent: {},
  }
}

export async function restoreDefaultTeamRecommendation(
  accountId: string,
  preference: TeamPortfolioPreference,
  db?: SodaDatabase,
) {
  return saveTeamPortfolioPreference(accountId, resetTeamRecommendationConstraints(preference), db)
}
