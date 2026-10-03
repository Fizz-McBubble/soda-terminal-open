import { authorComparisonAccountBinding } from './publicAuthorComparisonAccountBinding'
import { projectTargetTeamExecution } from '../decision/teamExecutionProjection'
import { isAdoptedPortfolioTeam } from '../decision/authorityPortfolioCandidates'
import { calculateTargetTeamWarehouseFit } from '../decision/targetTeamWarehouseFit'
import { createTargetTeamAssignmentObjective } from '../decision/targetTeamAssignmentObjective'
import { projectTargetTeamAccountBoundBenchmark } from '../decision/targetTeamAccountBoundBenchmark'
import {
  confirmedTargetTeamEquipmentParameters,
  defaultTargetTeamEquipmentParameters,
  selectPlayerConfirmableTargetBangbooSelection,
  selectSupportedTargetBangbooSelection,
  sourceSupportedTargetBangbooSelection,
  withReviewedSourceBangbooAlternatives,
  resolveTargetTeamBangbooOption,
  recommendedTargetBangbooDefault,
} from '../decision/targetTeamEquipmentParameters'
import { projectTargetTeamValueBenchmark } from '../decision/targetTeamValueBenchmark'
import { refineCultivationPriorityWithTargetFit } from '../decision/accountDecisionAuthority'
import { authorityConsumerRecommendations } from '../decision/accountDecisionAuthorityConsumers'
import { authorityExecutionCandidates } from '../decision/accountDecisionAuthorityExecutionCandidates'
import { authorityTargetBuildDirection } from '../decision/authorityTargetBuildDirection'
import {
  createAccountTeamEngineBoxInput,
  createAuthorityExecutionVariantResolver,
} from '../decision/authorityExecutionVariantResolver'
import type { BangbooStar, TeamEngineCandidate } from '../teamEngine/contracts'
import { current31TeamEngineD1Pack } from '../teamEngine/current31D1Pack'
import {
  compileTeamBuildIntent,
  compileAuthorComparisonTeamBuildIntent,
} from '../decision/buildIntent'
import { reviewedAuthorComparisonMembership32 } from '../decision/reviewedAuthorComparisonMembership32'
import { candidatePanelInputsForScheme } from '../optimizer/optimizeAccountBuilds'
import { projectTeamEquipmentRecommendations } from '../decision/teamEquipmentRecommendations'
import {
  calculationQueryContractVersion,
  type AccountDecisionRun,
  type CalculationQueryClient,
} from './calculationQueryContract'
import { projectPrivateTeamExecution } from '../pages/privateTeamLoadoutPresentationProducer'
import { resolveTargetTeamFitEntry } from '../pages/teamTargetFitEntry'
import { equipmentParameterSelection } from './equipmentParameterSelection'

function defaultSchemeBangbooId(candidate: TeamEngineCandidate) {
  if (candidate.bangbooId) return candidate.bangbooId
  const selection = candidate.bangbooSelection
  if (selection.status === 'selected' || selection.status === 'compatible_fallback')
    return selection.bangbooId
  return null
}

function explicitBangbooStar(stars: number): BangbooStar {
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) throw new Error('邦布星级必须在 1–5 星。')
  return stars as BangbooStar
}

