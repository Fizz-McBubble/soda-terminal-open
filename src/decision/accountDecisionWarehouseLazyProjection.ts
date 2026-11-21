import {
  analyzeAccountWarehouse,
  type WarehouseAnalysisSnapshot,
} from '../warehouse/discWarehouseAnalysis'
import { commonForbiddenClaims } from './accountDecisionClaimBoundaries'
import { warehouseDecisionDemand } from './warehouseDecisionDemand'
import { currentSavedTeamBuildIntents } from './savedTeamBuildIntent'
import { uniqueInOrder } from './accountDecisionCandidatePriority'
import {
  projectWarehouseActions,
  type WarehouseActionProjection,
} from '../application/warehouseActionProjection'
import type {
  AccountDecisionRun,
  AccountDecisionQueryInput,
} from '../application/calculationQueryContract'
import type { AccountDecisionSnapshot } from './accountDecisionSnapshotContract'

/**
 * Pure projection that computes the complete disc warehouse analysis on demand from
 * the preserved decision world facts (Team Engine, Authority, coordination and input drafts).
 * It preserves existing reference protections, functional constraints, and cleanup assessments.
 */
export function projectAccountDecisionWarehouseAnalysis({
  snapshot,
  input,
  capturedAt,
}: {
  snapshot: AccountDecisionSnapshot
  input: AccountDecisionQueryInput
  capturedAt?: string
}): WarehouseAnalysisSnapshot {
  const warehouse = input.warehouse
  if (!warehouse.accountId) {
    throw new Error('仓库分析只接受具名活动账户，不能回退到旧表。')
  }

  const preferredAgentIds = uniqueInOrder(input.developmentPriorityAgentIds)
  const currentPlanIdsByAgent = {
    ...input.activePlanIds,
    ...input.preference.planIdsByAgent,
  }
  const savedTeamBuildIntentsByDraftId = currentSavedTeamBuildIntents(
    input.drafts,
    {
      decisionAuthority: snapshot.decisionAuthority,
      teamEngine: snapshot.teamEngine,
      allocation: snapshot.allocation,
    },
    warehouse,
  )
  const candidates = snapshot.portfolioInput.candidates
  const coordination = snapshot.coordination

  return analyzeAccountWarehouse({
    accountId: warehouse.accountId,
    discs: warehouse.discs,
    roster: warehouse.roster,
    drafts: input.drafts,
    activePlanIds: currentPlanIdsByAgent,
    priorityAgentIds: preferredAgentIds,
    savedTeamBuildIntentsByDraftId,
    ...warehouseDecisionDemand(input.preference, coordination, candidates, input.drafts),
    dataVersion: snapshot.data.packageVersion,
    now: capturedAt,
  })
}

/**
 * Attaches the complete warehouse analysis result onto the current run snapshot on demand,
 * upgrading warehouse claims and explanation from deferred to complete.
 * Caches directly into the run so repeated queries within the same run are zero-cost.
 */
export function attachAccountDecisionWarehouse(run: AccountDecisionRun): WarehouseAnalysisSnapshot {
  if (run.snapshot.warehouse) {
    return run.snapshot.warehouse
  }

  const warehouseAnalysis = projectAccountDecisionWarehouseAnalysis({
    snapshot: run.snapshot,
    input: run.input,
    capturedAt: run.capturedAt,
  })

  run.snapshot.warehouse = warehouseAnalysis
  run.snapshot.claims.warehouse = {
    status: 'limited',
    summary: `已分析完整 ${warehouseAnalysis.decisions.length} 张仓库盘；清理结论仅为人工复核候选。`,
    allows: ['解释分类、方案引用、替代盘与强化潜力'],
    forbids: commonForbiddenClaims,
    blockers: [],
  }
  run.snapshot.explanation.warehouseCoverageComplete =
    warehouseAnalysis.decisions.length === run.input.warehouse.discs.length

  return warehouseAnalysis
}

/**
 * Ensures that the warehouse actions projection is built on demand and cached into current run.
 * Existing warehouse capabilities, reference protections, and cleanup safety rules are preserved.
 */
export function ensureAccountDecisionWarehouseActions(
  run: AccountDecisionRun,
): WarehouseActionProjection {
  if (run.warehouseActions) {
    return run.warehouseActions
  }

  attachAccountDecisionWarehouse(run)
  const warehouseActions = projectWarehouseActions({
    run,
    status: 'current',
  })
  run.warehouseActions = warehouseActions
  return warehouseActions
}
