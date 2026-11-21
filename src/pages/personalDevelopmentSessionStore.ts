import type {
  AccountDecisionQueryInput,
  CalculationQueryClient,
} from '../application/calculationQueryContract'
import {
  personalDevelopmentInputFingerprint,
  type PersonalDevelopmentCandidatesResult,
  type PersonalDevelopmentRoute,
  type PersonalDevelopmentSession,
} from '../application/publicPersonalDevelopment'
import { buildIntentFingerprintMatches } from '../application/publicBuildIntentFingerprint'

/** Ephemeral session ownership only; never stored as an Account Decision run or player asset. */
export type PersonalDevelopmentCapture = {
  /** Which saved-plan condition scope was explicitly solved; no persistent asset write. */
  contextPlanId?: string | null
  session: PersonalDevelopmentSession
  input: AccountDecisionQueryInput
  result: PersonalDevelopmentCandidatesResult
  generationParameters?: import('../application/publicPersonalDevelopment').PersonalDevelopmentCandidatesQuery['candidateParametersByRank']
  route?: PersonalDevelopmentRoute
}
const captures = new Map<
  string,
  { capture: PersonalDevelopmentCapture; client: CalculationQueryClient }
>()
const maxCaptures = 8
const key = (accountId: string, agentId: string) => JSON.stringify([accountId, agentId])

export function readPersonalDevelopmentCapture(accountId: string, agentId: string) {
  const id = key(accountId, agentId)
  const entry = captures.get(id)
  if (!entry) return null
  captures.delete(id)
  captures.set(id, entry)
  return entry.capture
}
export function isCurrentPersonalDevelopmentCapture(
  capture: PersonalDevelopmentCapture,
  input: AccountDecisionQueryInput | null | undefined,
) {
  return Boolean(
    input &&
    input.warehouse.accountId === capture.session.accountId &&
    personalDevelopmentInputFingerprint(input) === capture.session.inputFingerprint,
  )
}
export function rememberPersonalDevelopmentCapture(
  capture: PersonalDevelopmentCapture,
  client: CalculationQueryClient,
) {
  if (
    capture.session.contract !== 'soda-personal-development-session/v1' ||
    capture.result.sessionContract !== capture.session.contract ||
    capture.result.sessionId !== capture.session.sessionId ||
    capture.result.accountId !== capture.session.accountId ||
    capture.result.inputFingerprint !== capture.session.inputFingerprint ||
    capture.input.warehouse.accountId !== capture.session.accountId ||
    personalDevelopmentInputFingerprint(capture.input) !== capture.session.inputFingerprint ||
    capture.result.status !== 'ready' ||
    !(capture.result.publicProjection === 'soda-public-personal-development/v1'
      ? capture.result.buildIntent?.contract === 'soda-build-intent/v1' &&
        capture.result.buildIntent.scope === 'agent_independent' &&
        typeof capture.result.buildIntent.fingerprint === 'string' &&
        capture.result.buildIntent.fingerprint.length > 0 &&
        Object.keys(capture.result.buildIntent).every((key) =>
          ['contract', 'scope', 'fingerprint', 'independentDirection'].includes(key),
        )
      : buildIntentFingerprintMatches(capture.result.buildIntent)) ||
    (capture.route !== undefined &&
      (capture.route.contract !== 'soda-personal-development-route/v1' ||
        capture.route.sessionId !== capture.session.sessionId ||
        capture.route.accountId !== capture.session.accountId ||
        capture.route.inputFingerprint !== capture.session.inputFingerprint ||
        capture.route.generationIdentity !== capture.result.generationIdentity))
  )
    throw new Error('个人搭配结果与当前输入不一致，请重新搭配。')
  const id = key(capture.session.accountId, capture.result.agentId)
  const previous = captures.get(id)
  if (previous && previous.capture.session.sessionId !== capture.session.sessionId)
    previous.client.releasePersonalDevelopmentSession?.(previous.capture.session.sessionId)
  captures.delete(id)
  captures.set(id, { capture, client })
  while (captures.size > maxCaptures) {
    const oldestId = captures.keys().next().value!
    const oldest = captures.get(oldestId)!
    captures.delete(oldestId)
    oldest.client.releasePersonalDevelopmentSession?.(oldest.capture.session.sessionId)
  }
}
export function forgetPersonalDevelopmentCapture(
  accountId: string,
  agentId: string,
  client: CalculationQueryClient,
) {
  const id = key(accountId, agentId)
  const existing = captures.get(id)
  captures.delete(id)
  if (existing)
    existing.client.releasePersonalDevelopmentSession?.(existing.capture.session.sessionId)
  void client
}
