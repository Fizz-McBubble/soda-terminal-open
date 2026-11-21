import type { CalculationQueryClient } from '../application/calculationQueryContract'
import { calculationQueryContractVersion } from '../application/calculationQueryContract'
import { loadPersonalDevelopmentInput } from '../application/personalDevelopmentInput'
import { contentHash } from '../application/contentHash'
import {
  personalDevelopmentInputFingerprint,
  type PersonalDevelopmentCandidatesQuery,
  type PersonalDevelopmentCandidatesResult,
  type PersonalDevelopmentSession,
} from '../application/publicPersonalDevelopment'
import { createComparisonSavedBuild } from './createComparisonSavedBuild'
import {
  isCurrentPersonalDevelopmentCapture,
  rememberPersonalDevelopmentCapture,
  type PersonalDevelopmentCapture,
} from './personalDevelopmentSessionStore'
import { rebindComparisonParameters } from './rebindComparisonParameters'
import {
  normalizeReviewedEventConditionDeclarations32,
  reviewedEventConditionDeclarationsIdentity32,
} from '../calculation/reviewedEventConditionDeclarations32'

export function createPersonalSavedBuild(
  agentId: string,
  rank: number,
  capture: PersonalDevelopmentCapture,
) {
  if (
    capture.result.agentId !== agentId ||
    capture.result.sessionId !== capture.session.sessionId ||
    capture.result.inputFingerprint !== capture.session.inputFingerprint
  )
    throw new Error('当前搭配身份已变化，尚未保存。')
  return createComparisonSavedBuild(agentId, rank, capture.result, capture.result.saveKnowledge)
}

type ParametersByRank = PersonalDevelopmentCandidatesQuery['candidateParametersByRank']

/** Keep the issued session and physical binding; only the requested comparison work is added. */
export async function queryPersonalComparison(input: {
  client: CalculationQueryClient
  capture: PersonalDevelopmentCapture
  parameters?: ParametersByRank
  scenarioSelection?: PersonalDevelopmentCandidatesQuery['scenarioSelection']
  declarations?: PersonalDevelopmentCandidatesQuery['eventConditionDeclarationsByAgentId']
  wEngineComparison?: PersonalDevelopmentCandidatesQuery['wEngineComparison']
  session?: PersonalDevelopmentSession
  signal?: AbortSignal
}) {
  const { client, capture, signal } = input
  const session = input.session ?? capture.session
  if (!client.queryPersonalDevelopmentCandidates) throw new Error('个人比较服务不可用。')
  signal?.throwIfAborted()
  // Omission preserves the capture for a generate-to-compare upgrade; an explicit
  // undefined clears a prior binding while recomputing/rebinding changed conditions.
  const parameters = Object.hasOwn(input, 'parameters')
    ? input.parameters
    : capture.generationParameters
  const requestedScenario = Object.hasOwn(input, 'scenarioSelection')
    ? input.scenarioSelection
    : capture.result.scenarioSelection
  const requestedDeclarations = normalizeReviewedEventConditionDeclarations32(
    Object.hasOwn(input, 'declarations')
      ? input.declarations
      : capture.result.eventConditionDeclarationsByAgentId,
    [capture.result.agentId],
  )
  const result = await client.queryPersonalDevelopmentCandidates(
    {
      contractVersion: calculationQueryContractVersion,
      kind: 'personal_development_candidates',
      operationId: crypto.randomUUID(),
      sessionId: session.sessionId,
      accountId: session.accountId,
      inputFingerprint: session.inputFingerprint,
      agentId: capture.result.agentId,
      mode: 'compare',
      candidateParametersByRank: parameters,
      scenarioSelection: requestedScenario,
      eventConditionDeclarationsByAgentId: requestedDeclarations,
      resourceGrantDeclaration32: capture.result.resourceGrantDeclaration32,
      wEngineComparison: input.wEngineComparison,
    },
    { signal },
  )
  signal?.throwIfAborted()
  const declarationIdentity = reviewedEventConditionDeclarationsIdentity32(requestedDeclarations)
  if (
    result.status !== 'ready' ||
    result.mode !== 'compare' ||
    result.comparisonContract !== 'soda-explicit-development-comparison/v1' ||
    !result.comparisonFingerprint ||
    !result.panelPresentation ||
    result.sessionId !== session.sessionId ||
    result.inputFingerprint !== session.inputFingerprint ||
    result.accountId !== session.accountId ||
    result.agentId !== capture.result.agentId ||
    result.eventConditionDeclarationsIdentity !== declarationIdentity ||
    reviewedEventConditionDeclarationsIdentity32(result.eventConditionDeclarationsByAgentId) !==
      declarationIdentity ||
    !result.scenarioIdentity ||
    (requestedScenario !== undefined && result.scenarioSelection?.id !== requestedScenario.id) ||
    contentHash(result.resourceGrantDeclaration32 ?? null) !==
      contentHash(capture.result.resourceGrantDeclaration32 ?? null)
  )
    throw new Error('个人比较结果不属于当前搭配，请重新比较。')
  return result
}

