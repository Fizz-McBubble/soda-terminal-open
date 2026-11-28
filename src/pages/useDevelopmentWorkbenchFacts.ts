import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { getActiveAccount } from '../accounts/repository'
import { loadDevelopmentWorkbenchFactsInput } from '../application/developmentWorkbenchFactsInput'
import { CalculationQueryClientContext } from '../application/accountDecisionWorldHooks'
import { calculationQueryContractVersion } from '../application/calculationQueryContract'
import {
  DevelopmentWorkbenchFactsIdentityMismatch,
  isCurrentDevelopmentWorkbenchFacts,
  type DevelopmentWorkbenchFactsPresentation,
  type DevelopmentWorkbenchFactsRequest,
} from '../application/publicDevelopmentWorkbenchFacts'
import type { DevelopmentCurrentRecord } from '../application/publicDevelopmentWorkbenchRoute'
import { resolveSavedAgentPlanRoute } from './agentDevelopmentSavedPlanRoute'
import { resolvePersonalReferenceDiscs } from '../accounts/personalCurrentReference'

export function selectedFactsDiscs(request: DevelopmentWorkbenchFactsRequest) {
  const { input, selection, currentRecord } = request
  const agent = input.warehouse.roster.agents.find((item) => item.agentId === selection.agentId)
  const saved = selection.preferEquipped
    ? { status: 'current' as const, plan: undefined }
    : resolveSavedAgentPlanRoute({
        requestedPlanId: selection.requestedPlanId,
        agentId: selection.agentId,
        activePlanId: input.activePlanIds[selection.agentId],
        planningDrafts: input.drafts,
        discs: input.warehouse.discs,
      })
  const ids =
    currentRecord?.selectedDiscIds ??
    (saved.status === 'current' || saved.status === 'saved'
      ? saved.plan
        ? resolvePersonalReferenceDiscs(saved.plan, input.warehouse.discs)?.map((disc) => disc.id)
        : undefined
      : undefined) ??
    agent?.equippedDiscIds ??
    []
  return input.warehouse.discs.filter((disc) => ids.includes(disc.id))
}

export function useDevelopmentWorkbenchFacts(
  agentId: string,
  requestedPlanId: string | null,
  preferEquipped: boolean,
) {
  const client = useContext(CalculationQueryClientContext)
  const query = client?.queryDevelopmentWorkbenchFacts
  const [revision, setRevision] = useState(0)
  const key = JSON.stringify([agentId, requestedPlanId, preferEquipped, revision])
  const read = useLiveQuery(async () => {
    if (!query) return { key, client, query, status: 'disabled' as const }
    try {
      const account = await getActiveAccount()
      if (!account) return { key, client, query, status: 'no_account' as const }
      const input = await loadDevelopmentWorkbenchFactsInput({
        accountId: account.id,
        agentId,
        requestedPlanId,
        preferEquipped,
      })
      return { key, client, query, status: 'ready' as const, input }
    } catch (error) {
      return { key, client, query, status: 'error' as const, error }
    }
  }, [key, client, query])
  const scopedRead =
    read?.key === key && read.client === client && read.query === query ? read : undefined
  const request = useMemo<DevelopmentWorkbenchFactsRequest | null>(
    () =>
      scopedRead?.status === 'ready'
        ? {
            input: scopedRead.input,
            selection: {
              agentId,
              requestedPlanId,
              ...(preferEquipped ? { preferEquipped: true as const } : {}),
              candidateRank: null,
              candidateLoadoutFingerprint: null,
            },
          }
        : null,
    [scopedRead, agentId, requestedPlanId, preferEquipped],
  )
  const [projected, setProjected] = useState<{
    client: typeof client
    request: DevelopmentWorkbenchFactsRequest
    value?: DevelopmentWorkbenchFactsPresentation
    failed?: true
    lastReady?: DevelopmentWorkbenchFactsPresentation
  } | null>(null)
  const execute = useCallback(
    async (next: DevelopmentWorkbenchFactsRequest, signal?: AbortSignal) => {
      if (!query) throw new Error('当前事实读取服务不可用。')
      const value = await query(
        {
          ...next,
          kind: 'development_workbench_facts',
          contractVersion: calculationQueryContractVersion,
          operationId: crypto.randomUUID(),
        },
        { signal },
      )
      if (
        value.status === 'ready' &&
        !isCurrentDevelopmentWorkbenchFacts(value, next, selectedFactsDiscs(next))
      )
        throw new DevelopmentWorkbenchFactsIdentityMismatch('当前养成资料已变化，请重新读取。')
      return value
    },
    [query],
  )
  useEffect(() => {
    if (!request) return
    const controller = new AbortController()
    void execute(request, controller.signal)
      .then((value) => {
        if (controller.signal.aborted) return
        setProjected({
          client,
          request,
          value,
          lastReady: value.status === 'ready' ? value : undefined,
        })
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setProjected((previous) => ({
          client,
          request,
          failed: true,
          lastReady:
            previous?.client === client &&
            !(error instanceof DevelopmentWorkbenchFactsIdentityMismatch)
              ? previous?.lastReady
              : undefined,
        }))
      })
    return () => controller.abort()
  }, [request, execute, client])
  const currentProjection =
    projected?.client === client && projected?.request === request ? projected : null
  const value = useMemo(() => {
    if (!request || projected?.client !== client) return null
    if (currentProjection?.value) return currentProjection.value
    // A background retry may fail without changing any current account facts.
    const lastReady = projected?.lastReady
    return lastReady &&
      isCurrentDevelopmentWorkbenchFacts(lastReady, request, selectedFactsDiscs(request))
      ? lastReady
      : null
  }, [client, currentProjection, projected, request])
  const readCurrentRecord = useCallback(
    async (record: DevelopmentCurrentRecord) => {
      const input = await loadDevelopmentWorkbenchFactsInput({
        accountId: record.accountId,
        agentId,
        requestedPlanId,
        preferEquipped,
      })
      const next: DevelopmentWorkbenchFactsRequest = {
        input,
        selection: {
          agentId,
          requestedPlanId,
          ...(preferEquipped ? { preferEquipped: true as const } : {}),
          candidateRank: null,
          candidateLoadoutFingerprint: null,
        },
        currentRecord: record,
      }
      return execute(next)
    },
    [agentId, requestedPlanId, preferEquipped, execute],
  )
  return {
    enabled: Boolean(query),
    input: scopedRead?.status === 'ready' ? scopedRead.input : null,
    request,
    value,
    error:
      scopedRead?.status === 'error' ||
      Boolean(
        currentProjection?.failed ||
        (currentProjection?.value && currentProjection.value.status !== 'ready'),
      ),
    loading:
      Boolean(query) && (!scopedRead || (scopedRead.status === 'ready' && !currentProjection)),
    noAccount: scopedRead?.status === 'no_account',
    retry: () => setRevision((value) => value + 1),
    readCurrentRecord,
  }
}
