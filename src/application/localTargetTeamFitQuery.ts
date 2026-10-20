import {
  normalizeReviewedEventConditionDeclarations32,
  reviewedEventConditionDeclarationsIdentity32,
} from '../calculation/reviewedEventConditionDeclarations32'
import { refineCultivationPriorityWithTargetFit } from '../decision/accountDecisionAuthority'
import { authorityConsumerRecommendations } from '../decision/accountDecisionAuthorityConsumers'
import { resolveAuthorityExecutionCandidate } from '../decision/accountDecisionAuthorityExecutionCandidates'
import {
  createAccountTeamEngineBoxInput,
  createAuthorityExecutionVariantResolver,
} from '../decision/authorityExecutionVariantResolver'
import { isAdoptedPortfolioTeam } from '../decision/authorityPortfolioCandidates'
import { authorityTargetBuildDirection } from '../decision/authorityTargetBuildDirection'
import {
  compileAuthorComparisonTeamBuildIntent,
  compileTeamBuildIntent,
} from '../decision/buildIntent'
import { reviewedAuthorComparisonMembership32 } from '../decision/reviewedAuthorComparisonMembership32'
import { projectTargetTeamAccountBoundBenchmark } from '../decision/targetTeamAccountBoundBenchmark'
import { createTargetTeamAssignmentObjective } from '../decision/targetTeamAssignmentObjective'
import {
  confirmedTargetTeamEquipmentParameters,
  defaultTargetTeamEquipmentParameters,
  recommendedTargetBangbooDefault,
  resolveTargetTeamBangbooOption,
  selectPlayerConfirmableTargetBangbooSelection,
  selectSupportedTargetBangbooSelection,
  sourceSupportedTargetBangbooSelection,
  withReviewedSourceBangbooAlternatives,
} from '../decision/targetTeamEquipmentParameters'
import { projectTargetTeamValueBenchmark } from '../decision/targetTeamValueBenchmark'
import { calculateTargetTeamWarehouseFit } from '../decision/targetTeamWarehouseFit'
import { projectTeamEquipmentRecommendations } from '../decision/teamEquipmentRecommendations'
import { projectTargetTeamExecution } from '../decision/teamExecutionProjection'
import {
  candidatePanelInputsForScheme,
  type AccountLoadout,
} from '../optimizer/optimizeAccountBuilds'
import { projectPrivateTeamExecution } from '../pages/privateTeamLoadoutPresentationProducer'
import type { BangbooStar, TeamEngineCandidate } from '../teamEngine/contracts'
import { current31TeamEngineD1Pack } from '../teamEngine/current31D1Pack'
import {
  calculationQueryContractVersion,
  type AccountDecisionRun,
  type CalculationQueryClient,
} from './calculationQueryContract'
import { resolvePlayerConfirmedTargetTeamQuery } from './localTargetTeamPlayerSelection'
import { authorComparisonAccountBinding } from './publicAuthorComparisonAccountBinding'
import { targetTeamBuildDirectionConditions } from './targetTeamEffectivePotentialConditions'
import { preparePlanningBenchmark32 } from './privatePlanningBenchmarkBinding32'
import { projectPlanningBenchmark32 } from './privatePlanningBenchmark32'
import { validatePlanningEventDeclarations32 } from './publicPlanningEventDeclarations32'
import type { DeclaredEventGoal32 } from '../decision/targetTeamDeclaredEventObjective32'
import { contentHash } from './contentHash'
import { prepareTargetTeamStandardReference32 } from './targetTeamStandardReference32'

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
      let declaredEventGoal32: DeclaredEventGoal32 | undefined
      let declaredEventReferenceAssignments: readonly AccountLoadout[] | undefined
      if (query.declaredEventComparison32) {
        if (
          query.scenarioSelection?.id === 'declared-stun-comparison' ||
          Object.keys(query.eventConditionDeclarationsByAgentId ?? {}).length
        )
          throw new Error('逐次事件条件不能与全局固定状态混用。')
        const reference = teamFits.get(run.runId)?.get(query.candidateId)
        const comparison = query.declaredEventComparison32
        if (
          !reference ||
          reference.status !== 'ready' ||
          reference.fingerprint !== comparison.fitFingerprint ||
          !reference.effectiveEquipmentParameters
        )
          throw new Error('逐次事件参考配装已变化，请重新读取条件。')
        const binding = {
          runId: run.runId,
          candidateId: query.candidateId,
          accountFingerprint: run.inputFingerprint,
          capturedAt: run.capturedAt,
          warehouse: run.input.warehouse,
          fit: reference,
          selectedEquipment: reference.effectiveEquipmentParameters,
        }
        const prepared = preparePlanningBenchmark32(binding)
        if (
          prepared.gaps.length ||
          !prepared.metadata ||
          prepared.sourceBindingFingerprint !== comparison.sourceBindingFingerprint ||
          validatePlanningEventDeclarations32(comparison.declarations, prepared.metadata).gaps
            .length
        )
          throw new Error('逐次事件的来源、账户或声明已变化，请重新读取条件。')
        declaredEventGoal32 = {
          declarations: structuredClone(comparison.declarations),
          sourceBindingFingerprint: comparison.sourceBindingFingerprint,
          referenceAccountFingerprint: run.inputFingerprint,
          referenceSelectedEquipment: reference.effectiveEquipmentParameters,
          referenceFit: {
            fingerprint: reference.fingerprint,
            loadouts: reference.loadouts.map(({ agentId, discIds }) => ({
              agentId,
              discIds: [...discIds],
            })),
          },
        }
        declaredEventReferenceAssignments = structuredClone(reference.warehousePlan.loadouts)
      }
      const playerConfirmedQuery = resolvePlayerConfirmedTargetTeamQuery(query, run)
      if (playerConfirmedQuery) return calculateTargetTeamWarehouseFitQuery(playerConfirmedQuery)
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
          ...targetTeamBuildDirectionConditions({ memberIds, roster: run.input.warehouse.roster }),
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
        const eventConditionDeclarationsByAgentId = normalizeReviewedEventConditionDeclarations32(
          query.eventConditionDeclarationsByAgentId,
          memberIds,
        )
        const context = {
          sourceInputFingerprint: run.inputFingerprint,
          eventConditionDeclarationsByAgentId,
          scenarioSelection: query.scenarioSelection,
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
        Object.assign(result, {
          scenarioSelection: accountBoundBenchmark.scenarioSelection,
          scenarioIdentity: accountBoundBenchmark.scenarioIdentity,
          eventConditionDeclarationsByAgentId,
          eventConditionDeclarationsIdentity: reviewedEventConditionDeclarationsIdentity32(
            eventConditionDeclarationsByAgentId,
          ),
        })
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
        ? resolveAuthorityExecutionCandidate(
            authorityCandidate,
            run.snapshot.teamEngine.recommendations,
            authorityVariantResolver,
          )
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
      // Use the same per-call potential assumptions as the numeric context. Keep
      // missing observations intact for the capability resolver's unknown policy;
      // this overlay never changes the account roster.
      const eventConditionDeclarationsByAgentId = normalizeReviewedEventConditionDeclarations32(
        query.eventConditionDeclarationsByAgentId,
        candidate.memberIds,
      )
      const directionConditions = targetTeamBuildDirectionConditions({
        memberIds: candidate.memberIds,
        roster: run.input.warehouse.roster,
        potentialByAgentId: schemeParameters?.potentialByAgentId,
      })
      const buildIntent = compileTeamBuildIntent({
        candidateId: candidate.candidateId,
        memberIds: candidate.memberIds,
        bangbooId: selectedBangbooId,
        scenarioTags: executionIdentity.scenarioTags,
        ...(panelInputsByAgent ? { optimizerOptions: { panelInputsByAgent } } : {}),
        ...directionConditions,
      })
      // Team selection is the boundary where the independent standard may be
      // prepared. Exact finite source goals can select immediately; every other
      // team receives its issued metadata without guessed event counts.
      const standardReference = schemeParameters
        ? prepareTargetTeamStandardReference32(
            {
              input: {
                warehouse: run.input.warehouse,
                candidate: executionIdentity,
                parameters: schemeParameters,
                rosterHash: run.snapshot.fingerprint.components.rosterHash,
                warehouseHash: run.snapshot.fingerprint.components.warehouseHash,
                planningHash: run.snapshot.fingerprint.components.planningHash,
                capturedAt: run.capturedAt,
                scenarioSelection: query.scenarioSelection,
              },
            },
            query.standardReference32,
          )
        : undefined
      const teamAssignmentObjective = schemeParameters
        ? createTargetTeamAssignmentObjective({
            buildIntent,
            declaredEventGoal32,
            eventConditionDeclarationsByAgentId,
            scenarioSelection: query.scenarioSelection,
            warehouse: run.input.warehouse,
            candidate: executionIdentity,
            parameters: schemeParameters,
            rosterHash: run.snapshot.fingerprint.components.rosterHash,
            warehouseHash: run.snapshot.fingerprint.components.warehouseHash,
            planningHash: run.snapshot.fingerprint.components.planningHash,
            capturedAt: run.capturedAt,
          })
        : undefined
      if (declaredEventGoal32) {
        // An explicit goal cannot silently become a source-score solve when its
        // conditions or protected functions remain unknown.
        if (
          !teamAssignmentObjective ||
          !declaredEventReferenceAssignments ||
          teamAssignmentObjective.evaluate(declaredEventReferenceAssignments) === null
        )
          throw new Error('逐次目标的装备条件或功能尚未闭合，不能改用旧目标生成配装。')
      }
      const fit = calculateTargetTeamWarehouseFit({
        warehouse: run.input.warehouse,
        buildIntent,
        bangbooSelection: compatibleBangbooSelection,
        ...(teamAssignmentObjective ? { teamAssignmentObjective } : {}),
      })
      const benchmarkCandidate = executionIdentity
      const normalizedBenchmark = projectTargetTeamAccountBoundBenchmark({
        sourceInputFingerprint: run.inputFingerprint,
        eventConditionDeclarationsByAgentId,
        scenarioSelection: query.scenarioSelection,
        warehouse: run.input.warehouse,
        candidate: benchmarkCandidate,
        fit,
        rosterHash: run.snapshot.fingerprint.components.rosterHash,
        warehouseHash: run.snapshot.fingerprint.components.warehouseHash,
        planningHash: run.snapshot.fingerprint.components.planningHash,
        capturedAt: run.capturedAt,
        equipmentParameters: query.equipmentParameters,
      })
      // The normalized protocol is a different objective. Its numbers cannot
      // stand in for an explicitly declared event comparison in legacy readers.
      const accountBoundBenchmark = declaredEventGoal32
        ? (() => {
            const benchmark = { ...normalizedBenchmark }
            Reflect.deleteProperty(benchmark, 'fingerprint')
            const reason = '本次采用逐次声明目标；旧固定事件比较不能代替同目标的比较结果。'
            const blocked = {
              ...benchmark,
              status: 'unavailable' as const,
              baselineId: null,
              declaredDurationSeconds: null,
              totalDamage: null,
              planningDps: null,
              assetBindingFingerprint: null,
              luminizeSnapshot32: undefined,
              calculationProjection: {
                status: 'unsupported' as const,
                blockers: [reason],
                fingerprint: declaredEventGoal32.sourceBindingFingerprint,
              },
              binding: {
                ...benchmark.binding,
                equipmentParameterStatus: 'confirmed_but_calculation_unsupported' as const,
              },
              gaps: [reason],
            }
            return {
              ...blocked,
              fingerprint: contentHash({
                ...blocked,
                objective: fit.assignmentObjectiveFingerprint,
              }),
            }
          })()
        : normalizedBenchmark
      const effectiveEquipmentParameters = query.equipmentParameters
        ? accountBoundBenchmark.equipmentParameters
          ? confirmedTargetTeamEquipmentParameters(query.equipmentParameters)
          : null
        : (defaultTargetTeamEquipmentParameters(fit) ?? null)
      const result: Awaited<ReturnType<CalculationQueryClient['calculateTargetTeamWarehouseFit']>> =
        {
          ...fit,
          ...(standardReference ? { standardReference32: standardReference.result } : {}),
          ...(query.standardReference32
            ? { standardReferenceRequest32: structuredClone(query.standardReference32) }
            : {}),
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
            eventConditionDeclarationsByAgentId,
            scenarioSelection: query.scenarioSelection,
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
      Object.assign(result, {
        ...(declaredEventGoal32
          ? {
              declaredEventBenchmark32: (() => {
                const binding = {
                  runId: run.runId,
                  candidateId: result.candidateId,
                  accountFingerprint: run.inputFingerprint,
                  capturedAt: run.capturedAt,
                  warehouse: run.input.warehouse,
                  fit,
                  selectedEquipment: effectiveEquipmentParameters,
                }
                const current = preparePlanningBenchmark32(binding)
                return projectPlanningBenchmark32(
                  binding,
                  declaredEventGoal32.declarations,
                  current.sourceBindingFingerprint,
                )
              })(),
            }
          : {}),
        scenarioSelection: accountBoundBenchmark.scenarioSelection,
        scenarioIdentity: accountBoundBenchmark.scenarioIdentity,
        eventConditionDeclarationsByAgentId,
        eventConditionDeclarationsIdentity: reviewedEventConditionDeclarationsIdentity32(
          eventConditionDeclarationsByAgentId,
        ),
      })
      result.teamExecutionPresentation = projectPrivateTeamExecution(run, result)
      const cachedTeamFits = teamFits.get(run.runId) ?? new Map()
      cachedTeamFits.set(result.candidateId, result)
      teamFits.set(run.runId, cachedTeamFits)
      return result
    }
  return calculateTargetTeamWarehouseFitQuery
}
