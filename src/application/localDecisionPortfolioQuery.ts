import { coordinateDecisionPortfolio } from '../decision/accountDecisionCoordination'
import { projectSimultaneousTeamExecutionPortfolio } from '../decision/teamExecutionProjection'
import { authorityPortfolioCandidates } from '../decision/authorityPortfolioCandidates'
import { normalizeTargetTeamEquipmentParameters } from '../decision/targetTeamEquipmentParameters'
import type { BangbooStar } from '../teamEngine/contracts'
import {
  compilePortfolioBuildIntent,
  optimizerOptionsFromPortfolioBuildIntent,
} from '../decision/buildIntent'
import { solveCandidateWarehouse } from '../optimizer/candidateWarehouseSolver'
import {
  calculationQueryContractVersion,
  type AccountDecisionRun,
  type CalculationQueryClient,
} from './calculationQueryContract'

function explicitBangbooStar(stars: number): BangbooStar {
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) throw new Error('邦布星级必须在 1–5 星。')
  return stars as BangbooStar
}

export function createLocalDecisionPortfolioQuery({
  runs,
  requireCompiledRuntime,
  calculateTargetTeamWarehouseFit,
}: {
  runs: Map<string, AccountDecisionRun>
  requireCompiledRuntime: () => Promise<unknown>
  calculateTargetTeamWarehouseFit: CalculationQueryClient['calculateTargetTeamWarehouseFit']
}): CalculationQueryClient['queryDecisionPortfolio'] {
  return async (query) => {
    if (query.contractVersion !== calculationQueryContractVersion)
      throw new Error(`Unsupported Calculation/Query contract: ${query.contractVersion}.`)
    await requireCompiledRuntime()
    const run = runs.get(query.runId)
    if (!run) throw new Error(`Account Decision run is unavailable: ${query.runId}.`)
    const confirmedFits = await Promise.all(
      Object.entries(query.equipmentParametersByCandidateId ?? {}).map(
        async ([candidateId, equipmentParameters]) => {
          if (!query.lockedTemplateIds.includes(candidateId))
            throw new Error('只允许为已选择的队伍设置方案参数。')
          const fit = await calculateTargetTeamWarehouseFit({
            contractVersion: calculationQueryContractVersion,
            kind: 'target_team_warehouse_fit',
            runId: query.runId,
            candidateId,
            equipmentParameters,
          })
          if (!fit.effectiveEquipmentParameters)
            throw new Error('队伍参数尚未确认，请回到该队配装后继续。')
          return fit
        },
      ),
    )
    const portfolioRequest = compilePortfolioBuildIntent({
      teamCount: query.teamCount,
      lockedCandidateIds: query.lockedTemplateIds,
    })
    const portfolioProjection = authorityPortfolioCandidates({
      authority: run.snapshot.decisionAuthority,
      roster: run.input.warehouse.roster,
      engineMatches: run.snapshot.portfolioInput.candidates,
      engineCandidates: run.snapshot.teamEngine.recommendations,
      requestedCandidateIds: query.lockedTemplateIds,
      confirmedDirections: confirmedFits.map((fit) => ({
        candidateId: fit.candidateId,
        memberIds: [...fit.memberIds] as [string, string, string],
        bangbooId: fit.effectiveEquipmentParameters!.bangbooId,
        bangbooStar: explicitBangbooStar(fit.effectiveEquipmentParameters!.bangbooStars),
        scenarioTags: fit.buildIntent.exactTeam.scenarioTags,
        provenance: 'authority_exact',
      })),
    })
    const coordination = coordinateDecisionPortfolio(
      {
        portfolioInput: {
          ...run.snapshot.portfolioInput,
          candidates: portfolioProjection.candidates,
        },
      },
      portfolioRequest,
    )
    const resolvedAgentIds = coordination.teams.flatMap((team) =>
      team.template.members.map((member) => member.agentId),
    )
    const buildIntent = compilePortfolioBuildIntent({
      teamCount: query.teamCount,
      lockedCandidateIds: query.lockedTemplateIds,
      resolvedAgentIds:
        resolvedAgentIds.length === query.teamCount * 3 ? resolvedAgentIds : undefined,
      resolvedTeams:
        resolvedAgentIds.length === query.teamCount * 3
          ? coordination.teams.map(
              (team) =>
                team.template.members.map((member) => member.agentId) as [string, string, string],
            )
          : undefined,
      equipmentParametersByCandidateId: confirmedFits.length
        ? Object.fromEntries(
            confirmedFits.map((fit) => [
              fit.candidateId,
              normalizeTargetTeamEquipmentParameters(fit.effectiveEquipmentParameters!),
            ]),
          )
        : undefined,
      agentStateById: Object.fromEntries(
        run.input.warehouse.roster.agents.map((agent) => [
          agent.agentId,
          { potentialImage: agent.potentialImage },
        ]),
      ),
    })
    const warehousePlan =
      resolvedAgentIds.length === buildIntent.teamCount * 3
        ? solveCandidateWarehouse(
            run.input.warehouse.discs,
            resolvedAgentIds,
            'portfolio',
            optimizerOptionsFromPortfolioBuildIntent(buildIntent),
            buildIntent.recommendations,
          )
        : {
            scope: 'portfolio' as const,
            agentIds: resolvedAgentIds,
            loadouts: [],
            totalScore: 0,
            alternatives: [],
            gaps: coordination.gaps.map((gap) => gap.detail),
            boundary: '多队成员尚未闭合，因此没有启动跨队实体盘求解；账户与保存方案均未修改。',
          }
    return {
      buildIntent,
      warehousePlan,
      coordination,
      executionPortfolio: projectSimultaneousTeamExecutionPortfolio({
        candidates: portfolioProjection.executionCandidates,
        allocation: run.snapshot.allocation,
        roster: run.input.warehouse.roster,
        drafts: run.input.drafts,
        activePlanIds: run.input.activePlanIds,
        coordination,
        requestedTeamCount: query.teamCount,
        warehousePlan,
        equipmentParametersByCandidateId: Object.fromEntries(
          confirmedFits.map((fit) => [fit.candidateId, fit.effectiveEquipmentParameters!]),
        ),
      }),
    }
  }
}
