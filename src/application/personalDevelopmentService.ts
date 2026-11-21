import { parseDevelopmentParametersByRank } from '../accounts/developmentComparisonParametersSchema'
import {
  normalizeReviewedEventConditionDeclarations32,
  reviewedEventConditionDeclarationsIdentity32,
} from '../calculation/reviewedEventConditionDeclarations32'
import { resolveCurrentPlanningScenario32 } from '../calculation/currentPlanningScenario32'
import { validateSourceResourceGrantDeclaration32 } from '../calculation/sourceMechanismResourceGrantContract32'
import { currentBuildIntentRecommendationState } from '../decision/buildIntent'
import { projectDevelopmentCandidateAlternatives } from '../decision/developmentCandidateAlternatives'
import { createDevelopmentValueBenchmarkEvaluator } from '../decision/developmentValueBenchmark'
import { stableContentHash } from '../gameDataPacks/types'
import { projectDevelopmentCandidatePresentation } from './developmentCandidatePresentation'
import { projectDevelopmentParameterizedCandidates } from './developmentParameterizedCandidates'
import {
  personalDevelopmentInputFingerprint,
  personalDevelopmentSolveInputFingerprint,
  type OpenPersonalDevelopmentQuery,
  type PersonalDevelopmentCandidatesQuery,
  type PersonalDevelopmentCandidatesResult,
  type PersonalDevelopmentSession,
  type PersonalDevelopmentRouteQuery,
  type PersonalDevelopmentRoute,
} from './publicPersonalDevelopment'
import { contentHash } from './contentHash'
import { projectDevelopmentSaveKnowledge } from './developmentSaveKnowledge'
import { getCandidateWarehouseConstraint } from '../gameDataPacks/candidateWarehouseConstraints'
import { currentFormulaMechanicContractHash } from '../calculation/currentFormulaMechanicContracts'
import { currentWEnginePersonalPlanningEffectVersion } from '../calculation/currentWEnginePersonalPlanningEffects'
import { developmentCandidateRefinementVersion } from '../decision/developmentCandidateRefinement'
import { developmentCandidateRankingVersion } from '../decision/developmentCandidateRanking'
import { planningEffectResolutionIdentity32 } from '../calculation/currentPlanningEffectResolutionIdentity32'
import { getCurrentAgentNumericContract } from '../calculation/currentAgentNumericContracts'
import { getCurrentAgentEventContract } from '../calculation/currentAgentMechanicContracts'
import { getCurrentAgentDecisionMechanicContract } from '../calculation/currentAgentDecisionMechanicContracts'
import { currentWEngineStaticCatalog } from '../gameDataPacks/currentWEngineStaticCatalog'
import { currentDriveDiscFormulaCatalog } from '../gameDataPacks/currentDriveDiscFormulaCatalog'

type Captured = {
  session: PersonalDevelopmentSession
  input: OpenPersonalDevelopmentQuery['input']
  generated: Map<string, Generated>
}
type Generated = {
  projection: ReturnType<typeof projectDevelopmentParameterizedCandidates>['projection']
  candidateSearchByRank: ReturnType<
    typeof projectDevelopmentParameterizedCandidates
  >['candidateSearchByRank']
  effectiveParametersByRank: ReturnType<
    typeof projectDevelopmentParameterizedCandidates
  >['effectiveParametersByRank']
  evaluator: ReturnType<typeof createDevelopmentValueBenchmarkEvaluator>
}

