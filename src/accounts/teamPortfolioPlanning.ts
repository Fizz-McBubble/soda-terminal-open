import { database, type SodaDatabase } from '../db/databaseCore'
import type { PortfolioJointBuildIntent } from '../decision/buildIntent'
import type { TeamExecutionPortfolio } from '../decision/teamExecutionProjection'
import type { AccountLoadout } from '../optimizer/optimizeAccountBuilds'
import {
  getAccountPlanningDraft,
  listAccountPlanningDrafts,
  saveAccountPlanningDraft,
  type PlanningDraftInput,
} from './planningDrafts'
import { getScopedId, type AccountPlanningDraft, type PlanningSolutionContext } from './types'
import {
  type TeamPortfolioPlanningValidation,
  unique,
  snapshotIdentity,
  validateTeamPortfolioPlanningDraft,
} from './teamPortfolioPlanningValidation'
export {
  type TeamPortfolioPlanningValidation,
  validateTeamPortfolioPlanningDraft,
} from './teamPortfolioPlanningValidation'

import type {
  PortfolioCandidateWarehouse,
  TeamPortfolioDiscChoicesSnapshot,
} from './teamPortfolioPlanningValidation'
export type { TeamPortfolioDiscChoicesSnapshot } from './teamPortfolioPlanningValidation'
export {
  readTeamPortfolioPlanningAllocation,
  type TeamPortfolioPlanningAllocation,
} from './publicTeamPortfolioPlanningAllocation'

type PortfolioSolutionIdentity = Pick<
  PlanningSolutionContext,
  'inputFingerprint' | 'solverMethod' | 'gameVersion' | 'knowledgeVersion'
> & {
  sourceCandidateId?: string
}

export type TeamPortfolioPlanningSaveInput = {
  /** Allocate before computing the self-excluding freshness fingerprint. */
  id: string
  name: string
  teamPortfolioSnapshot: TeamExecutionPortfolio
  /** Exact frozen candidate directions, conditions, and resolved potential used by this solve. */
  teamPortfolioBuildIntent: PortfolioJointBuildIntent
  /** Per-disc score evidence frozen from the simultaneous warehouse result. */
  teamPortfolioDiscChoices: TeamPortfolioDiscChoicesSnapshot
  candidateWarehouse: PortfolioCandidateWarehouse
  solution: PortfolioSolutionIdentity
  manualOverrides?: Partial<PlanningDraftInput['manualOverrides']>
  knowledgeRefs?: AccountPlanningDraft['knowledgeRefs']
}

export type TeamPortfolioPlanningRead = {
  draft: AccountPlanningDraft
  validation: TeamPortfolioPlanningValidation
}

function draftInput(input: TeamPortfolioPlanningSaveInput): PlanningDraftInput {
  const snapshot = structuredClone(input.teamPortfolioSnapshot)
  const agentIds = snapshot.executions.flatMap((execution) => execution.memberIds)
  const discIds = snapshot.executions.flatMap((execution) => execution.physicalDiscIds)
  const exactAllTeamKey = snapshotIdentity(snapshot)
  const solutionContext: PlanningSolutionContext = {
    contract: 'soda-solution-context/v1',
    scope: 'portfolio_joint',
    resourcePolicy: 'cross_team_exclusive',
    sourceCandidateId: input.solution.sourceCandidateId ?? `portfolio:${exactAllTeamKey}`,
    inputFingerprint: input.solution.inputFingerprint,
    solverMethod: input.solution.solverMethod,
    gameVersion: input.solution.gameVersion,
    knowledgeVersion: input.solution.knowledgeVersion,
    exactVariantKey: exactAllTeamKey,
  }
  return {
    id: input.id,
    kind: 'team',
    name: input.name,
    selection: {
      agentIds,
      bangbooId: null,
      scenario: `simultaneous-lock:${snapshot.requestedTeamCount}-team`,
    },
    manualOverrides: {
      wEngineDirection: input.manualOverrides?.wEngineDirection ?? '',
      discDirection: input.manualOverrides?.discDirection ?? '跨队互斥的实体盘候选投影。',
      progressionDirection: input.manualOverrides?.progressionDirection ?? '',
      notes: input.manualOverrides?.notes ?? '',
    },
    knowledgeRefs:
      input.knowledgeRefs ??
      unique(agentIds).map((agentId) => ({
        profileId: agentId,
        status: 'candidate' as const,
        version: input.solution.knowledgeVersion,
        source: 'portfolio execution snapshot',
      })),
    warehouseRefs: discIds,
    candidateWarehouse: structuredClone(input.candidateWarehouse),
    teamPortfolioSnapshot: snapshot,
    teamPortfolioBuildIntent: structuredClone(input.teamPortfolioBuildIntent),
    teamPortfolioDiscChoices: structuredClone(input.teamPortfolioDiscChoices),
    comparisonCapability: 'direction',
    solutionContext,
  }
}