export async function recalculatePersonalComparison(input: {
  client: CalculationQueryClient
  capture: PersonalDevelopmentCapture
  scenarioSelection: NonNullable<PersonalDevelopmentCandidatesQuery['scenarioSelection']>
  declarations?: PersonalDevelopmentCandidatesQuery['eventConditionDeclarationsByAgentId']
  stale: boolean
  signal: AbortSignal
  isCurrent: () => boolean
  readCurrentFingerprint: () => string | undefined
}) {
  const { client, capture, signal, isCurrent } = input
  const capturedInput = input.stale ? await loadPersonalDevelopmentInput() : capture.input
  signal.throwIfAborted()
  if (!isCurrent()) return null
  if (!capturedInput || capturedInput.warehouse.accountId !== capture.session.accountId)
    throw new Error('账户已切换，请重新比较。')
  let session = capture.session
  let retained = false
  const replacesSession =
    input.stale || client.hasPersonalDevelopmentSession?.(session.sessionId) === false
  let openedSessionId: string | null = null
  try {
    if (replacesSession) {
      if (!client.openPersonalDevelopmentSession) throw new Error('个人搭配服务不可用。')
      openedSessionId = crypto.randomUUID()
      session = await client.openPersonalDevelopmentSession(
        {
          contractVersion: calculationQueryContractVersion,
          kind: 'personal_development_open',
          operationId: crypto.randomUUID(),
          sessionId: openedSessionId,
          capturedAt: new Date().toISOString(),
          input: capturedInput,
        },
        { signal },
      )
    }
    const declarations = normalizeReviewedEventConditionDeclarations32(
      input.declarations ?? capture.result.eventConditionDeclarationsByAgentId,
      [capture.result.agentId],
    )
    const declarationIdentity = reviewedEventConditionDeclarationsIdentity32(declarations)
    const prior = capture.result.candidateParametersByRank
    const hasDirection =
      !!capture.result.buildIntent.independentDirection ||
      Object.values(prior ?? {}).some((row) => row.independentDirection)
    if (hasDirection && !Object.values(prior ?? {}).some((row) => row.independentDirection))
      throw new Error('个人方向参数缺失，请重新搭配。')
    const first = hasDirection ? prior : undefined
    const request = (parameters: ParametersByRank) =>
      queryPersonalComparison({
        client,
        capture,
        session,
        parameters,
        scenarioSelection: input.scenarioSelection,
        declarations,
        signal,
      })
    let result = await request(first)
    if (!isCurrent()) return null
    const rebound = rebindComparisonParameters(capture.result, result)
    if (
      (input.declarations !== undefined || hasDirection) &&
      Object.keys(rebound).length !== Object.keys(prior ?? {}).length
    )
      throw new Error('原方案参数无法绑定到当前候选，请重新比较。')
    if (Object.keys(rebound).length && contentHash(first ?? {}) !== contentHash(rebound))
      result = await request(rebound)
    signal.throwIfAborted()
    if (!isCurrent()) return null
    const actualParameters = result.candidateParametersByRank ?? {}
    const direction =
      capture.result.buildIntent.independentDirection ??
      Object.values(prior ?? {}).find((row) => row.independentDirection)?.independentDirection
    const parametersMatch = hasDirection
      ? Object.entries(rebound).every(
          ([rank, parameters]) =>
            contentHash(actualParameters[Number(rank)] ?? null) === contentHash(parameters),
        ) &&
        Object.values(actualParameters).every(
          (parameters) =>
            contentHash(parameters.independentDirection ?? null) === contentHash(direction),
        )
      : contentHash(actualParameters) === contentHash(rebound)
    if (
      result.scenarioSelection?.id !== input.scenarioSelection.id ||
      !result.scenarioIdentity ||
      ((input.declarations !== undefined || hasDirection) && !parametersMatch) ||
      result.eventConditionDeclarationsIdentity !== declarationIdentity ||
      reviewedEventConditionDeclarationsIdentity32(result.eventConditionDeclarationsByAgentId) !==
        declarationIdentity ||
      contentHash(result.resourceGrantDeclaration32 ?? null) !==
        contentHash(capture.result.resourceGrantDeclaration32 ?? null) ||
      (!input.stale && input.readCurrentFingerprint() !== capture.result.comparisonFingerprint)
    )
      throw new Error('比较条件或搭配已变化，请重新比较。')
    const latest = await loadPersonalDevelopmentInput()
    signal.throwIfAborted()
    if (!isCurrent()) return null
    if (!latest || personalDevelopmentInputFingerprint(latest) !== session.inputFingerprint)
      throw new Error('账户或仓库已变化，请重新比较。')
    const next: PersonalDevelopmentCapture = {
      session,
      input: capturedInput,
      result,
      generationParameters: Object.keys(rebound).length ? rebound : first,
    }
    rememberPersonalDevelopmentCapture(next, client)
    retained = true
    return next
  } finally {
    if (openedSessionId && !retained) client.releasePersonalDevelopmentSession?.(openedSessionId)
  }
}

