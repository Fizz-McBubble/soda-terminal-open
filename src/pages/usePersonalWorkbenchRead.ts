import { useContext, useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { CalculationQueryClientContext } from '../application/accountDecisionWorldHooks'
import { calculationQueryContractVersion } from '../application/calculationQueryContract'
import { loadPersonalDevelopmentInput } from '../application/personalDevelopmentInput'
import {
  readPersonalDevelopmentCapture,
  isCurrentPersonalDevelopmentCapture,
} from './personalDevelopmentSessionStore'
import type { PersonalDevelopmentRoute } from '../application/publicPersonalDevelopment'
import { contentHash } from '../application/contentHash'
import { developmentPanelDiscFingerprint } from '../application/publicDevelopmentComparisonPanels'

export function usePersonalWorkbenchRead({
  pageAccountId,
  agentId,
  requestedPlanId,
  preferEquipped,
  analysisVersion,
  requestedCandidateRank,
}: {
  pageAccountId: string | undefined
  agentId: string
  requestedPlanId: string | null
  preferEquipped: boolean
  analysisVersion: number
  requestedCandidateRank: number
}) {
  const personalClient = useContext(CalculationQueryClientContext)
  const personalCapture =
    pageAccountId && !requestedPlanId && !preferEquipped
      ? readPersonalDevelopmentCapture(pageAccountId, agentId)
      : null
  const personalInput = useLiveQuery(async () => {
    if (!personalCapture) return null
    try {
      return await loadPersonalDevelopmentInput()
    } catch {
      return null
    }
  }, [pageAccountId, agentId, analysisVersion, personalCapture?.session.sessionId])
  const personalCurrent = Boolean(
    personalCapture &&
    personalClient?.hasPersonalDevelopmentSession?.(personalCapture.session.sessionId) &&
    isCurrentPersonalDevelopmentCapture(personalCapture, personalInput),
  )
  const personalRank = personalCapture
    ? Math.min(
        Math.max(
          (Number.isFinite(requestedCandidateRank) && requestedCandidateRank > 0
            ? requestedCandidateRank
            : 1) - 1,
          0,
        ),
        Math.max(personalCapture.result.candidates.length - 1, 0),
      )
    : 0
  const personalLoadout = personalCurrent
    ? personalCapture?.result.candidates[personalRank]?.loadouts[0]
    : undefined
  const personalRouteKey =
    personalLoadout && personalCapture
      ? contentHash([
          personalCapture.session.sessionId,
          personalCapture.result.generationIdentity,
          personalRank,
          personalLoadout,
        ])
      : null
  const initialPersonalRoute =
    personalCurrent &&
    personalLoadout &&
    personalCapture?.route &&
    personalCapture.route.generationIdentity === personalCapture.result.generationIdentity &&
    personalCapture.route.selection.candidateRank === personalRank + 1 &&
    personalCapture.route.selection.candidateLoadoutFingerprint === contentHash(personalLoadout) &&
    personalCapture.route.selectedDiscFingerprint ===
      developmentPanelDiscFingerprint(personalLoadout.discs.map((row) => row.disc))
      ? personalCapture.route
      : null
  const [personalRouteRead, setPersonalRouteRead] = useState<{
    key: string
    value: PersonalDevelopmentRoute
  } | null>(null)
  const [personalRouteFailure, setPersonalRouteFailure] = useState<string | null>(null)
  useEffect(() => {
    if (
      initialPersonalRoute ||
      !personalRouteKey ||
      !personalCapture ||
      !personalLoadout ||
      !personalClient?.queryPersonalDevelopmentRoute
    )
      return
    // A route preview borrows the shared personal session. Aborting an active
    // worker request destroys that worker and every live session, including the
    // comparison just handed to the next page. Detach this observer instead;
    // session ownership and explicit session release remain with the store.
    let observing = true
    const selection = {
      agentId,
      requestedPlanId: null,
      candidateRank: personalRank + 1,
      candidateLoadoutFingerprint: contentHash(personalLoadout),
    }
    void personalClient
      .queryPersonalDevelopmentRoute({
        contractVersion: calculationQueryContractVersion,
        kind: 'personal_development_route',
        operationId: crypto.randomUUID(),
        sessionId: personalCapture.session.sessionId,
        accountId: personalCapture.session.accountId,
        inputFingerprint: personalCapture.session.inputFingerprint,
        generationIdentity: personalCapture.result.generationIdentity,
        selection,
      })
      .then((value) => {
        if (!observing) return
        if (
          value.status !== 'ready' ||
          value.selectedDiscFingerprint !==
            developmentPanelDiscFingerprint(personalLoadout.discs.map((row) => row.disc))
        )
          throw new Error('个人搭配预览身份不匹配。')
        setPersonalRouteFailure(null)
        setPersonalRouteRead({ key: personalRouteKey, value })
      })
      .catch(() => {
        if (observing) {
          setPersonalRouteRead(null)
          setPersonalRouteFailure(personalRouteKey)
        }
      })
    return () => {
      observing = false
    }
  }, [
    agentId,
    analysisVersion,
    initialPersonalRoute,
    personalCapture,
    personalClient,
    personalLoadout,
    personalRank,
    personalRouteKey,
  ])
  const personalRoute =
    initialPersonalRoute ??
    (personalCurrent && personalRouteRead?.key === personalRouteKey
      ? personalRouteRead.value
      : null)
  const personalSnapshot =
    personalRoute && personalCapture?.result.status === 'ready' ? personalCapture.result : null
  return {
    personalCapture,
    personalInput,
    personalCurrent,
    personalRouteKey,
    initialPersonalRoute,
    personalRouteRead,
    personalRouteFailure,
    setPersonalRouteFailure,
    personalRoute,
    personalSnapshot,
  }
}

export function selectWorkbenchRun(
  decisionWorld: import('../application/accountDecisionWorldModel').AccountDecisionWorldContextValue,
  requestedCandidateRank: number,
) {
  const selectedCandidateRank =
    Number.isFinite(requestedCandidateRank) && requestedCandidateRank > 0
      ? requestedCandidateRank
      : 1
  const currentRun =
    decisionWorld.status === 'current' && decisionWorld.analysisIssue?.kind !== 'run_lost'
      ? decisionWorld.run
      : null
  const retainedRun =
    decisionWorld.status === 'current' || decisionWorld.status === 'stale'
      ? decisionWorld.run
      : null
  return { selectedCandidateRank, currentRun, retainedRun }
}
