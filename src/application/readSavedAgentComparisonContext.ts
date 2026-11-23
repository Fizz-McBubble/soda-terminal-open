import type { AccountPlanningDraft } from '../accounts/types'
import { developmentComparisonParametersSchema } from '../accounts/developmentComparisonParametersSchema'
import type { DevelopmentComparisonParameters } from '../decision/developmentValueBenchmarkProjection'
import {
  normalizeReviewedEventConditionDeclarations32,
  reviewedEventConditionDeclarationsIdentity32,
  type ReviewedEventConditionDeclarations32,
} from '../calculation/reviewedEventConditionDeclarations32'
import {
  validateSourceResourceGrantDeclaration32,
  type SourceResourceGrantDeclaration32,
} from '../calculation/sourceMechanismResourceGrantContract32'
import type { CurrentPlanningScenarioSelection32 } from './publicPlanningScenarioContract'
import { contentHash } from './contentHash'

export type SavedAgentField<T> =
  | { state: 'recorded'; value: T }
  | { state: 'absent' }
  | { state: 'invalid'; raw: unknown }

const absent = { state: 'absent' } as const
const invalid = (raw: unknown) => ({ state: 'invalid' as const, raw })
const recorded = <T>(value: T) => ({ state: 'recorded' as const, value })
const object = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

/** Historical values are never filled from current assets or another candidate session. */
export function readSavedAgentComparisonContext(plan: AccountPlanningDraft, agentId: string) {
  const context = plan.solutionContext
  const rawParameters: unknown = context?.comparisonParameters
  const parameterObject =
    rawParameters === undefined ? undefined : object(rawParameters) ? rawParameters : null
  const field = <T>(key: string, parse: (value: unknown) => T | undefined): SavedAgentField<T> => {
    if (parameterObject === undefined) return absent
    if (parameterObject === null) return invalid(rawParameters)
    const raw = parameterObject[key]
    if (raw === undefined) return absent
    const value = parse(raw)
    return value === undefined ? invalid(raw) : recorded(value)
  }
  const wEngine = field('wEngine', (raw) => {
    const result = developmentComparisonParametersSchema.shape.wEngine.safeParse(raw)
    return result.success ? result.data : undefined
  })
  const potential = field('potential', (raw) => {
    const result = developmentComparisonParametersSchema.shape.potential.safeParse(raw)
    return result.success ? result.data : undefined
  })
  const independentDirection = field('independentDirection', (raw) => {
    const result = developmentComparisonParametersSchema.shape.independentDirection.safeParse(raw)
    return result.success ? result.data : undefined
  })
  const comparisonParameters: DevelopmentComparisonParameters = {
    ...(wEngine.state === 'recorded' ? { wEngine: wEngine.value } : {}),
    ...(potential.state === 'recorded' ? { potential: potential.value } : {}),
    ...(independentDirection.state === 'recorded'
      ? { independentDirection: independentDirection.value }
      : {}),
  }
  const storedEventIdentity: unknown = context?.eventConditionDeclarationsIdentity
  const rawEvents: unknown = context?.eventConditionDeclarationsByAgentId
  let eventDeclarations: SavedAgentField<{
    declarations: ReviewedEventConditionDeclarations32 | undefined
    computedIdentity: string | undefined
    storedIdentity: string | undefined
  }> = absent
  if (rawEvents !== undefined || storedEventIdentity !== undefined) {
    try {
      const declarations = normalizeReviewedEventConditionDeclarations32(rawEvents, [agentId])
      const computedIdentity = reviewedEventConditionDeclarationsIdentity32(declarations)
      eventDeclarations =
        storedEventIdentity !== undefined &&
        (typeof storedEventIdentity !== 'string' || storedEventIdentity !== computedIdentity)
          ? invalid({ declarations: rawEvents, storedIdentity: storedEventIdentity })
          : recorded({
              declarations,
              computedIdentity,
              storedIdentity: storedEventIdentity as string | undefined,
            })
    } catch {
      eventDeclarations = invalid({ declarations: rawEvents, storedIdentity: storedEventIdentity })
    }
  }
  const rawScenario: unknown = context?.scenarioSelection
  const storedScenarioIdentity: unknown = context?.scenarioIdentity
  let scenario: SavedAgentField<{
    selection: CurrentPlanningScenarioSelection32
    storedIdentity: string | undefined
  }> = absent
  if (rawScenario !== undefined || storedScenarioIdentity !== undefined) {
    scenario =
      object(rawScenario) &&
      rawScenario.schemaVersion === 1 &&
      (rawScenario.id === 'normalized-comparison' ||
        rawScenario.id === 'declared-stun-comparison') &&
      Object.keys(rawScenario).every((key) => key === 'schemaVersion' || key === 'id') &&
      (storedScenarioIdentity === undefined ||
        (typeof storedScenarioIdentity === 'string' && storedScenarioIdentity.length > 0))
        ? recorded({
            selection: { schemaVersion: 1, id: rawScenario.id },
            storedIdentity: storedScenarioIdentity as string | undefined,
          })
        : invalid({ selection: rawScenario, storedIdentity: storedScenarioIdentity })
  }
  const rawResource: unknown = context?.resourceGrantDeclaration32
  const resource = validateSourceResourceGrantDeclaration32(rawResource)
  const resourceGrant: SavedAgentField<{
    declaration: SourceResourceGrantDeclaration32
    identity: string
  }> =
    resource.status === 'absent'
      ? absent
      : resource.status === 'invalid'
        ? invalid(rawResource)
        : recorded({
            declaration: resource.declaration,
            identity: contentHash(resource.declaration),
          })
  const subjectMatches =
    plan.kind === 'agent' &&
    plan.selection.agentIds.length === 1 &&
    plan.selection.agentIds[0] === agentId
  return {
    planId: plan.id,
    source: {
      accountId: plan.accountId,
      sourceCandidateId: context?.sourceCandidateId,
      inputFingerprint: context?.inputFingerprint,
      gameVersion: context?.gameVersion,
      knowledgeVersion: context?.knowledgeVersion,
      rawParameters,
    },
    parameters: { wEngine, potential, independentDirection },
    eventDeclarations,
    scenario,
    resourceGrant,
    comparisonParameters: Object.keys(comparisonParameters).length
      ? comparisonParameters
      : undefined,
    replayBlocked:
      !subjectMatches ||
      [wEngine, potential, independentDirection, eventDeclarations, scenario, resourceGrant].some(
        (item) => item.state === 'invalid',
      ),
  }
}