function physicalKey(result: PersonalDevelopmentCandidatesResult, rank: number) {
  const discs = result.candidates[rank - 1]?.loadouts[0]?.discs
  return discs?.length === 6 ? contentHash(discs.map((row) => row.disc.id).toSorted()) : null
}

/** Saving changes proposal facts, so capture a new real input and retain the player's six discs. */
export async function refreshPersonalAfterSave(input: {
  client: CalculationQueryClient
  capture: PersonalDevelopmentCapture
  rank: number
  discIds: readonly string[]
  isCurrent: () => boolean
  signal?: AbortSignal
}): Promise<{ capture: PersonalDevelopmentCapture; rank: number } | null> {
  const { client, capture, signal, isCurrent } = input
  if (!client.openPersonalDevelopmentSession || !client.queryPersonalDevelopmentCandidates)
    throw new Error('个人搭配服务不可用。')
  const nextInput = await loadPersonalDevelopmentInput()
  signal?.throwIfAborted()
  if (!isCurrent()) return null
  if (!nextInput || nextInput.warehouse.accountId !== capture.session.accountId)
    throw new Error('账户已切换，方案已保存但搭配未刷新。')
  const sessionId = crypto.randomUUID()
  let retained = false
  try {
    const session = await client.openPersonalDevelopmentSession(
      {
        contractVersion: calculationQueryContractVersion,
        kind: 'personal_development_open',
        operationId: crypto.randomUUID(),
        sessionId,
        capturedAt: new Date().toISOString(),
        input: nextInput,
      },
      { signal },
    )
    const parameters = capture.result.candidateParametersByRank?.[input.rank]
    const result = await client.queryPersonalDevelopmentCandidates(
      {
        contractVersion: calculationQueryContractVersion,
        kind: 'personal_development_candidates',
        operationId: crypto.randomUUID(),
        sessionId,
        accountId: session.accountId,
        inputFingerprint: session.inputFingerprint,
        agentId: capture.result.agentId,
        mode: capture.result.mode,
        candidateParametersByRank: parameters ? { 1: parameters } : undefined,
        scenarioSelection: capture.result.scenarioSelection,
        eventConditionDeclarationsByAgentId: capture.result.eventConditionDeclarationsByAgentId,
        resourceGrantDeclaration32: capture.result.resourceGrantDeclaration32,
      },
      { signal },
    )
    signal?.throwIfAborted()
    if (!isCurrent()) return null
    if (
      result.status !== 'ready' ||
      result.sessionId !== sessionId ||
      result.inputFingerprint !== session.inputFingerprint ||
      result.accountId !== session.accountId ||
      result.agentId !== capture.result.agentId
    )
      throw new Error('已保存方案的个人搭配未完成刷新。')
    const latestInput = await loadPersonalDevelopmentInput()
    signal?.throwIfAborted()
    if (!isCurrent()) return null
    if (
      !latestInput ||
      personalDevelopmentInputFingerprint(latestInput) !== session.inputFingerprint
    )
      throw new Error('账户或仓库已变化，已保存方案等待刷新。')
    const selectedKey = contentHash([...input.discIds].toSorted())
    const selectedRank =
      result.candidates.findIndex((_, index) => physicalKey(result, index + 1) === selectedKey) + 1
    if (!selectedRank) return null
    if (
      parameters &&
      contentHash(result.candidateParametersByRank?.[selectedRank] ?? null) !==
        contentHash(parameters)
    )
      return null
    const nextCapture: PersonalDevelopmentCapture = {
      session,
      input: nextInput,
      result,
      generationParameters: parameters ? { 1: parameters } : undefined,
    }
    if (!isCurrentPersonalDevelopmentCapture(nextCapture, latestInput))
      throw new Error('已保存方案的输入身份已变化。')
    rememberPersonalDevelopmentCapture(nextCapture, client)
    retained = true
    return { capture: nextCapture, rank: selectedRank }
  } finally {
    if (!retained) client.releasePersonalDevelopmentSession?.(sessionId)
  }
}