export function createLocalTargetTeamFitQuery({
  runs,
  teamFits,
  requireCompiledRuntime,
}: {
  runs: Map<string, AccountDecisionRun>
  teamFits: Map<
    string,
    Map<string, Awaited<ReturnType<CalculationQueryClient['calculateTargetTeamWarehouseFit']>>>
  >
  requireCompiledRuntime: () => Promise<unknown>
}): CalculationQueryClient['calculateTargetTeamWarehouseFit'] {
  const calculateTargetTeamWarehouseFitQuery: CalculationQueryClient['calculateTargetTeamWarehouseFit'] =
    async (query) => {
      if (query.contractVersion !== calculationQueryContractVersion)
        throw new Error(`Unsupported Calculation/Query contract: ${query.contractVersion}.`)
      await requireCompiledRuntime()
      const run = runs.get(query.runId)
      if (!run) throw new Error(`Account Decision run is unavailable: ${query.runId}.`)
      if (query.playerBangbooSelection) {
        if (query.equipmentParameters) throw new Error('队伍装备参数不能重复指定。')
        const choice = query.playerBangbooSelection
        const entry = resolveTargetTeamFitEntry(run.snapshot, choice.teamKey, run.input.warehouse)
        const input = entry.playerConfirmableBangbooInput
        if (!input || entry.targetCandidateId !== query.candidateId)
          throw new Error('当前队伍的邦布确认已失效，请重新选择。')
        const bangbooSelection = selectPlayerConfirmableTargetBangbooSelection({
          ...input,
          bangbooId: choice.bangbooId,
          bangbooStarsById: { [choice.bangbooId]: choice.bangbooStars },
        })
        const recommendations = projectTeamEquipmentRecommendations({
          memberIds: input.memberIds,
          bangbooSelection,
          roster: run.input.warehouse.roster,
        })
        const equipmentParameters = equipmentParameterSelection({
          memberIds: input.memberIds,
          recommendations,
          effectiveParameters: {
            wEngines: [],
            bangbooId: choice.bangbooId,
            bangbooStars: choice.bangbooStars,
          },
        })
        if (equipmentParameters.wEngines.some((engine) => !engine.engineId))
          throw new Error('这支队伍缺少完整音擎参数，暂不能生成配装。')
        return calculateTargetTeamWarehouseFitQuery({
          contractVersion: query.contractVersion,
          kind: query.kind,
          runId: query.runId,
          candidateId: query.candidateId,
          equipmentParameters,
        })
      }
      if (run.snapshot.decisionAuthority.status !== 'ready')
        throw new Error('Account Decision shortlist is unavailable for target-team calculation.')
      const authorityCandidates = authorityConsumerRecommendations(run.snapshot.decisionAuthority)
      const authorityCandidate = authorityCandidates.find(
        (item) => item.candidateId === query.candidateId,
      )
      if (
        authorityCandidate &&
        !run.snapshot.decisionAuthority.productionWorkset.candidateIds.includes(query.candidateId)
      )
        throw new Error(`Candidate is outside the production workset: ${query.candidateId}.`)
      if (authorityCandidate?.authorComparisonMembership) {
        // Revalidate current facts, not a caller-supplied marker or stale presentation.
        const memberIds = [...authorityCandidate.memberIds] as [string, string, string]
        const ownedAgentIds = run.input.warehouse.roster.agents
          .filter((row) => row.owned)
          .map((row) => row.agentId)
        const membership = reviewedAuthorComparisonMembership32(memberIds, ownedAgentIds)
        if (
          !membership ||
          membership.fingerprint !== authorityCandidate.authorComparisonMembership.fingerprint
        )
          throw new Error('队伍资料已变化，请重新分析。')
        if (query.equipmentParameters || query.playerBangbooSelection)
          throw new Error('当前方案仅比较三名代理人的驱动盘。')
        const buildIntent = compileAuthorComparisonTeamBuildIntent({
          candidateId: query.candidateId,
          memberIds,
          ownedAgentIds,
          agentStateById: Object.fromEntries(
            run.input.warehouse.roster.agents.map((row) => [
              row.agentId,
              { potentialImage: row.potentialImage },
            ]),
          ),
        })
        const fit = calculateTargetTeamWarehouseFit({
          warehouse: run.input.warehouse,
          buildIntent,
          bangbooSelection: {
            status: 'not_evaluated',
            reason: '本次未纳入邦布。',
          },
        })
        const candidate = {
          candidateId: query.candidateId,
          memberIds,
          bangbooId: null,
          scenarioTags: [],
          provenance: 'authority_exact' as const,
          authorComparisonMembership: membership,
        }
        const context = {
          warehouse: run.input.warehouse,
          candidate,
          fit,
          rosterHash: run.snapshot.fingerprint.components.rosterHash,
          warehouseHash: run.snapshot.fingerprint.components.warehouseHash,
          planningHash: run.snapshot.fingerprint.components.planningHash,
          capturedAt: run.capturedAt,
        }
        const accountBoundBenchmark = projectTargetTeamAccountBoundBenchmark(context)
        const result: Awaited<
          ReturnType<CalculationQueryClient['calculateTargetTeamWarehouseFit']>
        > = {
          ...fit,
          portfolioContinuationEligible: false,
          effectiveEquipmentParameters: null,
          accountFactBinding: authorComparisonAccountBinding(
            run.input.warehouse,
            memberIds,
            membership.fingerprint,
          ),
          accountBoundBenchmark,
          targetExecution: projectTargetTeamExecution({
            candidate,
            warehousePlan: fit.warehousePlan,
            allocation: run.snapshot.allocation,
            roster: run.input.warehouse.roster,
            drafts: run.input.drafts,
            activePlanIds: run.input.activePlanIds,
          }),
          valueBenchmark: projectTargetTeamValueBenchmark({
            ...context,
            drafts: run.input.drafts,
            activePlanIds: run.input.activePlanIds,
            targetFit: fit,
            targetBenchmark: accountBoundBenchmark,
            stale: false,
          }),
          cultivationRefinement: refineCultivationPriorityWithTargetFit({
            recommendation: authorityCandidate,
            fit,
          }),
        }
        result.teamExecutionPresentation = projectPrivateTeamExecution(run, result)
        const cached = teamFits.get(run.runId) ?? new Map()
        cached.set(result.candidateId, result)
        teamFits.set(run.runId, cached)
        return result
      }
      const directEngineCandidate = run.snapshot.teamEngine.recommendations.find(
        (item) => item.candidateId === query.candidateId,
      )
      if (!authorityCandidate && !directEngineCandidate)
        throw new Error(`Target-team identity is unavailable: ${query.candidateId}.`)
      const unboundAuthorityForDirectCandidate =
        !authorityCandidate &&
        directEngineCandidate &&
        authorityCandidates.find(
          (item) =>
            item.bangbooId === null &&
            [...item.memberIds].toSorted().join('|') ===
              [...directEngineCandidate.memberIds].toSorted().join('|'),
        )
      const authorityDirection = authorityCandidate
        ? authorityTargetBuildDirection(authorityCandidate)
        : undefined
      const requiresPlayerBangbooConfirmation = Boolean(
        (authorityCandidate && !authorityDirection) || unboundAuthorityForDirectCandidate,
      )
      const candidate = authorityDirection ?? authorityCandidate ?? directEngineCandidate!
      const recommendedBangboo = recommendedTargetBangbooDefault({ memberIds: candidate.memberIds })
      if (
        !recommendedBangboo &&
        ((authorityCandidate && !authorityDirection && !query.equipmentParameters?.bangbooId) ||
          (unboundAuthorityForDirectCandidate && !query.equipmentParameters?.bangbooId))
      )
        throw new Error('当前队伍尚无默认邦布，请选择此队伍提供的邦布。')
      const memberKey = [...candidate.memberIds].sort().join('|')
      const requestedBangbooStar = query.equipmentParameters
        ? explicitBangbooStar(query.equipmentParameters.bangbooStars)
        : undefined
      const authorityVariantResolver = createAuthorityExecutionVariantResolver({
        pack: current31TeamEngineD1Pack,
        boxInput: createAccountTeamEngineBoxInput({
          warehouse: run.input.warehouse,
          profiles: undefined,
          allocation: run.snapshot.allocation,
          developmentPriorityAgentIds: run.input.developmentPriorityAgentIds,
        }),
        baseCandidates: run.snapshot.teamEngine.recommendations,
      })
      const authorityExecutionCandidate = authorityCandidate
        ? authorityExecutionCandidates(
            run.snapshot.decisionAuthority,
            run.snapshot.teamEngine.recommendations,
            authorityVariantResolver,
          ).find((item) => item.candidateId === authorityCandidate.candidateId)
        : undefined
      const sourceEngineCandidate = authorityExecutionCandidate ?? directEngineCandidate
      const sourceCandidate =
        sourceEngineCandidate ??
        authorityDirection ??
        (authorityCandidate && (query.equipmentParameters?.bangbooId || recommendedBangboo)
          ? {
              candidateId: authorityCandidate.candidateId,
              memberIds: [...authorityCandidate.memberIds] as [string, string, string],
              bangbooId: query.equipmentParameters?.bangbooId ?? recommendedBangboo!.bangbooId,
              scenarioTags: [],
              provenance: 'authority_exact' as const,
            }
          : undefined)
      if (!sourceCandidate) throw new Error('当前方向暂不能生成 18 盘配装。')
      const sourceBangbooId = authorityDirection
        ? authorityDirection.bangbooId
        : authorityCandidate
          ? (query.equipmentParameters?.bangbooId ?? null)
          : unboundAuthorityForDirectCandidate
            ? (query.equipmentParameters?.bangbooId ?? null)
            : sourceEngineCandidate
              ? defaultSchemeBangbooId(sourceEngineCandidate)
              : null
      const automaticBangboo =
        !query.equipmentParameters && !sourceBangbooId
          ? recommendedTargetBangbooDefault({ memberIds: candidate.memberIds })
          : null
      const selectedBangbooId =
        query.equipmentParameters?.bangbooId ?? sourceBangbooId ?? automaticBangboo?.bangbooId
      if (!selectedBangbooId)
        throw new Error('当前队伍尚无默认邦布，请先确认邦布与星级后再生成配装。')
      const sourcePrimaryBangbooId = sourceBangbooId ?? selectedBangbooId
      const sourceBangbooInput = {
        memberIds: candidate.memberIds,
        primaryBangbooId: sourcePrimaryBangbooId,
        engineCandidate: sourceEngineCandidate,
        roster: run.input.warehouse.roster,
        ...(requestedBangbooStar
          ? { bangbooStarsById: { [selectedBangbooId]: requestedBangbooStar } }
          : {}),
      }
      const originalSourceSelection = sourceSupportedTargetBangbooSelection(sourceBangbooInput)
      const originalOptionIds =
        originalSourceSelection.status === 'selected'
          ? [
              originalSourceSelection.bangbooId,
              ...(originalSourceSelection.alternativeBangbooIds ?? []),
            ]
          : originalSourceSelection.status === 'compatible_fallback'
            ? [originalSourceSelection.bangbooId, ...originalSourceSelection.bangbooIds]
            : []
      const sourceBangbooSelection = withReviewedSourceBangbooAlternatives(
        sourceBangbooInput,
        originalSourceSelection,
      )
      const selectedAuthorOption = Boolean(
        query.equipmentParameters &&
        !originalOptionIds.includes(selectedBangbooId) &&
        resolveTargetTeamBangbooOption(sourceBangbooInput, selectedBangbooId),
      )
      const sourceSupportedSelection = automaticBangboo
        ? selectPlayerConfirmableTargetBangbooSelection({
            ...sourceBangbooInput,
            bangbooId: automaticBangboo.bangbooId,
            bangbooStarsById: { [automaticBangboo.bangbooId]: automaticBangboo.defaultStars },
          })
        : selectedAuthorOption ||
            requiresPlayerBangbooConfirmation ||
            sourceBangbooSelection.status === 'no_authoritative_recommendation'
          ? query.equipmentParameters
            ? selectPlayerConfirmableTargetBangbooSelection({
                memberIds: candidate.memberIds,
                primaryBangbooId: sourcePrimaryBangbooId,
                engineCandidate: sourceEngineCandidate,
                roster: run.input.warehouse.roster,
                bangbooId: query.equipmentParameters.bangbooId,
                bangbooStarsById: { [selectedBangbooId]: requestedBangbooStar! },
              })
            : (() => {
                throw new Error('这只邦布暂不能用于当前队伍，请重新选择。')
              })()
          : selectSupportedTargetBangbooSelection({
              selection: sourceBangbooSelection,
              bangbooId: selectedBangbooId,
            })
      const resolvedEngineCandidate =
        requestedBangbooStar && sourceEngineCandidate && !selectedAuthorOption
          ? authorityVariantResolver({
              memberIds: [candidate.memberIds[0], candidate.memberIds[1], candidate.memberIds[2]],
              bangbooId: selectedBangbooId,
              bangbooStar: requestedBangbooStar,
            })
          : sourceEngineCandidate
      if (requestedBangbooStar && sourceEngineCandidate && !resolvedEngineCandidate)
        throw new Error('当前队伍或星级不满足这只邦布的条件。')
      // The exact star resolution above validates the selected formation. Keep
      // the independently revalidated source choices: the resolver deliberately
      // restricts its own candidate set to one Bangboo and is not an option list.
      const compatibleBangbooSelection = sourceSupportedSelection
      const executionIdentity = resolvedEngineCandidate
        ? {
            ...resolvedEngineCandidate,
            candidateId: candidate.candidateId,
            memberIds: [...candidate.memberIds] as [string, string, string],
            bangbooId: selectedBangbooId,
            bangbooSelection: compatibleBangbooSelection,
          }
        : { ...sourceCandidate, bangbooId: selectedBangbooId }
      // Resolve the same scheme defaults before solving; these are planning assumptions, not ownership.
      const schemeParameters =
        query.equipmentParameters ??
        defaultTargetTeamEquipmentParameters({
          memberIds: [...candidate.memberIds],
          equipmentRecommendations: projectTeamEquipmentRecommendations({
            includeReviewedSourceOptions: true,
            memberIds: candidate.memberIds,
            bangbooSelection: compatibleBangbooSelection,
            roster: run.input.warehouse.roster,
          }),
        })
      const panelInputsByAgent = candidatePanelInputsForScheme(
        run.input.warehouse.roster.agents,
        candidate.memberIds,
        schemeParameters?.wEngines,
      )
      const buildIntent = compileTeamBuildIntent({
        candidateId: candidate.candidateId,
        memberIds: candidate.memberIds,
        bangbooId: selectedBangbooId,
        scenarioTags: executionIdentity.scenarioTags,
        ...(panelInputsByAgent ? { optimizerOptions: { panelInputsByAgent } } : {}),
        agentStateById: Object.fromEntries(
          run.input.warehouse.roster.agents.map((agent) => [
            agent.agentId,
            { potentialImage: agent.potentialImage },
          ]),
        ),
      })
      const fit = calculateTargetTeamWarehouseFit({
        warehouse: run.input.warehouse,
        buildIntent,
        bangbooSelection: compatibleBangbooSelection,
        ...(schemeParameters
          ? {
              teamAssignmentObjective: createTargetTeamAssignmentObjective({
                warehouse: run.input.warehouse,
                candidate: executionIdentity,
                parameters: schemeParameters,
                rosterHash: run.snapshot.fingerprint.components.rosterHash,
                warehouseHash: run.snapshot.fingerprint.components.warehouseHash,
                planningHash: run.snapshot.fingerprint.components.planningHash,
                capturedAt: run.capturedAt,
              }),
            }
          : {}),
      })
      const benchmarkCandidate = executionIdentity
      const accountBoundBenchmark = projectTargetTeamAccountBoundBenchmark({
        warehouse: run.input.warehouse,
        candidate: benchmarkCandidate,
        fit,
        rosterHash: run.snapshot.fingerprint.components.rosterHash,
        warehouseHash: run.snapshot.fingerprint.components.warehouseHash,
        planningHash: run.snapshot.fingerprint.components.planningHash,
        capturedAt: run.capturedAt,
        equipmentParameters: query.equipmentParameters,
      })
      const effectiveEquipmentParameters = query.equipmentParameters
        ? accountBoundBenchmark.equipmentParameters
          ? confirmedTargetTeamEquipmentParameters(query.equipmentParameters)
          : null
        : (defaultTargetTeamEquipmentParameters(fit) ?? null)
      const result: Awaited<ReturnType<CalculationQueryClient['calculateTargetTeamWarehouseFit']>> =
        {
          ...fit,
          portfolioContinuationEligible: isAdoptedPortfolioTeam(fit.memberIds),
          effectiveEquipmentParameters,
          targetExecution: projectTargetTeamExecution({
            candidate: benchmarkCandidate,
            warehousePlan: fit.warehousePlan,
            allocation: run.snapshot.allocation,
            roster: run.input.warehouse.roster,
            drafts: run.input.drafts,
            activePlanIds: run.input.activePlanIds,
            effectiveEquipmentParameters: effectiveEquipmentParameters ?? undefined,
          }),
          accountBoundBenchmark,
          valueBenchmark: projectTargetTeamValueBenchmark({
            warehouse: run.input.warehouse,
            drafts: run.input.drafts,
            activePlanIds: run.input.activePlanIds,
            candidate: benchmarkCandidate,
            targetFit: fit,
            targetBenchmark: accountBoundBenchmark,
            rosterHash: run.snapshot.fingerprint.components.rosterHash,
            warehouseHash: run.snapshot.fingerprint.components.warehouseHash,
            planningHash: run.snapshot.fingerprint.components.planningHash,
            capturedAt: run.capturedAt,
            equipmentParameters: query.equipmentParameters,
            stale: false,
          }),
          cultivationRefinement: refineCultivationPriorityWithTargetFit({
            recommendation:
              authorityCandidate ??
              authorityCandidates.find(
                (item) => [...item.memberIds].sort().join('|') === memberKey,
              ) ??
              (() => {
                throw new Error(
                  `Target-team cultivation authority is unavailable: ${query.candidateId}.`,
                )
              })(),
            fit,
          }),
        }
      result.teamExecutionPresentation = projectPrivateTeamExecution(run, result)
      const cachedTeamFits = teamFits.get(run.runId) ?? new Map()
      cachedTeamFits.set(result.candidateId, result)
      teamFits.set(run.runId, cachedTeamFits)
      return result
    }
  return calculateTargetTeamWarehouseFitQuery
}