/** Freezes only choice-level solver evidence; the actual disc records stay in the account warehouse. */
export function snapshotTeamPortfolioDiscChoices(
  loadouts: readonly AccountLoadout[],
): TeamPortfolioDiscChoicesSnapshot {
  return {
    contract: 'soda-team-portfolio-disc-choices/r1',
    loadouts: loadouts.map((loadout) => ({
      agentId: loadout.agentId,
      choices: loadout.discs.map((choice) => ({
        discId: choice.disc.id,
        score: choice.score,
        mainStatScore: choice.mainStatScore,
        subStatScore: choice.subStatScore,
        effectiveLines: choice.effectiveLines,
        effectiveRolls: choice.effectiveRolls,
        wastedUpgrades: choice.wastedUpgrades,
        reasons: [...choice.reasons],
      })),
    })),
  }
}

/**
 * Saves only a complete multi-team projection.  The underlying draft save owns
 * the active-account transaction; this helper never writes roster or discs.
 */
export async function saveTeamPortfolioPlanningDraft(
  accountId: string,
  input: TeamPortfolioPlanningSaveInput,
  db: SodaDatabase = database,
) {
  if (!input.teamPortfolioBuildIntent)
    throw new Error('多队方案缺少已消费的 portfolio Build Intent。')
  const next = draftInput(input)
  const validation = validateTeamPortfolioPlanningDraft(next)
  if (!validation.valid) throw new Error(`多队方案不可保存：${validation.errors.join('；')}`)
  return saveAccountPlanningDraft(accountId, next, db, async (transactionDb) => {
    const ownedDiscIds = new Set(
      (await transactionDb.accountDriveDiscs.where('accountId').equals(accountId).toArray()).map(
        (disc) => disc.id,
      ),
    )
    const missing = next.warehouseRefs.filter((discId) => !ownedDiscIds.has(discId))
    if (missing.length)
      throw new Error(`多队方案引用了当前账户不存在的实体盘：${missing.slice(0, 3).join('、')}`)
    if (input.id) {
      const existing = await transactionDb.accountPlanningDrafts.get(
        getScopedId(accountId, input.id),
      )
      if (existing && !existing.teamPortfolioSnapshot)
        throw new Error('不能用多队方案覆盖既有单队草稿。')
    }
  })
}

export async function getTeamPortfolioPlanningDraft(
  accountId: string,
  id: string,
  db: SodaDatabase = database,
): Promise<TeamPortfolioPlanningRead | null> {
  const draft = await getAccountPlanningDraft(accountId, id, db)
  if (!draft?.teamPortfolioSnapshot) return null
  return { draft, validation: validateTeamPortfolioPlanningDraft(draft) }
}

export async function listTeamPortfolioPlanningDrafts(
  accountId: string,
  db: SodaDatabase = database,
): Promise<TeamPortfolioPlanningRead[]> {
  const drafts = await listAccountPlanningDrafts(accountId, db)
  return drafts
    .filter((draft) => Boolean(draft.teamPortfolioSnapshot))
    .map((draft) => ({ draft, validation: validateTeamPortfolioPlanningDraft(draft) }))
}
