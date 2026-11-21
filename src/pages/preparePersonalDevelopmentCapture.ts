import type { CalculationQueryClient } from '../application/calculationQueryContract'
import { calculationQueryContractVersion } from '../application/calculationQueryContract'
import { loadPersonalDevelopmentInput } from '../application/personalDevelopmentInput'
import { readSavedAgentComparisonContext } from '../application/readSavedAgentComparisonContext'
import { personalDevelopmentInputFingerprint } from '../application/publicPersonalDevelopment'
import {
  developmentPanelDiscFingerprint,
  hasDevelopmentComparisonPanels,
} from '../application/publicDevelopmentComparisonPanels'
import { contentHash } from '../application/contentHash'
import {
  assertWorkbenchComparisonResultContext,
  developmentWorkbenchComparisonContext,
} from './developmentWorkbenchComparisonContext'
import {
  readPersonalDevelopmentCapture,
  type PersonalDevelopmentCapture,
} from './personalDevelopmentSessionStore'
import type { DevelopmentComparisonParameters } from '../decision/developmentValueBenchmark'
import { resolvePersonalReferenceDiscs } from '../accounts/personalCurrentReference'

/** Capture the complete current warehouse, never the narrower first-screen facts input. */
export async function preparePersonalDevelopmentCapture(input: {
  client: CalculationQueryClient
  accountId: string
  agentId: string
  requestedPlanId: string | null
  selectedRank: number
  requestedParameters?: DevelopmentComparisonParameters
  requestedDeclarations?: import('../calculation/reviewedEventConditionDeclarations32').ReviewedEventConditionDeclarations32
  mode: 'generate' | 'compare'
  signal?: AbortSignal
}): Promise<PersonalDevelopmentCapture> {
  const { client, accountId, agentId, requestedPlanId, signal } = input
  if (
    !client.openPersonalDevelopmentSession ||
    !client.queryPersonalDevelopmentCandidates ||
    !client.queryPersonalDevelopmentRoute
  )
    throw new Error('当前个人搭配服务不可用。')
  const captured = await loadPersonalDevelopmentInput()
  signal?.throwIfAborted()
  if (!captured || captured.warehouse.accountId !== accountId)
    throw new Error('账户已切换，请重新搭配。')
  const savedPlan = requestedPlanId
    ? captured.drafts.find(
        (plan) =>
          plan.id === requestedPlanId &&
          plan.accountId === accountId &&
          plan.selection.agentIds.length === 1 &&
          plan.selection.agentIds[0] === agentId,
      )
    : undefined
  if (requestedPlanId && !savedPlan) throw new Error('已保存方案不可用，请重新选择。')
  const saved = savedPlan ? readSavedAgentComparisonContext(savedPlan, agentId) : null
  if (saved?.replayBlocked) throw new Error('已保存方案的比较条件无效，请重新选择后比较。')
  const previous = savedPlan ? null : readPersonalDevelopmentCapture(accountId, agentId)?.result
  const { declarations, declarationIdentity, explicitParameters } =
    developmentWorkbenchComparisonContext(
      agentId,
      previous,
      input.selectedRank,
      input.requestedParameters,
      previous?.candidateParametersByRank as
        | Record<number, DevelopmentComparisonParameters>
        | undefined,
      savedPlan,
      input.requestedDeclarations,
    )
  const scenarioSelection = saved
    ? saved.scenario.state === 'recorded'
      ? saved.scenario.value.selection
      : undefined
    : previous?.scenarioSelection
  const resourceGrantDeclaration32 = saved
    ? saved.resourceGrant.state === 'recorded'
      ? saved.resourceGrant.value.declaration
      : undefined
    : previous?.resourceGrantDeclaration32
  const sessionId = crypto.randomUUID()
  let committed = false
  try {
    const session = await client.openPersonalDevelopmentSession(
      {
        contractVersion: calculationQueryContractVersion,
        kind: 'personal_development_open',
        operationId: crypto.randomUUID(),
        sessionId,
        capturedAt: new Date().toISOString(),
        input: captured,
      },
      { signal },
    )
    const result = await client.queryPersonalDevelopmentCandidates(
      {
        contractVersion: calculationQueryContractVersion,
        kind: 'personal_development_candidates',
        operationId: crypto.randomUUID(),
        sessionId,
        accountId,
        inputFingerprint: session.inputFingerprint,
        agentId,
        mode: input.mode,
        ...(explicitParameters ? { candidateParametersByRank: { 1: explicitParameters } } : {}),
        scenarioSelection,
        eventConditionDeclarationsByAgentId: declarations,
        resourceGrantDeclaration32,
      },
      { signal },
    )
    if (
      result.status !== 'ready' ||
      result.eventConditionDeclarationsIdentity !== declarationIdentity
    )
      throw new Error(result.gaps.join('；') || '仓库搭配暂不可用。')
    if (
      input.mode === 'compare' &&
      (result.mode !== 'compare' ||
        result.comparisonContract !== 'soda-explicit-development-comparison/v1' ||
        !result.comparisonFingerprint ||
        !hasDevelopmentComparisonPanels(result.panelPresentation, agentId))
    )
      throw new Error('个人比较结果不完整，请重新比较。')
    assertWorkbenchComparisonResultContext(result, saved, resourceGrantDeclaration32)
    const index = Math.min(
      explicitParameters ? 0 : input.selectedRank - 1,
      Math.max(result.candidates.length - 1, 0),
    )
    const loadout = requestedPlanId ? undefined : result.candidates[index]?.loadouts[0]
    const selection = {
      agentId,
      requestedPlanId,
      candidateRank: loadout ? index + 1 : null,
      candidateLoadoutFingerprint: loadout ? contentHash(loadout) : null,
    }
    let route: PersonalDevelopmentCapture['route']
    if (input.mode === 'generate') {
      route = await client.queryPersonalDevelopmentRoute(
        {
          contractVersion: calculationQueryContractVersion,
          kind: 'personal_development_route',
          operationId: crypto.randomUUID(),
          sessionId,
          accountId,
          inputFingerprint: session.inputFingerprint,
          generationIdentity: result.generationIdentity,
          selection,
        },
        { signal },
      )
      const ids =
        loadout?.discs.map((item) => item.disc.id) ??
        (savedPlan
          ? resolvePersonalReferenceDiscs(savedPlan, captured.warehouse.discs)?.map(
              (disc) => disc.id,
            )
          : undefined) ??
        captured.warehouse.roster.agents.find((row) => row.agentId === agentId)?.equippedDiscIds ??
        []
      const selectedDiscs = captured.warehouse.discs.filter((disc) => ids.includes(disc.id))
      if (
        route.status !== 'ready' ||
        route.selectedDiscFingerprint !== developmentPanelDiscFingerprint(selectedDiscs)
      )
        throw new Error('个人搭配预览已变化，请重新搭配。')
    }
    const latest = await loadPersonalDevelopmentInput()
    signal?.throwIfAborted()
    if (
      !latest ||
      latest.warehouse.accountId !== accountId ||
      personalDevelopmentInputFingerprint(latest) !== session.inputFingerprint
    )
      throw new Error('仓库或账户已变化，请重新搭配。')
    committed = true
    return {
      contextPlanId: requestedPlanId,
      session,
      input: captured,
      result,
      route,
      ...(explicitParameters ? { generationParameters: { 1: explicitParameters } } : {}),
    }
  } finally {
    if (!committed) client.releasePersonalDevelopmentSession?.(sessionId)
  }
}