/** Per-worker read-only capture and bounded personal result cache, without an Account Decision run. */
export function createPersonalDevelopmentService() {
  const sessions = new Map<string, Captured>()
  const generationPool = new Map<string, Omit<Generated, 'evaluator'>>()
  const searchPool = new Map<string, ReturnType<typeof projectDevelopmentCandidateAlternatives>>()
  return {
    open(query: OpenPersonalDevelopmentQuery): PersonalDevelopmentSession {
      const input = structuredClone(query.input)
      const accountId = input.warehouse.accountId
      if (!accountId || !query.sessionId) throw new Error('个人搭配缺少账户或会话身份。')
      const session: PersonalDevelopmentSession = {
        contract: 'soda-personal-development-session/v1',
        sessionId: query.sessionId,
        accountId,
        inputFingerprint: personalDevelopmentInputFingerprint(input),
        capturedAt: query.capturedAt,
      }
      sessions.set(session.sessionId, { session, input, generated: new Map() })
      return session
    },
    release(sessionId: string) {
      sessions.delete(sessionId)
    },
    async query(
      query: PersonalDevelopmentCandidatesQuery,
    ): Promise<PersonalDevelopmentCandidatesResult> {
      if (query.mode !== 'generate' && query.mode !== 'compare')
        throw new Error('个人搭配模式无效。')
      if (query.mode === 'generate' && query.wEngineComparison)
        throw new Error('音擎比较需要比较模式。')
      if (
        query.wEngineComparison &&
        (!Number.isSafeInteger(query.wEngineComparison.candidateRank) ||
          query.wEngineComparison.candidateRank < 1 ||
          !query.wEngineComparison.inputFingerprint ||
          !query.wEngineComparison.loadoutFingerprint ||
          (query.wEngineComparison.progressionMode !== undefined &&
            !['account_owned_if_available', 'theoretical_benchmark_only'].includes(
              query.wEngineComparison.progressionMode,
            )))
      )
        throw new Error('音擎比较须绑定当前账户及有效的六盘候选。')
      const capture = sessions.get(query.sessionId)
      if (
        !capture ||
        capture.session.accountId !== query.accountId ||
        capture.session.inputFingerprint !== query.inputFingerprint ||
        personalDevelopmentInputFingerprint(capture.input) !== query.inputFingerprint
      )
        throw new Error('个人搭配输入已变化，请重新搭配。')
      const { input, session } = capture
      const grant = validateSourceResourceGrantDeclaration32(query.resourceGrantDeclaration32)
      if (grant.status === 'invalid') throw new Error('资源到账声明格式无效，请重新填写后分析。')
      const resourceGrantDeclaration32 = grant.status === 'valid' ? grant.declaration : undefined
      const declarations = normalizeReviewedEventConditionDeclarations32(
        query.eventConditionDeclarationsByAgentId,
        [query.agentId],
      )
      const declarationIdentity = reviewedEventConditionDeclarationsIdentity32(declarations)
      const scenario = resolveCurrentPlanningScenario32(query.scenarioSelection)
      const explicit = parseDevelopmentParametersByRank(query.candidateParametersByRank)
      const saveKnowledge = projectDevelopmentSaveKnowledge(input.warehouse, query.agentId)
      const generationSource = {
        agentId: query.agentId,
        scenario: scenario.identity,
        declarationIdentity,
        guidanceHash: getCandidateWarehouseConstraint(query.agentId)?.contentHash ?? null,
        saveKnowledge,
        numeric: getCurrentAgentNumericContract(query.agentId),
        event: getCurrentAgentEventContract(query.agentId),
        decision: getCurrentAgentDecisionMechanicContract(query.agentId),
        wEngineCatalogHash: currentWEngineStaticCatalog.contentHash,
        discCatalogHash: currentDriveDiscFormulaCatalog.contentHash,
        planningEffectResolutionIdentity32,
        currentFormulaMechanicContractHash,
        currentWEnginePersonalPlanningEffectVersion,
        developmentCandidateRefinementVersion,
        developmentCandidateRankingVersion,
      }
      const generationKey = stableContentHash({ ...generationSource, explicit })
      const solveInputFingerprint = personalDevelopmentSolveInputFingerprint(input)
      const poolKey = stableContentHash({
        solveInputFingerprint,
        generationKey,
      })
      let generated = capture.generated.get(generationKey)
      if (
        generated &&
        currentBuildIntentRecommendationState(generated.projection.buildIntent).status !== 'current'
      ) {
        capture.generated.delete(generationKey)
        generated = undefined
      }
      if (!generated) {
        const pooled = generationPool.get(poolKey)
        if (pooled) {
          generationPool.delete(poolKey)
          if (
            currentBuildIntentRecommendationState(pooled.projection.buildIntent).status ===
            'current'
          ) {
            generationPool.set(poolKey, pooled)
            generated = {
              ...structuredClone(pooled),
              evaluator: createDevelopmentValueBenchmarkEvaluator(),
            }
          }
        }
      }
      if (!generated) {
        const evaluator = createDevelopmentValueBenchmarkEvaluator()
        const initialDirectionParameters = explicit[1]?.independentDirection
          ? explicit[1]
          : undefined
        // Rebinding one rank must not rerun the unchanged base search. Cache each
        // exact parameter search separately from the assembled rank projection.
        const generate = (parameters?: typeof initialDirectionParameters) => {
          const searchKey = stableContentHash({
            solveInputFingerprint,
            source: generationSource,
            parameters: parameters ?? null,
          })
          const cached = searchPool.get(searchKey)
          if (cached) {
            searchPool.delete(searchKey)
            if (currentBuildIntentRecommendationState(cached.buildIntent).status === 'current') {
              searchPool.set(searchKey, cached)
              return structuredClone(cached)
            }
          }
          const projection = projectDevelopmentCandidateAlternatives(
            input,
            query.agentId,
            parameters,
            scenario.selection,
            declarations?.[query.agentId],
            evaluator,
          )
          searchPool.set(searchKey, structuredClone(projection))
          while (searchPool.size > 8) searchPool.delete(searchPool.keys().next().value!)
          return projection
        }
        const baseProjection = generate(initialDirectionParameters)
        const projected = projectDevelopmentParameterizedCandidates({
          baseProjection,
          explicit,
          initialDirectionParameters,
          generate,
        })
        generated = { ...projected, evaluator }
        generationPool.set(poolKey, structuredClone(projected))
        while (generationPool.size > 8) generationPool.delete(generationPool.keys().next().value!)
      }
      capture.generated.delete(generationKey)
      capture.generated.set(generationKey, generated)
      while (capture.generated.size > 8)
        capture.generated.delete(capture.generated.keys().next().value!)
      const { projection, evaluator, candidateSearchByRank, effectiveParametersByRank } = generated
      const shared = {
        contract: 'soda-development-candidate-alternatives/v1' as const,
        sessionId: session.sessionId,
        sessionContract: session.contract,
        mode: query.mode,
        generationIdentity: generationKey,
        saveKnowledge,
        capturedAt: session.capturedAt,
        inputFingerprint: session.inputFingerprint,
        accountId: session.accountId,
        agentId: query.agentId,
        sideEffect: 'read_only' as const,
        candidateParametersByRank: effectiveParametersByRank,
        scenarioSelection: scenario.selection,
        scenarioIdentity: scenario.identity,
        resourceGrantDeclaration32,
        eventConditionDeclarationsByAgentId: declarations,
        eventConditionDeclarationsIdentity: declarationIdentity,
        candidateSearchByRank,
        ...projection,
        presentation: projectDevelopmentCandidatePresentation(
          query.agentId,
          projection.buildIntent.recommendations.find((row) => row.agentId === query.agentId)
            ?.constraint ?? undefined,
        ),
      }
      if (query.mode === 'generate') return structuredClone(shared)
      const [benchmarks, panels, engines, reviewed, capabilities] = await Promise.all([
        import('../decision/developmentValueBenchmark'),
        import('./developmentComparisonPanelProjection'),
        import('./developmentWEngineComparisonProjection'),
        import('./privateReviewedIncrementalEvent32'),
        import('../assault/agentCapabilities'),
      ])
      if (sessions.get(query.sessionId) !== capture) throw new Error('个人搭配会话已释放。')
      const { projectDevelopmentValueBenchmarks } = benchmarks
      const { projectDevelopmentComparisonPanels } = panels
      const { projectDevelopmentWEngineComparison, projectDevelopmentWEngineOptions } = engines
      const { projectReviewedIncrementalEventMetadata32 } = reviewed
      const { supportsPotentialImage } = capabilities
      const valueBenchmarks = projectDevelopmentValueBenchmarks(
        {
          warehouse: input.warehouse,
          agentId: query.agentId,
          baseline: projection.baseline,
          candidates: projection.candidates,
          savedPlans: input.drafts,
          candidateParametersByRank: effectiveParametersByRank,
          scenarioSelection: scenario.selection,
          eventConditionDeclaration: declarations?.[query.agentId],
          resourceGrantDeclaration32,
          stale: false,
        },
        evaluator,
      )
      const engineDiscs = query.wEngineComparison
        ? projection.candidates[query.wEngineComparison.candidateRank - 1]?.loadouts[0]?.discs.map(
            (row) => row.disc,
          )
        : undefined
      if (query.wEngineComparison && !engineDiscs)
        throw new Error('音擎比较候选已不可用，请重新比较。')
      const wEngineComparison = projectDevelopmentWEngineComparison({
        warehouse: input.warehouse,
        agentId: query.agentId,
        inputFingerprint: session.inputFingerprint,
        discs: engineDiscs ?? [],
        query: {
          ...query,
          candidateParametersByRank: effectiveParametersByRank,
          scenarioSelection: scenario.selection,
          eventConditionDeclarationsByAgentId: declarations,
          resourceGrantDeclaration32,
        },
        evaluator,
      })
      return structuredClone({
        ...shared,
        comparisonContract: 'soda-explicit-development-comparison/v1' as const,
        comparisonFingerprint: stableContentHash({
          inputFingerprint: session.inputFingerprint,
          agentId: query.agentId,
          parameters: effectiveParametersByRank,
          scenarioIdentity: scenario.identity,
          eventConditionDeclarationsIdentity: declarationIdentity,
          ...(resourceGrantDeclaration32
            ? { resourceGrantDeclaration32: stableContentHash(resourceGrantDeclaration32) }
            : {}),
          candidateSearch: projection.candidateSearch,
          candidateSearchByRank,
          comparisons: valueBenchmarks.map((row) => row.candidate.calculationFingerprint),
          ...(wEngineComparison ? { wEngineComparison: wEngineComparison.fingerprint } : {}),
        }),
        ...(wEngineComparison ? { wEngineComparison } : {}),
        comparisonOptions: {
          reviewedEvent32: projectReviewedIncrementalEventMetadata32(query.agentId),
          wEngines:
            wEngineComparison?.entries ??
            projectDevelopmentWEngineOptions(input.warehouse, query.agentId),
          potentialSupported: supportsPotentialImage(query.agentId),
        },
        valueBenchmarks,
        panelPresentation: projectDevelopmentComparisonPanels({
          warehouse: input.warehouse,
          drafts: input.drafts ?? [],
          agentId: query.agentId,
          baseline: projection.baseline,
          candidates: projection.candidates,
          candidateParametersByRank: effectiveParametersByRank,
        }),
      })
    },
    async route(query: PersonalDevelopmentRouteQuery): Promise<PersonalDevelopmentRoute> {
      const capture = sessions.get(query.sessionId)
      if (
        !capture ||
        capture.session.accountId !== query.accountId ||
        capture.session.inputFingerprint !== query.inputFingerprint ||
        personalDevelopmentInputFingerprint(capture.input) !== query.inputFingerprint
      )
        throw new Error('个人搭配输入已变化，请重新搭配。')
      const generated = capture.generated.get(query.generationIdentity)
      if (
        !generated ||
        currentBuildIntentRecommendationState(generated.projection.buildIntent).status !== 'current'
      )
        throw new Error('个人搭配来源已变化，请重新搭配。')
      const selection = query.selection
      const loadout =
        selection.candidateRank === null
          ? undefined
          : generated.projection.candidates[selection.candidateRank - 1]?.loadouts[0]
      if (
        selection.candidateRank !== null &&
        (!loadout || contentHash(loadout) !== selection.candidateLoadoutFingerprint)
      )
        throw new Error('个人搭配候选已变化，请重新搭配。')
      const [
        { projectDevelopmentWorkbenchReadProjection },
        { projectDevelopmentWorkbenchEquipmentFacts },
      ] = await Promise.all([
        import('./developmentWorkbenchReadProjection'),
        import('./developmentWorkbenchPresentationProjection'),
      ])
      if (sessions.get(query.sessionId) !== capture) throw new Error('个人搭配会话已释放。')
      return projectDevelopmentWorkbenchReadProjection({
        input: capture.input,
        base: {
          contract: 'soda-personal-development-route/v1',
          sessionId: query.sessionId,
          generationIdentity: query.generationIdentity,
          accountId: query.accountId,
          inputFingerprint: query.inputFingerprint,
          selection,
        },
        equipment: (agent) =>
          projectDevelopmentWorkbenchEquipmentFacts(
            capture.input.warehouse,
            selection.agentId,
            agent,
          ),
        resolveCandidate: () => loadout,
        scoringParameters:
          selection.candidateRank === null
            ? undefined
            : generated.effectiveParametersByRank[selection.candidateRank],
      }) as PersonalDevelopmentRoute
    },
  }
}
